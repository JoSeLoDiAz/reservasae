/** De la ficha en texto a los campos de la institución. */

/// El buscador contesta en prosa. Aquí se traduce a los tipos de la
/// ficha, y lo importante es lo que NO se traduce: si no está claro,
/// no se propone. Mejoras de este port frente al original:
///   - Correo: solo si el dominio coincide (por núcleo) con la web.
///   - Número de empleados: descarta un año suelto entre paréntesis.
///   - Departamento: DERIVADO de la ciudad (tabla oficial), no de la IA.
///   - Sector -> CIIU sugerido, con validación cruzada sector<->CIIU.

import type { FichaWeb } from './leer-ficha-web';

export type CamposPropuestos = Record<string, string | number>;

export type InstitucionActual = {
  razonSocial?: string | null;
  nombreComercial?: string | null;
  fechaFundacion?: Date | string | null;
  direccion?: string | null;
  telefono?: string | null;
  correo?: string | null;
  paginaWeb?: string | null;
  ciudadNombre?: string | null;
  departamentoNombre?: string | null;
  sectorEconomico?: string | null;
  codigoCiiu?: string | null;
  clasificacion?: string | null;
  tamano?: string | null;
  numeroEmpleados?: number | null;
};

const EN_MAYUSCULAS = new Set(['razonSocial', 'nombreComercial', 'sectorEconomico']);

const sinTildes = (t: string): string =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const CLASIFICACIONES: Array<[RegExp, string]> = [
  [/empresa asociativa de trabajo/, 'EMPRESA_ASOCIATIVA_DE_TRABAJO'],
  [/centro de desarrollo tecnologico/, 'CENTRO_DESARROLLO_TECNOLOGICO'],
  [/sin animo de lucro|\besal\b/, 'ENTIDAD_SIN_ANIMO_DE_LUCRO'],
  [/economia solidaria/, 'ENTIDAD_ECONOMIA_SOLIDARIA'],
  [/entidad territorial|alcaldia|gobernacion|municipio de|\bdistrito\b/, 'ENTIDAD_TERRITORIAL'],
  [/economia mixta|\bmixta\b/, 'MIXTA'],
  [/empresa publica|entidad publica/, 'EMPRESA_PUBLICA'],
  [/\bgremio\b|agremiacion/, 'GREMIO'],
  [/\basociacion\b/, 'ASOCIACION'],
  [/empresa privada|\bprivada\b/, 'EMPRESA_PRIVADA'],
];

const TAMANOS: Array<[RegExp, string]> = [
  [/microempresa|\bmicro\b/, 'MICROEMPRESA'],
  [/pequena|\bpyme\b/, 'PEQUENA'],
  [/mediana/, 'MEDIANA'],
  [/grande|gran empresa/, 'GRANDE'],
];

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const NO_ES_UN_NUMERO =
  /\bentre\b|\bmas de\b|\bmenos de\b|\bhasta\b|\bcerca de\b|\baprox|\balrededor\b|\bo mas\b|\+/;

/// Prefijos de correo que consideramos institucionales (no personales).
const PREFIJOS_INSTITUCIONALES = new Set([
  'info', 'contacto', 'contactenos', 'servicioalcliente', 'servicio',
  'servicios', 'atencionalcliente', 'atencion', 'ventas', 'comercial',
  'notificaciones', 'notificacionesjudiciales', 'pqr', 'pqrs', 'gerencia',
  'administracion', 'recepcion', 'secretaria',
]);

/// Ciudad -> Departamento oficial. Arranque con las principales; en
/// producción reemplazar/derivar del catálogo DANE (SEP ids de la ficha).
export const DEPARTAMENTO_POR_CIUDAD: Record<string, string> = {
  bogota: 'Bogotá D.C.', medellin: 'Antioquia', cali: 'Valle del Cauca',
  barranquilla: 'Atlántico', cartagena: 'Bolívar', cucuta: 'Norte de Santander',
  bucaramanga: 'Santander', pereira: 'Risaralda', 'santa marta': 'Magdalena',
  ibague: 'Tolima', manizales: 'Caldas', villavicencio: 'Meta', pasto: 'Nariño',
  monteria: 'Córdoba', neiva: 'Huila', armenia: 'Quindío', popayan: 'Cauca',
  sincelejo: 'Sucre', valledupar: 'Cesar', tunja: 'Boyacá', riohacha: 'La Guajira',
  florencia: 'Caquetá', yopal: 'Casanare', quibdo: 'Chocó', soacha: 'Cundinamarca',
  soledad: 'Atlántico', bello: 'Antioquia', itagui: 'Antioquia',
  envigado: 'Antioquia', palmira: 'Valle del Cauca', buenaventura: 'Valle del Cauca',
  floridablanca: 'Santander',
};

