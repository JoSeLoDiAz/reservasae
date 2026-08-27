/** Si se le puede preguntar al RUI por ese documento. */

type Entorno = {
  ENTORNO?: string;
  RUI_PROVEEDOR?: string;
  RUI_SOLO_ESTOS_DOCUMENTOS?: string;
};

export type Permiso = { real: boolean; motivo: string };

/** Los documentos cuyo dueño autorizó la consulta. */
export function documentosPermitidos(env: Entorno = process.env): string[] {
  return (env.RUI_SOLO_ESTOS_DOCUMENTOS ?? '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
}

/**
 * Decide, POR DOCUMENTO, si sale al portal del DNP.
 *
 * Es la misma barrera que `correo/desvio.ts`, y por el mismo
 * motivo: un entorno de pruebas con la salida real conectada
 * le hace algo a una persona de verdad que no se puede
 * deshacer. Allí es un correo; aquí es pedirle al Estado la
 * identidad de un ciudadano que no pidió nada.
 *
 * En `ENTORNO=prueba` falla CERRADO: solo se consulta lo que
 * esté en `RUI_SOLO_ESTOS_DOCUMENTOS`, que son los documentos
 * cuyo dueño lo autorizó. Todo lo demás va al simulador.
 *
 * El candado de `esDePrueba` no basta: solo cubre las filas
 * que escribió la siembra, y cualquiera que se registre
 * después nace sin la marca.
 */
export function permisoDeRui(
  numeroDocumento: string,
  env: Entorno = process.env,
): Permiso {
  if (env.RUI_PROVEEDOR !== 'VENTANILLA') {
    return { real: false, motivo: 'El RUI no está conectado.' };
  }

  if (env.ENTORNO !== 'prueba') return { real: true, motivo: '' };

  const permitidos = documentosPermitidos(env);
  if (permitidos.includes((numeroDocumento ?? '').trim())) {
    return { real: true, motivo: '' };
  }

  return {
    real: false,
    motivo:
      'Este es el entorno de pruebas: solo se consulta el RUI de los ' +
      'documentos listados en RUI_SOLO_ESTOS_DOCUMENTOS, que son los que su ' +
      'dueño autorizó. Los demás van al simulador.',
  };
}
