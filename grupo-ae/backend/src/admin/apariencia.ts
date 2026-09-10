import { EsquemaColor } from '../../generated/prisma';
import { conValoresPorDefecto, TOKENS, type ColoresTema } from './temas';

// hexadecimal de 6 digitos
const HEXADECIMAL = /^#[0-9a-fA-F]{6}$/;

/** Solo las claves conocidas y con color valido. */
export function soloTokensValidos(guardados: unknown): ColoresTema {
  if (!guardados || typeof guardados !== 'object' || Array.isArray(guardados)) return {};

  const entrada = guardados as Record<string, unknown>;
  const limpio: ColoresTema = {};
  for (const token of TOKENS) {
    const valor = entrada[token.clave];
    if (typeof valor === 'string' && HEXADECIMAL.test(valor)) limpio[token.clave] = valor;
  }
  return limpio;
}

/** La paleta general con lo propio encima. */
export function fusionarColores(
  esquema: EsquemaColor,
  generales: unknown,
  propios: unknown,
): ColoresTema {
  return {
    ...conValoresPorDefecto(esquema, generales),
    ...soloTokensValidos(propios),
  };
}

/** Qué tokens sobreescribe el formulario. */
export function tokensSobreescritos(propios: unknown): string[] {
  return Object.keys(soloTokensValidos(propios));
}
