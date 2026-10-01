/** Microempresa, y cuál de las tres. */

import {
  MICROEMPRESA_COMERCIO,
  MICROEMPRESA_MANUFACTURA,
  MICROEMPRESA_SERVICIOS,
  tamanoDeIndependiente,
} from './tamano-del-independiente';

describe('el tamaño de quien factura con su cédula', () => {
  it('comercio va a la casilla de comercio', () => {
    expect(tamanoDeIndependiente('Comercio')).toBe(MICROEMPRESA_COMERCIO);
  });

  it('industria y manufactura, a manufactura', () => {
    expect(tamanoDeIndependiente('Industria y manufactura')).toBe(
      MICROEMPRESA_MANUFACTURA,
    );
  });

  it('lo demás cae en servicios, que es la casilla residual del SEP', () => {
    /// Construcción y agricultura no son ni lo uno ni lo otro, y el SEP
    /// no tiene una cuarta donde ponerlas.
    for (const s of [
      'Construcción',
      'Agricultura y sector agropecuario',
      'Educación',
      'Salud',
      'Belleza y cuidado personal',
      'Otro',
    ]) {
      expect(tamanoDeIndependiente(s)).toBe(MICROEMPRESA_SERVICIOS);
    }
  });

  /**
   * LAS FICHAS VIEJAS Y LAS DEL RUES, que es lo que rompe un mapa por
   * igualdad exacta: antes los valores eran «COMERCIO», «SERVICIOS» y
   * «MANUFACTURA» en mayúsculas, y del RUES llegan con sus propias
   * palabras.
   */
  it('no se le atraganta el acento ni la mayúscula', () => {
    expect(tamanoDeIndependiente('COMERCIO')).toBe(MICROEMPRESA_COMERCIO);
    expect(tamanoDeIndependiente('MANUFACTURA')).toBe(MICROEMPRESA_MANUFACTURA);
    expect(tamanoDeIndependiente('  Construcción  ')).toBe(
      MICROEMPRESA_SERVICIOS,
    );
  });

  /**
   * SIN SECTOR NO SE ADIVINA, y esto es lo que más importa de este
   * spec: poner una de las tres al azar mete un dato inventado en el
   * archivo que se le entrega al SENA. Vale más un hueco que una
   * mentira.
   */
  it('sin sector, nada', () => {
    expect(tamanoDeIndependiente(null)).toBeNull();
    expect(tamanoDeIndependiente(undefined)).toBeNull();
    expect(tamanoDeIndependiente('')).toBeNull();
  });
});
