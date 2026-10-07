/** El aviso de «completó sus datos» dice qué falta si la ficha no avanzó. */

/**
 * «LAS PERSONAS ESTÁN COMPLETANDO PERO ES COMO SI NO MIGRARA LA
 * INFORMACIÓN» (cliente, 7 oct 2026), con un aviso delante que decía
 * «Marcela Acalo · Interesado — Completó los datos de su
 * organización».
 *
 * Las dos cosas eran ciertas y por eso confundía: la persona SÍ
 * completó lo que el formulario le pidió, y la ficha NO avanzó porque
 * le faltaba otra cosa ---casi siempre el sector económico o el jefe
 * directo---. El sistema lo sabía y no lo decía, así que desde fuera
 * parecía que el dato no llegaba a ninguna parte.
 *
 * Aquí se fija la mitad que se puede probar sin base: que la lista de
 * lo que falta sale de la MISMA regla que decide si la ficha pasa. Dos
 * listas distintas acabarían diciendo «no falta nada» en el aviso
 * mientras la compuerta no deja pasar, que es el mismo defecto con
 * otra cara.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FUENTE = readFileSync(join(__dirname, 'datos-completos.ts'), 'utf8');
const PREINSCRIPCION = readFileSync(
  join(__dirname, '..', 'preinscripcion', 'preinscripcion.service.ts'),
  'utf8',
);

describe('la lista de lo que falta y la compuerta son la misma regla', () => {
  it('las dos llaman a `faltaDeLaFicha`', () => {
    /// Dos veces: una en `loQueLeFaltaALaFicha` y otra en
    /// `pasarSiNoLeFaltaNada`.
    const veces = FUENTE.split('faltaDeLaFicha({').length - 1;
    expect(veces).toBe(2);
  });

  /**
   * Y PIDEN LOS MISMOS CAMPOS. Si una consulta trajera menos campos
   * de la persona, su lista diría que falta algo que sí está: la
   * regla es la misma pero los datos de entrada no.
   */
  it('las dos consultas piden los mismos campos de la persona', () => {
    const veces = FUENTE.split('persona: { select: CAMPOS_DE_LA_PERSONA }')
      .length - 1;
    expect(veces).toBe(2);
  });

  it('y la misma cadena de empresa, con la de la reserva detrás', () => {
    const veces =
      FUENTE.split('p.empresa ?? p.reserva?.empresa ?? null').length - 1;
    expect(veces).toBe(2);
  });
});

describe('los dos avisos del enlace público lo dicen', () => {
  /// Son los dos que el cliente ve en su bandeja: el de sus datos y
  /// el de los de su organización.
  it('el de sus datos', () => {
    const i = PREINSCRIPCION.indexOf("tipo: 'DATOS_COMPLETADOS'");
    expect(i).toBeGreaterThan(-1);
    expect(PREINSCRIPCION.slice(i, i + 220)).toContain('conLoQueFalte');
  });

  /// Y LOS DOS DE ORGANIZACIÓN, que son dos: el de quien la completó
  /// y el de quien declaró que no tiene. Al segundo también le puede
  /// faltar algo ---lo suyo propio--- y quien lleva la ficha necesita
  /// saberlo igual.
  it('y los dos de su organización, incluido el de quien no tiene', () => {
    const todos = PREINSCRIPCION.split("tipo: 'DATOS_DE_EMPRESA'").slice(1);
    expect(todos).toHaveLength(2);
    for (const trozo of todos) {
      expect(trozo.slice(0, 260)).toContain('conLoQueFalte');
    }
  });

  /**
   * Y SOLO CUANDO FALTA ALGO. Pegarle «le falta nada» a un aviso de
   * una ficha que sí avanzó sería ruido en la bandeja de todos los
   * días.
   */
  it('cuando no falta nada, el aviso se queda como estaba', () => {
    const i = PREINSCRIPCION.indexOf('private async conLoQueFalte');
    expect(i).toBeGreaterThan(-1);
    expect(PREINSCRIPCION.slice(i, i + 700)).toContain(
      'if (falta.length === 0) return detalle;',
    );
  });
});
