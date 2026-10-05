/** El lead que no pasa deja escrito por qué, y una sola vez. */

/**
 * LO QUE SE COMÍA EL BARRIDO.
 *
 * `conEsteLead` ya calculaba el motivo --incluido el `catch` que
 * convierte una excepción de la conversión en una frase-- y
 * `vuelta()` lo tiraba a la basura en el acto:
 *
 *     const r = await this.conEsteLead(lead);
 *     if (r.paso) hechas += 1;
 *
 * Nadie leía `r.porque`. Consecuencias: el lead se reintentaba
 * cada 60 s para siempre, el asesor lo veía PENDIENTE sin una
 * línea que dijera qué pasaba, y avisos que SÍ hay que atender
 * --«este lead se convirtió dos veces a la vez, quedó una ficha
 * suelta: únalas con Unir fichas repetidas»-- no llegaban a
 * ningún sitio.
 *
 * Y no había síntoma: el barrido contestaba «0 pasaron», que es
 * exactamente lo que contesta una mesa sin nada que hacer.
 *
 * La otra mitad del arreglo es no inundar. El barrido pasa cada
 * minuto por los mismos pendientes: escribir el motivo sin mirar
 * el que ya está deja 1.440 UPDATE y 1.440 líneas de log al día
 * por cada lead que espera, y un log que se repite mil veces es
 * tan invisible como no tenerlo, solo que además tapa lo demás.
 */

import { ConversionAutomatica } from './conversion-automatica';

/// Un lead al que le falta el curso: se queda, y por eso sirve
/// para mirar qué se apunta.
function sinCurso(cambios: Record<string, unknown> = {}) {
  return {
    id: 'l1',
    convenioId: 'c1',
    estado: 'PENDIENTE',
    origen: 'FACEBOOK',
    aceptaHabeasData: true,
    participanteId: null,
    tipoDocumentoSepId: 1,
    numeroDocumento: '1005991001',
    nombreCompleto: null,
    primerNombre: 'Marta',
    primerApellido: 'Vargas',
    accionFormacionId: null,
    motivo: null,
    ...cambios,
  };
}

function montar(leads: Array<Record<string, unknown>>, revienta = false) {
  const escritos: Array<{ id: unknown; motivo: unknown }> = [];

  const prisma = {
    leadEntrante: {
      findMany: () => Promise.resolve(leads),
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: { motivo?: unknown };
      }) => {
        escritos.push({ id: where.id, motivo: data.motivo });
        /// Y el lead queda con ese motivo, que es lo que el
        /// barrido leerá en la vuelta siguiente.
        const l = leads.find((x) => x.id === where.id);
        if (l) l.motivo = data.motivo;
        return Promise.resolve({ id: where.id });
      },
    },
    accionFormacion: {
      findUnique: () => Promise.resolve({ id: 'af1', evento: 'CURSO' }),
    },
    persona: { findUnique: () => Promise.resolve(null) },
  };

  const conversion = {
    convertirDeLote: () =>
      revienta
        ? Promise.reject(
            new Error(
              'Este lead se convirtió dos veces a la vez. Quedó suelta: ' +
                'únalas con «Unir fichas repetidas».',
            ),
          )
        : Promise.resolve({ participanteId: 'p1', conAutorizacion: true }),
  };

  return {
    obrero: new ConversionAutomatica(prisma as never, conversion as never),
    escritos,
  };
}

describe('el motivo queda en el lead, donde el asesor lo ve', () => {
  it('un lead que se queda sale de la vuelta con su motivo escrito', async () => {
    const { obrero, escritos } = montar([sinCurso()]);

    expect(await obrero.pasar()).toBe(0);
    expect(escritos).toHaveLength(1);
    expect(String(escritos[0].motivo)).toMatch(/curso/i);
  });

  it('una EXCEPCIÓN de la conversión también se apunta, no se come', async () => {
    /// Es el caso que de verdad desaparecía: el `catch` armaba la
    /// frase y `vuelta()` la descartaba, así que el aviso de la
    /// ficha suelta no llegaba a ningún sitio.
    const listo = sinCurso({ accionFormacionId: 'af1' });
    const { obrero, escritos } = montar([listo], true);

    expect(await obrero.pasar()).toBe(0);
    expect(String(escritos[0].motivo)).toMatch(/Unir fichas repetidas/i);
  });
});

describe('el mismo motivo cada minuto no se escribe mil veces', () => {
  it('la segunda vuelta con el mismo motivo no vuelve a escribir', async () => {
    /// Sin esto son 1.440 UPDATE al día por lead pendiente, y un
    /// log repetido mil veces tapa el que importa.
    const { obrero, escritos } = montar([sinCurso()]);

    await obrero.pasar();
    await obrero.pasar();
    await obrero.pasar();

    expect(escritos).toHaveLength(1);
  });

  it('pero si el motivo CAMBIA, se vuelve a escribir', async () => {
    /// Callar no puede convertirse en no enterarse: cuando el
    /// asesor completa un dato o el fallo pasa a ser otro, el
    /// lead tiene que decir el nuevo.
    const lead = sinCurso({ motivo: 'Falta: el documento.' });
    const { obrero, escritos } = montar([lead]);

    await obrero.pasar();

    expect(escritos).toHaveLength(1);
    expect(String(escritos[0].motivo)).not.toBe('Falta: el documento.');
  });

  it('el que SÍ pasa no se toca: su motivo lo pone la conversión', async () => {
    const { obrero, escritos } = montar([
      sinCurso({ accionFormacionId: 'af1' }),
    ]);

    expect(await obrero.pasar()).toBe(1);
    expect(escritos).toEqual([]);
  });
});

describe('que no se pueda apuntar no tumba la vuelta', () => {
  it('un UPDATE que revienta deja pasar al siguiente lead', async () => {
    /// El lead sigue pendiente y el barrido volverá en un minuto;
    /// perder la vuelta entera por eso sí dejaría a los demás sin
    /// atender.
    const leads = [
      sinCurso({ id: 'a' }),
      sinCurso({ id: 'b', accionFormacionId: 'af1' }),
    ];
    const { obrero } = montar(leads);
    const prisma = (
      obrero as unknown as { prisma: { leadEntrante: { update: unknown } } }
    ).prisma;
    prisma.leadEntrante.update = () => Promise.reject(new Error('base caída'));

    expect(await obrero.pasar()).toBe(1);
  });
});
