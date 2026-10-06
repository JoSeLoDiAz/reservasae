/** Quien dice que NO fue beneficiario del SENA no queda como que sí. */

/**
 * `beneficiarioPrevio` era el único booleano del módulo de
 * preinscripción sin `booleanoDeVerdad`. Sus cuatro hermanos del
 * mismo fichero sí lo llevan —`aceptaPolitica` por dos veces,
 * `caracterizacionRechazada` y `rutPropio`—, y este se quedó
 * fuera.
 *
 * `main.ts` monta el ValidationPipe con
 * `enableImplicitConversion: true`, que convierte un `boolean`
 * con la regla de JavaScript: cualquier cadena no vacía es
 * `true`. Así que un cliente que serialice a texto —y este
 * endpoint es PÚBLICO, quien lo llama no es una pantalla
 * nuestra— mandaba `"false"` y la ficha afirmaba que la persona
 * YA había sido beneficiaria del SENA cuando había dicho lo
 * contrario.
 *
 * Y no se queda en la base: es columna del F7. El «no» de la
 * persona viajaba al SENA convertido en «sí».
 *
 * Lo que lo tapaba es que `"false"` pasa la validación sin
 * quejarse: después de la conversión es un booleano perfecto, y
 * `@IsBoolean()` no tiene nada que objetar.
 */

/// Lo carga `main.ts` en la aplicación de verdad; aquí hay que
/// pedirlo a mano o los decoradores no tienen metadatos.
import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';

import { DatosPersonaDto } from './dto';

/// Lo mismo que monta `main.ts`.
const comoEnProduccion = { enableImplicitConversion: true };

const arma = (crudo: Record<string, unknown>) =>
  plainToInstance(DatosPersonaDto, crudo, comoEnProduccion);

describe('ya fue beneficiario del SENA', () => {
  it('«false» con comillas es NO, no un sí', () => {
    /// El caso exacto del defecto: antes salía `true`.
    expect(arma({ beneficiarioPrevio: 'false' }).beneficiarioPrevio).toBe(
      false,
    );
  });

  it('un false de verdad sigue siendo false', () => {
    expect(arma({ beneficiarioPrevio: false }).beneficiarioPrevio).toBe(false);
  });

  it('y un sí sigue siendo un sí, por las dos vías', () => {
    expect(arma({ beneficiarioPrevio: true }).beneficiarioPrevio).toBe(true);
    expect(arma({ beneficiarioPrevio: 'true' }).beneficiarioPrevio).toBe(true);
  });

  it('no contestar no es contestar «no»', () => {
    /// El campo es opcional y hay fichas donde nadie lo ha
    /// preguntado. Convertirlo en `false` diría que se le
    /// preguntó y dijo que no, que es otra cosa.
    expect(arma({}).beneficiarioPrevio).toBeUndefined();
  });
});
