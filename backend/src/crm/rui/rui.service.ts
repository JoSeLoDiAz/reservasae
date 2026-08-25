/** La cola de consultas al RUI. */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { EstadoConsultaRui } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { nombreCompleto } from '../../comun/documento';
import { nombreCoincide } from './comparar-nombres';
import { PROVEEDOR_RUI, ruiEsSimulado, type ProveedorRui } from './proveedor';

/// Cuántas veces se reintenta antes de rendirse. Tres es
/// suficiente para un corte de red y poco para no dejar
/// una consulta rota girando toda la noche.
const INTENTOS_MAXIMOS = 3;

/// Lo que ve el asesor mientras espera.
export type EstadoRuiDeLaFicha = {
  estado: EstadoConsultaRui | 'SIN_CONSULTA';
  nombreEncontrado: string | null;
  nombreTecleado: string | null;
  nombreCoincide: boolean | null;
  resueltaEn: Date | null;
  /// Cuántas hay por delante. Solo cuando está esperando.
  porDelante: number | null;
  /// El detector es el de mentira: lo que sale no es el RUI.
  simulado: boolean;
};

@Injectable()
export class RuiService {
  private readonly log = new Logger('RUI');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PROVEEDOR_RUI) private readonly proveedor: ProveedorRui,
  ) {}

  /// Encolar no espera a nada: guardar nunca se bloquea
  /// por el RUI. Si ya hay una pendiente para esa persona
  /// se reusa, y solo se le sube la prioridad.
  async encolar(personaId: string, prioridad = 0): Promise<void> {
    const persona = await this.prisma.persona.findUnique({
      where: { id: personaId },
      select: {
        id: true,
        tipoDocumentoSepId: true,
        numeroDocumento: true,
        primerNombre: true,
        segundoNombre: true,
        primerApellido: true,
        segundoApellido: true,
      },
    });
    if (!persona) return;

    const pendiente = await this.prisma.consultaRui.findFirst({
      where: {
        personaId,
        estado: { in: [EstadoConsultaRui.PENDIENTE, EstadoConsultaRui.EN_CURSO] },
      },
      select: { id: true, prioridad: true },
    });

    if (pendiente) {
      if (prioridad > pendiente.prioridad) {
        await this.prisma.consultaRui.update({
          where: { id: pendiente.id },
          data: { prioridad },
        });
      }
      return;
    }

    await this.prisma.consultaRui.create({
      data: {
        personaId,
        tipoDocumentoSepId: persona.tipoDocumentoSepId,
        numeroDocumento: persona.numeroDocumento,
        nombreTecleado: nombreCompleto(persona),
        prioridad,
      },
    });
  }

  /// Sube al frente lo de la ficha que alguien está
  /// mirando. Sin esto, el asesor que espera queda detrás
  /// de todo lo que se encoló en segundo plano.
  async priorizar(personaId: string): Promise<void> {
    await this.prisma.consultaRui.updateMany({
      where: { personaId, estado: EstadoConsultaRui.PENDIENTE },
      data: { prioridad: 100 },
    });
  }

  /** Lo que la ficha enseña mientras tanto. */
  async estadoDe(personaId: string): Promise<EstadoRuiDeLaFicha> {
    const c = await this.prisma.consultaRui.findFirst({
      where: { personaId },
      orderBy: { creadoEn: 'desc' },
    });

    if (!c) {
      return {
        estado: 'SIN_CONSULTA',
        nombreEncontrado: null,
        nombreTecleado: null,
        nombreCoincide: null,
        resueltaEn: null,
        porDelante: null,
        simulado: ruiEsSimulado(),
      };
    }

    const esperando =
      c.estado === EstadoConsultaRui.PENDIENTE || c.estado === EstadoConsultaRui.EN_CURSO;

    return {
      estado: c.estado,
      nombreEncontrado: c.nombreEncontrado,
      nombreTecleado: c.nombreTecleado,
      nombreCoincide: c.nombreCoincide,
      resueltaEn: c.resueltaEn,
      porDelante: esperando ? await this.porDelanteDe(c.prioridad, c.creadoEn) : null,
      simulado: ruiEsSimulado(),
    };
  }

  private async porDelanteDe(prioridad: number, creadoEn: Date): Promise<number> {
    return this.prisma.consultaRui.count({
      where: {
        estado: EstadoConsultaRui.PENDIENTE,
        OR: [{ prioridad: { gt: prioridad } }, { prioridad, creadoEn: { lt: creadoEn } }],
      },
    });
  }

  /// Toma una y la marca EN_CURSO en la misma sentencia.
  /// SKIP LOCKED es lo que permite levantar un segundo
  /// worker sin que los dos agarren la misma fila.
  async tomarSiguiente() {
    const filas = await this.prisma.$queryRaw<
      Array<{ id: string; tipoDocumentoSepId: number; numeroDocumento: string }>
    >`
      UPDATE "consultas_rui"
      SET "estado" = 'EN_CURSO', "tomadaEn" = NOW(), "intentos" = "intentos" + 1
      WHERE "id" = (
        SELECT "id" FROM "consultas_rui"
        WHERE "estado" = 'PENDIENTE'
        ORDER BY "prioridad" DESC, "creadoEn" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id", "tipoDocumentoSepId", "numeroDocumento"
    `;

    return filas[0] ?? null;
  }

  /** Consulta una y guarda lo que salga. */
  async procesarUna(): Promise<boolean> {
    const tarea = await this.tomarSiguiente();
    if (!tarea) return false;

    let resultado;
    try {
      resultado = await this.proveedor.consultar(
        tarea.tipoDocumentoSepId,
        tarea.numeroDocumento,
      );
    } catch (e) {
      resultado = { estado: 'FALLO' as const, error: (e as Error).message };
    }

    await this.guardar(tarea.id, resultado);
    return true;
  }

  private async guardar(
    id: string,
    resultado: Awaited<ReturnType<ProveedorRui['consultar']>>,
  ): Promise<void> {
    const c = await this.prisma.consultaRui.findUnique({
      where: { id },
      select: { intentos: true, nombreTecleado: true, personaId: true },
    });
    if (!c) return;

    if (resultado.estado === 'ENCONTRADO') {
      const coincide = c.nombreTecleado
        ? nombreCoincide(c.nombreTecleado, resultado.nombreCompleto)
        : null;

      await this.prisma.consultaRui.update({
        where: { id },
        data: {
          estado: EstadoConsultaRui.LISTA,
          nombreEncontrado: resultado.nombreCompleto,
          nombreCoincide: coincide,
          resueltaEn: new Date(),
          ultimoError: null,
        },
      });
      return;
    }

    if (resultado.estado === 'SIN_RESULTADO') {
      await this.prisma.consultaRui.update({
        where: { id },
        data: { estado: EstadoConsultaRui.SIN_RESULTADO, resueltaEn: new Date() },
      });
      return;
    }

    // se rinde solo cuando se acabaron los intentos
    const seRinde = c.intentos >= INTENTOS_MAXIMOS;
    await this.prisma.consultaRui.update({
      where: { id },
      data: {
        estado: seRinde ? EstadoConsultaRui.FALLIDA : EstadoConsultaRui.PENDIENTE,
        ultimoError: resultado.error.slice(0, 500),
        resueltaEn: seRinde ? new Date() : null,
      },
    });

    if (seRinde) this.log.warn(`Consulta ${id} fallida tras ${c.intentos} intentos.`);
  }

  /** Para el tablero: cómo va la cola. */
  async resumen() {
    const filas = await this.prisma.consultaRui.groupBy({
      by: ['estado'],
      _count: { _all: true },
    });

    const porEstado = Object.fromEntries(
      filas.map((f) => [f.estado, f._count._all]),
    ) as Record<EstadoConsultaRui, number>;

    return {
      pendientes: porEstado.PENDIENTE ?? 0,
      enCurso: porEstado.EN_CURSO ?? 0,
      listas: porEstado.LISTA ?? 0,
      sinResultado: porEstado.SIN_RESULTADO ?? 0,
      fallidas: porEstado.FALLIDA ?? 0,
    };
  }

  /// Las que hay que mirar: el RUI trajo un nombre que no
  /// se parece al que tecleó la persona.
  async discrepancias(limite = 50) {
    return this.prisma.consultaRui.findMany({
      where: { estado: EstadoConsultaRui.LISTA, nombreCoincide: false },
      orderBy: { resueltaEn: 'desc' },
      take: limite,
      select: {
        id: true,
        personaId: true,
        nombreTecleado: true,
        nombreEncontrado: true,
        resueltaEn: true,
      },
    });
  }
}
