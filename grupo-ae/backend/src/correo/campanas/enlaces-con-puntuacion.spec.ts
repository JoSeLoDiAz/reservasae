import { escaparHtml } from '../escapar';
import { destinoPermitido, enlacesDe, partir, reescribirEnlaces } from './enlaces-medidos';

/// El defecto que encontró José en Convoca y estaba igual aquí: la
/// puntuación de la frase se colaba dentro del enlace y el clic
/// llevaba a una dirección que no existe.

const BASE = 'https://prueba.reservasae.com';
const rehacer = (texto: string) =>
  reescribirEnlaces(escaparHtml(texto), BASE, 'camp1', 'dest1');
function destinoFinal(html: string): string {
  const m = /\?a=([^"]+)"/.exec(html);
  return m ? decodeURIComponent(m[1]) : '';
}

describe('la puntuación de la frase no es parte del enlace', () => {
  it.each([
    ['Visite https://grupo-ae.com.co/formulario.', 'https://grupo-ae.com.co/formulario'],
    ['En https://grupo-ae.com.co/a, o llame.', 'https://grupo-ae.com.co/a'],
    ['¿Ya vio https://grupo-ae.com.co/b?', 'https://grupo-ae.com.co/b'],
    ['(ver https://grupo-ae.com.co/c)', 'https://grupo-ae.com.co/c'],
    ['Aquí: https://grupo-ae.com.co/d:', 'https://grupo-ae.com.co/d'],
  ])('«%s» lleva a %s', (frase, esperado) => {
    expect(destinoFinal(rehacer(frase))).toBe(esperado);
  });

  it('la puntuación se queda en el texto, después del enlace', () => {
    const html = rehacer('Visite https://grupo-ae.com.co/formulario.');
    expect(html).toMatch(/<\/a>\.$/);
  });

  it('un paréntesis que la propia URL abrió se respeta', () => {
    expect(partir('https://es.wikipedia.org/wiki/Google_(empresa)').enlace).toBe(
      'https://es.wikipedia.org/wiki/Google_(empresa)',
    );
  });

  it('una URL sin puntuación final no cambia', () => {
    expect(partir('https://grupo-ae.com.co/x?y=1')).toEqual({
      enlace: 'https://grupo-ae.com.co/x?y=1',
      cola: '',
    });
  });

  it('el destino recortado SIGUE siendo un destino permitido de la campaña', () => {
    /// Si solo se recortara al reescribir y no al listar, el clic se
    /// rechazaría. Por eso los dos pasan por `partir`.
    const texto = 'Visite https://grupo-ae.com.co/formulario.';
    const destino = destinoFinal(rehacer(texto));
    expect(enlacesDe(texto)).toContain(destino);
    expect(destinoPermitido(texto, destino)).toBe(destino);
  });
});
