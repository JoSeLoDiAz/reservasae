/** Si un correo tiene forma de correo. */

/// Gemelo de `celular.ts`, y por el mismo motivo: el correo
/// viaja al reporte del SEP y tapa la compuerta de contacto.
/// La puerta del panel y la publica ya lo validan; la del
/// webhook no, y ahi entra lo que mande un tercero.
const CORREO = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Recortado y en minusculas. */
export function normalizarCorreo(valor: string | null | undefined): string {
  return (valor ?? '').trim().toLowerCase();
}

/** Vacio es valido: el correo es opcional. */
export function correoValido(valor: string | null | undefined): boolean {
  if (!valor || !valor.trim()) return true;
  return CORREO.test(normalizarCorreo(valor));
}

/** Si sirve para escribirle a esta persona. */
export function correoUtil(valor: string | null | undefined): boolean {
  return !!valor && CORREO.test(normalizarCorreo(valor));
}
