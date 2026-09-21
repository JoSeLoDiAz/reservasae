/** Lo que el enlace de completar datos NO le pregunta a nadie en Grupo AE. */

/**
 * ESTE CRM NACIÓ PARA LA CONVOCATORIA DEL SENA, Y SE NOTA EN LA FICHA.
 *
 * El formulario largo —`/completar/<token>`— preguntaba la fecha de
 * nacimiento, el estrato, la población vulnerable (víctima del
 * conflicto, discapacidad…) y ofrecía «No estoy trabajando en este
 * momento». Todo eso lo pide el F7 del SEP, y para aquel negocio
 * tenía sentido: el SENA forma sobre todo a quien no tiene trabajo.
 *
 * Grupo AE no forma a nadie para el SENA: vende licencias de Google
 * —Workspace, Education, Chromebooks, soporte, cursos— a
 * organizaciones. A quien viene a cotizar ochenta cuentas de correo
 * preguntarle su estrato es perderlo, y preguntarle si es víctima
 * del conflicto es algo peor: es recoger un dato SENSIBLE de la ley
 * 1581 sin ninguna finalidad que lo justifique, y la ley exige
 * finalidad antes que autorización.
 *
 * SE OCULTA, NO SE BORRA. Las columnas siguen en la base, el código
 * de la pantalla sigue en su sitio y lo que alguien ya contestó sigue
 * guardado. Volver a preguntar un dato es quitarlo de esta lista —y
 * nada más—.
 *
 * UNA SOLA LISTA PARA LAS DOS PUNTAS, y es el motivo de que viva
 * aquí y no en la pantalla. La pantalla la recibe en `abrir()`; la
 * regla de completitud la lee directamente. Si la pantalla dejara de
 * pedir la fecha de nacimiento y `faltaDeLaPersona` la siguiera
 * exigiendo, el panel diría «le falta la fecha de nacimiento»,
 * ofrecería el enlace para arreglarlo, y el enlace no la pediría:
 * el callejón sin salida que `lo-que-falta-se-puede-pedir.spec.ts`
 * existe para impedir. Dos listas, una en cada punta, acaban
 * diciendo cosas distintas; ya pasó con el municipio.
 *
 * El REPORTE AL SEP (`revisar().reporte`) NO la mira, a propósito:
 * ese archivo tiene columnas fijas que el SENA recibe tal cual, y
 * si algún día esta instalación volviera a reportar, que le falte
 * el estrato tiene que seguir diciéndose.
 */

/// Los datos que se pueden dejar de preguntar. Es una lista
/// cerrada y con nombre propio para que el compilador cace una
/// errata: un `'fechaNacimeinto'` en la lista de abajo no
/// ocultaría nada y nadie se enteraría.
export const CAMPOS_OCULTABLES = [
  'fechaNacimiento',
  'estrato',
  'poblacionVulnerable',
] as const;
export type CampoOcultable = (typeof CAMPOS_OCULTABLES)[number];

/// Lo que en esta instalación NO se pregunta.
export const NO_SE_PREGUNTAN: ReadonlySet<CampoOcultable> = new Set<CampoOcultable>([
  'fechaNacimiento',
  'estrato',
  'poblacionVulnerable',
]);

export function seLePregunta(campo: CampoOcultable): boolean {
  return !NO_SE_PREGUNTAN.has(campo);
}

/**
 * CÓMO SE PREGUNTA EL VÍNCULO CON LA ORGANIZACIÓN.
 *
 * `LABORAL` es la pregunta de la convocatoria: «¿Cuál es su
 * situación laboral actual?», con independiente, con vínculo
 * laboral o sin trabajo. Interesaba la persona como trabajador,
 * porque el SENA reporta por empresa empleadora.
 *
 * `COMPRA` es la de Grupo AE: «¿A nombre de quién es la compra?»,
 * con dos respuestas —su organización, con NIT, o usted como
 * independiente, con RUT—. Aquí no interesa dónde trabaja la
 * persona sino a quién se le cotiza y se le factura, y en esa
 * pregunta «no estoy trabajando» no es una respuesta posible: nadie
 * compra licencias a nombre de nadie.
 *
 * Lo que viaja al servidor es el MISMO valor en los dos casos
 * —`EMPRESA` o `INDEPENDIENTE`, ver `SITUACIONES` en
 * `preinscripcion/dto.ts`—, así que el rastro de lo que dijo, la
 * rama del NIT y la del RUT siguen funcionando sin tocarse. Solo
 * cambian las palabras.
 */
export type PreguntaDelVinculo = 'COMPRA' | 'LABORAL';
export const PREGUNTA_DEL_VINCULO: PreguntaDelVinculo = 'COMPRA';
