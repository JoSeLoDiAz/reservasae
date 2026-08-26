import {
  compararNombres,
  nombreCoincide,
  normalizar,
} from './comparar-nombres';

describe('normalizar', () => {
  it('quita tildes y deja mayúsculas', () => {
    expect(normalizar('José Andrés Muñóz')).toBe('JOSE ANDRES MUNOZ');
  });

  it('come los dobles espacios y la puntuación', () => {
    expect(normalizar('  ANA   MARIA.  PEREZ ')).toBe('ANA MARIA PEREZ');
  });
});

describe('el orden no importa', () => {
  /// El RUI devuelve los apellidos primero; el formulario
  /// captura los nombres primero. Comparar en orden diría
  /// que no coincide nadie.
  it('apellidos delante o detrás dan igual', () => {
    const c = compararNombres(
      'MAURICIO ANDRES PALMA MESA',
      'PALMA MESA MAURICIO ANDRES',
    );

    expect(c.veredicto).toBe('IGUAL');
    expect(c.sobran).toEqual([]);
    expect(c.faltan).toEqual([]);
  });
});

describe('las diferencias que sí importan', () => {
  it('un nombre completamente distinto es DISTINTO', () => {
    const c = compararNombres('ANA MARIA GOMEZ RUIZ', 'PEDRO PEREZ LOPEZ');

    expect(c.veredicto).toBe('DISTINTO');
    expect(nombreCoincide('ANA MARIA GOMEZ RUIZ', 'PEDRO PEREZ LOPEZ')).toBe(
      false,
    );
  });

  it('cambiar un apellido lo hace DISTINTO', () => {
    const c = compararNombres(
      'JUAN CARLOS GOMEZ RUIZ',
      'JUAN CARLOS GOMEZ SOTO',
    );

    expect(c.veredicto).toBe('DISTINTO');
    expect(c.sobran).toEqual(['RUIZ']);
    expect(c.faltan).toEqual(['SOTO']);
  });
});

describe('omitir el segundo nombre no es un error', () => {
  it('tres de cuatro palabras es PARECIDO, no DISTINTO', () => {
    const c = compararNombres('JUAN GOMEZ RUIZ', 'JUAN CARLOS GOMEZ RUIZ');

    expect(c.veredicto).toBe('PARECIDO');
    expect(c.faltan).toEqual(['CARLOS']);
    expect(nombreCoincide('JUAN GOMEZ RUIZ', 'JUAN CARLOS GOMEZ RUIZ')).toBe(
      true,
    );
  });
});

describe('las partículas no cuentan', () => {
  it('"DE LA HOZ" con y sin partículas es lo mismo', () => {
    const c = compararNombres('MARIA DE LA HOZ PEREZ', 'MARIA HOZ PEREZ');

    expect(c.veredicto).toBe('IGUAL');
  });
});

describe('los bordes', () => {
  it('vacío es DISTINTO y no revienta', () => {
    expect(compararNombres('', 'ANA PEREZ').veredicto).toBe('DISTINTO');
    expect(compararNombres('ANA PEREZ', '').veredicto).toBe('DISTINTO');
  });

  it('una sola letra no cuenta como palabra', () => {
    expect(compararNombres('A B', 'ANA PEREZ').veredicto).toBe('DISTINTO');
  });
});
