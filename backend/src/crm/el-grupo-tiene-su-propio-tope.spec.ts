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
    expect(cuantosCaben({ cuposMaximos: 50, apuntados: 50 })).toBe(0);
    expect(cuantosCaben({ cuposMaximos: 50, apuntados: 49 })).toBe(1);
    /// Un grupo pasado no «debe» sillas.
    expect(cuantosCaben({ cuposMaximos: 50, apuntados: 58 })).toBe(0);
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
