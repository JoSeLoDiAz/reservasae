/** Quien puede llamar a las puertas de integracion, y con que llave. */

/**
 * UNA LLAVE POR PROVEEDOR, Y EL PROVEEDOR SALE DE LA LLAVE.
 *
 * Hasta hoy habia una sola --`LUCID_WEBHOOK_SECRET`-- y quien
 * llamaba decia QUIEN era en una cabecera, `x-origen-sistema`,
 * que caia por defecto en «lucid». Con un segundo chatbot eso
 * rompia tres cosas a la vez:
 *
 * 1. **Una conversacion se perdia en silencio.** La idempotencia
 *    es `(origenSistema, externoId)`; si el segundo proveedor no
 *    mandaba la cabecera, un id suyo que coincidiera con uno de
 *    Lucid se contestaba `repetido: true` y la nota NO se
 *    escribia. Sin error, sin reintento, sin rastro en los dos
 *    extremos. Es el fallo mas caro de los que habia.
 * 2. **La nota quedaba firmada por el otro.** El autor estaba
 *    escrito a fuego, y las notas no se borran: «una correccion
 *    es otra nota». Una firma falsa se queda para siempre.
 * 3. **No se podia revocar a uno sin tumbar al otro**, ni saber
 *    en el log quien habia llamado.
 *
 * Derivando el proveedor de la LLAVE y no de una cabecera que
 * elige quien llama, los tres se cierran de una vez y ya no se
 * puede equivocar: sin llave no se entra, y con llave se sabe
 * quien es.
 *
 * LAS VARIABLES NO TUMBAN EL ARRANQUE, igual que antes y por el
 * mismo motivo: sin ninguna configurada se contesta 401 a todo
 * --se falla CERRADO-- y el guard lo grita en el log. Una llave
 * de chatbot no puede impedir que El Socorro se promueva en
 * mitad de una caida, que es lo que haria una variable
 * obligatoria puesta a mano en tres sedes.
 */

import { timingSafeEqual } from 'node:crypto';

/// Las dos cabeceras que traen la llave. `x-clave-integracion`
/// es la buena; `x-clave-lucid` se queda porque Lucid lleva
/// meses mandandola y cambiarla seria cortar el servicio.
/// Son el MISMO mecanismo con dos nombres, no dos
/// autenticaciones: no se entra por una mas debil.
export const CABECERA = 'x-clave-integracion';
export const CABECERA_VIEJA = 'x-clave-lucid';

const LARGO_MINIMO = 32;

/// Publicos: estan en el repositorio.
const DE_EJEMPLO = [
  'cambiar-por-un-secreto-largo-y-aleatorio',
  'cambiar-por-otro-secreto-largo-y-aleatorio-solo-de-pruebas',
];

export type Proveedor = 'lucid' | 'nua';

/**
 * El registro. Añadir uno es una fila y su variable.
 *
 * `firma` es lo que se lee en la ficha, y por eso va aqui y no
 * en el servicio: el nombre del autor y la llave con la que se
 * escribio tienen que salir del mismo sitio o vuelven a poder
 * discrepar.
 *
 * `etiquetaDeLead` ES LA MISMA IDEA, UNA PUERTA MAS ALLA, Y
 * CIERRA UN AGUJERO QUE QUEDABA ABIERTO.
 *
 * La puerta de conversaciones ya derivaba el proveedor de la
 * llave; la de LEADS seguia leyendolo de `x-origen-sistema`, una
 * cabecera que elige quien llama. Y de ese texto depende si el
 * lead cuenta como PAUTA PAGADA: `SISTEMAS_DE_PAUTA` de
 * `leads.service` casa por subcadena contra `meta`, `facebook`,
 * `instagram`, `pauta` y `ads`. O sea que quien tuviera la llave
 * podia marcarse sus propios leads como pagados con solo
 * escribir «ads» en una cabecera, y la metrica de cuanto cuesta
 * un inscrito dejaba de valer.
 *
 * Es literalmente lo que `leads.service` prohibe por escrito:
 * «Pagado u organico, y lo decide QUIEN LO MANDA, no el cuerpo».
 * Una cabecera es el cuerpo.
 *
 * Con la etiqueta aqui, la decision es CONFIGURACION DEL
 * SERVIDOR: esta en el `.env` de cada sede, fuera de git, y quien
 * llama no la puede tocar.
 *
 * LA DE LUCID LLEVA `-ads` A PROPOSITO, y es decision de Josse
 * (8 oct 2026): esos leads entran por un anuncio de Facebook con
 * «clic para enviar mensaje», asi que son pauta. Se decidio
 * sabiendo el costo, que queda escrito: Lucid NO puede distinguir
 * al que llego del anuncio del que escribio al WhatsApp por su
 * cuenta ---comprobado contra su API, que no expone ni la
 * procedencia ni el historial---, asi que los pocos organicos
 * cuentan como pauta. `la-etiqueta-sale-de-la-llave.spec.ts` ata
 * ese `-ads` a que de verdad se clasifique como pagado: si alguien
 * renombra la etiqueta, el test dice que la pauta dejo de contar.
 */
