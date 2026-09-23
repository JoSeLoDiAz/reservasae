/** La acción y el grupo de cada fila importada. */

import { elegirOferta, type OfertaParaCarga } from './accion-de-la-fila';

const oferta = (p: Partial<OfertaParaCarga> & { id: string }): OfertaParaCarga => ({
  accionFormacionId: 'af3',
  codigo: 'AF3',
  etiqueta: 'AF3 · GOBERNANZA',
  abierta: true,
  cuposMaximos: 40,
  ocupados: 0,
  ubicacion: { nombre: 'ANTIOQUIA', tipo: 'DEPARTAMENTO', departamento: null },
  ...p,
});

describe('elegirOferta', () => {
  const medellin = oferta({
    id: 'med',
    ubicacion: { nombre: 'MEDELLÍN', tipo: 'CIUDAD', departamento: 'ANTIOQUIA' },
  });
  const antioquia = oferta({ id: 'ant' });
  const valle = oferta({
    id: 'val',
    ubicacion: { nombre: 'VALLE DEL CAUCA', tipo: 'DEPARTAMENTO', departamento: null },
  });

  it('sin acción en la fila no elige nada', () => {
    expect(elegirOferta(null, [medellin], { departamento: 'ANTIOQUIA', ciudad: 'MEDELLÍN' })).toEqual({
      accionFormacionId: null,
      ofertaId: null,
      etiqueta: null,
      grupo: null,
      problemas: [],
    });
  });

  it('un código que no existe en el convenio se dice', () => {
    const r = elegirOferta('AF9', [medellin], { departamento: null, ciudad: null });
    expect(r.accionFormacionId).toBeNull();
    expect(r.problemas[0]).toMatch(/no es una acción de formación de este convenio/);
  });

  it('el grupo de su ciudad gana al departamental', () => {
    const r = elegirOferta('AF3', [antioquia, medellin], {
      departamento: 'ANTIOQUIA',
      ciudad: 'MEDELLÍN',
    });
    expect(r.ofertaId).toBe('med');
    expect(r.grupo).toBe('MEDELLÍN');
    expect(r.etiqueta).toBe('AF3 · GOBERNANZA');
    expect(r.problemas).toEqual([]);
  });

  it('quien vive en otra ciudad del departamento cae en el departamental', () => {
    const r = elegirOferta('AF3', [antioquia, medellin], {
      departamento: 'ANTIOQUIA',
      ciudad: 'APARTADÓ',
    });
    expect(r.ofertaId).toBe('ant');
  });

  it('si ningún grupo llega a donde vive, queda en la acción sin grupo', () => {
    const r = elegirOferta('AF3', [valle], { departamento: 'ANTIOQUIA', ciudad: 'MEDELLÍN' });
    expect(r.accionFormacionId).toBe('af3');
    expect(r.ofertaId).toBeNull();
    expect(r.problemas[0]).toMatch(/ningún grupo de AF3 llega a MEDELLÍN/);
  });

  it('con los grupos cerrados, también', () => {
    const r = elegirOferta('AF3', [oferta({ id: 'x', abierta: false })], {
      departamento: 'ANTIOQUIA',
      ciudad: 'MEDELLÍN',
    });
    expect(r.ofertaId).toBeNull();
    expect(r.problemas[0]).toMatch(/están cerrados/);
  });

  it('entre dos del mismo tipo, el que tiene más sitio', () => {
    const lleno = oferta({ id: 'lleno', ocupados: 38 });
    const holgado = oferta({ id: 'holgado', ocupados: 2 });
    const r = elegirOferta('AF3', [lleno, holgado], { departamento: 'ANTIOQUIA', ciudad: null });
    expect(r.ofertaId).toBe('holgado');
  });

  it('sin saber dónde vive, cualquiera de la acción sirve', () => {
    const r = elegirOferta('AF3', [valle], { departamento: null, ciudad: null });
    expect(r.ofertaId).toBe('val');
    expect(r.problemas).toEqual([]);
  });
});
