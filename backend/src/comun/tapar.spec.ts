import { taparDocumento } from './tapar';

/// Un log con cédulas es una filtración: el stdout del
/// contenedor se copia a un agregador y ahí se queda sin las
/// protecciones que sí tiene la base.

describe('tapar un documento para el log', () => {
  it('deja las puntas y tapa el medio', () => {
    // quien está mirando una ficha reconoce la suya; quien lee
    // el log a secas no se lleva ninguna
    expect(taparDocumento('1010316499')).toBe('10******99');
  });

  it('no deja ni un dígito del medio a la vista', () => {
    expect(taparDocumento('1010316499')).not.toContain('031');
  });

  it('conserva el largo, que a veces es lo que se depura', () => {
    expect(taparDocumento('1010316499')).toHaveLength(10);
  });

  it('un documento corto se tapa entero', () => {
    // dejar cuatro de seis es dejarlo casi completo
    expect(taparDocumento('12345')).toBe('*****');
  });

  it('vacío lo dice, no devuelve asteriscos sueltos', () => {
    expect(taparDocumento('')).toBe('(sin documento)');
    expect(taparDocumento(null)).toBe('(sin documento)');
    expect(taparDocumento(undefined)).toBe('(sin documento)');
  });

  it('los espacios de los lados no cuentan', () => {
    expect(taparDocumento('  1010316499  ')).toBe('10******99');
  });
});
