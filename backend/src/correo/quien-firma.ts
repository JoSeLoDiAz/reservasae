/** Con qué nombre firma cada gremio. */

/// El buzón NO cambia: lleva la verificación institucional
/// del dominio. Lo que cambia es el nombre que se lee.

export type GremioQueFirma =
  | { sigla: string | null; nombre: string }
  | null
  | undefined;

/// Acaba DENTRO de una cabecera y la sigla la teclea un
/// admin: un salto de línea ahí mete otra cabecera.
const PROHIBIDOS = /["\\\u0000-\u001f\u007f]/g;

/** Lo deja en algo que cabe en una cabecera. */
export function limpiarNombre(nombre: string): string {
  return nombre.replace(PROHIBIDOS, ' ').replace(/\s+/g, ' ').trim();
}

/** El de siempre: el del `.env`, o el del producto. */
export function nombreGeneral(): string {
  return limpiarNombre(process.env.SMTP_NOMBRE ?? '') || 'Convoca CRM';
}

/** Con qué nombre sale un correo de este gremio. */
export function quienFirma(gremio: GremioQueFirma): string {
  if (!gremio) return nombreGeneral();
  return (
    limpiarNombre(gremio.sigla ?? '') ||
    limpiarNombre(gremio.nombre) ||
    nombreGeneral()
  );
}
