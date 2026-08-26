/** De la respuesta del buscador web a los catorce campos. */

/// La respuesta viene en prosa, y el corte NO se puede hacer
/// por saltos de línea.
///
/// Esta es la trampa, y sale de las respuestas de verdad:
///
///     Razón social: ABC LABORATORIOS S.A.S.Nombre comercial: ABC Laboratorios
///
/// El valor de un campo termina justo donde empieza la
/// etiqueta del siguiente, sin espacio ni salto. Partir por
/// «\n» deja «ABC LABORATORIOS S.A.S.Nombre comercial: ABC
/// Laboratorios» como razón social entera.
///
/// Por eso se corta por las ETIQUETAS: se buscan todas, se
/// ordenan por dónde aparecen, y cada valor es lo que hay
/// entre una y la siguiente. Y de paso aguanta que la
/// respuesta traiga títulos con emoji, viñetas o negrita en
/// medio: nada de eso es una etiqueta.

export type FichaWeb = {
  razonSocial: string | null;
  nombreComercial: string | null;
  fechaFundacion: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  paginaWeb: string | null;
  ciudadNombre: string | null;
  departamentoNombre: string | null;
  sectorEconomico: string | null;
  codigoCiiu: string | null;
  clasificacion: string | null;
  tamano: string | null;
  numeroEmpleados: string | null;
};

/// Las catorce, con las formas en que las escribe la IA.
/// La primera de cada lista es la que se le pide.
const ETIQUETAS: Array<{ clave: keyof FichaWeb; nombres: string[] }> = [
  { clave: 'razonSocial', nombres: ['Razón social', 'Razon social'] },
  { clave: 'nombreComercial', nombres: ['Nombre comercial'] },
  {
    clave: 'fechaFundacion',
    nombres: [
      'Fecha de fundación',
      'Fecha de fundacion',
      'Fecha de constitución',
    ],
  },
  { clave: 'direccion', nombres: ['Dirección', 'Direccion'] },
  { clave: 'telefono', nombres: ['Teléfono', 'Telefono', 'Teléfonos'] },
  { clave: 'correo', nombres: ['Correo', 'Correo electrónico', 'Email'] },
  { clave: 'paginaWeb', nombres: ['Página web', 'Pagina web', 'Sitio web'] },
  { clave: 'ciudadNombre', nombres: ['Ciudad', 'Municipio'] },
  { clave: 'departamentoNombre', nombres: ['Departamento'] },
  {
    clave: 'sectorEconomico',
    nombres: ['Sector económico', 'Sector economico', 'Sector'],
  },
  { clave: 'codigoCiiu', nombres: ['Código CIIU', 'Codigo CIIU', 'CIIU'] },
  { clave: 'clasificacion', nombres: ['Clasificación', 'Clasificacion'] },
  { clave: 'tamano', nombres: ['Tamaño', 'Tamano'] },
  {
    clave: 'numeroEmpleados',
    nombres: ['Número de empleados', 'Numero de empleados', 'Empleados'],
  },
];

const VACIA: FichaWeb = {
  razonSocial: null,
  nombreComercial: null,
  fechaFundacion: null,
  direccion: null,
  telefono: null,
  correo: null,
  paginaWeb: null,
  ciudadNombre: null,
  departamentoNombre: null,
  sectorEconomico: null,
  codigoCiiu: null,
  clasificacion: null,
  tamano: null,
  numeroEmpleados: null,
};

/// Lo que la IA contesta cuando no sabe. No es un dato.
const NO_SABE = [
  'no disponible',
  'no se encontro',
  'no se encontró',
  'no registra',
  'no reportado',
  'no especificado',
  'sin informacion',
  'sin información',
  'no aplica',
  'desconocido',
  'n/a',
  '-',
  '—',
];

const sinTildes = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/// El cierre de una frase que la IA a veces pega al final,
/// del tipo «Si requieres una copia actualizada...». Corta el
/// último valor para que no se lleve el párrafo entero.
const REMATES = [
  'si requieres',
  'si necesitas',
  'te sugiero',
  '¿hay alguna',
  'hay alguna otra',
  'espero que',
  'nota:',
  // el pie del buscador, seguido de las fuentes que citó:
  // sin esto el último campo se lleva media página pegada
  'la ia puede cometer errores',
  'mostrar todo',
];

export function leerFichaWeb(texto: string): FichaWeb {
  if (!texto?.trim()) return { ...VACIA };

  /// Dónde empieza cada etiqueta.
  ///
  /// Se busca sobre el texto SIN tildes y en minúscula, pero
  /// se corta sobre el original: así «Razón social» encuentra
  /// «Razon social» sin perder los acentos del valor.
  const plano = sinTildes(texto);
  const marcas: Array<{ clave: keyof FichaWeb; desde: number; hasta: number }> =
    [];

  for (const { clave, nombres } of ETIQUETAS) {
    for (const nombre of nombres) {
      // la etiqueta va seguida de dos puntos, con o sin espacio
      const patron = new RegExp(sinTildes(nombre) + '\\s*:', 'g');
      const m = patron.exec(plano);
      if (m) {
        marcas.push({ clave, desde: m.index, hasta: m.index + m[0].length });
        break;
      }
    }
  }

  if (marcas.length === 0) return { ...VACIA };

  marcas.sort((a, b) => a.desde - b.desde);

  const ficha = { ...VACIA };

  for (let i = 0; i < marcas.length; i += 1) {
    const fin = i + 1 < marcas.length ? marcas[i + 1].desde : texto.length;
    ficha[marcas[i].clave] = limpiar(texto.slice(marcas[i].hasta, fin));
  }

  return ficha;
}

function limpiar(bruto: string): string | null {
  let v = bruto;

  // el remate de cortesía no es parte del último dato
  const plano = sinTildes(v);
  for (const r of REMATES) {
    const i = plano.indexOf(sinTildes(r));
    if (i > 0) v = v.slice(0, i);
  }

  /// Un emoji corta el valor, no se limpia.
  ///
  /// La IA separa las secciones con títulos que empiezan por
  /// emoji: «…abclaboratorios.com📊 Clasificación y Actividad
  /// Económica». Ese título no lleva dos puntos, así que no
  /// es una etiqueta y no marca corte -- pero el valor
  /// terminó justo antes. Quitar solo el emoji dejaba
  /// «abclaboratorios.com Clasificación y Actividad
  /// Económica» como página web.
  const emoji = v.search(/\p{Extended_Pictographic}/u);
  if (emoji > 0) v = v.slice(0, emoji);

  v = v
    // por si quedó alguno al principio
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    // viñetas, negritas y comillas de adorno
    .replace(/[*•·▪]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // puntuación suelta al final
    .replace(/[.,;:]+$/, '')
    .trim();

  if (!v) return null;
  if (NO_SABE.includes(sinTildes(v))) return null;
  // un valor de doscientos caracteres no es un dato, es prosa
  if (v.length > 200) return null;

  return v;
}

/** Cuántos de los catorce trajo. */
export function cuantosTrajo(f: FichaWeb): number {
  return Object.values(f).filter((v) => v !== null).length;
}
