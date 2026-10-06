/** Las reglas de la fusión, sin base de datos. */

import {
  CAMPOS_FUSIONABLES,
  comoQuedaLaFusion,
  porQueNoSePuedenUnir,
  type FichaParaFusionar,
} from './fusionar-participaciones';

const ficha = (
  id: string,
  x: Partial<FichaParaFusionar> = {},
): FichaParaFusionar => ({
  id,
  etapa: 'INTERESADO' as never,
  asesorId: null,
  empresaId: null,
  cargoEnEmpresa: null,
  nivelEducativo: null,
  nivelOcupacional: null,
  nivelOcupacionalSepId: null,
  beneficiarioPrevio: null,
  origenLead: null,
  campanaDeEntrada: null,
  ...x,
});

describe('qué queda tras unir dos fichas', () => {
  it('trae de la otra solo lo que se pidió', () => {
    const queda = comoQuedaLaFusion(
      ficha('af2', { asesorId: 'julieth', etapa: 'CONTACTADO' as never }),
      ficha('af6', { asesorId: 'katherine', etapa: 'INTERESADO' as never }),
      { asesorId: 'af6' },
    );
    expect(queda).toEqual({ asesorId: 'katherine' });
  });

  it('lo que no se nombra se queda como estaba', () => {
    /// Elegir campo por campo es una ayuda, no la obligación de
    /// rellenar diez casillas para unir dos fichas.
    const queda = comoQuedaLaFusion(
      ficha('af2', { asesorId: 'julieth' }),
      ficha('af6', { asesorId: 'katherine' }),
      {},
    );
    expect(queda).toEqual({});
  });

  it('pedir el valor de la que sobrevive no cambia nada', () => {
    const queda = comoQuedaLaFusion(
      ficha('af2', { asesorId: 'julieth' }),
      ficha('af6', { asesorId: 'katherine' }),
      { asesorId: 'af2' },
    );
    expect(queda).toEqual({});
  });

  /**
   * LO QUE MÁS IMPORTA DE ESTE SPEC.
   *
   * Si se pide traer un campo y la otra ficha lo tiene vacío, se deja
   * el que ya había. Fusionar no puede PERDER datos: una casilla mal
   * pulsada no puede dejar sin asesor a alguien que lo tenía.
   */
  it('no escribe un vacío encima de un dato', () => {
    const queda = comoQuedaLaFusion(
      ficha('af2', { asesorId: 'julieth', cargoEnEmpresa: 'Rectora' }),
      ficha('af6', { asesorId: null, cargoEnEmpresa: null }),
      { asesorId: 'af6', cargoEnEmpresa: 'af6' },
    );
    expect(queda).toEqual({});
  });

  it('un false SÍ se escribe: es un dato, no un vacío', () => {
    /// `beneficiarioPrevio: false` quiere decir «se le preguntó y dijo
    /// que no». Tratarlo como vacío perdería la respuesta.
    const queda = comoQuedaLaFusion(
      ficha('af2', { beneficiarioPrevio: true }),
      ficha('af6', { beneficiarioPrevio: false }),
      { beneficiarioPrevio: 'af6' },
    );
    expect(queda).toEqual({ beneficiarioPrevio: false });
  });

  it('se pueden traer varios campos de la misma pasada', () => {
    const queda = comoQuedaLaFusion(
      ficha('af2'),
      ficha('af6', {
        asesorId: 'katherine',
        empresaId: 'empresa-1',
        nivelEducativo: 'PROFESIONAL',
      }),
      { asesorId: 'af6', empresaId: 'af6', nivelEducativo: 'af6' },
    );
    expect(queda).toEqual({
      asesorId: 'katherine',
      empresaId: 'empresa-1',
      nivelEducativo: 'PROFESIONAL',
    });
  });

  it('una ficha que no es ninguna de las dos se ignora', () => {
    /// Llega del cuerpo de una petición: no se confía en que venga
    /// bien.
    const queda = comoQuedaLaFusion(
      ficha('af2'),
      ficha('af6', { asesorId: 'katherine' }),
      { asesorId: 'af9' },
    );
    expect(queda).toEqual({});
  });

  it('la acción de formación NO es fusionable', () => {
    /// Elegir la acción es elegir CUÁL ficha sobrevive, que es la otra
    /// decisión. Si además se pudiera traer la acción de la otra, las
    /// dos decisiones se contradirían.
    expect(CAMPOS_FUSIONABLES).not.toContain('accionFormacionId');
    expect(CAMPOS_FUSIONABLES).not.toContain('ofertaId');
  });
});

describe('qué parejas no se pueden unir', () => {
  const a = { id: 'af2', personaId: 'p1', convenioId: 'adecopria' };

  it('la misma ficha consigo misma', () => {
    expect(porQueNoSePuedenUnir(a, a)).toMatch(/misma ficha/i);
  });

  it('dos personas distintas', () => {
    expect(
      porQueNoSePuedenUnir(a, {
        id: 'af6',
        personaId: 'p2',
        convenioId: 'adecopria',
      }),
    ).toMatch(/dos personas distintas/i);
  });

  it('dos gremios distintos', () => {
    /// El gremio es lo que se le reporta al SENA: moverlo de callada
    /// dentro de una fusión cambia a quién se le factura la formación.
    expect(
      porQueNoSePuedenUnir(a, {
        id: 'af6',
        personaId: 'p1',
        convenioId: 'britcham',
      }),
    ).toMatch(/gremios distintos/i);
  });

  it('la misma persona en el mismo gremio, sí', () => {
    expect(
      porQueNoSePuedenUnir(a, {
        id: 'af6',
        personaId: 'p1',
        convenioId: 'adecopria',
      }),
    ).toBeNull();
  });
});
