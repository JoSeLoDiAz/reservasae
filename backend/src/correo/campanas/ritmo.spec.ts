import {
  enColombia,
  inicioDelDiaColombiano,
  pausa,
  sePuedeAhora,
  TOPE_DIARIO,
  TOPE_POR_HORA,
} from './ritmo';

/// Estas pruebas cuidan la cuenta de correo de la oficina. Si
/// alguna se cae, lo que se rompió es el freno que impide que
/// Google suspenda proyectosena@grupo-ae.com.co.

/// Un martes. En UTC las 15:00 son las 10:00 de Bogotá.
const martesDiez = new Date('2026-09-01T15:00:00.000Z');

describe('la hora es la de Bogotá, no la del servidor', () => {
  it('las 15:00 UTC son las 10 de la mañana acá', () => {
    expect(enColombia(martesDiez)).toEqual({ dia: 2, hora: 10 });
  });

  it('las 2 de la mañana UTC son todavía la noche de ayer', () => {
    // el servidor puede correr en cualquier huso; el que manda
    // es el de la persona que recibe el correo. Aquí ya es
    // miércoles en UTC y en Bogotá sigue siendo martes.
    expect(enColombia(new Date('2026-09-02T02:00:00.000Z'))).toEqual({
      dia: 2,
      hora: 21,
    });
  });
});

describe('el horario', () => {
  const libre = (d: Date) => sePuedeAhora(d, 0, 0);

  it('a las 10 de la mañana de un martes, sale', () => {
    expect(libre(martesDiez)).toEqual({ puede: true });
  });

  it('a las 6 de la mañana NO sale', () => {
    const r = libre(new Date('2026-09-01T11:00:00.000Z'));
    expect(r.puede).toBe(false);
    expect(r).toMatchObject({ reintentar: true });
  });

  it('a las 9 de la noche NO sale', () => {
    // un correo de la empresa a esa hora es una molestia, y
    // molestar es lo que hace que marquen «spam»
    expect(libre(new Date('2026-09-02T02:00:00.000Z')).puede).toBe(false);
  });

  it('a las 6 en punto de la tarde ya no sale', () => {
    expect(libre(new Date('2026-09-01T23:00:00.000Z')).puede).toBe(false);
  });

  it('el sábado no sale, aunque sea mediodía', () => {
    const r = libre(new Date('2026-09-05T17:00:00.000Z'));
    expect(r.puede).toBe(false);
    if (!r.puede) expect(r.motivo).toContain('fin de semana');
  });

  it('el domingo tampoco', () => {
    expect(libre(new Date('2026-09-06T17:00:00.000Z')).puede).toBe(false);
  });
});

describe('los topes, que son lo que salva la cuenta', () => {
  it('en el tope diario se para', () => {
    const r = sePuedeAhora(martesDiez, TOPE_DIARIO, 0);
    expect(r.puede).toBe(false);
    if (!r.puede) expect(r.motivo).toContain('tope diario');
  });

  it('uno menos del tope todavía pasa', () => {
    expect(sePuedeAhora(martesDiez, TOPE_DIARIO - 1, 0).puede).toBe(true);
  });

  it('el tope por hora es el freno de emergencia', () => {
    // no está para estirar la campaña: está por si un fallo
    // pone el bucle a girar y se gasta el cupo del día
    const r = sePuedeAhora(martesDiez, 10, TOPE_POR_HORA);
    expect(r.puede).toBe(false);
    if (!r.puede) expect(r.motivo).toContain('esta hora');
  });

  it('el tope diario está MUY por debajo de lo que Google permite', () => {
    // Google admite unos 2.000. Aquí se usa una fracción para
    // dejarle sitio al correo normal de la oficina, que sale
    // por la misma cuenta.
    expect(TOPE_DIARIO).toBeLessThanOrEqual(500);
  });

  it('pero alcanza para una campaña grande en un solo día', () => {
    // si una campaña de 200 no cabe en un día, el tope no está
    // protegiendo nada: está estorbando
    expect(TOPE_DIARIO).toBeGreaterThanOrEqual(200);
  });
});

describe('la pausa entre uno y otro', () => {
  it('va de uno a tres segundos', () => {
    expect(pausa(0)).toBeGreaterThanOrEqual(1_000);
    expect(pausa(1)).toBeLessThanOrEqual(3_000);
  });

  it('una campaña de 200 sale en minutos, no en días', () => {
    // el primer intento fueron 20-45 segundos y eso convertía
    // 200 correos en dos días de espera. Ese no es el precio
    // de no llamar la atención.
    const peor = (200 * pausa(1)) / 60_000;
    expect(peor).toBeLessThan(15);
  });

  it('varía: una cadencia exacta delata a un robot', () => {
    expect(pausa(0)).not.toBe(pausa(1));
  });
});

describe('el día colombiano, para contar bien', () => {
  it('a las 7 de la noche de Bogotá el día sigue siendo el mismo', () => {
    // en UTC ya es el día siguiente; contar por UTC pondría el
    // contador a cero a las 7 p. m. y dejaría salir el doble
    const tarde = new Date('2026-09-02T00:30:00.000Z');
    const inicio = inicioDelDiaColombiano(tarde);
    expect(inicio.toISOString()).toBe('2026-09-01T05:00:00.000Z');
  });

  it('a las 8 de la mañana también', () => {
    const manana = new Date('2026-09-01T13:00:00.000Z');
    expect(inicioDelDiaColombiano(manana).toISOString()).toBe(
      '2026-09-01T05:00:00.000Z',
    );
  });
});
