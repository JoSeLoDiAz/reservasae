/** La sede que pidió, contra las sedes que ese curso tiene. */

/**
 * Para una formación HÍBRIDA, la sede ES la modalidad.
 *
 * `adecopria AF7` se dicta en ANTIOQUIA (departamento, virtual,
 * 117 cupos) y en MEDELLÍN (ciudad, presencial, 78). Quien vive
 * en Medellín puede hacer las dos, y son cosas distintas: coge
 * Medellín si va a ir, coge Antioquia si se va a conectar.
 *
 * Hoy nadie elige. El formulario público se lleva la primera de
 * una lista ordenada alfabéticamente —«ANTIOQUIA» antes que
 * «MEDELLÍN»— así que los 78 cupos presenciales de Medellín son
 * inalcanzables, y no porque alguien lo decidiera: por el
 * abecedario.
 *
 * SE COMPARA POR NOMBRE, no por ids del SEP, y esa es la
 * decisión que hace que funcione. Traducir «Medellín» al par
 * (departamento 5, municipio 5001) pierde justo lo que hace
 * falta: al comparar ese 5 contra la oferta de ANTIOQUIA
 * —que es de tipo departamento— casaría también, las dos
 * seguirían dentro, y el desempate por cupo devolvería la
 * virtual otra vez. El arreglo no arreglaría nada.
 *
 * El nombre, en cambio, distingue: «Medellín» no es «Antioquia».
 */

import { igual } from '../crm/cobertura';

export type SedeCandidata = {
  id: string;
  accionFormacionId: string;
  ubicacion: { nombre: string; tipo: string };
};

export type QueSede<T> =
  | { sede: T }
  | { ninguna: string[] }
  | { ambigua: string[] };

/// «BOGOTÁ D.C» y «BOGOTÁ» son el mismo sitio.
///
/// El catálogo llama al departamento «BOGOTÁ D.C» y al municipio
/// «BOGOTÁ», y la gente escribe cualquiera de los dos para
/// cualquiera de las dos cosas. Quitar el sufijo de distrito
/// capital los junta.
///
/// Es seguro porque NINGUNA acción de formación tiene oferta en
/// las dos a la vez —comprobado sobre las 106—, así que juntarlos
/// nunca produce dos candidatas. Y si algún día las tuviera, este
/// fichero no elige: devuelve `ambigua` y lo pregunta.
function comoBogota(nombre: string): string {
  return nombre.replace(/\s+d\.?\s*c\.?$/i, '').trim();
}

function mismoSitio(a: string, b: string): boolean {
  return igual(a, b) || igual(comoBogota(a), comoBogota(b));
}

/**
 * Cuál de las sedes de ese curso es la que pidió.
 *
 * `ninguna` y `ambigua` traen la lista de las que sí hay, porque
 * un «no encontrado» sin decir qué había obliga a adivinar — y
 * quien lo lee es un asesor con la ficha delante, no alguien con
 * el código.
 */
export function sedePedida<T extends SedeCandidata>(
  texto: string | null | undefined,
  ofertas: T[],
  accionFormacionId: string,
): QueSede<T> | null {
  const pedida = (texto ?? '').trim();
  /// No la mandó: que decida quien deduce por el domicilio.
  if (!pedida) return null;

  const delCurso = ofertas.filter(
    (o) => o.accionFormacionId === accionFormacionId,
  );
  const hay = delCurso.map((o) => o.ubicacion.nombre);

  const casan = delCurso.filter((o) => mismoSitio(o.ubicacion.nombre, pedida));

  if (casan.length === 1) return { sede: casan[0] };
  if (casan.length === 0) return { ninguna: hay };

  /// Dos o más: NO se elige.
  ///
  /// Hoy no puede pasar, pero si pasara elegir por cupo o por
  /// orden sería exactamente el defecto que este fichero existe
  /// para quitar. Se deja en la mesa y lo confirma una persona.
  return { ambigua: casan.map((o) => o.ubicacion.nombre) };
}