/// Sector (desplegable de 3) -> CIIU genérico de la familia. Es un valor
/// APROXIMADO (un sector cubre muchos CIIU): siempre se marca para revisar.
export const SECTOR_A_CIIU: Record<string, { ciiu: string; nombre: string }> = {
  comercio: { ciiu: '4719', nombre: 'Comercio al por menor en establecimientos no especializados' },
  servicios: { ciiu: '9609', nombre: 'Otras actividades de servicios personales n.c.p.' },
  manufactura: { ciiu: '3290', nombre: 'Otras industrias manufactureras n.c.p.' },
};

export function ciiuPorSector(sector: string | null | undefined): { ciiu: string; nombre: string } | null {
  if (!sector) return null;
  return SECTOR_A_CIIU[sinTildes(sector)] ?? null;
}

/// ¿El CIIU pertenece al sector declarado? true/false, o null si no hay
/// con qué juzgar. Secciones CIIU Rev.4: Manufactura 10–33, Comercio 45–47,
/// Servicios = terciario restante.
export function ciiuCuadraConSector(
  ciiu: string | null | undefined,
  sector: string | null | undefined,
): boolean | null {
  if (!ciiu || !sector || ciiu.length < 2 || !/^\d{2}/.test(ciiu)) return null;
  const div = Number(ciiu.slice(0, 2));
  const s = sinTildes(sector);
  if (s === 'manufactura') return div >= 10 && div <= 33;
  if (s === 'comercio') return div >= 45 && div <= 47;
  if (s === 'servicios')
    return !(div >= 1 && div <= 9) && !(div >= 10 && div <= 33) && !(div >= 45 && div <= 47);
  return null;
}

export function fichaAPropuesta(
  ficha: FichaWeb,
  actual: InstitucionActual = {},
): CamposPropuestos {
  const propuesta: CamposPropuestos = {};
  const web = leerPaginaWeb(ficha.paginaWeb);

  const poner = (campo: keyof InstitucionActual, valor: string | number | null) => {
    if (valor === null || valor === '') return;
    if (igualALoGuardado(valor, actual[campo])) return;
    propuesta[campo] = valor;
  };

  poner('razonSocial', texto('razonSocial', ficha.razonSocial));
  poner('nombreComercial', texto('nombreComercial', ficha.nombreComercial));
  poner('fechaFundacion', leerFecha(ficha.fechaFundacion));
  poner('direccion', texto('direccion', ficha.direccion));
  poner('telefono', texto('telefono', ficha.telefono));
  poner('correo', leerCorreo(ficha.correo, web));
  poner('paginaWeb', web);
  poner('ciudadNombre', leerLugar(ficha.ciudadNombre));
  // Departamento DERIVADO de la ciudad; si la ciudad no está en la tabla,
  // se cae al que trajo la IA.
  poner(
    'departamentoNombre',
    derivarDepartamento(ficha.ciudadNombre) ?? leerLugar(ficha.departamentoNombre),
  );
  poner('sectorEconomico', texto('sectorEconomico', ficha.sectorEconomico));
  poner('codigoCiiu', leerCiiu(ficha.codigoCiiu));
  poner('clasificacion', porTabla(ficha.clasificacion, CLASIFICACIONES));
  poner('tamano', porTabla(ficha.tamano, TAMANOS));
  poner('numeroEmpleados', leerEmpleados(ficha.numeroEmpleados));

  return propuesta;
}

function texto(campo: string, v: string | null): string | null {
  if (!v) return null;
  const limpio = v.trim();
  if (!limpio) return null;
  return EN_MAYUSCULAS.has(campo) ? limpio.toUpperCase() : limpio;
}

