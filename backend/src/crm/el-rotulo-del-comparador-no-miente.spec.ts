/** El periodo comparado se llama como el que se eligió, no como el automático. */

/**
 * «Los comparadores no sirven bien» (el equipo, 9 oct 2026).
 *
 * Y era cierto, aunque las cifras estuvieran bien. `PantallaDeInformes`
 * ---la de Control de inscritos y Control de Reservas--- rotulaba el
 * periodo comparado con `anteriorDe(rango)`, que describe el anterior
 * AUTOMÁTICO del periodo principal: «Los 30 días anteriores»,
 * «Anteayer», «El mes de antes».
 *
 * En cuanto alguien elige sus propias dos fechas para comparar, eso es
 * falso: el servidor cuenta contra las fechas elegidas ---`compararDos`
 * resuelve la segunda ventana y manda su nombre en `etiquetaAnterior`,
 * «del 8 al 20 de septiembre»--- y la pantalla pintaba encima el nombre
 * de otro tramo. Un rótulo que cuenta algo distinto de lo que mide, que
 * es el defecto que este proyecto lleva cinco rondas documentando.
 *
 * SE MIRA EL CÓDIGO DEL PANEL porque allí no hay jest, igual que
 * `el-espejo-no-se-separa`, `la-escalera-no-se-separa` y
 * `lo-que-el-panel-ofrece-se-clasifica`. Y se mira la SUPERFICIE: lo
 * que no puede volver es que el rótulo del comparado salga de
 * `anteriorDe` cuando el periodo lo eligió una persona.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PANEL = join(
  __dirname,
  '..',
  '..',
  '..',
  'frontend',
  'src',
  'components',
  'admin',
);

const leer = (f: string) => readFileSync(join(PANEL, f), 'utf8');

/// Sin comentarios: este proyecto explica sus decisiones en docblocks
/// y cita sus propios símbolos más veces de las que los llama.
const codigo = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('la pantalla de informes rotula el comparado con lo que eligió el usuario', () => {
  const fuente = codigo(leer('pantalla-de-informes.tsx'));

  it('el archivo se encuentra y trae el comparador', () => {
    /// Sin esto, renombrar el fichero dejaría los tests de abajo
    /// pasando sobre una cadena vacía.
    expect(fuente.length).toBeGreaterThan(1000);
    expect(fuente).toContain('contraDesde');
    expect(fuente).toContain('etiquetaAnterior');
  });

  it('NO le pasa al panel el rótulo del anterior automático', () => {
    /// Era `etiquetaAnterior={anterior}`, y `anterior` es
    /// `anteriorDe(rango, …)`: el nombre del tramo que el servidor NO
    /// usó cuando hay dos fechas elegidas.
    expect(fuente).not.toMatch(/etiquetaAnterior=\{anterior\}/);
    expect(fuente).toMatch(/etiquetaAnterior=\{rotuloAnterior\}/);
  });

  it('el rótulo se bifurca por si lo eligió una persona', () => {
    const i = fuente.indexOf('const rotuloAnterior');
    expect(i).toBeGreaterThan(-1);
    const trozo = fuente.slice(i, i + 400);
    /// `eligio` es «el usuario escogió el periodo de comparación».
    expect(trozo).toContain('eligio');
    /// Y entonces el nombre sale del SERVIDOR, que es el único que
    /// sabe contra qué fechas contó.
    expect(trozo).toMatch(/ventana\.etiquetaAnterior/);
  });

  it('y NO se cae a `anteriorDe` mientras la respuesta no llega', () => {
    /// EL ASERTO QUE DE VERDAD PROTEGE. Caer a `anteriorDe` es volver
    /// a pintar el rótulo falso justo en el instante en que alguien
    /// acaba de elegir sus fechas y mira la pantalla.
    const i = fuente.indexOf('const rotuloAnterior');
    const trozo = fuente.slice(i, i + 400);
    const hastaElPuntoYComa = trozo.slice(0, trozo.indexOf(';') + 1);
    /// `anterior` sin más SÍ puede aparecer: es la otra rama, la del
    /// anterior automático, y ahí es correcta. Lo que no puede es
    /// `anteriorDe(` dentro de la rama de lo elegido.
    const ramaElegida = hastaElPuntoYComa.slice(
      0,
      hastaElPuntoYComa.lastIndexOf(':'),
    );
    expect(ramaElegida).not.toContain('anteriorDe(');
  });

  it('`anteriorDe` sigue decidiendo SI se puede comparar, que es otra pregunta', () => {
    /// No se toca: «Desde el principio» no tiene anterior y ahí la
    /// comparación no se ofrece. Quitarlo de aquí ofrecería una
    /// comparación que no significa nada (cliente, 20 sep 2026).
    expect(fuente).toMatch(/sePuedeComparar\s*=\s*anterior\s*!==\s*""/);
  });
});

describe('el panel de tráfico ya lo hacía bien, y se queda así', () => {
  const fuente = codigo(leer('panel-trafico.tsx'));

  it('rotula el comparado con SUS fechas cuando se está comparando', () => {
    /// Es la referencia: `rotulo(b)` sale de las dos fechas del
    /// segundo periodo, y solo sin comparar se usa el nombre del
    /// servidor. Si alguien «unifica» esto hacia el rótulo
    /// automático, vuelve el defecto por el otro lado.
    expect(fuente).toMatch(/rotuloB\s*=\s*comparando\s*\?\s*rotulo\(b\)/);
  });
});
