import { fraseDeHorario } from './horario-de-grupo';

const s = (horaInicio: string, horaFin: string) => ({ horaInicio, horaFin });

describe('la frase del horario', () => {
  it('junta los dias y el tramo de su sesion', () => {
    expect(
      fraseDeHorario({ dias: 'lunes a sábado', sesiones: [s('18:00', '20:00')] }),
    ).toBe('lunes a sábado, de 18:00 a 20:00');
  });

  it('sin sesiones, solo los dias', () => {
    expect(fraseDeHorario({ dias: 'Sábados', sesiones: [] })).toBe('Sábados');
  });

  it('sin dias, solo el tramo', () => {
    expect(fraseDeHorario({ dias: null, sesiones: [s('07:00', '11:00')] })).toBe(
      'de 07:00 a 11:00',
    );
  });

  it('sin nada es nulo, no una cadena vacia', () => {
    expect(fraseDeHorario({ dias: null, sesiones: [] })).toBeNull();
  });

  it('unos dias en blanco no dejan una coma suelta', () => {
    expect(fraseDeHorario({ dias: '   ', sesiones: [s('18:00', '20:00')] })).toBe(
      'de 18:00 a 20:00',
    );
  });

  /// EL BOOTCAMP: dos tramos distintos no se resumen en uno sin
  /// mentir sobre alguno de los dos.
  it('con dos sesiones se enumeran las dos', () => {
    expect(
      fraseDeHorario({ dias: 'Jueves y viernes', sesiones: [s('08:00', '12:00'), s('14:00', '18:00')] }),
    ).toBe('Jueves y viernes, de 08:00 a 12:00 y de 14:00 a 18:00');
  });

  it('con tres, la ultima va con «y» y las otras con coma', () => {
    expect(
      fraseDeHorario({
        dias: null,
        sesiones: [s('08:00', '09:00'), s('10:00', '11:00'), s('12:00', '13:00')],
      }),
    ).toBe('de 08:00 a 09:00, de 10:00 a 11:00 y de 12:00 a 13:00');
  });

  /// Lo que la migracion no supo partir se quedo entero en
  /// `dias`, y entonces la frase sale igual que antes.
  it('lo que no se pudo partir sale tal cual', () => {
    expect(
      fraseDeHorario({ dias: 'Lunes, 8:00 a 9:00, y sábados', sesiones: [] }),
    ).toBe('Lunes, 8:00 a 9:00, y sábados');
  });
});
