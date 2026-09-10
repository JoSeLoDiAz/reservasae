import { confianzaDelCorte, conTildes, partirNombre } from './partir-nombre';

/// Los casos son nombres colombianos reales por su forma: el
/// RUI devuelve una sola linea sin decir donde acaban los
/// nombres, y equivocarse ahi manda mal el apellido al SENA.

describe('partirNombre', () => {
  it('dos palabras: un nombre y un apellido', () => {
    expect(partirNombre('JOSE PEREZ')).toEqual({
      primerNombre: 'JOSE',
      segundoNombre: '',
      primerApellido: 'PEREZ',
      segundoApellido: '',
    });
  });

  it('cuatro palabras: la forma de siempre', () => {
    expect(partirNombre('MARIA FERNANDA GOMEZ RUIZ')).toEqual({
      primerNombre: 'MARIA',
      segundoNombre: 'FERNANDA',
      primerApellido: 'GOMEZ',
      segundoApellido: 'RUIZ',
    });
  });

  it('tres palabras: si la del medio es apellido, son dos apellidos', () => {
    expect(partirNombre('CARLOS GOMEZ RUIZ')).toEqual({
      primerNombre: 'CARLOS',
      segundoNombre: '',
      primerApellido: 'GOMEZ',
      segundoApellido: 'RUIZ',
    });
  });

  it('tres palabras: si la del medio es nombre, son dos nombres', () => {
    expect(partirNombre('ANA MARIA RUIZ')).toEqual({
      primerNombre: 'ANA',
      segundoNombre: 'MARIA',
      primerApellido: 'RUIZ',
      segundoApellido: '',
    });
  });

  it('la particula se pega al apellido que sigue', () => {
    const r = partirNombre('JUAN CARLOS DE LA CRUZ MARTINEZ');
    expect(r.primerNombre).toBe('JUAN');
    expect(r.primerApellido).toBe('DE LA CRUZ');
    expect(r.segundoApellido).toBe('MARTINEZ');
  });

  it('sin nombre no inventa nada', () => {
    expect(partirNombre('')).toEqual({
      primerNombre: '',
      segundoNombre: '',
      primerApellido: '',
      segundoApellido: '',
    });
    expect(partirNombre('NO ENCONTRADO').primerNombre).toBe('');
  });
});

describe('conTildes', () => {
  it('pone las tildes que el RUI no manda', () => {
    expect(conTildes('JOSE MARTINEZ')).toBe('José Martínez');
  });

  it('deja la particula en minuscula', () => {
    expect(conTildes('JUAN DE LA CRUZ')).toBe('Juan de la Cruz');
  });

  it('lo que no esta en la tabla se deja como viene', () => {
    expect(conTildes('ZZZAPATA')).toBe('Zzzapata');
  });
});

describe('confianzaDelCorte', () => {
  it('marca para revisar lo que no se puede partir', () => {
    expect(confianzaDelCorte('')).toBe('REVISAR_MANUAL');
    expect(confianzaDelCorte('NO ENCONTRADO')).toBe('REVISAR_MANUAL');
    expect(confianzaDelCorte('PEREZ')).toBe('REVISAR_MANUAL');
  });

  it('dos palabras: si la segunda parece nombre, hay duda', () => {
    // «JOSE MARIA» puede ser un compuesto al que le falta el apellido
    expect(confianzaDelCorte('JOSE MARIA')).toBe('POR_VALIDAR');
    expect(confianzaDelCorte('JOSE PEREZ')).toBe('OK');
  });

  it('la particula deja el corte claro', () => {
    expect(confianzaDelCorte('JUAN CARLOS DE LA CRUZ MARTINEZ')).toBe('OK');
  });

  it('un tercer nombre mal puesto se marca', () => {
    // ANA MARIA LUISA GOMEZ: «LUISA» es nombre, no apellido
    expect(confianzaDelCorte('ANA MARIA LUISA GOMEZ')).toBe('POR_VALIDAR');
  });
});
