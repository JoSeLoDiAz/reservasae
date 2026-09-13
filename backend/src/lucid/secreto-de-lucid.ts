/** Quien puede dejar notas de WhatsApp, y con que llave. */

/**
 * Segunda puerta que escribe en el CRM **sin sesion**, despues
 * de la de leads. Misma comparacion en tiempo constante y mismo
 * minimo de 32 caracteres.
 *
 * LO QUE CAMBIA, Y ES DELIBERADO: esta variable **no tumba el
 * arranque**. La de leads si, y su docblock dice que la
 * alternativa seria «dejar la ruta abierta si falta la
 * variable». Pero eso es fallar ABIERTO, que no es lo que se
 * hace aqui: sin llave configurada `claveCorrecta` devuelve
 * false y la ruta contesta 401 a todo. La seguridad es
 * identica --lo demuestra la propia puerta de leads, cuya
 * `claveCorrecta` ya devuelve false sin variable--; lo que
 * cambia es el radio de dano.
 *
 * Y ese radio no guarda ninguna proporcion con la pieza: una
 * llave de chatbot no puede tumbar el formulario publico, el
 * panel y las reservas. Peor todavia con TRES SEDES: el .env se
 * pone a mano en cada maquina y quien levanta la aplicacion en
 * El Socorro es `autopromover.sh`, solo, en mitad de una caida.
 * Una variable obligatoria que falte alli convierte el failover
 * automatico en un fallo de arranque, justo cuando nadie mira.
 *
 * EL PRECIO se paga en `onModuleInit`: apagada se dice a
 * gritos en el log de cada sede, igual que hacen el worker del
 * RUI y el correo. Sin ese aviso esta decision seria al reves,
 * porque las notas no tienen contador natural: nadie sabe
 * cuantas deberia haber hoy.
 */

import { timingSafeEqual } from 'node:crypto';

/// La cabecera que trae la llave. Se nombra por QUIEN llama,
/// como `x-clave-leads`. Nada de «-signature»: eso anuncia un
/// HMAC sobre el cuerpo crudo y aqui no lo hay.
export const CABECERA = 'x-clave-lucid';

const LARGO_MINIMO = 32;

/// Publicos: estan en el repositorio.
const DE_EJEMPLO = [
  'cambiar-por-un-secreto-largo-y-aleatorio',
  'cambiar-por-otro-secreto-largo-y-aleatorio-solo-de-pruebas',
];

type Entorno = { LUCID_WEBHOOK_SECRET?: string };

/** Si hay llave utilizable. Lo mira el aviso del arranque. */
export function hayLlaveDeLucid(env: Entorno = process.env): boolean {
  const s = env.LUCID_WEBHOOK_SECRET;
  return !!s && s.length >= LARGO_MINIMO && !DE_EJEMPLO.includes(s);
}

/** La llave que llego, en tiempo constante. */
export function claveCorrecta(
  recibida: string | undefined,
  env: Entorno = process.env,
): boolean {
  if (!hayLlaveDeLucid(env)) return false;
  if (!recibida) return false;

  const buena = env.LUCID_WEBHOOK_SECRET as string;
  const a = Buffer.from(recibida);
  const b = Buffer.from(buena);
  if (a.length !== b.length) {
    // se compara igual para no salir antes
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
