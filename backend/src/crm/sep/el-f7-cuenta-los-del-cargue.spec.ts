/** El F7 reporta exactamente los beneficiarios que manda el cargue. */

/**
 * LOS DOS ARCHIVOS SE ENTREGAN JUNTOS AL SENA, así que no pueden
 * contarse distinto.
 *
 * El F7 tenía su propia consulta y su propio filtro: descartaba solo
 * a quien había revocado la autorización. El cargue descarta además
 * por completitud ---sin celular útil, sin barrio, sin grupo, menor
 * de edad contra la fecha de matrícula, el grupo de otra acción---.
 * Resultado: el cargue mandaba 2 personas de una empresa y el F7
 * decía que esa empresa tenía 3 beneficiarios del PFCE.
 *
 * Quien lo revisa no sabe cuál de los dos miente, y el que rebota es
 * el cargue. Lo encontró una auditoría del 5 oct 2026.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  empresaCompleta,
  participacionCompleta,
  prismaDelReporte,
} from './dobles-del-reporte';
import { fila as filaF7, type FilaF7 } from './formato-f7';
import { SepService } from './sep.service';

const FUENTE = readFileSync(join(__dirname, 'sep.service.ts'), 'utf8');

/**
 * `prepararF7` es privado, y se llama igual.
 *
 * Lo público ---`exportarF7`--- devuelve un .xlsx en un buffer, y
 * desarmar un libro para contar una columna haría que la prueba
 * hablara de ZIP en vez de hablar de beneficiarios. Lo que hay que
 * fijar es el conteo y el orden.
 */
function prepararF7(
  svc: SepService,
): Promise<{ listas: FilaF7[]; incompletas: Array<{ empresa: string }> }> {
  return (
    svc as unknown as {
      prepararF7: (c: string, a: string[]) => Promise<never>;
    }
  ).prepararF7('convenio-1', ['convenio-1']);
}

describe('el F7 cuenta a los que entran en el cargue', () => {
  it('a quien el cargue deja fuera, el F7 no lo cuenta como beneficiario', async () => {
    const textiles = empresaCompleta(
      'e1',
      'Textiles del Norte SAS',
      '900123456',
    );
    const svc = new SepService(
      prismaDelReporte([
        participacionCompleta({ id: 'p1', accion: 'AF01', empresa: textiles }),
        participacionCompleta({ id: 'p2', accion: 'AF01', empresa: textiles }),
        /// Esta se queda fuera del cargue: sin barrio no entra, y
        /// con el filtro viejo el F7 la seguía contando.
        participacionCompleta({
          id: 'p3',
          accion: 'AF01',
          empresa: textiles,
          persona: { barrio: null },
        }),
      ]),
    );

    const { listas } = await prepararF7(svc);

    expect(listas).toHaveLength(1);
    /// 3 era la cifra vieja, y es la que contradecía al cargue.
    expect(listas[0].beneficiarios).toBe(2);
  });

  /**
   * Y UNA EMPRESA SIN NADIE DENTRO NO SALE. En ningún sitio.
   *
   * Ni en el F7 ni en la hoja de las incompletas: en el cargue tiene
   * cero beneficiarios, y reportarla al SENA como beneficiaria del
   * PFCE sin una sola fila que lo respalde es el mismo defecto que la
   * cifra inflada, con otra cara.
   */
  it('y una empresa cuya gente entera se quedó fuera no aparece', async () => {
    const svc = new SepService(
      prismaDelReporte([
        participacionCompleta({
          id: 'p1',
          accion: 'AF01',
          empresa: empresaCompleta('e9', 'Fantasma SAS', '900999999'),
          persona: { celular: 'no tiene' },
        }),
      ]),
    );

    const { listas, incompletas } = await prepararF7(svc);

    expect(listas).toHaveLength(0);
    expect(incompletas).toHaveLength(0);
  });

  /**
   * PERO EL AVISO NO PUEDE DECIR QUE NO HAY NADIE.
   *
   * Es el precio de lo de arriba: con las dos hojas vacías, el
   * mensaje de «no se puede generar» decía «todavía no hay a quien
   * reportar» habiendo gente a medio completar. Eso manda a buscar
   * el problema donde no está —a revisar si el convenio tiene
   * inscritos— en vez de al alistamiento.
   */
  it('pero el aviso cuenta a las personas que faltan, no dice que no hay nadie', async () => {
    const svc = new SepService(
      prismaDelReporte([
        participacionCompleta({
          id: 'p1',
          accion: 'AF01',
          empresa: empresaCompleta('e9', 'Fantasma SAS', '900999999'),
          persona: { celular: 'no tiene' },
        }),
      ]),
    );

    await expect(svc.exportarF7('convenio-1', ['convenio-1'])).rejects.toThrow(
      /mire el alistamiento/,
    );
  });

  /**
   * Y QUIEN REVOCÓ SIGUE SIN CONTAR, que es lo que el F7 ya hacía.
   *
   * Lo hacía con un filtro propio en su consulta, y ese filtro
   * desapareció con la consulta. Ahora lo sostiene `revisar`: «no ha
   * autorizado el tratamiento» es de los motivos de matrícula y el
   * reporte los hereda, así que la fila no está en `listos` y el F7
   * no la cuenta.
   *
   * Se prueba por el RESULTADO y no por la forma del `where`, porque
   * la forma cambió y la regla no. `revocacion-se-honra-entera.spec.ts`
   * ---que está fuera de esta carpeta--- mira la consulta del F7 y por
   * eso hay que actualizarlo.
   *
   * Y da igual que aquí la persona solo salga como un número: seguir
   * reportándola al SENA como beneficiaria es seguir tratando su
   * participación después de que pidió que no.
   */
  it('y a quien revocó la autorización tampoco lo cuenta', async () => {
    const textiles = empresaCompleta(
      'e1',
      'Textiles del Norte SAS',
      '900123456',
    );
    const svc = new SepService(
      prismaDelReporte(
        [
          participacionCompleta({
            id: 'p1',
            accion: 'AF01',
            empresa: textiles,
          }),
          participacionCompleta({
            id: 'p2',
            accion: 'AF01',
            empresa: textiles,
          }),
        ],
        ['p2'],
      ),
    );

    const { listas } = await prepararF7(svc);

    expect(listas[0].beneficiarios).toBe(1);
  });

  /**
   * EL CANDADO DE VERDAD: que no haya DOS consultas.
   *
   * Las dos de arriba comprueban que hoy los dos filtros coinciden.
   * Esta comprueba que no pueden dejar de coincidir, que es otra
   * cosa: mientras el F7 salga de `preparar`, nadie puede añadirle
   * una regla al cargue y olvidarse del F7 ---que es exactamente lo
   * que pasó---.
   */
  it('el F7 no tiene consulta propia: sale de las filas del cargue', () => {
    const i = FUENTE.indexOf('private async prepararF7');
    const j = FUENTE.indexOf('async exportarF7');
    const bloque = FUENTE.slice(i, j);

    expect(i).toBeGreaterThan(-1);
    expect(bloque).toContain('this.preparar(');
    expect(bloque).not.toContain('findMany');
  });
});

