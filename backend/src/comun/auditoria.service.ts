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
  /// Lo que la persona dijo de su situación laboral, cada vez
  /// que lo dice.
  ///
  /// Se apunta SIEMPRE, no solo cuando cambia, porque el
  /// valor está en la secuencia: quien pone «desempleado»,
  /// ve que ahí se acaba el formulario, y vuelve a empezar
  /// poniendo «con vínculo laboral» deja dos entradas
  /// seguidas que se contradicen. Con una sola no se ve
  /// nada; con las dos, se ve.
  'SITUACION_LABORAL_DECLARADA',
  /// Se cambió de organización desde su propio enlace.
  ///
  /// Corregirse es legítimo, pero cambia de quién se la
  /// reporta al SENA y el F7 va por organización. Sin dejarlo
  /// escrito, el cambio pasa en silencio y despues nadie puede
  /// explicar por que esa ficha cuenta en otra empresa.
  'ORGANIZACION_CAMBIADA',
] as const;

export type Accion = (typeof ACCIONES)[number];

/// Los nombres de entidad, escritos UNA vez.
///
/// Estaban sueltos como cadenas y llegaron a SEIS grafías para
/// cuatro cosas: 'participante' y 'Participante', 'Institucion'
/// e 'instituciones'. Y como el historial de una ficha
/// consulta `where: { entidad, entidadId }`, una ficha que
/// preguntaba por 'participante' NO ENCONTRABA sus propios
/// registros guardados como 'Participante'. El «Control de
/// cambios» llevaba tiempo enseñando media historia sin que
/// nadie lo notara, porque media historia se ve igual de
/// completa que toda.
///
/// Con esto, una grafía nueva no compila.
export const ENTIDADES = {
  PARTICIPANTE: 'participante',
  PERSONA: 'persona',
  INSTITUCION: 'institucion',
  RESERVA: 'reserva',
  EMPRESA: 'empresa',
  LEAD: 'lead',
} as const;

export type Entidad = (typeof ENTIDADES)[keyof typeof ENTIDADES];

export type Actor = { id?: string | null; nombre: string };

export type Entrada = {
  actor: Actor;
  accion: Accion;
  /// Tipada contra el catálogo: una grafía nueva no compila.
  entidad: Entidad;
  entidadId: string;
  convenioId?: string | null;
  /// Qué pasó, en palabras. Con UN límite, y está abajo.
  resumen?: string | null;

  /// LA REGLA, con el alcance que de verdad tiene:
  ///
  /// Aquí NUNCA va el valor de una columna de `Persona` o de
  /// `Participante` — ni un correo, ni un celular, ni una
  /// dirección, ni una caracterización. Para eso están los
  /// NOMBRES de los campos, que es lo que dice qué se tocó
  /// sin volver esta tabla una segunda copia de la PII: la
  /// copia que nadie se acuerda de proteger.
  ///
  /// Lo que SÍ puede ir en `resumen` es lo que alguien
  /// DECLARÓ y no se guardó en ninguna columna. El caso vivo
  /// es `SITUACION_LABORAL_DECLARADA`: la persona dice
  /// «desempleado», ve que ahí se le acaba el formulario, y
  /// vuelve diciendo «con vínculo laboral». Esa contradicción
  /// solo existe aquí, porque el dato no se guarda en otro
  /// sitio. Si no se pudiera escribir, no habría forma de
  /// verla.
  ///
  /// La regla estaba escrita como si fuera absoluta y no lo
  /// era: el propio sistema ya la incumplía en ese sitio. Una
  /// regla que su dueño no cumple se deja de respetar entera,
  /// y esta protege algo que importa. Por eso ahora dice
  /// dónde empieza y dónde termina.
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
