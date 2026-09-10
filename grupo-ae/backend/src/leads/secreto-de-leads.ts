/** Quién puede meter leads, y con qué llave. */

/**
 * El webhook es la única puerta del sistema que **escribe sin
 * sesión**. Sin llave, cualquiera con la URL inventa personas en
 * el CRM: no es una fuga de datos, es peor — es contaminar el
 * dato con el que se le reporta al SENA.
 *
 * El secreto es obligatorio y el backend **no arranca sin él**,
 * igual que `ADMIN_JWT_SECRET`. La alternativa —dejar la ruta
 * abierta si falta la variable— es exactamente el fallo que este
 * proyecto llama «el control en pie y vacío de efecto»: la ruta
 * existiría, parecería protegida, y no lo estaría.
 *
 * Se compara en **tiempo constante**. Un `===` sobre una cadena
 * corta de más se rinde en la primera letra distinta, y eso deja
 * medir cuántas acierta quien lo intenta muchas veces. Cuesta
 * una línea y quita el problema entero.
 */

import { timingSafeEqual } from 'node:crypto';

/// La cabecera que trae la llave.
export const CABECERA = 'x-clave-leads';

/// Lo mínimo para que la llave sirva de algo.
const LARGO_MINIMO = 32;

type Entorno = { LEADS_WEBHOOK_SECRET?: string };

/** Se planta al arrancar si no hay llave. Lo llama `main.ts`. */
export function exigirSecretoDeLeads(env: Entorno = process.env): void {
  const s = env.LEADS_WEBHOOK_SECRET;
  if (!s || s.length < LARGO_MINIMO) {
    throw new Error(
      `Falta LEADS_WEBHOOK_SECRET (mínimo ${LARGO_MINIMO} caracteres) en el entorno. ` +
        'Es la llave del webhook de leads, que escribe en el CRM sin sesión. ' +
        "Generar una con: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
    );
  }
}

/** ¿La llave que llegó es la buena? */
export function claveCorrecta(
  recibida: string | undefined,
  env: Entorno = process.env,
): boolean {
  const buena = env.LEADS_WEBHOOK_SECRET;
  if (!buena || buena.length < LARGO_MINIMO) return false;
  if (!recibida) return false;

  /// `timingSafeEqual` revienta si los largos no coinciden, y
  /// ese error ya filtra el largo. Se comparan los dos como
  /// bytes del mismo tamaño para que ni eso se escape.
  const a = Buffer.from(recibida);
  const b = Buffer.from(buena);
  if (a.length !== b.length) {
    // se compara igual, contra si misma, para no salir antes
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
