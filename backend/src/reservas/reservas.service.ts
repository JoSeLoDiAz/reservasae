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
  /// La de la ACCIÓN, que cierra la misma puerta por otro lado.
  ///
  /// Cerrar se hace de dos maneras y hay que mirar las dos: se baja
  /// `Oferta.abierta` para cerrar una sede, o se oculta la acción
  /// entera con `AccionFormacion.visible`. `crear` ya exigía las dos
  /// (`:53`); el bloqueo solo traía la primera, así que los caminos
  /// que escriben desde dentro de la transacción no podían preguntar
  /// por la segunda aunque quisieran.
  accionVisible: boolean;
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

    /// Solo lectura, así que puede ir fuera: si el convenio no tiene
    /// política publicada no hay nada que aceptar y esto se planta
    /// antes de escribir la primera fila.
    const politicaId = await this.politicaVigente(
      oferta.accionFormacion.convenioId,
    );

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

        /// Otra vez, ya con el lock. La comprobación de `:53` se hizo
        /// sobre una lectura sin bloquear: entre esa lectura y esta
        /// línea cabe que el administrador cierre el grupo, y la
        /// reserva entraría igual.
        this.exigirAbiertaParaEntrar(bloqueada);

        /**
         * LA ORGANIZACIÓN, YA DENTRO DE LA TRANSACCIÓN.
         *
         * Antes se creaba fuera, y después de ella quedaban varios
         * `throw`: la reserva que ya existe con otra cantidad ---que
         * es el camino normal del segundo intento--- y los cupos que
         * cambiaron en `moverContador`. Cuando saltaba cualquiera de
         * los dos, la respuesta era un 409 y la fila `Empresa` se
         * quedaba escrita.
         *
         * `POST /reservas` es PÚBLICA y sin sesión, así que eso no era
         * solo basura: con una tanda de NITs inventados se llenaba la
         * tabla de organizaciones a voluntad, y esa tabla es la que el
         * analista de información mira para saber con quién se está
         * hablando.
         *
         * VA DESPUÉS DEL BLOQUEO a propósito. Dos envíos del mismo
         * formulario ---el doble clic de siempre--- van a la misma
         * oferta, y el `FOR UPDATE` los pone en fila: el segundo entra
         * cuando el primero ya dejó la organización escrita y se la
         * encuentra hecha.
         */
        const empresa = await this.asegurarEmpresa(tx, nit, dto);

        const existente = await tx.reserva.findUnique({
          where: {
            empresaId_ofertaId: { empresaId: empresa.id, ofertaId: oferta.id },
          },
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
        const confirmados = Math.min(
          dto.cuposSolicitados,
          Math.max(disponibles, 0),
        );
        const enEspera = dto.cuposSolicitados - confirmados;

        await this.moverContador(tx, oferta.id, confirmados);

        const datos = {
          formularioId: delFormulario?.formularioId ?? null,
          cuposSolicitados: dto.cuposSolicitados,
          cuposConfirmados: confirmados,
          cuposEnEspera: enEspera,
          estado:
            confirmados > 0
              ? EstadoReserva.CONFIRMADA
              : EstadoReserva.LISTA_ESPERA,
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
            await tx.reserva.update({
              where: { id: existente.id },
              data: datos,
            })
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
        const reserva = await this.reservaDeLaEmpresa(
          tx,
          reservaId,
          nit.nit,
          correo,
        );

        if (reserva.estado === EstadoReserva.CANCELADA) {
          throw new ConflictException(
            'Esta reserva está cancelada. Haga una reserva nueva.',
          );
        }

        // lock antes de calcular nada
        const oferta = await this.bloquearOferta(tx, reserva.ofertaId);

        /// Y SOLO SI PIDE MÁS. Lo que el cierre quería evitar es que
        /// entre gente nueva; bajar la cantidad es media cancelación y
        /// no puede quedar bloqueada (ver `exigirAbiertaParaEntrar`).
        if (cantidad > reserva.cuposSolicitados) {
          this.exigirAbiertaParaEntrar(oferta);
        }

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
            estado:
              confirmados > 0
                ? EstadoReserva.CONFIRMADA
                : EstadoReserva.LISTA_ESPERA,
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
        const reserva = await this.reservaDeLaEmpresa(
          tx,
          reservaId,
          nit.nit,
          correo,
        );
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
    /// `FOR UPDATE OF o` y no `FOR UPDATE` a secas: lo que hay que
    /// serializar es la oferta, que es donde vive el contador. Con el
    /// `FOR UPDATE` suelto el JOIN bloquearía también la fila de la
    /// acción de formación, y entonces dos reservas a dos sedes
    /// distintas de la misma acción se estorbarían entre ellas sin
    /// ninguna razón.
    const filas = await tx.$queryRaw<OfertaBloqueada[]>`
      SELECT o."id", o."cuposMaximos", o."cuposOcupados", o."abierta",
             a."visible" AS "accionVisible"
        FROM "ofertas" o
        JOIN "acciones_formacion" a ON a."id" = o."accionFormacionId"
       WHERE o."id" = ${ofertaId}
         FOR UPDATE OF o`;

    const oferta = filas[0];
    if (!oferta) {
      throw new NotFoundException('La oferta no existe.');
    }
    return oferta;
  }

  /**
   * LA PUERTA DE ENTRAR GENTE NUEVA, UNA SOLA VEZ.
   *
   * `crear` lo validaba (`:53`) y `editar` no, y el bloqueo de la
   * oferta ya devolvía `abierta` sin que nadie lo leyera. Con el grupo
   * ya cerrado, una organización ampliaba su reserva por
   * `PATCH /reservas/:id` y metía en el aula exactamente a la gente
   * que el cierre pretendía dejar fuera. El cierre se veía bien en el
   * panel y en el sitio público; la que no se enteraba era la API.
   *
   * SOLO GUARDA LA ENTRADA. Cancelar y bajar la cantidad liberan
   * cupos, no los consumen, y tienen que seguir funcionando con la
   * oferta cerrada: si se cierran también esas dos, quien ya no va a
   * llevar a su gente se queda con los cupos apartados para siempre y
   * acaba llamando por teléfono a que alguien lo haga a mano.
   */
  private exigirAbiertaParaEntrar(oferta: OfertaBloqueada): void {
    if (!oferta.abierta || !oferta.accionVisible) {
      throw new ConflictException('Esta oferta no está abierta para reservas.');
    }
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
    const oferta = await tx.oferta.findUniqueOrThrow({
      where: { id: ofertaId },
      include: { accionFormacion: { select: { visible: true } } },
    });

    /**
     * CERRADA = NO ENTRA NADIE, Y LA LISTA DE ESPERA ERA UNA PUERTA.
     *
     * Esto corre solo y detrás de otra cosa: una cancelación, o una
     * organización que baja su cantidad. Sobre una oferta ya cerrada
     * confirmaba automáticamente a quien estaba esperando, o sea que
     * el cierre se deshacía por los cupos que liberaba el primero que
     * se iba, sin que nadie lo pidiera y sin quedar más rastro que un
     * movimiento de «promoción automática».
     *
     * SE SALE SIN HACER NADA, no se lanza: quien llamó estaba
     * cancelando o bajando cupos, y eso ya quedó hecho y bien hecho.
     * Reventar aquí sería echar atrás una cancelación legítima porque
     * la oferta está cerrada, que es justo lo contrario de lo que hay
     * que hacer. La espera se queda en espera, que es lo honesto: si
     * el grupo se reabre, la siguiente liberación la reparte.
     */
    if (!oferta.abierta || !oferta.accionFormacion.visible) return;

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

  /**
   * La organización del NIT, creándola si hace falta.
   *
   * RECIBE EL `tx` Y NO `this.prisma`: lo que se escriba aquí tiene
   * que desaparecer si la reserva no llega a existir. Ver la llamada
   * en `crear`.
   */
  private async asegurarEmpresa(
    tx: Prisma.TransactionClient,
    nit: NitNormalizado,
    dto: CrearReservaDto,
  ): Promise<Empresa> {
    const datos = {
      razonSocial: dto.razonSocial,
      numeroColaboradores: dto.numeroColaboradores ?? null,
      redAsociada: dto.redAsociada ?? null,
      // se limpia si ya no es "Otro"
      redAsociadaOtra:
        dto.redAsociada === 'Otro' ? (dto.redAsociadaOtra ?? null) : null,
      /// El de la DIAN, aunque el NIT viniera con otro detrás del
      /// guion: `normalizarNit` se quedaba con el tecleado, y un
      /// «900123456-7» dejaba el 7 aunque a ese NIT le toque otro.
      /// Para cada NIT hay un solo DV (cliente, 11 sep 2026).
      digitoVerificacion: calcularDigitoVerificacion(nit.nit),
      /**
       * EL JEFE DIRECTO, TAMBIÉN EN LA ORGANIZACIÓN.
       *
       * «Las personas llenan los datos de empresa en el formulario
       * personalizado y queda la notificación, pero no queda»
       * (cliente, 7 oct 2026).
       *
       * Y era cierto. Estos tres se guardaban SOLO en la reserva,
       * y `faltaDeLaEmpresa` ---la regla que decide si una ficha
       * pasa a datos completos, y la que llena el F7--- los busca
       * en la ORGANIZACIÓN. Resultado: la empresa los escribía, el
       * sistema avisaba de la reserva, y todas las fichas de esa
       * empresa se quedaban en «Interesado» pidiendo «nombre del
       * jefe directo» para siempre. El dato estaba guardado, a un
       * palmo de donde se buscaba.
       *
       * Se quedan ADEMÁS en la reserva: ahí son el contacto de ESA
       * reserva, que puede cambiar entre una y otra. En la
       * organización son el jefe que viaja al F7.
       */
      contactoNombre: dto.contactoNombre,
      contactoCargo: dto.contactoCargo ?? null,
      contactoCorreo: dto.contactoCorreo,
      /**
       * Y EL TELÉFONO, que era la cuarta mitad del mismo defecto.
       *
       * El formulario SÍ pide el celular del contacto y se quedaba
       * solo en la reserva, igual que el jefe directo antes del 7 oct.
       * La organización se quedaba sin teléfono, y el F7 lo reclama
       * ---`formato-f7.ts` lo lista como «sin teléfono»--- así que el
       * SENA devuelve el cargue.
       *
       * Va al TELÉFONO de la organización y no a un campo propio: el
       * F7 pide un teléfono de la empresa, y el de quien la representa
       * es el que hay. Si mañana se captura uno de centralita, este
       * cede ---abajo solo rellena huecos---.
       */
      telefono: dto.contactoCelular ?? null,
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
    const yaExiste = await tx.empresa.findUnique({
      where: { nit: nit.nit },
      select: {
        id: true,
        razonSocial: true,
        numeroColaboradores: true,
        redAsociada: true,
        redAsociadaOtra: true,
        digitoVerificacion: true,
        contactoNombre: true,
        contactoCargo: true,
        contactoCorreo: true,
      },
    });

    const soloHuecos = yaExiste
      ? {
          razonSocial: yaExiste.razonSocial || datos.razonSocial,
        /// SOLO HUECOS, igual que los de arriba y por lo mismo: la
        /// ruta es pública y sin sesión, así que una reserva con el
        /// NIT de una empresa real no puede reescribirle su jefe
        /// directo. Rellenarlo cuando está vacío sí, que es lo que
        /// hace falta.
        contactoNombre: yaExiste.contactoNombre || datos.contactoNombre,
        contactoCargo: yaExiste.contactoCargo || datos.contactoCargo,
        contactoCorreo: yaExiste.contactoCorreo || datos.contactoCorreo,
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

    if (yaExiste) {
      return tx.empresa.update({
        where: { id: yaExiste.id },
        data: soloHuecos,
      });
    }

    /**
     * SE PARTE EN DOS ---buscar y luego crear--- EN VEZ DE UN
     * `upsert`, y la carrera se devuelve como 409 en lugar de
     * recuperarse.
     *
     * Dentro de una transacción de Postgres, un choque de unicidad
     * aborta la transacción entera: después de un P2002 no se puede
     * «volver a buscar la empresa y seguir», porque la siguiente
     * consulta falla con la transacción ya muerta. Lo que había antes
     * ---catch del P2002 y releer--- funcionaba precisamente porque
     * estaba FUERA, que es el agujero que se está cerrando.
     *
     * Y la carrera que quedaba es la rara: el `FOR UPDATE` de la
     * oferta ya puso en fila los envíos repetidos a la misma oferta,
     * así que para llegar aquí hace falta el MISMO NIT reservando en
     * DOS ofertas distintas en el mismo instante y además sin existir
     * todavía. A quien le toque, el mensaje le dice que reintente ---el
     * mismo de `moverContador`--- y el segundo intento se encuentra la
     * organización ya creada y pasa.
     */
    try {
      return await tx.empresa.create({ data: { nit: nit.nit, ...datos } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Esta organización se registró mientras se procesaba la solicitud. ' +
            'Vuelva a intentarlo.',
        );
      }
      throw error;
    }
  }

  /**
   * La política que la organización tuvo que aceptar.
   *
   * Sin texto no hay nada que aceptar: antes devolvía null y la
   * casilla no apuntaba a ninguna parte.
   *
   * EL MISMO CRITERIO QUE LAS OTRAS DOS PUERTAS ---`vigenteDesde <=
   * ahora` ordenando por versión---, que es el de
   * `crm/constancia-de-autorizacion.ts` y el del catálogo de la
   * preinscripción. Aquí se filtraba por `vigenteHasta: null`, o sea
   * «la que todavía no se ha cerrado», y no es lo mismo: publicar una
   * versión nueva deja la anterior con `vigenteHasta` puesto, pero
   * mientras hubiera dos abiertas ---o una con fecha de inicio por
   * venir--- esta cuenta se quedaba con la de versión más alta aunque
   * no estuviera vigente todavía. La pantalla, que sí mira
   * `vigenteDesde`, le mostraba una y la reserva guardaba el id de
   * otra: la constancia apuntaba a un texto que la persona no pudo
   * leer, que es exactamente lo que la constancia existe para poder
   * demostrar.
   */
  private async politicaVigente(convenioId: string): Promise<string> {
    const politica = await this.prisma.politicaDatos.findFirst({
      where: {
        convenioId,
        destinatario: 'RESERVA',
        vigenteDesde: { lte: new Date() },
      },
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
          include: {
            ubicacion: true,
            accionFormacion: { include: { convenio: true } },
          },
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
