/** La carta: lo que no puede cambiar sin que alguien lo decida. */

/**
 * Un correo no se puede mirar antes de mandarlo: lo pinta el
 * cliente de otra persona, meses después, con las imágenes
 * apagadas o el modo oscuro puesto. Por eso las reglas que
 * costaron caro van fijadas aquí.
 */

import { cartaHtml, type MarcaDeLaCarta } from './carta';
import { bloquesDe } from './formato';

const MARCA: MarcaDeLaCarta = {
  colores: {
    marca: '#315a00',
    encabezadoFondo: '#193002',
    encabezadoTexto: '#ffffff',
    texto: '#1c1720',
    textoSuave: '#5d5364',
    superficie: '#ffffff',
    fondo: '#f6f3f7',
    borde: '#e2dce6',
  },
  logos: [
    { url: 'https://x.co/api/marca/logos/a?v=1', alt: 'Grupo AE' },
    { url: 'https://x.co/api/marca/logos/b?v=2', alt: 'ADECOPRIA' },
  ],
  gremio: 'ADECOPRIA',
  correoDeContacto: 'proyectosena@grupo-ae.com.co',
  porQueLoRecibe: 'Recibe este correo porque se registró.',
};

const carta = (cuerpo: string, extra: Partial<Parameters<typeof cartaHtml>[0]> = {}) =>
  cartaHtml({
    asunto: 'Su inscripción',
    bloques: bloquesDe(cuerpo),
    marca: MARCA,
    ...extra,
  });

describe('la cabecera', () => {
  it('lleva los logos del gremio, uno por logo y con su alt', () => {
    const html = carta('Hola.');

    expect(html).toContain('https://x.co/api/marca/logos/a?v=1');
    expect(html).toContain('alt="Grupo AE"');
    expect(html).toContain('alt="ADECOPRIA"');
  });

  it('los pone sobre PLACA BLANCA, y el modo oscuro no se la lleva', () => {
    /// Los logos están hechos para papel: el de ADECOPRIA
    /// lleva su texto en negro. Gmail en modo oscuro invierte
    /// el correo y no hay forma de impedírselo; sí de que no
    /// se lleve por delante lo único que no puede perder.
    const html = carta('Hola.');

    expect(html).toContain('bgcolor="#ffffff"');
    expect(html).toContain('.placa{background:#ffffff!important}');
  });

  it('si hay cabezote, MANDA el cabezote y no salen los logos', () => {
    /// Alguien subió esa imagen a propósito. Pintar las dos
    /// cosas serían los mismos logos dos veces.
    const html = carta('Hola.', { cabezote: 'https://x.co/api/p/1/banner?v=3' });

    expect(html).toContain('https://x.co/api/p/1/banner?v=3');
    expect(html).not.toContain('alt="ADECOPRIA"');
  });

  it('sin logos y sin cabezote no queda un hueco: queda el nombre', () => {
    const html = cartaHtml({
      asunto: 'x',
      bloques: bloquesDe('Hola.'),
      marca: { ...MARCA, logos: [] },
    });

    expect(html).toContain('ADECOPRIA');
    expect(html).not.toContain('<img');
  });
});

describe('el cuerpo', () => {
  it('el panel de datos es una tabla, no un párrafo', () => {
    const html = carta('Modalidad: Virtual\nDuración: 40 horas');

    expect(html).toContain('Modalidad');
    expect(html).toContain('Virtual');
    /// Y se apila en el móvil: en dos columnas un correo largo
    /// se parte a mitad de palabra.
    expect(html).toContain('class="et"');
    expect(html).toContain('@media (max-width:620px)');
  });

  it('el título lleva su marca dentro del círculo', () => {
    const html = carta('# ✓ Confirmada');

    expect(html).toContain('✓');
    expect(html).toContain('border-radius:27px');
    expect(html).toContain('Confirmada');
  });

  it('escapa lo que escribió una persona', () => {
    /// El cuerpo puede llevar `<` o `&` sin querer decir nada
    /// de HTML.
    const html = carta('Perez & <b>Asociados</b>');

    expect(html).toContain('Perez &amp; &lt;b&gt;Asociados&lt;/b&gt;');
    expect(html).not.toContain('<b>Asociados</b>');
  });

  it('una dirección escrita a mano se vuelve enlace', () => {
    const html = carta('Entre a https://reservasae.com/consulta y consulte.');

    expect(html).toContain('<a href="https://reservasae.com/consulta"');
  });
});

describe('el pie', () => {
  it('dice de quién es, a dónde se contesta y por qué le llega', () => {
    const html = carta('Hola.');

    expect(html).toContain('proyectosena@grupo-ae.com.co');
    expect(html).toContain('Recibe este correo porque se registró.');
    expect(html).toContain(String(new Date().getFullYear()));
  });
});

describe('los colores', () => {
  it('salen del gremio', () => {
    expect(carta('Hola.')).toContain('#193002');
  });

  it('un color inventado NO entra en el correo', () => {
    /// Acaba dentro de un atributo `style`: un token tecleado
    /// a mano no puede meter CSS en el correo de nadie.
    const html = cartaHtml({
      asunto: 'x',
      bloques: bloquesDe('Hola.'),
      marca: {
        ...MARCA,
        colores: { ...MARCA.colores, encabezadoFondo: 'red;}body{display:none' },
      },
    });

    expect(html).not.toContain('display:none');
    expect(html).toContain('#2b2333');
  });
});
