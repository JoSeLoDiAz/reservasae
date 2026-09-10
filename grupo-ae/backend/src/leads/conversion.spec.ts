/** Convertir un lead exige una autorización de verdad. */

/**
 * Lo que fija este spec no es código, es una decisión: un lead de
 * un anuncio llenó un formulario de Facebook, no el nuestro, y
 * NO hay constancia de que autorizara nada. Convertirlo solo
 * —crear la Persona y consultarla en el RUI, que es un portal
 * del Estado— sería tratar sus datos sin nada que demostrar.
 *
 * Por eso convertir es una acción del asesor que llamó, y por eso
 * el orden importa: primero la autorización, después el RUI.
 */

import { ConversionDeLeads } from './conversion.service';

const LEAD = {
  id: 'l1',
  convenioId: 'c1',
  estado: 'PENDIENTE',
  participanteId: null as string | null,
  nombreCompleto: 'Ana Lucía Jaramillo Gómez',
  correo: 'ana@ejemplo.test',
  celular: '3001234567',
  tipoDocumentoSepId: 1 as number | null,
  numeroDocumento: '1019456782' as string | null,
  origen: 'FACEBOOK',
  interes: 'IA',
};

type Opciones = {
  lead?: Partial<typeof LEAD> | null;
  hayPolitica?: boolean;
  yaAutorizada?: boolean;
};

function armar(o: Opciones = {}) {
  const hecho: string[] = [];
  const orden: string[] = [];
  const notasReapuntadas: string[] = [];

  const prisma = {
    leadEntrante: {
      findFirst: ({ where }: { where: { convenioId?: { in: string[] } } }) => {
        // el ambito de verdad: fuera de el, no existe
        if (where.convenioId && !where.convenioId.in.includes('c1')) {
          return Promise.resolve(null);
        }
        return Promise.resolve(
          o.lead === null ? null : { ...LEAD, ...(o.lead ?? {}) },
        );
      },
      update: () => {
        hecho.push('lead.update');
        return Promise.resolve({ id: 'l1' });
      },
    },
    /// Las notas del lead que pasan a la ficha.
    ///
    /// APLICA EL FILTRO DE VERDAD: solo re-apunta las que cuelgan
    /// de ESE lead y todavía no tienen ficha. Un doble que
    /// aceptara cualquier `where` probaría el doble, no el
    /// candado -- que es el error que este proyecto ya cometió con
    /// el que decidía por el prefijo del id.
    notaDeGestion: {
      updateMany: ({
        where,
        data,
      }: {
        where: { leadId?: string; participanteId?: string | null };
        data: { participanteId?: string };
      }) => {
        if (where.leadId !== 'l1' || where.participanteId !== null) {
          hecho.push('nota.updateMany.CON_FILTRO_MALO');
          return Promise.resolve({ count: 0 });
        }
        hecho.push('nota.updateMany');
        orden.push('NOTAS');
        notasReapuntadas.push(data.participanteId ?? '');
        return Promise.resolve({ count: 1 });
      },
    },
    politicaDatos: {
      findFirst: () =>
        Promise.resolve(
          o.hayPolitica === false ? null : { id: 'pol1', version: 2 },
        ),
    },
    autorizacionDatos: {
      findFirst: () =>
        Promise.resolve(o.yaAutorizada ? { id: 'a-vieja' } : null),
      create: () => {
        hecho.push('autorizacion.create');
        orden.push('AUTORIZACION');
        return Promise.resolve({ id: 'a1' });
      },
    },
  };

  /// El doble ENCOLA, como el real.
  ///
  /// Antes no lo hacia, y por eso este spec no podia fallar: el
  /// `CrmService` de verdad encola el RUI al final de `crear`, o
  /// sea ANTES de que la conversion deje la constancia. La
  /// asercion de orden pasaba porque el unico 'RUI' que se
  /// apuntaba era el de la llamada explicita de mas abajo.
  ///
  /// Ahora obedece a `encolarRui`, que es lo que la conversion le
  /// pasa: si alguien le quita ese `{ encolarRui: false }`, el
  /// doble apunta 'RUI' antes que 'AUTORIZACION' y el test cae.
  const crm = {
    crear: (
      _dto: unknown,
      _admin: unknown,
      _ambito: unknown,
      _ip: unknown,
      opciones?: { encolarRui?: boolean },
    ) => {
      hecho.push('crm.crear');
      orden.push('FICHA');
      if (opciones?.encolarRui !== false) {
        hecho.push('rui.encolar');
        orden.push('RUI');
      }
      return Promise.resolve({ id: 'p1', personaId: 'per1' });
    },
  };

  const cola = {
    encolarSiHaceFalta: () => {
      hecho.push('rui.encolar');
      orden.push('RUI');
      return Promise.resolve();
    },
  };

  /// El doble de «a quien se parece»: contesta que NADIE revoco.
  /// Es el caso normal, y los specs de revocacion viven aparte.
  const seParece = { revoco: () => Promise.resolve(false) };

  /// Y el del cruce del documento: no es de nadie mas. El cruce
  /// tiene su propio spec, con las tres salidas.
  const deQuienEs = { mirar: () => Promise.resolve({ que: 'LIBRE' }) };

  return {
    s: new ConversionDeLeads(
      prisma as never,
      crm as never,
      cola as never,
      seParece as never,
      deQuienEs as never,
    ),
    hecho,
    orden,
    notasReapuntadas,
  };
}

const ADMIN = { id: 'a1', nombre: 'Ana Jaramillo' };
const DTO = { canal: 'VERBAL_ASESOR', evidencia: 'Llamada del 29 de agosto' };