describe('el número de fila del F7 no cambia entre dos exportaciones', () => {
  /// La misma empresa en dos acciones: dos filas con IDÉNTICA razón
  /// social, que es justo donde empataba el único criterio que había.
  function mismaEmpresaEnDosAcciones(alReves: boolean) {
    const e = empresaCompleta('e1', 'Textiles del Norte SAS', '900123456');
    const filas = [
      participacionCompleta({ id: 'p1', accion: 'AF01', empresa: e }),
      participacionCompleta({ id: 'p2', accion: 'AF02', empresa: e }),
    ];
    return new SepService(prismaDelReporte(alReves ? filas.reverse() : filas));
  }

  it('la misma empresa en dos acciones sale siempre en el mismo orden', async () => {
    const unoYDos = await prepararF7(mismaEmpresaEnDosAcciones(false));
    const dosYUno = await prepararF7(mismaEmpresaEnDosAcciones(true));

    const acciones = (r: { listas: FilaF7[] }) => r.listas.map((f) => f.accion);
    expect(acciones(unoYDos)).toEqual(acciones(dosYUno));
    /// Y el orden es el de la acción, no el de llegada.
    expect(acciones(unoYDos)[0]).toContain('AF01');
  });

  /// Dos organizaciones DISTINTAS con la misma razón social: pasa, y
  /// el NIT es lo que las separa. Es único en el maestro
  /// (`@@unique([nit])`), así que con él el orden es total.
  it('y dos empresas con la misma razón social se desempatan por NIT', async () => {
    const filas = [
      participacionCompleta({
        id: 'p1',
        accion: 'AF01',
        empresa: empresaCompleta('e2', 'Comercial Andina', '900900900'),
      }),
      participacionCompleta({
        id: 'p2',
        accion: 'AF01',
        empresa: empresaCompleta('e1', 'Comercial Andina', '800800800'),
      }),
    ];
    const { listas } = await prepararF7(
      new SepService(prismaDelReporte(filas)),
    );

    expect(listas.map((f) => f.empresa.nit)).toEqual([
      '800800800',
      '900900900',
    ]);
  });

  /**
   * Y ESTO ES POR LO QUE IMPORTA: la columna «#» es el índice.
   *
   * El cliente arma sus INSERT concatenando celdas y cruza los dos
   * archivos por ese número. Dos exportaciones del mismo día con los
   * mismos datos numeraban distinto, y eso no se ve al abrir el
   * archivo.
   */
  it('y el «#» de cada fila es el mismo en las dos exportaciones', async () => {
    const primera = await prepararF7(mismaEmpresaEnDosAcciones(false));
    const segunda = await prepararF7(mismaEmpresaEnDosAcciones(true));

    const numeros = (r: { listas: FilaF7[] }) =>
      r.listas.map((f, i) => [filaF7(f, i).numero, f.accion]);
    expect(numeros(primera)).toEqual(numeros(segunda));
  });
});

describe('el cargue tampoco numera al azar', () => {
  /**
   * La columna «NO.» sale del índice de la misma lista, y la consulta
   * ordenaba por `[accionFormacionId, creadoEn]`. `creadoEn` EMPATA:
   * las participaciones de una nómina entera se escriben de golpe y
   * `creadoEn` es `now()`, que en Postgres es la hora de la
   * TRANSACCIÓN, idéntica para todas las filas. Ordenar por un valor
   * igual deja el desempate en manos del motor.
   *
   * Esto se fija sobre la consulta porque el orden lo hace Postgres:
   * un doble que devuelve filas ya ordenadas daría por bueno
   * cualquier `orderBy`.
   */
  it('la consulta desempata por `id`, porque `creadoEn` empata', () => {
    const i = FUENTE.indexOf('orderBy: [');
    const bloque = FUENTE.slice(i, i + 200);
    expect(bloque).toContain("{ accionFormacionId: 'asc' }");
    expect(bloque).toContain("{ creadoEn: 'asc' }");
    expect(bloque).toContain("{ id: 'asc' }");
  });
});
