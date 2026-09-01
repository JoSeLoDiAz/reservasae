/** El tipo de documento, dicho como lo dice la gente. */

/**
 * El catálogo del SEP los identifica por número —1 es cédula, 61
 * es permiso por protección temporal— y esos números no los sabe
 * nadie fuera de aquí. Pedirle a un tercero que mande `1` es
 * pedirle que copie una tabla nuestra y la mantenga sincronizada:
 * el día que el SEP añada un tipo, su integración queda vieja y
 * nadie se entera.
 *
 * Así que se admite la SIGLA, que es como se llama de verdad:
 * `CC`, `PPT`, `CE`, `PASAPORTE`. Se compara sin puntos ni
 * espacios porque el catálogo las guarda como `C.C.` y `P.P.T`,
 * y nadie escribe los puntos.
 *
 * El número se sigue admitiendo: quien ya lo tenga no tiene por
 * qué cambiar.
 */

import { DOCUMENTOS_DE_PERSONA } from '../crm/catalogos-sep';

/// Sin puntos, espacios ni guiones, en mayúscula.
function aClave(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s.\-_]/g, '')
    .toUpperCase();
}

/// Como los nombra la gente -> como los nombra el catalogo.
///
/// Solo para los que NO salen de la sigla: `CEDULA` no se parece
/// a `C.C.` mirando letras, pero es lo que alguien va a escribir.
const TAMBIEN_SE_LLAMAN: Record<string, string> = {
  CEDULA: 'CC',
  CEDULADECIUDADANIA: 'CC',
  CEDULADEEXTRANJERIA: 'CE',
  PERMISOPORPROTECCIONTEMPORAL: 'PPT',
  PERMISOESPECIALDEPERMANENCIA: 'PEP',
  PASAPORTE: 'PASAPORTE',
};

/**
 * El id del SEP para ese tipo, o null.
 *
 * Acepta el número tal cual, la sigla con o sin puntos, y el
 * nombre entero. Devuelve null —y no un tipo por omisión— cuando
 * no lo reconoce: suponer «será cédula» le cambia el documento a
 * una persona, y el documento es su identidad en todo el sistema.
 */
export function tipoDeDocumento(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;

  /// El numero, si mandaron el numero.
  if (typeof valor === 'number' || /^\d+$/.test(String(valor).trim())) {
    const id = Number(valor);
    return DOCUMENTOS_DE_PERSONA.some((d) => d.id === id) ? id : null;
  }

  const clave = aClave(String(valor));
  if (!clave) return null;

  const buscada = TAMBIEN_SE_LLAMAN[clave] ?? clave;

  const hallado = DOCUMENTOS_DE_PERSONA.find(
    (d) => aClave(d.sigla ?? '') === buscada || aClave(d.etiqueta) === clave,
  );
  return hallado?.id ?? null;
}

/** Las siglas que se admiten, para poder decirlas en un error. */
export function siglasAdmitidas(): string[] {
  return DOCUMENTOS_DE_PERSONA.map((d) => aClave(d.sigla ?? d.etiqueta)).filter(
    Boolean,
  );
}
