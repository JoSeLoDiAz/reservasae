/** Qué hace el webhook con lo que manda Meta. */

/**
 * Meta se porta distinto a nuestro orquestador y por eso
 * tiene sus propias pruebas:
 *
 *   - No manda los datos de la persona, solo un
 *     identificador. El aviso hay que guardarlo IGUAL.
 *   - Agrupa varios avisos en un mismo envío.
 *   - Reintenta cuando no recibe 200, y si insiste sin éxito
 *     APAGA el webhook.
 *
 * De ahí sale lo que cuidan estas pruebas: que no se pierda
 * ningún aviso, ni por venir a medias, ni por venir
 * acompañado, ni porque a nosotros nos faltara una
 * credencial.
 */

import { LeadsService } from './leads.service';
import type { AvisoDeMeta } from './meta';

const ADECOPRIA = { id: 'c-ade', slug: 'adecopria', activo: true };

function aviso(id: string): AvisoDeMeta {
  return {
    leadgenId: id,
    formularioId: 'f-1',
    paginaId: 'p-1',
    anuncioId: 'a-1',
    creadoEn: new Date('2026-08-28T15:00:00.000Z'),
  };
}

/// `revienta` deja simular que una fila concreta falla al
/// guardarse: es el caso que decide si un lote entero se
/// pierde por una fila mala.
function armar(opciones: { slug?: string; revienta?: string } = {}) {
  const guardados: Array<Record<string, unknown>> = [];

  const prisma = {
    convenio: {
      findFirst: ({ where }: { where: { slug?: string } }) =>
        Promise.resolve(where.slug === 'adecopria' ? ADECOPRIA : null),
    },
    leadEntrante: {
      upsert: (args: {
        where: unknown;
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => {
        if (args.create.externoId === opciones.revienta) {
          return Promise.reject(new Error('la base dijo que no'));
        }
        guardados.push({ ...args.create, __update: args.update });
        return Promise.resolve({ id: 'l1' });
      },
    },
  };

  const s = new LeadsService(prisma as never, {
    encolarSiHaceFalta: () => Promise.resolve(),
  } as never);

  /// El gremio entra por PARAMETRO, no por variable de
  /// entorno: lo dice el subdominio por el que llamo Meta.
  return { s, guardados, slug: opciones.slug ?? 'adecopria' };
}

describe('el gremio no se adivina', () => {
  it('sin subdominio de gremio no se guarda nada', async () => {
    // Meta tiene que llamar a adecopria.reservasae.com o a
    // britcham-adee.reservasae.com: por la direccion general
    // no se sabe de quien es el lead, y meter a alguien de un
    // gremio en el otro es peor que dejar el lead esperando
    const { s, guardados, slug } = armar({ slug: '' });
    const r = await s.deMeta([aviso('1')], slug);
    expect(guardados).toHaveLength(0);
    expect(r.sinConvenio).toBe(true);
  });

  it('con un slug que no existe, tampoco', async () => {
    const { s, guardados, slug } = armar({ slug: 'no-existe' });
    expect((await s.deMeta([aviso('1')], slug)).sinConvenio).toBe(true);
    expect(guardados).toHaveLength(0);
  });

  it('pero se dice cuántos llegaron, para poder pedirlos otra vez', async () => {
    // callar el número seria perderlos sin saber cuantos
    const { s, slug } = armar({ slug: '' });
    expect((await s.deMeta([aviso('1'), aviso('2')], slug)).recibidos).toBe(2);
  });
});

describe('no se pierde ningún aviso', () => {
  it('los tres de un mismo envío se guardan', async () => {
    // Meta agrupa; quedarse con el primero es el fallo que
    // nadie nota hasta que faltan leads
    const { s, guardados, slug } = armar();
    const r = await s.deMeta([aviso('1'), aviso('2'), aviso('3')], slug);
    expect(r.guardados).toBe(3);
    expect(guardados.map((g) => g.externoId)).toEqual(['1', '2', '3']);
  });

  it('si uno falla, los otros SÍ se guardan', async () => {
    // uno a uno y con su propio try: un lote entero perdido
    // por una fila mala es lo que no puede pasar
    const { s, guardados, slug } = armar({ revienta: '2' });
    const r = await s.deMeta([aviso('1'), aviso('2'), aviso('3')], slug);
    expect(r.guardados).toBe(2);
    expect(guardados.map((g) => g.externoId)).toEqual(['1', '3']);
  });

  it('un envío sin leads no es un error', async () => {
    // Meta manda por el mismo webhook cambios de la pagina
    const { s, guardados, slug } = armar();
    const r = await s.deMeta([], slug);
    expect(r.recibidos).toBe(0);
    expect(guardados).toHaveLength(0);
  });
});

describe('lo que queda guardado', () => {
  it('se guarda aunque Meta no mande los datos de la persona', async () => {
    // un lead pagado que se pierde porque a nosotros nos
    // faltaba una credencial es plata tirada
    const { s, guardados, slug } = armar();
    await s.deMeta([aviso('9')], slug);
    expect(guardados).toHaveLength(1);
    expect(guardados[0].motivo).toMatch(/Graph API|identificador/i);
  });

  it('queda como FACEBOOK, que es lo que lo marca como pauta', async () => {
    const { s, guardados, slug } = armar();
    await s.deMeta([aviso('9')], slug);
    expect(guardados[0].origen).toBe('FACEBOOK');
  });

  it('el cuerpo entero se conserva, para poder completarlo después', async () => {
    const { s, guardados, slug } = armar();
    await s.deMeta([aviso('9')], slug);
    const carga = guardados[0].carga as Record<string, unknown>;
    expect(carga.leadgenId).toBe('9');
    expect(carga.anuncioId).toBe('a-1');
    expect(carga.creadoEn).toBe('2026-08-28T15:00:00.000Z');
  });

  it('un reintento de Meta NO pisa lo que ya se completó', async () => {
    // `update` vacio a proposito: Meta reintenta, y un
    // reintento no puede borrar el nombre que ya se pidio
    const { s, guardados, slug } = armar();
    await s.deMeta([aviso('9')], slug);
    expect(guardados[0].__update).toEqual({});
  });
});
