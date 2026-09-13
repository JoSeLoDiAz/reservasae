import { fraseDeHorario } from './horario-de-grupo';

/// Llama a la funcion de verdad, no la reimplementa: un spec que
/// copia la linea que dice proteger no protege nada.
describe('la frase del horario', () => {
  it('junta los dias y el tramo', () => {
    expect(
      fraseDeHorario({ dias: 'lunes a sábado', horaInicio: '18:00', horaFin: '20:00' }),
    ).toBe('lunes a sábado, de 18:00 a 20:00');
  });

  it('sin horas, solo los dias', () => {
    expect(fraseDeHorario({ dias: 'Sábados', horaInicio: null, horaFin: null })).toBe(
      'Sábados',
    );
  });

  it('sin dias, solo el tramo', () => {
    expect(fraseDeHorario({ dias: null, horaInicio: '07:00', horaFin: '11:00' })).toBe(
      'de 07:00 a 11:00',
    );
  });

  /// La base prohibe el fin sin inicio; al reves es legitimo.
  it('con inicio y sin fin dice desde cuando', () => {
    expect(fraseDeHorario({ dias: 'Sábados', horaInicio: '08:00', horaFin: null })).toBe(
      'Sábados, desde las 08:00',
    );
  });

  it('sin nada es nulo, no una cadena vacia', () => {
    expect(fraseDeHorario({ dias: null, horaInicio: null, horaFin: null })).toBeNull();
  });

  /// Un grupo recien creado trae "" y no null en `dias`.
  it('unos dias en blanco no dejan una coma suelta', () => {
    expect(fraseDeHorario({ dias: '   ', horaInicio: '18:00', horaFin: '20:00' })).toBe(
      'de 18:00 a 20:00',
    );
  });

  /// Lo que la migracion NO supo partir se queda entero en
  /// `dias`, y entonces la frase tiene que salir igual que antes.
  it('lo que no se pudo partir sale tal cual', () => {
    expect(
      fraseDeHorario({
        dias: 'Lunes, 8:00 a 9:00, y sábados',
        horaInicio: null,
        horaFin: null,
      }),
    ).toBe('Lunes, 8:00 a 9:00, y sábados');
  });
});
