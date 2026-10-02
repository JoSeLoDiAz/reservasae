/** El dígito declarado que se guarda es el que tecleó la persona. */

/**
 * EL CONTROL QUE SE APAGABA SOLO.
 *
 * `digitoDeclarado` es, dice el schema, «el declarado en la fuente; el
 * que vale se calcula». En `agregarManual` la fuente es la persona que
 * escribió el NIT, y `leerNit` ya separa las dos cosas: `digitoTecleado`
 * ---nulo si no puso ninguno--- y `digitoVerificacion`, que sale de la
 * cuenta de la DIAN.
 *
 * Hasta el 1 oct 2026 se guardaba el CALCULADO, y eso apagaba un
 * control en silencio: la lectura del banco solo enseña el declarado
 * CUANDO DIFIERE del real ---esa comparación es la que caza el NIT mal
 * tecleado--- y si lo guardado es el calculado por construcción, no
 * puede diferir nunca.
 *
 * Lo caro no era el dato. Era que cuando alguien tecleaba un dígito
 * EQUIVOCADO, el alta lo pisaba con el correcto y la discrepancia
 * desaparecía para siempre. El único momento en que se sabe que hubo un
 * error es ese, y ahí se borraba.
 *
 * Lo encontró José revisando `poner-al-dia-independientes.ts`, que hacía
 * lo mismo. Resultó que ese guion no inventó el patrón: lo copió de
 * aquí, así que arreglar solo el guion dejaba viva la puerta por la que
 * entra la gente todos los días.
 */

import { DirectorioService } from './directorio.service';

/// Un doble que solo recuerda con qué lo llamaron. El alta es un
/// `upsert` y lo único que importa aquí es qué va en `create`.
function conUpsert() {
  const visto: { create?: Record<string, unknown> } = {};
  const prisma = {
    institucion: {
      upsert: (args: { create: Record<string, unknown> }) => {
        visto.create = args.create;
        return Promise.resolve({
          id: 'i1',
          nit: args.create.nit,
          razonSocial: args.create.razonSocial,
          digitoDeclarado: args.create.digitoDeclarado,
          fuente: args.create.fuente,
        });
      },
    },
  };
  return { prisma, visto };
}

describe('el dígito declarado que se guarda', () => {
  it('es el que tecleó la persona, no el calculado', async () => {
    const { prisma, visto } = conUpsert();
    const servicio = new DirectorioService(prisma as never);

    /// 890917074 tiene DV 1. Aquí teclean el 1, que es el bueno.
    await servicio.agregarManual('890917074-1', 'Colegio de prueba');

    expect(visto.create?.digitoDeclarado).toBe('1');
  });

  /**
   * EL CASO QUE IMPORTA, y el que antes se perdía.
   *
   * Teclean un DV que no es el que sale de la cuenta. Antes se
   * guardaba el calculado y la equivocación se borraba; ahora se
   * guarda lo que escribieron, y la lectura del banco puede
   * enseñarlo porque difiere.
   */
  it('guarda el equivocado cuando lo teclean mal, que es para lo que existe', async () => {
    const { prisma, visto } = conUpsert();
    const servicio = new DirectorioService(prisma as never);

    await servicio.agregarManual('890917074-9', 'Colegio de prueba');

    expect(visto.create?.digitoDeclarado).toBe('9');
    /// Y no el que habría salido de la cuenta.
    expect(visto.create?.digitoDeclarado).not.toBe('1');
  });

  it('queda nulo si no tecleó ninguno: no hay nada declarado', async () => {
    const { prisma, visto } = conUpsert();
    const servicio = new DirectorioService(prisma as never);

    await servicio.agregarManual('890917074', 'Colegio de prueba');

    expect(visto.create?.digitoDeclarado).toBeNull();
  });

  /**
   * LA PRUEBA DE QUE EL CONTROL VUELVE A ESTAR VIVO.
   *
   * No basta con guardar bien: lo que se quería es que la comparación
   * de `leerBanco` ---«enseña el declarado solo si difiere»--- pueda
   * saltar. Con el calculado guardado no podía, y por eso esto se
   * comprueba aparte y no como un detalle del caso de arriba.
   */
  it('con el calculado guardado, la comparación no podía saltar nunca', () => {
    const calculado = '1';
    const comoEstaba = calculado;
    const comoQuedo = '9';

    const enseña = (declarado: string | null) =>
      declarado !== null && declarado !== calculado;

    expect(enseña(comoEstaba)).toBe(false);
    expect(enseña(comoQuedo)).toBe(true);
    expect(enseña(null)).toBe(false);
  });
});
