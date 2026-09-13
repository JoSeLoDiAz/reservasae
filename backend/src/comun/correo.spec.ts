/** Un correo que no lo es no sirve para contactar a nadie. */

import { correoUtil, correoValido, normalizarCorreo } from './correo';

describe('qué se acepta como correo', () => {
  /// El test que faltó la vez que el saneador se comió una
  /// letra: que lo CORRIENTE pase entero.
  it.each([
    'ana@ejemplo.test',
    'a.b+c@colegio.edu.co',
    'jose.luis@grupo-ae.com.co',
    'x@y.co',
  ])('%s es un correo', (valor) => {
    expect(correoValido(valor)).toBe(true);
    expect(correoUtil(valor)).toBe(true);
  });

  it.each([
    'esto-no-es-un-correo',
    'no tiene',
    'ana@',
    '@ejemplo.test',
    'ana@ejemplo',
    'ana ruiz@ejemplo.test',
  ])('%s no lo es', (valor) => {
    expect(correoValido(valor)).toBe(false);
    expect(correoUtil(valor)).toBe(false);
  });
});

describe('vacío no es lo mismo que inválido', () => {
  /// La misma distinción que `celularValido` contra
  /// `celularUtil`: el correo es opcional, pero un hueco no
  /// sirve para escribirle a nadie.
  it.each([null, undefined, '', '   '])('%s vale, pero no sirve', (valor) => {
    expect(correoValido(valor)).toBe(true);
    expect(correoUtil(valor)).toBe(false);
  });
});

describe('se normaliza antes de juzgar', () => {
  it('recorta y baja a minúsculas', () => {
    expect(normalizarCorreo('  ANA@Ejemplo.Test ')).toBe('ana@ejemplo.test');
    expect(correoValido('  ANA@Ejemplo.Test ')).toBe(true);
  });
});
