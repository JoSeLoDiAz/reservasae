/** El panel de cupos de una oferta, contra la base. */

/// Junta las tres cosas que hacen falta para saber si se
/// puede inscribir a alguien: cuantos cupos quedan, en que
/// bloque caen, y si la ventana del calendario sigue abierta.
///
/// Va aparte de `crm.service.ts` porque es la regla de
/// negocio que gobierna la inscripcion entera, y conviene
/// poder leerla de un tiron.

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ventanaDe, type VentanaInscripcion } from './calendario-inscripcion';
import { repartirCupos, type CuposDeLaOferta } from './cupos';
import { OCUPAN_SILLA } from './etapas';

export type PanelDeOferta = {
  ofertaId: string;
  accion: string;
  ubicacion: string;
  cupos: CuposDeLaOferta;
  /// La ventana de cada grupo que sirve a esta oferta. Puede
  /// haber varios y empezar en fechas distintas: por eso hay
  /// que decir a cual entra cada quien.
  grupos: Array<{
    grupoId: string;
    numero: number;
    coberturaId: string;
    cuposMaximos: number;
    inscritos: number;
    ventana: VentanaInscripcion;
  }>;
  /// Se puede inscribir a alguien mas, aqui y ahora.
  admiteInscripciones: boolean;
  /// Por que no, cuando no.
  porQueNo: string | null;
  /// Lo mismo, como CODIGO: hay que poder eximir de uno solo.
  motivo: MotivoSinInscripciones;
};

/// Por que una oferta no admite inscripciones ahora mismo.
export type MotivoSinInscripciones =
  | 'OFERTA_CERRADA'
  | 'LLENO'
  | 'SIN_GRUPOS'
  | 'SIN_FECHAS'
  | 'VENTANA_CERRADA'
  | null;

@Injectable()
export class PanelDeCupos {
  constructor(private readonly prisma: PrismaService) {}

  async deLaOferta(ofertaId: string, hoy = new Date()): Promise<PanelDeOferta | null> {
    const oferta = await this.prisma.oferta.findUnique({
      where: { id: ofertaId },
      select: {
        id: true,
        cuposMaximos: true,
        abierta: true,
        /// Hace falta suelto, no solo el nombre: es con lo que se
        /// acotan los grupos a los de ESTA sede.
        ubicacionId: true,
        accionFormacion: { select: { id: true, nombre: true } },
        ubicacion: { select: { nombre: true } },
        reservas: {
          where: { canceladaEn: null, estado: { not: 'CANCELADA' } },
          select: { id: true, cuposSolicitados: true },
        },
      },
    });
    if (!oferta) return null;

    // lo apartado y vivo
    const apartados = oferta.reservas.reduce((s, r) => s + r.cuposSolicitados, 0);

    // los inscritos, separando quien vino por una reserva
    const [deReserva, libres] = await Promise.all([
      this.prisma.participante.count({
        where: { ofertaId, etapa: { in: [...OCUPAN_SILLA] }, reservaId: { not: null } },
      }),
      this.prisma.participante.count({
        where: { ofertaId, etapa: { in: [...OCUPAN_SILLA] }, reservaId: null },
      }),
    ]);

    const cupos = repartirCupos({
      total: oferta.cuposMaximos,
      apartados,
      inscritosDeReserva: deReserva,
      inscritosLibres: libres,
    });

    /**
     * Los grupos que sirven a esta oferta: los de su acción Y DE SU
     * SEDE.
     *
     * Sin `ubicacionId` esta lista traía los grupos de todas las
     * ciudades donde se da el curso, y es la lista que autoriza la
     * inscripción: se podía meter a alguien de Bogotá en el grupo de
     * Atlántico, y ese grupo viajaba al SENA.
     *
     * Y el conteo lleva el mismo filtro de etapa que el de la oferta
     * treinta líneas más arriba. Sin él contaba como silla ocupada a
     * todo el que tuviera grupo puesto --interesados, perdidos,
     * retirados-- y bloqueaba inscripciones con el aula medio vacía.
     */
    const coberturas = await this.prisma.grupoCobertura.findMany({
      where: {
        grupo: { accionFormacionId: oferta.accionFormacion.id },
        ubicacionId: oferta.ubicacionId,
      },
      select: {
        id: true,
        cuposMaximos: true,
        grupo: { select: { id: true, numero: true, fechaInicio: true } },
        _count: {
          select: { participantes: { where: { etapa: { in: [...OCUPAN_SILLA] } } } },
        },
      },
      orderBy: { grupo: { numero: 'asc' } },
    });

    const grupos = coberturas.map((c) => ({
      grupoId: c.grupo.id,
      numero: c.grupo.numero,
      coberturaId: c.id,
      cuposMaximos: c.cuposMaximos,
      inscritos: c._count.participantes,
      ventana: ventanaDe(c.grupo.fechaInicio, hoy),
    }));

    const hayVentanaAbierta = grupos.some(
      (g) => g.ventana.estado === 'ABIERTA' || g.ventana.estado === 'AVISANDO',
    );

    /// El motivo va tambien como CODIGO, no solo como frase.
    ///
    /// Quien vuelve al aula esta exento de la VENTANA --su grupo
    /// ya arranco, asi que esta cerrada por definicion-- pero no
    /// de que la oferta este llena o cerrada. Con una sola frase
    /// no hay forma de eximirlo de una cosa y no de las otras
    /// salvo leyendo el texto, que es justo lo que no se hace.
    let motivo: MotivoSinInscripciones = null;
    let porQueNo: string | null = null;
    if (!oferta.abierta) {
      motivo = 'OFERTA_CERRADA';
      porQueNo = 'La oferta está cerrada.';
    } else if (cupos.lleno) {
      motivo = 'LLENO';
      porQueNo =
        `No quedan cupos: los ${cupos.total} están tomados. ` +
        'Para inscribir a alguien más hay que ampliar la oferta o abrir otro grupo.';
    } else if (grupos.length === 0) {
      motivo = 'SIN_GRUPOS';
      porQueNo = 'Esta acción no tiene ningún grupo. Sin grupo no se puede inscribir.';
    } else if (!hayVentanaAbierta) {
      const sinFechas = grupos.filter((g) => g.ventana.estado === 'SIN_FECHAS').length;
      motivo = sinFechas === grupos.length ? 'SIN_FECHAS' : 'VENTANA_CERRADA';
      porQueNo =
        sinFechas === grupos.length
          ? 'Ningún grupo tiene fecha de inicio. El cronograma manda: sin fechas no se inscribe.'
          : 'Se cerró la ventana de inscripción de todos los grupos.';
    }

    return {
      ofertaId: oferta.id,
      accion: oferta.accionFormacion.nombre,
      ubicacion: oferta.ubicacion.nombre,
      cupos,
      grupos,
      admiteInscripciones: porQueNo === null,
      porQueNo,
      motivo,
    };
  }

