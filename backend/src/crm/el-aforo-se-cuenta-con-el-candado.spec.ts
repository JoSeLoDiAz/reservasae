/** Las comprobaciones de aforo se rehacen DENTRO del candado. */

/**
 * UN TOPE LEÍDO FUERA DEL CANDADO NO ES UN CANDADO.
 *
 * `asignar` comprobaba el cupo de la oferta y el del grupo con tres
 * consultas sueltas y escribía después, en un `$transaction(array)`
 * que no vuelve a mirar nada. Entre lo que ve y lo que escribe cabe
 * otro asesor haciendo lo mismo: los dos ven la última silla y los dos
 * entran.
 *
 * El tope de celda que entró el 7 oct 2026 era, por eso, un control en
 * pie y vacío de efecto bajo concurrencia --exactamente lo que fue a
 * arreglar--. `cambiarEtapa` ya tenía la forma buena desde agosto:
 * comprobar fuera para fallar pronto y con buen mensaje, y REHACERLO
 * dentro con las filas tomadas.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const servicio = readFileSync(join(__dirname, 'crm.service.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

/// El cuerpo de `asignar`, que es el que cambió. Se acota para que un
/// FOR UPDATE de otro método no dé por bueno este.
function cuerpoDeAsignar(): string {
  const i = servicio.indexOf('async asignar(');
  expect(i).toBeGreaterThan(-1);
  const j = servicio.indexOf('\n  async ', i + 10);
  return servicio.slice(i, j === -1 ? undefined : j);
}

describe('asignar no escribe sin haber tomado el candado', () => {
  const cuerpo = cuerpoDeAsignar();

  it('abre una transacción interactiva, no un array de escrituras', () => {
    expect(cuerpo).toMatch(/\$transaction\(async \(tx\) =>/);
    /// El array no vuelve a mirar nada: es lo que habia.
    expect(cuerpo).not.toMatch(/\$transaction\(escrituras\)/);
  });

  it('toma la fila de la oferta Y la de la cobertura', () => {
    expect(cuerpo).toMatch(/FROM "ofertas"[\s\S]{0,60}?FOR UPDATE/);
    expect(cuerpo).toMatch(/FROM "grupos_cobertura"[\s\S]{0,60}?FOR UPDATE/);
  });

  /// EL ORDEN NO ES LIBRE: dos peticiones que tomaran los dos candados
  /// al reves se bloquearian la una a la otra. Siempre oferta primero.
  it('siempre la oferta antes que la cobertura', () => {
    const oferta = cuerpo.search(/FROM "ofertas"[\s\S]{0,60}?FOR UPDATE/);
    const celda = cuerpo.search(/FROM "grupos_cobertura"[\s\S]{0,60}?FOR UPDATE/);
    expect(oferta).toBeGreaterThan(-1);
    expect(celda).toBeGreaterThan(oferta);
  });

  it('relee el aforo DESPUÉS de tomar el candado, no antes', () => {
    const candado = cuerpo.search(/FROM "ofertas"[\s\S]{0,60}?FOR UPDATE/);
    /// La recuenta de la oferta.
    const recuenta = cuerpo.indexOf('ocupadasAhora');
    expect(recuenta).toBeGreaterThan(candado);
    /// Y la de la celda, con la cuenta COMPARTIDA y el `tx`.
    const compartida = cuerpo.indexOf('cabenEnLaCobertura(\n              tx as never');
    expect(compartida === -1 ? cuerpo.indexOf('tx as never') : compartida).toBeGreaterThan(candado);
  });

  it('escribe DENTRO de la transacción', () => {
    const transaccion = cuerpo.indexOf('$transaction(async (tx)');
    for (const escritura of [
      'tx.participante.update(',
      'tx.movimientoParticipante.create(',
    ]) {
      expect(cuerpo.indexOf(escritura)).toBeGreaterThan(transaccion);
    }
    /// Y nada se escribe por fuera con el cliente de siempre.
    expect(cuerpo).not.toMatch(/this\.prisma\.participante\.update\(/);
  });
});
