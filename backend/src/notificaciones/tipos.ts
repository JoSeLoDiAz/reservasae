/** De qué se avisa a quien lleva la ficha. */

/// Catálogo en código y no enum de Postgres, igual que las
/// acciones de la auditoría: añadir un aviso no debería costar
/// una migración, y esta lista va a cambiar más que el esquema.
export const TIPOS = [
  /// La persona terminó de llenar SUS datos por el enlace.
  'DATOS_COMPLETADOS',
  /// Y los de su organización, que es el otro paso del enlace.
  'DATOS_DE_EMPRESA',
  /// Mandó cambios sobre lo que el asesor ya había tocado, así
  /// que NO se guardaron: esperan su visto bueno. Sin aviso, una
  /// propuesta se queda ahí para siempre y la persona cree que
  /// ya actualizó.
  'CAMBIOS_PROPUESTOS',
  /// Le acaban de pasar esta ficha. Es el aviso que abre la
  /// relación: de aquí en adelante recibe lo que le pase.
  'FICHA_ASIGNADA',
  /// Pidió que no se usen sus datos. Sale del reporte y deja de
  /// poder matricularse, así que quien la lleva tiene que saberlo
  /// antes de volver a llamarla.
  'AUTORIZACION_REVOCADA',
  /// Escribió por WhatsApp y la conversación se pegó a su ficha.
  'CONVERSACION_NUEVA',
] as const;

export type TipoDeAviso = (typeof TIPOS)[number];

/// Lo que se lee en el panel. Va aquí y no en el frontend porque
/// el título se congela al escribir la fila: si mañana se
/// reescribe, los avisos viejos siguen diciendo lo que decían.
export const ETIQUETA: Record<TipoDeAviso, string> = {
  DATOS_COMPLETADOS: 'Completó sus datos',
  DATOS_DE_EMPRESA: 'Completó los datos de su organización',
  CAMBIOS_PROPUESTOS: 'Propuso cambios que esperan su visto bueno',
  FICHA_ASIGNADA: 'Le asignaron esta ficha',
  AUTORIZACION_REVOCADA: 'Revocó la autorización de sus datos',
  CONVERSACION_NUEVA: 'Escribió por WhatsApp',
};

export const esTipo = (v: string): v is TipoDeAviso =>
  (TIPOS as readonly string[]).includes(v);
