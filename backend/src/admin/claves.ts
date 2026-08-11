/** Contraseñas con `scrypt`: bcrypt y argon2 piden node-gyp. */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(scrypt) as (
  clave: string,
  sal: Buffer,
  largo: number,
) => Promise<Buffer>;

const LARGO_SAL = 16;
const LARGO_HASH = 64;

export const CLAVE_LARGO_MINIMO = 10;

/** Formato: `scrypt$<sal en base64>$<hash en base64>`. */
export async function hashearClave(clave: string): Promise<string> {
  const sal = randomBytes(LARGO_SAL);
  // NFKC: la misma tilde en dos bytes distintos
  const hash = await derivar(clave.normalize('NFKC'), sal, LARGO_HASH);
  return `scrypt$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export async function verificarClave(clave: string, guardado: string): Promise<boolean> {
  const [algoritmo, salBase64, hashBase64] = guardado.split('$');
  if (algoritmo !== 'scrypt' || !salBase64 || !hashBase64) return false;

  const sal = Buffer.from(salBase64, 'base64');
  const esperado = Buffer.from(hashBase64, 'base64');
  const calculado = await derivar(clave.normalize('NFKC'), sal, esperado.length);

  // tiempo constante: un === filtra por lo que tarda
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

/** Contraseña temporal legible, para dictarla por teléfono sin ambigüedad. */
export function generarClaveTemporal(): string {
  // Sin I, l, 1, O ni 0: son las que se confunden al leerlas en voz alta.
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(14);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}
