/** El ritmo de cada asesor y el color que se gana. */

import {
  antiguedadMedia,
  necesitaRefuerzo,
  ritmoDe,
  type Carga,
} from './seguimiento-de-asesores';

const d = (s: string) => new Date(`${s}T15:00:00.000Z`);
const carga = (p: Partial<Carga> = {}): Carga => ({
  total: 100,
  resueltos: 40,
  gestionados: 60,
  ...p,
});

describe('ritmoDe', () => {
  it('sin pendientes queda TERMINADO, aunque el plazo esté vencido', () => {
    // quien terminó, terminó: pintarlo en rojo por el calendario es
    // una alarma falsa en la fila de quien hizo el trabajo
    const r = ritmoDe({
      carga: carga({ total: 50, resueltos: 50 }),
      limite: new Date('2026-01-01T00:00:00.000Z'),
      hoy: d('2026-09-23'),
      diasCorridos: 10,
    });
    expect(r.estado).toBe('TERMINADO');
    expect(r.pendientes).toBe(0);
  });

  it('sin fecha límite queda SIN_PLAZO, que NO es verde', () => {
    const r = ritmoDe({ carga: carga(), limite: null, hoy: d('2026-09-23'), diasCorridos: 10 });
    expect(r.estado).toBe('SIN_PLAZO');
    expect(r.exigidoPorDia).toBeNull();
  });

  it('con el plazo pasado y pendientes queda VENCIDO, sin ritmo que calcular', () => {
    const r = ritmoDe({
      carga: carga(),
      limite: new Date('2026-09-01T00:00:00.000Z'),
      hoy: d('2026-09-23'),
      diasCorridos: 10,
    });
    expect(r.estado).toBe('VENCIDO');
    expect(r.exigidoPorDia).toBeNull();
  });

  it('reparte los pendientes entre los días HÁBILES que quedan', () => {
    // del miércoles 23 al miércoles 30 de septiembre hay 5 hábiles
    const r = ritmoDe({
      carga: carga({ total: 50, resueltos: 40 }),
      limite: new Date('2026-09-30T00:00:00.000Z'),
      hoy: d('2026-09-23'),
      diasCorridos: 10,
    });
    expect(r.diasHabiles).toBe(5);
    expect(r.exigidoPorDia).toBe(2);
  });

  it('el ritmo real sale de lo resuelto sobre los días que lleva', () => {
    const r = ritmoDe({
      carga: carga({ total: 100, resueltos: 40 }),
      limite: new Date('2026-09-30T00:00:00.000Z'),
      hoy: d('2026-09-23'),
      diasCorridos: 20,
    });
    expect(r.realPorDia).toBe(2);
  });

  it('si le exigen lo mismo que viene haciendo, va AL DÍA', () => {
    // 10 pendientes en 5 hábiles son 2 al día, y viene haciendo 2
    const r = ritmoDe({
      carga: carga({ total: 50, resueltos: 40 }),
      limite: new Date('2026-09-30T00:00:00.000Z'),
      hoy: d('2026-09-23'),
      diasCorridos: 20,
    });
    expect(r.estado).toBe('AL_DIA');
  });

  it('hasta un 20 % más es AJUSTADO: es la variación normal de una semana', () => {
    // 11 pendientes en 5 hábiles son 2,2 al día contra 2 que trae
    const r = ritmoDe({
      carga: carga({ total: 51, resueltos: 40 }),
      limite: new Date('2026-09-30T00:00:00.000Z'),
      hoy: d('2026-09-23'),
      diasCorridos: 20,
    });
    expect(r.estado).toBe('AJUSTADO');
  });

  it('del doble en adelante está EN RIESGO y pide refuerzo', () => {
    // 60 pendientes en 5 hábiles son 12 al día contra 2 que trae
    const r = ritmoDe({
      carga: carga({ total: 100, resueltos: 40 }),
      limite: new Date('2026-09-30T00:00:00.000Z'),
      hoy: d('2026-09-23'),
      diasCorridos: 20,
    });
    expect(r.estado).toBe('EN_RIESGO');
    expect(necesitaRefuerzo(r)).toBe(true);
  });

  it('el primer día, sin historia, se mira solo si la exigencia es sostenible', () => {
    const suave = ritmoDe({
      carga: carga({ total: 10, resueltos: 0 }),
      limite: new Date('2026-09-30T00:00:00.000Z'),
      hoy: d('2026-09-23'),
      diasCorridos: 0,
    });
    expect(suave.estado).toBe('AJUSTADO'); // 2 al día, sostenible
    const bruto = ritmoDe({
      carga: carga({ total: 100, resueltos: 0 }),
      limite: new Date('2026-09-30T00:00:00.000Z'),
      hoy: d('2026-09-23'),
      diasCorridos: 0,
    });
    expect(bruto.estado).toBe('EN_RIESGO'); // 20 al día, no
  });

  it('nunca da pendientes negativos, aunque haya resuelto más de lo asignado', () => {
    const r = ritmoDe({
      carga: carga({ total: 10, resueltos: 12 }),
      limite: new Date('2026-09-30T00:00:00.000Z'),
      hoy: d('2026-09-23'),
      diasCorridos: 5,
    });
    expect(r.pendientes).toBe(0);
    expect(r.estado).toBe('TERMINADO');
  });

  it('AL_DIA y TERMINADO no piden refuerzo; VENCIDO sí', () => {
    const alDia = ritmoDe({
      carga: carga({ total: 50, resueltos: 40 }),
      limite: new Date('2026-09-30T00:00:00.000Z'),
      hoy: d('2026-09-23'),
      diasCorridos: 20,
    });
    expect(necesitaRefuerzo(alDia)).toBe(false);
    const vencido = ritmoDe({
      carga: carga(),
      limite: new Date('2026-09-01T00:00:00.000Z'),
      hoy: d('2026-09-23'),
      diasCorridos: 10,
    });
    expect(necesitaRefuerzo(vencido)).toBe(true);
  });
});

describe('antiguedadMedia', () => {
  it('sin nada pendiente no hay media que dar', () => {
    expect(antiguedadMedia([], d('2026-09-23'))).toBeNull();
  });

  it('promedia los días que llevan esperando', () => {
    const hoy = new Date('2026-09-23T00:00:00.000Z');
    const media = antiguedadMedia(
      [new Date('2026-09-13T00:00:00.000Z'), new Date('2026-09-03T00:00:00.000Z')],
      hoy,
    );
    expect(media).toBe(15);
  });

  it('una fecha futura no resta: cuenta como cero días esperando', () => {
    const hoy = new Date('2026-09-23T00:00:00.000Z');
    expect(
      antiguedadMedia([new Date('2026-09-30T00:00:00.000Z')], hoy),
    ).toBe(0);
  });

  it('da un decimal, que es lo que se lee en la tarjeta', () => {
    const hoy = new Date('2026-09-23T12:00:00.000Z');
    expect(antiguedadMedia([new Date('2026-09-22T00:00:00.000Z')], hoy)).toBe(1.5);
  });
});
