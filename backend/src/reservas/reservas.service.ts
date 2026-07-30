import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AccionMovimiento,
  EstadoReserva,
  Prisma,
  type Empresa,
} from '../../generated/prisma';
import { normalizarNit, type NitNormalizado } from '../comun/nit';
import { FormulariosService } from '../formularios/formularios.service';
import { PrismaService } from '../prisma/prisma.service';
import { CrearReservaDto } from './dto/crear-reserva.dto';

/** Lo que devuelve el SELECT ... FOR UPDATE sobre la oferta. */
type OfertaBloqueada = {
  id: string;
  cuposMaximos: number;
  cuposOcupados: number;
  abierta: boolean;
};

type Contexto = { ip: string; userAgent?: string };

@Injectable()
export class ReservasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formularios: FormulariosService,
  ) {}

  // -------------------------------------------------------------------------
  // Crear
  // -------------------------------------------------------------------------

  async crear(dto: CrearReservaDto, contexto: Contexto) {
    const nit = this.exigirNit(dto.nit);

    const oferta = await this.prisma.oferta.findUnique({
      where: { id: dto.ofertaId },
      include: { accionFormacion: true },
    });
    if (!oferta) {
      throw new NotFoundException('La oferta no existe.');
    }
    if (!oferta.abierta || !oferta.accionFormacion.visible) {
      throw new ConflictException('Esta oferta no está abierta para reservas.');
    }
    if (dto.cuposSolicitados > oferta.cuposMaximos) {
      throw new BadRequestException(
        `Esta oferta tiene ${oferta.cuposMaximos} cupos en total; ` +
          `no se pueden solicitar ${dto.cuposSolicitados}.`,
      );
    }

    // Fuera de la transacción a propósito: si el upsert de la empresa choca
    // con otro que llega a la vez, Postgres aborta la transacción entera y ya
    // no se puede seguir dentro de ella. Aquí el reintento sí es posible.
    const empresa = await this.asegurarEmpresa(nit, dto);
    const politicaId = await this.politicaVigente(oferta.accionFormacion.convenioId);

    // Las respuestas del formulario se validan ANTES de abrir la transacción:
    // si una es inválida, es mejor devolver el error sin haber bloqueado la
    // oferta ni haber tocado el contador.
    const respuestas = dto.formularioSlug
      ? await this.formularios.prepararRespuestas(dto.formularioSlug, dto.respuestas ?? [])
      : [];

    return this.prisma.$transaction(
      async (tx) => {
        const bloqueada = await this.bloquearOferta(tx, oferta.id);

        const existente = await tx.reserva.findUnique({
          where: { empresaId_ofertaId: { empresaId: empresa.id, ofertaId: oferta.id } },
        });

        if (existente && existente.estado !== EstadoReserva.CANCELADA) {
          // Doble clic o reintento de Cloudflare: la misma petición otra vez.
          // Se devuelve lo que ya hay en vez de un error, que es lo correcto
          // porque el resultado final es exactamente el que pidió.
          if (existente.cuposSolicitados === dto.cuposSolicitados) {
            return this.vista(tx, existente.id);
          }
          // Cantidad distinta: es una intención nueva, no un reenvío. No se
          // decide por la empresa; que el frontend pregunte si quiere cambiarla.
          throw new ConflictException({
            message:
              `Esta empresa ya tiene una reserva de ${existente.cuposSolicitados} ` +
              `cupos en esta oferta. Use la edición para cambiar la cantidad.`,
            reservaId: existente.id,
            cuposSolicitados: existente.cuposSolicitados,
          });
        }

        const disponibles = bloqueada.cuposMaximos - bloqueada.cuposOcupados;
        const confirmados = Math.min(dto.cuposSolicitados, Math.max(disponibles, 0));
        const enEspera = dto.cuposSolicitados - confirmados;

        await this.moverContador(tx, oferta.id, confirmados);

        const datos = {
          cuposSolicitados: dto.cuposSolicitados,
          cuposConfirmados: confirmados,
          cuposEnEspera: enEspera,
          estado: confirmados > 0 ? EstadoReserva.CONFIRMADA : EstadoReserva.LISTA_ESPERA,
          contactoNombre: dto.contactoNombre,
          contactoCorreo: dto.contactoCorreo,
          contactoCelular: dto.contactoCelular ?? null,
          contactoCargo: dto.contactoCargo ?? null,
          aceptaTerminos: dto.aceptaTerminos,
          aceptaPoliticaDatos: dto.aceptaPoliticaDatos,
          politicaDatosId: politicaId,
          ipOrigen: contexto.ip,
          canceladaEn: null,
        };

        const reserva = existente
          ? // Estaba cancelada: se revive la misma fila. Crear otra chocaría
            // con el índice único (empresa, oferta).
            await tx.reserva.update({ where: { id: existente.id }, data: datos })
          : await tx.reserva.create({
              data: { empresaId: empresa.id, ofertaId: oferta.id, ...datos },
            });

        if (respuestas.length) {
          // Al revivir una reserva cancelada se descartan las respuestas de
          // entonces: son de otro envío y el índice único (reserva, pregunta)
          // rechazaría las nuevas.
          if (existente) {
            await tx.respuesta.deleteMany({ where: { reservaId: reserva.id } });
          }
          for (const respuesta of respuestas) {
            await tx.respuesta.create({
              data: { ...respuesta, reserva: { connect: { id: reserva.id } } },
            });
          }
        }

        await tx.movimientoReserva.create({
          data: {
            reservaId: reserva.id,
            accion: AccionMovimiento.CREACION,
            confirmadosAntes: existente?.cuposConfirmados ?? 0,
            confirmadosDespues: confirmados,
            enEsperaAntes: existente?.cuposEnEspera ?? 0,
            enEsperaDespues: enEspera,
            ip: contexto.ip,
            userAgent: contexto.userAgent ?? null,
          },
        });

        return this.vista(tx, reserva.id);
      },
      { timeout: 15_000 },
    );
  }

  // -------------------------------------------------------------------------
  // Editar cantidad
  // -------------------------------------------------------------------------

  async editar(reservaId: string, nitCrudo: string, cantidad: number, contexto: Contexto) {
    const nit = this.exigirNit(nitCrudo);

    return this.prisma.$transaction(
      async (tx) => {
        const reserva = await this.reservaDeLaEmpresa(tx, reservaId, nit.nit);

        if (reserva.estado === EstadoReserva.CANCELADA) {
          throw new ConflictException(
            'Esta reserva está cancelada. Haga una reserva nueva.',
          );
        }

        // El lock se toma DESPUÉS de leer la reserva pero antes de calcular
        // nada: entre el cálculo y el UPDATE no puede colarse nadie.
        const oferta = await this.bloquearOferta(tx, reserva.ofertaId);
        if (cantidad > oferta.cuposMaximos) {
          throw new BadRequestException(
            `Esta oferta tiene ${oferta.cuposMaximos} cupos en total.`,
          );
        }

        // Techo de esta reserva: lo que hay libre MÁS lo que ella ya ocupaba,
        // porque sus propios cupos vuelven a estar a su disposición.
        const techo = oferta.cuposMaximos - oferta.cuposOcupados + reserva.cuposConfirmados;
        const confirmados = Math.min(cantidad, Math.max(techo, 0));
        const enEspera = cantidad - confirmados;
        const delta = confirmados - reserva.cuposConfirmados;

        await this.moverContador(tx, oferta.id, delta);

        await tx.reserva.update({
          where: { id: reserva.id },
          data: {
            cuposSolicitados: cantidad,
            cuposConfirmados: confirmados,
            cuposEnEspera: enEspera,
            estado: confirmados > 0 ? EstadoReserva.CONFIRMADA : EstadoReserva.LISTA_ESPERA,
          },
        });

        await tx.movimientoReserva.create({
          data: {
            reservaId: reserva.id,
            accion: AccionMovimiento.EDICION,
            confirmadosAntes: reserva.cuposConfirmados,
            confirmadosDespues: confirmados,
            enEsperaAntes: reserva.cuposEnEspera,
            enEsperaDespues: enEspera,
            ip: contexto.ip,
            userAgent: contexto.userAgent ?? null,
          },
        });

        // Si bajó la cantidad quedaron cupos libres: se reparten ya mismo,
        // dentro del mismo lock, para que nadie vea disponibilidad fantasma.
        if (delta < 0) {
          await this.promoverListaDeEspera(tx, oferta.id, contexto);
        }

        return this.vista(tx, reserva.id);
      },
      { timeout: 15_000 },
    );
  }

  // -------------------------------------------------------------------------
  // Cancelar
  // -------------------------------------------------------------------------

  async cancelar(reservaId: string, nitCrudo: string, contexto: Contexto) {
    const nit = this.exigirNit(nitCrudo);

    return this.prisma.$transaction(
      async (tx) => {
        const reserva = await this.reservaDeLaEmpresa(tx, reservaId, nit.nit);
        if (reserva.estado === EstadoReserva.CANCELADA) {
          return this.vista(tx, reserva.id);
        }

        const oferta = await this.bloquearOferta(tx, reserva.ofertaId);

        // Cancelar DEVUELVE el cupo. En el Excel actual no lo devolvía y la
        // silla quedaba muerta para siempre.
        await this.moverContador(tx, oferta.id, -reserva.cuposConfirmados);

        await tx.reserva.update({
          where: { id: reserva.id },
          data: {
            cuposConfirmados: 0,
            cuposEnEspera: 0,
            estado: EstadoReserva.CANCELADA,
            canceladaEn: new Date(),
          },
        });

        await tx.movimientoReserva.create({
          data: {
            reservaId: reserva.id,
            accion: AccionMovimiento.CANCELACION,
            confirmadosAntes: reserva.cuposConfirmados,
            confirmadosDespues: 0,
            enEsperaAntes: reserva.cuposEnEspera,
            enEsperaDespues: 0,
            ip: contexto.ip,
            userAgent: contexto.userAgent ?? null,
          },
        });

        await this.promoverListaDeEspera(tx, oferta.id, contexto);

        return this.vista(tx, reserva.id);
      },
      { timeout: 15_000 },
    );
  }

  // -------------------------------------------------------------------------
  // Consultar
  // -------------------------------------------------------------------------

  async consultarPorNit(nitCrudo: string) {
    const nit = this.exigirNit(nitCrudo);

    const empresa = await this.prisma.empresa.findUnique({
      where: { nit: nit.nit },
      include: {
        reservas: {
          orderBy: { creadoEn: 'desc' },
          include: {
            oferta: {
              include: {
                ubicacion: true,
                accionFormacion: { include: { convenio: true } },
              },
            },
          },
        },
      },
    });

    if (!empresa) {
      return { empresa: null, reservas: [], totalCupos: 0 };
    }

    return {
      empresa: {
        nit: empresa.nit,
        digitoVerificacion: empresa.digitoVerificacion,
        razonSocial: empresa.razonSocial,
        numeroColaboradores: empresa.numeroColaboradores,
        redAsociada: empresa.redAsociada,
      },
      reservas: empresa.reservas.map((r) => ({
        id: r.id,
        estado: r.estado,
        cuposSolicitados: r.cuposSolicitados,
        cuposConfirmados: r.cuposConfirmados,
        cuposEnEspera: r.cuposEnEspera,
        creadoEn: r.creadoEn,
        oferta: {
          id: r.oferta.id,
          modalidad: r.oferta.modalidad,
          ubicacion: r.oferta.ubicacion.nombre,
          tipoUbicacion: r.oferta.ubicacion.tipo,
          accion: {
            codigo: r.oferta.accionFormacion.codigo,
            nombre: r.oferta.accionFormacion.nombre,
            horas: r.oferta.accionFormacion.horas,
          },
          convenio: r.oferta.accionFormacion.convenio.slug,
        },
      })),
      // Lo que el cliente pidió poder ver: cuántos cupos lleva cada empresa.
      totalCupos: empresa.reservas
        .filter((r) => r.estado !== EstadoReserva.CANCELADA)
        .reduce((suma, r) => suma + r.cuposConfirmados, 0),
    };
  }

  // -------------------------------------------------------------------------
  // Piezas internas
  // -------------------------------------------------------------------------

  private exigirNit(valor: string): NitNormalizado {
    const nit = normalizarNit(valor);
    if (!nit) {
      throw new BadRequestException(
        'El NIT no tiene un formato válido. Ejemplos: 860505081 o 860505081-5.',
      );
    }
    return nit;
  }

  /**
   * Bloquea la fila de la oferta hasta el final de la transacción. Serializa
   * las reservas de UNA oferta sin estorbar a las otras 105.
   *
   * Sin este lock, el reparto parcial (pide 10, caben 6) es imposible de hacer
   * bien: hay que leer cuántos quedan para decidir cuántos otorgar, y en
   * Postgres 17 `RETURNING` no puede devolver el valor anterior de la fila.
   */
  private async bloquearOferta(
    tx: Prisma.TransactionClient,
    ofertaId: string,
  ): Promise<OfertaBloqueada> {
    const filas = await tx.$queryRaw<OfertaBloqueada[]>`
      SELECT "id", "cuposMaximos", "cuposOcupados", "abierta"
        FROM "ofertas"
       WHERE "id" = ${ofertaId}
         FOR UPDATE`;

    const oferta = filas[0];
    if (!oferta) {
      throw new NotFoundException('La oferta no existe.');
    }
    return oferta;
  }

  /**
   * Mueve el contador con la condición dentro del propio UPDATE. Con el lock
   * ya tomado es redundante, y esa es la idea: si alguien quita el lock algún
   * día, esto sigue impidiendo la sobreventa. Y si aun así pasara, el CHECK
   * de la base es la tercera barrera.
   */
  private async moverContador(
    tx: Prisma.TransactionClient,
    ofertaId: string,
    delta: number,
  ): Promise<void> {
    if (delta === 0) return;

    const filas = await tx.$executeRaw`
      UPDATE "ofertas"
         SET "cuposOcupados" = "cuposOcupados" + ${delta}
       WHERE "id" = ${ofertaId}
         AND "cuposOcupados" + ${delta} >= 0
         AND "cuposOcupados" + ${delta} <= "cuposMaximos"`;

    if (filas === 0) {
      throw new ConflictException(
        'Los cupos cambiaron mientras se procesaba la solicitud. Vuelva a intentarlo.',
      );
    }
  }

  /**
   * Reparte los cupos que acaban de quedar libres entre quienes esperan, por
   * orden de llegada. Corre dentro del lock de la oferta de quien liberó, así
   * que nadie puede colarse en el hueco entre liberar y promover.
   */
  private async promoverListaDeEspera(
    tx: Prisma.TransactionClient,
    ofertaId: string,
    contexto: Contexto,
  ): Promise<void> {
    const oferta = await tx.oferta.findUniqueOrThrow({ where: { id: ofertaId } });
    let libres = oferta.cuposMaximos - oferta.cuposOcupados;
    if (libres <= 0) return;

    const esperando = await tx.reserva.findMany({
      where: {
        ofertaId,
        cuposEnEspera: { gt: 0 },
        estado: { not: EstadoReserva.CANCELADA },
      },
      orderBy: { creadoEn: 'asc' },
    });

    let promovidos = 0;
    for (const reserva of esperando) {
      if (libres <= 0) break;

      // Promoción parcial: si una espera 4 y solo hay 2 libres, se le dan 2 y
      // sigue esperando por los otros 2. Saltársela por no caber entera
      // rompería el orden de llegada.
      const mueve = Math.min(libres, reserva.cuposEnEspera);

      await tx.reserva.update({
        where: { id: reserva.id },
        data: {
          cuposConfirmados: reserva.cuposConfirmados + mueve,
          cuposEnEspera: reserva.cuposEnEspera - mueve,
          estado: EstadoReserva.CONFIRMADA,
        },
      });

      await tx.movimientoReserva.create({
        data: {
          reservaId: reserva.id,
          accion: AccionMovimiento.PROMOCION_LISTA_ESPERA,
          confirmadosAntes: reserva.cuposConfirmados,
          confirmadosDespues: reserva.cuposConfirmados + mueve,
          enEsperaAntes: reserva.cuposEnEspera,
          enEsperaDespues: reserva.cuposEnEspera - mueve,
          ip: contexto.ip,
          userAgent: contexto.userAgent ?? null,
          nota: 'Promoción automática al liberarse cupos.',
        },
      });

      libres -= mueve;
      promovidos += mueve;
    }

    if (promovidos > 0) {
      await this.moverContador(tx, ofertaId, promovidos);
    }
  }

  private async reservaDeLaEmpresa(
    tx: Prisma.TransactionClient,
    reservaId: string,
    nit: string,
  ) {
    const reserva = await tx.reserva.findUnique({
      where: { id: reservaId },
      include: { empresa: true },
    });

    // Mismo error para "no existe" y "no es tuya": distinguirlos permitiría
    // averiguar qué reservas existen probando identificadores.
    if (!reserva || reserva.empresa.nit !== nit) {
      throw new NotFoundException('No se encontró una reserva con ese identificador y NIT.');
    }
    return reserva;
  }

  private async asegurarEmpresa(nit: NitNormalizado, dto: CrearReservaDto): Promise<Empresa> {
    const datos = {
      razonSocial: dto.razonSocial,
      numeroColaboradores: dto.numeroColaboradores ?? null,
      redAsociada: dto.redAsociada ?? null,
      // Solo tiene sentido si eligió "Otro"; si cambia de opción, se limpia
      // para que no quede un gremio fantasma de un envío anterior.
      redAsociadaOtra: dto.redAsociada === 'Otro' ? (dto.redAsociadaOtra ?? null) : null,
      digitoVerificacion: nit.digitoVerificacion,
    };

    try {
      return await this.prisma.empresa.upsert({
        where: { nit: nit.nit },
        create: { nit: nit.nit, ...datos },
        update: datos,
      });
    } catch (error) {
      // Dos primeras reservas de la misma empresa en el mismo instante: una de
      // las dos pierde la carrera del INSERT. La fila ya existe, así que basta
      // con leerla.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.empresa.findUniqueOrThrow({ where: { nit: nit.nit } });
      }
      throw error;
    }
  }

  private async politicaVigente(convenioId: string): Promise<string | null> {
    const politica = await this.prisma.politicaDatos.findFirst({
      where: { convenioId, vigenteHasta: null },
      orderBy: { version: 'desc' },
    });
    return politica?.id ?? null;
  }

  private async vista(tx: Prisma.TransactionClient, reservaId: string) {
    const reserva = await tx.reserva.findUniqueOrThrow({
      where: { id: reservaId },
      include: {
        empresa: true,
        oferta: {
          include: { ubicacion: true, accionFormacion: { include: { convenio: true } } },
        },
      },
    });

    return {
      id: reserva.id,
      estado: reserva.estado,
      cuposSolicitados: reserva.cuposSolicitados,
      cuposConfirmados: reserva.cuposConfirmados,
      cuposEnEspera: reserva.cuposEnEspera,
      creadoEn: reserva.creadoEn,
      empresa: {
        nit: reserva.empresa.nit,
        digitoVerificacion: reserva.empresa.digitoVerificacion,
        razonSocial: reserva.empresa.razonSocial,
      },
      contacto: {
        nombre: reserva.contactoNombre,
        correo: reserva.contactoCorreo,
        celular: reserva.contactoCelular,
        cargo: reserva.contactoCargo,
      },
      oferta: {
        id: reserva.oferta.id,
        modalidad: reserva.oferta.modalidad,
        ubicacion: reserva.oferta.ubicacion.nombre,
        tipoUbicacion: reserva.oferta.ubicacion.tipo,
        cuposMaximos: reserva.oferta.cuposMaximos,
        cuposOcupados: reserva.oferta.cuposOcupados,
        accion: {
          codigo: reserva.oferta.accionFormacion.codigo,
          nombre: reserva.oferta.accionFormacion.nombre,
          horas: reserva.oferta.accionFormacion.horas,
        },
        convenio: reserva.oferta.accionFormacion.convenio.slug,
      },
    };
  }
}
