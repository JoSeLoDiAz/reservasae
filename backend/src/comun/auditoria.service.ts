/** Quién tocó qué, y cuándo. */

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/// Catálogo en código y no enum de Postgres: añadir una
/// acción no debería costar una migración, y el conjunto
/// cambia más que el esquema.
export const ACCIONES = [
  'ETAPA_CAMBIADA',
  'NOTA_CREADA',
  'PARTICIPANTE_CREADO',
  'PARTICIPANTE_EDITADO',
  'PARTICIPANTE_BORRADO',
  'ASESOR_ASIGNADO',
  'NIT_ALTA_MANUAL',
  'EMPRESA_EDITADA',
  'RUI_RECONSULTADO',
  'DATOS_DEL_INTERESADO_ACEPTADOS',
  'ESTADO_FORZADO',
  'REVOCAR_AUTORIZACION',
] as const;

export type Accion = (typeof ACCIONES)[number];

export type Actor = { id?: string | null; nombre: string };

export type Entrada = {
  actor: Actor;
  accion: Accion;
  entidad: string;
  entidadId: string;
  convenioId?: string | null;
  resumen?: string | null;
  /// Solo los NOMBRES de los campos cuando el cambio toca
  /// datos personales. Guardar los valores convertiría la
  /// auditoría en una segunda copia de la PII, y es la
  /// copia que nadie se acuerda de proteger.
  camposTocados?: string[];
  ip?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditoriaService {
  private readonly log = new Logger('Auditoria');

  constructor(private readonly prisma: PrismaService) {}

  /// No revienta la operación que audita: si la traza falla
  /// se registra el fallo, pero el cambio del usuario ya
  /// ocurrió y tumbarlo por esto sería peor.
  async registrar(entrada: Entrada): Promise<void> {
    try {
      await this.prisma.registroAuditoria.create({
        data: {
          adminId: entrada.actor.id ?? null,
          actorNombre: entrada.actor.nombre,
          accion: entrada.accion,
          entidad: entrada.entidad,
          entidadId: entrada.entidadId,
          convenioId: entrada.convenioId ?? null,
          resumen: entrada.resumen ?? null,
          camposTocados: entrada.camposTocados ?? [],
          ip: entrada.ip ?? null,
          userAgent: entrada.userAgent?.slice(0, 300) ?? null,
        },
      });
    } catch (e) {
      this.log.error(`No se pudo auditar ${entrada.accion}: ${(e as Error).message}`);
    }
  }

  /** El historial de una ficha, lo más nuevo primero. */
  async historial(entidad: string, entidadId: string, limite = 100) {
    return this.prisma.registroAuditoria.findMany({
      where: { entidad, entidadId },
      orderBy: { creadoEn: 'desc' },
      take: limite,
      select: {
        id: true,
        actorNombre: true,
        accion: true,
        resumen: true,
        camposTocados: true,
        creadoEn: true,
      },
    });
  }
}