function igualALoGuardado(nuevo: string | number, guardado: unknown): boolean {
  if (guardado === null || guardado === undefined) return false;
  if (typeof nuevo === 'number') return Number(guardado) === nuevo;
  if (guardado instanceof Date) return guardado.toISOString().slice(0, 10) === nuevo;
  if (typeof guardado !== 'string') return false;
  return sinTildes(guardado) === sinTildes(nuevo);
}

export function leerFecha(v: string | null): string | null {
  if (!v) return null;
  const t = sinTildes(v);

  const enLetras = t.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (enLetras) {
    const mes = MESES.indexOf(enLetras[2]);
    if (mes >= 0) return armar(enLetras[3], mes + 1, enLetras[1]);
  }
  const iso = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return armar(iso[1], Number(iso[2]), iso[3]);

  const separado = t.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (separado) return armar(separado[3], Number(separado[2]), separado[1]);

  return null;
}

function armar(anio: string, mes: number, dia: string): string | null {
  const d = Number(dia);
  if (mes < 1 || mes > 12 || d < 1 || d > 31) return null;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/// El núcleo del dominio, ignorando www y sufijos (.com, .co, .gov…):
/// «comfenalcoantioquia.com.co» y «comfenalcoantioquia.com» -> mismo núcleo.
function dominioNucleo(dominio: string): string {
  const tld = new Set(['com', 'co', 'gov', 'edu', 'org', 'net', 'mil', 'info', 'biz']);
  const partes = dominio.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
  const sig = partes.filter((p) => !tld.has(p));
  return sig.length ? sig[sig.length - 1] : partes[0] ?? '';
}

export function leerCorreo(v: string | null, dominioWeb?: string | null): string | null {
  if (!v) return null;
  const uno = v.split(/[,;/\s]+/).find((t) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t));
  if (!uno) return null;
  const correo = uno.toLowerCase().replace(/[.,;]+$/, '');
  const [prefijo, dominio] = correo.split('@');

  if (dominioWeb) {
    // Con web para contrastar: el dominio del correo debe cuadrar (por núcleo).
    return dominioNucleo(dominio) === dominioNucleo(dominioWeb) ? correo : null;
  }
  // Sin web: solo aceptamos correos claramente institucionales.
  return PREFIJOS_INSTITUCIONALES.has(prefijo.split('.')[0]) ? correo : null;
}

export function leerPaginaWeb(v: string | null): string | null {
  if (!v) return null;
  const t = v
    .split(/[,;\s]+/)[0]
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .trim();
  return t.includes('.') ? t.toLowerCase() : null;
}

function leerLugar(v: string | null): string | null {
  if (!v) return null;
  const t = v.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return t || null;
}

/// Departamento oficial a partir de la ciudad. null si la ciudad no está
/// en la tabla (entonces fichaAPropuesta usa el de la IA).
export function derivarDepartamento(ciudad: string | null | undefined): string | null {
  if (!ciudad) return null;
  let clave = sinTildes(ciudad).replace(/\b(d\.?c\.?|distrito capital)\b/g, '');
  clave = clave.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  return DEPARTAMENTO_POR_CIUDAD[clave] ?? null;
}

export function leerCiiu(v: string | null): string | null {
  if (!v) return null;
  const m = v.match(/(?<!\d)(\d{4})(?!\d)/);
  return m ? m[1] : null;
}

export function leerEmpleados(v: string | null): number | null {
  if (!v) return null;
  const t = sinTildes(v);
  if (NO_ES_UN_NUMERO.test(t)) return null;

  const numeros = t.match(/\d[\d.,]*/g);
  if (!numeros) return null;
  // Descarta un año suelto entre paréntesis: «6.265 (a año 2026)» -> 6265.
  const limpios = numeros.filter((n) => !/^(19|20)\d{2}$/.test(n.replace(/[.,]/g, '')));
  if (limpios.length !== 1) return null;

  const n = Number(limpios[0].replace(/[.,]/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n > 5_000_000) return null;
  return n;
}

function porTabla(v: string | null, tabla: Array<[RegExp, string]>): string | null {
  if (!v) return null;
  const t = sinTildes(v);
  for (const [patron, valor] of tabla) {
    if (patron.test(t)) return valor;
  }
  return null;
}
