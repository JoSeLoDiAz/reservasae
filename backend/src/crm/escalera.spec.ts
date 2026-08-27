/** Las dos reglas de la escalera de etapas. */

import {
  exigeCupo,
  exigeDatosParaElAula,
  motivoDeTransicionImposible,
} from './escalera';

describe('los datos y la autorización se piden SIEMPRE al entrar al aula', () => {
  it('INTERESADO → EN_FORMACION los exige', () => {
    /// El agujero original: la compuerta estaba colgada de la
    /// palabra INSCRITO, así que saltándose esa etapa se
    /// entraba al aula sin datos y sin autorización.
    expect(exigeDatosParaElAula('INTERESADO', 'EN_FORMACION')).toBe(true);
  });

  it('INTERESADO → INSCRITO, como siempre', () => {
    expect(exigeDatosParaElAula('INTERESADO', 'INSCRITO')).toBe(true);
  });

  it('CONTACTADO → EN_FORMACION', () => {
    expect(exigeDatosParaElAula('CONTACTADO', 'EN_FORMACION')).toBe(true);
  });

  it('quien VUELVE también los pasa: la autorización se revoca', () => {
    /// Este es el defecto que trajo el primer arreglo. Eximir a
    /// quien volvía dejó `INSCRITO` más débil que antes:
    /// revocando la autorización y pasando de RETIRADO a
    /// INSCRITO se volvía a matricular a quien había pedido que
    /// no se usaran sus datos.
    expect(exigeDatosParaElAula('RETIRADO', 'INSCRITO')).toBe(true);
    expect(exigeDatosParaElAula('RETIRADO', 'EN_FORMACION')).toBe(true);
    expect(exigeDatosParaElAula('ABANDONO', 'EN_FORMACION')).toBe(true);
    expect(exigeDatosParaElAula('CERTIFICADO', 'INSCRITO')).toBe(true);
  });

  it('las etapas que no son el aula no los piden', () => {
    expect(exigeDatosParaElAula('INTERESADO', 'CONTACTADO')).toBe(false);
    expect(exigeDatosParaElAula('EN_FORMACION', 'RETIRADO')).toBe(false);
    expect(exigeDatosParaElAula('CONTACTADO', 'PERDIDO')).toBe(false);
  });
});

describe('el cupo solo se pide a quien viene de fuera', () => {
  it('de fuera del aula, sí', () => {
    expect(exigeCupo('INTERESADO', 'INSCRITO')).toBe(true);
    expect(exigeCupo('CONTACTADO', 'EN_FORMACION')).toBe(true);
  });

  it('quien vuelve NO lo vuelve a consumir', () => {
    /// El cupo se consume una vez, y volver a exigirlo cerraría
    /// el regreso a un grupo lleno — que es justo cuando se
    /// hace un regreso.
    expect(exigeCupo('RETIRADO', 'EN_FORMACION')).toBe(false);
    expect(exigeCupo('ABANDONO', 'INSCRITO')).toBe(false);
  });

  it('salirse no consume cupo', () => {
    expect(exigeCupo('EN_FORMACION', 'RETIRADO')).toBe(false);
    expect(exigeCupo('INTERESADO', 'PERDIDO')).toBe(false);
  });
});

describe('no se cierra una formación que no ocurrió', () => {
  it('RETIRADO → CERTIFICADO no, y dice cómo hacerlo bien', () => {
    const m = motivoDeTransicionImposible('RETIRADO', 'CERTIFICADO');
    expect(m).toMatch(/En formación/);
  });

  it('las cuatro salidas del aula, igual', () => {
    for (const salida of ['RETIRADO', 'DESERTO', 'ABANDONO', 'NO_APROBO'] as const) {
      expect(motivoDeTransicionImposible(salida, 'CERTIFICADO')).not.toBeNull();
    }
  });

  it('INTERESADO → CERTIFICADO tampoco', () => {
    const m = motivoDeTransicionImposible('INTERESADO', 'CERTIFICADO');
    expect(m).toMatch(/matricula/i);
  });

  it('NO_APROBO desde fuera del aula tampoco', () => {
    /// No se puede reprobar un curso al que nadie fue.
    expect(motivoDeTransicionImposible('CONTACTADO', 'NO_APROBO')).not.toBeNull();
  });

  it('desde EN_FORMACION sí, que es el camino normal', () => {
    expect(motivoDeTransicionImposible('EN_FORMACION', 'CERTIFICADO')).toBeNull();
    expect(motivoDeTransicionImposible('EN_FORMACION', 'NO_APROBO')).toBeNull();
  });

  it('desde INSCRITO sí: hay grupos sin fechas', () => {
    /// Sin fechas nadie pasa solo a EN_FORMACION, así que
    /// exigirlo dejaría sin certificar a quien sí cursó.
    expect(motivoDeTransicionImposible('INSCRITO', 'CERTIFICADO')).toBeNull();
  });

  it('salirse del aula siempre se puede', () => {
    expect(motivoDeTransicionImposible('EN_FORMACION', 'RETIRADO')).toBeNull();
    expect(motivoDeTransicionImposible('INTERESADO', 'PERDIDO')).toBeNull();
  });
});
