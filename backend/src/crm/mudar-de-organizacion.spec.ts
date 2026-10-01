/** Mover una ficha a una organización que ya está registrada. */

/**
 * LA PUERTA QUE FALTABA, y por qué es OTRA puerta.
 *
 * Corregir el NIT de la organización actual ya se podía. Lo que no se
 * podía era el caso que trajo el cliente (29 sep 2026): la ficha
 * cuelga de una empresa con NIT «1-8» —basura— y la buena, la
 * «Secretaría de Educación Departamental del Cauca», YA EXISTE con su
 * NIT. Al corregir, el candado del NIT repetido para —con razón— y
 * manda a usar el enlace de completado de la persona, que es pedirle
 * a ella que rellene un formulario para arreglar un dato mal digitado.
 *
 * Ahí no hay nada que corregir: hay que MUDAR la ficha.
 *
 * Lo que este spec fija es el filo entre las dos puertas:
 *
 *   1. Mudar mueve ESTA ficha y NO renombra a nadie: la empresa mala
 *      se queda como está, con sus otras fichas intactas.
 *   2. Un NIT que NO está registrado se rechaza. Esta puerta no crea
 *      organizaciones; para eso está corregir el NIT.
 *   3. Una ficha que entró por RESERVA no se muda por aquí, porque la
 *      organización la puso la reserva.
 *   4. Queda auditado DE DÓNDE A DÓNDE, con las dos razones sociales
 *      y los dos NIT. Es el cambio que mueve los leads de columna.
 */

import { CrmService } from './crm.service';

type EmpresaFalsa = { id: string; nit: string; razonSocial: string };

const MALA: EmpresaFalsa = {
  id: 'emp-mala',
  nit: '18',
  razonSocial: 'Sec Edu',
};
const BUENA: EmpresaFalsa = {
  id: 'emp-buena',
  nit: '891580016',
  razonSocial: 'Secretaría de Educación Departamental del Cauca',
};

