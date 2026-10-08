/** A quién ya tenemos: por documento, por correo o por celular. */

/**
 * Cruzar SOLO por documento era la primera idea y es la
 * equivocada, y el motivo es el caso que motivó el encargo: el
 * lead que no tiene documento. Entró por una pauta con el celular
 * y nada más ---por eso está en la mesa y no es una ficha--- y la
 * base del cliente le tiene la cédula. Buscándolo por documento no
 * aparece, se crea un segundo lead de la misma persona, y entonces
 * dos asesoras la llaman: justo lo que la mesa de entrada existe
 * para no tener.
 *
 * Y el orden no es decorativo. El documento manda porque es la
 * identidad en todo el sistema; el correo y el celular reconocen
 * pero no identifican ---una familia comparte buzón y una empresa
 * pone el teléfono de la secretaria en veinte formularios---, así
 * que van después.
 */

import { aQuienYaTeniamos } from './a-quien-ya-tenemos';
import type { DatosDeLaFila } from './datos-de-la-fila';
import { leadGuardado } from './arnes-del-cargue';

function trae(parcial: Partial<DatosDeLaFila>): DatosDeLaFila {
  return {
    nombreCompleto: null,
    primerNombre: null,
    segundoNombre: null,
    primerApellido: null,
    segundoApellido: null,
    correo: null,
    celular: null,
    tipoDocumentoSepId: null,
    numeroDocumento: null,
    interes: null,
    accionFormacionId: null,
    departamentoSepId: null,
    municipioSepId: null,
    generoSepId: null,
    ...parcial,
  };
}

describe('el cruce encuentra a la persona por lo que tenga', () => {
  it('por el celular, cuando el lead guardado no tiene documento', () => {
    const ya = leadGuardado({ id: 'de-la-pauta', celular: '3001112222' });

    const r = aQuienYaTeniamos(
      trae({
        celular: '3001112222',
        tipoDocumentoSepId: 1,
        numeroDocumento: '1020304050',
      }),
      ['llave-nueva'],
      [ya],
    );

    expect(r?.lead.id).toBe('de-la-pauta');
    expect(r?.porque).toBe('CELULAR');
  });

  it('por el correo', () => {
    const ya = leadGuardado({ id: 'por-correo', correo: 'ana@correo.com' });

    expect(
      aQuienYaTeniamos(trae({ correo: 'ana@correo.com' }), [], [ya])?.porque,
    ).toBe('CORREO');
  });

  it('por el documento, y eso MANDA sobre el correo', () => {
    /// Dos leads: uno con la cédula de esta fila y otro con su
    /// correo. El que vale es el de la cédula: el correo puede ser
    /// el de la empresa, y pegar la fila al lead equivocado mezcla
    /// dos personas.
    const porCorreo = leadGuardado({
      id: 'el-del-correo',
      correo: 'ana@correo.com',
    });
    const porDocumento = leadGuardado({
      id: 'el-de-la-cedula',
      tipoDocumentoSepId: 1,
      numeroDocumento: '1020304050',
    });

    const r = aQuienYaTeniamos(
      trae({
        correo: 'ana@correo.com',
        tipoDocumentoSepId: 1,
        numeroDocumento: '1020304050',
      }),
      [],
      /// El del correo primero en la lista, para que ganar no
      /// dependa del orden en que los devuelva la base.
      [porCorreo, porDocumento],
    );

    expect(r?.lead.id).toBe('el-de-la-cedula');
    expect(r?.porque).toBe('DOCUMENTO');
  });

  it('el mismo número con el tipo guardado en blanco SÍ cruza', () => {
    /// Es el caso normal de un lead de la pauta: trae el número y
    /// no el tipo. Exigir que coincida un tipo que no está haría
    /// que no se encontrara nunca y se creara un segundo lead de la
    /// misma cédula ---el cargue habría empeorado lo que viene a
    /// arreglar---.
    const ya = leadGuardado({
      id: 'sin-tipo',
      tipoDocumentoSepId: null,
      numeroDocumento: '1020304050',
    });

    expect(
      aQuienYaTeniamos(
        trae({ tipoDocumentoSepId: 1, numeroDocumento: '1020304050' }),
        [],
        [ya],
      )?.porque,
    ).toBe('DOCUMENTO');
  });

  it('el mismo número con DOS tipos distintos no cruza', () => {
    /// La misma numeración en una cédula y en un pasaporte son dos
    /// personas, y unirlas mezcla dos identidades en una ficha.
    const ya = leadGuardado({
      id: 'pasaporte',
      tipoDocumentoSepId: 61,
      numeroDocumento: '1020304050',
    });

    expect(
      aQuienYaTeniamos(
        trae({ tipoDocumentoSepId: 1, numeroDocumento: '1020304050' }),
        [],
        [ya],
      ),
    ).toBeNull();
  });

  it('la llave exacta gana al correo', () => {
    /// La llave lleva el gremio Y el curso. Sin esto, recargar el
    /// archivo después de un cargue a medias podría casar por
    /// correo con otro lead de la misma persona para OTRO curso y
    /// rellenarle huecos del curso equivocado.
    const otroCurso = leadGuardado({
      id: 'su-lead-de-af2',
      correo: 'ana@correo.com',
      externoId: 'doc:conv:1-1020304050:AF2',
    });
    const esteCurso = leadGuardado({
      id: 'su-lead-de-af1',
      externoId: 'doc:conv:1-1020304050:AF1',
    });

    const r = aQuienYaTeniamos(
      trae({ correo: 'ana@correo.com' }),
      ['doc:conv:1-1020304050:AF1'],
      [otroCurso, esteCurso],
    );

    expect(r?.lead.id).toBe('su-lead-de-af1');
    expect(r?.porque).toBe('LLAVE');
  });

  it('a quien no está, no se le inventa un parecido', () => {
    /// Sin esto, «no la encuentro» se resolvería con el primero que
    /// se parezca, y la fila de una persona nueva iría a parar a la
    /// mesa de otra.
    const ya = leadGuardado({ id: 'otra', correo: 'luis@correo.com' });

    expect(
      aQuienYaTeniamos(trae({ correo: 'ana@correo.com' }), ['x'], [ya]),
    ).toBeNull();
  });
});
