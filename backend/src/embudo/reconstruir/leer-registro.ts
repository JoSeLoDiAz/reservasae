/** Lo que se puede saber del registro de nginx, y nada mas. */

/**
 * El contador del embudo arranco el 14 sep 2026 a las 18:02 y
 * antes no hay ni una fila. El `access_log` de nginx si tiene
 * semanas --la campana entera-- y el cliente pregunto si se
 * puede ver ese tramo.
 *
 * Se puede, con tres limites que NO son negociables y que la
 * pantalla dice en voz alta:
 *
 *   1. NO hay peldanos intermedios. El registro sabe que
 *      alguien pidio el formulario y si mando el POST; no sabe
 *      si eligio ciudad ni si llego a la revision. Un embudo
 *      reconstruido seria inventarse seis peldanos.
 *   2. NO se sabe si un envio creo ficha o devolvio una que ya
 *      existia: los dos contestan 201.
 *   3. La unidad es la VISITA aproximada --una IP en un dia--,
 *      no la persona.
 *
 * Y una regla de diseno: aqui NO se clasifica la procedencia.
 * Se sacan los mismos datos crudos que guarda la baliza
 * --referente, utmFuente, el BIT del fbclid, navegador-- y
 * quien clasifica es `procedenciaSql()`, la misma funcion, en
 * la misma base. Con dos clasificadores, la misma visita
 * saldria de dos maneras segun de que fuente venga.
 *
 * LA IP NO SALE DE AQUI. Se usa para agrupar y se tira: es un
 * dato personal en Colombia y hashearla no la salva.
 */

/// Los mismos caracteres que deja pasar la baliza.
const LIMPIO = /[^A-Za-z0-9._-]/g;

/// Quien no es una persona. `facebookexternalhit` solo son 665
/// de 758 peticiones al HTML: contarlo dobla el denominador.
const ROBOTS =
  /bot\b|bot\/|spider|crawler|facebookexternalhit|headlesschrome|curl\/|wget\/|python-requests|okhttp|Go-http-client/i;

