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

/** Lo que devuelve el SELECT FOR UPDATE. */
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

  // crear

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

    // fuera de la transacción
    const empresa = await this.asegurarEmpresa(nit, dto);
    const politicaId = await this.politicaVigente(oferta.accionFormacion.convenioId);

    // validar antes de bloquear la oferta
    const delFormulario = dto.formularioSlug
      ? await this.formularios.prepararRespuestas(dto.formularioSlug, dto.respuestas ?? [])
      : null;
    const respuestas = delFormulario?.respuestas ?? [];

    return this.prisma.$transaction(
      async (tx) => {
        const bloqueada = await this.bloquearOferta(tx, oferta.id);

        const existente = await tx.reserva.findUnique({
          where: { empresaId_ofertaId: { empresaId: empresa.id, ofertaId: oferta.id } },
        });

        if (existente && existente.estado !== EstadoReserva.CANCELADA) {
          // doble clic: devolver lo que ya hay
          if (existente.cuposSolicitados === dto.cuposSolicitados) {
            return this.vista(tx, existente.id);
          }
          // cantidad distinta: que el frontend pregunte
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
          formularioId: delFormulario?.formularioId ?? null,
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
          ? // se revive la fila cancelada
            await tx.reserva.update({ where: { id: existente.id }, data: datos })
          : await tx.reserva.create({
              data: { empresaId: empresa.id, ofertaId: oferta.id, ...datos },
            });

        if (respuestas.length) {
          // al revivir, las respuestas viejas sobran
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

  // editar cantidad

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

        // lock antes de calcular nada
        const oferta = await this.bloquearOferta(tx, reserva.ofertaId);
        if (cantidad > oferta.cuposMaximos) {
          throw new BadRequestException(
            `Esta oferta tiene ${oferta.cuposMaximos} cupos en total.`,
          );
        }

        // su techo: libre + lo que ocupaba
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

        // si bajó, repartir lo liberado
        if (delta < 0) {
          await this.promoverListaDeEspera(tx, oferta.id, contexto);
        }

        return this.vista(tx, reserva.id);
      },
      { timeout: 15_000 },
    );
  }

  // cancelar

  async cancelar(reservaId: string, nitCrudo: string, contexto: Contexto) {
    const nit = this.exigirNit(nitCrudo);

    return this.prisma.$transaction(
      async (tx) => {
        const reserva = await this.reservaDeLaEmpresa(tx, reservaId, nit.nit);
        if (reserva.estado === EstadoReserva.CANCELADA) {
          return this.vista(tx, reserva.id);
        }

        const oferta = await this.bloquearOferta(tx, reserva.ofertaId);

        // cancelar devuelve el cupo
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

  // consultar

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
      // total de cupos de la empresa
      totalCupos: empresa.reservas
        .filter((r) => r.estado !== EstadoReserva.CANCELADA)
        .reduce((suma, r) => suma + r.cuposConfirmados, 0),
    };
  }

  // piezas internas

  private exigirNit(valor: string): NitNormalizado {
    const nit = normalizarNit(valor);
    if (!nit) {
      throw new BadRequestException(
        'El NIT no tiene un formato válido. Ejemplos: 860505081 o 860505081-5.',
      );
    }
    return nit;
  }

  /** Bloquea la oferta hasta el fin de la transacción. */
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

  /** Mueve el contador con la condición en el UPDATE. */
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

  /** Reparte los cupos libres por orden de llegada. */
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

      // promoción parcial, por orden
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

    // mismo error que "no existe"
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
      // se limpia si ya no es "Otro"
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
      // perdió la carrera del INSERT
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
