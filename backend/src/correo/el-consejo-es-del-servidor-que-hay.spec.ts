/** Cuando el correo falla, el consejo es del servidor configurado. */

/**
 * «NECESITAMOS EL SENDGRID» (Josse, 5 oct 2026), con el panel diciendo
 * que el servidor no acepta usuario y contraseña.
 *
 * EL TRANSPORTE NUNCA ESTUVO ATADO A GMAIL: es SMTP genérico de
 * nodemailer, así que cambiar de proveedor no toca una línea de código,
 * solo las variables. Lo único que estaba atado era el TEXTO del
 * diagnóstico, que decía siempre lo mismo:
 *
 *   «Con Google Workspace hay que crear una contraseña de aplicación
 *    en myaccount.google.com > Seguridad > Verificación en dos pasos»
 *
 * Buen consejo con Gmail. Con SendGrid, media hora perdida buscando una
 * pantalla que no existe —y el mensaje sale EN EL PANEL, que es donde
 * lo lee justo quien está intentando arreglarlo.
 *
 * Con SendGrid los dos tropiezos son otros, y ninguno se parece a una
 * contraseña mal puesta:
 *
 *   - el usuario es la palabra «apikey», literal, igual para todas las
 *     cuentas, y la contraseña es la API key entera;
 *   - y el remitente tiene que estar verificado: la conexión entra, la
 *     autenticación pasa, y el envío se rechaza igual.
 */

import { CorreoService } from './correo.service';

/// `explicar` es privado: se llega por el tipo, no cambiando su
/// visibilidad. Lo que se prueba es el mensaje que ve una persona.
const explicar = (servicio: CorreoService, e: unknown): string =>
  (servicio as unknown as { explicar(e: unknown): string }).explicar(e);

const FALLO_DE_CLAVE = new Error(
  'Invalid login: 535-5.7.8 Username and Password not accepted',
);

describe('el consejo cambia con el servidor', () => {
  const antes = { ...process.env };
  afterEach(() => {
    process.env = { ...antes };
  });

  const servicio = () =>
    new CorreoService();

  it('con SendGrid dice lo de la API key, no lo de Google', () => {
    process.env.SMTP_SERVIDOR = 'smtp.sendgrid.net';
    const dice = explicar(servicio(), FALLO_DE_CLAVE);

    expect(dice).toContain('apikey');
    expect(dice).toContain('SG.');
    /// Y NO manda a Google, que es el defecto entero.
    expect(dice).not.toContain('myaccount.google.com');
    expect(dice).not.toContain('contraseña de aplicación');
  });

  it('con Google sigue diciendo lo de la contraseña de aplicación', () => {
    process.env.SMTP_SERVIDOR = 'smtp.gmail.com';
    const dice = explicar(servicio(), FALLO_DE_CLAVE);

    expect(dice).toContain('myaccount.google.com');
    expect(dice).toContain('16 letras');
  });

  /**
   * Y CON UN SERVIDOR CUALQUIERA, NI UNO NI OTRO. Decir el consejo de
   * un proveedor concreto cuando no se sabe cuál es manda a buscar
   * donde no hay nada. Se dice lo único cierto: revise usuario y clave.
   */
  it('con otro servidor no inventa un proveedor', () => {
    process.env.SMTP_SERVIDOR = 'smtp.correo-de-la-empresa.com';
    const dice = explicar(servicio(), FALLO_DE_CLAVE);

    expect(dice).toContain('SMTP_USUARIO');
    expect(dice).not.toContain('myaccount.google.com');
    expect(dice).not.toContain('apikey');
  });

  /// Sin servidor puesto tampoco se adivina.
  it('sin servidor configurado tampoco', () => {
    delete process.env.SMTP_SERVIDOR;
    const dice = explicar(servicio(), FALLO_DE_CLAVE);
    expect(dice).not.toContain('myaccount.google.com');
  });
});

/**
 * EL REMITENTE SIN VERIFICAR es el tropiezo propio de SendGrid, y lo
 * que lo hace desconcertante es que NO SE PARECE a un fallo de clave:
 * la cuenta y la contraseña están bien, la conexión entra, y el correo
 * se rechaza igual. Sin esto, el panel enseñaría un 403 pelado.
 */
describe('el remitente que SendGrid no deja usar', () => {
  const antes = { ...process.env };
  afterEach(() => {
    process.env = { ...antes };
  });

  it('dice qué dirección es y dónde se verifica', () => {
    process.env.SMTP_SERVIDOR = 'smtp.sendgrid.net';
    process.env.SMTP_DESDE = 'proyectosena@grupo-ae.com.co';
    const servicio = new CorreoService();

    const dice = explicar(
      servicio,
      new Error(
        'The from address does not match a verified Sender Identity. Mail cannot be sent',
      ),
    );

    expect(dice).toContain('proyectosena@grupo-ae.com.co');
    expect(dice).toContain('Sender Authentication');
    /// Y deja claro que la clave NO es el problema, para que nadie se
    /// ponga a cambiarla.
    expect(dice).toContain('están bien');
  });
});
