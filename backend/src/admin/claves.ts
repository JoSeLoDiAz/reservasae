/** Hash y verificación de contraseñas. */

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

  // comparación en tiempo constante
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

/** Contraseña temporal legible. */
export function generarClaveTemporal(): string {
  // sin caracteres que se confunden
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(14);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}
