/** El lote de conversaciones dice qué pasó con cada una. */

/**
 * POR QUE EXISTE EL LOTE: la puerta de notas era de una en una, asi
 * que un historico de conversaciones eran N llamadas. Lo pidio Josse
 * el 8 oct 2026 ---«que el backend lo pueda interpretar»--- y la
 * documentacion de Lucid lo hace obligatorio: su API NO tiene ningun
 * endpoint que devuelva los mensajes de una conversacion, asi que lo
 * que haya pasado solo se puede EMPUJAR, y en tanda.
 *
 * Y CONTESTA FILA POR FILA, que es la mitad que vale: «pegadas: 300»
 * no dice cual quedo sin dueno ni cual estaba ya, asi que quien lo
 * manda no sabria que reintentar.
 */

import { LucidService } from './lucid.service';
import { TOPE_DE_NOTAS } from './dto';

function armar(respuestas: Array<unknown | Error>) {
  const s = new LucidService({} as never);
  let i = 0;
  (s as unknown as { entra: unknown }).entra = () => {
    const r = respuestas[i++];
    return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
  };
  return s;
}

const nota = (externoId: string) => ({ externoId, telefono: '3001234567', resumen: 'x' });

describe('el lote contesta fila por fila', () => {
  it('cuenta cada estado por separado', async () => {
    const s = armar([
      { estado: 'PEGADA', repetido: false },
      { estado: 'SIN_DUENO', repetido: false },
      { estado: 'AMBIGUA', repetido: false },
      { estado: 'PEGADA', repetido: true },
    ]);
    const r = await s.entraLote(
      { notas: ['a', 'b', 'c', 'd'].map(nota) } as never,
      'lucid',
      'adecopria',
    );
    expect(r.recibidas).toBe(4);
    expect(r.pegadas).toBe(2);
    expect(r.sinDueno).toBe(1);
    expect(r.ambiguas).toBe(1);
    /// Las que ya estaban no son un fallo ni una escritura: es la
    /// idempotencia funcionando, y hay que poder distinguirlas.
    expect(r.repetidas).toBe(1);
  });

  /**
   * UNA FILA MALA NO TUMBA LAS DEMAS. Es el criterio de la carga
   * masiva de personas ---«las filas se crean una a una, no en
   * transaccion»---: en un historico de 500, que la 17 traiga un
   * telefono imposible no puede perder las otras 499.
   */
  it('una fila que falla no se lleva al lote', async () => {
    const s = armar([
      { estado: 'PEGADA', repetido: false },
      new Error('No existe el convenio «xx».'),
      { estado: 'PEGADA', repetido: false },
    ]);
    const r = await s.entraLote({ notas: ['a', 'b', 'c'].map(nota) } as never, 'lucid', null);
    expect(r.pegadas).toBe(2);
    expect(r.rechazadas).toBe(1);
  });

  /// Y el motivo viaja, para poder arreglar la fila y reintentarla.
  it('la fila rechazada dice por qué, con su externoId', async () => {
    const s = armar([new Error('Falta el convenio.')]);
    const r = await s.entraLote({ notas: [nota('b')] } as never, 'lucid', null);
    expect(r.filas[0]).toEqual({
      externoId: 'b',
      estado: 'RECHAZADA',
      motivo: 'Falta el convenio.',
    });
  });

  /// Cada fila lleva su `externoId` de vuelta: sin el, una respuesta
  /// de 500 filas no se puede casar con lo que se mando.
  it('cada fila vuelve con su externoId', async () => {
    const s = armar([
      { estado: 'PEGADA', repetido: false },
      { estado: 'SIN_DUENO', repetido: false },
    ]);
    const r = await s.entraLote({ notas: ['uno', 'dos'].map(nota) } as never, 'lucid', null);
    expect(r.filas.map((f) => f.externoId)).toEqual(['uno', 'dos']);
  });

  /**
   * EL TOPE NO ES DE MEMORIA, ES DEL RELOJ: Cloudflare corta a los
   * ~100 s, asi que un lote mas grande se pierde entero despues de
   * haber escrito la mitad. Mismo numero que el lote de leads.
   */
  it('el tope es el mismo que el del lote de leads', () => {
    expect(TOPE_DE_NOTAS).toBe(500);
  });
});
