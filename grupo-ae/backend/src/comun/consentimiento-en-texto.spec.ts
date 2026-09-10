/** Un «false» con comillas tampoco firma en los formularios públicos. */

/**
 * José cerró esto en el webhook de leads (`aceptaHabeasData`).
 * El defecto es de CLASE, no de campo: `enableImplicitConversion`
 * convierte cualquier `boolean` con la regla de JavaScript, así
 * que toda cadena no vacía —«false» incluida— llega como `true`.
 *
 * Quedaban tres campos de consentimiento sin cubrir, y los tres
 * en endpoints PÚBLICOS: los llama cualquiera, no una pantalla
 * nuestra, así que el tipo del JSON no se puede dar por bueno.
 *
 * El de reservas es el peor de los tres. Lleva
 * `@Equals(true, …)`, que existe precisamente para exigir el
 * consentimiento — pero la conversión ocurre ANTES de validar,
 * así que `"false"` se volvía `true` y pasaba el candado que
 * debía frenarlo. Un candado que se abre solo es peor que
 * ninguno: parece que hay uno.
 */

/// Lo carga `main.ts` en la aplicacion de verdad; aqui hay que
/// pedirlo a mano o los decoradores no tienen metadatos.
import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { CrearReservaDto } from '../reservas/dto/crear-reserva.dto';
import { DatosPersonaDto, CrearPreinscripcionDto } from '../preinscripcion/dto';

/// Lo mismo que monta `main.ts`.
const comoEnProduccion = { enableImplicitConversion: true };

const arma = <T>(clase: new () => T, crudo: Record<string, unknown>): T =>
  plainToInstance(clase, crudo, comoEnProduccion) as T;

describe('el formulario de preinscripción', () => {
  it('«false» con comillas NO acepta la política', () => {
    const dto = arma(CrearPreinscripcionDto, { aceptaPolitica: 'false' });
    expect(dto.aceptaPolitica).toBe(false);
  });

  it('un false de verdad sigue siendo false', () => {
    expect(arma(CrearPreinscripcionDto, { aceptaPolitica: false }).aceptaPolitica).toBe(false);
  });

  it('y un sí sigue siendo un sí, por las dos vías', () => {
    expect(arma(CrearPreinscripcionDto, { aceptaPolitica: true }).aceptaPolitica).toBe(true);
    expect(arma(CrearPreinscripcionDto, { aceptaPolitica: 'true' }).aceptaPolitica).toBe(true);
  });
});

describe('el formulario de completar ficha', () => {
  it('«false» con comillas NO acepta la política', () => {
    expect(arma(DatosPersonaDto, { aceptaPolitica: 'false' }).aceptaPolitica).toBe(false);
  });
});

describe('la reserva de una empresa', () => {
  /// Aquí no basta con mirar el valor: lo que hay que probar es
  /// que el `@Equals(true)` frena. Antes no frenaba.
  const conConsentimiento = (v: unknown) => {
    const dto = arma(CrearReservaDto, {
      aceptaTerminos: v,
      aceptaPoliticaDatos: v,
    });
    const fallos = validateSync(dto as object).map((e) => e.property);
    return {
      terminos: dto.aceptaTerminos,
      frenado:
        fallos.includes('aceptaTerminos') && fallos.includes('aceptaPoliticaDatos'),
    };
  };

  it('«false» con comillas se frena, no se cuela', () => {
    const r = conConsentimiento('false');
    expect(r.terminos).toBe(false);
    expect(r.frenado).toBe(true);
  });

  it('un false de verdad también se frena', () => {
    expect(conConsentimiento(false).frenado).toBe(true);
  });

  it('quien sí acepta pasa', () => {
    expect(conConsentimiento(true).frenado).toBe(false);
  });
});
