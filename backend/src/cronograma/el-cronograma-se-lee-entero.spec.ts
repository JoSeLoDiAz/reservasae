/** El cronograma se lee entero y sin inventar nada. */

/**
 * CONTRA EL ARCHIVO DE VERDAD, no contra uno de juguete.
 *
 * El cronograma de ADECOPRIA es una hoja que el cliente mueve a mano, y
 * lo que hay que comprobar no es que el lector sepa leer un Excel: es
 * que entienda ESTA hoja, con sus colores, sus hitos y sus trampas. Un
 * fixture hecho por mí demostraría que sé leer lo que yo mismo escribí.
 *
 * EL ARCHIVO NO SE GUARDA EN EL REPOSITORIO. Es un documento del
 * cliente ---con su planeación, sus sedes y sus fechas de desembolso---
 * y versionarlo sería repartirlo a todo el que clone. Se apunta a él
 * con `CRONOGRAMA_DE_PRUEBA`, y sin esa variable estas pruebas se
 * saltan en vez de fallar. Las que no dependen de él se corren siempre.
 *
 *     CRONOGRAMA_DE_PRUEBA="C:\\ruta\\CRONOGRAMA ... .xlsx" npx jest cronograma
 */

import * as fs from 'fs';
import * as ExcelJS from 'exceljs';

import {
  hojasDeCronograma,
  leerCronograma,
  numeroDeGrupo,
  type LecturaDelCronograma,
} from './lector-del-cronograma';

const ARCHIVO = process.env.CRONOGRAMA_DE_PRUEBA ?? '';
const HOJA = 'CRONOGRAMA 2026_V4_3';

describe('el número de grupo, de un rótulo escrito a mano', () => {
  /**
   * LAS CUATRO FORMAS QUE USA LA HOJA. No hay una sola: el punto
   * después de la G aparece y desaparece, y la ciudad va a veces
   * entre paréntesis. Partir por puntos o por espacios falla en la
   * mitad.
   */
  it.each([
    ['AF1.G1 Bogotá', 1],
    ['AF1.G3. Antioquia', 3],
    ['AF3.G2 Medellín (Antioquia)', 2],
    ['AF2.G8. Valle del Cauca', 8],
  ])('«%s» es el grupo %i', (rotulo, esperado) => {
    expect(numeroDeGrupo(rotulo)).toBe(esperado);
  });

  it('y lo que no lleva número no se inventa', () => {
    expect(numeroDeGrupo('Bogotá')).toBeNull();
  });
});

const hayArchivo = ARCHIVO !== '' && fs.existsSync(ARCHIVO);
const siHay = hayArchivo ? describe : describe.skip;

