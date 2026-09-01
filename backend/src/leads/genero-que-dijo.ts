/** Del género que escribió, al id del SEP. */

/**
 * Igual que con el tipo de documento: quien integra manda lo que
 * la persona eligió en su desplegable —«Masculino», «F»,
 * «Femenino»— y no un número de nuestro catálogo. Pedirle el id
 * es garantizar que mande el equivocado, y un id equivocado no
 * falla: se guarda y sale mal en el reporte al SENA.
 *
 * Devuelve null cuando no lo reconoce, nunca un valor por
 * defecto. Suponer el género de alguien es peor que dejarlo
 * vacío: vacío se puede preguntar, supuesto ya no.
 */

import { GENEROS_SEP } from '../crm/catalogos-sep.generado';

/// Lo que suele venir escrito, apuntando a la etiqueta del SEP.
const ALIAS: Record<string, string> = {
  m: 'masculino',
  h: 'masculino',
  hombre: 'masculino',
  male: 'masculino',
  f: 'femenino',
  mujer: 'femenino',
  female: 'femenino',
};

function limpiar(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function generoQueDijo(valor?: string | number | null): number | null {
  if (valor === null || valor === undefined) return null;
  const texto = `${valor}`.trim();
  if (!texto) return null;

  /// Un numero es el id del SEP, para quien lo conozca.
  if (/^\d+$/.test(texto)) {
    return GENEROS_SEP.some((g) => g.id === Number(texto)) ? Number(texto) : null;
  }

  const buscado = ALIAS[limpiar(texto)] ?? limpiar(texto);
  return GENEROS_SEP.find((g) => limpiar(g.etiqueta) === buscado)?.id ?? null;
}
