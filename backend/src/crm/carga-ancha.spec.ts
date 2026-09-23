/** La plantilla ancha: 19 columnas, reconocidas por su título. */

import { analizar } from './carga';
import {
  codigoDeAccion,
  columnasDelEncabezado,
  leerDondeVive,
  leerFechaDeNacimiento,
  leerGenero,
  leerSiNo,
} from './columnas-de-carga';

const TITULOS = [
  'Acción de formación de interés',
  'Departamento',
  'Ciudad o municipio',
  'Tipo de documento',
  'Número de documento',
  'Primer nombre',
  'Segundo nombre',
  'Primer apellido',
  'Segundo apellido',
  'Fecha de nacimiento',
  'Género',
  'Correo electrónico',
  'Teléfono celular',
  'Barrio o vereda',
  'Dirección',
  'Estrato socioeconómico',
  'Cargo en la organización',
  'Nivel ocupacional',
  '¿Se ha beneficiado antes?',
];

const UNA = [
  'AF3 · GOBERNANZA ESTRATÉGICA DE LA DIVERSIDAD',
  'ANTIOQUIA',
  'MEDELLÍN',
  'Cédula de Ciudadanía',
  '1019456782',
  'Laura',
  'Camila',
  'Gómez',
  'Rojas',
  '15/03/1990',
  'FEMENINO',
  'laura@empresa.com',
  '3001234567',
  'El Poblado',
  'Calle 45 # 12-30',
  '3',
  'Coordinadora de talento',
  'MEDIO',
  'No',
];

const hoja = (...filas: string[][]) => filas.map((f) => f.join('\t')).join('\n');

describe('la plantilla ancha entra entera', () => {
  const [f] = analizar(hoja(TITULOS, UNA));

  it('no deja ningún problema', () => {
    expect(f.problemas).toEqual([]);
  });

  it('trae los datos de la persona', () => {
    expect(f).toMatchObject({
      tipoDocumentoSepId: 1,
      numeroDocumento: '1019456782',
      primerNombre: 'Laura',
      segundoNombre: 'Camila',
      primerApellido: 'Gómez',
      segundoApellido: 'Rojas',
      correo: 'laura@empresa.com',
      celular: '3001234567',
      fechaNacimiento: '1990-03-15',
      generoSepId: 2,
      barrio: 'El Poblado',
      direccion: 'Calle 45 # 12-30',
      estrato: 3,
      cargoEnEmpresa: 'Coordinadora de talento',
      beneficiarioPrevio: false,
    });
  });

  it('resuelve dónde vive y qué quiere estudiar', () => {
    expect(f.departamentoSepId).toBe(5);
    expect(f.municipioSepId).toBe(5001);
    expect(f.nivelOcupacionalSepId).toBe(2);
    expect(f.accionCodigo).toBe('AF3');
  });

  it('el orden de las columnas da igual', () => {
    const alReves = [...TITULOS].reverse();
    const datosAlReves = [...UNA].reverse();
    const [g] = analizar(hoja(alReves, datosAlReves));
    expect(g.problemas).toEqual([]);
    expect(g.numeroDocumento).toBe('1019456782');
    expect(g.municipioSepId).toBe(5001);
    expect(g.accionCodigo).toBe('AF3');
  });

  it('lo que se pega sin encabezado sigue leyéndose como antes', () => {
    const [g] = analizar('CC\t1019456782\tLaura\t\tGómez\t\tl@e.com\t3001234567');
    expect(g.numeroDocumento).toBe('1019456782');
    expect(g.correo).toBe('l@e.com');
    expect(g.fechaNacimiento).toBeNull();
    expect(g.accionCodigo).toBeNull();
    expect(g.problemas).toEqual([]);
  });
});

describe('lo que la plantilla no puede dejar pasar', () => {
  const conCambio = (columna: string, valor: string) => {
    const i = TITULOS.indexOf(columna);
    const datos = [...UNA];
    datos[i] = valor;
    return analizar(hoja(TITULOS, datos))[0];
  };

  it('un menor de edad', () => {
    const f = conCambio('Fecha de nacimiento', '15/03/2015');
    expect(f.fechaNacimiento).toBeNull();
    expect(f.problemas[0]).toMatch(/no llega a 18 años/);
  });

  it('una ciudad que no es de ese departamento', () => {
    const f = conCambio('Ciudad o municipio', 'CALI');
    expect(f.municipioSepId).toBeNull();
    expect(f.problemas[0]).toMatch(/no es un municipio de ANTIOQUIA/);
  });

  it('un estrato fuera de rango', () => {
    expect(conCambio('Estrato socioeconómico', '9').problemas[0]).toMatch(/estrato del 1 al 6/);
  });

  it('una acción sin código', () => {
    expect(conCambio('Acción de formación de interés', 'La de neuroeducación').problemas[0]).toMatch(
      /falta su código/,
    );
  });
});

describe('las piezas sueltas', () => {
  it('reconoce el encabezado aunque lo reescriban', () => {
    const c = columnasDelEncabezado(['Documento', 'Nombres', 'Apellidos', 'Celular', 'Curso']);
    expect(c).toMatchObject({ numeroDocumento: 0, primerNombre: 1, primerApellido: 2, celular: 3, accion: 4 });
  });

  it('una fila de datos nunca es un encabezado', () => {
    expect(columnasDelEncabezado(['Cedula', '1019456782', 'Laura'])).toBeNull();
  });

  it('el género «Otro» es el «No binario» del SEP', () => {
    expect(leerGenero('Otro').id).toBe(3);
    expect(leerGenero('M').id).toBe(1);
    expect(leerGenero('azul').problema).toMatch(/no es un género/);
  });

  it('sí y no, en las formas en que se escriben', () => {
    expect(leerSiNo('Sí').valor).toBe(true);
    expect(leerSiNo('NO').valor).toBe(false);
    expect(leerSiNo('').valor).toBeNull();
  });

  it('la fecha llega en ISO, con barras o como número de Excel', () => {
    expect(leerFechaDeNacimiento('1990-03-15').iso).toBe('1990-03-15');
    expect(leerFechaDeNacimiento('15/03/1990').iso).toBe('1990-03-15');
    expect(leerFechaDeNacimiento('32947').iso).toBe('1990-03-15');
  });

  it('un municipio repetido en varios departamentos pide el departamento', () => {
    const r = leerDondeVive('', 'LA UNIÓN');
    expect(r.municipioSepId).toBeNull();
    expect(r.problema).toMatch(/falta el departamento/);
  });

  it('el código sale del texto de la acción', () => {
    expect(codigoDeAccion('AF3 · GOBERNANZA')).toBe('AF3');
    expect(codigoDeAccion('af 12 algo')).toBe('AF12');
    expect(codigoDeAccion('Gobernanza')).toBeNull();
  });
});

describe('Bogotá, que es ciudad y departamento a la vez', () => {
  it('«BOGOTÁ D.C» en la casilla de la ciudad se entiende', () => {
    const r = leerDondeVive('BOGOTÁ D.C', 'BOGOTÁ D.C');
    expect(r.departamentoSepId).toBe(11);
    expect(r.municipioSepId).toBe(11001);
    expect(r.problema).toBeUndefined();
  });

  it('un departamento con varios municipios en la casilla de la ciudad pide la ciudad', () => {
    const r = leerDondeVive('ANTIOQUIA', 'ANTIOQUIA');
    expect(r.departamentoSepId).toBe(5);
    expect(r.municipioSepId).toBeNull();
    expect(r.problema).toMatch(/es el departamento, no la ciudad/);
  });
});