siHay('leído del cronograma real', () => {
  let lectura: LecturaDelCronograma;

  beforeAll(async () => {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.readFile(ARCHIVO);
    lectura = leerCronograma(libro, HOJA, 2026);
  });

  it('salen los 28 grupos de las 7 acciones', () => {
    expect(lectura.grupos).toHaveLength(28);
    expect(new Set(lectura.grupos.map((g) => g.af)).size).toBe(7);
  });

  /**
   * LA PRUEBA DE QUE LA LECTURA ES FIEL.
   *
   * Las horas se leen de las celdas del calendario, una a una, y la
   * hoja declara aparte cuántas tiene cada grupo. Que las dos cuentas
   * coincidan en los 28 ---40 en las virtuales, 8 y 16 en las
   * presenciales, 2 en el foro--- no se consigue por casualidad: si
   * se desplazara una columna, o se contara una celda de más, saltaría
   * aquí. Es la comprobación que vale por todas las demás.
   */
  it('las horas contadas cuadran con las declaradas, en los 28', () => {
    const descuadres = lectura.grupos.filter(
      (g) =>
        g.horasDeclaradas !== null && g.horasContadas !== g.horasDeclaradas,
    );
    expect(descuadres).toEqual([]);
    expect(lectura.avisos).toEqual([]);
  });

  it('las virtuales llevan 40 horas en 20 sesiones y 5 unidades', () => {
    const af1g1 = lectura.grupos.find((g) => g.grupo.startsWith('AF1.G1'));
    expect(af1g1).toMatchObject({
      af: 'AF1',
      numeroDeGrupo: 1,
      horasContadas: 40,
      sesiones: 20,
      inicio: '2026-10-19',
      fin: '2026-11-11',
    });
    expect(af1g1?.unidades).toHaveLength(5);
  });

  /**
   * EL CIERRE DEL 8 DE OCTUBRE, que es el dato por el que existe todo
   * esto. La regla que el sistema usaba ---14 días antes del arranque
   * para los virtuales--- daría el 5.
   */
  it('AF1 cierra el 8 de octubre sus cuatro primeros grupos', () => {
    const primeros = lectura.grupos.filter(
      (g) => g.af === 'AF1' && (g.numeroDeGrupo ?? 0) <= 4,
    );
    expect(primeros).toHaveLength(4);
    for (const g of primeros) expect(g.cierreInscripciones).toBe('2026-10-08');
  });

  it('y los otros cuatro el 16', () => {
    const ultimos = lectura.grupos.filter(
      (g) => g.af === 'AF1' && (g.numeroDeGrupo ?? 0) >= 5,
    );
    expect(ultimos).toHaveLength(4);
    for (const g of ultimos) expect(g.cierreInscripciones).toBe('2026-10-16');
  });

  /**
   * LA TRAMPA DE LA HOJA, fijada para que nadie la vuelva a pisar.
   *
   * AF3.G2 cierra el 13 de octubre y AF3.G1 el 15, y esas dos columnas
   * están rojas TAMBIÉN en la cabecera, porque ahí caen dos hitos del
   * proyecto (APROBACIONES y ENTIDAD CAPACITADORA). Un filtro que
   * descarte toda columna con rojo en la cabecera se come estos dos
   * cierres y deja a dos grupos sin fecha, en silencio.
   */
  it('los cierres que caen sobre un hito del proyecto no se pierden', () => {
    const porGrupo = Object.fromEntries(
      lectura.grupos
        .filter((g) => g.af === 'AF3')
        .map((g) => [g.numeroDeGrupo, g.cierreInscripciones]),
    );
    expect(porGrupo).toEqual({
      1: '2026-10-15',
      2: '2026-10-13',
      3: '2026-10-20',
      4: '2026-10-22',
      5: '2026-10-27',
    });
  });

  /**
   * Y NINGÚN GRUPO SE QUEDA SIN CIERRE. Es la condición para poder
   * escribirlos: uno sin fecha volvería a la regla derivada y la
   * pantalla mezclaría las dos procedencias sin decirlo.
   */
  it('los 28 grupos traen su fecha de cierre', () => {
    const sinCierre = lectura.grupos.filter((g) => !g.cierreInscripciones);
    expect(sinCierre.map((g) => g.grupo)).toEqual([]);
  });

  /**
   * SEIS DE LAS SIETE CIERRAN POR PARTES, que es lo que dijo el
   * cliente y lo que el sistema no sabía representar.
   */
  it('seis de las siete acciones cierran en más de una fecha', () => {
    const porAf = new Map<string, Set<string>>();
    for (const g of lectura.grupos) {
      if (!g.cierreInscripciones) continue;
      const ya = porAf.get(g.af) ?? new Set<string>();
      ya.add(g.cierreInscripciones);
      porAf.set(g.af, ya);
    }
    const porPartes = [...porAf.values()].filter((s) => s.size > 1);
    expect(porPartes).toHaveLength(6);
    /// Y AF3, la peor, tiene una fecha por cada uno de sus grupos.
    expect(porAf.get('AF3')?.size).toBe(5);
  });

  /// El foro son dos grupos de 2 horas, y es lo que lo distingue.
  it('el foro son dos horas en un solo día', () => {
    const foro = lectura.grupos.filter((g) => g.af === 'AF7');
    expect(foro).toHaveLength(2);
    for (const g of foro) {
      expect(g.horasContadas).toBe(2);
      expect(g.sesiones).toBe(1);
      expect(g.inicio).toBe(g.fin);
    }
  });

  it('el libro trae las versiones anteriores, y la vigente es la V4_3', () => {
    expect(lectura.hoja).toBe(HOJA);
  });
});

siHay('las hojas del libro', () => {
  it('se reconocen todas las versiones del cronograma', async () => {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.readFile(ARCHIVO);
    const hojas = hojasDeCronograma(libro);
    expect(hojas).toContain(HOJA);
    /// Hay varias versiones guardadas, y por eso la hoja se elige: leer
    /// «la primera» traería una de hace meses con otras fechas.
    expect(hojas.length).toBeGreaterThan(1);
  });

  it('pedir una hoja que no está dice cuáles hay', async () => {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.readFile(ARCHIVO);
    expect(() => leerCronograma(libro, 'NO EXISTE', 2026)).toThrow(/Trae:/);
  });
});
