/** Lo que una plantilla puede decir de cada persona. */

/// Una plantilla se escribe una vez y se manda cien veces, así
/// que lo que cambia va entre llaves: `{{primerNombre}}`.
///
/// Dos reglas gobiernan este archivo, y las dos vienen de lo
/// mismo -- que esto le llega por correo a una persona con
/// nombre propio:
///
///   1. Un hueco que no se pudo llenar NO se manda. Se
///      devuelve en `faltantes` y quien escribe decide. Es
///      preferible no mandar nada a mandar «Estimado
///      {{primerNombre}}», que además de descuidado deja ver
///      que era un envío masivo.
///
///   2. Cuando no se sabe el género, el saludo se vuelve
///      neutro en vez de adivinar. Llamar «Sr.» a una señora
///      es peor que no poner tratamiento.

/// De dónde sale cada cosa. `null` quiere decir «ese dato no
/// está en la ficha», que no es lo mismo que vacío.
export type DatosDelParticipante = {
  primerNombre: string | null;
  segundoNombre: string | null;
  primerApellido: string | null;
  segundoApellido: string | null;
  /// El del SEP: 1 masculino, 2 femenino, 3 no binario.
  generoSepId: number | null;
  numeroDocumento: string | null;
  correo: string | null;
  celular: string | null;
  empresa: string | null;
  accionFormacion: string | null;
  grupo: number | null;
  fechaInicio: Date | null;
  ubicacion: string | null;
  modalidad: string | null;
  asesor: string | null;
  gremio: string | null;
};

export type Variable = {
  clave: string;
  /// Cómo se le explica a quien escribe la plantilla.
  titulo: string;
  ejemplo: string;
};

/// El catálogo, que es también lo que se le enseña a quien
/// escribe: si no está aquí, no existe.
export const VARIABLES: Variable[] = [
  { clave: 'tratamiento', titulo: 'Sr. / Sra.', ejemplo: 'Sra.' },
  { clave: 'saludo', titulo: 'Saludo completo', ejemplo: 'Estimada Sra. Caro' },
  { clave: 'primerNombre', titulo: 'Primer nombre', ejemplo: 'Camila' },
  {
    clave: 'nombreCompleto',
    titulo: 'Nombre completo',
    ejemplo: 'Camila Alejandra Caro Garavito',
  },
  { clave: 'primerApellido', titulo: 'Primer apellido', ejemplo: 'Caro' },
  { clave: 'documento', titulo: 'Número de documento', ejemplo: '1017138135' },
  { clave: 'correo', titulo: 'Su correo', ejemplo: 'camila@ejemplo.com' },
  { clave: 'celular', titulo: 'Su celular', ejemplo: '300 000 0000' },
  {
    clave: 'empresa',
    titulo: 'Dónde trabaja',
    ejemplo: 'ABC LABORATORIOS S.A.S',
  },
  {
    clave: 'accionFormacion',
    titulo: 'Acción de formación',
    ejemplo: 'AF1 · Gestión de la atención',
  },
  { clave: 'grupo', titulo: 'Número de grupo', ejemplo: '3' },
  {
    clave: 'fechaInicio',
    titulo: 'Cuándo arranca',
    ejemplo: '7 de septiembre de 2026',
  },
  { clave: 'ubicacion', titulo: 'Dónde se dicta', ejemplo: 'Medellín' },
  { clave: 'modalidad', titulo: 'Modalidad', ejemplo: 'Virtual' },
  { clave: 'asesor', titulo: 'Quién lo acompaña', ejemplo: 'Ana Jaramillo' },
  { clave: 'gremio', titulo: 'Gremio', ejemplo: 'ADECOPRIA' },
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

/**
 * La fecha, escrita como se escribe en una carta.
 *
 * En hora de Colombia. Con la fecha en UTC, un grupo que
 * arranca el 7 se anuncia el 6 en todos los correos que salgan
 * después de las siete de la tarde.
 */
function enLetras(d: Date): string {
  const bogota = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  return `${bogota.getUTCDate()} de ${MESES[bogota.getUTCMonth()]} de ${bogota.getUTCFullYear()}`;
}

/// «Sr.» o «Sra.», y nada cuando no se sabe.
///
/// El género es obligatorio para el F7, así que en una ficha
/// completa va a estar. Pero un lead recién llegado todavía no
/// lo tiene, y a ese también hay que poder escribirle.
function tratamientoDe(generoSepId: number | null): string | null {
  if (generoSepId === 1) return 'Sr.';
  if (generoSepId === 2) return 'Sra.';
  // 3 es «no binario»: no hay tratamiento corto que no
  // suponga algo, así que no se pone ninguno
  return null;
}

/**
 * El saludo entero, que es lo que casi siempre se quiere.
 *
 * Se arma con lo que haya y siempre sale bien escrito:
 *
 *   con género y apellido → «Estimada Sra. Caro»
 *   sin género            → «Estimada/o Camila Caro»... no:
 *                            «Hola, Camila»
 *   sin nada              → null, y el envío se detiene
 */
function saludoDe(d: DatosDelParticipante): string | null {
  const tratamiento = tratamientoDe(d.generoSepId);
  const apellido = d.primerApellido?.trim();
  const nombre = d.primerNombre?.trim();

  if (tratamiento && apellido) {
    const estimada = d.generoSepId === 2 ? 'Estimada' : 'Estimado';
    return `${estimada} ${tratamiento} ${bonito(apellido)}`;
  }
  if (nombre) return `Hola, ${bonito(nombre)}`;
  return null;
}

/// Los nombres llegan en mayúscula sostenida del formulario y
/// de las cargas. «ESTIMADA SRA. CARO» se lee como un grito.
function bonito(t: string): string {
  return t
    .toLocaleLowerCase('es-CO')
    .split(/\s+/)
    .map((p) => (p ? p[0].toLocaleUpperCase('es-CO') + p.slice(1) : p))
    .join(' ');
}

function nombreCompletoDe(d: DatosDelParticipante): string | null {
  const partes = [
    d.primerNombre,
    d.segundoNombre,
    d.primerApellido,
    d.segundoApellido,
  ]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p));
  return partes.length > 0 ? bonito(partes.join(' ')) : null;
}

