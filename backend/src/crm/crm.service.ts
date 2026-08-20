import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  EtapaParticipante,
  Prisma,
  type Admin,
} from '../../generated/prisma';
import { documentoValido, normalizarDocumento } from '../comun/documento';
import { analizar, esInsalvable, repetidosEnElPegado } from './carga';
import { revisar } from './completitud';
import {
  DEPARTAMENTOS_SEP,
  DOCUMENTOS_DE_EMPRESA,
  DOCUMENTOS_DE_PERSONA,
  EDAD_MINIMA,
  edadCumplida,
  esValorValido,
  ESTRATO_MAXIMO,
  ESTRATO_MINIMO,
  GENEROS_SEP,
  municipioCuadra,
  MUNICIPIOS_SEP,
  NIVELES_OCUPACIONALES_SEP,
  siglaDocumento,
  TAMANOS_EMPRESA_SEP,
  type ValorSep,
} from './catalogos-sep';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarParticipanteDto,
  AsignarAsesorEnLoteDto,
  AsignarFormacionDto,
  CargaDto,
  CambiarEtapaDto,
  CrearNotaDto,
  CrearParticipanteDto,
  FiltrosParticipantesDto,
  RegistrarAutorizacionDto,
} from './dto';

/**
 * El ámbito NO va en el DTO: declararlo ahí lo vuelve una
 * propiedad propia de la clase y el ValidationPipe la
 * rechaza con «property ambito should not exist». Y sobre
 * todo, nunca puede venir de la petición: lo pone el
 * controlador desde el guard.
 */
export type Filtros = FiltrosParticipantesDto & { ambito?: string[] };

const POR_PAGINA = 30;
/// Tope duro aunque el filtro pida mas.
const TOPE_POR_PAGINA = 300;

/// Los que ocupan una silla. El resto ya no cuenta.
const ETAPAS_VIVAS: EtapaParticipante[] = [
  'NUEVO',
  'CONTACTADO',
  'DATOS_COMPLETOS',
  'MATRICULADO',
  'EN_FORMACION',
  'CERTIFICADO',
];

/// De estas no se sale sin explicar por que.
const ETAPAS_CON_MOTIVO: EtapaParticipante[] = ['PERDIDO', 'RETIRADO', 'NO_APROBO'];

/// Las que dan por terminada la formación.
const CIERRES_DE_FORMACION: EtapaParticipante[] = ['CERTIFICADO', 'NO_APROBO'];

/// Quien ya piso el aula y por tanto tiene avance.
const ETAPAS_EN_AULA: EtapaParticipante[] = [
  'EN_FORMACION',
  'CERTIFICADO',
  'NO_APROBO',
  'RETIRADO',
];

/// Cuantas actividades de retraso se toleran.
const TOLERANCIA = 2;
/// Dias sin entrar al aula a partir de los que esta parado.
const DIAS_PARADO = 14;
/// Lo que hay que aprobar para poder certificar.
export const MINIMO_PARA_CERTIFICAR = 0.8;

