import {
  avisoDeLiberacion,
  cierreDeInscripciones,
  habilesAtras,
  habilesEntre,
  ventanaDe,
} from './calendario-inscripcion';

/// El ejemplo de Mauricio, palabra por palabra: «si son 40
/// cupos y el curso empieza el 07 de septiembre... el proceso
/// de inscripcion finaliza el 31... debe notificar el 26».
/// Si alguien cambia las cuentas, esto se cae.

/// Una fecha de calendario: el arranque de un grupo, un cierre.
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/// Un instante de verdad: mediodia en Bogota de ese dia.
/// «Hoy» siempre es un instante, nunca una fecha pelada, y
/// medianoche UTC en Bogota es la tarde del dia anterior.
const enBogota = (iso: string) => new Date(`${iso}T17:00:00.000Z`);

describe('el ejemplo que fija las cuentas', () => {
  const INICIO = d('2026-09-07'); // lunes

  it('un curso que empieza el 7 de septiembre cierra el 31 de agosto', () => {
    expect(cierreDeInscripciones(INICIO).toISOString().slice(0, 10)).toBe('2026-08-31');
  });

  it('y el aviso para liberar cupos sale el 26', () => {
    expect(avisoDeLiberacion(INICIO).toISOString().slice(0, 10)).toBe('2026-08-26');
  });
});

describe('habilesAtras', () => {
  it('salta el fin de semana', () => {
    // lunes 7 menos un habil es viernes 4, no domingo 6
    expect(habilesAtras(d('2026-09-07'), 1).toISOString().slice(0, 10)).toBe('2026-09-04');
  });

  it('cero dias no mueve nada', () => {
    expect(habilesAtras(d('2026-09-07'), 0).toISOString().slice(0, 10)).toBe('2026-09-07');
  });

  it('cruza varias semanas sin perderse', () => {
    // diez habiles atras de lunes 7 sep son dos semanas: lunes 24 ago
    expect(habilesAtras(d('2026-09-07'), 10).toISOString().slice(0, 10)).toBe('2026-08-24');
  });
});

describe('la ventana de un grupo', () => {
  const INICIO = d('2026-09-07');

  it('sin fecha de inicio no hay ventana, y no se puede inscribir', () => {
    const v = ventanaDe(null, enBogota('2026-08-25'));
    expect(v.estado).toBe('SIN_FECHAS');
    expect(v.cierre).toBeNull();
  });

  it('antes del aviso esta abierta y tranquila', () => {
    expect(ventanaDe(INICIO, enBogota('2026-08-20')).estado).toBe('ABIERTA');
  });

  it('el mismo dia del aviso ya esta avisando', () => {
    expect(ventanaDe(INICIO, enBogota('2026-08-26')).estado).toBe('AVISANDO');
  });

  it('entre el aviso y el cierre sigue avisando', () => {
    expect(ventanaDe(INICIO, enBogota('2026-08-28')).estado).toBe('AVISANDO');
  });

  it('el dia del cierre todavia se puede inscribir', () => {
    expect(ventanaDe(INICIO, enBogota('2026-08-31')).estado).toBe('AVISANDO');
  });

  it('al dia siguiente del cierre, cerrada', () => {
    expect(ventanaDe(INICIO, enBogota('2026-09-01')).estado).toBe('CERRADA');
  });
});

describe('habilesEntre', () => {
  it('cuenta los habiles que faltan', () => {
    // del miercoles 26 al lunes 31: jueves, viernes, lunes
    expect(habilesEntre(d('2026-08-26'), d('2026-08-31'))).toBe(3);
  });

  it('el mismo dia son cero', () => {
    expect(habilesEntre(d('2026-08-26'), d('2026-08-26'))).toBe(0);
  });

  it('negativo cuando ya paso', () => {
    // del miercoles 2 al lunes 31 hacia atras: martes 1 y
    // lunes 31, dos habiles de retraso
    expect(habilesEntre(d('2026-09-02'), d('2026-08-31'))).toBe(-2);
  });
});

/// El fallo que casi se cuela: comparar en UTC.
///
/// Colombia va cinco horas detras. A las siete de la noche en
/// Bogota ya es el dia siguiente en UTC, asi que una ventana
/// que cierra hoy se daba por cerrada esa misma tarde. Cada
/// tarde, un dia menos para inscribir.
describe('la hora de Colombia, no la de Greenwich', () => {
  const INICIO = d('2026-09-07'); // cierra el lunes 31 de agosto

  it('a las 8 de la noche del dia del cierre todavia se inscribe', () => {
    // 2026-09-01T01:00Z son las 8 p. m. del 31 de agosto en Bogota
    const laNocheDelCierre = new Date('2026-09-01T01:00:00.000Z');
    expect(ventanaDe(INICIO, laNocheDelCierre).estado).toBe('AVISANDO');
  });

  it('a las 11:59 de la noche del cierre, sigue abierta', () => {
    const casiMedianoche = new Date('2026-09-01T04:59:00.000Z');
    expect(ventanaDe(INICIO, casiMedianoche).estado).toBe('AVISANDO');
  });

  it('a la manana siguiente, ya no', () => {
    // 2026-09-01T13:00Z son las 8 a. m. del 1 de septiembre en Bogota
    const alDiaSiguiente = new Date('2026-09-01T13:00:00.000Z');
    expect(ventanaDe(INICIO, alDiaSiguiente).estado).toBe('CERRADA');
  });

  it('la madrugada del dia del aviso ya avisa', () => {
    // 2026-08-26T06:00Z es la 1 a. m. del 26 en Bogota
    expect(ventanaDe(INICIO, new Date('2026-08-26T06:00:00.000Z')).estado).toBe('AVISANDO');
  });

  it('la noche anterior al aviso, todavia no', () => {
    // 2026-08-26T02:00Z son las 9 p. m. del 25 en Bogota
    expect(ventanaDe(INICIO, new Date('2026-08-26T02:00:00.000Z')).estado).toBe('ABIERTA');
  });
});
