/** El asesor da de alta la organización de una ficha, por su NIT. */

/**
 * Antes, una ficha sin organización solo decía «todavía no tiene» y
 * no había cómo ponerla. Josse pidió habilitarlo (30 sep 2026). Lo
 * que este spec protege:
 *
 *   1. Sin NIT no se crea: es la identidad ante el SENA. Se dice.
 *   2. Con NIT se CREA la empresa (upsert) y se ENLAZA a la ficha
 *      (participante.empresaId), y queda la huella ORGANIZACION_ASIGNADA.
 *   3. El DV se DERIVA del NIT, no se teclea.
 *   4. Dar de alta SOLO con el NIT no salta con «no llegó ningún dato».
 *
 * El doble de Prisma aplica el enlace de verdad: registra el upsert y
 * el update del participante.
 */

import { CrmService } from './crm.service';
import { calcularDigitoVerificacion } from '../comun/nit';

function armar() {
  const upserts: Array<{ where: unknown; create: Record<string, unknown> }> = [];
  const participanteUpdates: Array<Record<string, unknown>> = [];
  const empresaUpdates: Array<Record<string, unknown>> = [];
  const auditadas: Array<{ accion: string; resumen?: string }> = [];

  const prisma = {
    participante: {
      /// Sin organización: empresaId null y sin reserva. Etapa
      /// MATRICULADO para que `pasarSiNoLeFaltaNada` salga sola.
      findUnique: () =>
        Promise.resolve({
          convenioId: 'c-adecopria',
          empresaId: null,
          reserva: null,
          etapa: 'MATRICULADO',
          persona: {},
        }),
      update: (a: { data: Record<string, unknown> }) => {
        participanteUpdates.push(a.data);
        return Promise.resolve({});
      },
    },
    empresa: {
      upsert: (a: { where: unknown; create: Record<string, unknown> }) => {
        upserts.push({ where: a.where, create: a.create });
        return Promise.resolve({ id: 'emp-nueva' });
      },
      /// Tras crear, el bloque del NIT relee el nit para comparar:
      /// devuelve el que se acaba de crear, así que no hay «corrección».
      findUnique: (a: { where: { nit?: string } }) =>
        Promise.resolve(
          a.where.nit ? null : { nit: '860507033' },
        ),
      update: (a: { data: Record<string, unknown> }) => {
        empresaUpdates.push(a.data);
        return Promise.resolve({});
      },
    },
  };

  const auditoria = {
    registrar: (a: { accion: string; resumen?: string }) => {
      auditadas.push(a);
      return Promise.resolve();
    },
  };

  const s = new CrmService(
    prisma as never,
    auditoria as never,
    {} as never,
    {} as never,
    {} as never,
    { avisar: () => Promise.resolve() } as never,
    /// El catálogo de notas. Devuelve «sin clasificar», que es lo
    /// que anota una pantalla que todavía no ofrece los
    /// desplegables: ninguno de estos tests clasifica nada.
    {
      exigirClasificacion: () =>
        Promise.resolve({ categoriaId: null, subcategoriaId: null }),
    } as never,
  );
  (s as unknown as { obtener: () => Promise<unknown> }).obtener = () =>
    Promise.resolve({});

  const guardar = (datos: Record<string, unknown>) =>
    (
      s as unknown as {
        guardarDatosDeLaEmpresa: (
          id: string,
          datos: unknown,
          ambito: string[],
          actor: unknown,
          ip?: string,
        ) => Promise<{ organizacionCreada: { nit: string } | null }>;
      }
    ).guardarDatosDeLaEmpresa(
      'p-1',
      datos,
      ['c-adecopria'],
      { id: 'a-1', nombre: 'Ana' },
      '1.2.3.4',
    );

  return { guardar, upserts, participanteUpdates, empresaUpdates, auditadas };
}

describe('sin NIT no se puede dar de alta', () => {
  it('lo dice, y no crea ni enlaza', async () => {
    const { guardar, upserts, participanteUpdates } = armar();
    await expect(
      guardar({ razonSocial: 'Vise LTDA' }),
    ).rejects.toThrow(/NIT/i);
    expect(upserts).toHaveLength(0);
    expect(participanteUpdates).toHaveLength(0);
  });
});

describe('con NIT se crea y se enlaza', () => {
  it('crea la empresa con su DV derivado y la enlaza a la ficha', async () => {
    const { guardar, upserts, participanteUpdates, auditadas } = armar();
    const r = await guardar({ nit: '860507033', razonSocial: 'Colegio X' });

    expect(upserts).toHaveLength(1);
    expect((upserts[0].where as { nit: string }).nit).toBe('860507033');
    expect(upserts[0].create.digitoVerificacion).toBe(
      calcularDigitoVerificacion('860507033'),
    );
    expect(upserts[0].create.razonSocial).toBe('Colegio X');

    /// se enlazó a la ficha
    expect(participanteUpdates.some((d) => d.empresaId === 'emp-nueva')).toBe(
      true,
    );
    /// quedó la huella del alta
    expect(auditadas.some((a) => a.accion === 'ORGANIZACION_ASIGNADA')).toBe(
      true,
    );
    /// devuelve el nit creado, para el directorio
    expect(r.organizacionCreada?.nit).toBe('860507033');
  });

  it('dar de alta SOLO con el NIT no salta con «ningún dato»', async () => {
    const { guardar, upserts } = armar();
    const r = await guardar({ nit: '860507033' });
    expect(upserts).toHaveLength(1);
    /// sin razón social, la empresa nace con el nombre por defecto
    expect(upserts[0].create.razonSocial).toBe('Organización 860507033');
    expect(r.organizacionCreada?.nit).toBe('860507033');
  });

  it('un NIT inválido se rechaza', async () => {
    const { guardar, upserts } = armar();
    await expect(guardar({ nit: 'no-es' })).rejects.toThrow(/NIT/i);
    expect(upserts).toHaveLength(0);
  });

  /// La organización NACE con el DV derivado del NIT: el asesor no
  /// tiene que teclearlo para que quede bien.
  it('nace con el DV derivado aunque no lo escriban', async () => {
    const { guardar, upserts } = armar();
    await guardar({ nit: '860507033', razonSocial: 'Colegio X' });

    expect(upserts[0].create.digitoVerificacion).toBe(
      calcularDigitoVerificacion('860507033'),
    );
  });

  /// Pero si lo escribe, MANDA el suyo (Josse, 30 sep 2026: «el DV
  /// lo ponemos nosotros»). En el panel quien lo teclea tiene el RUT
  /// de la empresa delante, y el campo sale con el calculado puesto,
  /// así que cambiarlo es deliberado.
  ///
  /// La regla del 11 sep --«el DV lo pone la DIAN, no la persona»--
  /// sigue en pie donde importa: las puertas PÚBLICAS lo ignoran.
  it('un DV tecleado en el alta SÍ se guarda', async () => {
    const { guardar, empresaUpdates } = armar();
    await guardar({
      nit: '860507033',
      razonSocial: 'Colegio X',
      digitoVerificacion: '0',
    });

    const conDv = empresaUpdates.filter((d) => d.digitoVerificacion === '0');

    expect(conDv).toHaveLength(1);
  });
});
