/** Un «false» con comillas es un NO. */

/**
 * `aceptaHabeasData` es la constancia de que la persona marcó la
 * casilla de tratamiento de datos. Y `main.ts` monta el
 * `ValidationPipe` con `enableImplicitConversion: true`, que para
 * un campo `boolean` convierte con la regla de JavaScript:
 * cualquier cadena no vacía es `true`.
 *
 * Así que `"false"` llegaba como **true**, y a esa persona se le
 * estampaba una autorización que no dio. Comprobado en vivo contra
 * el webhook antes de arreglarlo: se guardó `t`.
 *
 * ESTE SPEC CONSTRUYE EL DTO CON LAS MISMAS OPCIONES QUE `main.ts`,
 * y esa es toda la razón de que exista: con las de por defecto de
 * `plainToInstance` el defecto NO SE REPRODUCE y el test pasa en
 * verde mientras el servidor falla. Es la misma trampa que ya se
 * documentó con los números y la cadena vacía.
 */

/// Antes que nada: los decoradores de class-validator lo
/// necesitan y jest no lo carga solo. Mismo import que
/// `campo-vacio.spec.ts`.
import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';

import { EntraLeadDto } from './dto';

/// Las MISMAS que `main.ts`. Si alguien las cambia allá y no
/// aquí, este spec deja de probar lo que dice probar.
const COMO_EN_MAIN = { enableImplicitConversion: true };

function comoLlega(cuerpo: Record<string, unknown>): boolean | undefined {
  return plainToInstance(EntraLeadDto, cuerpo, COMO_EN_MAIN).aceptaHabeasData;
}

describe('el booleano de verdad', () => {
  it('true y false booleanos pasan tal cual', () => {
    expect(comoLlega({ aceptaHabeasData: true })).toBe(true);
    expect(comoLlega({ aceptaHabeasData: false })).toBe(false);
  });

  it('«false» EN TEXTO es false, no true', () => {
    /// El defecto, en una línea. Sin el transform esto daba true.
    expect(comoLlega({ aceptaHabeasData: 'false' })).toBe(false);
  });

  it('«true» en texto sigue siendo true', () => {
    expect(comoLlega({ aceptaHabeasData: 'true' })).toBe(true);
  });
});

describe('las formas que manda un integrador de verdad', () => {
  const NO = ['false', 'False', 'FALSE', '0', 'no', 'NO', 'n', 'off', '', '  '];
  const SI = ['true', 'True', '1', 'si', 'Sí', 'yes', 'y', 'on'];

  it.each(NO)('«%s» es NO', (v) => {
    expect(comoLlega({ aceptaHabeasData: v })).toBe(false);
  });

  it.each(SI)('«%s» es SÍ', (v) => {
    expect(comoLlega({ aceptaHabeasData: v })).toBe(true);
  });

  it('el 0 y el 1 numéricos también', () => {
    expect(comoLlega({ aceptaHabeasData: 0 })).toBe(false);
    expect(comoLlega({ aceptaHabeasData: 1 })).toBe(true);
  });
});

describe('lo que no se entiende NO se inventa', () => {
  it('sin el campo, queda sin decir', () => {
    /// `undefined` es «no lo mandó», y eso tiene su propio
    /// significado: vale el argumento de que el formulario no se
    /// puede enviar sin aceptar. No es lo mismo que un NO.
    expect(comoLlega({})).toBeUndefined();
  });

  it('null tampoco es un sí', () => {
    expect(comoLlega({ aceptaHabeasData: null })).toBeUndefined();
  });

  it('una palabra rara queda sin decir, nunca en true', () => {
    /// Inventar un `true` por no saber leer el valor es
    /// exactamente lo que esto existe para evitar.
    expect(comoLlega({ aceptaHabeasData: 'quizá' })).toBeUndefined();
    expect(comoLlega({ aceptaHabeasData: 'acepto' })).toBeUndefined();
  });
});
