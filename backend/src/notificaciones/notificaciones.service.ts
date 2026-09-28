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

      const suyo = aviso.destinatarioId ?? ficha.asesorId;

      /**
       * SIN DUEÑO SE AVISA IGUAL, A QUIEN PUEDE TOMARLA.
       *
       * Aquí había un `return`: sin asesor, el aviso se tiraba en
       * silencio. La razón escrita era buena ---«una ficha del montón
       * común todavía no es de nadie»--- pero el efecto no: medido en
       * la base de pruebas, el 94 % de las fichas no tiene asesor, y
       * por eso NO HABÍA UN SOLO AVISO en toda la tabla.
       *
       * Y es justo al revés de lo que hace falta: una persona que
       * acaba de completar sus datos y que no lleva nadie es
       * exactamente la que hay que atender, no la que se puede
       * callar. «Cuando el registro es independiente con RUT no
       * notifica» (cliente, 28 sep 2026) ---no era del RUT: era de
       * que esa ficha no tenía dueño, como el 94 % de las demás---.
       *
       * Así que si no hay asesor, se avisa a quien PUEDE tomarla: los
       * líderes de inscripción de ese gremio. No a todo el mundo: a
       * quien responde por el montón común.
       */
      const destinatarios = suyo
        ? [suyo]
        : await this.quienResponde(ficha.convenioId);

      if (destinatarios.length === 0) return;

      /// Uno a uno y no en lote: `upsert` no acepta varios, y la
      /// clave única es por destinatario ---dos personas pueden
      /// tener el mismo aviso sin pisarse---.
      for (const destinatarioId of destinatarios) {
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
      }
    } catch (e) {
      this.log.warn(
        `No se pudo avisar (${aviso.tipo} de ${aviso.participanteId}): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  /**
   * QUIÉN RESPONDE POR LAS FICHAS SIN DUEÑO DE UN GREMIO.
   *
   * Los líderes de inscripción, que son los que reparten. Si no hay
   * ninguno ---un gremio recién creado---, no se inventa un
   * destinatario: el aviso no se escribe y ya está. Mejor eso que
   * mandárselo a alguien que no responde por ese montón.
   *
   * NO se avisa a los gestores: ellos trabajan lo que les reparten,
   * y llenarles la campana de fichas que no son suyas es la forma
   * más rápida de que dejen de mirarla.
   */
  private async quienResponde(convenioId: string): Promise<string[]> {
    const filas = await this.prisma.adminConvenio.findMany({
      where: {
        convenioId,
        rol: 'LIDER_INSCRIPCION',
        admin: { activo: true },
      },
      select: { adminId: true },
    });
    return [...new Set(filas.map((f) => f.adminId))];
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

  /**
   * TODO lo que le llegó al equipo, y si lo atendieron.
   *
   * «Ver todas las notificaciones que llegan a los asesores, y si ya
   * los leyeron» (Josse, 26 sep 2026). Es la pregunta de quien
   * responde por el equipo: no qué pasó, sino qué pasó y NADIE LO
   * MIRÓ.
   *
   * SE ACOTA POR CONVENIO, con los gremios donde esta cuenta lleva
   * un rol que ve al equipo --no con su ámbito entero--. Quien lidera
   * en uno y solo gestiona en el otro no ve el trabajo ajeno del
   * segundo.
   *
   * Y NO TRAE ESTADO DE LECTURA PROPIO: `leidaEn` es de su dueño.
   * Mirarlas aquí no las marca, y no hay forma de marcárselas a otro
   * --no existe ruta que lo haga--: vaciarle la bandeja a alguien
   * sería borrarle el trabajo pendiente.
   */
  async listarDelEquipo(
    convenios: string[],
    opciones: { soloSinLeer?: boolean; limite?: number } = {},
  ) {
    if (convenios.length === 0) return [];
    const limite = Math.min(Math.max(opciones.limite ?? 60, 1), 200);
    const filas = await this.prisma.notificacion.findMany({
      where: {
        convenioId: { in: convenios },
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
        destinatario: { select: { nombre: true } },
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
      leidaEn: f.leidaEn,
      /// De quién es el aviso. Es la columna que hace útil la vista.
      asesor: f.destinatario.nombre,
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
