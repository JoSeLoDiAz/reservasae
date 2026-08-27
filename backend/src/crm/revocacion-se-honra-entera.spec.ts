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
  const anota = (tabla: string, valor: unknown) => (args?: { where?: unknown }) => {
    consultas.push({ tabla, where: args?.where });
    return Promise.resolve(valor);
  };

  return {
    consultas,
    convenio: {
      findFirst: anota('convenio', { id: 'c1', nombre: 'ADECOPRIA', sigla: 'ADE' }),
      findUnique: anota('convenio', { id: 'c1', nombre: 'ADECOPRIA', sigla: 'ADE' }),
    },
    participante: { findMany: anota('participante', []) },
    autorizacionDatos: { findMany: anota('autorizacionDatos', []) },
    persona: { findMany: anota('persona', []) },
  };
}

/** ¿Este `where` exige una autorización viva? */
function exigeAutorizacionViva(where: unknown): boolean {
  const texto = JSON.stringify(where ?? {});
  return texto.includes('"revocadaEn":null') || texto.includes('"revocadaEn": null');
}

describe('el F7 no cuenta a quien revocó', () => {
  it('su consulta de participantes exige autorización viva', async () => {
    const prisma = espia();
    const sep = new SepService(prisma as never);

    await sep.alistamientoF7('c1', ['c1']).catch(() => undefined);

    const dePersonas = prisma.consultas.filter((c) => c.tabla === 'participante');
    expect(dePersonas.length).toBeGreaterThan(0);
    /// Si esta aserción cae, el F7 volvió a contar a quien
    /// revocó y los dos archivos vuelven a contradecirse.
    expect(dePersonas.some((c) => exigeAutorizacionViva(c.where))).toBe(true);
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
    expect(deAutorizaciones.every((c) => exigeAutorizacionViva(c.where))).toBe(true);
  });
});
