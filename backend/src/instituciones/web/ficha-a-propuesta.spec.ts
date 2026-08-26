import {
  fichaAPropuesta,
  leerCiiu,
  leerEmpleados,
  leerFecha,
} from './ficha-a-propuesta';
import { leerFichaWeb, type FichaWeb } from './leer-ficha-web';

/// Se parte de las respuestas de verdad, las mismas del otro
/// archivo de pruebas, para que lo que se compruebe sea el
/// camino entero: texto del buscador → campos de la ficha.

const ABC = leerFichaWeb(
  'Razón social: ABC LABORATORIOS S.A.S.Nombre comercial: ABC Laboratorios' +
    'Dirección: Calle 24 # 27A-56Ciudad: Bogotá D.C.Departamento: Cundinamarca' +
    'Teléfono: (601) 518-6600Correo: ventas@abclaboratorios.comPágina web: ' +
    'abclaboratorios.comSector económico: Otra fabricación diversa / Industrias ' +
    'manufacturerasCódigo CIIU: 3290 (Otras industrias manufactureras n.c.p.)' +
    'Clasificación: Fabricación y provisión de equipamiento científico, didáctico ' +
    'y reactivos de laboratorioFecha de fundación: 17 de enero de 1972Tamaño: ' +
    'Pequeña empresaNúmero de empleados: Entre 11 y 50 colaboradores',
);

const COMFENALCO = leerFichaWeb(
  'Razón social: Caja de Compensación Familiar Comfenalco Antioquia' +
    'Nombre comercial: Comfenalco AntioquiaFecha de fundación: 30 de agosto de 1957' +
    'Dirección: Carrera 50 # 53 - 43 (Sede Palacé, Medellín)Teléfono: (604) 444 71 10' +
    'Correo: emailinstitucional@comfenalcoantioquia.comPágina web: ' +
    'www.comfenalcoantioquia.com.coCiudad: MedellínDepartamento: Antioquia' +
    'Sector económico: Seguridad social y subsidio familiarCódigo CIIU: 8430 ' +
    '(Actividades de planes de seguridad social)Clasificación: Persona jurídica - ' +
    'Entidad sin ánimo de lucro (ESAL)Tamaño: Grande empresaNúmero de empleados: ' +
    'Más de 2.000 empleados directos',
);

describe('ABC Laboratorios', () => {
  const p = fichaAPropuesta(ABC);

  it('la razón social va en mayúscula', () => {
    expect(p.razonSocial).toBe('ABC LABORATORIOS S.A.S');
    expect(p.nombreComercial).toBe('ABC LABORATORIOS');
    expect(p.sectorEconomico).toBe(
      'OTRA FABRICACIÓN DIVERSA / INDUSTRIAS MANUFACTURERAS',
    );
  });

  it('el CIIU queda en código, sin la explicación', () => {
    expect(p.codigoCiiu).toBe('3290');
  });

  it('traduce el tamaño al enum', () => {
    expect(p.tamano).toBe('PEQUENA');
  });

  it('la fecha queda sin hora, para que nadie le cambie el día', () => {
    expect(p.fechaFundacion).toBe('1972-01-17');
  });

  it('NO propone empleados: «Entre 11 y 50» es un rango', () => {
    expect(p.numeroEmpleados).toBeUndefined();
  });

  it('NO propone clasificación: el buscador contestó otra cosa', () => {
    // «Fabricación y provisión de equipamiento científico…»
    // no es ninguna de las diez clasificaciones del SENA
    expect(p.clasificacion).toBeUndefined();
  });
});

describe('Comfenalco Antioquia', () => {
  const p = fichaAPropuesta(COMFENALCO);

  it('saca la clasificación de la frase larga', () => {
    // «Persona jurídica - Entidad sin ánimo de lucro (ESAL)»
    expect(p.clasificacion).toBe('ENTIDAD_SIN_ANIMO_DE_LUCRO');
  });

  it('traduce el tamaño y la fecha', () => {
    expect(p.tamano).toBe('GRANDE');
    expect(p.fechaFundacion).toBe('1957-08-30');
  });

  it('NO propone empleados: «Más de 2.000» tampoco es un número', () => {
    expect(p.numeroEmpleados).toBeUndefined();
  });

  it('la ciudad no se lleva el paréntesis', () => {
    expect(p.ciudadNombre).toBe('Medellín');
    expect(p.direccion).toBe('Carrera 50 # 53 - 43 (Sede Palacé, Medellín)');
  });

  it('la página web queda sin protocolo y en minúscula', () => {
    expect(p.paginaWeb).toBe('www.comfenalcoantioquia.com.co');
    expect(p.correo).toBe('emailinstitucional@comfenalcoantioquia.com');
  });
});

