import { aFichaWeb, consolidarFichas } from './consenso';
import { fichaAPropuesta } from './ficha-a-propuesta';
import type { FichaWeb } from './leer-ficha-web';

const vacia = (): FichaWeb => ({
  razonSocial: null, nombreComercial: null, fechaFundacion: null, direccion: null,
  telefono: null, correo: null, paginaWeb: null, ciudadNombre: null,
  departamentoNombre: null, sectorEconomico: null, codigoCiiu: null,
  clasificacion: null, tamano: null, numeroEmpleados: null,
});
const f = (extra: Partial<FichaWeb>): FichaWeb => ({ ...vacia(), ...extra });

describe('consolidarFichas', () => {
  it('3/3 iguales -> ALTA', () => {
    const base = f({ razonSocial: 'VISE', ciudadNombre: 'Bogotá' });
    const c = consolidarFichas([base, base, base]);
    expect(c.razonSocial.nivel).toBe('ALTA');
    expect(c.razonSocial.valor).toBe('VISE');
  });

  it('2/3 -> MEDIA', () => {
    const c = consolidarFichas([
      f({ razonSocial: 'VISE' }), f({ razonSocial: 'VISE' }), f({ razonSocial: 'OTRA' }),
    ]);
    expect(c.razonSocial.nivel).toBe('MEDIA');
    expect(c.razonSocial.valor).toBe('VISE');
  });

  it('todas distintas -> REVISAR', () => {
    const c = consolidarFichas([
      f({ correo: 'a@x.com' }), f({ correo: 'b@x.com' }), f({ correo: 'c@x.com' }),
    ]);
    expect(c.correo.nivel).toBe('REVISAR');
  });

  it('sin dato -> REVISAR', () => {
    const c = consolidarFichas([f({ razonSocial: 'X' })]);
    expect(c.numeroEmpleados.nivel).toBe('REVISAR');
    expect(c.numeroEmpleados.valor).toBeNull();
  });

  it('www y no-www cuentan igual (mismo voto)', () => {
    const c = consolidarFichas([
      f({ razonSocial: 'X', paginaWeb: 'https://www.vise.com.co/' }),
      f({ razonSocial: 'X', paginaWeb: 'vise.com.co' }),
      f({ razonSocial: 'X', paginaWeb: 'https://www.vise.com.co/' }),
    ]);
    expect(c.paginaWeb.nivel).toBe('ALTA');
  });

  it('departamento se deriva de la ciudad consolidada', () => {
    const base = f({ razonSocial: 'X', ciudadNombre: 'Medellín', departamentoNombre: 'Bogotá / Cundinamarca' });
    const c = consolidarFichas([base, base, base]);
    expect(c.departamentoNombre.valor).toBe('Antioquia');
    expect(c.departamentoNombre.nivel).toBe('ALTA');
  });

  it('aFichaWeb + fichaAPropuesta encadenan bien', () => {
    const base = f({ razonSocial: 'VISE LTDA', ciudadNombre: 'Bogotá', tamano: 'Grande' });
    const cons = consolidarFichas([base, base, base]);
    const prop = fichaAPropuesta(aFichaWeb(cons));
    expect(prop.razonSocial).toBe('VISE LTDA');
    expect(prop.tamano).toBe('GRANDE');
    expect(prop.departamentoNombre).toBe('Bogotá D.C.');
  });
});
