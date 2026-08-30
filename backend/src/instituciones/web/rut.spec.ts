import { propuestaDeRut } from './rut';

describe('propuestaDeRut', () => {
  it('reglas fijas: MICROEMPRESA + EMPRESA_PRIVADA', () => {
    const p = propuestaDeRut({ nombre: 'Juan Pérez' });
    expect(p.tamano).toBe('MICROEMPRESA');
    expect(p.clasificacion).toBe('EMPRESA_PRIVADA');
    expect(p.razonSocial).toBe('JUAN PÉREZ');
  });

  it('empleados = # de registros (mín. 1)', () => {
    expect(propuestaDeRut({ nombre: 'X' }).numeroEmpleados).toBe(1);
    expect(propuestaDeRut({ nombre: 'X', registros: 3 }).numeroEmpleados).toBe(3);
    expect(propuestaDeRut({ nombre: 'X', registros: 0 }).numeroEmpleados).toBe(1);
  });

  it('sector -> CIIU calculado + departamento derivado', () => {
    const p = propuestaDeRut({ nombre: 'Juan', ciudadNombre: 'Cali', sectorEconomico: 'Comercio' });
    expect(p.codigoCiiu).toBe('4719');
    expect(p.sectorEconomico).toBe('COMERCIO');
    expect(p.departamentoNombre).toBe('Valle del Cauca');
  });

  it('no incluye campos vacíos', () => {
    const p = propuestaDeRut({ nombre: 'Juan' });
    expect('correo' in p).toBe(false);
    expect('codigoCiiu' in p).toBe(false);
    expect('departamentoNombre' in p).toBe(false);
  });

  it('correo se normaliza a minúsculas', () => {
    expect(propuestaDeRut({ nombre: 'X', correo: 'Juan@Correo.COM' }).correo).toBe('juan@correo.com');
  });
});
