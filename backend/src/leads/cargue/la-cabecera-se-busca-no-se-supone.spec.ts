/** El archivo del cliente no es nuestra plantilla, y se lee igual. */

/**
 * «De como se tiene» (cliente, 5 oct 2026): la base ya existe,
 * lleva meses creciendo a mano, y tiene lo que tienen esos
 * archivos: un título arriba, una fila en blanco, rótulos
 * reescritos, columnas en otro orden y columnas suyas que aquí no
 * significan nada.
 *
 * Exigir la fila 1 y los rótulos exactos convertiría «tengo la
 * base ahí» en «la base no se lee», y el cliente no tiene por qué
 * rehacer su archivo para que el sistema sea más cómodo. Eso no
 * sale como un error: sale como «0 filas», y entonces se discute
 * si el cargue funciona.
 */

import { leerElCargue } from './lector-del-cargue';
import { hojaDeExcel } from './arnes-del-cargue';

describe('la cabecera se busca entre las primeras filas', () => {
  it('con un título y una fila en blanco encima, se encuentra', async () => {
    const archivo = await hojaDeExcel([
      ['BASE DE DATOS LEADS ADECOPRIA 2026'],
      [],
      ['Nombres', 'Correo', 'Celular'],
      ['Ana', 'ana@correo.com', '3001112222'],
    ]);

    const l = await leerElCargue(archivo, 'bbdd.xlsx');

    expect(l.filaDeLaCabecera).toBe(3);
    expect(l.filas).toHaveLength(1);
    /// El número de fila es el del EXCEL, no el de la lista: el
    /// cliente busca «la 4» en su archivo.
    expect(l.filas[0].fila).toBe(4);
  });

  it('gana la fila que reconoce MÁS columnas, no la primera', async () => {
    /// Un título que casualmente dice «Contacto» reconocería una
    /// columna en la fila 1, y entonces la cabecera de verdad se
    /// leería como si fuera una persona llamada «Nombres».
    const archivo = await hojaDeExcel([
      ['Contacto'],
      ['Nombres', 'Correo', 'Celular'],
      ['Ana', 'ana@correo.com', '3001112222'],
    ]);

    const l = await leerElCargue(archivo, 'bbdd.xlsx');

    expect(l.filaDeLaCabecera).toBe(2);
    expect(l.filas).toHaveLength(1);
  });

  it('una sola columna en la fila 1 SÍ es una cabecera', async () => {
    /// Una lista de solo celulares es el archivo más «no
    /// restrictivo» de todos, y rechazarlo diciendo que no
    /// encuentra los títulos es incomprensible delante de un
    /// archivo que sí los tiene.
    const archivo = await hojaDeExcel([
      ['Celular'],
      ['3001112222'],
      ['3002223333'],
    ]);

    const l = await leerElCargue(archivo, 'bbdd.xlsx');

    expect(l.filaDeLaCabecera).toBe(1);
    expect(l.filas).toHaveLength(2);
  });
});

describe('los rótulos se reconocen como los escribe la gente', () => {
  it('«E-mail», «WhatsApp» y «Nro documento» son correo, celular y documento', async () => {
    const archivo = await hojaDeExcel([
      ['E-mail', 'WhatsApp', 'Nro documento'],
      ['ana@correo.com', '3001112222', '1020304050'],
    ]);

    const l = await leerElCargue(archivo, 'bbdd.xlsx');

    expect([...l.columnasTraidas].sort()).toEqual(
      ['celular', 'correo', 'numeroDocumento'].sort(),
    );
    expect(l.filas[0].valores).toEqual({
      correo: 'ana@correo.com',
      celular: '3001112222',
      numeroDocumento: '1020304050',
    });
  });

  it('el orden de las columnas no importa', async () => {
    const archivo = await hojaDeExcel([
      ['Celular', 'Número de documento', 'Correo'],
      ['3001112222', '1020304050', 'ana@correo.com'],
    ]);

    const l = await leerElCargue(archivo, 'bbdd.xlsx');

    expect(l.filas[0].valores.correo).toBe('ana@correo.com');
    expect(l.filas[0].valores.celular).toBe('3001112222');
  });

  it('«Tipo de documento» no se confunde con «Número de documento»', async () => {
    /// Con un reconocimiento por `includes`, «Número de documento»
    /// contiene «documento» ---alias del número--- y «Tipo de
    /// documento» también: la primera que se mirara se quedaría las
    /// dos. Confundirlas no falla, se guarda y sale mal en el
    /// reporte al SENA meses después.
    const archivo = await hojaDeExcel([
      ['Tipo de documento', 'Número de documento'],
      ['CC', '1020304050'],
    ]);

    const l = await leerElCargue(archivo, 'bbdd.xlsx');

    expect(l.filas[0].valores).toEqual({
      tipoDocumento: 'CC',
      numeroDocumento: '1020304050',
    });
  });

  it('las columnas que no se reconocen se DICEN, no se callan', async () => {
    /// Si no se dijeran, el cliente descubriría meses después que
    /// su columna «Empresa donde trabaja» nunca se cargó, mirando
    /// una ficha vacía.
    const archivo = await hojaDeExcel([
      ['Correo', 'Empresa donde trabaja', 'Quién la refirió'],
      ['ana@correo.com', 'ACME', 'Luis'],
    ]);

    const l = await leerElCargue(archivo, 'bbdd.xlsx');

    expect(l.columnasQueNoSeReconocen).toEqual([
      'Empresa donde trabaja',
      'Quién la refirió',
    ]);
  });
});

describe('lo que no se puede leer se dice en una línea', () => {
  it('un .csv se rechaza explicando por qué', async () => {
    const l = await leerElCargue(Buffer.from('a,b\n1,2'), 'bbdd.csv');

    expect(l.filas).toHaveLength(0);
    /// Y se dice el motivo de verdad: en .csv el separador del
    /// sistema puede partir un celular en dos celdas.
    expect(l.reparos[0].problema).toMatch(/celular en dos celdas/i);
  });

  it('un .xlsx que no se abre no es un 500', async () => {
    const l = await leerElCargue(
      Buffer.from('esto no es un libro'),
      'bbdd.xlsx',
    );

    expect(l.reparos[0].problema).toMatch(/no se puede abrir como \.xlsx/i);
  });

  it('las filas en blanco de debajo no son un error ni una fila', async () => {
    /// Excel guarda filas vacías por debajo de los datos sin
    /// avisar. Reportarlas llenaría el informe de cientos de
    /// reparos que no son de nadie.
    const archivo = await hojaDeExcel([
      ['Correo'],
      ['ana@correo.com'],
      [],
      [],
      ['luis@correo.com'],
      [],
    ]);

    const l = await leerElCargue(archivo, 'bbdd.xlsx');

    expect(l.filas.map((f) => f.fila)).toEqual([2, 5]);
    expect(l.reparos).toEqual([]);
  });
});
