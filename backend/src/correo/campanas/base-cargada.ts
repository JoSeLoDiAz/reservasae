/** Revisar una base subida, antes de que salga nada. */

/// Una lista que se sube es la ÚNICA fuente de destinatarios
/// que nadie revisó. Los segmentos salen de la base propia,
/// donde los correos ya pasaron por un formulario; un .xlsx
/// llega de donde sea -- de un tercero, de un copiar y pegar,
/// de una hoja que alguien viene arrastrando desde 2019.
///
/// Por eso esto se revisa ANTES y se dice todo lo que se
/// encontró. Un correo malo no es solo un correo que no
/// llega: cada rebote le baja la reputación a la cuenta, y la
/// reputación es lo que decide si los BUENOS caen en la
/// bandeja o en spam. Diez basuras en una lista de doscientos
/// arruinan los ciento noventa.

/// El correo, sin adornos. No se persigue el RFC entero --
/// eso admite cosas que ningún servidor de verdad acepta --
/// sino lo que de verdad se ve en una base: un buzón, un
/// arroba, un dominio con punto y un remate de dos letras o
/// más.
const CORREO =
  /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

/// Errores de dedo que se repiten en toda base colombiana.
/// NO se corrigen solos: cambiarle el correo a alguien por
/// nuestra cuenta es mandarle el correo a otra persona si
/// resulta que sí era así. Se señalan y decide quien sabe.
const DEDAZOS: Array<{ ve: RegExp; es: string }> = [
  { ve: /@gmail\.con$/, es: '¿quiso decir gmail.com?' },
  { ve: /@gmial\.com$/, es: '¿quiso decir gmail.com?' },
  { ve: /@gamil\.com$/, es: '¿quiso decir gmail.com?' },
  { ve: /@gmail\.co$/, es: '¿quiso decir gmail.com?' },
  { ve: /@hotmail\.con$/, es: '¿quiso decir hotmail.com?' },
  { ve: /@hotmial\.com$/, es: '¿quiso decir hotmail.com?' },
  { ve: /@homtail\.com$/, es: '¿quiso decir hotmail.com?' },
  { ve: /@outlook\.con$/, es: '¿quiso decir outlook.com?' },
  { ve: /@yaho\.com$/, es: '¿quiso decir yahoo.com?' },
  { ve: /\.con$/, es: 'termina en .con, y eso no existe' },
];

export type FilaDeBase = {
  /// La fila del Excel, para poder señalarla.
  fila: number;
  correo: string;
  nombre: string;
};

export type Listo = {
  fila: number;
  correo: string;
  nombre: string | null;
  /// Parece un error de dedo. Se carga igual: decide quien
  /// conoce la lista, no nosotros.
  sospecha?: string;
};

export type Descartado = {
  fila: number;
  /// Como venía, sin arreglar: es lo que hay que buscar en el
  /// archivo para corregirlo.
  correo: string;
  motivo: string;
};

export type Revision = {
  listos: Listo[];
  descartados: Descartado[];
  /// Cuántas veces venía repetido un correo que ya estaba.
  /// Se manda UNA sola vez.
  repetidos: number;
  /// Filas del todo en blanco. No son un error: son el
  /// relleno de abajo de casi toda hoja de Excel.
  vacias: number;
};

/// Tildes y eñes en la parte del buzón. Existe quien las
/// tiene, pero en Colombia casi siempre es que alguien
/// escribió el nombre de la persona en vez de su correo.
const TIENE_TILDE = /[áéíóúüñÁÉÍÓÚÜÑ]/;

function motivoDe(bruto: string): string | null {
  const c = bruto.toLowerCase();

  if (TIENE_TILDE.test(bruto)) {
    return 'tiene tildes o eñe, y un correo no las lleva';
  }
  if (/\s/.test(bruto)) return 'tiene espacios';
  const arrobas = (c.match(/@/g) ?? []).length;
  if (arrobas === 0) return 'no tiene arroba';
  if (arrobas > 1) return `tiene ${arrobas} arrobas`;
  if (!c.includes('.', c.indexOf('@'))) {
    return 'al dominio le falta el punto';
  }
  if (c.startsWith('@') || c.endsWith('@')) return 'está partido';
  if (!CORREO.test(c)) return 'no tiene forma de correo';
  return null;
}

/// El nombre, presentable. Llega «MARIA», «maria» y « María »
/// en la misma columna, y las tres tienen que salir igual en
/// el correo: escribirle «Hola, MARIA» a alguien es gritarle.
export function nombreBonito(bruto: string): string | null {
  const limpio = bruto.trim().replace(/\s+/g, ' ');
  if (!limpio) return null;

  /// Solo la primera palabra: la columna dice «primer
  /// nombre», pero medio mundo pega el nombre completo. «Hola,
  /// María Fernanda Gómez Rueda» no lo escribe una persona.
  const primera = limpio.split(' ')[0];

  /// Un correo no es un nombre. Pasa cuando alguien arrastra
  /// mal la fórmula y la columna se duplica.
  if (primera.includes('@')) return null;

  return (
    primera.charAt(0).toLocaleUpperCase('es-CO') +
    primera.slice(1).toLocaleLowerCase('es-CO')
  );
}

/**
 * Revisa la base y dice qué sirve y qué no.
 *
 * No guarda nada. Quien llama enseña el informe y decide, que
 * es el punto: ver la lista ANTES de que salga, no después.
 */
export function revisarBase(filas: FilaDeBase[]): Revision {
  const listos: Listo[] = [];
  const descartados: Descartado[] = [];
  const vistos = new Set<string>();
  let repetidos = 0;
  let vacias = 0;

  for (const f of filas) {
    const bruto = (f.correo ?? '').trim();
    const nombre = (f.nombre ?? '').trim();

    if (!bruto && !nombre) {
      vacias += 1;
      continue;
    }

    if (!bruto) {
      descartados.push({
        fila: f.fila,
        correo: '',
        motivo: 'no trae correo',
      });
      continue;
    }

    const problema = motivoDe(bruto);
    if (problema) {
      descartados.push({ fila: f.fila, correo: bruto, motivo: problema });
      continue;
    }

    /// En minúsculas para comparar: MARIA@X.COM y maria@x.com
    /// son el mismo buzón, y mandarle dos veces es como se
    /// gana uno un «esto es spam».
    const limpio = bruto.toLowerCase();
    if (vistos.has(limpio)) {
      repetidos += 1;
      continue;
    }
    vistos.add(limpio);

    const dedazo = DEDAZOS.find((d) => d.ve.test(limpio));
    listos.push({
      fila: f.fila,
      correo: limpio,
      nombre: nombreBonito(nombre),
      ...(dedazo ? { sospecha: dedazo.es } : {}),
    });
  }

  return { listos, descartados, repetidos, vacias };
}
