/** Una fila mala no puede tumbar el lote. */

/**
 * Es la misma lección de la carga masiva del panel, y por lo
 * mismo: en un lote de 500, que la 17 traiga un documento
 * inválido no puede llevarse las otras 499.
 *
 * Y la otra mitad: se contesta FILA POR FILA. Un lote que
 * devuelve «ok» y se traga trece errores es peor que mandar mil
 * peticiones — quien lo mandó cree que entraron todos y los
 * trece se pierden sin que nadie lo sepa nunca.
 */

import { LeadsService } from './leads.service';

/// Un servicio cuyo `entra` obedece un guion: por cada posición,
/// o devuelve algo o lanza. Se prueba el LOTE, no el alta.
function armar(guion: Array<'ok' | 'repetido' | 'falla'>) {
  const s = new LeadsService({} as never, {} as never, { intentar: () => Promise.resolve({ paso: false, porque: 'doble', falta: [] }) } as never);

  let i = 0;
  (s as unknown as { entra: unknown }).entra = () => {
    const paso = guion[i++];
    if (paso === 'falla') {
      return Promise.reject(new Error('Ese numero no tiene forma de documento.'));
    }
    return Promise.resolve({
      id: `lead-${i}`,
      estado: 'PENDIENTE',
      motivo: null,
      repetido: paso === 'repetido',
    });
  };

  const leads = guion.map((_, k) => ({
    numeroDocumento: `10203040${k}`,
    externoId: null,
  }));

  return { s, leads };
}

describe('la fila 17 no se lleva a las demás', () => {
  it('con una que falla en medio, las otras entran igual', async () => {
    const { s, leads } = armar(['ok', 'ok', 'falla', 'ok', 'ok']);
    const r = await s.entraLote(leads as never, 'orquestador');

    expect({ recibidos: r.recibidos, entraron: r.entraron, fallaron: r.fallaron }).toEqual(
      { recibidos: 5, entraron: 4, fallaron: 1 },
    );
  });

  it('y se sigue procesando DESPUÉS del fallo, no se corta ahí', async () => {
    /// Un `for` con `await` dentro de un try mal puesto pararía
    /// en la primera excepción y las siguientes ni se
    /// intentarían — y el recuento diría «4 de 5» igual.
    const { s, leads } = armar(['falla', 'ok', 'ok', 'ok']);
    const r = await s.entraLote(leads as never, 'orquestador');

    expect(r.entraron).toBe(3);
    expect(r.filas).toHaveLength(4);
  });
});

describe('se contesta fila por fila, no un total', () => {
  it('cada fila lleva su posición, para poder encontrarla', async () => {
    /// Sin la posición, «el 17 falló» obliga a contar a mano en
    /// un JSON de 500.
    const { s, leads } = armar(['ok', 'falla', 'ok']);
    const r = await s.entraLote(leads as never, 'orquestador');

    expect(r.filas.map((f) => f.fila)).toEqual([1, 2, 3]);
  });

  it('la fila que falla dice POR QUÉ y de quién era', async () => {
    const { s, leads } = armar(['falla']);
    const r = await s.entraLote(leads as never, 'orquestador');

    const mala = r.filas[0];
    expect(mala.ok).toBe(false);
    expect(mala.porque).toMatch(/documento/i);
    /// El documento, para poder buscarlo en el origen.
    expect(mala.documento).toBe('102030400');
  });

  it('los errores van aparte, servidos', async () => {
    /// Quien manda 500 no va a leer 500 filas para encontrar las
    /// 13 malas.
    const { s, leads } = armar(['ok', 'falla', 'ok', 'falla']);
    const r = await s.entraLote(leads as never, 'orquestador');

    expect(r.errores).toHaveLength(2);
    expect(r.errores.every((e) => e.ok === false)).toBe(true);
  });
});

describe('un repetido no es un error ni una alta', () => {
  it('se cuenta aparte de los dos', async () => {
    /// Mezclarlo con los nuevos diría que entraron más de los
    /// que entraron; mezclarlo con los errores diría que algo
    /// falló cuando la idempotencia funcionó.
    const { s, leads } = armar(['ok', 'repetido', 'repetido', 'ok']);
    const r = await s.entraLote(leads as never, 'orquestador');

    expect({ entraron: r.entraron, repetidos: r.repetidos, fallaron: r.fallaron }).toEqual(
      { entraron: 2, repetidos: 2, fallaron: 0 },
    );
  });
});
