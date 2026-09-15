/** El cabezote del correo: por dónde sale y cuándo no sale. */

/// Lo que este spec probaba del HTML se mudó a
/// `carta/carta.spec.ts` cuando el envoltorio de párrafos se
/// convirtió en una carta de verdad. Aquí se queda lo que
/// sigue siendo suyo: la DIRECCIÓN de la imagen.

/// Esto se rompe en silencio y no se nota hasta que a alguien
/// le llega el correo con un hueco arriba: nadie prueba una
/// imagen que la descarga Gmail desde fuera. Por eso las tres
/// reglas están fijadas aquí.

import { urlDelCabezote } from './plantillas-correo.service';

describe('la dirección del cabezote', () => {
  const antes = process.env.URL_PUBLICA;

  afterEach(() => {
    if (antes === undefined) delete process.env.URL_PUBLICA;
    else process.env.URL_PUBLICA = antes;
  });

  /// nginx enruta `/` al frontend y `/api/` al backend, y le
  /// quita el prefijo. Sin `/api/` esta imagen le pega al Next
  /// y devuelve 404. Si alguien quita ese trozo «porque
  /// sobra», esta prueba lo para.
  it('va por /api/, que es lo único que nginx manda al backend', () => {
    process.env.URL_PUBLICA = 'https://prueba.reservasae.com';

    expect(urlDelCabezote('pl-001', 3)).toBe(
      'https://prueba.reservasae.com/api/plantillas-correo/pl-001/banner?v=3',
    );
  });

  /// La respuesta se cachea una semana con `immutable`. Sin la
  /// versión en la dirección, cambiar el cabezote no cambiaría
  /// nada en las bandejas que ya tienen el viejo.
  it('lleva la versión, o el caché sirve el cabezote viejo', () => {
    process.env.URL_PUBLICA = 'https://prueba.reservasae.com';

    const uno = urlDelCabezote('pl-001', 1);
    const dos = urlDelCabezote('pl-001', 2);

    expect(uno).not.toBe(dos);
    expect(dos).toContain('v=2');
  });

  it('aguanta la barra de más al final', () => {
    process.env.URL_PUBLICA = 'https://prueba.reservasae.com///';

    expect(urlDelCabezote('pl-001', 1)).toBe(
      'https://prueba.reservasae.com/api/plantillas-correo/pl-001/banner?v=1',
    );
  });

  /// Y NO cae en `localhost` como los enlaces. Un enlace roto
  /// se ve al pulsarlo; una imagen rota se pinta sola, arriba
  /// del todo, donde va el logo del gremio.
  it('sin URL_PUBLICA no hay cabezote, y no un localhost', () => {
    delete process.env.URL_PUBLICA;
    expect(urlDelCabezote('pl-001', 1)).toBeNull();

    process.env.URL_PUBLICA = '   ';
    expect(urlDelCabezote('pl-001', 1)).toBeNull();
  });
});
