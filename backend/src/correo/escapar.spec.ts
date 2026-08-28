import { escaparHtml } from './escapar';

/// Lo que cuida esto: que nada de lo que escriba una persona
/// —ni lo que venga de la base— se lea como marcado dentro de
/// un correo.

describe('el escapado de HTML', () => {
  it('el ampersand va primero, o se escapa dos veces', () => {
    // al revés, «<» se vuelve «&lt;» y ese «&» se vuelve
    // «&amp;lt;»: el destinatario lee «&lt;» en vez de «<»
    expect(escaparHtml('<')).toBe('&lt;');
    expect(escaparHtml('&')).toBe('&amp;');
    expect(escaparHtml('&lt;')).toBe('&amp;lt;');
  });

  it('los cinco caracteres que importan', () => {
    expect(escaparHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('una razón social con ampersand sale legible', () => {
    // «Gómez & Hijos S.A.S.» es un nombre de empresa normal en
    // Colombia y tiene que leerse tal cual en el correo
    expect(escaparHtml('Gómez & Hijos S.A.S.')).toBe(
      'Gómez &amp; Hijos S.A.S.',
    );
  });

  it('una dirección de correo con marcado deja de ser marcado', () => {
    // esto pasa la validación de direcciones del sistema, que
    // solo prohíbe la arroba y los espacios
    const suelta = 'a<img/src=x>@b.co';
    const escapada = escaparHtml(suelta);
    expect(escapada).not.toContain('<img');
    expect(escapada).toContain('&lt;img');
  });

  it('no toca el texto normal', () => {
    const normal = 'Estimada Sra. Caro: su curso arranca el 7 de septiembre.';
    expect(escaparHtml(normal)).toBe(normal);
  });

  it('deja las tildes y las eñes en paz', () => {
    // escapar acentos llenaría el correo de &aacute; y no
    // protege de nada
    expect(escaparHtml('Peña, Bogotá, capacitación')).toBe(
      'Peña, Bogotá, capacitación',
    );
  });

  it('los emojis pasan enteros', () => {
    // las plantillas del cliente los usan y un escapado que
    // los parta deja el correo con basura
    expect(escaparHtml('📌 Recuerde')).toBe('📌 Recuerde');
  });
});
