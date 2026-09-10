import { recorteDeMeta } from './control';

/// Lo que esto impide: que la pantalla compare un numerador
/// filtrado contra una meta que no lo está.
///
/// Pasó, y no se veía: con un gremio elegido el embudo ponía
/// «Inscritos 19 · meta 3.690 · 1 %» —los 3.690 son de los DOS
/// gremios—, y ese porcentaje es el que se mira para saber si se
/// va a cumplir con el SENA. La cifra estaba bien calculada; lo
/// que estaba mal era contra qué se comparaba.

const texto = (r?: Parameters<typeof recorteDeMeta>[0]) =>
  recorteDeMeta(r).strings.join('?');

describe('la meta se acota por donde se compromete', () => {
  it('sin recorte no acota nada: la meta del ámbito entero', () => {
    expect(texto()).not.toContain('convenioId');
    expect(recorteDeMeta().values).toEqual([]);
  });

  it('por gremio, porque la meta se compromete por proyecto', () => {
    const r = recorteDeMeta({ convenioId: 'cv1' });
    expect(texto({ convenioId: 'cv1' })).toContain('af."convenioId" =');
    expect(r.values).toContain('cv1');
  });

  it('por acción de formación, que es como se reparte', () => {
    const r = recorteDeMeta({ accionFormacionId: 'af9' });
    expect(texto({ accionFormacionId: 'af9' })).toContain('af."id" =');
    expect(r.values).toContain('af9');
  });

  it('los dos a la vez', () => {
    const r = recorteDeMeta({ convenioId: 'cv1', accionFormacionId: 'af9' });
    expect(r.values).toEqual(['cv1', 'af9']);
  });
});

describe('la meta NO se acota por lo que no la reparte', () => {
  /// Una meta no se le asigna a un asesor ni a un departamento.
  /// Colar aquí cualquiera de los dos daría cero —no hay JOIN
  /// que los una a `grupos_cobertura`— y la pantalla diría que
  /// no hay nada comprometido.
  it('ni por asesor', () => {
    const r = recorteDeMeta({ asesorId: 'as1' });
    expect(texto({ asesorId: 'as1' })).not.toContain('asesor');
    expect(r.values).toEqual([]);
  });

  it('ni por departamento', () => {
    const r = recorteDeMeta({ departamentoSepId: 5 });
    expect(texto({ departamentoSepId: 5 })).not.toContain('departamento');
    expect(r.values).toEqual([]);
  });

  it('y con los cuatro puestos, solo entran los dos que valen', () => {
    const r = recorteDeMeta({
      convenioId: 'cv1',
      accionFormacionId: 'af9',
      asesorId: 'as1',
      departamentoSepId: 5,
    });
    expect(r.values).toEqual(['cv1', 'af9']);
  });
});
