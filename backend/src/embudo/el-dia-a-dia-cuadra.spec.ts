/** Cada serie del día a día se cuenta con la regla de su tarjeta. */

/// La pantalla de tráfico pinta, bajo cada cifra, la chispa de esa
/// misma cifra día a día. Hasta el 21 sep 2026 `porDia` traía solo
/// aperturas y preinscripciones, y la chispa de «Personas» dibujaba
/// las aperturas y la de «Eligieron un curso» las preinscripciones:
/// una tendencia ajena bajo cada número.
///
/// Las consultas no se pueden ejecutar aquí --pg-mem no tiene
/// `generate_series` sobre fechas, ni `AT TIME ZONE`, ni
/// `array_position`, y el `FILTER` lo ignora sin avisar--, así que
/// se fija lo que hace que cuadren: que la serie lea las MISMAS
/// filas que la tarjeta. La suma contra la base de verdad se
/// comprobó a mano contra `/api/admin/embudo-publico`.

import { Prisma } from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import { EmbudoService } from './embudo.service';
import { altura } from './escalera';

const DESDE = new Date('2026-09-14T05:00:00Z');
const HASTA = new Date('2026-09-21T05:00:00Z');

/// Los `$1, $2…` dependen de dónde cae el trozo dentro de la
/// consulta: el mismo trozo metido en dos consultas sale con otra
/// numeración, y eso no es una diferencia.
function sinNumerar(texto: string): string {
  return texto.replace(/\$\d+/g, '$?').replace(/\s+/g, ' ').trim();
}

function servicio(filas: unknown[] = []) {
  const pedidas: Prisma.Sql[] = [];
  /// Se llama como plantilla etiquetada: llegan las piezas sueltas
  /// y se vuelven a juntar como las junta Prisma.
  const prisma = {
    $queryRaw: (piezas: TemplateStringsArray, ...valores: unknown[]) => {
      pedidas.push(Prisma.sql(piezas, ...valores));
      return Promise.resolve(filas);
    },
  } as unknown as PrismaService;
  return { s: new EmbudoService(prisma), pedidas };
}

/// Solo para leer los métodos privados sin pelear con `private`.
type Privados = {
  personas(a: string[], d: Date, h: Date): Promise<number>;
  porDia(a: string[], d: Date, h: Date): Promise<unknown[]>;
  hitos(a: string[], d: Date, h: Date): Promise<unknown[]>;
  llegadasDePersona(a: string[], d: Date, h: Date): Prisma.Sql;
};

describe('el día a día cuadra con sus tarjetas', () => {
  it('«Personas» día a día lee las mismas llegadas que su cifra', async () => {
    const { s, pedidas } = servicio();
    const p = s as unknown as Privados;
    await p.personas(['c1'], DESDE, HASTA);
    await p.porDia(['c1'], DESDE, HASTA);
    const [cifra, serie] = pedidas;
    const filas = sinNumerar(p.llegadasDePersona(['c1'], DESDE, HASTA).text);

    expect(sinNumerar(cifra.text)).toContain(filas);
    expect(sinNumerar(serie.text)).toContain(filas);
    /// Y con el MISMO periodo: el mismo trozo con otras fechas
    /// tampoco cuadraría.
    expect(serie.values).toEqual(expect.arrayContaining([DESDE, HASTA]));
  });

  it('«Eligieron» y «Abrieron» salen del mismo tope por visita que el embudo', async () => {
    const { s, pedidas } = servicio();
    const p = s as unknown as Privados;
    await p.hitos(['c1'], DESDE, HASTA);
    await p.porDia(['c1'], DESDE, HASTA);
    const [embudo, serie] = pedidas;

    /// El CASE que calcula hasta qué peldaño llegó cada visita.
    const tope = /MAX\(CASE WHEN "paso" = ANY[\s\S]*?END\) AS tope/;
    const deEmbudo = sinNumerar(embudo.text).match(tope)?.[0];
    expect(deEmbudo).toBeDefined();
    expect(sinNumerar(serie.text)).toContain(deEmbudo);

    /// `hitos()` acredita el peldaño n (contado desde 1) a toda
    /// visita con tope ≥ n; la serie tiene que cortar en el mismo n.
    expect(serie.values).toContain(altura('ELIGIO_ACCION') + 1);
    expect(sinNumerar(serie.text)).toContain('FILTER (WHERE tope >= 1)');
  });

  it('devuelve las cuatro series en números', async () => {
    const { s } = servicio([
      {
        dia: '2026-09-18',
        llegaron: 50n,
        personas: 12n,
        eligieron: 5n,
        preinscritos: 4n,
      },
    ]);
    const dias = await (s as unknown as Privados).porDia(['c1'], DESDE, HASTA);
    expect(dias).toEqual([
      {
        dia: '2026-09-18',
        llegaron: 50,
        personas: 12,
        eligieron: 5,
        preinscritos: 4,
      },
    ]);
  });
});
