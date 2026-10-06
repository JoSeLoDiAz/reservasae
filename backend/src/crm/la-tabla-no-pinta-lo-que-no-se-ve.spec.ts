/** Las filas fuera del cajón no se pintan, y los anchos no se clavan. */

/**
 * «Cuando en Gestión de leads voy moviendo o dando scroll a la
 * derecha se pega horrible; esto nunca había pasado» (cliente, 5 oct
 * 2026).
 *
 * La tabla de leads son 29 columnas por 100 filas: 2.900 celdas y
 * 4.672 px de ancho, de los que se ve un tercio. El arreglo es dejar
 * que el navegador se salte las filas que quedan fuera del cajón.
 *
 * ESTO FIJA DOS COSAS, Y LA SEGUNDA IMPORTA MÁS QUE LA PRIMERA:
 *
 *   - que la regla siga ahí;
 *   - y que NO vuelva `table-layout: fixed`, que es lo que cualquiera
 *     propondría ---prometía el doble de ganancia--- y que se midió y
 *     se descartó: con el texto del panel al 150 % deja las columnas
 *     en su ancho de 100 %, porque son píxeles y no rem, y recorta
 *     203 celdas. Es el principio de siempre: nada de medidas fijas
 *     dentro de algo que escala.
 *
 * Una prueba que lee CSS no comprueba que la pantalla vaya rápida.
 * Comprueba que la decisión no se deshaga sin saber lo que costó
 * tomarla, que es justo lo que este fichero puede hacer.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = () =>
  readFileSync(
    join(__dirname, '../../../frontend/src/app/globals.css'),
    'utf8',
  );

/// El bloque de la fila de datos, que es donde va.
const laFila = () => {
  const t = CSS();
  const i = t.indexOf('.tabla-datos tbody tr {');
  expect(i).toBeGreaterThan(-1);
  return t.slice(i, t.indexOf('\n}', i));
};

describe('las filas que no se ven no se pintan', () => {
  it('la fila de datos se salta el pintado cuando está fuera', () => {
    expect(laFila()).toContain('content-visibility: auto');
  });

  /**
   * Y CON TAMAÑO DECLARADO. Sin él, el navegador supone cero para
   * cada fila que no ha pintado nunca y la barra de desplazamiento
   * da un salto al bajar.
   */
  it('con el alto supuesto de una fila, para que la barra no salte', () => {
    expect(laFila()).toMatch(/contain-intrinsic-size:\s*auto\s/);
  });

  /**
   * EN REM, NO EN PÍXELES. El panel escala el texto del 80 % al
   * 150 %: una fila mide 41 px al 100 % y 62 al 150 %. Con un
   * número fijo, la suposición se queda corta justo para quien más
   * necesita el texto grande.
   */
  it('y ese alto crece con el ajuste de texto del panel', () => {
    expect(laFila()).toMatch(/contain-intrinsic-size:\s*auto\s+[\d.]+rem/);
  });
});

describe('los anchos de columna no se clavan', () => {
  it('la tabla de datos no vuelve a `table-layout: fixed`', () => {
    /// SIN LOS COMENTARIOS, que es donde esta decisión está contada:
    /// buscando en el fuente pelado, la prueba se disparaba con la
    /// explicación de por qué NO se usa.
    const sinComentarios = CSS().replace(/\/\*[\s\S]*?\*\//g, '');
    expect(sinComentarios).not.toMatch(/table-layout:\s*fixed/);
  });
});
