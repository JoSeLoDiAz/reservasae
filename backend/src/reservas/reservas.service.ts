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
import {
  calcularDigitoVerificacion,
  normalizarNit,
  type NitNormalizado,
} from '../comun/nit';
import { ocupadasDeLaOferta } from '../comun/plazas-de-la-oferta';
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
      ? await this.formularios.prepararRespuestas(
          dto.formularioSlug,
          dto.respuestas ?? [],
          // el del formulario tiene que ser el de la oferta
          oferta.accionFormacion.convenioId,
        )
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

        /**
         * LO QUE QUEDA DE VERDAD, no lo que queda de las reservas.
         *
         * `cuposOcupados` son solo las plazas que apartan las empresas.
         * Con esta cuenta, una oferta de 520 con 98 apartadas y 120
         * personas ya inscritas daba 422 libres: se le CONFIRMABAN a
         * una empresa 422 cupos y en el aula había 542 personas para
         * 520 sillas. Y nadie entraba en lista de espera, porque el
         * cálculo creía que había sitio.
         *
         * El sitio público ya contaba bien desde el 2 oct 2026; esto es
         * el camino que ESCRIBE, que seguía con la cuenta vieja. O sea
         * que el número era honesto y la escritura no.
         *
         * VA DENTRO DE LA TRANSACCIÓN y después del bloqueo de la
         * oferta: contar fuera deja la misma carrera que el bloqueo
         * existe para cerrar.
         */
        const ocupadas = await ocupadasDeLaOferta(tx, bloqueada);
        const disponibles = bloqueada.cuposMaximos - ocupadas;
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

  async editar(
    reservaId: string,
    nitCrudo: string,
    correo: string,
    cantidad: number,
    contexto: Contexto,
  ) {
    const nit = this.exigirNit(nitCrudo);

    return this.prisma.$transaction(
      async (tx) => {
        const reserva = await this.reservaDeLaEmpresa(tx, reservaId, nit.nit, correo);

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

        /// Su techo: lo libre DE VERDAD más lo que ya ocupaba. Mismo
        /// motivo que en `crear`: con `cuposOcupados` a secas se le
        /// dejaba subir a una empresa por encima de lo que hay.
        const ocupadasAhora = await ocupadasDeLaOferta(tx, oferta);
        const techo =
          oferta.cuposMaximos - ocupadasAhora + reserva.cuposConfirmados;
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

  async cancelar(
    reservaId: string,
    nitCrudo: string,
    correo: string,
    contexto: Contexto,
  ) {
    const nit = this.exigirNit(nitCrudo);

    return this.prisma.$transaction(
      async (tx) => {
        const reserva = await this.reservaDeLaEmpresa(tx, reservaId, nit.nit, correo);
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
    /// Y aquí lo mismo, que es donde más duele: promover de la lista
    /// de espera a sillas que ya ocupa gente inscrita es prometerle a
    /// una empresa un cupo que no existe, y hacerlo automáticamente.
    const ocupadas = await ocupadasDeLaOferta(tx, oferta);
    let libres = oferta.cuposMaximos - ocupadas;
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

  /**
   * LA RESERVA, SI QUIEN LA PIDE ES QUIEN LA HIZO.
   *
   * EL NIT NO ES UNA CREDENCIAL. Está en el RUES y en cualquier
   * factura, y hasta el 2 oct 2026 era lo único que se exigía aquí.
   * Como por esta función pasan `editar` y `cancelar`, con un dato
   * público se le podían liberar a otra empresa todos sus cupos: la
   * lista de espera los repartía en el acto y nadie avisaba.
   *
   * Ahora se exige también el correo con el que se reservó, que es
   * privado y le llegó a quien reservó en el acuse.
   *
   * MISMO ERROR PARA LOS TRES CASOS ---no existe, otro NIT, otro
   * correo--- y a propósito: distinguirlos convierte esto en un
   * oráculo para saber qué empresa reservó dónde.
   *
   * Se compara recortado y en minúsculas: quien reservó con
   * «Compras@Colegio.com» teclea «compras@colegio.com» y es la misma
   * persona. Postgres compara con mayúsculas, así que la igualdad
   * cruda dejaría fuera a gente legítima.
   */
  private async reservaDeLaEmpresa(
    tx: Prisma.TransactionClient,
    reservaId: string,
    nit: string,
    correo: string,
  ) {
    const reserva = await tx.reserva.findUnique({
      where: { id: reservaId },
      include: { empresa: true },
    });

    const comoSeEscribe = (v: string) => v.trim().toLowerCase();
    const suyo =
      reserva !== null &&
      reserva.empresa.nit === nit &&
      comoSeEscribe(reserva.contactoCorreo) === comoSeEscribe(correo);

    if (!suyo) {
      throw new NotFoundException(
        'No se encontró una reserva con ese identificador, NIT y correo.',
      );
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
      /// El de la DIAN, aunque el NIT viniera con otro detrás del
      /// guion: `normalizarNit` se quedaba con el tecleado, y un
      /// «900123456-7» dejaba el 7 aunque a ese NIT le toque otro.
      /// Para cada NIT hay un solo DV (cliente, 11 sep 2026).
      digitoVerificacion: calcularDigitoVerificacion(nit.nit),
    };

    /// Si la empresa YA EXISTE, lo guardado manda.
    ///
    /// Esta ruta es PÚBLICA y sin sesión. Antes el `update`
    /// del upsert escribía estos campos tal cual venían, así
    /// que cualquiera podía mandar una reserva con el NIT de
    /// una empresa real y:
    ///
    ///   - renombrarla («Ferretería El Tornillo» pasa a
    ///     llamarse lo que el desconocido escriba), y
    ///   - BORRARLE numeroColaboradores y redAsociada, porque
    ///     `?? null` convierte un campo ausente en un null que
    ///     se escribe encima.
    ///
    /// Y el nombre guardado suele ser el bueno: lo trajo la
    /// consulta al RUES por el NIT, no una casilla de texto.
    ///
    /// Ahora solo se rellenan HUECOS. Que una empresa corrija
    /// su propia razón social es trabajo del analista de
    /// información, que sabe con quién está hablando; este
    /// formulario no lo sabe.
    const yaExiste = await this.prisma.empresa.findUnique({
      where: { nit: nit.nit },
      select: {
        razonSocial: true,
        numeroColaboradores: true,
        redAsociada: true,
        redAsociadaOtra: true,
        digitoVerificacion: true,
      },
    });

    const soloHuecos = yaExiste
      ? {
          razonSocial: yaExiste.razonSocial || datos.razonSocial,
          numeroColaboradores:
            yaExiste.numeroColaboradores ?? datos.numeroColaboradores,
          redAsociada: yaExiste.redAsociada ?? datos.redAsociada,
          redAsociadaOtra: yaExiste.redAsociadaOtra ?? datos.redAsociadaOtra,
          /// Este SÍ se pisa, y no rompe la regla de arriba: no lo
          /// dice quien llena el formulario, sale del NIT. Si lo
          /// guardado era otro, lo guardado estaba mal.
          digitoVerificacion: datos.digitoVerificacion,
        }
      : datos;

    try {
      return await this.prisma.empresa.upsert({
        where: { nit: nit.nit },
        create: { nit: nit.nit, ...datos },
        update: soloHuecos,
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

  // sin texto no hay nada que aceptar: antes devolvia
  // null y la casilla no apuntaba a ninguna parte
  private async politicaVigente(convenioId: string): Promise<string> {
    const politica = await this.prisma.politicaDatos.findFirst({
      where: { convenioId, destinatario: 'RESERVA', vigenteHasta: null },
      orderBy: { version: 'desc' },
      select: { id: true },
    });

    if (!politica) {
      throw new ConflictException(
        'Este convenio no tiene publicada una política de tratamiento de datos. ' +
          'No se pueden recibir registros hasta que exista.',
      );
    }
    return politica.id;
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
      /// El contacto NO sale por aqui.
      ///
      /// `vista()` responde a rutas PUBLICAS -consultar, crear,
      /// editar, cancelar- y la unica credencial para llegar a
      /// ellas es el NIT, que esta en el RUES y en cualquier
      /// factura. Devolver nombre, correo y celular del
      /// contacto convertia eso en el directorio comercial del
      /// gremio a cambio de un numero publico.
      ///
      /// Nadie lo estaba leyendo: la pantalla publica no lo
      /// pinta y el formulario solo lo manda. El panel lo lee
      /// por otro camino (tableros), que si pide sesion.
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
