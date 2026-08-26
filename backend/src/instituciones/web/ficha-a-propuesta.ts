/** De la ficha en texto a los campos de la institución. */

/// El buscador contesta en prosa: «Pequeña empresa», «Entre
/// 11 y 50 colaboradores», «3290 (Otras industrias
/// manufactureras n.c.p.)». La ficha guarda un enum, un
/// entero y un código. Aquí se traduce, y lo importante es
/// lo que NO se traduce.
///
/// Regla: si no está claro, no se propone. Un campo vacío se
/// llena después; un campo con un enum adivinado sale en el
/// F7 hacia el SENA y nadie vuelve a mirarlo. «Entre 11 y 50»
/// no es un número de empleados: es un rango, y la ficha
/// pide un número. Se deja vacío.

import type { FichaWeb } from './leer-ficha-web';

/// Lo que se le va a proponer al asesor: campo → valor, en
/// tipos que aguanten un JSON.
export type CamposPropuestos = Record<string, string | number>;

/// Lo que ya está guardado, para no proponer lo que no cambia.
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

/// Las razones sociales van en mayúscula, igual que en el
/// cargue por plantilla: en el NIT, en el RUES y en el F7 así
/// viven, y son documentos legales.
const EN_MAYUSCULAS = new Set([
  'razonSocial',
  'nombreComercial',
  'sectorEconomico',
]);

