/** Revocar tiene efecto en TODAS las salidas, no en una. */

/**
 * `revocadaEn` se leía en siete consultas y no se escribía en
 * ninguna. Al abrir la puerta para escribirla apareció la mitad
 * de atrás del mismo problema: había salidas que no la leían.
 *
 *  - El **F7** contaba a quien revocó como beneficiario de su
 *    empresa, mientras los dos reportes de personas ya lo
 *    dejaban fuera: los dos archivos que se le entregan al mismo
 *    cliente decían cosas distintas.
 *  - La **cola del RUI** mandaba su cédula al portal del DNP
 *    después de la revocación, porque la consulta se había
 *    encolado antes.
 *  - La **ficha** decía «todavía no ha autorizado» y ofrecía
 *    registrarla con un clic.
 *
 * Este spec recorre las salidas juntas a propósito. Comprobarlas
 * de una en una es exactamente cómo se llegó hasta aquí.
 */

import { SepService } from './sep/sep.service';

type Consulta = { tabla: string; where: unknown };

/** Anota el `where` de cada consulta que reciba. */
function espia() {
  const consultas: Consulta[] = [];
  const anota =
    (tabla: string, valor: unknown) => (args?: { where?: unknown }) => {
      consultas.push({ tabla, where: args?.where });
      return Promise.resolve(valor);
    };

  return {
    consultas,
    convenio: {
      findFirst: anota('convenio', {
        id: 'c1',
        nombre: 'ADECOPRIA',
        sigla: 'ADE',
      }),
      findUnique: anota('convenio', {
        id: 'c1',
        nombre: 'ADECOPRIA',
        sigla: 'ADE',
      }),
    },
    participante: { findMany: anota('participante', []) },
    autorizacionDatos: { findMany: anota('autorizacionDatos', []) },
    persona: { findMany: anota('persona', []) },
  };
}

/** ¿Este `where` exige una autorización viva? */
function exigeAutorizacionViva(where: unknown): boolean {
  const texto = JSON.stringify(where ?? {});
  return (
    texto.includes('"revocadaEn":null') || texto.includes('"revocadaEn": null')
  );
}

describe('el F7 no cuenta a quien revocó', () => {
  /**
   * LA REGLA ES LA MISMA; LO QUE CAMBIÓ ES DÓNDE SE APLICA.
   *
   * Esta prueba miraba el `where` de la consulta de participantes del
   * F7, y esa consulta YA NO EXISTE: desde el 5 oct 2026 el F7 se
   * construye sobre las filas que de verdad salen en el cargue, en vez
   * de preguntar por su cuenta. Era el arreglo de que los dos archivos
   * que se entregan juntos al SENA se contradijeran ---el F7 contaba
   * beneficiarios que el cargue excluye---.
   *
   * Así que la autorización se exige ahora en la consulta de
   * `autorizacionDatos`, que es la que arma el conjunto de autorizados,
   * y además es MÁS ESTRICTA que la de antes: acota al convenio Y a
   * `destinatario: PARTICIPANTE`.
   *
   * No se relaja nada. La regla se prueba además POR RESULTADO ---que
   * es mejor que por la forma de un `where`--- en
   * `sep/el-f7-cuenta-los-del-cargue.spec.ts`: «y a quien revocó la
   * autorización tampoco lo cuenta».
   */
  it('exige autorización viva donde ahora se decide', async () => {
    const prisma = espia();
    const sep = new SepService(prisma as never);

    await sep.alistamientoF7('c1', ['c1']).catch(() => undefined);

    const deAutorizaciones = prisma.consultas.filter(
      (c) => c.tabla === 'autorizacionDatos',
    );
    expect(deAutorizaciones.length).toBeGreaterThan(0);
    /// TODAS, no «alguna»: basta una que no lo exija para que entre
    /// quien revocó. Si esta aserción cae, el F7 volvió a contarlo.
    expect(deAutorizaciones.every((c) => exigeAutorizacionViva(c.where))).toBe(
      true,
    );
  });

  it('y lo acota al convenio pedido, no a cualquier autorización', async () => {
    /// Una autorización viva en el OTRO convenio no la devuelve
    /// a este reporte: son dos tratamientos distintos.
    const prisma = espia();
    const sep = new SepService(prisma as never);

    await sep.alistamientoF7('c1', ['c1']).catch(() => undefined);

    const dePersonas = prisma.consultas.find((c) => c.tabla === 'participante');
    expect(JSON.stringify(dePersonas?.where)).toContain('"convenioId":"c1"');
  });
});

describe('los reportes de personas ya la honraban, y siguen', () => {
  it('el alistamiento pide las autorizaciones vivas del convenio', async () => {
    const prisma = espia();
    const sep = new SepService(prisma as never);

    await sep.alistamiento('c1', ['c1']).catch(() => undefined);

    const deAutorizaciones = prisma.consultas.filter(
      (c) => c.tabla === 'autorizacionDatos',
    );
    expect(deAutorizaciones.length).toBeGreaterThan(0);
    expect(deAutorizaciones.every((c) => exigeAutorizacionViva(c.where))).toBe(
      true,
    );
  });
});