type EstadoAcademico =
  | 'AL_DIA'
  | 'ATRASADO'
  | 'PARADO'
  | 'SIN_INGRESO'
  | 'SIN_ARRANCAR'
  | 'COMPLETADO'
  | 'CERTIFICADO'
  | 'SALIO'
  | 'SIN_EMPEZAR'
  | 'SIN_FECHAS';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: Filtros) {
    const donde = this.donde(filtros);
    const pagina = Math.max(1, filtros.pagina ?? 1);
    const porPagina = Math.min(filtros.limite ?? POR_PAGINA, TOPE_POR_PAGINA);

    const [total, filas] = await Promise.all([
      this.prisma.participante.count({ where: donde }),
      this.prisma.participante.findMany({
        where: donde,
        orderBy: { creadoEn: 'desc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        include: {
          persona: true,
          convenio: { select: { sigla: true, slug: true } },
          accionFormacion: { select: { codigo: true, nombre: true } },
          oferta: { select: { ubicacion: { select: { nombre: true } } } },
          asesor: { select: { id: true, nombre: true } },
          _count: { select: { notas: true } },
        },
      }),
    ]);

    return {
      total,
      pagina,
      paginas: Math.max(1, Math.ceil(total / porPagina)),
      participantes: filas.map((p) => this.aFila(p)),
    };
  }

  /** Lo que el panel necesita para dibujar los desplegables. */
  catalogos() {
    return {
      documentosPersona: DOCUMENTOS_DE_PERSONA,
      documentosEmpresa: DOCUMENTOS_DE_EMPRESA,
      generos: GENEROS_SEP,
      nivelesOcupacionales: NIVELES_OCUPACIONALES_SEP,
      tamanosEmpresa: TAMANOS_EMPRESA_SEP,
      departamentos: DEPARTAMENTOS_SEP.filter((d) => d.seleccionable),
      // [id, departamentoId, nombre] para que el navegador
      // filtre sin pedir nada; son 1.126, no 1.126 viajes
      municipios: MUNICIPIOS_SEP.filter((m) => m[3]).map((m) => [m[0], m[1], m[2]]),
      estrato: { minimo: ESTRATO_MINIMO, maximo: ESTRATO_MAXIMO },
      edadMinima: EDAD_MINIMA,
    };
  }

  /** Cuántos hay en cada etapa: las columnas del tablero. */
  async resumen(filtros: Filtros) {
    const donde = this.donde({ ...filtros, etapa: undefined });

    const porEtapa = await this.prisma.participante.groupBy({
      by: ['etapa'],
      where: donde,
      _count: { _all: true },
    });

    const cuenta = new Map(porEtapa.map((f) => [f.etapa, f._count._all]));

    // las opciones de filtro salen de la base, no de la
    // pagina cargada: si no, faltan los de la pagina 2
    const [porAsesor, porAccion] = await Promise.all([
      this.prisma.participante.groupBy({
        by: ['asesorId'],
        where: donde,
        _count: { _all: true },
      }),
      this.prisma.participante.groupBy({
        by: ['accionFormacionId'],
        where: donde,
        _count: { _all: true },
      }),
    ]);

    const idsAsesor = porAsesor.map((f) => f.asesorId).filter((id): id is string => !!id);
    const idsAccion = porAccion
      .map((f) => f.accionFormacionId)
      .filter((id): id is string => !!id);

    const [asesores, acciones] = await Promise.all([
      this.prisma.admin.findMany({
        where: { id: { in: idsAsesor } },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.accionFormacion.findMany({
        where: { id: { in: idsAccion } },
        select: { id: true, codigo: true, nombre: true },
        orderBy: { codigo: 'asc' },
      }),
    ]);

    const totalAsesor = new Map(porAsesor.map((f) => [f.asesorId, f._count._all]));
    const totalAccion = new Map(
      porAccion.map((f) => [f.accionFormacionId, f._count._all]),
    );

    return {
      etapas: Object.values(EtapaParticipante).map((etapa) => ({
        etapa,
        total: cuenta.get(etapa) ?? 0,
      })),
      total: porEtapa.reduce((s, f) => s + f._count._all, 0),
      asesores: asesores.map((a) => ({ ...a, total: totalAsesor.get(a.id) ?? 0 })),
      acciones: acciones.map((a) => ({ ...a, total: totalAccion.get(a.id) ?? 0 })),
      sinAsesor: totalAsesor.get(null) ?? 0,
    };
  }

  async obtener(id: string, ambito: string[]) {
    await this.exigirParticipante(id, ambito);

    const p = await this.prisma.participante.findUnique({
      where: { id },
      include: {
        persona: {
          include: {
            participaciones: {
              where: { id: { not: id } },
              select: {
                id: true,
                etapa: true,
                convenio: { select: { sigla: true } },
                accionFormacion: { select: { codigo: true, nombre: true } },
              },
            },
            autorizaciones: {
              where: { revocadaEn: null },
              select: {
                id: true,
                canal: true,
                otorgadaEn: true,
                politica: {
                  select: { version: true, destinatario: true, convenioId: true },
                },
              },
            },
          },
        },
        convenio: { select: { id: true, sigla: true, nombre: true } },
        accionFormacion: { select: { id: true, codigo: true, nombre: true } },
        oferta: {
          select: {
            id: true,
            cuposMaximos: true,
            ubicacion: { select: { nombre: true } },
          },
        },
        cobertura: {
          select: {
            id: true,
            grupo: {
              select: {
                numero: true,
                fechaInicio: true,
                fechaFin: true,
                horario: true,
              },
            },
          },
        },
        reserva: {
          select: {
            id: true,
            empresa: { select: { nit: true, razonSocial: true } },
          },
        },
        asesor: { select: { id: true, nombre: true } },
        sobrecupoPor: { select: { nombre: true } },
        movimientos: {
          orderBy: { creadoEn: 'desc' },
          take: 50,
          // quien lo hizo ya se guardaba y no se veia
          include: { admin: { select: { nombre: true } } },
        },
        notas: { orderBy: { creadoEn: 'desc' }, take: 50 },
      },
    });

    if (!p) throw new NotFoundException('Ese participante no existe.');

    return {
      ...p,
      persona: {
        ...p.persona,
        documento: `${siglaDocumento(p.persona.tipoDocumentoSepId)} ${p.persona.numeroDocumento}`,
      },
      faltantes: await this.faltantesParaMatricular(p.id),
    };
  }

  async crear(dto: CrearParticipanteDto, admin: Admin, ambito: string[], ip?: string) {
    this.exigirConvenio(dto.convenioId, ambito);

    // el tipo tiene que servir para una persona y estar
    // permitido aqui: sin esto la API acepta cualquier
    // entero y el cargue sale con un codigo sin significado
    if (!DOCUMENTOS_DE_PERSONA.some((t) => t.id === dto.tipoDocumentoSepId)) {
      throw new BadRequestException(
        'Ese tipo de documento no se admite para un participante.',
      );
    }

    const numero = normalizarDocumento(dto.numeroDocumento);
    if (!numero || !documentoValido(dto.tipoDocumentoSepId, numero)) {
      throw new BadRequestException(
        'El número de documento no tiene un formato válido para ese tipo.',
      );
    }

    if (dto.fechaNacimiento) {
      const edad = edadCumplida(new Date(dto.fechaNacimiento));
      if (edad < EDAD_MINIMA) {
        throw new BadRequestException(
          `No se admiten menores de ${EDAD_MINIMA} años en esta formación.`,
        );
      }
    }

    const oferta = dto.ofertaId
      ? await this.prisma.oferta.findUnique({
          where: { id: dto.ofertaId },
          select: {
            id: true,
            cuposMaximos: true,
            accionFormacionId: true,
            accionFormacion: { select: { convenioId: true, nombre: true } },
          },
        })
      : null;

    if (dto.ofertaId && !oferta) {
      throw new NotFoundException('Esa oferta no existe.');
    }
    if (oferta && oferta.accionFormacion.convenioId !== dto.convenioId) {
      throw new BadRequestException('Esa oferta no pertenece al convenio indicado.');
    }

    // pasarse del cupo se puede, pero deja rastro
    let sobrecupo: { porId: string; motivo: string } | null = null;
    if (oferta) {
      const ocupadas = await this.prisma.participante.count({
        where: { ofertaId: oferta.id, etapa: { in: ETAPAS_VIVAS } },
      });

      if (ocupadas >= oferta.cuposMaximos) {
        if (!dto.sobrecupoMotivo) {
          throw new ConflictException(
            `«${oferta.accionFormacion.nombre}» ya tiene sus ${oferta.cuposMaximos} ` +
              'cupos ocupados. Para inscribir por encima del cupo hay que indicar el motivo.',
          );
        }
        sobrecupo = { porId: admin.id, motivo: dto.sobrecupoMotivo };
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const persona = await tx.persona.upsert({
        where: {
          tipoDocumentoSepId_numeroDocumento: {
            tipoDocumentoSepId: dto.tipoDocumentoSepId,
            numeroDocumento: numero,
          },
        },
        create: {
          tipoDocumentoSepId: dto.tipoDocumentoSepId,
          numeroDocumento: numero,
          primerNombre: dto.primerNombre,
          segundoNombre: dto.segundoNombre ?? null,
          primerApellido: dto.primerApellido,
          segundoApellido: dto.segundoApellido ?? null,
          fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : null,
          sexo: dto.sexo ?? null,
          correo: dto.correo ?? null,
          celular: dto.celular ?? null,
        },
        // no se pisa lo que ya hay con lo que llega vacio
        update: {
          correo: dto.correo ?? undefined,
          celular: dto.celular ?? undefined,
          fechaNacimiento: dto.fechaNacimiento
            ? new Date(dto.fechaNacimiento)
            : undefined,
        },
      });

      if (oferta) {
        const repetido = await tx.participante.findFirst({
          where: {
            personaId: persona.id,
            accionFormacionId: oferta.accionFormacionId,
          },
          select: { id: true },
        });
        if (repetido) {
          throw new ConflictException(
            'Esta persona ya está en esa acción de formación. ' +
              'Nadie cuenta dos veces contra la meta.',
          );
        }
      }

      const participante = await tx.participante.create({
        data: {
          personaId: persona.id,
          convenioId: dto.convenioId,
          ofertaId: oferta?.id ?? null,
          accionFormacionId: oferta?.accionFormacionId ?? null,
          reservaId: dto.reservaId ?? null,
          origen: dto.origen ?? 'ASESOR',
          asesorId: dto.asesorId ?? admin.id,
          cargoEnEmpresa: dto.cargoEnEmpresa ?? null,
          sobrecupoPorId: sobrecupo?.porId ?? null,
          sobrecupoMotivo: sobrecupo?.motivo ?? null,
        },
      });

      await tx.movimientoParticipante.create({
        data: {
          participanteId: participante.id,
          etapaAntes: null,
          etapaDespues: participante.etapa,
          adminId: admin.id,
          nota: sobrecupo ? `Sobrecupo autorizado: ${sobrecupo.motivo}` : null,
          ip: ip ?? null,
        },
      });

      return participante;
    });
  }

  async actualizar(id: string, dto: ActualizarParticipanteDto, ambito: string[]) {
    await this.exigirParticipante(id, ambito);

    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: { id: true, personaId: true },
    });
    if (!p) throw new NotFoundException('Ese participante no existe.');

    // el id tiene que existir en el catalogo del SEP, o
    // el cargue sale con un numero que no significa nada
    for (const [lista, valor, que] of [
      [GENEROS_SEP, dto.generoSepId, 'género'],
      [NIVELES_OCUPACIONALES_SEP, dto.nivelOcupacionalSepId, 'nivel ocupacional'],
      [DEPARTAMENTOS_SEP, dto.departamentoSepId, 'departamento'],
    ] as const) {
      if (!esValorValido(lista as ValorSep[], valor)) {
        throw new BadRequestException(`Ese ${que} no está en el catálogo del SEP.`);
      }
    }

    if (!municipioCuadra(dto.departamentoSepId, dto.municipioSepId)) {
      throw new BadRequestException('Ese municipio no pertenece a ese departamento.');
    }

    // asignar() ya lo comprueba; aqui no se comprobaba
    // nada, y una cobertura de otro curso manda al SEP un
    // AF y un grupo que se contradicen
    if (dto.coberturaId) {
      const cobertura = await this.prisma.grupoCobertura.findUnique({
        where: { id: dto.coberturaId },
        select: { grupo: { select: { accionFormacionId: true } } },
      });
      const suya = await this.prisma.participante.findUnique({
        where: { id },
        select: { accionFormacionId: true },
      });
      if (!cobertura || cobertura.grupo.accionFormacionId !== suya?.accionFormacionId) {
        throw new BadRequestException(
          'Ese grupo no es de la acción de formación de esta persona.',
        );
      }
    }

    if (dto.fechaNacimiento) {
      const edad = edadCumplida(new Date(dto.fechaNacimiento));
      if (edad < EDAD_MINIMA) {
        throw new BadRequestException(
          `No se admiten menores de ${EDAD_MINIMA} años en esta formación.`,
        );
      }
    }

    const dePersona = {
      primerNombre: dto.primerNombre,
      segundoNombre: dto.segundoNombre,
      primerApellido: dto.primerApellido,
      segundoApellido: dto.segundoApellido,
      sexo: dto.sexo,
      correo: dto.correo,
      celular: dto.celular,
      fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : undefined,
      generoSepId: dto.generoSepId,
      estrato: dto.estrato,
      departamentoSepId: dto.departamentoSepId,
      municipioSepId: dto.municipioSepId,
      barrio: dto.barrio,
      direccion: dto.direccion,
    };

    await this.prisma.$transaction([
      this.prisma.persona.update({ where: { id: p.personaId }, data: dePersona }),
      this.prisma.participante.update({
        where: { id },
        data: {
          cargoEnEmpresa: dto.cargoEnEmpresa,
          nivelEducativo: dto.nivelEducativo,
          nivelOcupacional: dto.nivelOcupacional,
          nivelOcupacionalSepId: dto.nivelOcupacionalSepId,
          beneficiarioPrevio: dto.beneficiarioPrevio,
          asesorId: dto.asesorId,
          coberturaId: dto.coberturaId,
        },
      }),
    ]);

    return this.obtener(id, ambito);
  }

  /**
   * Asigna el mismo asesor a varias fichas de golpe.
   *
   * Cada una deja su movimiento: sin eso, veinte fichas
   * cambiarian de dueno sin que el historial dijera quien
   * lo hizo, que es justo lo que se pide poder ver.
   */
  async asignarAsesorEnLote(
    dto: AsignarAsesorEnLoteDto,
    admin: Admin,
    ambito: string[],
    ip?: string,
  ) {
    const asesorId = dto.asesorId || null;

    if (asesorId) {
      const asesor = await this.prisma.admin.findFirst({
        where: { id: asesorId, activo: true },
        select: { id: true, nombre: true },
      });
      if (!asesor) throw new BadRequestException('Ese asesor no existe o está desactivado.');
    }

    // solo las del ambito: un id pegado a mano no cuela
    const suyas = await this.prisma.participante.findMany({
      where: { id: { in: dto.ids }, convenioId: { in: ambito } },
      select: { id: true, etapa: true, asesorId: true },
    });

    const cambian = suyas.filter((p) => p.asesorId !== asesorId);
    if (cambian.length === 0) {
      return { cambiadas: 0, fuera: dto.ids.length - suyas.length, sinCambio: suyas.length };
    }

    const nombre = asesorId
      ? (await this.prisma.admin.findUnique({
          where: { id: asesorId },
          select: { nombre: true },
        }))!.nombre
      : null;

    await this.prisma.$transaction([
      this.prisma.participante.updateMany({
        where: { id: { in: cambian.map((p) => p.id) } },
        data: { asesorId },
      }),
      this.prisma.movimientoParticipante.createMany({
        data: cambian.map((p) => ({
          participanteId: p.id,
          etapaAntes: p.etapa,
          etapaDespues: p.etapa,
          adminId: admin.id,
          nota: nombre ? `Asignada a ${nombre}` : 'Se le quitó el asesor',
          ip: ip ?? null,
        })),
      }),
    ]);

    return {
      cambiadas: cambian.length,
      fuera: dto.ids.length - suyas.length,
      sinCambio: suyas.length - cambian.length,
    };
  }

  /**
   * Borra la participación, no a la persona: la misma
   * cédula puede estar en el otro convenio, y ahí sigue.
   * Se lleva sus notas, sus movimientos y su avance.
   */
  async borrarParticipacion(id: string, ambito: string[]) {
    await this.exigirParticipante(id, ambito);

    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: {
        etapa: true,
        persona: { select: { primerNombre: true, primerApellido: true, numeroDocumento: true } },
        _count: { select: { avances: true, notas: true } },
      },
    });
    if (!p) throw new NotFoundException('Ese participante no existe.');

    await this.prisma.$transaction(async (tx) => {
      await tx.avanceActividad.deleteMany({ where: { participanteId: id } });
      await tx.notaParticipante.deleteMany({ where: { participanteId: id } });
      await tx.movimientoParticipante.deleteMany({ where: { participanteId: id } });
      await tx.participante.delete({ where: { id } });
    });

    return {
      borrado: true,
      nombre: `${p.persona.primerNombre} ${p.persona.primerApellido}`,
      documento: p.persona.numeroDocumento,
      avancesBorrados: p._count.avances,
      notasBorradas: p._count.notas,
    };
  }

  async cambiarEtapa(
    id: string,
    dto: CambiarEtapaDto,
    admin: Admin,
    ambito: string[],
    ip?: string,
    cierran: string[] = [],
  ) {
    await this.exigirParticipante(id, ambito);

    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: { id: true, etapa: true, convenioId: true, accionFormacionId: true },
    });
    if (!p) throw new NotFoundException('Ese participante no existe.');

    // certificar exige haber aprobado el 80% de lo
    // obligatorio: sin eso, la fila que se le manda al
    // SENA dice que alguien termino algo que no termino
    if (dto.etapa === 'CERTIFICADO') {
      const [obligatorias, aprobadas] = await Promise.all([
        this.prisma.actividad.count({
          where: {
            accionFormacionId: p.accionFormacionId ?? '',
            publicada: true,
            obligatoria: true,
          },
        }),
        this.prisma.avanceActividad.count({
          where: {
            participanteId: id,
            estado: 'APROBADA',
            actividad: { obligatoria: true, publicada: true },
          },
        }),
      ]);

      if (obligatorias === 0) {
        throw new BadRequestException(
          'Esta acción de formación no tiene actividades obligatorias cargadas: ' +
            'no hay contra qué medir si terminó.',
        );
      }
      const logrado = aprobadas / obligatorias;
      if (logrado < MINIMO_PARA_CERTIFICAR) {
        throw new BadRequestException(
          `Lleva ${aprobadas} de ${obligatorias} actividades obligatorias ` +
            `(${Math.round(logrado * 100)} %). Para certificar hacen falta ` +
            `${Math.round(MINIMO_PARA_CERTIFICAR * 100)} %.`,
        );
      }
    }

    // certificar es lo que paga el SENA: no lo firma quien
    // digita, aunque digite bien
    if (CIERRES_DE_FORMACION.includes(dto.etapa) && !cierran.includes(p.convenioId)) {
      throw new ForbiddenException(
        'Cerrar una formación (certificar o dar por no aprobado) es del líder ' +
          'del área académica.',
      );
    }
    if (p.etapa === dto.etapa) return this.obtener(id, ambito);

    if (ETAPAS_CON_MOTIVO.includes(dto.etapa) && !dto.motivo) {
      throw new BadRequestException(
        'Hay que decir por qué. Dentro de seis meses nadie se acuerda.',
      );
    }

    // matricular es una compuerta, no un paso mas
    if (dto.etapa === 'MATRICULADO') {
      const { bloquean } = await this.faltantesParaMatricular(id);
      if (bloquean.length > 0) {
        throw new ConflictException(
          `No se puede matricular todavía: ${bloquean.join('; ')}.`,
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.participante.update({
        where: { id },
        data: {
          etapa: dto.etapa,
          motivoSalida: ETAPAS_CON_MOTIVO.includes(dto.etapa) ? dto.motivo : undefined,
          fechaRetiro: dto.etapa === 'RETIRADO' ? new Date() : undefined,
          fechaMatricula: dto.etapa === 'MATRICULADO' ? new Date() : undefined,
          fechaCertificacion: dto.etapa === 'CERTIFICADO' ? new Date() : undefined,
        },
      }),
      this.prisma.movimientoParticipante.create({
        data: {
          participanteId: id,
          etapaAntes: p.etapa,
          etapaDespues: dto.etapa,
          motivo: dto.motivo ?? null,
          adminId: admin.id,
          ip: ip ?? null,
        },
      }),
    ]);

    return this.obtener(id, ambito);
  }

  async agregarNota(id: string, dto: CrearNotaDto, admin: Admin, ambito: string[]) {
    await this.exigirParticipante(id, ambito);

    const existe = await this.prisma.participante.count({ where: { id } });
    if (!existe) throw new NotFoundException('Ese participante no existe.');

    // el nombre se congela: si el autor cambia el suyo,
    // la nota sigue diciendo quien la escribio
    return this.prisma.notaParticipante.create({
      data: {
        participanteId: id,
        autorId: admin.id,
        autorNombre: admin.nombre,
        texto: dto.texto,
      },
    });
  }

  /** Lo que impide matricular y lo que impide reportar. */
  async faltantesParaMatricular(
    id: string,
  ): Promise<{ bloquean: string[]; avisan: string[]; reporte: string[] }> {
    const p = await this.prisma.participante.findUnique({
      where: { id },
      include: {
        persona: true,
        accionFormacion: { select: { sepAfId: true } },
        cobertura: {
          select: {
            grupo: { select: { fechaInicio: true, sepGrupoId: true } },
          },
        },
      },
    });
    if (!p) return { bloquean: ['el participante no existe'], avisan: [], reporte: [] };

    const autorizacion = await this.prisma.autorizacionDatos.findFirst({
      where: {
        personaId: p.personaId,
        revocadaEn: null,
        politica: { destinatario: 'PARTICIPANTE', convenioId: p.convenioId },
      },
      select: { id: true },
    });

    const { matricula, reporte } = revisar({
      ofertaId: p.ofertaId,
      coberturaId: p.coberturaId,
      accionFormacionId: p.accionFormacionId,
      nivelOcupacionalSepId: p.nivelOcupacionalSepId,
      beneficiarioPrevio: p.beneficiarioPrevio,
      tieneAutorizacion: Boolean(autorizacion),
      grupoConFechas: Boolean(p.cobertura?.grupo.fechaInicio),
      grupoSepId: p.cobertura?.grupo.sepGrupoId ?? null,
      accionSepId: p.accionFormacion?.sepAfId ?? null,
      persona: p.persona,
    });

    // el grupo y sus fechas avisan, no bloquean: las pone
    // el SENA cuando puede
    const avisan: string[] = [];
    if (!p.coberturaId) {
      avisan.push('sin grupo asignado no entra en el reporte al SENA');
    } else if (!p.cobertura?.grupo.fechaInicio) {
      avisan.push('su grupo no tiene fechas: no se puede saber si va al día');
    }

    return { bloquean: matricula, avisan, reporte };
  }




  /** Que pasaria si se confirma este pegado. */
  async previsualizarCarga(dto: CargaDto, ambito: string[]) {
    this.exigirConvenio(dto.convenioId, ambito);

    const filas = analizar(dto.texto);
    if (filas.length === 0) {
      throw new BadRequestException('No encontré ninguna fila con datos.');
    }
    if (filas.length > 1000) {
      throw new BadRequestException(
        `Son ${filas.length} filas. Pegue tandas de 1000 como mucho.`,
      );
    }

    const repes = repetidosEnElPegado(filas);

    // en que acciones ya esta cada persona
    const claves = filas
      .filter((f) => f.numeroDocumento)
      .map((f) => ({
        tipoDocumentoSepId: f.tipoDocumentoSepId,
        numeroDocumento: f.numeroDocumento,
      }));

    const personas = await this.prisma.persona.findMany({
      where: { OR: claves },
      select: {
        id: true,
        tipoDocumentoSepId: true,
        numeroDocumento: true,
        participaciones: {
          select: { accionFormacionId: true, convenioId: true },
        },
      },
    });

    const porDocumento = new Map(
      personas.map((p) => [`${p.tipoDocumentoSepId}:${p.numeroDocumento}`, p]),
    );

    const oferta = dto.ofertaId
      ? await this.prisma.oferta.findUnique({
          where: { id: dto.ofertaId },
          select: { id: true, accionFormacionId: true, cuposMaximos: true },
        })
      : null;

    const previa = filas.map((f) => {
      const clave = `${f.tipoDocumentoSepId}:${f.numeroDocumento}`;
      const problemas = [...f.problemas];
      let estado: 'NUEVA' | 'PERSONA_CONOCIDA' | 'REPETIDA' | 'DESCARTADA' = 'NUEVA';

      if (esInsalvable(f)) {
        estado = 'DESCARTADA';
      } else if (repes.has(clave)) {
        estado = 'REPETIDA';
        problemas.push('el mismo documento aparece más de una vez en lo pegado');
      } else {
        const persona = porDocumento.get(clave);
        if (persona) {
          estado = 'PERSONA_CONOCIDA';
          if (
            oferta &&
            persona.participaciones.some(
              (x) => x.accionFormacionId === oferta.accionFormacionId,
            )
          ) {
            estado = 'DESCARTADA';
            problemas.push('ya está en esa acción de formación');
          }
        }
      }

      return { ...f, problemas, estado };
    });

    const creables = previa.filter((f) => f.estado !== 'DESCARTADA' && f.estado !== 'REPETIDA');

    return {
      total: previa.length,
      creables: creables.length,
      descartadas: previa.filter((f) => f.estado === 'DESCARTADA').length,
      repetidas: previa.filter((f) => f.estado === 'REPETIDA').length,
      conocidas: previa.filter((f) => f.estado === 'PERSONA_CONOCIDA').length,
      cuposDeLaOferta: oferta?.cuposMaximos ?? null,
      filas: previa,
    };
  }

  /** Crea solo las lineas que el asesor confirmo. */
  async confirmarCarga(dto: CargaDto, admin: Admin, ambito: string[], ip?: string) {
    this.exigirConvenio(dto.convenioId, ambito);

    const previa = await this.previsualizarCarga(dto, ambito);
    const permitidas = dto.lineas ? new Set(dto.lineas) : null;

    const aCrear = previa.filas.filter(
      (f) =>
        f.estado !== 'DESCARTADA' &&
        f.estado !== 'REPETIDA' &&
        (!permitidas || permitidas.has(f.linea)),
    );

    let creados = 0;
    const fallos: Array<{ linea: number; motivo: string }> = [];

    // una a una: un fallo no debe tumbar las 39 buenas
    for (const f of aCrear) {
      try {
        await this.crear(
          {
            tipoDocumentoSepId: f.tipoDocumentoSepId,
            numeroDocumento: f.numeroDocumento,
            primerNombre: f.primerNombre,
            segundoNombre: f.segundoNombre ?? undefined,
            primerApellido: f.primerApellido,
            segundoApellido: f.segundoApellido ?? undefined,
            correo: f.correo ?? undefined,
            celular: f.celular ?? undefined,
            convenioId: dto.convenioId,
            ofertaId: dto.ofertaId,
            origen: 'EMPRESA',
          },
          admin,
          ambito,
          ip,
        );
        creados += 1;
      } catch (e) {
        fallos.push({
          linea: f.linea,
          motivo: e instanceof Error ? e.message : 'error desconocido',
        });
      }
    }

    return { creados, fallos, intentadas: aCrear.length };
  }

  /** Cupos reservados sin una persona detras. */
  /**
   * Seguimiento académico: lo hecho contra lo que tocaría
   * a estas alturas del calendario del grupo.
   */
  async academico(filtros: Filtros) {
    const donde: Prisma.ParticipanteWhereInput = {
      AND: [
        this.donde({ ...filtros, etapa: undefined }),
        { etapa: { in: ETAPAS_EN_AULA } },
      ],
    };

    const filas = await this.prisma.participante.findMany({
      where: donde,
      orderBy: { creadoEn: 'desc' },
      take: TOPE_POR_PAGINA,
      include: {
        persona: {
          select: { primerNombre: true, primerApellido: true, numeroDocumento: true },
        },
        accionFormacion: { select: { id: true, codigo: true, nombre: true } },
        asesor: { select: { id: true, nombre: true } },
        cobertura: {
          select: {
            grupoId: true,
            grupo: {
              select: { numero: true, fechaInicio: true, fechaFin: true, horario: true },
            },
          },
        },
        avances: {
          select: { estado: true, actividad: { select: { obligatoria: true } } },
        },
      },
    });

    // las obligatorias son las que cuentan para el avance
    const obligatorias = await this.prisma.actividad.groupBy({
      by: ['accionFormacionId'],
      where: { publicada: true, obligatoria: true },
      _count: { _all: true },
    });
    const totalDe = new Map(obligatorias.map((a) => [a.accionFormacionId, a._count._all]));

    const ahora = Date.now();

    const personas = filas.map((p) => {
      const total = totalDe.get(p.accionFormacionId ?? '') ?? 0;
      // solo las obligatorias, que son el denominador
      const hechas = p.avances.filter(
        (a) => a.estado === 'APROBADA' && a.actividad.obligatoria,
      ).length;

      const grupo = p.cobertura?.grupo ?? null;
      const inicio = grupo?.fechaInicio?.getTime() ?? null;
      const fin = grupo?.fechaFin?.getTime() ?? null;

      // sin calendario no se puede decir si va tarde
      let transcurrido: number | null = null;
      if (inicio !== null && fin !== null && fin > inicio) {
        transcurrido = Math.min(1, Math.max(0, (ahora - inicio) / (fin - inicio)));
      }

      const esperadas = transcurrido === null ? null : Math.round(total * transcurrido);
      const desfase = esperadas === null ? null : hechas - esperadas;

      const diasSinEntrar = p.ultimoAcceso
        ? Math.floor((ahora - p.ultimoAcceso.getTime()) / 86_400_000)
        : null;

      // el 80% de lo obligatorio: es lo que habilita a
      // certificar, y se mide contra el total del curso,
      // no contra lo que tocaria a estas alturas
      const porcentaje = total > 0 ? hechas / total : 0;
      const listoParaCertificar = total > 0 && porcentaje >= MINIMO_PARA_CERTIFICAR;

      let estado: EstadoAcademico;
      if (p.etapa === 'CERTIFICADO') estado = 'CERTIFICADO';
      else if (p.etapa === 'NO_APROBO' || p.etapa === 'RETIRADO') estado = 'SALIO';
      else if (listoParaCertificar) estado = 'COMPLETADO';
      else if (esperadas === null) estado = 'SIN_FECHAS';
      // el grupo aun no arranca: no se juzga a nadie
      else if (inicio !== null && ahora < inicio) estado = 'SIN_EMPEZAR';
      // nunca piso el aula, aunque su grupo ya empezo
      else if (p.ultimoAcceso === null) estado = 'SIN_INGRESO';
      // entro y no hizo nada: se rescata con una llamada,
      // que es distinto de no haber entrado nunca
      else if (hechas === 0) estado = 'SIN_ARRANCAR';
      else if (diasSinEntrar !== null && diasSinEntrar >= DIAS_PARADO) estado = 'PARADO';
      else if (desfase! <= -TOLERANCIA) estado = 'ATRASADO';
      else estado = 'AL_DIA';

      return {
        id: p.id,
        nombre: `${p.persona.primerNombre} ${p.persona.primerApellido}`,
        documento: p.persona.numeroDocumento,
        etapa: p.etapa,
        accion: p.accionFormacion
          ? `${p.accionFormacion.codigo} · ${p.accionFormacion.nombre}`
          : null,
        accionFormacionId: p.accionFormacionId,
        grupo: grupo ? grupo.numero : null,
        fechaInicio: grupo?.fechaInicio ?? null,
        fechaFin: grupo?.fechaFin ?? null,
        horario: grupo?.horario ?? null,
        asesor: p.asesor,
        total,
        hechas,
        esperadas,
        desfase,
        porcentaje: total > 0 ? Math.round((hechas / total) * 100) : 0,
        listoParaCertificar,
        // para agrupar por acción y grupo en la pantalla
        coberturaId: p.coberturaId,
        ultimoAcceso: p.ultimoAcceso,
        diasSinEntrar,
        notaFinal: p.notaFinal,
        estado,
      };
    });

    const cuenta = (e: EstadoAcademico) => personas.filter((p) => p.estado === e).length;

    // las opciones salen de quien esta en el aula, no de
    // todo el catalogo: un filtro con 15 acciones vacias
    // hace perder el tiempo
    const acciones = [
      ...new Map(
        filas
          .filter((f) => f.accionFormacion)
          .map((f) => [
            f.accionFormacion!.id,
            {
              id: f.accionFormacion!.id,
              codigo: f.accionFormacion!.codigo,
              nombre: f.accionFormacion!.nombre,
            },
          ]),
      ).values(),
    ].sort((a, b) => a.codigo.localeCompare(b.codigo));

    const grupos = [
      ...new Map(
        filas
          .filter((f) => f.cobertura)
          .map((f) => [
            f.cobertura!.grupoId,
            {
              id: f.cobertura!.grupoId,
              numero: f.cobertura!.grupo.numero,
              accionFormacionId: f.accionFormacionId,
            },
          ]),
      ).values(),
    ].sort((a, b) => a.numero - b.numero);

    const asesores = [
      ...new Map(
        filas.filter((f) => f.asesor).map((f) => [f.asesor!.id, f.asesor!]),
      ).values(),
    ].sort((a, b) => a.nombre.localeCompare(b.nombre));

    return {
      personas,
      acciones,
      grupos,
      asesores,
      sinAsesor: filas.filter((f) => !f.asesor).length,
      resumen: {
        total: personas.length,
        alDia: cuenta('AL_DIA'),
        atrasados: cuenta('ATRASADO'),
        parados: cuenta('PARADO'),
        sinIngreso: cuenta('SIN_INGRESO'),
        sinArrancar: cuenta('SIN_ARRANCAR'),
        completados: cuenta('COMPLETADO'),
        certificados: cuenta('CERTIFICADO'),
        salieron: cuenta('SALIO'),
        sinEmpezar: cuenta('SIN_EMPEZAR'),
        sinFechas: cuenta('SIN_FECHAS'),
      },
      // lo que se le exige a "al día", dicho en la pantalla
      criterio: {
        tolerancia: TOLERANCIA,
        diasParado: DIAS_PARADO,
        minimoParaCertificar: MINIMO_PARA_CERTIFICAR,
      },
    };
  }

  async brecha(convenioId: string | undefined, ambito: string[]) {
    const reservas = await this.prisma.reserva.findMany({
      where: {
        estado: { not: 'CANCELADA' },
        // la reserva no lleva convenio: cuelga de la accion
        oferta: { accionFormacion: { convenioId: { in: ambito } } },
        ...(convenioId
          ? { oferta: { accionFormacion: { convenioId } } }
          : {}),
      },
      select: {
        id: true,
        cuposConfirmados: true,
        contactoNombre: true,
        contactoCorreo: true,
        contactoCelular: true,
        creadoEn: true,
        empresa: { select: { id: true, nit: true, razonSocial: true } },
        oferta: {
          select: {
            id: true,
            ubicacion: { select: { nombre: true } },
            accionFormacion: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
                convenio: { select: { sigla: true, slug: true } },
              },
            },
          },
        },
        _count: {
          select: { participantes: { where: { etapa: { in: ETAPAS_VIVAS } } } },
        },
      },
    });

    const porAccion = new Map<
      string,
      { etiqueta: string; convenio: string; confirmados: number; nombres: number }
    >();

    const empresas: Array<{
      reservaId: string;
      empresa: { id: string; nit: string; razonSocial: string };
      contacto: string;
      correo: string;
      celular: string | null;
      accion: string;
      ubicacion: string;
      confirmados: number;
      nombres: number;
      faltan: number;
      diasDesdeReserva: number;
    }> = [];

    let confirmados = 0;
    let nombres = 0;
    const ahora = Date.now();

    for (const r of reservas) {
      const af = r.oferta.accionFormacion;
      const clave = af.id;
      const actual = porAccion.get(clave) ?? {
        etiqueta: `${af.codigo} · ${af.nombre}`,
        convenio: af.convenio.sigla ?? af.convenio.slug,
        confirmados: 0,
        nombres: 0,
      };
      actual.confirmados += r.cuposConfirmados;
      actual.nombres += r._count.participantes;
      porAccion.set(clave, actual);

      confirmados += r.cuposConfirmados;
      nombres += r._count.participantes;

      const faltan = r.cuposConfirmados - r._count.participantes;
      if (faltan > 0) {
        empresas.push({
          reservaId: r.id,
          empresa: r.empresa,
          contacto: r.contactoNombre,
          correo: r.contactoCorreo,
          celular: r.contactoCelular,
          accion: `${af.codigo} · ${af.nombre}`,
          ubicacion: r.oferta.ubicacion.nombre,
          confirmados: r.cuposConfirmados,
          nombres: r._count.participantes,
          faltan,
          diasDesdeReserva: Math.floor(
            (ahora - r.creadoEn.getTime()) / 86_400_000,
          ),
        });
      }
    }

    // primero quien mas debe, y a igualdad quien lleva mas esperando
    empresas.sort((a, b) => b.faltan - a.faltan || b.diasDesdeReserva - a.diasDesdeReserva);

    return {
      confirmados,
      nombres,
      brecha: Math.max(0, confirmados - nombres),
      porAccion: [...porAccion.values()]
        .map((a) => ({ ...a, brecha: Math.max(0, a.confirmados - a.nombres) }))
        .sort((a, b) => b.brecha - a.brecha),
      empresas: empresas.slice(0, 100),
      empresasTotal: empresas.length,
    };
  }

  /** Ofertas y grupos donde se puede colocar a alguien. */
  async opciones(convenioId: string, ambito: string[]) {
    this.exigirConvenio(convenioId, ambito);

    const ofertas = await this.prisma.oferta.findMany({
      where: { accionFormacion: { convenioId } },
      orderBy: [
        { accionFormacion: { orden: 'asc' } },
        { ubicacion: { nombre: 'asc' } },
      ],
      select: {
        id: true,
        cuposMaximos: true,
        abierta: true,
        modalidad: true,
        ubicacion: { select: { nombre: true } },
        accionFormacion: { select: { id: true, codigo: true, nombre: true } },
        _count: { select: { participantes: { where: { etapa: { in: ETAPAS_VIVAS } } } } },
      },
    });

    const grupos = await this.prisma.grupoCobertura.findMany({
      where: { grupo: { accionFormacion: { convenioId } } },
      orderBy: [{ grupo: { numero: 'asc' } }],
      select: {
        id: true,
        cuposBase: true,
        modalidad: true,
        ubicacion: { select: { nombre: true } },
        grupo: {
          select: {
            numero: true,
            fechaInicio: true,
            fechaFin: true,
            horario: true,
            accionFormacionId: true,
          },
        },
        _count: { select: { participantes: { where: { etapa: { in: ETAPAS_VIVAS } } } } },
      },
    });

    // quien puede llevar leads en este convenio: los que
    // tienen concesion aqui, y no los de solo consulta
    const asesores = await this.prisma.admin.findMany({
      where: {
        activo: true,
        convenios: {
          some: {
            convenioId,
            rol: { in: ['GESTOR_INSCRIPCION', 'LIDER_INSCRIPCION', 'LIDER_SISTEMAS'] },
          },
        },
      },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, correo: true },
    });

    return {
      asesores,
      ofertas: ofertas.map((o) => ({
        id: o.id,
        accionFormacionId: o.accionFormacion.id,
        etiqueta: `${o.accionFormacion.codigo} · ${o.accionFormacion.nombre}`,
        ubicacion: o.ubicacion.nombre,
        modalidad: o.modalidad,
        cupos: o.cuposMaximos,
        ocupados: o._count.participantes,
        disponibles: Math.max(0, o.cuposMaximos - o._count.participantes),
        abierta: o.abierta,
      })),
      grupos: grupos.map((g) => ({
        id: g.id,
        accionFormacionId: g.grupo.accionFormacionId,
        etiqueta: `Grupo ${g.grupo.numero} · ${g.ubicacion.nombre}`,
        modalidad: g.modalidad,
        cupos: g.cuposBase,
        ocupados: g._count.participantes,
        fechaInicio: g.grupo.fechaInicio,
        fechaFin: g.grupo.fechaFin,
        horario: g.grupo.horario,
      })),
    };
  }

  /** Colocar a alguien en una oferta y su grupo. */
  async asignar(id: string, dto: AsignarFormacionDto, admin: Admin, ambito: string[]) {
    await this.exigirParticipante(id, ambito);

    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: { id: true, personaId: true, convenioId: true, accionFormacionId: true },
    });
    if (!p) throw new NotFoundException('Ese participante no existe.');

    const oferta = await this.prisma.oferta.findUnique({
      where: { id: dto.ofertaId },
      select: {
        id: true,
        cuposMaximos: true,
        accionFormacionId: true,
        accionFormacion: { select: { convenioId: true, nombre: true } },
      },
    });
    if (!oferta) throw new NotFoundException('Esa oferta no existe.');

    if (oferta.accionFormacion.convenioId !== p.convenioId) {
      throw new BadRequestException('Esa oferta es de otro convenio.');
    }

    // la misma persona no cuenta dos veces en una accion
    if (oferta.accionFormacionId !== p.accionFormacionId) {
      const repetido = await this.prisma.participante.findFirst({
        where: {
          personaId: p.personaId,
          accionFormacionId: oferta.accionFormacionId,
          id: { not: id },
        },
        select: { id: true },
      });
      if (repetido) {
        throw new ConflictException(
          'Esta persona ya está en esa acción de formación con otra participación.',
        );
      }
    }

    let sobrecupo: { porId: string; motivo: string } | null = null;
    const ocupadas = await this.prisma.participante.count({
      where: { ofertaId: oferta.id, etapa: { in: ETAPAS_VIVAS }, id: { not: id } },
    });

    if (ocupadas >= oferta.cuposMaximos) {
      if (!dto.sobrecupoMotivo) {
        throw new ConflictException(
          `«${oferta.accionFormacion.nombre}» ya tiene sus ${oferta.cuposMaximos} ` +
            'cupos ocupados. Para colocar por encima del cupo hay que indicar el motivo.',
        );
      }
      sobrecupo = { porId: admin.id, motivo: dto.sobrecupoMotivo };
    }

    if (dto.coberturaId) {
      const cobertura = await this.prisma.grupoCobertura.findUnique({
        where: { id: dto.coberturaId },
        select: { grupo: { select: { accionFormacionId: true } } },
      });
      if (!cobertura) throw new NotFoundException('Ese grupo no existe.');
      if (cobertura.grupo.accionFormacionId !== oferta.accionFormacionId) {
        throw new BadRequestException('Ese grupo es de otra acción de formación.');
      }
    }

    await this.prisma.participante.update({
      where: { id },
      data: {
        ofertaId: oferta.id,
        accionFormacionId: oferta.accionFormacionId,
        coberturaId: dto.coberturaId ?? null,
        sobrecupoPorId: sobrecupo?.porId ?? null,
        sobrecupoMotivo: sobrecupo?.motivo ?? null,
      },
    });

    return this.obtener(id, ambito);
  }

  /** La prueba de que el titular autorizo. */
  async registrarAutorizacion(
    id: string,
    dto: RegistrarAutorizacionDto,
    admin: Admin,
    ambito: string[],
    ip?: string,
  ) {
    await this.exigirParticipante(id, ambito);

    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: { personaId: true, convenioId: true },
    });
    if (!p) throw new NotFoundException('Ese participante no existe.');

    const politica = await this.prisma.politicaDatos.findFirst({
      where: {
        convenioId: p.convenioId,
        destinatario: 'PARTICIPANTE',
        vigenteHasta: null,
      },
      select: { id: true, version: true },
    });

    if (!politica) {
      throw new ConflictException(
        'Este convenio no tiene una política de participantes vigente. ' +
          'Publíquela antes de registrar autorizaciones.',
      );
    }

    const yaEsta = await this.prisma.autorizacionDatos.findFirst({
      where: { personaId: p.personaId, politicaDatosId: politica.id, revocadaEn: null },
      select: { id: true },
    });
    if (yaEsta) return this.obtener(id, ambito);

    await this.prisma.$transaction([
      this.prisma.autorizacionDatos.create({
        data: {
          personaId: p.personaId,
          politicaDatosId: politica.id,
          canal: dto.canal,
          evidencia: dto.evidencia ?? null,
          ip: ip ?? null,
        },
      }),
      this.prisma.notaParticipante.create({
        data: {
          participanteId: id,
          autorId: admin.id,
          autorNombre: admin.nombre,
          texto:
            `Autorización de tratamiento registrada (v${politica.version}), ` +
            `por ${dto.canal}.` +
            (dto.evidencia ? ` Evidencia: ${dto.evidencia}` : ''),
        },
      }),
    ]);

    return this.obtener(id, ambito);
  }

  /** Sin concesión en ese convenio, no existe. */
  private exigirConvenio(convenioId: string, ambito: string[]) {
    if (!ambito.includes(convenioId)) {
      throw new ForbiddenException('No tiene acceso a ese convenio.');
    }
  }

  /**
   * Un id de otro convenio responde igual que uno que no
   * existe: decir «no tiene permiso» confirmaría que esa
   * persona está en el sistema.
   */
  private async exigirParticipante(id: string, ambito: string[]) {
    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: { convenioId: true },
    });
    if (!p || !ambito.includes(p.convenioId)) {
      throw new NotFoundException('Ese participante no existe.');
    }
  }

  private donde(f: Filtros): Prisma.ParticipanteWhereInput {
    const y: Prisma.ParticipanteWhereInput[] = [];

    // el ambito primero y siempre: pedir un convenioId al
    // que no se tiene acceso no puede devolver nada. Una
    // lista vacia deja fuera todo, que es lo correcto
    // cuando la cuenta no tiene concesion en ninguno
    if (f.ambito) {
      y.push({ convenioId: { in: f.ambito } });
    }

    if (f.convenioId) y.push({ convenioId: f.convenioId });
    if (f.etapa) y.push({ etapa: f.etapa });
    if (f.accionFormacionId) y.push({ accionFormacionId: f.accionFormacionId });
    if (f.coberturaId) y.push({ coberturaId: f.coberturaId });
    // el grupo cuelga de la cobertura, no del participante
    if (f.grupoId) y.push({ cobertura: { grupoId: f.grupoId } });
    if (f.asesorId) y.push({ asesorId: f.asesorId });

    const buscar = f.buscar?.trim();
    if (buscar) {
      const documento = normalizarDocumento(buscar);
      y.push({
        OR: [
          { persona: { primerNombre: { contains: buscar, mode: 'insensitive' } } },
          { persona: { segundoNombre: { contains: buscar, mode: 'insensitive' } } },
          { persona: { primerApellido: { contains: buscar, mode: 'insensitive' } } },
          { persona: { segundoApellido: { contains: buscar, mode: 'insensitive' } } },
          { persona: { correo: { contains: buscar, mode: 'insensitive' } } },
          ...(documento
            ? [{ persona: { numeroDocumento: { startsWith: documento } } }]
            : []),
        ],
      });
    }

    return y.length ? { AND: y } : {};
  }

  private aFila(p: {
    id: string;
    etapa: EtapaParticipante;
    creadoEn: Date;
    persona: {
      tipoDocumentoSepId: number;
      numeroDocumento: string;
      primerNombre: string;
      segundoNombre: string | null;
      primerApellido: string;
      segundoApellido: string | null;
      correo: string | null;
      celular: string | null;
    };
    convenio: { sigla: string | null; slug: string };
    accionFormacion: { codigo: string; nombre: string } | null;
    oferta: { ubicacion: { nombre: string } } | null;
    asesor: { id: string; nombre: string } | null;
    _count: { notas: number };
  }) {
    return {
      id: p.id,
      etapa: p.etapa,
      creadoEn: p.creadoEn,
      documento: `${siglaDocumento(p.persona.tipoDocumentoSepId)} ${p.persona.numeroDocumento}`,
      nombre: [
        p.persona.primerNombre,
        p.persona.segundoNombre,
        p.persona.primerApellido,
        p.persona.segundoApellido,
      ]
        .filter(Boolean)
        .join(' '),
      correo: p.persona.correo,
      celular: p.persona.celular,
      convenio: p.convenio.sigla ?? p.convenio.slug,
      accion: p.accionFormacion
        ? `${p.accionFormacion.codigo} · ${p.accionFormacion.nombre}`
        : null,
      ubicacion: p.oferta?.ubicacion.nombre ?? null,
      asesor: p.asesor,
      notas: p._count.notas,
    };
  }
}
