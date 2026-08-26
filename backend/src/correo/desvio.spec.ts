/// El desvío es lo que impide que una demostración le
/// escriba a una persona real, así que se fija aquí.

import { desvioConfigurado, etiquetaDeReales, resolverDestino } from './desvio';

const REAL = ['persona@empresa.com'];
const NUESTRO = 'josediazd40z@gmail.com, dianihernandez07@gmail.com';

describe('desvío del correo', () => {
  it('sin desvío y fuera de pruebas, va a su destinatario', () => {
    const d = resolverDestino(REAL, {});
    expect(d).toEqual({ para: REAL, reales: null });
  });

  it('con desvío, nadie de fuera lo recibe', () => {
    const d = resolverDestino(REAL, { CORREO_REDIRIGIR_A: NUESTRO });
    expect('rechazo' in d).toBe(false);
    if ('rechazo' in d) return;
    expect(d.para).toEqual([
      'josediazd40z@gmail.com',
      'dianihernandez07@gmail.com',
    ]);
    expect(d.para).not.toContain(REAL[0]);
    expect(d.reales).toEqual(REAL);
  });

  it('en pruebas sin desvío no se manda nada', () => {
    const d = resolverDestino(REAL, { ENTORNO: 'prueba' });
    expect('rechazo' in d).toBe(true);
  });

  it('el desvío manda también en pruebas', () => {
    const d = resolverDestino(REAL, {
      ENTORNO: 'prueba',
      CORREO_REDIRIGIR_A: NUESTRO,
    });
    expect('rechazo' in d).toBe(false);
  });

  it('una lista con espacios y comas de más no cuela vacíos', () => {
    expect(desvioConfigurado({ CORREO_REDIRIGIR_A: ' a@b.com , , c@d.com ' }))
      .toEqual(['a@b.com', 'c@d.com']);
    expect(desvioConfigurado({ CORREO_REDIRIGIR_A: '  ,  ' })).toEqual([]);
  });

  it('la etiqueta dice cuántos más iban', () => {
    expect(etiquetaDeReales(['a@b.com'])).toBe('a@b.com');
    expect(etiquetaDeReales(['a@b.com', 'c@d.com'])).toBe('a@b.com +1');
  });
});
