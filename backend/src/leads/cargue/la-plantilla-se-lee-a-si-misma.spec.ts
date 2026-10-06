/** La plantilla que se baja es la que el lector entiende. */

/**
 * Es la prueba que parece tonta y es la que atrapa el defecto más
 * caro: que alguien cambie un rótulo de la plantilla ---«Celular»
 * por «Celular / WhatsApp»--- y el lector deje de reconocer esa
 * columna. No falla nada: el archivo se lee, la columna se
 * reporta como «no se reconoce», y los celulares de tres mil
 * personas no entran. Se descubre llamando.
 *
 * Y la fila de ejemplo tiene que ser una fila de ejemplo de verdad,
 * no un adorno: si no se pudiera cargar, el primero que suba la
 * plantilla sin tocarla recibiría un informe lleno de reparos sobre
 * datos que le dio el propio sistema.
 */

import { COLUMNAS_DEL_CARGUE, columnaDelRotulo } from './columnas-del-cargue';
import { leerElCargue } from './lector-del-cargue';
import { construirPlantillaDelCargue } from './plantilla-del-cargue';

describe('la plantilla y el lector hablan el mismo idioma', () => {
  it('se reconocen TODAS sus columnas', async () => {
    const archivo = await construirPlantillaDelCargue();
    const l = await leerElCargue(archivo, 'bbdd-leads.xlsx');

    expect(l.filaDeLaCabecera).toBe(1);
    expect([...l.columnasTraidas].sort()).toEqual(
      COLUMNAS_DEL_CARGUE.map((c) => c.clave).sort(),
    );
    /// Ni una columna sin reconocer: si sobra algo es que la
    /// plantilla trae un rótulo que ella misma no sabe leer.
    expect(l.columnasQueNoSeReconocen).toEqual([]);
  });

  it('la fila de ejemplo se lee entera', async () => {
    const archivo = await construirPlantillaDelCargue();
    const l = await leerElCargue(archivo, 'bbdd-leads.xlsx');

    expect(l.filas).toHaveLength(1);
    expect(Object.keys(l.filas[0].valores).sort()).toEqual(
      COLUMNAS_DEL_CARGUE.map((c) => c.clave).sort(),
    );
    /// El celular sale como texto y no como número: sin el formato
    /// `@` en la columna, exceljs lo devolvería como `3001112222`
    /// numérico y un documento que empiece por cero perdería ese
    /// cero ---que es otra persona---.
    expect(l.filas[0].valores.celular).toBe('3001112222');
  });

  it('la hoja de instrucciones no se lee como personas', async () => {
    /// Va en una SEGUNDA hoja y el lector solo mira la primera. Si
    /// las instrucciones estuvieran en la hoja de datos, cada línea
    /// sería una fila y el informe traería doce filas sin reconocer
    /// que el cliente no escribió.
    const archivo = await construirPlantillaDelCargue();
    const l = await leerElCargue(archivo, 'bbdd-leads.xlsx');

    expect(l.filas).toHaveLength(1);
    expect(l.reparos).toEqual([]);
  });
});

describe('cada columna se reconoce por su título y por sus alias', () => {
  it('ningún alias casa con dos columnas distintas', () => {
    /// Dos columnas que respondan al mismo rótulo serían una
    /// ruleta: la que gane depende del orden de la lista, y si
    /// gana la del tipo de documento se cargan los números de
    /// cédula en la columna del tipo.
    const vistos = new Map<string, string>();

    for (const c of COLUMNAS_DEL_CARGUE) {
      for (const alias of [c.titulo, ...c.tambienSeLlama]) {
        const cual = columnaDelRotulo(alias);
        expect(cual?.clave).toBe(c.clave);

        const antes = vistos.get(alias.toLowerCase());
        expect(antes ?? c.clave).toBe(c.clave);
        vistos.set(alias.toLowerCase(), c.clave);
      }
    }
  });

  it('el rótulo se reconoce aunque lo hayan reescrito con tildes, puntos o guiones', () => {
    /// Es como vienen de verdad: «E-mail», «Nº documento»,
    /// «TELEFONO».
    expect(columnaDelRotulo('E-Mail')?.clave).toBe('correo');
    expect(columnaDelRotulo('  TELEFONO  ')?.clave).toBe('celular');
    expect(columnaDelRotulo('Nro. Documento')?.clave).toBe('numeroDocumento');
    expect(columnaDelRotulo('Acción de Formación')?.clave).toBe('accion');
  });

  it('lo que no es una columna conocida devuelve null', () => {
    /// Y no «lo más parecido»: adivinar que «Empresa donde trabaja»
    /// es el nombre cargaría la razón social como el nombre de la
    /// persona.
    expect(columnaDelRotulo('Empresa donde trabaja')).toBeNull();
    expect(columnaDelRotulo('')).toBeNull();
  });
});
