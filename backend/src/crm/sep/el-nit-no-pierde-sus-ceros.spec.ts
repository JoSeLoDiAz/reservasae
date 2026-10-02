/** El NIT llega al SENA con sus ceros de la izquierda. */

/**
 * EXCEL SE COME LOS CEROS, y eso no da un error: da un cargue contra
 * otra organización.
 *
 * La regla existía para el documento de la persona ---`documentoParaExcel`
 * excluía expresamente lo que empieza por cero--- pero el NIT iba con un
 * `Number()` a secas en los TRES formatos: cargue, uso directo y F7.
 *
 * Y `normalizarNit` admite perfectamente un NIT que empiece por cero
 * (`/^\d{5,15}$/`), así que el caso es alcanzable: basta con que alguien
 * lo teclee así en la plantilla de empresas.
 *
 * Lo encontró una auditoría del 2 oct 2026. El F7 además se arma
 * concatenando celdas, así que ahí el error no se ve: sale un cargue
 * contra el NIT equivocado y rebota en el SENA, no en casa.
 */

import { identificadorParaExcel } from './numero-para-excel';

describe('qué va como número y qué como texto', () => {
  it('un NIT normal va como número: el SENA lo cruza contra el suyo', () => {
    expect(identificadorParaExcel('900421154')).toBe(900421154);
  });

  /**
   * EL CASO QUE SE PERDÍA. Con `Number()` esto daba 900421154, que es
   * otra organización o ninguna.
   */
  it('pero si empieza por cero va como texto', () => {
    expect(identificadorParaExcel('0900421154')).toBe('0900421154');
    expect(Number('0900421154')).toBe(900421154);
  });

  it('y un pasaporte, con sus letras, también va como texto', () => {
    expect(identificadorParaExcel('AX1234567')).toBe('AX1234567');
  });

  /**
   * Y POR ENCIMA DE 15 DÍGITOS TAMBIÉN: ahí el último dígito empieza a
   * redondearse en silencio, que es la peor forma de perderlo.
   */
  it('ni más de quince dígitos', () => {
    const largo = '12345678901234567';
    expect(identificadorParaExcel(largo)).toBe(largo);
  });
});

describe('los tres formatos lo usan', () => {
  const leer = (f: string) =>
    require('fs').readFileSync(
      require('path').join(__dirname, f),
      'utf8',
    ) as string;

  it('el cargue, para el NIT y para el documento', () => {
    const t = leer('formato-cargue-sep.ts');
    expect(t).toContain('identificadorParaExcel(p.empresa.nit)');
    expect(t).toContain('const documentoParaExcel = identificadorParaExcel;');
    expect(t).not.toContain('Number(p.empresa.nit)');
  });

  it('el de uso directo', () => {
    const t = leer('formato-uso-directo.ts');
    expect(t).toContain('identificadorParaExcel(p.empresa.nit)');
    expect(t).not.toContain('Number(p.empresa.nit)');
  });

  it('y el F7', () => {
    const t = leer('formato-f7.ts');
    expect(t).toContain('identificadorParaExcel(e.nit)');
    expect(t).not.toContain('nit: Number(e.nit)');
    /// Y su tipo declarado admite los dos, o no compilaría.
    expect(t).toContain('nit: string | number;');
  });
});
