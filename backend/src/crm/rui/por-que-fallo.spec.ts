import { porQueFallo } from './por-que-fallo';

/// Los textos son los de VERDAD: salen de `consultas_rui` de
/// produccion el 13 sep 2026, cuando el portal del DNP estaba
/// en mantenimiento.
const EL_DEL_13_DE_SEPTIEMBRE =
  "locator.click: Timeout 30000ms exceeded.\nCall log:\n  - waiting for getByText('Consulta RUI').first()\n    - locator resolved to <a href=\"#\" role=\"listitem\" class=\"nav-link nav-link-";

describe('por que fallo la consulta', () => {
  it('sin error no dice nada', () => {
    expect(porQueFallo(null)).toBeNull();
    expect(porQueFallo('')).toBeNull();
  });

  it('el timeout del portal se explica como mantenimiento', () => {
    expect(porQueFallo(EL_DEL_13_DE_SEPTIEMBRE)).toMatch(/portal del DNP/);
    expect(porQueFallo(EL_DEL_13_DE_SEPTIEMBRE)).toMatch(/más tarde/);
  });

  it('una caida de red tambien es del portal', () => {
    expect(porQueFallo('net::ERR_CONNECTION_REFUSED at https://...')).toMatch(
      /portal del DNP/,
    );
  });

  /// No se le puede decir «vuelva mas tarde» a quien tiene el
  /// servidor mal montado: eso no se arregla esperando.
  it('sin navegador se dice que es cosa nuestra', () => {
    expect(
      porQueFallo("Failed to launch browser: executable doesn't exist at /usr/bin/chromium"),
    ).toMatch(/soporte/);
  });

  /// Un «browser closed» POR timeout sigue siendo del portal.
  it('el navegador cerrado por un timeout no culpa al servidor', () => {
    expect(porQueFallo('Target page, context or browser has been closed. Timeout 30000ms')).toMatch(
      /portal del DNP/,
    );
  });

  it('lo que no se reconoce no se inventa', () => {
    expect(porQueFallo('algo rarisimo que nadie previo')).toMatch(/no sabemos por qué/);
  });
});
