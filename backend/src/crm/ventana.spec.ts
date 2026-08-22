import { compararDos, resolverVentana, variacion, type Ventana } from './ventana';

// el instante, escrito en hora de Bogotá
const enBogota = (d: Date) =>
  new Date(d.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

const dias = (v: Ventana) => (v.hasta.getTime() - v.desde.getTime()) / 86_400_000;

describe('el corte del día va en hora de Bogotá', () => {
  // en Bogotá son todavía las 21:00 del día 20
  const casiMedianocheUtc = new Date('2026-08-21T02:00:00Z');

  it('«ayer» a las 21:00 de Bogotá es el día 19, no el 20', () => {
    const c = resolverVentana('AYER', undefined, undefined, casiMedianocheUtc);

    expect(enBogota(c.actual!.desde)).toBe('2026-08-19 00:00:00');
    expect(enBogota(c.actual!.hasta)).toBe('2026-08-20 00:00:00');
  });

  it('empieza y acaba a medianoche de Bogotá, que en UTC son las 05:00', () => {
    const c = resolverVentana('AYER', undefined, undefined, casiMedianocheUtc);

    expect(c.actual!.desde.toISOString()).toBe('2026-08-19T05:00:00.000Z');
    expect(c.actual!.hasta.toISOString()).toBe('2026-08-20T05:00:00.000Z');
  });

  it('dura un día exacto', () => {
    const c = resolverVentana('AYER', undefined, undefined, casiMedianocheUtc);

    expect(dias(c.actual!)).toBe(1);
    expect(dias(c.anterior!)).toBe(1);
  });

  it('da lo mismo en dos instantes del mismo día de Bogotá', () => {
    const manana = resolverVentana('AYER', undefined, undefined, new Date('2026-08-20T13:00:00Z'));
    const noche = resolverVentana('AYER', undefined, undefined, casiMedianocheUtc);

    expect(manana.actual!.desde).toEqual(noche.actual!.desde);
    expect(manana.actual!.hasta).toEqual(noche.actual!.hasta);
  });

  it('«hoy» arranca a medianoche y llega hasta AHORA, no hasta mañana', () => {
    const c = resolverVentana('HOY', undefined, undefined, casiMedianocheUtc);

    expect(enBogota(c.actual!.desde)).toBe('2026-08-20 00:00:00');
    expect(c.actual!.hasta).toEqual(casiMedianocheUtc);
  });
});

/**
 * La invariante NO es «siete días»: es que los dos tramos
 * midan lo mismo.
 *
 * Un periodo en curso se recorta en el reloj y el anterior
 * se recorta igual. Sin eso, «hoy» a las ocho de la mañana
 * eran ocho horas contra las veinticuatro de ayer, y con la
 * misma captura la flecha marcaba −67 % en rojo todas las
 * mañanas — siempre en la misma dirección, que es la clase
 * de error que nadie detecta mirando.
 */
describe('un periodo en curso se compara con el mismo tramo del anterior', () => {
  // en Bogotá, las 21:00 del día 20: quedan 3 h de día
  const ahora = new Date('2026-08-21T02:00:00Z');

  it.each(['HOY', 'SEMANA', 'MES', 'TRIMESTRE'] as const)(
    '%s: los dos tramos miden exactamente igual',
    (rango) => {
      const c = resolverVentana(rango, undefined, undefined, ahora);

      expect(dias(c.anterior!)).toBeCloseTo(dias(c.actual!), 9);
    },
  );

  it.each(['HOY', 'SEMANA', 'MES', 'TRIMESTRE'] as const)(
    '%s: el actual no pasa de ahora',
    (rango) => {
      const c = resolverVentana(rango, undefined, undefined, ahora);

      expect(c.actual!.hasta).toEqual(ahora);
    },
  );

  it('el anterior arranca un periodo ENTERO atrás, no pegado al actual', () => {
    const c = resolverVentana('SEMANA', undefined, undefined, ahora);
    const semana = 7 * 86_400_000;

    expect(c.anterior!.desde.getTime()).toBe(c.actual!.desde.getTime() - semana);
    // y por tanto NO acaba donde empieza el actual: entre
    // los dos queda el trozo del periodo previo que aún no
    // tiene equivalente en este
    expect(c.anterior!.hasta.getTime()).toBeLessThan(c.actual!.desde.getTime());
  });

  it('los últimos 7 días arrancan el 14 e incluyen lo que va de hoy', () => {
    const c = resolverVentana('SEMANA', undefined, undefined, ahora);

    expect(enBogota(c.actual!.desde)).toBe('2026-08-14 00:00:00');
    expect(c.actual!.hasta).toEqual(ahora);
  });

  it('un periodo ya cerrado no se recorta y sí va pegado al anterior', () => {
    const c = resolverVentana('AYER', undefined, undefined, ahora);

    expect(dias(c.actual!)).toBe(1);
    expect(dias(c.anterior!)).toBe(1);
    expect(c.anterior!.hasta).toEqual(c.actual!.desde);
  });
});

describe('el mes pasado', () => {
  // en Bogotá, 15 de marzo de 2026
  const enMarzo = new Date('2026-03-15T10:00:00Z');

  it('es el mes natural anterior, de primero a primero', () => {
    const c = resolverVentana('MES_PASADO', undefined, undefined, enMarzo);

    expect(enBogota(c.actual!.desde)).toBe('2026-02-01 00:00:00');
    expect(enBogota(c.actual!.hasta)).toBe('2026-03-01 00:00:00');
  });

  it('se compara contra el mes anterior a ese', () => {
    const c = resolverVentana('MES_PASADO', undefined, undefined, enMarzo);

    expect(enBogota(c.anterior!.desde)).toBe('2026-01-01 00:00:00');
    expect(enBogota(c.anterior!.hasta)).toBe('2026-02-01 00:00:00');
  });

  it('no supone que los dos meses duren igual', () => {
    const c = resolverVentana('MES_PASADO', undefined, undefined, enMarzo);

    expect(dias(c.actual!)).toBe(28);
    expect(dias(c.anterior!)).toBe(31);
  });

  it('cruza el cambio de año sin perderse', () => {
    const enEnero = new Date('2026-01-20T10:00:00Z');
    const c = resolverVentana('MES_PASADO', undefined, undefined, enEnero);

    expect(enBogota(c.actual!.desde)).toBe('2025-12-01 00:00:00');
    expect(enBogota(c.anterior!.desde)).toBe('2025-11-01 00:00:00');
  });

  it('CANTA que los dos meses no duran igual, en vez de callarlo', () => {
    // febrero contra enero: 28 contra 31 sesga el volumen un
    // 10 % de entrada, y hay que decirlo donde se lee
    const c = resolverVentana('MES_PASADO', undefined, undefined, enMarzo);

    expect(c.etiqueta).toBe('El mes pasado');
    expect(c.etiquetaAnterior).toBe('el mes anterior a ese (31 días contra 28)');
  });

  it('y se calla cuando sí duran igual', () => {
    // enero contra diciembre: los dos de 31
    const enFebrero = new Date('2026-02-10T10:00:00Z');
    const c = resolverVentana('MES_PASADO', undefined, undefined, enFebrero);

    expect(c.etiquetaAnterior).toBe('el mes anterior a ese');
  });
});

describe('entre dos fechas', () => {
  const ahora = new Date('2026-08-21T02:00:00Z');

  it('incluye entero el día del «hasta», no lo corta a medianoche', () => {
    const c = resolverVentana('PERSONALIZADO', '2026-03-01', '2026-03-31', ahora);

    expect(enBogota(c.actual!.desde)).toBe('2026-03-01 00:00:00');
    expect(enBogota(c.actual!.hasta)).toBe('2026-04-01 00:00:00');
    expect(dias(c.actual!)).toBe(31);
  });

  it('un solo día es un día, no cero', () => {
    const c = resolverVentana('PERSONALIZADO', '2026-03-01', '2026-03-01', ahora);

    expect(dias(c.actual!)).toBe(1);
  });

  it('se compara con los mismos días de antes', () => {
    const c = resolverVentana('PERSONALIZADO', '2026-03-01', '2026-03-31', ahora);

    expect(dias(c.anterior!)).toBe(31);
    expect(enBogota(c.anterior!.desde)).toBe('2026-01-29 00:00:00');
    expect(c.anterior!.hasta).toEqual(c.actual!.desde);
  });

  it('cae a TODO si las fechas vienen al revés', () => {
    const c = resolverVentana('PERSONALIZADO', '2026-03-31', '2026-03-01', ahora);

    expect(c.rango).toBe('TODO');
    expect(c.actual).toBeNull();
  });

  it('cae a TODO si la fecha no es una fecha, en vez de reventar', () => {
    for (const par of [
      ['ayer', '2026-03-31'],
      ['2026-03-01', 'mañana'],
      ['2026-13-45', '2026-03-31'],
    ]) {
      const c = resolverVentana('PERSONALIZADO', par[0], par[1], ahora);
      expect(c.rango).toBe('TODO');
      expect(c.actual).toBeNull();
    }
  });

  it('cae a TODO si falta una de las dos fechas', () => {
    expect(resolverVentana('PERSONALIZADO', '2026-03-01', undefined, ahora).rango).toBe('TODO');
    expect(resolverVentana('PERSONALIZADO', undefined, '2026-03-31', ahora).rango).toBe('TODO');
  });
});

describe('sin corte de tiempo', () => {
  it('TODO no tiene ventana ni con qué compararse', () => {
    const c = resolverVentana('TODO', undefined, undefined, new Date('2026-08-21T02:00:00Z'));

    expect(c.actual).toBeNull();
    expect(c.anterior).toBeNull();
    expect(c.etiquetaAnterior).toBeNull();
    expect(c.etiqueta).toBe('Desde el principio');
  });

  it('sin rango pedido se asume TODO', () => {
    expect(resolverVentana().rango).toBe('TODO');
    expect(resolverVentana().actual).toBeNull();
  });
});

describe('comparar contra el periodo que se elija', () => {
  // en Bogotá son las 21:00 del día 20
  const ahora = new Date('2026-08-21T02:00:00Z');
  const sinFechas = [undefined, undefined, undefined, undefined] as const;

  it('«hoy contra ayer»: hoy va hasta ahora y ayer entero', () => {
    const c = compararDos('HOY', 'AYER', ...sinFechas, ahora);

    expect(enBogota(c.actual!.desde)).toBe('2026-08-20 00:00:00');
    expect(c.actual!.hasta).toEqual(ahora);
    expect(dias(c.anterior!)).toBe(1);
    expect(enBogota(c.anterior!.desde)).toBe('2026-08-19 00:00:00');
    // contiguos: ayer acaba donde empieza hoy
    expect(c.anterior!.hasta).toEqual(c.actual!.desde);
  });

  it('no exige que los dos duren igual: un mes contra otro más corto', () => {
    // ¿llevamos ya lo del mes pasado?
    const enMarzo = new Date('2026-03-15T10:00:00Z');
    const c = compararDos('MES', 'MES_PASADO', ...sinFechas, enMarzo);

    expect(dias(c.anterior!)).toBe(28);
    expect(dias(c.actual!)).not.toBe(dias(c.anterior!));
    expect(enBogota(c.anterior!.desde)).toBe('2026-02-01 00:00:00');
    expect(enBogota(c.anterior!.hasta)).toBe('2026-03-01 00:00:00');
  });

  it('un día contra un mes entero también vale', () => {
    const c = compararDos('HOY', 'MES', ...sinFechas, ahora);

    // el elegido a mano puede durar treinta veces más: es
    // una pregunta legítima, y la pantalla avisa
    expect(dias(c.anterior!)).toBeGreaterThan(dias(c.actual!) * 20);
  });

  it('contra TODO no queda con qué comparar', () => {
    const c = compararDos('SEMANA', 'TODO', ...sinFechas, ahora);

    expect(c.actual).not.toBeNull();
    expect(c.anterior).toBeNull();
  });

  it('el rótulo de atrás es el del segundo periodo, no «el periodo anterior»', () => {
    const c = compararDos('HOY', 'MES_PASADO', ...sinFechas, ahora);

    expect(c.etiqueta).toBe('Hoy');
    expect(c.etiquetaAnterior).toBe('el mes pasado');
  });

  it('cada rango lleva sus propias fechas', () => {
    const c = compararDos(
      'PERSONALIZADO',
      'PERSONALIZADO',
      '2026-03-01',
      '2026-03-31',
      '2026-01-01',
      '2026-01-15',
      ahora,
    );

    expect(dias(c.actual!)).toBe(31);
    expect(dias(c.anterior!)).toBe(15);
    expect(enBogota(c.actual!.desde)).toBe('2026-03-01 00:00:00');
    expect(enBogota(c.anterior!.desde)).toBe('2026-01-01 00:00:00');
  });
});

describe('la variación', () => {
  it('un aumento del 25 % es 0.25', () => {
    expect(variacion(125, 100)).toBe(0.25);
  });

  it('una caída a la mitad es -0.5', () => {
    expect(variacion(50, 100)).toBe(-0.5);
  });

  it('de nada a algo es null: no hay porcentaje que calcular', () => {
    expect(variacion(7, 0)).toBeNull();
  });

  it('de nada a nada es 0, no null: no cambió', () => {
    expect(variacion(0, 0)).toBe(0);
  });

  it('a cero desde algo es -1', () => {
    expect(variacion(0, 40)).toBe(-1);
  });
});