function armar(opts: {
  /// La empresa de la que cuelga la ficha hoy; `null` = ninguna.
  actual?: EmpresaFalsa | null;
  /// Las que existen en la base, además de la actual.
  registradas?: EmpresaFalsa[];
  /// Si la ficha entró por una reserva.
  porReserva?: boolean;
  /// El gremio de la ficha, para probar el guard del ámbito.
  convenioId?: string;
}) {
  const actual = opts.actual === undefined ? MALA : opts.actual;

  const empresas: EmpresaFalsa[] = [
    ...(actual ? [actual] : []),
    ...(opts.registradas ?? []),
  ];

  const escrito: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  const auditadas: Array<Record<string, unknown>> = [];

  const prisma = {
    participante: {
      /// Sirve a las dos consultas: la del guard del ámbito —que solo
      /// pide `convenioId`— y la que resuelve empresa y reserva.
      findUnique: () =>
        Promise.resolve({
          convenioId: opts.convenioId ?? 'c-adecopria',
          empresaId: actual?.id ?? null,
          empresa: actual
            ? { nit: actual.nit, razonSocial: actual.razonSocial }
            : null,
          reserva: opts.porReserva ? { id: 'r-1' } : null,
        }),
      update: (a: { where: unknown; data: Record<string, unknown> }) => {
        escrito.push(a);
        return Promise.resolve({});
      },
    },
    empresa: {
      /// LA UNICIDAD DE VERDAD: un doble que devolviera siempre algo
      /// dejaría pasar la mudanza a un NIT que no existe, que es
      /// justo lo que hay que rechazar.
      findUnique: (a: { where: { nit?: string } }) =>
        Promise.resolve(empresas.find((e) => e.nit === a.where.nit) ?? null),
    },
  };

  const auditoria = {
    registrar: (a: Record<string, unknown>) => {
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

  const mudar = (nit: string, ambito = ['c-adecopria']) =>
    s.mudarDeOrganizacion(
      'p-1',
      nit,
      ambito,
      { id: 'a-1', nombre: 'Ana' },
      '1.2.3.4',
    );

  return { mudar, escrito, auditadas };
}

describe('mudar a una organización que ya existe', () => {
  it('cambia la ficha de empresa', async () => {
    const { mudar, escrito } = armar({ registradas: [BUENA] });

    const r = await mudar('891580016');

    expect(escrito).toHaveLength(1);
    expect(escrito[0].data).toEqual({ empresaId: 'emp-buena' });
    expect(r).toMatchObject({ movida: true, nit: '891580016' });
  });

  /**
   * EL FILO ENTRE LAS DOS PUERTAS. Mudar toca la FICHA. Si esto
   * escribiera también en `empresa`, estaría renombrando la mala y
   * arrastrando a sus otras fichas: el daño que se quiere evitar.
   */
  it('NO renombra ninguna empresa: solo escribe en la ficha', async () => {
    const { mudar, escrito } = armar({ registradas: [BUENA] });

    await mudar('891580016');

    expect(Object.keys(escrito[0].data as object)).toEqual(['empresaId']);
  });

  /// El NIT llega tecleado como lo tiene el papel: con puntos y guion.
  it('acepta el NIT con puntos y guion', async () => {
    const { mudar, escrito } = armar({ registradas: [BUENA] });

    await mudar('891.580.016-8');

    expect(escrito[0].data).toEqual({ empresaId: 'emp-buena' });
  });

  it('una ficha sin empresa se puede asignar', async () => {
    const { mudar, escrito, auditadas } = armar({
      actual: null,
      registradas: [BUENA],
    });

    await mudar('891580016');

    expect(escrito[0].data).toEqual({ empresaId: 'emp-buena' });
    expect(auditadas[0].resumen).toMatch(/^Asignada a/);
  });
});

describe('lo que esta puerta rechaza', () => {
  /**
   * ESTA PUERTA NO CREA ORGANIZACIONES. Si el NIT no está registrado,
   * lo que hay que hacer es corregir el de la actual —la otra
   * puerta—, y el mensaje lo dice para que quien lo lea no se quede
   * probando NIT por NIT.
   */
  it('un NIT que no está registrado se rechaza, y dice qué hacer', async () => {
    const { mudar, escrito } = armar({});

    await expect(mudar('900123456')).rejects.toThrow(/No hay ninguna/i);
    await expect(mudar('900123456')).rejects.toThrow(/corrija el NIT/i);
    expect(escrito).toHaveLength(0);
  });

  it('mudarla a la que ya tiene no es una mudanza', async () => {
    /// Ya está en la buena: se para antes de escribir una fila igual a
    /// la que había y de dejar un rastro que no dice nada.
    const { mudar, escrito } = armar({ actual: BUENA });

    await expect(mudar('891580016')).rejects.toThrow(/ya está en/i);
    expect(escrito).toHaveLength(0);
  });

  /**
   * LA RESERVA MANDA. La organización de una ficha que entró por
   * reserva la puso la reserva, que es quien nominó a esa persona.
   * Mudarla por aquí dejaría la ficha diciendo una organización y su
   * reserva otra, y el F7 sale de las dos.
   */
  it('una ficha que entró por reserva no se muda por aquí', async () => {
    const { mudar, escrito } = armar({
      registradas: [BUENA],
      porReserva: true,
    });

    await expect(mudar('891580016')).rejects.toThrow(/reserva/i);
    expect(escrito).toHaveLength(0);
  });

  /// Lo lee el normalizador de la casa, el mismo que el resto del
  /// sistema: así «891.580.016-8» y «891580016» son el mismo NIT, y lo
  /// que no tiene forma de NIT se para antes de ir a la base.
  it('lo que no tiene forma de NIT se rechaza', async () => {
    const { mudar, escrito } = armar({ registradas: [BUENA] });

    await expect(mudar('---')).rejects.toThrow(/no parece un NIT/i);
    await expect(mudar('12')).rejects.toThrow(/no parece un NIT/i);
    expect(escrito).toHaveLength(0);
  });

  /// EL ÁMBITO, ANTES QUE TODO: una ficha de otro gremio no existe
  /// para quien no tiene ese convenio, y menos se le mueve la empresa.
  it('una ficha de otro gremio no se toca', async () => {
    const { mudar, escrito } = armar({
      registradas: [BUENA],
      convenioId: 'c-britcham',
    });

    await expect(mudar('891580016', ['c-adecopria'])).rejects.toThrow(
      /no existe/i,
    );
    expect(escrito).toHaveLength(0);
  });
});

describe('el rastro de la mudanza', () => {
  /**
   * CON LAS DOS, DE DÓNDE Y ADÓNDE. El día que alguien pregunte por
   * qué esta persona aparece en otra organización, la respuesta tiene
   * que estar escrita, no deducirse de dos filas separadas.
   */
  it('queda escrito de qué organización a cuál, con los dos NIT', async () => {
    const { mudar, auditadas } = armar({ registradas: [BUENA] });

    await mudar('891580016');

    expect(auditadas).toHaveLength(1);
    expect(auditadas[0]).toMatchObject({
      accion: 'ORGANIZACION_CAMBIADA',
      entidadId: 'p-1',
      convenioId: 'c-adecopria',
      camposTocados: ['empresaId'],
    });
    const resumen = auditadas[0].resumen as string;
    expect(resumen).toContain('Sec Edu');
    expect(resumen).toContain('18');
    expect(resumen).toContain('Cauca');
    expect(resumen).toContain('891580016');
  });

  /// Y quién y desde dónde: un rastro sin actor no sirve de nada.
  it('deja quién lo hizo y desde qué IP', async () => {
    const { mudar, auditadas } = armar({ registradas: [BUENA] });

    await mudar('891580016');

    expect(auditadas[0].actor).toEqual({ id: 'a-1', nombre: 'Ana' });
    expect(auditadas[0].ip).toBe('1.2.3.4');
  });
});
