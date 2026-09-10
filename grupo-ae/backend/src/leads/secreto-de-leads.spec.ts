/** La llave del webhook, que es la única puerta sin sesión. */

import { claveCorrecta, exigirSecretoDeLeads } from './secreto-de-leads';

const BUENA = 'a'.repeat(48);

describe('sin llave configurada no pasa NADIE', () => {
  it('ni siquiera mandando la cadena vacía', () => {
    /// Es el caso que importa: si al faltar la variable la ruta
    /// quedara abierta, tendríamos un control en pie y vacío de
    /// efecto — la ruta parecería protegida y no lo estaría.
    expect(claveCorrecta('', {})).toBe(false);
    expect(claveCorrecta(undefined, {})).toBe(false);
    expect(claveCorrecta('lo que sea', {})).toBe(false);
  });

  it('una llave demasiado corta NO habilita la puerta', () => {
    /// Con una llave de tres letras, acertarla es cuestión de
    /// minutos: vale lo mismo que no tenerla.
    const corta = { LEADS_WEBHOOK_SECRET: 'abc' };
    expect(claveCorrecta('abc', corta)).toBe(false);
  });
});

describe('con llave configurada', () => {
  const env = { LEADS_WEBHOOK_SECRET: BUENA };

  it('la buena pasa', () => {
    expect(claveCorrecta(BUENA, env)).toBe(true);
  });

  it('una distinta del mismo largo, no', () => {
    expect(claveCorrecta('b'.repeat(48), env)).toBe(false);
  });

  it('un prefijo correcto no cuela', () => {
    /// Lo que impide medir letra a letra: acertar las primeras
    /// no acerca a nada.
    expect(claveCorrecta('a'.repeat(47), env)).toBe(false);
    expect(claveCorrecta('a'.repeat(49), env)).toBe(false);
  });

  it('sin cabecera, no', () => {
    expect(claveCorrecta(undefined, env)).toBe(false);
  });
});

describe('el arranque', () => {
  it('se planta sin la variable', () => {
    expect(() => exigirSecretoDeLeads({})).toThrow(/LEADS_WEBHOOK_SECRET/);
  });

  it('se planta con una corta, y dice el mínimo', () => {
    expect(() => exigirSecretoDeLeads({ LEADS_WEBHOOK_SECRET: 'abc' })).toThrow(
      /32/,
    );
  });

  it('y dice cómo generar una', () => {
    expect(() => exigirSecretoDeLeads({})).toThrow(/randomBytes/);
  });

  it('con una buena, arranca', () => {
    expect(() =>
      exigirSecretoDeLeads({ LEADS_WEBHOOK_SECRET: BUENA }),
    ).not.toThrow();
  });
});
