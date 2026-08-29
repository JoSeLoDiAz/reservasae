/** La configuración de Meta, que es DE CADA GREMIO. */

/// Por qué esto existe.
///
/// La primera versión leía tres variables sueltas:
/// `META_APP_SECRET`, `META_VERIFY_TOKEN` y
/// `META_CONVENIO_SLUG`. Con una sola app de Meta eso bastaba.
/// Con una app POR GREMIO —que es como quedó— las tres son de
/// cada gremio, y la primera es la que muerde:
///
/// **Cada app firma con SU secreto.** Verificar la firma de
/// BRITCHAM con el secreto de ADECOPRIA la rechaza. Y no se
/// lee como un error de configuración: se lee como «Meta no
/// nos está mandando nada», que es de los síntomas más caros
/// de diagnosticar porque no hay nada roto que mirar.
///
/// `META_VERIFY_TOKEN` es menos grave y también falla: el
/// `hub.challenge` de cada app se compara con el suyo, así que
/// con uno solo no se puede ni suscribir la segunda.
///
/// `META_CONVENIO_SLUG` desaparece: el gremio lo dice el
/// SUBDOMINIO por el que entró la llamada, igual que en la
/// puerta del orquestador. Una app, una URL de devolución, un
/// gremio.

/// Cómo se llama la variable de este gremio.
///
/// El slug lleva guion —`britcham-adee`— y una variable de
/// entorno no: se pasa a mayúsculas y el guion a raya baja.
/// Se hace aquí y en un solo sitio porque escribirlo a mano en
/// dos lados es como uno de los dos se queda viejo.
export function nombreDeVariable(base: string, slug: string): string {
  return `${base}_${slug.toUpperCase().replace(/-/g, '_')}`;
}

export type ConfigDeMeta = {
  slug: string;
  appSecret: string | null;
  verifyToken: string | null;
};

/**
 * Lo que hay configurado para este gremio.
 *
 * Devuelve los dos valores por separado y NO un booleano de
 * «está listo»: quien llama necesita saber cuál de los dos
 * falta para poder decirlo, y un `false` a secas obliga a
 * adivinarlo.
 *
 * NO hay respaldo a las variables sin sufijo. Es a propósito:
 * un respaldo haría que el gremio mal configurado usara el
 * secreto del otro, y entonces el fallo vuelve a ser
 * silencioso — que es justo lo que esto viene a impedir.
 */
export function configDeMeta(
  slug: string,
  env: NodeJS.ProcessEnv = process.env,
): ConfigDeMeta {
  return {
    slug,
    appSecret: env[nombreDeVariable('META_APP_SECRET', slug)] || null,
    verifyToken: env[nombreDeVariable('META_VERIFY_TOKEN', slug)] || null,
  };
}

/** Lo que le falta a este gremio, ya redactado. */
export function loQueFalta(config: ConfigDeMeta): string[] {
  const falta: string[] = [];

  if (!config.appSecret) {
    falta.push(
      `${nombreDeVariable('META_APP_SECRET', config.slug)} — la «clave secreta ` +
        'de la app» de Meta. Es con lo que se comprueba que un aviso viene de ' +
        'ellos, y cada app tiene la suya.',
    );
  }
  if (!config.verifyToken) {
    falta.push(
      `${nombreDeVariable('META_VERIFY_TOKEN', config.slug)} — se lo inventa ` +
        'usted. Va escrito igual aquí y en Meta, y es lo único que Meta ' +
        'comprueba antes de encender el webhook.',
    );
  }

  return falta;
}
