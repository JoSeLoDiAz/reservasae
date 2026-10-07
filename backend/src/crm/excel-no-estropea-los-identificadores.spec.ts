/** Excel no puede convertir un identificador en un número. */

/**
 * «1,20E+17» EN LA COLUMNA DE CAMPAÑA (cliente, 7 oct 2026), mirando
 * el volcado de Gestión de leads.
 *
 * El CSV lleva el número entero ---`120210000000000000`, el id de una
 * campaña de Meta--- y es Excel el que lo convierte al abrir: lee como
 * número cualquier celda que lo parezca, y uno de dieciocho cifras no
 * cabe en la precisión de un `double`. Lo enseña en notación
 * científica y PIERDE las cifras de en medio: el id ya no sirve para
 * cruzar nada.
 *
 * Entrecomillar no basta ---Excel ignora las comillas para decidir el
 * tipo--- así que la celda se manda como fórmula de texto.
 *
 * SE PRUEBA LA REGLA, no el fuente. El frontend no tiene corredor,
 * pero esto es una función pura en un `.ts` plano, así que se importa
 * y se ejercita: es la lección que dejó la corrección de Josse en
 * `acreditar-gestion.ts`, y aquí sí se puede hacer bien.
 */

import {
  celdaParaExcel,
  excelLoVaAEstropear,
} from '../../../frontend/src/lib/celda-de-excel';

describe('lo que Excel estropea', () => {
  /// El caso que lo destapó: un id de campaña de Meta.
  it('un número de dieciocho cifras', () => {
    expect(excelLoVaAEstropear('120210000000000000')).toBe(true);
  });

  /**
   * Y EL CERO DE DELANTE, que es el peor de los dos: un documento que
   * empieza por cero sale sin él y ese número viaja al SENA. Pasa por
   * corto que sea, así que no lo salva el tamaño.
   */
  it('un documento que empieza por cero, aunque sea corto', () => {
    expect(excelLoVaAEstropear('0123456789')).toBe(true);
    expect(excelLoVaAEstropear('0123')).toBe(true);
  });
});

describe('lo que NO hay que tocar', () => {
  /**
   * Es la otra mitad: marcarlo todo como texto dejaría las columnas
   * de cifras sin sumarse ni ordenarse como números, y eso es la
   * mitad de para lo que se baja el archivo.
   */
  it('un documento normal de diez cifras', () => {
    expect(excelLoVaAEstropear('1037575669')).toBe(false);
  });

  it('un celular', () => {
    expect(excelLoVaAEstropear('3185148684')).toBe(false);
  });

  /// El NIT lleva guion, así que Excel ya lo deja en paz.
  it('un NIT con su dígito de verificación', () => {
    expect(excelLoVaAEstropear('800214750-7')).toBe(false);
  });

  it('una marca de campaña con letras', () => {
    expect(excelLoVaAEstropear('eduteka')).toBe(false);
    expect(excelLoVaAEstropear('mailing-andep')).toBe(false);
  });

  it('lo vacío y un cero suelto', () => {
    expect(excelLoVaAEstropear('')).toBe(false);
    /// Un cero solo es un cero, no un documento al que le falte nada.
    expect(excelLoVaAEstropear('0')).toBe(false);
  });
});

describe('cómo sale la celda', () => {
  it('el identificador va como fórmula de texto', () => {
    expect(celdaParaExcel('120210000000000000')).toBe(
      '"=""120210000000000000"""',
    );
  });

  it('y lo demás, entrecomillado y nada más', () => {
    expect(celdaParaExcel('1037575669')).toBe('"1037575669"');
    expect(celdaParaExcel('eduteka')).toBe('"eduteka"');
  });

  /// Las comillas de dentro se duplican, que es como las lee Excel.
  /// Sin esto, un nombre con comillas parte la fila en dos celdas.
  it('una comilla dentro del texto no parte la fila', () => {
    expect(celdaParaExcel('Colegio "El Roble"')).toBe(
      '"Colegio ""El Roble"""',
    );
  });

  it('lo nulo sale vacío y no como «null»', () => {
    expect(celdaParaExcel(null)).toBe('""');
    expect(celdaParaExcel(undefined)).toBe('""');
  });
});
