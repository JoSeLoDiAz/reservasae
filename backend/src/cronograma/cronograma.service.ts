/** El calendario de los grupos, que es de donde cuelga todo. */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { ETAPAS_VIVAS } from '../crm/crm.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarCuposDto, ActualizarGrupoDto } from './dto';

/// `ETAPAS_VIVAS` se importa del CRM. Aqui habia una copia
/// tecleada aparte que decia lo mismo con otras etapas, y
/// el mismo grupo reportaba una ocupacion en el cronograma
/// y otra en las ofertas.

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
                cuposMaximos: true,
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
            /// El tope con sobrecupo, para poder editarlo: la pildora
            /// ensenia lo comprometido --lo que se le prometio al SENA--
            /// pero quien reparte plazas necesita ver los dos.
            tope: c.cuposMaximos,
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

  /**
   * Los cupos de un grupo en una ubicacion.
   *
   * Es lo que hacia falta y no existia: si el proyecto suma plazas en un
   * departamento y las quita en otro, hasta hoy habia que tocar el Excel
   * y volver a sembrar, o entrar a la base a mano.
   *
   * EL INVARIANTE. `Oferta.cuposMaximos` es la SUMA de los topes de sus
   * coberturas -- asi lo produce el script que lee los Excel --, pero
   * nada lo ataba: eran dos numeros que podian separarse para siempre
   * sin que nadie avisara. Aqui se recalcula la oferta en la misma
   * transaccion, con su fila tomada, cada vez que cambia una cobertura.
   * Asi la suma no se puede romper por este camino.
   *
   * Y la ultima linea de defensa sigue siendo de la base: el CHECK
   * `ofertas_cupos_dentro_del_tope` rechaza dejar el tope por debajo de
   * lo ya apartado por las empresas, y aborta la transaccion entera.
   */
  async actualizarCupos(id: string, dto: ActualizarCuposDto, ambito: string[]) {
    const cobertura = await this.prisma.grupoCobertura.findFirst({
      where: { id, grupo: { accionFormacion: { convenioId: { in: ambito } } } },
      select: {
        id: true,
        cuposBase: true,
        cuposMaximos: true,
        ubicacionId: true,
        ubicacion: { select: { nombre: true } },
        grupo: { select: { numero: true, accionFormacionId: true } },
        _count: { select: { participantes: { where: { etapa: { in: ETAPAS_VIVAS } } } } },
      },
    });
    if (!cobertura) throw new NotFoundException('Ese grupo no existe en esa sede.');

    const base = dto.cuposBase ?? cobertura.cuposBase;
    const tope = dto.cuposMaximos ?? cobertura.cuposMaximos;

    if (tope < base) {
      throw new BadRequestException(
        'El tope no puede quedar por debajo de lo comprometido: el sobrecupo suma, no resta.',
      );
    }

    /// Nadie se queda fuera de un sitio que ya ocupa.
    const dentro = cobertura._count.participantes;
    if (tope < dentro) {
      throw new BadRequestException(
        `El grupo ${cobertura.grupo.numero} de ${cobertura.ubicacion.nombre} ya tiene ` +
          `${dentro} personas dentro: el tope no puede bajar de ahi. Muevalas primero.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      /// La oferta de esa accion en esa sede, tomada antes de tocar
      /// nada: es la que hay que dejar cuadrada, y es la misma fila que
      /// bloquean las reservas.
      const oferta = await tx.oferta.findUnique({
        where: {
          accionFormacionId_ubicacionId: {
            accionFormacionId: cobertura.grupo.accionFormacionId,
            ubicacionId: cobertura.ubicacionId,
          },
        },
        select: { id: true },
      });
      if (!oferta) {
        throw new BadRequestException(
          'Esa sede no tiene oferta de esta accion: no hay donde sumar los cupos.',
        );
      }
      await tx.$queryRaw`SELECT "id" FROM "ofertas" WHERE "id" = ${oferta.id} FOR UPDATE`;

      await tx.grupoCobertura.update({
        where: { id },
        data: { cuposBase: base, cuposMaximos: tope },
      });

      /// El tope de la oferta vuelve a ser la suma de sus coberturas.
      const suma = await tx.grupoCobertura.aggregate({
        where: {
          ubicacionId: cobertura.ubicacionId,
          grupo: { accionFormacionId: cobertura.grupo.accionFormacionId },
        },
        _sum: { cuposMaximos: true },
      });
      const nuevoTope = suma._sum.cuposMaximos ?? 0;

      await tx.oferta.update({
        where: { id: oferta.id },
        data: { cuposMaximos: nuevoTope },
      });

      return {
        coberturaId: id,
        cuposBase: base,
        cuposMaximos: tope,
        topeDeLaOferta: nuevoTope,
      };
    });
  }

}
