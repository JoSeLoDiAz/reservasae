import {
  resolver,
  valoresDe,
  variablesUsadas,
  VARIABLES,
  type DatosDelParticipante,
} from './variables';

/// Camila es la de verdad: el lead con el que empezó todo, y
/// el nombre que el RUI corrigió.
const CAMILA: DatosDelParticipante = {
  primerNombre: 'CAMILA',
  segundoNombre: 'ALEJANDRA',
  primerApellido: 'CARO',
  segundoApellido: 'GARAVITO',
  generoSepId: 2,
  numeroDocumento: '1017138135',
  correo: 'camila@ejemplo.com',
  celular: '3000000000',
  empresa: 'ABC LABORATORIOS S.A.S',
  accionFormacion: 'AF1 · Gestión de la atención',
  grupo: 3,
  fechaInicio: new Date('2026-09-07T05:00:00.000Z'),
  ubicacion: 'Medellín',
  modalidad: 'Virtual',
  asesor: 'Ana Jaramillo',
  gremio: 'ADECOPRIA',
};

const vacio: DatosDelParticipante = {
  primerNombre: null,
  segundoNombre: null,
  primerApellido: null,
  segundoApellido: null,
  generoSepId: null,
  numeroDocumento: null,
  correo: null,
  celular: null,
  empresa: null,
  accionFormacion: null,
  grupo: null,
  fechaInicio: null,
  ubicacion: null,
  modalidad: null,
  asesor: null,
  gremio: null,
};

const de = (d: DatosDelParticipante) => valoresDe(d);

describe('el saludo, que es lo que se lee primero', () => {
  it('con género femenino trata de Sra. y por el apellido', () => {
    expect(de(CAMILA).saludo).toBe('Estimada Sra. Caro');
    expect(de(CAMILA).tratamiento).toBe('Sra.');
  });

  it('con género masculino, Sr.', () => {
    const d = { ...CAMILA, generoSepId: 1, primerApellido: 'RODRIGUEZ' };
    expect(de(d).saludo).toBe('Estimado Sr. Rodriguez');
  });

  it('sin género NO adivina: saluda por el nombre', () => {
    // llamar «Sr.» a una señora es peor que no poner nada
    const d = { ...CAMILA, generoSepId: null };
    expect(de(d).saludo).toBe('Hola, Camila');
    expect(de(d).tratamiento).toBeNull();
  });

  it('con género no binario tampoco inventa un tratamiento', () => {
    const d = { ...CAMILA, generoSepId: 3 };
    expect(de(d).tratamiento).toBeNull();
    expect(de(d).saludo).toBe('Hola, Camila');
  });

  it('sin nombre no hay saludo, y eso se tiene que notar', () => {
    expect(de(vacio).saludo).toBeNull();
  });
});

describe('los nombres no salen gritando', () => {
  it('la mayúscula sostenida del formulario se arregla', () => {
    // «ESTIMADA SRA. CARO» se lee como un grito
    expect(de(CAMILA).nombreCompleto).toBe('Camila Alejandra Caro Garavito');
    expect(de(CAMILA).primerNombre).toBe('Camila');
  });

  it('el nombre completo se arma con lo que haya', () => {
    const d = { ...CAMILA, segundoNombre: null, segundoApellido: null };
    expect(de(d).nombreCompleto).toBe('Camila Caro');
  });
});

describe('la fecha va en hora de Colombia', () => {
  it('un grupo que arranca el 7 dice el 7', () => {
    // en UTC esa marca ya es del día 7 a las 00:00 de Bogotá;
    // sin el ajuste, los correos de la tarde decían el 6
    expect(de(CAMILA).fechaInicio).toBe('7 de septiembre de 2026');
  });

  it('a las once de la noche de Bogotá sigue diciendo el mismo día', () => {
    const d = { ...CAMILA, fechaInicio: new Date('2026-09-08T04:00:00.000Z') };
    expect(de(d).fechaInicio).toBe('7 de septiembre de 2026');
  });
});

describe('rellenar la plantilla', () => {
  const valores = de(CAMILA);

  it('reemplaza lo que sabe', () => {
    const r = resolver(
      '{{saludo}}, su curso {{accionFormacion}} arranca el {{fechaInicio}}.',
      valores,
    );
    expect(r.texto).toBe(
      'Estimada Sra. Caro, su curso AF1 · Gestión de la atención arranca el ' +
        '7 de septiembre de 2026.',
    );
    expect(r.faltantes).toHaveLength(0);
  });

  it('aguanta espacios dentro de las llaves', () => {
    expect(resolver('Hola {{ primerNombre }}', valores).texto).toBe(
      'Hola Camila',
    );
  });

  it('NO borra lo que no puede llenar, y lo denuncia', () => {
    /// Un correo que dice «Estimado , su curso empieza el» se
    /// manda sin que nadie lo note. Uno que enseña el hueco,
    /// no.
    const r = resolver('{{saludo}}, su grupo es el {{grupo}}.', de(vacio));
    expect(r.texto).toContain('{{saludo}}');
    expect(r.texto).toContain('{{grupo}}');
    expect(r.faltantes.sort()).toEqual(['grupo', 'saludo']);
  });

  it('una variable que no existe se avisa aparte', () => {
    const r = resolver('Hola {{nombreDePila}}', valores);
    expect(r.desconocidas).toEqual(['nombreDePila']);
    expect(r.faltantes).toHaveLength(0);
    expect(r.texto).toContain('{{nombreDePila}}');
  });

  it('una variable vacía cuenta como faltante, no como puesta', () => {
    const r = resolver('Trabaja en {{empresa}}', {
      ...valores,
      empresa: '   ',
    });
    expect(r.faltantes).toEqual(['empresa']);
  });

  it('la misma variable dos veces se reemplaza dos veces', () => {
    const r = resolver('{{primerNombre}}, {{primerNombre}}', valores);
    expect(r.texto).toBe('Camila, Camila');
    expect(r.faltantes).toHaveLength(0);
  });

  it('un texto sin variables sale igual', () => {
    expect(resolver('Buenos días.', valores).texto).toBe('Buenos días.');
  });
});

describe('el catálogo', () => {
  it('todas las variables del catálogo se pueden resolver', () => {
    // si una está en la lista que se le enseña a la gente y
    // no la sabe llenar nadie, es una promesa rota
    const valores = de(CAMILA);
    for (const v of VARIABLES) {
      expect(Object.keys(valores)).toContain(v.clave);
    }
  });

  it('con la ficha llena, ninguna del catálogo falta', () => {
    const usadas = VARIABLES.map((v) => `{{${v.clave}}}`).join(' ');
    expect(resolver(usadas, de(CAMILA)).faltantes).toHaveLength(0);
  });

  it('dice qué variables usa un texto', () => {
    expect(
      variablesUsadas('{{saludo}} y {{grupo}} y {{saludo}}').sort(),
    ).toEqual(['grupo', 'saludo']);
  });
});
