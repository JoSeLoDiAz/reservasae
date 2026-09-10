/** Partir un nombre colombiano en nombres y apellidos. */

/// Portado de `split_full_name` y `estado_validacion` de
/// `MasivoRUI.py`, con el mismo criterio: la funcion NO
/// corrige el nombre, solo dice que tan confiable es el corte.
/// Ante duda real marca para revision, para que revisando solo
/// lo marcado el resultado quede bien.

import {
  APELLIDOS_COMUNES,
  NOMBRES_COMUNES,
  TILDES,
  TOKENS_AMBIGUOS,
} from './nombres-colombia';

/// Se pegan al apellido que sigue. `y`, `e` e `i` quedan fuera
/// a proposito: como conector de apellido casi no existen en
/// cedulas colombianas y daban resultados al reves.
const PARTICULAS = new Set([
  'de',
  'del',
  'la',
  'las',
  'lo',
  'los',
  'di',
  'da',
  'das',
  'do',
  'dos',
  'san',
  'santa',
  'santo',
  'mac',
  'mc',
  'van',
  'von',
  'der',
  'den',
  'le',
  "d'",
]);

export type NombrePartido = {
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
};

/** Qué tan confiable es el corte. */
export type ConfianzaNombre = 'OK' | 'POR_VALIDAR' | 'REVISAR_MANUAL';

/// En mayusculas para la tabla de tildes, que asi la guarda
/// el original.
const sinTildes = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/// Y en minusculas para los tres diccionarios de nombres, que
/// el original guarda al reves. Comparar en el caso equivocado
/// los deja vacios y todo el corte cae en la regla por defecto.
const clave = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const esNombre = (t: string) => NOMBRES_COMUNES.has(clave(t));
const esApellido = (t: string) => APELLIDOS_COMUNES.has(clave(t));
const esAmbiguo = (t: string) => TOKENS_AMBIGUOS.has(clave(t));

/// Las minusculas de las particulas se respetan: «de la Cruz»
/// no es «De La Cruz».
function comoNombrePropio(palabra: string): string {
  if (PARTICULAS.has(palabra.toLowerCase())) return palabra.toLowerCase();
  const con = TILDES[sinTildes(palabra)];
  const base = con ?? palabra;
  return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
}

/**
 * El nombre como lo escribiria una persona.
 *
 * El RUI lo devuelve en mayusculas y sin tildes. «JOSE
 * MARTINEZ» en una carta se lee mal; «José Martínez» no.
 */
export function conTildes(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).map(comoNombrePropio).join(' ');
}

/// Extiende un grupo hacia la izquierda mientras la palabra
/// anterior sea particula, sin invadir el primer nombre.
function grupo(palabras: string[], fin: number, minimo: number): number {
  let inicio = fin;
  while (
    inicio > minimo &&
    PARTICULAS.has(palabras[inicio - 1].toLowerCase())
  ) {
    inicio -= 1;
  }
  return inicio;
}

const VACIO: NombrePartido = {
  primerNombre: '',
  segundoNombre: '',
  primerApellido: '',
  segundoApellido: '',
};

export function partirNombre(completo: string): NombrePartido {
  if (!completo || completo === 'NO ENCONTRADO') return VACIO;

  const p = completo.split(/\s+/).filter(Boolean);
  const n = p.length;

  if (n === 0) return VACIO;
  if (n === 1) return { ...VACIO, primerNombre: p[0] };
  if (n === 2) return { ...VACIO, primerNombre: p[0], primerApellido: p[1] };

  const hayParticula = p.some((w) => PARTICULAS.has(w.toLowerCase()));

  // tres palabras sin particula: lo decide el diccionario
  if (n === 3 && !hayParticula) {
    const medio = p[1];
    if (esApellido(medio) && !esNombre(medio)) {
      return {
        primerNombre: p[0],
        segundoNombre: '',
        primerApellido: p[1],
        segundoApellido: p[2],
      };
    }
    if (esNombre(medio) && !esAmbiguo(medio)) {
      return {
        primerNombre: p[0],
        segundoNombre: p[1],
        primerApellido: p[2],
        segundoApellido: '',
      };
    }
    // la convencion colombiana: las dos ultimas son apellidos
    return {
      primerNombre: p[0],
      segundoNombre: '',
      primerApellido: p[1],
      segundoApellido: p[2],
    };
  }

  const inicio2 = grupo(p, n - 1, 1);
  const apellido2 = p.slice(inicio2, n).join(' ');

  if (inicio2 === 1) {
    // solo da para un nombre y un apellido
    return { ...VACIO, primerNombre: p[0], primerApellido: apellido2 };
  }

  const inicio1 = grupo(p, inicio2 - 1, 1);

  return {
    primerNombre: p[0],
    segundoNombre: inicio1 > 1 ? p.slice(1, inicio1).join(' ') : '',
    primerApellido: p.slice(inicio1, inicio2).join(' '),
    segundoApellido: apellido2,
  };
}

/**
 * Si el corte se puede dar por bueno.
 *
 * El portal entrega el nombre en una sola linea, sin decir
 * donde acaban los nombres. Esto no corrige nada: marca lo que
 * hay que mirar a mano.
 */
export function confianzaDelCorte(completo: string): ConfianzaNombre {
  if (!completo || completo === 'NO ENCONTRADO') return 'REVISAR_MANUAL';

  const p = completo.split(/\s+/).filter(Boolean);
  const n = p.length;

  if (n <= 1) return 'REVISAR_MANUAL';

  const hayParticula = p.some((w) => PARTICULAS.has(w.toLowerCase()));

  // dos palabras: si la segunda parece nombre, puede ser un
  // compuesto al que le falto el apellido
  if (n === 2) return esNombre(p[1]) ? 'POR_VALIDAR' : 'OK';

  // tres sin particula: solo lo genuinamente ambiguo
  if (n === 3 && !hayParticula) return esAmbiguo(p[1]) ? 'POR_VALIDAR' : 'OK';

  // cuatro o mas: la convencion acierta casi siempre. Se marca
  // cuando la tercera es un nombre conocido que no es apellido,
  // senal de un tercer nombre mal asignado (ANA MARIA LUISA GOMEZ)
  if (n >= 4 && !hayParticula) {
    return esNombre(p[2]) && !esApellido(p[2]) ? 'POR_VALIDAR' : 'OK';
  }

  // con particula el corte es claro: la particula ancla el apellido
  return 'OK';
}
