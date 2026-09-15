/** El formato ligero del cuerpo de una plantilla. */

/**
 * El cuerpo de una plantilla lo escribe una persona en una
 * caja de texto, y tiene que seguir leyendose bien COMO TEXTO:
 * es lo que va en la parte `text/plain` del correo, que es lo
 * que recibe quien tiene el HTML apagado.
 *
 * Por eso el formato son cuatro marcas que ya se usan al
 * escribir a mano, y ninguna inventada:
 *
 *   # Titulo             el titulo grande, una vez y arriba
 *   ## Seccion           un rotulo de seccion
 *   Etiqueta: valor      DOS O MAS seguidas: el panel de datos
 *   • punto              una vinetas
 *   > nota               una linea destacada
 *
 * LA REGLA DE LAS DOS LINEAS NO ES UN CAPRICHO. Una sola
 * «Nota: si no puede asistir, avisenos» es una frase corriente
 * y tiene que seguir siendo un parrafo; dos o mas seguidas ya
 * son una tabla, y nadie escribe dos frases asi por accidente.
 *
 * Y SE TROCEA EL TEXTO DE LA PLANTILLA, NUNCA EL RESUELTO.
 * Las variables se sustituyen DESPUES, dentro de cada bloque:
 * si se hiciera al reves, una razon social como
 * `# 1 LOGISTICA S.A.S` se convertiria en el titulo del correo.
 */

/// Una etiqueta de panel: corta, sin punto final y con algo
/// detras. Lo que no cumple sigue siendo un parrafo.
const FILA = /^([^:]{2,32}):[ \t]+(\S.*)$/;
const VINETA = /^[•*-][ \t]+(\S.*)$/;
/// `[Completar mis datos]({{enlace}})`: un boton. Se escribe
/// como un enlace de markdown porque es lo que todo el mundo
/// reconoce, y en texto plano se degrada a «Texto: url», que
/// se lee igual de bien.
const BOTON = /^\[([^\]]{2,60})\]\((\S+)\)$/;

export type Bloque =
  | { tipo: 'TITULO'; texto: string; marca: string | null }
  | { tipo: 'SECCION'; texto: string }
  | { tipo: 'PANEL'; filas: Array<{ etiqueta: string; valor: string }> }
  | { tipo: 'LISTA'; puntos: string[] }
  | { tipo: 'NOTA'; texto: string }
  | { tipo: 'BOTON'; texto: string; url: string }
  | { tipo: 'PARRAFO'; texto: string };

/** El cuerpo de la plantilla, troceado. */
export function bloquesDe(cuerpo: string): Bloque[] {
  const bloques: Bloque[] = [];
  const lineas = cuerpo.replace(/\r\n/g, '\n').split('\n');

  let parrafo: string[] = [];
  const cerrarParrafo = () => {
    if (parrafo.length === 0) return;
    bloques.push({ tipo: 'PARRAFO', texto: parrafo.join('\n') });
    parrafo = [];
  };

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const limpia = linea.trim();

    if (limpia === '') {
      cerrarParrafo();
      continue;
    }

    /// El titulo solo cuenta si va ANTES de cualquier texto:
    /// un `#` a mitad de un correo es una almohadilla.
    if (limpia.startsWith('# ') && bloques.length === 0 && parrafo.length === 0) {
      bloques.push(titulo(limpia.slice(2).trim()));
      continue;
    }

    if (limpia.startsWith('## ')) {
      cerrarParrafo();
      bloques.push({ tipo: 'SECCION', texto: limpia.slice(3).trim() });
      continue;
    }

    if (limpia.startsWith('> ')) {
      cerrarParrafo();
      bloques.push({ tipo: 'NOTA', texto: limpia.slice(2).trim() });
      continue;
    }

    const boton = BOTON.exec(limpia);
    if (boton) {
      cerrarParrafo();
      bloques.push({ tipo: 'BOTON', texto: boton[1].trim(), url: boton[2] });
      continue;
    }

    const puntos = corrido(lineas, i, VINETA);
    if (puntos.length > 0) {
      cerrarParrafo();
      bloques.push({ tipo: 'LISTA', puntos: puntos.map((m) => m[1].trim()) });
      i += puntos.length - 1;
      continue;
    }

    /// DOS O MAS seguidas, nunca una.
    const filas = corrido(lineas, i, FILA);
    if (filas.length >= 2) {
      cerrarParrafo();
      bloques.push({
        tipo: 'PANEL',
        filas: filas.map((m) => ({
          etiqueta: m[1].trim(),
          valor: m[2].trim(),
        })),
      });
      i += filas.length - 1;
      continue;
    }

    parrafo.push(limpia);
  }

  cerrarParrafo();
  return bloques;
}

/// Cuantas lineas seguidas casan con el mismo patron.
function corrido(
  lineas: string[],
  desde: number,
  patron: RegExp,
): RegExpExecArray[] {
  const casan: RegExpExecArray[] = [];
  for (let i = desde; i < lineas.length; i++) {
    const linea = lineas[i].trim();
    if (laReclamaOtra(linea, patron)) break;
    const m = patron.exec(linea);
    if (!m) break;
    casan.push(m);
  }
  return casan;
}

