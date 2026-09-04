/** La sede que pidió, y qué pasa cuando no existe. */

import { sedeQueTendra } from './sede-que-tendra';

import type { OfertaCandidata } from './sede-que-le-toca';

function oferta(
  id: string,
  nombre: string,
  tipo: 'CIUDAD' | 'DEPARTAMENTO',
  libres: number,
  departamento: string | null = null,
): OfertaCandidata {
  return {
    id,
    accionFormacionId: 'af',
    cuposMaximos: 100,
    cuposOcupados: 100 - libres,
    ubicacion: { nombre, tipo, departamento },
  };
}

/// AF1: solo por departamento, virtual. Es el caso real.
const SOLO_DEPARTAMENTOS = [
  oferta('o-ant', 'ANTIOQUIA', 'DEPARTAMENTO', 130),
  oferta('o-bog', 'BOGOTÁ D.C', 'DEPARTAMENTO', 65),
];

/// AF7: híbrida. La sede ES la modalidad.
const HIBRIDA = [
  oferta('h-ant', 'ANTIOQUIA', 'DEPARTAMENTO', 117),
  oferta('h-med', 'MEDELLÍN', 'CIUDAD', 78, 'ANTIOQUIA'),
];

const EN_MEDELLIN = { departamento: 'ANTIOQUIA', ciudad: 'MEDELLÍN' };

describe('la sede que pidió, cuando ese curso la tiene', () => {
  it('se respeta aunque otra tenga más cupo', () => {
    /// Es la razón de ser de `sedePedida`: sin esto, quien dice
    /// que va presencial a Medellín se va a la virtual porque
    /// tiene 117 contra 78.
    const r = sedeQueTendra(
      { accionFormacionId: 'af', sedePedida: 'MEDELLÍN' },
      HIBRIDA,
      EN_MEDELLIN,
    );
    expect(r?.id).toBe('h-med');
  });

  it('y la virtual también, si es la que pidió', () => {
    const r = sedeQueTendra(
      { accionFormacionId: 'af', sedePedida: 'ANTIOQUIA' },
      HIBRIDA,
      EN_MEDELLIN,
    );
    expect(r?.id).toBe('h-ant');
  });
});

describe('cuando ese curso NO tiene la sede que pidió', () => {
  it('manda el domicilio, no se queda sin sede', () => {
    /// El caso que rompía: AF1 solo se dicta por DEPARTAMENTO,
    /// así que quien vive en Medellín y escribe «Medellín» pide
    /// algo que no existe. Antioquia lo cubre con 130 libres.
    const r = sedeQueTendra(
      { accionFormacionId: 'af', sedePedida: 'MEDELLÍN' },
      SOLO_DEPARTAMENTOS,
      EN_MEDELLIN,
    );
    expect(r?.id).toBe('o-ant');
  });

  it('y si el domicilio tampoco lo cubre, entonces sí null', () => {
    const r = sedeQueTendra(
      { accionFormacionId: 'af', sedePedida: 'MEDELLÍN' },
      SOLO_DEPARTAMENTOS,
      { departamento: 'SUCRE', ciudad: 'SINCELEJO' },
    );
    expect(r).toBeNull();
  });
});

describe('sin sede pedida, decide el domicilio', () => {
  it('de Medellín, la de Antioquia', () => {
    const r = sedeQueTendra(
      { accionFormacionId: 'af', sedePedida: null },
      SOLO_DEPARTAMENTOS,
      EN_MEDELLIN,
    );
    expect(r?.id).toBe('o-ant');
  });

  it('de Sucre, ninguna', () => {
    const r = sedeQueTendra(
      { accionFormacionId: 'af' },
      SOLO_DEPARTAMENTOS,
      { departamento: 'SUCRE', ciudad: 'SINCELEJO' },
    );
    expect(r).toBeNull();
  });
});

describe('lo que sigue sin decidirse solo', () => {
  it('con DOS sedes que casan no se elige ninguna', () => {
    /// Hoy ninguna acción tiene dos que casen, y por eso este
    /// test importa: sin él, «elegir la primera» pasaría en verde
    /// para siempre y el día que el catálogo cambie se le daría a
    /// alguien una sede que no pidió. Se probó mutándolo.
    ///
    /// El catálogo llama al departamento «BOGOTÁ D.C» y al
    /// municipio «BOGOTÁ», y los dos casan con «Bogotá».
    const dos = [
      oferta('d1', 'BOGOTÁ D.C', 'DEPARTAMENTO', 65),
      oferta('d2', 'BOGOTÁ', 'CIUDAD', 78, 'BOGOTÁ D.C'),
    ];
    const r = sedeQueTendra(
      { accionFormacionId: 'af', sedePedida: 'BOGOTÁ' },
      dos,
      { departamento: 'BOGOTÁ D.C', ciudad: 'BOGOTÁ' },
    );
    expect(r).toBeNull();
  });

  it('y tampoco se cae al domicilio para desempatar', () => {
    /// Caer al domicilio aquí elegiría por cupo libre, que es
    /// exactamente el desempate que `sedePedida` existe para
    /// quitar. Con dos, lo confirma una persona.
    const dos = [
      oferta('d1', 'BOGOTÁ D.C', 'DEPARTAMENTO', 10),
      oferta('d2', 'BOGOTÁ', 'CIUDAD', 90, 'BOGOTÁ D.C'),
    ];
    const r = sedeQueTendra(
      { accionFormacionId: 'af', sedePedida: 'Bogota' },
      dos,
      { departamento: 'BOGOTÁ D.C', ciudad: 'BOGOTÁ' },
    );
    expect(r).toBeNull();
  });

  it('sin curso no hay sede que valga', () => {
    const r = sedeQueTendra(
      { accionFormacionId: null, sedePedida: 'ANTIOQUIA' },
      SOLO_DEPARTAMENTOS,
      EN_MEDELLIN,
    );
    expect(r).toBeNull();
  });

  it('«BOGOTÁ» y «BOGOTÁ D.C» son el mismo sitio', () => {
    /// El catálogo llama al departamento «BOGOTÁ D.C» y la gente
    /// escribe «Bogotá». Sin esto caería al domicilio.
    const r = sedeQueTendra(
      { accionFormacionId: 'af', sedePedida: 'BOGOTÁ' },
      SOLO_DEPARTAMENTOS,
      EN_MEDELLIN,
    );
    expect(r?.id).toBe('o-bog');
  });
});