const MESES: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/// nginx en formato `combined`, con lo que venga detras.
const LINEA =
  /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) \S+ "([^"]*)" "([^"]*)"/;

export type Peticion = {
  ip: string;
  /// El instante, en milisegundos.
  ms: number;
  metodo: string;
  ruta: string;
  consulta: string;
  estado: number;
  referente: string;
  agente: string;
};

/** Una línea de nginx, o `null` si no lo es. */
export function interpretarLinea(linea: string): Peticion | null {
  const m = LINEA.exec(linea);
  if (!m) return null;

  const ms = aInstante(m[2]);
  if (ms === null) return null;

  const [ruta, consulta = ''] = m[4].split('?');
  return {
    ip: m[1],
    ms,
    metodo: m[3],
    ruta,
    consulta,
    estado: Number(m[5]),
    referente: m[6] === '-' ? '' : m[6],
    agente: m[7],
  };
}

/// `15/Sep/2026:15:30:56 +0000` -> milisegundos.
function aInstante(sello: string): number | null {
  const m = /^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/.exec(
    sello,
  );
  if (!m || !(m[2] in MESES)) return null;

  const utc = Date.UTC(
    Number(m[3]),
    MESES[m[2]],
    Number(m[1]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  );
  const signo = m[7][0] === '-' ? 1 : -1;
  const desfase =
    (Number(m[7].slice(1, 3)) * 60 + Number(m[7].slice(3, 5))) * 60_000;
  return utc + signo * desfase;
}

/// El día de BOGOTÁ, que es el que usa todo el panel.
export function diaBogota(ms: number): string {
  return new Date(ms - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Por qué app llega.
 *
 * Es la MISMA regla que `frontend/src/lib/visita.ts`, con
 * Instagram primero por lo mismo: su navegador manda también
 * las marcas de Facebook en algunas versiones, y al revés no
 * pasa. `el-registro-lee-como-la-baliza.spec.ts` ata las dos.
 */
export function navegadorDe(agente: string): string {
  if (/Instagram/i.test(agente)) return 'APP_INSTAGRAM';
  if (/FBAN|FBAV|FB_IAB/i.test(agente)) return 'APP_FACEBOOK';
  return 'OTRO';
}

/// El HOST del referente, como lo manda la baliza. Nunca la
/// URL entera: ahí caben datos de la página anterior.
export function hostDe(referente: string): string {
  if (!referente) return '';
  try {
    return new URL(referente).host;
  } catch {
    return '';
  }
}

export type FilaReconstruida = {
  dia: string;
  slug: string;
  referente: string;
  utmFuente: string;
  huboFbclid: boolean;
  navegador: string;
  visitas: number;
  envios: number;
};

type Rastro = {
  slug: string;
  /// Lo que se sabe de por dónde llegó, del HTML más antiguo.
  desde: number | null;
  referente: string;
  utmFuente: string;
  huboFbclid: boolean;
  navegador: string;
  pidioElFormulario: boolean;
  envios: number;
};

/**
 * Agrupa el registro en filas de conteo.
 *
 * `hasta` es el instante en que arrancó el contador: lo de ahí
 * en adelante ya está medido de verdad y no se reconstruye. Sin
 * ese corte, el mismo día se contaría dos veces por dos
 * caminos distintos.
 */
export function reconstruir(
  lineas: Iterable<string>,
  hasta: number,
): FilaReconstruida[] {
  /// La clave lleva la IP y MUERE AQUÍ: agrupar es para lo que
  /// sirve. De la función solo salen conteos.
  const rastros = new Map<string, Rastro>();

  for (const linea of lineas) {
    const p = interpretarLinea(linea);
    if (!p || p.ms >= hasta) continue;
    if (ROBOTS.test(p.agente)) continue;

    const que = queEs(p);
    if (!que) continue;

    const llave = `${p.ip}|${diaBogota(p.ms)}|${que.slug}`;
    const r =
      rastros.get(llave) ??
      {
        slug: que.slug,
        desde: null,
        referente: '',
        utmFuente: '',
        huboFbclid: false,
        navegador: 'OTRO',
        pidioElFormulario: false,
        envios: 0,
      };

    if (que.tipo === 'CATALOGO') r.pidioElFormulario = true;
    if (que.tipo === 'ENVIO' && p.estado === 201) r.envios += 1;

    /// La atribución sale del PRIMER HTML de esa IP en ese día:
    /// es el que trae el enlace del anuncio. Los siguientes ya
    /// llevan nuestro propio dominio de referente.
    if (que.tipo === 'HTML' && (r.desde === null || p.ms < r.desde)) {
      const parametros = new URLSearchParams(p.consulta);
      r.desde = p.ms;
      r.referente = hostDe(p.referente);
      r.utmFuente = (parametros.get('utm_source') ?? '')
        .replace(LIMPIO, '')
        .slice(0, 60);
      r.huboFbclid = parametros.has('fbclid');
      r.navegador = navegadorDe(p.agente);
    }

    rastros.set(llave, r);
  }

  /// Ahora sí: se pierde la IP y quedan conteos por día.
  const filas = new Map<string, FilaReconstruida>();
  for (const [llave, r] of rastros) {
    /// Sin pedir el formulario no hubo visita de verdad: el
    /// HTML lo piden también los rastreadores que no ejecutan
    /// JavaScript. Es el mismo denominador que usa la pantalla.
    if (!r.pidioElFormulario) continue;

    const dia = llave.split('|')[1];
    const k = [
      dia,
      r.slug,
      r.referente,
      r.utmFuente,
      r.huboFbclid,
      r.navegador,
    ].join('|');

    const f =
      filas.get(k) ??
      {
        dia,
        slug: r.slug,
        referente: r.referente,
        utmFuente: r.utmFuente,
        huboFbclid: r.huboFbclid,
        navegador: r.navegador,
        visitas: 0,
        envios: 0,
      };
    f.visitas += 1;
    f.envios += r.envios;
    filas.set(k, f);
  }

  return [...filas.values()].sort(
    (a, b) => a.dia.localeCompare(b.dia) || b.visitas - a.visitas,
  );
}

/// Qué es esta petición para el embudo, si es algo.
function queEs(
  p: Peticion,
): { tipo: 'CATALOGO' | 'HTML' | 'ENVIO'; slug: string } | null {
  /// El catálogo: lleva el slug en la RUTA, así que es
  /// inequívoco venga por la puerta que venga. Es el
  /// denominador bueno — lo pide el formulario ya dibujado.
  const catalogo = /^\/api\/preinscripcion\/([a-z0-9-]+)$/.exec(p.ruta);
  if (catalogo && p.metodo === 'GET') {
    return { tipo: 'CATALOGO', slug: catalogo[1] };
  }

  const envio = /^\/api\/preinscripcion\/([a-z0-9-]+)$/.exec(p.ruta);
  if (envio && p.metodo === 'POST') return { tipo: 'ENVIO', slug: envio[1] };

  /// El HTML: es el único que trae el enlace del anuncio con
  /// sus etiquetas. La raíz de un subdominio NO se puede
  /// atribuir --nginx registra `GET /` y el formato `combined`
  /// no guarda el Host--, así que esa no entra.
  const html = /^\/([a-z0-9-]+)\/preinscripcion$/.exec(p.ruta);
  if (html && p.metodo === 'GET') return { tipo: 'HTML', slug: html[1] };

  return null;
}
