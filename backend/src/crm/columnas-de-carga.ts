/** Qué columna es cada cual en una lista importada, y qué dice cada celda. */

/**
 * POR EL ENCABEZADO Y NO POR LA POSICIÓN.
 *
 * La importación leía ocho columnas en un orden fijo. La plantilla que
 * llenan las organizaciones ahora trae diecinueve --todo lo que pide el
 * formulario de una persona-- y el cliente pidió que la acción de
 * formación, el departamento y la ciudad fueran las primeras (22 sep
 * 2026). Con posiciones fijas, mover una columna corría todas las demás:
 * la fecha de nacimiento entraba donde se esperaba el correo.
 *
 * Aquí cada columna se reconoce por su título, sin tildes ni mayúsculas,
 * así que da igual el orden y da igual que alguien reescriba «Teléfono
 * celular» como «Celular». Lo que se pega a mano SIN encabezado sigue
 * leyéndose en el orden viejo (ver `ORDEN_ANTIGUO`).
 */

import { EDAD_MINIMA, edadCumplida } from './catalogos-sep';
import {
  DEPARTAMENTOS_SEP,
  GENERO_NO_BINARIO,
  GENEROS_SEP,
  MUNICIPIOS_SEP,
  NIVELES_OCUPACIONALES_SEP,
} from './catalogos-sep';

/** Cada dato que puede traer una fila. */
export type Campo =
  | 'tipoDocumento'
  | 'numeroDocumento'
  | 'primerNombre'
  | 'segundoNombre'
  | 'primerApellido'
  | 'segundoApellido'
  | 'fechaNacimiento'
  | 'genero'
  | 'correo'
  | 'celular'
  | 'accion'
  | 'departamento'
  | 'municipio'
  | 'barrio'
  | 'direccion'
  | 'estrato'
  | 'cargo'
  | 'nivelOcupacional'
  | 'beneficiarioPrevio';

/// El orden de las ocho de siempre, para lo que se pega sin encabezado.
export const ORDEN_ANTIGUO: Campo[] = [
  'tipoDocumento',
  'numeroDocumento',
  'primerNombre',
  'segundoNombre',
  'primerApellido',
  'segundoApellido',
  'correo',
  'celular',
];

/// Cómo se reconoce cada título. Se prueba en este orden y gana la
/// primera que casa: «segundo nombre» antes que «nombre», y «ciudad o
/// municipio» antes que «municipio», que también aparece en otras.
const PISTAS: Array<[Campo, RegExp]> = [
  ['tipoDocumento', /^tipo/],
  ['numeroDocumento', /^(numero|nro|no|num)\b|^documento|^cedula|^identificacion/],
  ['segundoNombre', /segundo nombre/],
  ['primerNombre', /primer nombre|^nombres?$/],
  ['segundoApellido', /segundo apellido/],
  ['primerApellido', /primer apellido|^apellidos?$/],
  ['fechaNacimiento', /nacimiento/],
  ['genero', /^genero|^sexo/],
  ['correo', /correo|email|e mail/],
  ['celular', /celular|telefono|movil/],
  ['accion', /accion de formacion|^accion|^af\b|curso|formacion de interes/],
  ['departamento', /departamento/],
  ['municipio', /ciudad|municipio/],
  ['barrio', /barrio|vereda/],
  ['direccion', /direccion/],
  ['estrato', /estrato/],
  ['nivelOcupacional', /nivel ocupacional|^nivel/],
  ['cargo', /cargo/],
  ['beneficiarioPrevio', /beneficiad|beneficiario/],
];

