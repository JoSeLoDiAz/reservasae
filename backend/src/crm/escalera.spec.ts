/** Las dos reglas de la escalera de etapas. */

import {
  exigeCompuertaDeMatricula,
  motivoDeTransicionImposible,
} from './escalera';

describe('entrar al aula pasa por la compuerta, se llame como se llame', () => {
  it('INTERESADO → EN_FORMACION la exige', () => {
    /// El agujero: la compuerta estaba colgada de la palabra
    /// INSCRITO, así que saltándose esa etapa se entraba al
    /// aula sin datos y sin autorización.
    expect(exigeCompuertaDeMatricula('INTERESADO', 'EN_FORMACION')).toBe(true);
  });

  it('INTERESADO → INSCRITO la exige, como siempre', () => {
    expect(exigeCompuertaDeMatricula('INTERESADO', 'INSCRITO')).toBe(true);
  });

  it('CONTACTADO → EN_FORMACION la exige', () => {
    expect(exigeCompuertaDeMatricula('CONTACTADO', 'EN_FORMACION')).toBe(true);
  });

  it('quien vuelve al aula NO la vuelve a pasar', () => {
    /// Volver a pedir cupo bloquearía el regreso a un grupo
    /// lleno, que es justo cuando se hace un regreso.
    expect(exigeCompuertaDeMatricula('RETIRADO', 'EN_FORMACION')).toBe(false);
    expect(exigeCompuertaDeMatricula('ABANDONO', 'EN_FORMACION')).toBe(false);
  });

  it('las etapas que no son el aula no la piden', () => {
    expect(exigeCompuertaDeMatricula('INTERESADO', 'CONTACTADO')).toBe(false);
    expect(exigeCompuertaDeMatricula('EN_FORMACION', 'RETIRADO')).toBe(false);
    expect(exigeCompuertaDeMatricula('CONTACTADO', 'PERDIDO')).toBe(false);
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
