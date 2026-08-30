import {
  ORIGENES_DE_PAUTA,
  origenDeLead,
  registrarToqueDeOrigen,
} from './origen-del-lead';
import type { OrigenParticipante } from '../../generated/prisma';

/// Un doble que guarda lo que le piden, para poder mirarlo.
function txFalso() {
  const llamadas: Array<Record<string, unknown>> = [];
  return {
    llamadas,
    toqueDeOrigen: {
      upsert(args: unknown) {
        llamadas.push(args as Record<string, unknown>);
        return Promise.resolve({});
      },
    },
  };
}

describe('cada canal cae en su puerta', () => {
  it('las redes de Meta son pauta', () => {
    for (const o of ORIGENES_DE_PAUTA) expect(origenDeLead(o)).toBe('PAUTA');
  });

  it('la autogestión es orgánica: llegó sola', () => {
    expect(origenDeLead('AUTOGESTION')).toBe('ORGANICO');
  });

  it('lo demás es importación: alguien lo subió', () => {
    const resto: OrigenParticipante[] = ['EMPRESA', 'ASESOR', 'REFERIDO', 'EVENTO', 'OTRO'];
    for (const o of resto) expect(origenDeLead(o)).toBe('IMPORTACION');
  });
});

describe('un toque de origen no pisa el que se tenía', () => {
  it('vuelve por el mismo canal: se cuenta, no se duplica', async () => {
    const tx = txFalso();
    await registrarToqueDeOrigen(tx, 'p1', 'REDES');

    const [a] = tx.llamadas;
    /// La clave única es (participante, origen): sin ella dos
    /// llegadas por el mismo anuncio serían dos orígenes.
    expect(a.where).toEqual({
      participanteId_origen: { participanteId: 'p1', origen: 'REDES' },
    });
    /// Y al repetirse SUMA, que es lo que distingue «volvió»
    /// de «llegó por otro sitio».
    expect((a.update as { veces: unknown }).veces).toEqual({ increment: 1 });
  });

  it('el toque nace con su clase ya resuelta', async () => {
    const tx = txFalso();
    await registrarToqueDeOrigen(tx, 'p1', 'FACEBOOK');
    expect((tx.llamadas[0].create as { clase: string }).clase).toBe('PAUTA');
  });

  it('registrar un toque NUNCA escribe en la ficha', async () => {
    const tx = txFalso();
    await registrarToqueDeOrigen(tx, 'p1', 'REDES');
    /// Es la regla entera: la pauta deja constancia de haber
    /// tocado, y el lead sigue siendo de quien lo consiguió.
    /// Si esta función tocara `participante`, el community
    /// manager perdería el suyo.
    expect(Object.keys(tx)).not.toContain('participante');
    expect(JSON.stringify(tx.llamadas)).not.toContain('origenLead');
  });
});
