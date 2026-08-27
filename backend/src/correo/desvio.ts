/** A dónde va de verdad un correo. */

export type Destino =
  { para: string[]; reales: string[] | null } | { rechazo: string };

type Entorno = { ENTORNO?: string; CORREO_REDIRIGIR_A?: string };

/** Las direcciones que se quedan con todo. */
export function desvioConfigurado(env: Entorno = process.env): string[] {
  return (env.CORREO_REDIRIGIR_A ?? '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
}

/** A quién se le manda, o por qué no se manda. */
export function resolverDestino(
  para: string[],
  env: Entorno = process.env,
): Destino {
  const desvio = desvioConfigurado(env);
  if (desvio.length > 0) return { para: desvio, reales: para };

  // pruebas sin desvío no manda nada
  if (env.ENTORNO === 'prueba') {
    return {
      rechazo:
        'Este es el entorno de pruebas y no tiene CORREO_REDIRIGIR_A. ' +
        'Sin esa variable el correo saldría a una persona real desde una ' +
        'demostración, así que no se manda ninguno.',
    };
  }

  return { para, reales: null };
}

/** Quién lo iba a recibir, para el asunto. */
export function etiquetaDeReales(reales: string[]): string {
  if (reales.length === 0) return 'nadie';
  if (reales.length === 1) return reales[0];
  return `${reales[0]} +${reales.length - 1}`;
}
