/** El tope de un grupo se respeta, se cuenta UNA vez, y se puede cambiar de grupo. */

/**
 * SON DOS TOPES DISTINTOS Y UNA PUERTA MIRABA UNO SOLO.
 *
 * La `Oferta` es la acción en un departamento; la `GrupoCobertura` es
 * el trozo que le toca a UN grupo dentro de esa sede, y es el número
 * que el panel enseña y deja editar en Cronograma.
 *
 * `PATCH :id/formacion` solo comprobaba el de la oferta, así que se
 * podía pasar la meta de un grupo de uno en uno y en silencio, mientras
 * `PATCH grupos/lote`, al lado, sí lo impedía. Y `PATCH :id` ni
 * siquiera dejaba cambiar de grupo: 409 por una puerta y 200 por la
 * otra, sobre la misma ficha.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cuantosCaben } from './elegibles-del-grupo';
import { RETIENEN_ASIENTO } from './etapas';

const leer = (f: string) => readFileSync(join(__dirname, f), 'utf8');

/// Sin comentarios: este proyecto explica sus decisiones en docblocks y
/// cita sus propios simbolos mas veces de las que los llama.
const codigo = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('la cuenta de lo que cabe es una sola', () => {
  it('lleno es lleno, y nunca sale negativo', () => {
    /// Un lead se mide contra los apuntados.
    const lead = (cuposMaximos: number, apuntados: number) =>
      cuantosCaben({ cuposMaximos, apuntados, sillas: 0, entra: 'INTERESADO' });
    expect(lead(50, 50)).toBe(0);
    expect(lead(50, 49)).toBe(1);
    /// Un grupo pasado no «debe» sillas.
    expect(lead(50, 58)).toBe(0);
  });

  /// Quien RETIENE asiento no son los que ocupan silla: un interesado
  /// apuntado a la cohorte ya la esta llenando.
  it('cuenta a los apuntados, no solo a los que ocupan silla', () => {
    for (const e of ['INTERESADO', 'CONTACTADO', 'INSCRITO']) {
      expect(RETIENEN_ASIENTO).toContain(e);
    }
    /// Y fuera las salidas: quien se retiro libero su asiento.
    for (const e of ['RETIRADO', 'PERDIDO', 'NO_APROBO']) {
      expect(RETIENEN_ASIENTO).not.toContain(e);
    }
  });

  it('`cabenEnLaCobertura` es quien la hace, y usa las dos reglas', () => {
    const c = codigo(leer('cobertura.ts'));
    expect(c).toMatch(/export async function cabenEnLaCobertura/);
    expect(c).toMatch(/etapa:\s*\{\s*in:\s*RETIENEN_ASIENTO\s*\}/);
    expect(c).toMatch(/id:\s*\{\s*not:\s*salvoEsteParticipante\s*\}/);
    expect(c).toMatch(/return cuantosCaben\(/);
  });

  /// ESTE ASERTO SALIÓ DE UNA MUTACIÓN QUE NO MATÓ NADA (9 oct 2026).
  ///
  /// Sustituyendo la consulta de sillas por `const sillas = apuntados`
  /// ---o sea devolviendo el defecto de producción, con las dos
  /// cuentas iguales--- los 57 tests del aforo siguieron en verde. La
  /// función que de verdad lee la base no estaba sujeta por ningún
  /// lado, y es la que usa la ficha.
  it('TRAE LAS DOS CUENTAS, y las dos descuentan a esta ficha', () => {
    const c = codigo(leer('cobertura.ts'));
    expect(c).toMatch(/etapa:\s*\{\s*in:\s*OCUPAN_SILLA\s*\}/);
    /// Una por cada cuenta: sin la exclusión, mover a alguien dentro
    /// de su propio grupo se contaría a sí mismo y el último hueco
    /// nunca cabría.
    const exclusiones = c.match(/id:\s*\{\s*not:\s*salvoEsteParticipante\s*\}/g);
    expect(exclusiones).toHaveLength(2);
    /// Y que no se cuele una tercera copia de la cuenta: lo que se le
    /// pasa a `cuantosCaben` son las dos variables, no un cálculo.
    expect(c).toMatch(/apuntados,\s*sillas,\s*entra,/);
  });
});

/**
 * Y QUE NINGUNA PUERTA SE HAGA SU PROPIA CUENTA.
 *
 * Es el aserto que de verdad protege: el defecto no fue que faltara
 * una comprobación, fue que había DOS formas de contar y una de ellas
 * no miraba este tope. Recorre la superficie en vez del caso.
 */
