/** De la respuesta del buscador web a los catorce campos. */

/// La respuesta viene en prosa y el corte NO se hace por saltos de
/// línea, sino por ETIQUETAS: se buscan todas, se ordenan por dónde
/// aparecen, y cada valor es lo que hay entre una y la siguiente.
/// Mejora de este port: cada valor se corta además en el primer salto
/// de línea, porque cuando la respuesta viene una línea por campo, lo
/// que sigue al salto son las CITAS que el buscador pega debajo
/// («Veritrade», «+8», «RUES»…). En las respuestas «todo pegado» no
/// hay salto y el corte no estorba.

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

const ETIQUETAS: Array<{ clave: keyof FichaWeb; nombres: string[] }> = [
  { clave: 'razonSocial', nombres: ['Razón social', 'Razon social'] },
  { clave: 'nombreComercial', nombres: ['Nombre comercial'] },
  {
    clave: 'fechaFundacion',
    nombres: ['Fecha de fundación', 'Fecha de fundacion', 'Fecha de constitución'],
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

const sinTildes = (t: string): string =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const REMATES = [
  'si requieres',
  'si necesitas',
  'te sugiero',
  '¿hay alguna',
  'hay alguna otra',
  'espero que',
  'nota:',
  'la ia puede cometer errores',
  'mostrar todo',
];

export function leerFichaWeb(texto: string): FichaWeb {
  if (!texto?.trim()) return { ...VACIA };

  const plano = sinTildes(texto);
  const marcas: Array<{ clave: keyof FichaWeb; desde: number; hasta: number }> = [];

  for (const { clave, nombres } of ETIQUETAS) {
    for (const nombre of nombres) {
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
  // El valor termina en el primer salto de línea: lo que sigue son las
  // citas que el buscador pega debajo. En «todo pegado» no hay salto.
  let v = bruto.split('\n')[0];

  const plano = sinTildes(v);
  for (const r of REMATES) {
    const i = plano.indexOf(sinTildes(r));
    if (i > 0) v = v.slice(0, i);
  }

  const emoji = v.search(/\p{Extended_Pictographic}/u);
  if (emoji > 0) v = v.slice(0, emoji);

  v = v
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/[*•·▪]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:]+$/, '')
    .trim();

  if (!v) return null;
  if (NO_SABE.includes(sinTildes(v))) return null;
  if (v.length > 200) return null;

  return v;
}

/** Cuántos de los catorce trajo. */
export function cuantosTrajo(f: FichaWeb): number {
  return Object.values(f).filter((v) => v !== null).length;
}
