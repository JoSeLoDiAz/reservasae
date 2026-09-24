/** Los formularios públicos que no son el general. */

/**
 * Un formulario personalizado es EL MISMO trámite público con una
 * puerta propia: se llega por una palabra suelta en el enlace
 * --`?TallerBootcamp`-- y esa palabra decide qué se ofrece detrás.
 *
 * Existe por un encargo concreto (Mauricio, 23 sep 2026): hay
 * acciones que NO se ofertan al público --la AF6 de ADECOPRIA, el
 * taller-bootcamp-- y que aun así tienen que poder llenarse por
 * internet, para un grupo que se convoca aparte. Eso hoy no se
 * podía: una acción oculta está cerrada con DOS candados --el
 * catálogo y el registro-- y los dos son deliberados. El segundo
 * es el que de verdad cierra, porque el primero solo tapa la
 * pantalla.
 *
 * La palabra es la llave de esos dos candados Y SOLO PARA SU
 * ACCIÓN: nada de aquí abre una acción que no esté nombrada en
 * esta lista, y una palabra de un gremio no vale en el otro.
 *
 * Va en el código y no en la base a propósito. Son dos, los
 * escribe quien despliega, y lo que un formulario decide --qué
 * acción oculta queda habilitada-- es justo lo que no debería
 * poder cambiarse desde una pantalla del panel. El día que sean
 * quince, se mueve.
 */
export type FormularioPersonalizado = {
  /// Como se escribe en el enlace, TAL CUAL. Se compara sin
  /// distinguir mayúsculas --nadie copia un enlace a mano sin
  /// equivocarse-- pero se guarda así para poder enseñarlo.
  palabra: string;

  /// De qué gremio es. El slug del convenio.
  convenio: string;

  /// El código de la ÚNICA acción que abre, oculta o no.
  ///
  /// Null en los que no abren ninguna: el general con logo
  /// ofrece lo mismo de siempre y solo cambia la marca.
  accion: string | null;

  /// Cómo se llama en el panel, y qué es.
  titulo: string;
  descripcion: string;

  /// El tercero que acompaña la convocatoria, si lo hay.
  ///
  /// Sale en la banda de arriba del formulario público, detrás de
  /// «EN ALIANZA CON», junto a los logos del gremio. Va AQUÍ y no
  /// en la marca del gremio a propósito: la marca es de quien
  /// convoca y sale en TODOS sus formularios; esto acompaña a UNO
  /// solo, y meterlo en la marca lo pondría también en el general.
  ///
  /// El archivo vive en `frontend/public/logos/`. El middleware
  /// deja pasar esa carpeta aunque el panel esté cerrado, o por un
  /// túnel el logo saldría roto.
  aliado?: { nombre: string; logo: string };
};

/**
 * Los que hay. En orden de creación.
 */
const FORMULARIOS: readonly FormularioPersonalizado[] = [
  {
    palabra: 'TallerBootcamp',
    convenio: 'adecopria',
    accion: 'AF6',
    titulo: 'Taller-Bootcamp',
    descripcion:
      'Abre la AF6 —Fábrica de Soluciones Digitales— sin publicarla. ' +
      'Es la única que ofrece, y viene ya elegida.',
  },
  {
    palabra: 'Afiliados',
    convenio: 'adecopria',
    accion: 'AF6',
    titulo: 'Afiliados · Fábrica de Soluciones Digitales',
    descripcion:
      'Para los afiliados que entregaron carta. Abre la AF6 sin ' +
      'publicarla y no ofrece ninguna otra: no es una campaña, es ' +
      'el enlace que se le pasa a quien ya tiene el cupo acordado.',
  },
  {
    palabra: 'Santillana',
    convenio: 'adecopria',
    /// Ninguna: ofrece lo mismo que el general. Lo único que
    /// cambia es la banda de arriba (Mauricio, 23 sep 2026).
    accion: null,
    titulo: 'Santillana',
    descripcion:
      'El formulario general, con Santillana en la banda de arriba. ' +
      'Ofrece las mismas acciones publicadas que el de siempre.',
    aliado: { nombre: 'Santillana', logo: '/logos/santillana.png' },
  },
];

/// Lo que puede ser una palabra de formulario, y nada más.
///
/// Empieza por letra y no admite punto ni guion bajo: así NUNCA
/// puede confundirse con el enlace corto (`mailing18092026`), que
/// obliga a prefijo de canal y sí los admite. Hay un spec que ata
/// las dos reglas, porque la misma palabra haciendo dos cosas
/// distintas es de las que no se ven hasta que se cuenta mal la
/// pauta.
const PATRON = /^[A-Za-z][A-Za-z0-9-]{2,39}$/;

/**
 * El formulario de esa palabra en ese gremio, o null.
 *
 * Null es la respuesta normal: la inmensa mayoría de las visitas
 * llegan sin palabra, o con `?fbclid=...`, o con el enlace corto
 * del mailing. Ninguna de esas es un formulario personalizado.
 */
export function formularioPersonalizado(
  palabra: string | undefined | null,
  convenio: string,
): FormularioPersonalizado | null {
  if (!palabra) return null;
  const limpia = palabra.trim();
  if (!PATRON.test(limpia)) return null;

  const buscada = limpia.toLowerCase();
  return (
    FORMULARIOS.find(
      (f) => f.palabra.toLowerCase() === buscada && f.convenio === convenio,
    ) ?? null
  );
}

/** Los de un gremio, para enseñarlos en el panel. */
export function formulariosDelConvenio(
  convenio: string,
): FormularioPersonalizado[] {
  return FORMULARIOS.filter((f) => f.convenio === convenio);
}

/** Todos, para el spec y para el panel cuando no hay gremio. */
export function todosLosFormularios(): readonly FormularioPersonalizado[] {
  return FORMULARIOS;
}
