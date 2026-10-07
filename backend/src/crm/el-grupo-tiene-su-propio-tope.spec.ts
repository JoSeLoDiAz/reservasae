/** Asignar grupo a mano respeta el tope de ESE grupo, no solo el de la oferta. */

/**
 * SON DOS TOPES DISTINTOS Y ESTA PUERTA MIRABA UNO.
 *
 * La `Oferta` es la acción en un departamento; la `GrupoCobertura` es
 * el trozo que le toca a UN grupo dentro de esa sede, y es el número
 * que el panel enseña y deja editar en Cronograma --«Comprometido» y
 * «Tope»--.
 *
 * `PATCH :id/formacion` solo comprobaba el de la oferta, así que se
 * podía pasar la meta de un grupo de uno en uno y en silencio, mientras
 * `PATCH grupos/lote`, al lado, sí lo impedía con `cuantosCaben`. Un
 * control en pie y vacío de efecto, y justo el camino por el que se
 * mueve gente a mano de un grupo a otro.
 */

import { cuantosCaben } from './elegibles-del-grupo';
import { RETIENEN_ASIENTO } from './etapas';

describe('el tope del grupo es otro distinto del de la oferta', () => {
  /// La regla es la MISMA del lote. Si alguien la cambia alli, esto
  /// cae: es lo que impide que vuelvan a ser dos cuentas.
  it('lleno es lleno, y cuantosCaben lo dice igual para los dos', () => {
    expect(cuantosCaben({ cuposMaximos: 50, apuntados: 50 })).toBe(0);
    expect(cuantosCaben({ cuposMaximos: 50, apuntados: 49 })).toBe(1);
    /// Nunca negativo: un grupo pasado no «debe» sillas.
    expect(cuantosCaben({ cuposMaximos: 50, apuntados: 58 })).toBe(0);
  });

  /// Quien RETIENE asiento no son los que ocupan silla: un interesado
  /// apuntado a la cohorte ya la esta llenando. Contarlo con
  /// OCUPAN_SILLA haria ver vacio un grupo con doscientos dentro.
  it('cuenta a los apuntados, no solo a los que ocupan silla', () => {
    expect(RETIENEN_ASIENTO).toContain('INTERESADO');
    expect(RETIENEN_ASIENTO).toContain('CONTACTADO');
    expect(RETIENEN_ASIENTO).toContain('INSCRITO');
    /// Y fuera las salidas: quien se retiro libero su asiento.
    expect(RETIENEN_ASIENTO).not.toContain('RETIRADO');
    expect(RETIENEN_ASIENTO).not.toContain('PERDIDO');
    expect(RETIENEN_ASIENTO).not.toContain('NO_APROBO');
  });
});

/**
 * Y QUE LA PUERTA DE VERDAD LO MIRE, que es lo que fallaba.
 *
 * Se lee el fichero porque montar `asignar` entero exige media docena
 * de dobles --oferta, cobertura, permisos, auditoría, movimientos-- y
 * lo que hay que fijar es una sola cosa: que el tope de la cobertura
 * se comprueba ahí. Es el criterio de `el-espejo-no-se-separa`.
 */
describe('la puerta de asignar comprueba el tope de la cobertura', () => {
  const fuente = require('node:fs').readFileSync(
    require('node:path').join(__dirname, 'crm.service.ts'),
    'utf8',
  ) as string;

  /// Sin comentarios: este proyecto explica sus decisiones en
  /// docblocks y `cuantosCaben` sale citado mas veces que llamado.
  const codigo = fuente
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  it('llama a cuantosCaben con el tope de la COBERTURA', () => {
    expect(codigo).toMatch(
      /cuantosCaben\(\{\s*cuposMaximos:\s*cobertura\.cuposMaximos/,
    );
  });

  it('cuenta los apuntados de ESA cobertura, excluyendo a la propia ficha', () => {
    const bloque =
      /coberturaId:\s*dto\.coberturaId,[\s\S]{0,200}?etapa:\s*\{\s*in:\s*RETIENEN_ASIENTO\s*\}[\s\S]{0,120}?id:\s*\{\s*not:\s*id\s*\}/;
    expect(codigo).toMatch(bloque);
  });

  /// El candado al reves: solo cuando la cohorte CAMBIA. Comprobarlo
  /// siempre daria 409 a quien edita otra cosa de una ficha que ya
  /// esta en un grupo lleno --y eso ya paso una vez en esta misma
  /// puerta, el 23 sep, con el candado de permisos.
  it('solo lo comprueba cuando la cohorte cambia de verdad', () => {
    expect(codigo).toMatch(
      /if \(dto\.coberturaId !== p\.coberturaId\)\s*\{[\s\S]{0,400}?cuantosCaben/,
    );
  });
});
