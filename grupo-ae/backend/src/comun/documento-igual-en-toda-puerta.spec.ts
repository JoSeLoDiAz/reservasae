/** El mismo documento, escrito de cualquier forma, es el mismo. */

/**
 * `Persona` es única por `(tipoDocumentoSepId, numeroDocumento)`,
 * y de esa garantía cuelga una decisión grande: **no existe
 * pantalla de fusionar duplicados**, porque el duplicado por
 * documento se declara imposible.
 *
 * Pero el `@@unique` compara TEXTO. `1.020.304.050` y
 * `1020304050` son dos cadenas distintas, así que crean dos
 * personas — y la garantía se cae.
 *
 * Todas las puertas normalizaban antes de escribir… menos la
 * preinscripción pública, que hacía solo `.trim()`. O sea que el
 * duplicado imposible se podía crear justo por donde entra más
 * gente, y sin pantalla para arreglarlo después.
 *
 * Este spec fija la NORMALIZACIÓN, que es la regla; que cada
 * puerta la use se comprueba en el spec de su puerta.
 */

import { normalizarDocumento } from './documento';

describe('la misma cédula escrita de seis formas', () => {
  /// Las que de verdad llegan de un formulario público.
  const FORMAS = [
    '1020304050',
    '1.020.304.050',
    '1 020 304 050',
    ' 1020304050 ',
    '1-020-304-050',
    '1_020_304_050',
  ];

  it('todas dan el mismo número', () => {
    const salidas = new Set(FORMAS.map((f) => normalizarDocumento(f)));

    expect({ formas: FORMAS.length, distintas: salidas.size }).toEqual({
      formas: FORMAS.length,
      distintas: 1,
    });
    expect([...salidas][0]).toBe('1020304050');
  });

  it('con `trim` a secas serían SEIS personas distintas', () => {
    /// Esto no prueba el arreglo: prueba por qué hacía falta.
    /// Es lo que hacía la preinscripción pública.
    const conTrim = new Set(FORMAS.map((f) => f.trim()));
    expect(conTrim.size).toBeGreaterThan(1);
  });
});

describe('un pasaporte no se rompe al normalizar', () => {
  it('las letras se conservan, en mayúscula', () => {
    /// El documento no siempre es numérico, y aplastar letras
    /// convertiría dos pasaportes en el mismo.
    expect(normalizarDocumento('ab-123456')).toBe('AB123456');
    expect(normalizarDocumento('AB123456')).toBe('AB123456');
  });

  it('dos pasaportes distintos siguen siendo distintos', () => {
    expect(normalizarDocumento('AB123456')).not.toBe(
      normalizarDocumento('AC123456'),
    );
  });
});

describe('lo que no tiene forma de documento se rechaza', () => {
  it('vacío, o solo separadores', () => {
    for (const malo of ['', '   ', '...', '---']) {
      expect({ malo, sale: normalizarDocumento(malo) }).toEqual({
        malo,
        sale: null,
      });
    }
  });

  it('demasiado corto o con símbolos raros', () => {
    /// `null` y no una cadena rara: quien llama tiene que poder
    /// distinguir «no sirve» de «aquí tienes algo».
    expect(normalizarDocumento('12')).toBeNull();
    expect(normalizarDocumento('12/34')).toBeNull();
  });
});
