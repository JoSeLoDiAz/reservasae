/** Corregir el NIT de una empresa desde la ficha de un lead. */

/**
 * El NIT es la llave de `Empresa` y viaja al SENA —el F7 y los dos
 * cargues leen `empresa.nit` directo—, así que estuvo en solo
 * lectura. Pero la gente se preinscribe con el NIT mal, y un NIT
 * malo es un reporte malo: tenía que poder corregirse. Lo que este
 * spec protege es CÓMO se corrige, que es donde está el filo:
 *
 *   1. Un NIT que ya es de OTRA empresa se RECHAZA, no se funde en
 *      silencio: fundir arrastra reservas y cupos y es otra cosa.
 *   2. El dígito de verificación se DERIVA del NIT nuevo, no se
 *      cree lo que venga tecleado (regla de la casa).
 *   3. El vínculo con el maestro de NIT se suelta al renombrar,
 *      porque apuntaba al del NIT viejo.
 *   4. Corregir solo el NIT cuenta como un cambio; el mismo NIT,
 *      con otros signos de puntuación, NO.
 *
 * El doble de Prisma aplica la unicidad de verdad: uno que
 * devolviera siempre `null` en la búsqueda por NIT probaría el
 * doble y dejaría pasar la fusión silenciosa.
 */

import { CrmService } from './crm.service';
import { calcularDigitoVerificacion } from '../comun/nit';

type EmpresaFalsa = { id: string; nit: string; razonSocial: string };

function armar(opts: {
  nitDeEstaEmpresa: string;
  /// Otra empresa que ya ocupa un NIT, para el caso de choque.
  otra?: EmpresaFalsa | null;
}) {
  const updates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  const auditadas: Array<{
    accion: string;
    resumen?: string;
    camposTocados?: string[];
  }> = [];

  const empresas: Record<string, EmpresaFalsa> = {
    'emp-esta': {
      id: 'emp-esta',
      nit: opts.nitDeEstaEmpresa,
      razonSocial: 'Colegio Balbino García',
    },
  };
  if (opts.otra) empresas[opts.otra.id] = opts.otra;

  const prisma = {
    participante: {
      /// Sirve a las tres consultas: el guard del ámbito, la que
      /// resuelve la empresa, y la de `pasarSiNoLeFaltaNada`. Con
      /// etapa MATRICULADO esa última sale sola sin tocar nada.
      findUnique: () =>
        Promise.resolve({
          convenioId: 'c-adecopria',
          empresaId: 'emp-esta',
          reserva: null,
          etapa: 'MATRICULADO',
          persona: {},
        }),
    },
    empresa: {
      findUnique: (a: { where: { id?: string; nit?: string } }) => {
        if (a.where.id) return Promise.resolve(empresas[a.where.id] ?? null);
        if (a.where.nit !== undefined) {
          const hit = Object.values(empresas).find(
            (e) => e.nit === a.where.nit,
          );
          return Promise.resolve(hit ?? null);
        }
        return Promise.resolve(null);
      },
      update: (a: { where: unknown; data: Record<string, unknown> }) => {
        updates.push(a);
        return Promise.resolve({});
      },
    },
  };

  const auditoria = {
    registrar: (a: {
      accion: string;
      resumen?: string;
      camposTocados?: string[];
    }) => {
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
  );

  /// `obtener` corre al final del camino feliz y arma la ficha
  /// entera; no es lo que se prueba aquí.
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
        ) => Promise<unknown>;
      }
    ).guardarDatosDeLaEmpresa(
      'p-1',
      datos,
      ['c-adecopria'],
      { id: 'a-1', nombre: 'Ana' },
      '1.2.3.4',
    );

  return { guardar, updates, auditadas };
}

describe('el NIT libre se corrige', () => {
  it('renombra la fila con el NIT nuevo y su huella', async () => {
    const { guardar, updates, auditadas } = armar({ nitDeEstaEmpresa: '0' });

    await guardar({ nit: '860507033' });

    expect(updates).toHaveLength(1);
    expect(updates[0].data.nit).toBe('860507033');

    const huella = auditadas.find((a) => a.accion === 'NIT_CORREGIDO');
    expect(huella).toBeDefined();
    expect(huella?.resumen).toBe('0 → 860507033');
  });

  it('DERIVA el dígito de verificación e ignora el tecleado', async () => {
    const { guardar, updates } = armar({ nitDeEstaEmpresa: '0' });

    /// Manda un DV a mano que no cuadra: no se le hace caso.
    await guardar({ nit: '860507033', digitoVerificacion: '9' });

    expect(updates[0].data.digitoVerificacion).toBe(
      calcularDigitoVerificacion('860507033'),
    );
    expect(updates[0].data.digitoVerificacion).not.toBe('9');
  });

  it('SUELTA el vínculo con el maestro de NIT viejo', async () => {
    const { guardar, updates } = armar({ nitDeEstaEmpresa: '0' });

    await guardar({ nit: '860507033' });

    expect(updates[0].data.institucionId).toBeNull();
  });
});

describe('el NIT que ya es de otra se rechaza, no se funde', () => {
  it('lanza nombrando la otra empresa y NO escribe', async () => {
    const { guardar, updates } = armar({
      nitDeEstaEmpresa: '0',
      otra: { id: 'emp-otra', nit: '860507033', razonSocial: 'Vise LTDA' },
    });

    await expect(guardar({ nit: '860507033' })).rejects.toThrow(/Vise LTDA/);
    expect(updates).toHaveLength(0);
  });
});

describe('lo que no es un cambio de NIT', () => {
  it('un NIT inválido se rechaza y no escribe', async () => {
    const { guardar, updates } = armar({ nitDeEstaEmpresa: '860507033' });

    await expect(guardar({ nit: 'no-es-un-nit' })).rejects.toThrow(/no es/i);
    expect(updates).toHaveLength(0);
  });

  it('el MISMO NIT con puntos no es un cambio', async () => {
    const { guardar, updates } = armar({ nitDeEstaEmpresa: '860507033' });

    /// Normaliza a 860507033, que es el que ya tiene: no hay nada
    /// más que guardar, así que se rechaza por vacío en vez de
    /// escribir una fila igual a la que había.
    await expect(guardar({ nit: '860.507.033' })).rejects.toThrow(
      /ningún dato/i,
    );
    expect(updates).toHaveLength(0);
  });

  it('corregir SOLO el NIT sí cuenta como un cambio', async () => {
    /// Sin contar el NIT como campo tocado, esto se caía con «no
    /// llegó ningún dato» y no guardaba nada.
    const { guardar, updates } = armar({ nitDeEstaEmpresa: '0' });

    await guardar({ nit: '860507033' });

    expect(updates).toHaveLength(1);
  });
});