/** Qué vale cada variable para esta persona. */
export function valoresDe(
  d: DatosDelParticipante,
): Record<string, string | null> {
  return {
    tratamiento: tratamientoDe(d.generoSepId),
    saludo: saludoDe(d),
    primerNombre: d.primerNombre ? bonito(d.primerNombre) : null,
    nombreCompleto: nombreCompletoDe(d),
    primerApellido: d.primerApellido ? bonito(d.primerApellido) : null,
    documento: d.numeroDocumento,
    correo: d.correo,
    celular: d.celular,
    empresa: d.empresa,
    accionFormacion: d.accionFormacion,
    grupo: d.grupo === null ? null : String(d.grupo),
    fechaInicio: d.fechaInicio ? enLetras(d.fechaInicio) : null,
    ubicacion: d.ubicacion,
    modalidad: d.modalidad,
    asesor: d.asesor,
    gremio: d.gremio,
  };
}

export type Resuelta = {
  texto: string;
  /// Variables que la plantilla usa y no se pudieron llenar.
  faltantes: string[];
  /// Variables que la plantilla usa y no existen en el catálogo.
  desconocidas: string[];
};

/// `{{ algo }}`, con o sin espacios: quien escribe no tiene
/// por qué acordarse de si van o no.
const HUECO = /\{\{\s*([a-zA-ZÀ-ÿ0-9_]+)\s*\}\}/g;

/**
 * Rellena una plantilla.
 *
 * Lo que no se puede llenar se deja TAL CUAL y se avisa. No se
 * borra el hueco: un correo que dice «Estimado , su curso
 * empieza el» es peor que uno que enseña el error, porque el
 * primero se manda sin que nadie lo note.
 */
export function resolver(
  texto: string,
  valores: Record<string, string | null>,
): Resuelta {
  const faltantes = new Set<string>();
  const desconocidas = new Set<string>();

  const salida = texto.replace(HUECO, (entero, clave: string) => {
    if (!(clave in valores)) {
      desconocidas.add(clave);
      return entero;
    }
    const valor = valores[clave];
    if (valor === null || valor.trim() === '') {
      faltantes.add(clave);
      return entero;
    }
    return valor;
  });

  return {
    texto: salida,
    faltantes: [...faltantes],
    desconocidas: [...desconocidas],
  };
}

/** Las variables que un texto usa, para avisar al escribirlo. */
export function variablesUsadas(texto: string): string[] {
  const vistas = new Set<string>();
  for (const m of texto.matchAll(HUECO)) vistas.add(m[1]);
  return [...vistas];
}
