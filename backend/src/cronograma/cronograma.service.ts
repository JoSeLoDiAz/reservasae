/** El calendario de los grupos, que es de donde cuelga todo. */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ActualizarGrupoDto } from './dto';

/// Las etapas que ocupan una silla de verdad.
const ETAPAS_VIVAS = [
  'MATRICULADO',
  'EN_FORMACION',
  'CERTIFICADO',
] as const;

/** En qué punto está un grupo respecto de hoy. */
export type EstadoGrupo =
  | 'SIN_FECHAS'
  | 'POR_EMPEZAR'
  | 'EN_CURSO'
  | 'TERMINADO';

export function estadoDeGrupo(
  inicio: Date | null,
  fin: Date | null,
  hoy = new Date(),
): EstadoGrupo {
  if (!inicio) return 'SIN_FECHAS';
  if (hoy < inicio) return 'POR_EMPEZAR';
  if (fin && hoy > fin) return 'TERMINADO';
  return 'EN_CURSO';
}

@Injectable()
export class CronogramaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Las acciones con sus grupos y sus fechas. */
  async listar(ambito: string[]) {
    const acciones = await this.prisma.accionFormacion.findMany({
      where: { convenioId: { in: ambito } },
      orderBy: [{ convenio: { orden: 'asc' } }, { orden: 'asc' }],
      select: {
        id: true,
        codigo: true,
        nombre: true,
        horas: true,
        visible: true,
        convenio: { select: { slug: true, sigla: true } },
        grupos: {
          orderBy: { numero: 'asc' },
          select: {
            id: true,
            numero: true,
            modalidad: true,
            fechaInicio: true,
            fechaFin: true,
            horario: true,
            sepGrupoId: true,
            sede: { select: { nombre: true } },
            coberturas: {
              orderBy: { ubicacion: { nombre: 'asc' } },
              select: {
                id: true,
                cuposBase: true,
                ubicacion: { select: { nombre: true, tipo: true } },
                _count: {
                  select: { participantes: { where: { etapa: { in: [...ETAPAS_VIVAS] } } } },
                },
              },
            },
          },
        },
      },
    });

    const hoy = new Date();

    return acciones.map((a) => {
      const grupos = a.grupos.map((g) => {
        const cupos = g.coberturas.reduce((s, c) => s + c.cuposBase, 0);
        const inscritos = g.coberturas.reduce((s, c) => s + c._count.participantes, 0);
        return {
          id: g.id,
          numero: g.numero,
          modalidad: g.modalidad,
          fechaInicio: g.fechaInicio,
          fechaFin: g.fechaFin,
          horario: g.horario,
          sepGrupoId: g.sepGrupoId,
          sede: g.sede?.nombre ?? null,
          estado: estadoDeGrupo(g.fechaInicio, g.fechaFin, hoy),
          cupos,
          inscritos,
          ubicaciones: g.coberturas.map((c) => ({
            id: c.id,
            nombre: c.ubicacion.nombre,
            tipo: c.ubicacion.tipo,
            cupos: c.cuposBase,
            inscritos: c._count.participantes,
          })),
        };
      });

      return {
        id: a.id,
        codigo: a.codigo,
        nombre: a.nombre,
        horas: a.horas,
        visible: a.visible,
        convenio: a.convenio.sigla ?? a.convenio.slug,
        grupos,
        // lo que se mira de un vistazo por acción
        cupos: grupos.reduce((s, g) => s + g.cupos, 0),
        inscritos: grupos.reduce((s, g) => s + g.inscritos, 0),
        sinFechas: grupos.filter((g) => g.estado === 'SIN_FECHAS').length,
      };
    });
  }

  /** Pone o corrige las fechas de un grupo. */
  async actualizarGrupo(id: string, dto: ActualizarGrupoDto, ambito: string[]) {
    const grupo = await this.prisma.grupo.findFirst({
      where: { id, accionFormacion: { convenioId: { in: ambito } } },
      select: { id: true, fechaInicio: true, fechaFin: true },
    });
    if (!grupo) throw new NotFoundException('Ese grupo no existe.');

    const inicio =
      dto.fechaInicio === null
        ? null
        : dto.fechaInicio
          ? new Date(dto.fechaInicio)
          : grupo.fechaInicio;
    const fin =
      dto.fechaFin === null
        ? null
        : dto.fechaFin
          ? new Date(dto.fechaFin)
          : grupo.fechaFin;

    // un grupo que termina antes de empezar deja el
    // seguimiento academico sin forma de medir el avance
    if (inicio && fin && fin < inicio) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la de inicio.',
      );
    }

    // sin inicio, el fin no significa nada
    if (!inicio && fin) {
      throw new BadRequestException(
        'Ponga primero la fecha de inicio: sin ella no se puede medir el avance.',
      );
    }

    await this.prisma.grupo.update({
      where: { id },
      data: {
        fechaInicio: inicio,
        fechaFin: fin,
        horario: dto.horario === undefined ? undefined : dto.horario || null,
        sepGrupoId: dto.sepGrupoId === undefined ? undefined : dto.sepGrupoId,
      },
    });

    return { actualizado: true };
  }
}
