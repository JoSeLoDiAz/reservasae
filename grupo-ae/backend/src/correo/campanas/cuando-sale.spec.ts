import { cuandoSale, enPalabras } from './cuando-sale';

/// Lo que cuida esto: que la pantalla no le mienta a nadie
/// sobre cuándo va a salir su campaña. Alguien lanzaba a las
/// siete de la noche, no veía nada, y creía que estaba rota.

/// Un martes. En UTC las 15:00 son las 10:00 de Bogotá.
const martesDiez = new Date('2026-09-01T15:00:00.000Z');

describe('cuándo empieza a salir', () => {
  it('en horario, sale ya', () => {
    const r = cuandoSale(martesDiez);
    expect(r.ahora).toBe(true);
    expect(r.cuando).toContain('ahora');
  });

  it('a las siete de la noche, mañana', () => {
    // 2026-09-02T00:00Z son las 7 p.m. del martes en Bogotá
    const r = cuandoSale(new Date('2026-09-02T00:00:00.000Z'));
    expect(r.ahora).toBe(false);
    expect(r.cuando).toContain('miércoles');
  });

  it('a las seis de la mañana, hoy mismo más tarde', () => {
    const r = cuandoSale(new Date('2026-09-01T11:00:00.000Z'));
    expect(r.ahora).toBe(false);
    expect(r.cuando).toContain('hoy');
  });

  it('el viernes en la noche, el lunes', () => {
    // no «el sábado»: el sábado no se manda
    const r = cuandoSale(new Date('2026-09-05T00:00:00.000Z'));
    expect(r.cuando).toContain('lunes');
  });

  it('el sábado, el lunes', () => {
    const r = cuandoSale(new Date('2026-09-05T17:00:00.000Z'));
    expect(r.ahora).toBe(false);
    expect(r.cuando).toContain('lunes');
  });

  it('el domingo, el lunes', () => {
    expect(cuandoSale(new Date('2026-09-06T17:00:00.000Z')).cuando).toContain(
      'lunes',
    );
  });
});

describe('cuánto tarda, dicho por lo alto', () => {
  it('una tanda chica sale en minutos', () => {
    expect(enPalabras(40)).toContain('minutos');
  });

  it('cuarenta correos no son «días»', () => {
    // el primer intento decía dos días para doscientos, y era
    // falso
    expect(enPalabras(40)).not.toContain('días');
  });

  it('doscientos caben en un día', () => {
    expect(enPalabras(200)).not.toContain('días');
  });

  it('novecientos NO caben, y se dice', () => {
    // el tope diario se comparte con el correo de la oficina
    const t = enPalabras(900);
    expect(t).toContain('días');
    expect(t).toContain('300');
  });

  it('sin nadie a quien mandarle, lo dice', () => {
    expect(enPalabras(0)).toContain('No hay a quién');
  });
});
