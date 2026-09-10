/** Contra qué base se está a punto de escribir. */

/**
 * Existe porque una base local y el túnel a producción son
 * INDISTINGUIBLES desde la cadena de conexión: las dos son
 * `reservasae` en `localhost:5433`. En el portátil de Josse hay
 * una tarea programada que abre ese túnel en cada inicio de
 * sesión, así que «localhost» lleva meses queriendo decir
 * «producción» sin que nada lo dijera.
 *
 * `CLAUDE.md` lo avisa en negrita dos veces y aun así casi pasa:
 * un `prisma migrate status` lanzado para preparar una migración
 * salió contra la base real y solo falló porque el túnel no
 * respondía en ese momento. Un aviso escrito no es un candado.
 *
 * La regla es una sola y es de puerto: **el 5433 es producción**.
 * Quien quiera una base propia usa otro puerto, y así la cadena
 * de conexión vuelve a decir la verdad. Es más burdo que mirar
 * el nombre de la base, y por eso funciona: no hay forma de
 * confundirse sin querer.
 *
 * Se puede saltar con `PERMITIR_PRODUCCION=si`, y tiene que
 * poder saltarse: alguna vez hay que corregir producción a mano.
 * Lo que no puede es pasar por descuido.
 */

export type Destino = {
  /// Que se le va a decir a quien lo lea.
  etiqueta: string;
  esProduccion: boolean;
  /// Null cuando se puede seguir.
  rechazo: string | null;
};

type Entorno = { DATABASE_URL?: string; PERMITIR_PRODUCCION?: string };

/// El puerto que el tunel de produccion ocupa.
const PUERTO_DE_PRODUCCION = '5433';

/** Lo que se puede decir de una cadena sin conectarse. */
function leer(url: string): { host: string; puerto: string; base: string } {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      puerto: u.port || '5432',
      base: u.pathname.replace(/^\//, '') || '(sin nombre)',
    };
  } catch {
    return { host: '?', puerto: '?', base: '?' };
  }
}

/**
 * Decide contra qué se va a escribir, sin conectarse a nada.
 *
 * Es una función pura para poder probarla: la alternativa —mirar
 * si el proceso del puerto es `ssh`— acierta más y no se puede
 * fijar en un test, y un candado que no se prueba es el que
 * falla el día que importa.
 */
export function destinoDeLaBase(env: Entorno = process.env): Destino {
  const url = env.DATABASE_URL;
  if (!url) {
    return {
      etiqueta: 'sin DATABASE_URL',
      esProduccion: false,
      rechazo: 'No hay DATABASE_URL. Copie backend/.env.example y ajústelo.',
    };
  }

  const { host, puerto, base } = leer(url);
  const etiqueta = `${base} en ${host}:${puerto}`;

  /// El 5433 es produccion, venga de donde venga.
  ///
  /// Da igual que el host diga «localhost»: eso es justo lo que
  /// hace el tunel, y es lo que engana.
  const esProduccion = puerto === PUERTO_DE_PRODUCCION;
  if (!esProduccion) return { etiqueta, esProduccion: false, rechazo: null };

  if (env.PERMITIR_PRODUCCION === 'si') {
    return { etiqueta, esProduccion: true, rechazo: null };
  }

  return {
    etiqueta,
    esProduccion: true,
    rechazo:
      `Esto escribe en «${etiqueta}», que es PRODUCCIÓN.\n\n` +
      'El puerto 5433 lo ocupa el túnel SSH a sep-vm, así que «localhost» ahí ' +
      'no es su equipo: es la base real, con las reservas de verdad.\n\n' +
      'Si quería su propia base, levántela en otro puerto y apunte ahí\n' +
      'DATABASE_URL (ver «Trabajar en local» en CLAUDE.md).\n' +
      'Si quería la de pruebas: scripts\\tunel-pruebas.ps1 la trae al 5434.\n\n' +
      'Y si de verdad quería tocar producción, dígalo:\n' +
      '  PERMITIR_PRODUCCION=si pnpm ...',
  };
}

/**
 * Se planta si el destino es producción. Lo llaman los guiones.
 *
 * Sale con código 1 en vez de lanzar: quien esto para es una
 * persona en una terminal, y una traza de Node no le dice nada.
 */
export function exigirBaseSegura(que = 'Este guión'): void {
  const destino = destinoDeLaBase();
  if (destino.rechazo) {
    console.error(`\n✋ ${que} no va a correr.\n\n${destino.rechazo}\n`);
    process.exit(1);
  }
  if (destino.esProduccion) {
    console.warn(`\n⚠️  PRODUCCIÓN (${destino.etiqueta}) — autorizado a mano.\n`);
  }
}
