/** La sede sale de dónde vive, no de un desempate cualquiera. */

/**
 * Es lo que faltaba para que un lead naciera pudiendo
 * matricularse: `Oferta` es acción × ubicación, y con el curso
 * solo se sabe QUÉ quiere.
 *
 * La regla tiene que ser la MISMA que usa la ficha del asesor.
 * Dos formas de elegir sede acaban eligiendo sedes distintas para
 * la misma persona según por dónde entró — que es el patrón que
 * este repositorio lleva documentado desde el principio.
 */

import { sedeQueLeToca, type OfertaCandidata } from './sede-que-le-toca';
import { ubicacionQueDijo } from './ubicacion-que-dijo';

function oferta(
  id: string,
  nombre: string,
  tipo: 'CIUDAD' | 'DEPARTAMENTO',
  libres: number,
  departamento: string | null = null,
): OfertaCandidata {
  return {
    id,
    accionFormacionId: 'af1',
    cuposMaximos: 100,
    cuposOcupados: 100 - libres,
    ubicacion: { nombre, tipo, departamento },
  };
}

describe('la sede la decide dónde vive', () => {
  it('una ciudad cubre a quien vive EN ella', () => {
    const r = sedeQueLeToca(
      [oferta('med', 'MEDELLÍN', 'CIUDAD', 50, 'ANTIOQUIA')],
      'af1',
      { departamento: 'ANTIOQUIA', ciudad: 'MEDELLÍN' },
    );
    expect(r?.id).toBe('med');
  });

  it('pero NO a quien vive en otra ciudad del mismo departamento', () => {
    /// Un grupo presencial en Medellín no le sirve a alguien de
    /// Apartadó aunque los dos sean de Antioquia.
    const r = sedeQueLeToca(
      [oferta('med', 'MEDELLÍN', 'CIUDAD', 50, 'ANTIOQUIA')],
      'af1',
      { departamento: 'ANTIOQUIA', ciudad: 'APARTADÓ' },
    );
    expect(r).toBeNull();
  });

  it('una oferta de departamento cubre a todo el departamento', () => {
    const r = sedeQueLeToca(
      [oferta('ant', 'ANTIOQUIA', 'DEPARTAMENTO', 50)],
      'af1',
      { departamento: 'ANTIOQUIA', ciudad: 'APARTADÓ' },
    );
    expect(r?.id).toBe('ant');
  });

  it('sin cobertura devuelve null, no la primera que haya', () => {
    /// Asignarle una sede donde no puede ir es peor que dejarla
    /// sin sede: la ficha diria que puede matricularse y no.
    const r = sedeQueLeToca(
      [oferta('med', 'MEDELLÍN', 'CIUDAD', 50, 'ANTIOQUIA')],
      'af1',
      { departamento: 'CHOCÓ', ciudad: 'QUIBDÓ' },
    );
    expect(r).toBeNull();
  });
});

describe('con varias que lo cubren, gana la que más cupo libre tiene', () => {
  it('no la primera de la lista', () => {
    /// Es el unico desempate que no perjudica a nadie: mandarla a
    /// la mas llena la deja en lista de espera por un criterio
    /// que ella no eligio.
    const r = sedeQueLeToca(
      [
        oferta('llena', 'ANTIOQUIA', 'DEPARTAMENTO', 2),
        oferta('holgada', 'MEDELLÍN', 'CIUDAD', 40, 'ANTIOQUIA'),
      ],
      'af1',
      { departamento: 'ANTIOQUIA', ciudad: 'MEDELLÍN' },
    );
    expect(r?.id).toBe('holgada');
  });
});

describe('solo las ofertas de SU acción', () => {
  it('una oferta de otro curso no se elige aunque cubra', () => {
    const ajena = { ...oferta('otra', 'MEDELLÍN', 'CIUDAD', 90, 'ANTIOQUIA') };
    ajena.accionFormacionId = 'af9';
    const r = sedeQueLeToca([ajena], 'af1', {
      departamento: 'ANTIOQUIA',
      ciudad: 'MEDELLÍN',
    });
    expect(r).toBeNull();
  });
});

describe('el nombre que escribió se traduce al catálogo del SEP', () => {
  it('reconoce el departamento y la ciudad por su nombre', () => {
    const r = ubicacionQueDijo('Antioquia', 'Medellín');
    expect(r).toEqual({
      departamentoSepId: 5,
      municipioSepId: 5001,
      noReconocido: [],
    });
  });

  it('sin tildes y en mayúsculas es el mismo sitio', () => {
    /// Meta manda lo que la persona escribio o eligio, no un
    /// codigo. «MEDELLIN» tiene que valer.
    const r = ubicacionQueDijo('ANTIOQUIA', 'MEDELLIN');
    expect(r.municipioSepId).toBe(5001);
  });

  it('admite el código DANE para quien lo tenga', () => {
    const r = ubicacionQueDijo(5, 5001);
    expect(r.municipioSepId).toBe(5001);
  });

  it('un nombre repetido se resuelve DENTRO de su departamento', () => {
    /// Hay 66 nombres de municipio repetidos en varios
    /// departamentos. «ARMENIA» es Antioquia (5059) y también
    /// Quindío (63001).
    ///
    /// Sin acotar la búsqueda, `find` devuelve el primero del
    /// país y el candado de abajo lo anula por no cuadrar: la
    /// persona PIERDE un municipio que sí existía en su
    /// departamento. Ese es el fallo, y es silencioso.
    expect(ubicacionQueDijo('QUINDÍO', 'ARMENIA').municipioSepId).toBe(63001);
    expect(ubicacionQueDijo('ANTIOQUIA', 'ARMENIA').municipioSepId).toBe(5059);
  });

  it('un municipio de OTRO departamento no se guarda', () => {
    /// El segundo candado, que es otra cosa: aqui el nombre se
    /// reconoce pero no es de ese departamento. Guardarlo seria
    /// lo que `motivoDeIdInvalido` rechaza en el panel, y la
    /// ficha quedaria imposible de terminar.
    const r = ubicacionQueDijo('ANTIOQUIA', 'BOGOTÁ D.C.');
    expect(r.departamentoSepId).toBe(5);
    expect(r.municipioSepId).toBeNull();
  });

  it('lo que no reconoce lo DICE, y no tumba el lead', () => {
    /// Un webhook que contesta 400 porque no conoce un municipio
    /// invita a reintentar en bucle o a descartar el lead.
    const r = ubicacionQueDijo('ANTIOQUIA', 'Ciudad Inventada');
    expect(r.departamentoSepId).toBe(5);
    expect(r.municipioSepId).toBeNull();
    expect(r.noReconocido).toEqual([expect.stringContaining('Ciudad Inventada')]);
  });

  it('vacío no es un error: es que no lo mandó', () => {
    expect(ubicacionQueDijo(null, undefined).noReconocido).toEqual([]);
    expect(ubicacionQueDijo('', '  ').noReconocido).toEqual([]);
  });
});
