import { escaparHtml } from '../escapar';
import { reescribirEnlaces } from './enlaces-medidos';

/// Lo que cuida esto: que el enlace del correo LLEVE a donde
/// dice que lleva. Un clic mal contado es un número feo en un
/// informe; un enlace roto es una persona que no llegó.

const BASE = 'https://prueba.reservasae.com';
const rehacer = (texto: string) =>
  reescribirEnlaces(escaparHtml(texto), BASE, 'camp1', 'dest1');

/// Lo que de verdad importa: a dónde va a parar la persona
/// después de que el servidor la reenvíe.
function destinoFinal(html: string): string {
  const m = /\?a=([^"]+)"/.exec(html);
  return m ? decodeURIComponent(m[1]) : '';
}

describe('a dónde lleva de verdad el enlace', () => {
  it('una URL simple llega entera', () => {
    expect(destinoFinal(rehacer('Vea https://sena.edu.co aquí'))).toBe(
      'https://sena.edu.co',
    );
  });

  it('una URL CON PARÁMETROS llega entera', () => {
    // este es el fallo que había: el «&» ya venía escapado a
    // «&amp;» y viajaba así dentro del destino, de modo que la
    // persona aterrizaba en una dirección corrupta
    const url = 'https://x.co/f?utm_source=correo&utm_medium=campana';
    expect(destinoFinal(rehacer(`Inscríbase en ${url}`))).toBe(url);
  });

  it('con tres parámetros, los tres', () => {
    const url = 'https://x.co/?a=1&b=2&c=3';
    expect(destinoFinal(rehacer(url))).toBe(url);
  });

  it('el «&amp;» no se cuela en el destino', () => {
    const html = rehacer('https://x.co/?a=1&b=2');
    expect(destinoFinal(html)).not.toContain('&amp;');
  });
});

describe('lo que la persona LEE no cambia', () => {
  it('el texto visible sigue siendo la dirección de verdad', () => {
    // si en el correo pone una dirección y al pasar el ratón
    // sale otra distinta, eso es lo que hace un correo de
    // phishing. Lo que cambia es a dónde lleva, no lo que se
    // lee.
    const html = rehacer('Entre a https://sena.edu.co');
    expect(html).toContain('>https://sena.edu.co</a>');
  });
});

describe('lo que NO se toca', () => {
  it('un texto sin enlaces sale igual', () => {
    const t = escaparHtml('Buen día, su curso arranca el lunes.');
    expect(reescribirEnlaces(t, BASE, 'c', 'd')).toBe(t);
  });

  it('no se inventa un enlace donde solo hay un dominio suelto', () => {
    // «escríbanos a grupo-ae.com.co» no es un enlace
    const html = rehacer('Escríbanos a grupo-ae.com.co');
    expect(html).not.toContain('<a href');
  });

  it('el marcado que alguien intente meter ya viene neutralizado', () => {
    const html = rehacer('<script>alert(1)</script> https://x.co');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    // y el enlace de verdad sigue funcionando
    expect(destinoFinal(html)).toBe('https://x.co');
  });
});

describe('dos enlaces en el mismo correo', () => {
  it('cada uno lleva a lo suyo', () => {
    const html = rehacer('Uno https://a.co/?x=1&y=2 y otro https://b.co');
    const todos = [...html.matchAll(/\?a=([^"]+)"/g)].map((m) =>
      decodeURIComponent(m[1]),
    );
    expect(todos).toEqual(['https://a.co/?x=1&y=2', 'https://b.co']);
  });
});