/**
 * Si una regla de MAS peso ya reclamo esa linea.
 *
 * El bucle comprueba la seccion y la nota antes del corrido,
 * pero el corrido salta lineas con `i += n - 1` y esas
 * comprobaciones no vuelven a correr. Sin esto, «> Nota: si no
 * puede asistir, avisenos» pegada a un panel casa tambien FILA
 * y el panel se la traga: el `>` acaba de etiqueta y viaja
 * crudo al texto plano, que es justo lo que este archivo
 * prohibe.
 */
function laReclamaOtra(linea: string, patron: RegExp): boolean {
  if (linea.startsWith('## ') || linea.startsWith('> ')) return true;
  if (BOTON.test(linea)) return true;
  /// la vinetas gana a la fila, nunca al reves
  return patron === FILA && VINETA.test(linea);
}

/**
 * El titulo, y su marca.
 *
 * Si empieza por un simbolo suelto --«# ✓ Su inscripcion
 * quedo confirmada»-- ese simbolo va dentro del circulo y el
 * resto es el titulo. Es lo que hace que el correo se lea de
 * un vistazo, y en texto plano se sigue leyendo igual de bien.
 */
function titulo(texto: string): Bloque {
  /// Un simbolo suelto: ni letra, ni numero, ni espacio -- y
  /// NUNCA una llave. `# {{ nombre }}, bienvenido` partia por
  /// el `{{` y dejaba el titulo sin las llaves, asi que el
  /// resolutor no veia ningun hueco: el correo salia con
  /// «{{ nombre }}» impreso y la regla 1 no se enteraba.
  const m = /^([^\p{L}\p{N}\s{}]+)\s+(\S.*)$/u.exec(texto);
  if (m) {
    return { tipo: 'TITULO', texto: m[2].trim(), marca: m[1].trim() };
  }
  return { tipo: 'TITULO', texto, marca: null };
}

/**
 * Los bloques, con las variables ya puestas.
 *
 * Devuelve tambien lo que falto y lo que no existe, porque las
 * dos cosas detienen el envio: un hueco vacio deja «Estimado
 * {{saludo}}» y una clave inventada --las plantillas que manda
 * el cliente vienen en MAYUSCULA_CON_GUIONES-- deja
 * «{{NOMBRE_PARTICIPANTE}}» literal en la bandeja de alguien.
 */
export function resolverBloques(
  bloques: Bloque[],
  resolver: (texto: string) => {
    texto: string;
    faltantes: string[];
    desconocidas: string[];
  },
): {
  bloques: Bloque[];
  faltantes: string[];
  desconocidas: string[];
} {
  const faltantes = new Set<string>();
  const desconocidas = new Set<string>();

  const r = (t: string) => {
    const x = resolver(t);
    x.faltantes.forEach((f) => faltantes.add(f));
    x.desconocidas.forEach((d) => desconocidas.add(d));
    return x.texto;
  };

  const puestos = bloques.map((b): Bloque => {
    switch (b.tipo) {
      case 'PANEL':
        return {
          tipo: 'PANEL',
          filas: b.filas.map((f) => ({
            etiqueta: r(f.etiqueta),
            valor: r(f.valor),
          })),
        };
      case 'LISTA':
        return { tipo: 'LISTA', puntos: b.puntos.map(r) };
      case 'BOTON':
        return { tipo: 'BOTON', texto: r(b.texto), url: r(b.url) };
      case 'TITULO':
        return { tipo: 'TITULO', texto: r(b.texto), marca: b.marca };
      default:
        return { ...b, texto: r(b.texto) };
    }
  });

  return {
    bloques: puestos,
    faltantes: [...faltantes],
    desconocidas: [...desconocidas],
  };
}

/**
 * El correo en texto plano, sin las marcas del formato.
 *
 * Va en la parte `text/plain`, y quien lo lee ahi no tiene que
 * ver ni una almohadilla: eso seria marcado crudo en la
 * bandeja de alguien. Las vinetas SI se quedan, que se leen
 * bien, y el panel vuelve a ser lo que ya era.
 */
export function comoTexto(bloques: Bloque[]): string {
  const partes = bloques.map((b) => {
    switch (b.tipo) {
      case 'TITULO':
        return b.marca ? `${b.marca} ${b.texto}` : b.texto;
      case 'SECCION':
        return `${b.texto.toLocaleUpperCase('es-CO')}`;
      case 'PANEL':
        return b.filas.map((f) => `${f.etiqueta}: ${f.valor}`).join('\n');
      case 'LISTA':
        return b.puntos.map((p) => `• ${p}`).join('\n');
      case 'BOTON':
        /// En texto plano la direccion tiene que verse entera:
        /// ahi no hay nada que pulsar.
        return `${b.texto}:\n${b.url}`;
      default:
        return b.texto;
    }
  });
  return partes.join('\n\n');
}