/** Sin tildes, sin mayúsculas y sin puntuación: así se comparan títulos. */
export function llano(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type Columnas = Partial<Record<Campo, number>>;

/**
 * Qué columna es cada campo, leyendo la fila de títulos. Null si esa
 * fila no parece un encabezado.
 *
 * Hacen falta al menos DOS títulos reconocidos, y entre ellos el número
 * de documento. Y NINGUNA celda puede ser un documento: un título no
 * lleva un número de cédula al lado, y sin esa guarda una fila que
 * empieza por «Cedula» se perdería en silencio.
 */
export function columnasDelEncabezado(celdas: string[]): Columnas | null {
  if (celdas.some((c) => /^\d{4,}$/.test(c.replace(/[\s.\-_]/g, '')))) return null;

  const columnas: Columnas = {};
  celdas.forEach((celda, i) => {
    const t = llano(celda);
    if (!t) return;
    for (const [campo, pista] of PISTAS) {
      if (columnas[campo] !== undefined) continue;
      if (pista.test(t)) {
        columnas[campo] = i;
        return;
      }
    }
  });

  const cuantos = Object.keys(columnas).length;
  if (cuantos < 2 || columnas.numeroDocumento === undefined) return null;
  return columnas;
}

// ── lo que dice cada celda ──────────────────────────────────────

const SIN_TILDES = (s: string) => llano(s);

/** El género del SEP. «Otro» es el «No binario» del catálogo. */
export function leerGenero(texto: string): { id: number | null; problema?: string } {
  const t = SIN_TILDES(texto);
  if (!t) return { id: null };
  if (t === 'otro' || t === 'otra' || t === 'otros') return { id: GENERO_NO_BINARIO };
  const hallado = GENEROS_SEP.find((g) => SIN_TILDES(g.etiqueta) === t);
  if (hallado) return { id: hallado.id };
  /// Por la primera letra, que es como lo escribe medio mundo: «M», «F».
  if (t === 'm' || t === 'masculino') return { id: 1 };
  if (t === 'f' || t === 'femenino') return { id: 2 };
  return { id: null, problema: `«${texto}» no es un género conocido (masculino, femenino u otro)` };
}

/** El nivel ocupacional del SEP, por su nombre. */
export function leerNivelOcupacional(texto: string): { id: number | null; problema?: string } {
  const t = SIN_TILDES(texto);
  if (!t) return { id: null };
  const hallado = NIVELES_OCUPACIONALES_SEP.find((n) => SIN_TILDES(n.etiqueta) === t);
  if (hallado) return { id: hallado.id };
  const empieza = NIVELES_OCUPACIONALES_SEP.find((n) => SIN_TILDES(n.etiqueta).startsWith(t));
  if (empieza) return { id: empieza.id };
  return {
    id: null,
    problema: `«${texto}» no es un nivel ocupacional del SEP (${NIVELES_OCUPACIONALES_SEP.map((n) => n.etiqueta.toLowerCase()).join(', ')})`,
  };
}

/**
 * Dónde vive: departamento y municipio, en un solo paso.
 *
 * El municipio manda, porque es lo que decide la sede. Si vienen los
 * dos y no cuadran, se dice: la ciudad de una lista y el departamento
 * de otra es el error que deja a una persona con sede en otro
 * departamento.
 */
export function leerDondeVive(
  departamento: string,
  municipio: string,
): { departamentoSepId: number | null; municipioSepId: number | null; problema?: string } {
  const dTexto = SIN_TILDES(departamento);
  const mTexto = SIN_TILDES(municipio);
  if (!dTexto && !mTexto) return { departamentoSepId: null, municipioSepId: null };

  const depto = dTexto
    ? DEPARTAMENTOS_SEP.find((d) => SIN_TILDES(d.etiqueta) === dTexto) ??
      DEPARTAMENTOS_SEP.find((d) => SIN_TILDES(d.etiqueta).startsWith(dTexto))
    : undefined;
  if (dTexto && !depto) {
    return {
      departamentoSepId: null,
      municipioSepId: null,
      problema: `«${departamento}» no es un departamento de Colombia`,
    };
  }

  if (!mTexto) return { departamentoSepId: depto?.id ?? null, municipioSepId: null };

  const candidatos = MUNICIPIOS_SEP.filter((m) => SIN_TILDES(m[2]) === mTexto);
  if (candidatos.length === 0) {
    /// «Bogotá D.C» en la casilla de la ciudad. Es lo que escribe todo
    /// el mundo, y en el catálogo del SENA el departamento se llama
    /// «BOGOTÁ D.C» y su único municipio, «BOGOTÁ». Cuando el nombre de
    /// la ciudad es el de un departamento con un solo municipio, ese es.
    const comoDepto =
      DEPARTAMENTOS_SEP.find((d) => SIN_TILDES(d.etiqueta) === mTexto) ??
      DEPARTAMENTOS_SEP.find((d) => SIN_TILDES(d.etiqueta).startsWith(mTexto));
    if (comoDepto && (!depto || depto.id === comoDepto.id)) {
      const suyos = MUNICIPIOS_SEP.filter((m) => m[1] === comoDepto.id);
      if (suyos.length === 1) {
        return { departamentoSepId: comoDepto.id, municipioSepId: suyos[0][0] };
      }
      /// Con varios municipios no se adivina cuál: al menos queda el
      /// departamento, y el aviso dice qué falta.
      return {
        departamentoSepId: comoDepto.id,
        municipioSepId: null,
        problema: `«${municipio}» es el departamento, no la ciudad: falta la ciudad`,
      };
    }
    return {
      departamentoSepId: depto?.id ?? null,
      municipioSepId: null,
      problema: `«${municipio}» no es un municipio de Colombia`,
    };
  }

  if (depto) {
    const suyo = candidatos.find((m) => m[1] === depto.id);
    if (!suyo) {
      return {
        departamentoSepId: depto.id,
        municipioSepId: null,
        problema: `«${municipio}» no es un municipio de ${depto.etiqueta}`,
      };
    }
    return { departamentoSepId: depto.id, municipioSepId: suyo[0] };
  }

  /// Sin departamento escrito: solo si el nombre es de UN municipio. Hay
  /// veinte «La Unión» en Colombia, y adivinar pondría la sede en otro
  /// departamento sin que nadie se enterara.
  if (candidatos.length > 1) {
    return {
      departamentoSepId: null,
      municipioSepId: null,
      problema: `hay ${candidatos.length} municipios llamados «${municipio}»: falta el departamento`,
    };
  }
  return { departamentoSepId: candidatos[0][1], municipioSepId: candidatos[0][0] };
}

/** El estrato, del 1 al 6. */
export function leerEstrato(texto: string): { valor: number | null; problema?: string } {
  const t = texto.trim();
  if (!t) return { valor: null };
  const n = Number(t.replace(/[^0-9]/g, ''));
  if (!Number.isInteger(n) || n < 1 || n > 6) {
    return { valor: null, problema: `«${texto}» no es un estrato del 1 al 6` };
  }
  return { valor: n };
}

/** Sí o no. Vacío es «no se sabe», que no es lo mismo que «no». */
export function leerSiNo(texto: string): { valor: boolean | null; problema?: string } {
  const t = SIN_TILDES(texto);
  if (!t) return { valor: null };
  if (['si', 'sí', 's', 'true', 'verdadero', 'x', '1'].includes(t)) return { valor: true };
  if (['no', 'n', 'false', 'falso', '0'].includes(t)) return { valor: false };
  return { valor: null, problema: `«${texto}» no es sí ni no` };
}

/**
 * La fecha de nacimiento, en `YYYY-MM-DD`.
 *
 * Acepta lo que sale de un Excel (ya en ISO), lo que se escribe a mano
 * en Colombia (`dd/mm/aaaa`) y el número de serie de Excel si el archivo
 * vino sin formato de fecha. Y exige mayoría de edad: escribir el año en
 * curso por descuido es el error que el cliente vio venir.
 */
export function leerFechaDeNacimiento(texto: string): { iso: string | null; problema?: string } {
  const t = texto.trim();
  if (!t) return { iso: null };

  let iso: string | null = null;
  const conGuiones = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  const conBarras = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  const serie = /^\d{4,6}$/.test(t) ? Number(t) : null;

  if (conGuiones) {
    iso = `${conGuiones[1]}-${conGuiones[2].padStart(2, '0')}-${conGuiones[3].padStart(2, '0')}`;
  } else if (conBarras) {
    iso = `${conBarras[3]}-${conBarras[2].padStart(2, '0')}-${conBarras[1].padStart(2, '0')}`;
  } else if (serie !== null) {
    /// Serie de Excel: días desde el 30/12/1899 (su 1900 bisiesto falso
    /// ya queda dentro para cualquier fecha posterior a 1900).
    const base = Date.UTC(1899, 11, 30);
    iso = new Date(base + serie * 86400000).toISOString().slice(0, 10);
  }

  if (!iso) return { iso: null, problema: `«${texto}» no es una fecha (use dd/mm/aaaa)` };

  const fecha = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(fecha.getTime())) {
    return { iso: null, problema: `«${texto}» no es una fecha (use dd/mm/aaaa)` };
  }
  if (fecha.getTime() > Date.now()) {
    return { iso: null, problema: `«${texto}» es una fecha futura` };
  }
  if (edadCumplida(fecha) < EDAD_MINIMA) {
    return { iso: null, problema: `con «${texto}» la persona no llega a ${EDAD_MINIMA} años` };
  }
  return { iso };
}

/** El código de la acción: «AF3 · Gobernanza…» -> «AF3». */
export function codigoDeAccion(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  const m = /^([A-Za-z]{1,4}\s?\d{1,3})\b/.exec(t);
  if (m) return m[1].replace(/\s+/g, '').toUpperCase();
  return null;
}
