import { cubreA, repartirPorCobertura } from './cobertura';

/// Lo que esto impide: que a alguien de Bogotá le asignen un
/// grupo de Medellín. Cuando pasa no se nota — la ficha queda
/// con grupo, el tablero la cuenta como lista — y aparece el
/// día que la persona no llega al curso.

const enBogota = { departamento: 'BOGOTÁ D.C.', ciudad: 'BOGOTÁ D.C.' };
const enApartado = { departamento: 'ANTIOQUIA', ciudad: 'APARTADÓ' };
const enRionegro = { departamento: 'ANTIOQUIA', ciudad: 'RIONEGRO' };
const enMedellin = { departamento: 'ANTIOQUIA', ciudad: 'MEDELLÍN' };

const ciudad = (nombre: string, departamento: string) => ({
  nombre,
  tipo: 'CIUDAD',
  departamento,
});
const departamento = (nombre: string) => ({
  nombre,
  tipo: 'DEPARTAMENTO',
  departamento: null,
});

describe('un grupo de ciudad', () => {
  it('cubre a quien vive en esa ciudad', () => {
    expect(cubreA(ciudad('MEDELLÍN', 'ANTIOQUIA'), enMedellin)).toBe(true);
  });

  /**
   * EL CASO QUE LO CAMBIÓ TODO. «Los de AF6, que es en Medellín, así
   * la persona sea de Rionegro debe permitir inscribirla» (cliente,
   * 30 sep 2026).
   *
   * Esta prueba decía lo contrario hasta hoy, con el argumento de que
   * un presencial en Medellín no le sirve a alguien de Apartadó. El
   * argumento era nuestro, no suyo: hasta dónde se desplaza la gente
   * a un curso lo sabe quien la convoca.
   */
  it('SÍ cubre a quien vive en otra ciudad del mismo departamento', () => {
    expect(cubreA(ciudad('MEDELLÍN', 'ANTIOQUIA'), enRionegro)).toBe(true);
    expect(cubreA(ciudad('MEDELLÍN', 'ANTIOQUIA'), enApartado)).toBe(true);
  });

  it('NO cubre a quien vive en otro departamento', () => {
    expect(cubreA(ciudad('MEDELLÍN', 'ANTIOQUIA'), enBogota)).toBe(false);
  });
});

describe('un grupo de departamento', () => {
  it('cubre a cualquiera de ese departamento', () => {
    expect(cubreA(departamento('ANTIOQUIA'), enMedellin)).toBe(true);
    expect(cubreA(departamento('ANTIOQUIA'), enApartado)).toBe(true);
  });

  it('no cubre a los de otro', () => {
    expect(cubreA(departamento('ANTIOQUIA'), enBogota)).toBe(false);
  });
});

describe('los nombres nunca vienen igual escritos', () => {
  it('las tildes no separan', () => {
    expect(cubreA(ciudad('MEDELLIN', 'ANTIOQUIA'), enMedellin)).toBe(true);
  });

  it('las mayúsculas tampoco', () => {
    expect(
      cubreA(ciudad('Medellín', 'Antioquia'), {
        departamento: 'ANTIOQUIA',
        ciudad: 'MEDELLÍN',
      }),
    ).toBe(true);
  });

  it('«BOGOTÁ D.C.» y «Bogota DC» son el mismo sitio', () => {
    expect(
      cubreA(departamento('Bogota DC'), {
        departamento: 'BOGOTÁ D.C.',
        ciudad: null,
      }),
    ).toBe(true);
  });
});

describe('cuando falta el domicilio', () => {
  it('sin nada, se ofrecen todos', () => {
    // esconder media oferta por un dato que falta es peor que
    // ofrecerla; que falte el domicilio se avisa por otro lado
    expect(
      cubreA(ciudad('MEDELLÍN', 'ANTIOQUIA'), { departamento: null, ciudad: null }),
    ).toBe(true);
  });

  it('con departamento y sin ciudad, la ciudad del grupo vale por su departamento', () => {
    expect(
      cubreA(ciudad('MEDELLÍN', 'ANTIOQUIA'), {
        departamento: 'ANTIOQUIA',
        ciudad: null,
      }),
    ).toBe(true);
  });

  it('y sigue sin cubrir otro departamento', () => {
    expect(
      cubreA(ciudad('MEDELLÍN', 'ANTIOQUIA'), {
        departamento: 'BOGOTÁ D.C.',
        ciudad: null,
      }),
    ).toBe(false);
  });
});

describe('repartir una lista', () => {
  const grupos = [
    { id: 'a', ubicacion: ciudad('MEDELLÍN', 'ANTIOQUIA') },
    { id: 'b', ubicacion: departamento('ANTIOQUIA') },
    { id: 'c', ubicacion: ciudad('BOGOTÁ D.C.', 'BOGOTÁ D.C.') },
    { id: 'd', ubicacion: departamento('VALLE DEL CAUCA') },
  ];

  it('a alguien de Medellín le quedan los dos de Antioquia', () => {
    const r = repartirPorCobertura(grupos, enMedellin);
    expect(r.cubren.map((g) => g.id)).toEqual(['a', 'b']);
    expect(r.fuera).toBe(2);
  });

  /// Y a alguien de Rionegro, LOS MISMOS DOS. Es el encargo del
  /// cliente dicho sobre la lista y no sobre un predicado suelto:
  /// lo que él mira es la lista de grupos que le sale al asesor.
  it('a alguien de Rionegro le quedan los mismos dos', () => {
    const r = repartirPorCobertura(grupos, enRionegro);
    expect(r.cubren.map((g) => g.id)).toEqual(['a', 'b']);
  });

  it('a alguien de Bogotá le queda solo el suyo', () => {
    const r = repartirPorCobertura(grupos, enBogota);
    expect(r.cubren.map((g) => g.id)).toEqual(['c']);
    expect(r.fuera).toBe(3);
  });

  it('cuenta cuántos quedaron fuera: una lista que se acorta sola parece rota', () => {
    /// De cuatro grupos, a alguien de Antioquia le sirven los dos de
    /// Antioquia; quedan fuera los dos que no lo son.
    expect(repartirPorCobertura(grupos, enApartado).fuera).toBe(2);
  });
});
