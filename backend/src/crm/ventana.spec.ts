import { resolverVentana, variacion, type Ventana } from './ventana';

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

  it('«hoy» es el día 20 y llega hasta la medianoche siguiente', () => {
    const c = resolverVentana('HOY', undefined, undefined, casiMedianocheUtc);

    expect(enBogota(c.actual!.desde)).toBe('2026-08-20 00:00:00');
    expect(enBogota(c.actual!.hasta)).toBe('2026-08-21 00:00:00');
  });
});

describe('el periodo anterior dura lo mismo que el actual', () => {
  const ahora = new Date('2026-08-21T02:00:00Z');

  it.each([
    ['SEMANA', 7],
    ['MES', 30],
    ['TRIMESTRE', 90],
  ] as const)('%s son %i días, y los %i previos', (rango, largo) => {
    const c = resolverVentana(rango, undefined, undefined, ahora);

    expect(dias(c.actual!)).toBe(largo);
    expect(dias(c.anterior!)).toBe(largo);
  });

  it('el anterior acaba justo donde empieza el actual, sin hueco ni solape', () => {
    for (const rango of ['SEMANA', 'MES'] as const) {
      const c = resolverVentana(rango, undefined, undefined, ahora);
      expect(c.anterior!.hasta).toEqual(c.actual!.desde);
    }
  });

  it('los últimos 7 días incluyen hoy', () => {
    const c = resolverVentana('SEMANA', undefined, undefined, ahora);

    expect(enBogota(c.actual!.desde)).toBe('2026-08-14 00:00:00');
    expect(enBogota(c.actual!.hasta)).toBe('2026-08-21 00:00:00');
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

  it('dice contra qué se compara', () => {
    const c = resolverVentana('MES_PASADO', undefined, undefined, enMarzo);

    expect(c.etiqueta).toBe('El mes pasado');
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
