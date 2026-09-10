/** El celular que cuenta como contacto. */

import { celularUtil, celularValido, normalizarCelular } from './celular';

describe('celularValido', () => {
  it('un móvil colombiano vale', () => {
    expect(celularValido('3001234567')).toBe(true);
    expect(celularValido('3201234567')).toBe(true);
  });

  it('con separadores y con indicativo, también', () => {
    expect(celularValido('300 123 4567')).toBe(true);
    expect(celularValido('(300) 123-4567')).toBe(true);
    expect(celularValido('+57 300 123 4567')).toBe(true);
    expect(celularValido('573001234567')).toBe(true);
  });

  it('lo que no es un número, no', () => {
    /// Es lo que colaba: la compuerta de matrícula lo aceptaba
    /// como «alguna forma de contactarla».
    expect(celularValido('no tiene')).toBe(false);
    expect(celularValido('pendiente')).toBe(false);
    expect(celularValido('123')).toBe(false);
  });

  it('un fijo no es un celular', () => {
    /// La columna del SEP es de celular y un fijo no recibe
    /// mensajes, que es para lo que se pide.
    expect(celularValido('6041234567')).toBe(false);
    expect(celularValido('1234567')).toBe(false);
  });

  it('vacío vale: el celular es opcional', () => {
    expect(celularValido('')).toBe(true);
    expect(celularValido(null)).toBe(true);
    expect(celularValido(undefined)).toBe(true);
  });
});

describe('celularUtil', () => {
  it('vacío NO sirve para contactar', () => {
    /// Aquí está la diferencia con `celularValido`: para
    /// guardar, vacío está bien; para matricular, no.
    expect(celularUtil(null)).toBe(false);
    expect(celularUtil('')).toBe(false);
  });

  it('un móvil sí', () => {
    expect(celularUtil('3001234567')).toBe(true);
  });

  it('basura no', () => {
    expect(celularUtil('no tiene')).toBe(false);
  });
});

describe('normalizarCelular', () => {
  it('quita separadores e indicativo', () => {
    expect(normalizarCelular('+57 (300) 123-4567')).toBe('3001234567');
  });

  it('no toca un número de diez dígitos', () => {
    expect(normalizarCelular('3001234567')).toBe('3001234567');
  });
});
