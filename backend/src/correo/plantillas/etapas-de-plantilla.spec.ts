import { enPalabras, porQueNo, TODAS_LAS_ETAPAS } from './etapas-de-plantilla';

/// Lo que cuida esto: que no salga una «confirmación de
/// inscripción» a quien todavía no está inscrito. Ese correo
/// no se recoge, y la persona se queda esperando un cupo que
/// nadie le dio.

describe('cuándo se puede mandar una plantilla', () => {
  it('sin etapas puestas, sirve para cualquiera', () => {
    // es como se comportaban todas antes de que esto
    // existiera: las ya escritas no cambian
    expect(porQueNo([], 'INTERESADO')).toBeNull();
    expect(porQueNo([], null)).toBeNull();
  });

  it('si la etapa coincide, pasa', () => {
    expect(porQueNo(['INSCRITO'], 'INSCRITO')).toBeNull();
  });

  it('si coincide con una de varias, pasa', () => {
    expect(porQueNo(['INSCRITO', 'EN_FORMACION'], 'EN_FORMACION')).toBeNull();
  });

  it('si no coincide, dice las DOS cosas: dónde está y dónde debería', () => {
    const no = porQueNo(['INSCRITO'], 'INTERESADO');
    // sin las dos, quien lo lee no sabe qué corregir
    expect(no).toContain('interesado');
    expect(no).toContain('inscrito');
  });

  it('una ficha sin etapa tampoco pasa si la plantilla exige una', () => {
    expect(porQueNo(['INSCRITO'], null)).toContain('no tiene etapa');
  });
});

describe('las etapas se dicen en cristiano', () => {
  it('DATOS_COMPLETOS no se le enseña así a nadie', () => {
    expect(enPalabras('DATOS_COMPLETOS')).toBe('con datos completos');
  });

  it('EN_FORMACION tampoco', () => {
    expect(enPalabras('EN_FORMACION')).toBe('en formación');
  });

  it('una que no esté en la tabla sale en minúscula, no en bruto', () => {
    expect(enPalabras('LO_QUE_SEA')).toBe('lo_que_sea');
  });
});

describe('las etapas de salida también cuentan', () => {
  it('se le puede escribir a quien NO quedó', () => {
    // el primer intento las dejó fuera y eso hacía que el
    // sistema solo supiera felicitar: no había forma de
    // mandar «no quedó seleccionado esta vez»
    expect(porQueNo(['PERDIDO'], 'PERDIDO')).toBeNull();
    expect(porQueNo(['NO_APROBO'], 'NO_APROBO')).toBeNull();
    expect(porQueNo(['DESERTO', 'ABANDONO'], 'ABANDONO')).toBeNull();
  });

  it('y una plantilla de «no quedó» NO le sale a quien sí quedó', () => {
    const no = porQueNo(['PERDIDO'], 'INSCRITO');
    expect(no).toContain('inscrito');
    expect(no).toContain('perdido');
  });

  it('las once tienen nombre en cristiano', () => {
    for (const e of TODAS_LAS_ETAPAS) {
      // sin esto, el aviso diría «esta plantilla es para quien
      // esté NO_APROBO», que no lo escribe nadie
      expect(enPalabras(e)).not.toContain('_');
      expect(enPalabras(e)).not.toBe(e);
    }
  });
});