describe('las dos puertas cuentan por el mismo sitio', () => {
  const servicio = codigo(leer('crm.service.ts'));

  it('`actualizar` y `asignar` llaman a cabenEnLaCobertura', () => {
    const llamadas = servicio.match(/cabenEnLaCobertura\(/g) ?? [];
    expect(llamadas.length).toBeGreaterThanOrEqual(2);
  });

  /// EL CANDADO DE SUPERFICIE: nadie cuenta los APUNTADOS de una
  /// cobertura por su cuenta. Si alguien escribe su propio count con
  /// `RETIENEN_ASIENTO`, esto cae.
  ///
  /// La cuenta de SILLAS es otra pregunta y se deja fuera a proposito:
  /// `cambiarEtapa` cuenta `OCUPAN_SILLA` dentro de su transaccion con
  /// `FOR UPDATE`, y mide si queda sitio EN EL AULA. Un interesado
  /// apuntado llena la cohorte para repartir y no ocupa silla hasta que
  /// se inscribe, asi que las dos cifras difieren y las dos son ciertas.
  it('nadie cuenta los apuntados de una cobertura por su cuenta', () => {
    const porSuCuenta =
      /participante\.count\(\{[\s\S]{0,200}?coberturaId:[\s\S]{0,200}?RETIENEN_ASIENTO/g;
    expect(servicio.match(porSuCuenta) ?? []).toEqual([]);
  });

  /// Y que la de sillas siga ahi, que es lo que protege del arreglo
  /// excesivo: unificarlas serializaria el aula contra el reparto.
  it('pero la cuenta de SILLAS del aula sigue siendo la suya', () => {
    expect(servicio).toMatch(
      /coberturaId: p\.coberturaId,[\s\S]{0,120}?OCUPAN_SILLA/,
    );
  });
});


/**
 * SE PUEDE CAMBIAR DE GRUPO (Josse, 7 oct 2026).
 *
 * Una puerta lo prohibía con 409 y la otra lo hacía con 200. La
 * prohibición tenía buena razón --el grupo viaja al SENA con la
 * persona-- pero cuelga de HABER REPORTADO, no de tener grupo, y hoy
 * no hay una sola ficha cargada al SEP.
 */
describe('cambiar de grupo deja de estar prohibido, y deja huella', () => {
  const servicio = codigo(leer('crm.service.ts'));

  it('ya no hay un 409 por tener grupo puesto', () => {
    expect(servicio).not.toMatch(/el grupo no se cambia una vez puesto/i);
  });

  /// LO QUE PERMITE DESHACERLO, que es lo que Josse pidio: «guarda de
  /// manera que si se llegan a perder datos, tengamos de donde
  /// recuperarlo». La nota decia solo el destino.
  it('el movimiento guarda de qué cohorte venía y a cuál fue', () => {
    const escrituras = servicio.match(/coberturaAntes:/g) ?? [];
    expect(escrituras.length).toBeGreaterThanOrEqual(2);
    expect(servicio.match(/coberturaDespues:/g) ?? []).toHaveLength(
      escrituras.length,
    );
  });

  it('las columnas existen en el schema', () => {
    const esquema = readFileSync(
      join(__dirname, '..', '..', 'prisma', 'schema.prisma'),
      'utf8',
    );
    expect(esquema).toMatch(/coberturaAntes\s+String\?/);
    expect(esquema).toMatch(/coberturaDespues\s+String\?/);
  });
});

/**
 * CADA PUERTA MIDE CON LA ETAPA DE QUIEN ENTRA (9 oct 2026).
 *
 * ESTE BLOQUE EXISTE PORQUE UNA MUTACIÓN NO MATÓ NADA. Al cambiar
 * `p.etapa` por `'INTERESADO'` en la llamada de `asignar` ---que es
 * justo el camino por el que se mueve gente a mano, y el que falló en
 * producción--- los 37 tests del aforo siguieron en verde. O sea que
 * el arreglo no estaba sujeto por el único sitio donde importa.
 *
 * `cuantosCaben` mide contra las SILLAS a quien ya las ocupa y contra
 * los APUNTADOS a un lead; el porqué entero vive en su docblock. Una
 * puerta que le pase una etapa fija vuelve a medir mal a la mitad de
 * la gente, y no falla nada.
 *
 * Se recorre la SUPERFICIE y no las tres llamadas de hoy: la lección
 * de `fuera-del-ambito` y de `escribir-pide-escribir` es que un
 * arreglo puerta por puerta se olvida de alguna.
 */
describe('la etapa de quien entra llega a todas las puertas', () => {
  const ETAPAS = [
    'INTERESADO',
    'CONTACTADO',
    'DATOS_COMPLETOS',
    'INSCRITO',
    'EN_FORMACION',
    'CERTIFICADO',
  ];

  /// La única llamada que puede pasar una etapa escrita, con su
  /// porqué: `elegiblesDelGrupo` solo trae gente que YA ocupa silla,
  /// así que ahí no hay etapa que leer y medir en sillas es correcto.
  const EXCEPCIONES = ['asignar-grupo.service.ts'];

  const fuentes = ['crm.service.ts', 'cobertura.ts', 'asignar-grupo.service.ts'];

  it('ninguna puerta llama a cabenEnLaCobertura con una etapa escrita', () => {
    for (const f of fuentes) {
      const c = codigo(leer(f));
      /// El cuarto argumento de cada llamada.
      const llamadas = c.match(/cabenEnLaCobertura\([\s\S]{0,200}?\)/g) ?? [];
      for (const l of llamadas) {
        for (const e of ETAPAS) {
          expect(l).not.toContain(`'${e}'`);
        }
      }
    }
  });

  it('`asignar` y `actualizar` le pasan la etapa de la FICHA', () => {
    const c = codigo(leer('crm.service.ts'));
    const llamadas = c.match(/cabenEnLaCobertura\([\s\S]{0,200}?\)/g) ?? [];
    /// Las tres de hoy: `actualizar`, y `asignar` fuera y dentro de
    /// su transacción. Sin el suelo, renombrar la función dejaría el
    /// test en verde sin mirar nada.
    expect(llamadas.length).toBeGreaterThanOrEqual(3);
    for (const l of llamadas) {
      expect(l).toMatch(/p\.etapa/);
    }
  });

  it('toda llamada a cuantosCaben dice contra qué mide', () => {
    /// Sin `entra` no compila ---va obligatorio en el objeto--- pero
    /// esto caza a quien lo rellene con una etapa fija fuera del lote.
    for (const f of fuentes) {
      const c = codigo(leer(f));
      const llamadas = c.match(/cuantosCaben\(\{[\s\S]{0,300}?\}\)/g) ?? [];
      for (const l of llamadas) {
        expect(l).toContain('entra');
        if (EXCEPCIONES.includes(f)) continue;
        for (const e of ETAPAS) {
          expect(l).not.toContain(`'${e}'`);
        }
      }
    }
  });

  it('y el lote es la ÚNICA excepción, porque solo mueve inscritos', () => {
    /// Si alguien le quita ese filtro, el lote empezaría a mover
    /// leads midiendo en sillas, que es medir de menos.
    const c = codigo(leer('elegibles-del-grupo.ts'));
    expect(c).toMatch(/etapa:\s*\{\s*in:\s*OCUPAN_SILLA\s*\}/);
    expect(EXCEPCIONES).toHaveLength(1);
  });
});
