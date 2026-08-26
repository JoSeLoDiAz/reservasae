/** Si el nombre tecleado y el del RUI son el mismo. */

/// Se compara por palabras y no por la cadena entera: el
/// RUI devuelve "APELLIDO APELLIDO NOMBRE NOMBRE" y el
/// formulario captura al revés, así que comparar en orden
/// marcaría distinto a todo el mundo.

export type Veredicto = 'IGUAL' | 'PARECIDO' | 'DISTINTO';

export type Comparacion = {
  veredicto: Veredicto;
  /// Cuántas palabras del tecleado están en el del RUI.
  coincidencias: number;
  /// Las que no aparecen en el otro, en cualquier sentido.
  sobran: string[];
  faltan: string[];
};

/// Sin tildes, sin la ñ perdida y sin dobles espacios.
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/// "DE", "DEL" y "LA" no distinguen a nadie y el RUI a
/// veces las come, así que no cuentan para el veredicto.
const VACIAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y']);

function palabras(texto: string): string[] {
  return normalizar(texto)
    .split(' ')
    .filter((p) => p.length > 1 && !VACIAS.has(p));
}

export function compararNombres(tecleado: string, delRui: string): Comparacion {
  const a = palabras(tecleado);
  const b = palabras(delRui);

  if (!a.length || !b.length) {
    return { veredicto: 'DISTINTO', coincidencias: 0, sobran: a, faltan: b };
  }

  const restantes = [...b];
  const sobran: string[] = [];
  let coincidencias = 0;

  for (const p of a) {
    const i = restantes.indexOf(p);
    if (i >= 0) {
      restantes.splice(i, 1);
      coincidencias += 1;
    } else {
      sobran.push(p);
    }
  }

  const veredicto = decidir(coincidencias, a.length, b.length);
  return { veredicto, coincidencias, sobran, faltan: restantes };
}

/// Igual solo si no sobra ni falta nada. Parecido cuando
/// coinciden los dos apellidos y un nombre, que es el caso
/// de quien omite el segundo nombre. Lo demás, distinto.
function decidir(coincidencias: number, enA: number, enB: number): Veredicto {
  if (coincidencias === enA && coincidencias === enB) return 'IGUAL';
  if (coincidencias >= 3 && coincidencias >= Math.min(enA, enB))
    return 'PARECIDO';
  return 'DISTINTO';
}

/** Lo que se guarda en la consulta: coincide o no. */
export function nombreCoincide(tecleado: string, delRui: string): boolean {
  const c = compararNombres(tecleado, delRui);
  return c.veredicto !== 'DISTINTO';
}
