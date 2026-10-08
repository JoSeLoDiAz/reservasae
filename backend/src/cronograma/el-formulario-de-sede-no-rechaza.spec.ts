/** El formulario de sede añade o ajusta, y nunca rechaza. */

/**
 * LO QUE JOSSE CORRIGIÓ EL 8 OCT, Y ES LO QUE UN ARREGLO FUTURO
 * DESHARÍA SIN ENTERARSE.
 *
 * El día antes, el `<option>` de una ubicación que el grupo ya tenía
 * iba `disabled` con el rótulo «ya la tiene»: parecía prudente y lo
 * único que hacía era dejarlo sin camino ---«puedo volver a repetir
 * Antioquia, no hay problema [...] que yo pueda ajustar los cupos»---.
 *
 * Es un spec de SUPERFICIE, como `escribir-pide-escribir` o
 * `la-escalera-no-se-separa`: lee el fichero del panel, que no tiene
 * jest. Y mira cosas que compilan igual estén bien o mal.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TABLA = join(
  __dirname, '..', '..', '..', 'frontend', 'src', 'components', 'admin', 'tabla-por-grupo.tsx',
);

describe('el formulario de sede añade o ajusta', () => {
  const texto = readFileSync(TABLA, 'utf8');

  /// El trozo del formulario, para no confundirlo con el resto de la
  /// pantalla: `AnadirSede` empieza y acaba antes de `TablaPorGrupo`.
  const formulario = texto.slice(
    texto.indexOf('function AnadirSede('),
    texto.indexOf('export function TablaPorGrupo('),
  );

  it('el trozo del formulario se encontró', () => {
    expect(formulario.length).toBeGreaterThan(500);
  });

  /**
   * NINGÚN `<option>` DE UBICACIÓN VA BLOQUEADO. Es el defecto
   * literal que reportó: el desplegable decía «ya la tiene» y no
   * dejaba elegirla, así que ajustar sus cupos desde ahí era
   * imposible.
   */
  it('no bloquea las ubicaciones que el grupo ya tiene', () => {
    expect(formulario).not.toMatch(/disabled=\{s\.yaEnElGrupo\}/);
    expect(formulario).not.toMatch(/disabled=\{s\.puesta/);
    /// el `disabled` del desplegable entero mientras no hay grupo SÍ
    /// se queda: ahí no hay nada que elegir todavía
    expect(formulario).toMatch(/disabled=\{sedes === null\}/);
  });

  /// Elegirla trae SUS cupos. Sin esto, teclear 40 sobre los 25 que
  /// tenía sería pisar a ciegas un número que nadie vio, y eso es
  /// peor que el rechazo que esto viene a quitar.
  it('precarga los cupos de la que ya está', () => {
    expect(formulario).toMatch(/function elegirUbicacion\(/);
    expect(formulario).toMatch(/setBase\(\s*s\?\.puesta \? String\(s\.puesta\.cuposBase\)/);
    expect(formulario).toMatch(/setTope\(\s*s\?\.puesta \? String\(s\.puesta\.cuposMaximos\)/);
    /// y el desplegable llama a esa función, no a `setUbicacionId` a
    /// secas: con el setter directo no se precargaría nada
    expect(formulario).toMatch(/onChange=\{\(e\) => elegirUbicacion\(e\.target\.value\)\}/);
  });

  /**
   * LAS DOS PUERTAS, Y LA ELIGE EL FORMULARIO. `crearCobertura` para
   * un alta y `actualizarCupos` para un ajuste: las dos ya existían y
   * toman el mismo `FOR UPDATE` sobre la oferta, así que no hizo
   * falta ninguna ruta nueva. Llamando siempre al alta se topa el 409.
   */
  it('llama al alta o al ajuste según corresponda', () => {
    expect(formulario).toMatch(/if \(ajusta\)/);
    expect(formulario).toMatch(/actualizarCupos\(ajusta\.coberturaId/);
    expect(formulario).toMatch(/crearCobertura\(grupoId/);
  });

  /// El rótulo dice cuál de las dos va a pasar. Con «Añadir» siempre,
  /// ajustar se leería como un alta y nadie sabría que está pisando
  /// un número.
  it('el botón dice si añade o si ajusta', () => {
    expect(formulario).toMatch(/ajusta\s*\n?\s*\?\s*"Ajustar"/);
    expect(formulario).toMatch(/:\s*"Añadir"/);
  });

  /**
   * LO QUE SUMA EL GRUPO SE ENSEÑA, Y NO SE IMPONE.
   *
   * Es lo que hace posible «distribuir los 65 entre Cali, Magdalena y
   * Huila». Un tope duro aquí sería inventar una regla: en la base NO
   * existe un tope del grupo ---los 65 son la suma de sus
   * coberturas--- y el foro de AF7 se subió a propósito por encima de
   * la suya.
   */
  it('dice lo que lleva el grupo, sin impedir pasarse', () => {
    expect(formulario).toMatch(/const quedaria =/);
    expect(formulario).toContain('lleva');
    /// nada que apague el botón por pasarse del total
    expect(formulario).not.toMatch(/quedaria\s*>\s*grupo\.tope/);
    expect(formulario).not.toMatch(/disabled=\{[^}]*quedaria/);
  });

  /**
   * AL AJUSTAR SE RESTA LO QUE ESA SEDE TENÍA. Sin la resta, subir
   * Antioquia de 25 a 40 diría que el grupo sube 40 cuando sube 15:
   * un rótulo que cuenta algo distinto de lo que mide, que es el
   * defecto que este proyecto lleva cuatro rondas documentando.
   */
  it('el total previsto descuenta lo que la sede ya tenía', () => {
    expect(formulario).toMatch(/grupo\.tope - \(ajusta\?\.cuposMaximos \?\? 0\) \+ Number\(tope\)/);
  });

  /// Una ubicación sin oferta no sale, y la pantalla lo dice: si no,
  /// buscar Cali en una virtual y no encontrarla se lee como fallo.
  it('explica por qué no salen todas las ubicaciones', () => {
    expect(formulario).toMatch(/donde esta acción de formación ya se dicta/);
  });
});