describe('no se propone lo que ya está', () => {
  it('un valor igual no entra, aunque cambien tildes o mayúsculas', () => {
    const p = fichaAPropuesta(COMFENALCO, {
      ciudadNombre: 'MEDELLIN',
      departamentoNombre: 'Antioquia',
      tamano: 'GRANDE',
    });
    expect(p.ciudadNombre).toBeUndefined();
    expect(p.departamentoNombre).toBeUndefined();
    expect(p.tamano).toBeUndefined();
    // lo demás sí sigue proponiéndose
    expect(p.clasificacion).toBe('ENTIDAD_SIN_ANIMO_DE_LUCRO');
  });

  it('una fecha ya guardada no se vuelve a proponer', () => {
    const p = fichaAPropuesta(COMFENALCO, {
      fechaFundacion: new Date('1957-08-30T00:00:00.000Z'),
    });
    expect(p.fechaFundacion).toBeUndefined();
  });

  it('un valor distinto sí entra, para que alguien decida', () => {
    const p = fichaAPropuesta(COMFENALCO, { ciudadNombre: 'Bogotá' });
    expect(p.ciudadNombre).toBe('Medellín');
  });

  it('una ficha vacía no propone nada', () => {
    expect(Object.keys(fichaAPropuesta(leerFichaWeb('')))).toHaveLength(0);
  });
});

describe('el número de empleados', () => {
  const casos: Array<[string, number | null]> = [
    ['150', 150],
    ['1.250 empleados', 1250],
    ['87 colaboradores directos', 87],
    ['Entre 11 y 50 colaboradores', null],
    ['Más de 2.000 empleados directos', null],
    ['Menos de 10', null],
    ['Aproximadamente 300', null],
    ['Cerca de 500 personas', null],
    ['11-50', null],
    ['200+', null],
    ['No disponible', null],
  ];

  it.each(casos)('«%s» → %s', (texto, esperado) => {
    expect(leerEmpleados(texto)).toBe(esperado);
  });
});

describe('la fecha de fundación', () => {
  const casos: Array<[string, string | null]> = [
    ['17 de enero de 1972', '1972-01-17'],
    ['30 de agosto de 1957', '1957-08-30'],
    ['1 de diciembre de 2003', '2003-12-01'],
    ['1972-01-17', '1972-01-17'],
    ['17/01/1972', '1972-01-17'],
    ['enero de 1972', null],
    ['1972', null],
    ['32 de enero de 1972', null],
    ['17 de brumario de 1972', null],
  ];

  it.each(casos)('«%s» → %s', (texto, esperado) => {
    expect(leerFecha(texto)).toBe(esperado);
  });
});

describe('el código CIIU', () => {
  it('saca los cuatro dígitos', () => {
    expect(leerCiiu('3290 (Otras industrias manufactureras n.c.p.)')).toBe(
      '3290',
    );
    expect(leerCiiu('G4711')).toBe('4711');
    expect(leerCiiu('CIIU 8430')).toBe('8430');
  });

  it('sin código no inventa', () => {
    expect(leerCiiu('Industrias manufactureras')).toBeNull();
    expect(leerCiiu(null)).toBeNull();
  });
});

describe('las clasificaciones y los tamaños', () => {
  const clasificar = (v: string) =>
    fichaAPropuesta({ clasificacion: v } as FichaWeb).clasificacion;

  const dimensionar = (v: string) =>
    fichaAPropuesta({ tamano: v } as FichaWeb).tamano;

  it('mapea las frases que devuelve el buscador', () => {
    expect(clasificar('Entidad sin ánimo de lucro')).toBe(
      'ENTIDAD_SIN_ANIMO_DE_LUCRO',
    );
    expect(clasificar('Empresa privada')).toBe('EMPRESA_PRIVADA');
    expect(clasificar('Sociedad de economía mixta')).toBe('MIXTA');
    expect(clasificar('Gremio empresarial')).toBe('GREMIO');
    expect(clasificar('Entidad de economía solidaria')).toBe(
      'ENTIDAD_ECONOMIA_SOLIDARIA',
    );
  });

  it('«entidad privada sin ánimo de lucro» no es empresa privada', () => {
    // lleva las dos palabras: gana la clasificación específica
    expect(clasificar('Entidad Privada Sin Ánimo de Lucro')).toBe(
      'ENTIDAD_SIN_ANIMO_DE_LUCRO',
    );
  });

  it('lo que no reconoce se deja vacío', () => {
    expect(clasificar('Laboratorio farmacéutico')).toBeUndefined();
    expect(dimensionar('Empresa consolidada')).toBeUndefined();
  });

  it('mapea los tamaños', () => {
    expect(dimensionar('Microempresa')).toBe('MICROEMPRESA');
    expect(dimensionar('Pequeña empresa')).toBe('PEQUENA');
    expect(dimensionar('Mediana empresa')).toBe('MEDIANA');
    expect(dimensionar('Gran empresa')).toBe('GRANDE');
  });
});