async function convertir(
  o: Opciones = {},
  dto: Record<string, unknown> = DTO,
  ambito = ['c1'],
) {
  const { s, hecho, orden, notasReapuntadas } = armar(o);
  try {
    const r = await s.convertir('l1', dto as never, ADMIN as never, ambito);
    return { ok: true, mensaje: '', hecho, orden, notasReapuntadas, r };
  } catch (e) {
    return {
      ok: false,
      mensaje: (e as Error).message,
      hecho,
      orden,
      notasReapuntadas,
      r: null,
    };
  }
}

describe('el camino bueno', () => {
  it('crea la ficha, deja la constancia y marca el lead', async () => {
    const r = await convertir();

    expect(r.ok).toBe(true);
    expect(r.hecho).toContain('crm.crear');
    expect(r.hecho).toContain('autorizacion.create');
    expect(r.hecho).toContain('lead.update');
  });

  it('la ficha se crea con `crm.crear`, no con un create propio', async () => {
    /// Una tercera forma de crear una persona sería una tercera
    /// regla, y este repositorio ya sabe cómo acaban.
    const r = await convertir();
    expect(r.hecho.filter((x) => x === 'crm.crear')).toHaveLength(1);
  });
});

describe('el ORDEN: la autorización antes que el RUI', () => {
  it('el RUI se encola DESPUÉS de la constancia, nunca antes', async () => {
    /// El RUI es una consulta a un portal del Estado sobre una
    /// persona. Hacerla antes de que exista la autorización es
    /// consultarla sin permiso, y el orden es toda la
    /// diferencia entre una cosa y la otra.
    const r = await convertir();

    expect(r.orden.indexOf('AUTORIZACION')).toBeLessThan(
      r.orden.indexOf('RUI'),
    );
  });

  it('y la ficha antes que las dos', async () => {
    const r = await convertir();
    /// El orden ENTERO, no solo el par que importa. Fijarlo
    /// completo es lo que hace que un paso nuevo colado en medio
    /// tenga que declararse aquí en vez de aparecer callado.
    ///
    /// `NOTAS` va después de la constancia y antes del RUI: es
    /// re-apuntar a la ficha las llamadas que se hicieron sobre el
    /// lead, y no puede ir antes de que la ficha exista.
    expect(r.orden).toEqual(['FICHA', 'AUTORIZACION', 'NOTAS', 'RUI']);
  });

  it('y las notas del lead pasan a la ficha, sin perder el lead', async () => {
    /// Es el trabajo de conseguir la cédula por teléfono. Si se
    /// perdiera al convertir, la mesa habría servido para nada.
    const r = await convertir();
    expect(r.hecho).toContain('nota.updateMany');
    expect(r.hecho).not.toContain('nota.updateMany.CON_FILTRO_MALO');
    expect(r.notasReapuntadas).toEqual(['p1']);
  });
});

describe('sin autorización no se convierte, y por eso el canal es obligatorio', () => {
  it('sin política publicada NO se convierte, ni se consulta el RUI', async () => {
    /// Esta acción existe PARA dejar la constancia. Sin texto
    /// contra el que dejarla, convertir crearía una ficha que
    /// dice estar autorizada y no puede demostrarlo.
    const r = await convertir({ hayPolitica: false });

    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/política/i);
    expect(r.hecho).toEqual([]);
  });

  it('y el mensaje dice dónde se arregla', async () => {
    const r = await convertir({ hayPolitica: false });
    expect(r.mensaje).toMatch(/Políticas/);
  });
});

describe('el documento es la llave y no se inventa', () => {
  it('sin documento no se crea la ficha', async () => {
    const r = await convertir({
      lead: { numeroDocumento: null, tipoDocumentoSepId: null },
    });

    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/documento/i);
    expect(r.hecho).toEqual([]);
  });

  it('el asesor lo puede aportar en la llamada', async () => {
    /// Casi nunca lo trae un anuncio: lo normal es que el
    /// asesor lo consiga hablando.
    const r = await convertir(
      { lead: { numeroDocumento: null, tipoDocumentoSepId: null } },
      { ...DTO, tipoDocumentoSepId: 1, numeroDocumento: '1019456782' },
    );
    expect(r.ok).toBe(true);
  });

  it('uno con formato malo se rechaza, y no crea nada', async () => {
    const r = await convertir(
      {},
      { ...DTO, tipoDocumentoSepId: 1, numeroDocumento: 'ABCD1234' },
    );
    expect(r.ok).toBe(false);
    expect(r.hecho).toEqual([]);
  });
});

describe('el ámbito y la repetición', () => {
  it('un lead de otro gremio NO existe: 404, no 403', async () => {
    /// Un 403 confirmaría que ese lead existe en el otro gremio,
    /// y eso es un oráculo.
    const r = await convertir({}, DTO, ['otro-gremio']);

    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/no existe/i);
    expect(r.hecho).toEqual([]);
  });

  it('un lead que ya tiene ficha no se convierte dos veces', async () => {
    const r = await convertir({ lead: { participanteId: 'p-vieja' } });

    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/ya tiene ficha/i);
    expect(r.hecho).toEqual([]);
  });
});

describe('si ya tenía autorización viva, no se duplica', () => {
  it('la ficha se crea igual, la constancia dice YA_TENIA', async () => {
    /// Registrar dos veces la misma autorización no la hace más
    /// cierta, y crearía dos filas que habría que revocar por
    /// separado.
    const r = await convertir({ yaAutorizada: true });

    expect(r.ok).toBe(true);
    expect(r.hecho).not.toContain('autorizacion.create');
    expect((r.r as { constancia: string }).constancia).toBe('YA_TENIA');
  });
});