const sinTildes = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/// El orden manda: «Persona jurídica - Entidad sin ánimo de
/// lucro (ESAL)» lleva la palabra «entidad», y otras frases
/// parecidas llevan «privada». Gana la primera que case, y
/// por eso las específicas van arriba.
const CLASIFICACIONES: Array<[RegExp, string]> = [
  [/empresa asociativa de trabajo/, 'EMPRESA_ASOCIATIVA_DE_TRABAJO'],
  [/centro de desarrollo tecnologico/, 'CENTRO_DESARROLLO_TECNOLOGICO'],
  [/sin animo de lucro|\besal\b/, 'ENTIDAD_SIN_ANIMO_DE_LUCRO'],
  [/economia solidaria/, 'ENTIDAD_ECONOMIA_SOLIDARIA'],
  [/entidad territorial/, 'ENTIDAD_TERRITORIAL'],
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
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/// Palabras que convierten un número en una estimación. La
/// ficha guarda un entero, no «más de 2.000».
const NO_ES_UN_NUMERO =
  /\bentre\b|\bmas de\b|\bmenos de\b|\bhasta\b|\bcerca de\b|\baprox|\balrededor\b|\bo mas\b|\+/;

export function fichaAPropuesta(
  ficha: FichaWeb,
  actual: InstitucionActual = {},
): CamposPropuestos {
  const propuesta: CamposPropuestos = {};

  const poner = (
    campo: keyof InstitucionActual,
    valor: string | number | null,
  ) => {
    if (valor === null || valor === '') return;
    if (igualALoGuardado(valor, actual[campo])) return;
    propuesta[campo] = valor;
  };

  poner('razonSocial', texto('razonSocial', ficha.razonSocial));
  poner('nombreComercial', texto('nombreComercial', ficha.nombreComercial));
  poner('fechaFundacion', leerFecha(ficha.fechaFundacion));
  poner('direccion', texto('direccion', ficha.direccion));
  poner('telefono', texto('telefono', ficha.telefono));
  poner('correo', leerCorreo(ficha.correo));
  poner('paginaWeb', leerPaginaWeb(ficha.paginaWeb));
  poner('ciudadNombre', leerLugar(ficha.ciudadNombre));
  poner('departamentoNombre', leerLugar(ficha.departamentoNombre));
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

/// Se compara sin tildes ni mayúsculas: proponerle a alguien
/// que cambie «Bogotá D.C.» por «BOGOTA D.C.» es hacerle
/// perder el tiempo, y le enseña a darle a aceptar sin leer.
function igualALoGuardado(nuevo: string | number, guardado: unknown): boolean {
  if (guardado === null || guardado === undefined) return false;

  if (typeof nuevo === 'number') return Number(guardado) === nuevo;

  if (guardado instanceof Date) {
    // la fecha propuesta viene como aaaa-mm-dd
    return guardado.toISOString().slice(0, 10) === nuevo;
  }

  /// Cualquier otra cosa que no sea texto se propone.
  ///
  /// Si lo guardado no es ni fecha ni número ni cadena, no
  /// hay con qué compararlo: se deja que la propuesta salga y
  /// que la mire una persona, que es lo seguro.
  if (typeof guardado !== 'string') return false;

  return sinTildes(guardado) === sinTildes(nuevo);
}

/**
 * «17 de enero de 1972» → «1972-01-17».
 *
 * Se devuelve la fecha sola, sin hora: quien la aplique
 * decide la zona horaria. Ponerle aquí una hora en UTC
 * correría todas las fundaciones un día hacia atrás en
 * Colombia, que va cinco horas detrás.
 */
export function leerFecha(v: string | null): string | null {
  if (!v) return null;
  const t = sinTildes(v);

  // 17 de enero de 1972
  const enLetras = t.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (enLetras) {
    const mes = MESES.indexOf(enLetras[2]);
    if (mes >= 0) return armar(enLetras[3], mes + 1, enLetras[1]);
  }

  // 1972-01-17
  const iso = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return armar(iso[1], Number(iso[2]), iso[3]);

  // 17/01/1972 -- día primero, como se escribe en Colombia
  const barras = t.match(/(\d{1,2})[/](\d{1,2})[/](\d{4})/);
  if (barras) return armar(barras[3], Number(barras[2]), barras[1]);

  // «enero de 1972», o solo «1972»: no alcanza para una fecha
  return null;
}

function armar(anio: string, mes: number, dia: string): string | null {
  const d = Number(dia);
  if (mes < 1 || mes > 12 || d < 1 || d > 31) return null;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function leerCorreo(v: string | null): string | null {
  if (!v) return null;
  // la IA a veces trae dos, separados por coma o barra
  const uno = v
    .split(/[,;/\s]+/)
    .find((t) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t));
  return uno ? uno.toLowerCase().replace(/[.,;]+$/, '') : null;
}

function leerPaginaWeb(v: string | null): string | null {
  if (!v) return null;
  const t = v
    .split(/[,;\s]+/)[0]
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .trim();
  // sin un punto no es un dominio, es una frase
  return t.includes('.') ? t.toLowerCase() : null;
}

/// Ciudad y departamento se guardan como los escribe la
/// gente, pero sin el paréntesis con el que la IA aclara
/// cosas: «Medellín (Antioquia)» es la ciudad Medellín.
function leerLugar(v: string | null): string | null {
  if (!v) return null;
  const t = v.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return t || null;
}

export function leerCiiu(v: string | null): string | null {
  if (!v) return null;
  /// «3290 (Otras industrias manufactureras n.c.p.)» → 3290,
  /// y «G4711» → 4711: la letra de la sección va pegada al
  /// código, y ahí no hay frontera de palabra que valga.
  const m = v.match(/(?<!\d)(\d{4})(?!\d)/);
  return m ? m[1] : null;
}

export function leerEmpleados(v: string | null): number | null {
  if (!v) return null;
  const t = sinTildes(v);

  /// Un rango no es un número.
  ///
  /// «Entre 11 y 50 colaboradores» y «Más de 2.000 empleados
  /// directos» son las dos respuestas reales que dio el
  /// buscador, y ninguna de las dos dice cuántos empleados
  /// tiene la empresa. Guardar 11, o 50, o 2000, sería
  /// inventarse el dato.
  if (NO_ES_UN_NUMERO.test(t)) return null;

  const numeros = t.match(/\d[\d.,]*/g);
  if (!numeros || numeros.length !== 1) return null;

  const n = Number(numeros[0].replace(/[.,]/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n > 5_000_000) return null;
  return n;
}

function porTabla(
  v: string | null,
  tabla: Array<[RegExp, string]>,
): string | null {
  if (!v) return null;
  const t = sinTildes(v);
  for (const [patron, valor] of tabla) {
    if (patron.test(t)) return valor;
  }
  // el buscador contestó otra cosa: no se fuerza
  return null;
}
