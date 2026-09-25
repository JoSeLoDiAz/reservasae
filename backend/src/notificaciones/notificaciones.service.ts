/** Avisar a quien lleva la ficha, y leer lo avisado. */

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ETIQUETA, type TipoDeAviso } from './tipos';

export type Aviso = {
  participanteId: string;
  tipo: TipoDeAviso;
  /// Una línea. Lo largo se lee en la ficha, que es la que manda.
  detalle?: string | null;
  /// Qué suceso concreto es. Dos llamadas con la misma clave son
  /// el mismo aviso: un reintento del POST no avisa dos veces.
  claveEvento: string;
  /// A quién avisar, cuando no es el asesor de la ficha --el
  /// caso de «le acaban de asignar esto»--.
  destinatarioId?: string | null;
};

@Injectable()
export class NotificacionesService {
  private readonly log = new Logger('Notificaciones');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * ESCRIBE EL AVISO Y NO LANZA NUNCA.
   *
   * Se llama desde la puerta pública --cuando la persona guarda
   * sus datos-- y desde el panel. Un fallo al avisar no puede
   * devolverle un 500 a quien acaba de completar su ficha: es la
   * misma regla que ya llevan el bloque de leads y
   * `registrarToqueDeOrigen`, y por el mismo motivo.
   */
  async avisar(aviso: Aviso): Promise<void> {
    try {
      const ficha = await this.prisma.participante.findUnique({
        where: { id: aviso.participanteId },
        select: { asesorId: true, convenioId: true },
      });
      if (!ficha) return;

      const destinatarioId = aviso.destinatarioId ?? ficha.asesorId;
      /// Sin dueño no hay a quién avisar, y eso NO es un fallo:
      /// una ficha del montón común todavía no es de nadie. El
      /// día que se reparta, el aviso de asignación lo abre.
      if (!destinatarioId) return;

      await this.prisma.notificacion.upsert({
        where: {
          destinatarioId_tipo_claveEvento: {
            destinatarioId,
            tipo: aviso.tipo,
            claveEvento: aviso.claveEvento,
          },
        },
        create: {
          destinatarioId,
          participanteId: aviso.participanteId,
          convenioId: ficha.convenioId,
          tipo: aviso.tipo,
          titulo: ETIQUETA[aviso.tipo],
          detalle: aviso.detalle ?? null,
          claveEvento: aviso.claveEvento,
        },
        /// Vacío a propósito: el segundo intento NO reabre un
        /// aviso que alguien ya leyó. Marcar como no leída una
        /// fila leída es contarle al asesor algo que ya atendió.
        update: {},
      });
    } catch (e) {
      this.log.warn(
        `No se pudo avisar (${aviso.tipo} de ${aviso.participanteId}): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  /** Lo suyo, lo último primero. */
  async listar(
    destinatarioId: string,
    opciones: { soloSinLeer?: boolean; limite?: number } = {},
  ) {
    const limite = Math.min(Math.max(opciones.limite ?? 30, 1), 100);
    const filas = await this.prisma.notificacion.findMany({
      where: {
        destinatarioId,
        ...(opciones.soloSinLeer ? { leidaEn: null } : {}),
      },
      orderBy: { creadoEn: 'desc' },
      take: limite,
      select: {
        id: true,
        tipo: true,
        titulo: true,
        detalle: true,
        creadoEn: true,
        leidaEn: true,
        participanteId: true,
        participante: {
          select: {
            etapa: true,
            persona: {
              select: {
                primerNombre: true,
                primerApellido: true,
                numeroDocumento: true,
              },
            },
          },
        },
      },
    });

    return filas.map((f) => ({
      id: f.id,
      tipo: f.tipo,
      titulo: f.titulo,
      detalle: f.detalle,
      creadoEn: f.creadoEn,
      leida: f.leidaEn !== null,
      participanteId: f.participanteId,
      etapa: f.participante.etapa,
      quien: `${f.participante.persona.primerNombre} ${f.participante.persona.primerApellido}`.trim(),
      documento: f.participante.persona.numeroDocumento,
    }));
  }

  /** Cuántas sin leer, para la campana. */
  sinLeer(destinatarioId: string): Promise<number> {
    return this.prisma.notificacion.count({
      where: { destinatarioId, leidaEn: null },
    });
  }

  /**
   * Marcar una como leída.
   *
   * El `destinatarioId` va en el WHERE y no se comprueba aparte:
   * así no hay forma de marcar la de otro ni de averiguar si
   * existe. Devuelve cuántas cambiaron, que es 0 o 1.
   */
  async marcarLeida(destinatarioId: string, id: string): Promise<number> {
    const r = await this.prisma.notificacion.updateMany({
      where: { id, destinatarioId, leidaEn: null },
      data: { leidaEn: new Date() },
    });
    return r.count;
  }

  /** Todas las suyas de golpe. */
  async marcarTodasLeidas(destinatarioId: string): Promise<number> {
    const r = await this.prisma.notificacion.updateMany({
      where: { destinatarioId, leidaEn: null },
      data: { leidaEn: new Date() },
    });
    return r.count;
  }
}
