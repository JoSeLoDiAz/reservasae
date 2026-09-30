/** El NIT con el DV pegado se parte igual en el panel y en el servidor. */

/**
 * `partirNitPegado` del frontend es COPIA de `traeElDvPegado`, y su
 * propio docblock dice que tiene que seguir siéndolo. Dos verdades
 * sobre la misma decisión acaban discrepando, y aquí lo que
 * discreparía es qué se guarda como NIT: el dato que viaja al F7.
 *
 * El síntoma sería mudo — el panel enseñaría el NIT partido de una
 * forma y el servidor guardaría otra, sin que nada fallara.
 *
 * No se compara el TEXTO de la copia: se le saca el guardia y se
 * ejercita con los mismos casos reales que el servidor.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { calcularDigitoVerificacion, normalizarNit } from './nit';

const ARCHIVO = join(
  __dirname,
  '..',
  '..',
  '..',
  'frontend',
  'src',
  'lib',
  'nit.ts',
);

/// Los siete que partieron una organización en dos en producción.
const PEGADOS = [
  '8001837677',
  '8909167689',
  '8909822094',
  '8909857304',
  '8909065744',
  '8150047460',
  '8909825185',
];

/// Cédulas de quien trabaja por su cuenta. La última acaba justo en
/// su propio dígito, así que es la que prueba el guardia del 8|9.
const CEDULAS = ['1007495352', '1026300012', '1112129598', '1007495357'];

function fuente(): string {
  return readFileSync(ARCHIVO, 'utf8');
}

describe('el panel parte el NIT igual que el servidor', () => {
  it('el panel tiene la función, y dice que es una copia', () => {
    const texto = fuente();

    expect(texto).toContain('export function partirNitPegado');
    expect(texto).toContain('traeElDvPegado');
  });

  /// Se saca el guardia del archivo y se ejercita de verdad, en vez
  /// de comparar cadenas: un test que compara texto pasa igual
  /// cuando alguien reescribe la regla con otra forma y otro efecto.
  it('su guardia acepta los siete pegados y rechaza las cédulas', () => {
    const texto = fuente();
    const hallado = /if \(!(\/\^.+?\/)\.test\(digitos\)\) return null;/.exec(
      texto,
    );

    expect(hallado).not.toBeNull();

    const guardia = new RegExp(hallado![1].slice(1, -1));

    expect(PEGADOS.filter((n) => !guardia.test(n))).toEqual([]);
    expect(CEDULAS.filter((n) => guardia.test(n))).toEqual([]);
  });

  /// La tercera condición es la que impide que una de cada once
  /// cédulas se parta por azar. Si desaparece, el guardia de arriba
  /// sigue pasando y el defecto vuelve.
  it('sigue comprobando que el último ES el dígito de los nueve', () => {
    expect(fuente()).toMatch(/digitoVerificacion\(nit\) !== ultimo/);
  });

  it('y el servidor parte esos mismos siete', () => {
    const fallos = PEGADOS.filter((pegado) => {
      const r = normalizarNit(pegado);
      return (
        !r ||
        r.nit !== pegado.slice(0, 9) ||
        r.digitoVerificacion !== calcularDigitoVerificacion(pegado.slice(0, 9))
      );
    });

    expect(fallos).toEqual([]);
  });
});