export const PROVEEDORES: ReadonlyArray<{
  nombre: Proveedor;
  variable: string;
  firma: string;
  /// Con que `origenSistema` entran sus LEADS. Fuera del alcance
  /// de quien llama: es lo que decide si cuentan como pauta.
  etiquetaDeLead: string;
}> = [
  {
    nombre: 'lucid',
    variable: 'LUCID_WEBHOOK_SECRET',
    firma: 'Lucid (WhatsApp)',
    etiquetaDeLead: 'lucid-ads',
  },
  {
    nombre: 'nua',
    variable: 'NUA_WEBHOOK_SECRET',
    firma: 'Nua Talker (WhatsApp)',
    etiquetaDeLead: 'nua',
  },
];

/** Con que etiqueta entran los leads de este proveedor. */
export function etiquetaDeLeadDe(nombre: Proveedor): string {
  return PROVEEDORES.find((p) => p.nombre === nombre)?.etiquetaDeLead ?? nombre;
}

export type Entorno = Record<string, string | undefined>;

/** Como firma sus notas este proveedor. */
export function firmaDe(nombre: Proveedor): string {
  return PROVEEDORES.find((p) => p.nombre === nombre)?.firma ?? nombre;
}

/// Una llave sirve si existe, es larga y no es la del ejemplo.
function utilizable(s: string | undefined): s is string {
  return !!s && s.length >= LARGO_MINIMO && !DE_EJEMPLO.includes(s);
}

/** Los proveedores que hoy pueden entrar. Lo mira el arranque. */
export function proveedoresConLlave(env: Entorno = process.env): Proveedor[] {
  return PROVEEDORES.filter((p) => utilizable(env[p.variable])).map((p) => p.nombre);
}

/** Si alguien puede entrar. */
export function hayAlgunaLlave(env: Entorno = process.env): boolean {
  return proveedoresConLlave(env).length > 0;
}

/**
 * De quien es la llave que llego, en tiempo constante.
 *
 * NO se sale en el primer acierto: se comparan TODAS las
 * configuradas. Saliendo antes, el tiempo de respuesta diria
 * cuantos proveedores hay y en que orden estan, que es
 * exactamente lo que `timingSafeEqual` viene a evitar una capa
 * mas abajo.
 */
export function proveedorDeLaClave(
  recibida: string | undefined,
  env: Entorno = process.env,
): Proveedor | null {
  if (!recibida) return null;

  let acertado: Proveedor | null = null;
  const a = Buffer.from(recibida);

  for (const p of PROVEEDORES) {
    const buena = env[p.variable];
    if (!utilizable(buena)) continue;
    const b = Buffer.from(buena);
    if (a.length !== b.length) {
      // se compara igual para no salir antes
      timingSafeEqual(b, b);
      continue;
    }
    if (timingSafeEqual(a, b)) acertado = acertado ?? p.nombre;
  }

  return acertado;
}
