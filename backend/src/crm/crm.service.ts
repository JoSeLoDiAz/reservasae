import {
  BadRequestException,
  ConflictException,
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
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarParticipanteDto,
  AsignarFormacionDto,
  CargaDto,
  CambiarEtapaDto,
  CrearNotaDto,
  CrearParticipanteDto,
  FiltrosParticipantesDto,
  RegistrarAutorizacionDto,
} from './dto';

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

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: FiltrosParticipantesDto) {
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

  /** Cuántos hay en cada etapa: las columnas del tablero. */
  async resumen(filtros: FiltrosParticipantesDto) {
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

  async obtener(id: string) {
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
        movimientos: { orderBy: { creadoEn: 'desc' }, take: 50 },
        notas: { orderBy: { creadoEn: 'desc' }, take: 50 },
      },
    });

    if (!p) throw new NotFoundException('Ese participante no existe.');

    return { ...p, faltantes: await this.faltantesParaMatricular(p.id) };
  }

  async crear(dto: CrearParticipanteDto, admin: Admin, ip?: string) {
    const numero = normalizarDocumento(dto.numeroDocumento);
    if (!numero || !documentoValido(dto.tipoDocumento, numero)) {
      throw new BadRequestException(
        'El número de documento no tiene un formato válido para ese tipo.',
      );
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
          tipoDocumento_numeroDocumento: {
            tipoDocumento: dto.tipoDocumento,
            numeroDocumento: numero,
          },
        },
        create: {
          tipoDocumento: dto.tipoDocumento,
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

  async actualizar(id: string, dto: ActualizarParticipanteDto) {
    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: { id: true, personaId: true },
    });
    if (!p) throw new NotFoundException('Ese participante no existe.');

    const dePersona = {
      primerNombre: dto.primerNombre,
      segundoNombre: dto.segundoNombre,
      primerApellido: dto.primerApellido,
      segundoApellido: dto.segundoApellido,
      sexo: dto.sexo,
      correo: dto.correo,
      celular: dto.celular,
      fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : undefined,
    };

    await this.prisma.$transaction([
      this.prisma.persona.update({ where: { id: p.personaId }, data: dePersona }),
      this.prisma.participante.update({
        where: { id },
        data: {
          cargoEnEmpresa: dto.cargoEnEmpresa,
          nivelEducativo: dto.nivelEducativo,
          nivelOcupacional: dto.nivelOcupacional,
          asesorId: dto.asesorId,
          coberturaId: dto.coberturaId,
        },
      }),
    ]);

    return this.obtener(id);
  }

  async cambiarEtapa(id: string, dto: CambiarEtapaDto, admin: Admin, ip?: string) {
    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: { id: true, etapa: true },
    });
    if (!p) throw new NotFoundException('Ese participante no existe.');
    if (p.etapa === dto.etapa) return this.obtener(id);

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

    return this.obtener(id);
  }

  async agregarNota(id: string, dto: CrearNotaDto, admin: Admin) {
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

  /** Lo que impide matricular, y lo que solo conviene. */
  async faltantesParaMatricular(
    id: string,
  ): Promise<{ bloquean: string[]; avisan: string[] }> {
    const p = await this.prisma.participante.findUnique({
      where: { id },
      include: {
        persona: { select: { id: true, correo: true, celular: true } },
        cobertura: { select: { grupo: { select: { fechaInicio: true } } } },
      },
    });
    if (!p) return { bloquean: ['el participante no existe'], avisan: [] };

    const bloquean: string[] = [];
    const avisan: string[] = [];

    if (!p.ofertaId) bloquean.push('falta asignarle una acción de formación');

    if (!p.persona.correo && !p.persona.celular) {
      bloquean.push('no hay forma de contactarla: falta correo o celular');
    }

    // el grupo y sus fechas los pone el SENA cuando puede:
    // no se bloquea la captura por algo que no depende de aqui
    if (!p.coberturaId) {
      avisan.push('sin grupo asignado no entra en el reporte al SENA');
    } else if (!p.cobertura?.grupo.fechaInicio) {
      avisan.push('su grupo no tiene fechas: no se puede saber si va al día');
    }

    const autorizacion = await this.prisma.autorizacionDatos.findFirst({
      where: {
        personaId: p.persona.id,
        revocadaEn: null,
        politica: { destinatario: 'PARTICIPANTE', convenioId: p.convenioId },
      },
      select: { id: true },
    });

    if (!autorizacion) {
      bloquean.push('no ha autorizado el tratamiento de sus datos para este convenio');
    }

    return { bloquean, avisan };
  }




  /** Que pasaria si se confirma este pegado. */
  async previsualizarCarga(dto: CargaDto) {
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
        tipoDocumento: f.tipoDocumento,
        numeroDocumento: f.numeroDocumento,
      }));

    const personas = await this.prisma.persona.findMany({
      where: { OR: claves },
      select: {
        id: true,
        tipoDocumento: true,
        numeroDocumento: true,
        participaciones: {
          select: { accionFormacionId: true, convenioId: true },
        },
      },
    });

    const porDocumento = new Map(
      personas.map((p) => [`${p.tipoDocumento}:${p.numeroDocumento}`, p]),
    );

    const oferta = dto.ofertaId
      ? await this.prisma.oferta.findUnique({
          where: { id: dto.ofertaId },
          select: { id: true, accionFormacionId: true, cuposMaximos: true },
        })
      : null;

    const previa = filas.map((f) => {
      const clave = `${f.tipoDocumento}:${f.numeroDocumento}`;
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
  async confirmarCarga(dto: CargaDto, admin: Admin, ip?: string) {
    const previa = await this.previsualizarCarga(dto);
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
            tipoDocumento: f.tipoDocumento,
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
  async brecha(convenioId?: string) {
    const reservas = await this.prisma.reserva.findMany({
      where: {
        estado: { not: 'CANCELADA' },
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
  async opciones(convenioId: string) {
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

    return {
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
  async asignar(id: string, dto: AsignarFormacionDto, admin: Admin) {
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

    return this.obtener(id);
  }

  /** La prueba de que el titular autorizo. */
  async registrarAutorizacion(
    id: string,
    dto: RegistrarAutorizacionDto,
    admin: Admin,
    ip?: string,
  ) {
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
    if (yaEsta) return this.obtener(id);

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

    return this.obtener(id);
  }

  private donde(f: FiltrosParticipantesDto): Prisma.ParticipanteWhereInput {
    const y: Prisma.ParticipanteWhereInput[] = [];

    if (f.convenioId) y.push({ convenioId: f.convenioId });
    if (f.etapa) y.push({ etapa: f.etapa });
    if (f.accionFormacionId) y.push({ accionFormacionId: f.accionFormacionId });
    if (f.coberturaId) y.push({ coberturaId: f.coberturaId });
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
      tipoDocumento: string;
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
      documento: `${p.persona.tipoDocumento} ${p.persona.numeroDocumento}`,
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
