import {
  CARACTERIZACIONES_SEP,
  CARACTERIZACION_NINGUNA,
  GRUPOS_DE_CARACTERIZACION,
  GRUPO_DE_RESERVA,
  grupoDeCaracterizacion,
} from './catalogos-sep';

/// Lo que esto impide: que una caracterización se quede fuera de
/// la pantalla.
///
/// El catálogo se GENERA de un CSV del SEP. El día que ese CSV
/// traiga un valor nuevo, nadie se va a acordar de meterlo en un
/// grupo — y un valor que no sale en pantalla es un valor que no
/// se puede marcar, con la persona delante diciendo que le
/// aplica. El agrupamiento es de pantalla y no toca el cargue,
/// pero perder una opción sí se nota en la vida de alguien.

describe('los grupos cubren el catálogo entero', () => {
  it('cada caracterización cae en un grupo, y «Ninguna» en ninguno', () => {
    for (const c of CARACTERIZACIONES_SEP) {
      const g = grupoDeCaracterizacion(c.id);
      if (c.id === CARACTERIZACION_NINGUNA) {
        expect(g).toBeNull();
      } else {
        expect(g).not.toBeNull();
      }
    }
  });

  it('no se pierde ninguna: agrupadas + «Ninguna» son las 54', () => {
    const enGrupos = CARACTERIZACIONES_SEP.filter(
      (c) => grupoDeCaracterizacion(c.id) !== null,
    );
    expect(enGrupos.length + 1).toBe(CARACTERIZACIONES_SEP.length);
  });

  it('un valor que el SEP añada mañana cae en el cajón, no al vacío', () => {
    // 9999 no existe en el catálogo: hace de valor nuevo
    expect(grupoDeCaracterizacion(9999)).toBe(GRUPO_DE_RESERVA);
  });

  it('el cajón de reserva es un grupo de verdad', () => {
    expect(GRUPOS_DE_CARACTERIZACION.map((g) => g.clave)).toContain(GRUPO_DE_RESERVA);
  });
});

describe('los grupos no se pisan ni inventan', () => {
  it('ninguna caracterización está en dos grupos', () => {
    const vistos = new Set<number>();
    for (const g of GRUPOS_DE_CARACTERIZACION) {
      for (const id of g.ids) {
        expect(vistos.has(id)).toBe(false);
        vistos.add(id);
      }
    }
  });

  it('ningún grupo cita un id que no exista en el catálogo', () => {
    const reales = new Set(CARACTERIZACIONES_SEP.map((c) => c.id));
    for (const g of GRUPOS_DE_CARACTERIZACION) {
      for (const id of g.ids) expect(reales.has(id)).toBe(true);
    }
  });

  it('«Ninguna» no está metida en ningún grupo', () => {
    for (const g of GRUPOS_DE_CARACTERIZACION) {
      expect(g.ids).not.toContain(CARACTERIZACION_NINGUNA);
    }
  });

  it('todos los grupos tienen al menos una opción', () => {
    for (const g of GRUPOS_DE_CARACTERIZACION) expect(g.ids.length).toBeGreaterThan(0);
  });
});