  /**
   * Lo que hay que avisar hoy: grupos dentro de su ventana de
   * aviso con cupos sin completar.
   *
   * Es la lista que se le manda a los coordinadores. No se
   * espera al cierre para descubrir que faltan cupos: para
   * entonces ya no hay a quien llamar.
   */
  async porAvisar(hoy = new Date()) {
    const coberturas = await this.prisma.grupoCobertura.findMany({
      where: { grupo: { fechaInicio: { not: null } } },
      select: {
        id: true,
        cuposMaximos: true,
        grupo: {
          select: {
            id: true,
            numero: true,
            fechaInicio: true,
            accionFormacion: {
              select: { id: true, codigo: true, nombre: true, convenioId: true },
            },
          },
        },
        ubicacion: { select: { nombre: true } },
        /// El mismo filtro que en `deLaOferta`. Sin él, un grupo con
        /// leads muertos apuntados salía con `faltan: 0`, se caía del
        /// filtro de abajo y NUNCA se mandaba el aviso que libera los
        /// turnos preferentes que la empresa no usó.
        _count: {
          select: { participantes: { where: { etapa: { in: [...OCUPAN_SILLA] } } } },
        },
      },
    });

    return coberturas
      .map((c) => ({
        coberturaId: c.id,
        grupoId: c.grupo.id,
        numero: c.grupo.numero,
        convenioId: c.grupo.accionFormacion.convenioId,
        accion: `${c.grupo.accionFormacion.codigo} · ${c.grupo.accionFormacion.nombre}`,
        ubicacion: c.ubicacion.nombre,
        cuposMaximos: c.cuposMaximos,
        inscritos: c._count.participantes,
        faltan: Math.max(0, c.cuposMaximos - c._count.participantes),
        ventana: ventanaDe(c.grupo.fechaInicio, hoy),
      }))
      .filter((g) => g.ventana.estado === 'AVISANDO' && g.faltan > 0);
  }
}
