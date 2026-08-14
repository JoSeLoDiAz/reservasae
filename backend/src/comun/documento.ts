/** El documento de una persona, normalizado. */

import { TipoDocumento } from '../../generated/prisma';

/// Sin puntos, sin espacios y en mayusculas: la unicidad
/// depende de que "1.019.456.782" y "1019456782" sean uno.
export function normalizarDocumento(valor: string): string | null {
  const limpio = valor
    .replace(/[\s.\-_]/g, '')
    .trim()
    .toUpperCase();

  if (!limpio) return null;
  if (!/^[A-Z0-9]{4,20}$/.test(limpio)) return null;
  return limpio;
}

/** Solo dígitos: los de cédula colombiana. */
const SOLO_DIGITOS: TipoDocumento[] = ['CC', 'TI', 'RC', 'NIT'];

export function documentoValido(tipo: TipoDocumento, numero: string): boolean {
  if (SOLO_DIGITOS.includes(tipo)) return /^\d{4,15}$/.test(numero);
  return /^[A-Z0-9]{4,20}$/.test(numero);
}

/** El nombre como lo pide el cargue: en cuatro partes. */
export type NombrePartido = {
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
};

/// Solo para sugerir al teclear: partir por espacios se
/// equivoca con "DE LA HOZ", asi que el asesor corrige.
export function sugerirNombre(completo: string): NombrePartido | null {
  const partes = completo
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean);

  if (partes.length < 2) return null;

  if (partes.length === 2) {
    return {
      primerNombre: partes[0],
      segundoNombre: null,
      primerApellido: partes[1],
      segundoApellido: null,
    };
  }

  if (partes.length === 3) {
    return {
      primerNombre: partes[0],
      segundoNombre: null,
      primerApellido: partes[1],
      segundoApellido: partes[2],
    };
  }

  return {
    primerNombre: partes[0],
    segundoNombre: partes[1],
    primerApellido: partes[2],
    segundoApellido: partes.slice(3).join(' '),
  };
}

/** Para listados y saludos. */
export function nombreCompleto(p: {
  primerNombre: string;
  segundoNombre?: string | null;
  primerApellido: string;
  segundoApellido?: string | null;
}): string {
  return [p.primerNombre, p.segundoNombre, p.primerApellido, p.segundoApellido]
    .filter(Boolean)
    .join(' ');
}
