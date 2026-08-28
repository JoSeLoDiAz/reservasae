/** El 5433 es producción, diga lo que diga el host. */

/**
 * El candado existe porque una base local y el túnel a
 * producción son indistinguibles desde la cadena: las dos son
 * `reservasae` en `localhost:5433`. Lo que los separa es el
 * puerto, y por eso la regla es de puerto y no de nombre.
 */

import { destinoDeLaBase } from '../../prisma/guardia-de-base';

const PROD = 'postgresql://reservasae:x@localhost:5433/reservasae?schema=public';
const PRUEBAS = 'postgresql://reservasae_prueba:x@127.0.0.1:5434/reservasae_prueba';
const PROPIA = 'postgresql://reservasae:x@localhost:5544/reservasae';

describe('el túnel disfrazado de local', () => {
  it('«localhost:5433» se reconoce como PRODUCCIÓN', () => {
    /// Es la trampa entera: el texto dice localhost y detrás hay
    /// un `ssh -L 5433:127.0.0.1:5433 sep-vm`.
    const d = destinoDeLaBase({ DATABASE_URL: PROD });

    expect(d.esProduccion).toBe(true);
    expect(d.rechazo).not.toBeNull();
  });

  it('«127.0.0.1:5433» también: el host no salva', () => {
    const d = destinoDeLaBase({
      DATABASE_URL: 'postgresql://u:p@127.0.0.1:5433/reservasae',
    });
    expect(d.esProduccion).toBe(true);
  });

  it('y con OTRO nombre de base en el 5433, igual', () => {
    /// La regla NO es el nombre. Si lo fuera, bastaría con
    /// renombrar la base para saltársela sin querer.
    const d = destinoDeLaBase({
      DATABASE_URL: 'postgresql://u:p@localhost:5433/lo_que_sea',
    });
    expect(d.esProduccion).toBe(true);
  });
});

describe('lo que sí se puede tocar', () => {
  it('la de pruebas, en el 5434, pasa', () => {
    expect(destinoDeLaBase({ DATABASE_URL: PRUEBAS })).toMatchObject({
      esProduccion: false,
      rechazo: null,
    });
  });

  it('una base propia en cualquier otro puerto, también', () => {
    expect(destinoDeLaBase({ DATABASE_URL: PROPIA }).rechazo).toBeNull();
  });

  it('el 5432 de un Postgres normal pasa', () => {
    expect(
      destinoDeLaBase({ DATABASE_URL: 'postgresql://u:p@localhost:5432/reservasae' })
        .rechazo,
    ).toBeNull();
  });
});

describe('la salida de emergencia existe, pero hay que pedirla', () => {
  it('con PERMITIR_PRODUCCION=si se deja, y lo sigue diciendo', () => {
    /// Alguna vez hay que corregir producción a mano. Lo que no
    /// puede es pasar por descuido.
    const d = destinoDeLaBase({ DATABASE_URL: PROD, PERMITIR_PRODUCCION: 'si' });

    expect(d.rechazo).toBeNull();
    expect(d.esProduccion).toBe(true);
  });

  it('cualquier otro valor NO vale', () => {
    for (const v of ['1', 'true', 'SI', 'sí', 'yes', '']) {
      expect(destinoDeLaBase({ DATABASE_URL: PROD, PERMITIR_PRODUCCION: v }).rechazo)
        .not.toBeNull();
    }
  });
});

describe('sin DATABASE_URL no se adivina', () => {
  it('se para y dice qué hacer', () => {
    const d = destinoDeLaBase({});
    expect(d.rechazo).toMatch(/\.env\.example/);
    expect(d.esProduccion).toBe(false);
  });

  it('una cadena rota no pasa por buena', () => {
    /// Sin puerto legible no se puede afirmar que NO es
    /// producción, pero tampoco hay que inventarse que lo es:
    /// se deja pasar y el fallo lo dará la conexión.
    expect(destinoDeLaBase({ DATABASE_URL: 'no-es-una-url' }).etiqueta).toContain('?');
  });
});

describe('el mensaje sirve para actuar', () => {
  it('nombra las dos salidas: base propia y túnel de pruebas', () => {
    const m = destinoDeLaBase({ DATABASE_URL: PROD }).rechazo ?? '';
    expect(m).toMatch(/tunel-pruebas/);
    expect(m).toMatch(/5434/);
    expect(m).toMatch(/PERMITIR_PRODUCCION=si/);
  });
});
