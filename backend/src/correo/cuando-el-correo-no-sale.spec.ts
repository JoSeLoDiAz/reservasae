/** Cuando un correo no sale, queda constancia en la ficha. */

/**
 * «NO HAY UN CRITERIO PARA VER SI EL CORREO ESTÁ BIEN O NO; CORREOS
 * REBOTADOS» (cliente, 5 oct 2026).
 *
 * No lo había. Cuando el servidor rechaza una dirección, eso quedaba
 * en el registro del servidor ---donde no mira quien trabaja la
 * ficha--- y el panel seguía enseñando ese correo como si sirviera.
 *
 * DOS CASOS, Y EL SEGUNDO ERA EL INVISIBLE:
 *
 *   1. el envío falla entero y `sendMail` lanza;
 *   2. el envío SALE BIEN y trae direcciones en `rejected`. Mandar a
 *      tres y que una rebote es el caso corriente de una lista, y era
 *      justo el que no dejaba rastro: el código solo miraba la
 *      excepción.
 *
 * Y ESTO NO ES EL REBOTE DE VERDAD. El rebote llega minutos después
 * de que el servidor aceptó el mensaje, y para saberlo hace falta el
 * webhook de SendGrid. Esto es lo que se sabe EN EL ENVÍO, que no
 * costaba una integración.
 */

import { CorreoService } from './correo.service';

/// Lo que se le escribió a `personas`, para poder mirarlo.
type Escrito = { where: unknown; data: Record<string, unknown> };

function servicio(
  respuesta: { accepted?: unknown[]; rejected?: unknown[] } | Error,
) {
  const escrito: Escrito[] = [];
  const prisma = {
    persona: {
      updateMany: (a: { where: unknown; data: Record<string, unknown> }) => {
        escrito.push(a);
        return Promise.resolve({ count: 1 });
      },
    },
  };

  const s = new CorreoService(prisma as never);
  /// Se reemplaza el transporte, no el servicio: lo que se prueba es
  /// qué hace `enviar` con lo que nodemailer devuelve.
  (s as unknown as { abrir: () => unknown }).abrir = () => ({
    sendMail: () =>
      respuesta instanceof Error
        ? Promise.reject(respuesta)
        : Promise.resolve({ messageId: 'id-1', ...respuesta }),
  });
  return { s, escrito };
}

/// El correo tiene que estar configurado o `enviar` ni lo intenta.
const antes = { ...process.env };
beforeEach(() => {
  process.env.SMTP_SERVIDOR = 'smtp.ejemplo.test';
  process.env.SMTP_USUARIO = 'yo@ejemplo.test';
  process.env.SMTP_CLAVE = 'una-clave-larga-de-verdad';
  /// SIN DESVIO, y hay que decirlo: en `ENTORNO=prueba` el desvio
  /// es OBLIGATORIO, y con desvio no se apunta nada ---lo que el
  /// servidor acepta o rechaza es el buzon del equipo, no el de la
  /// persona---. La primera version de esta prueba fallo justo por
  /// eso, y el fallo era del codigo, no de la prueba.
  delete process.env.ENTORNO;
  delete process.env.CORREO_REDIRIGIR_A;
});
afterEach(() => {
  process.env = { ...antes };
});

const carta = (para: string[]) => ({
  para,
  asunto: 'Sus datos',
  texto: 'hola',
  html: '<p>hola</p>',
});

describe('el envío que falla entero', () => {
  it('marca todas las direcciones de ese correo', async () => {
    const { s, escrito } = servicio(new Error('550 mailbox unavailable'));
    const r = await s.enviar(carta(['ana@ejemplo.test']));

    expect(r.estado).toBe('FALLO');
    expect(escrito).toHaveLength(1);
    expect(escrito[0].where).toEqual({ correo: { in: ['ana@ejemplo.test'] } });
    expect(escrito[0].data.correoFallaEn).toBeInstanceOf(Date);
    /// El motivo se guarda: «el correo falla» sin decir por qué deja
    /// a quien lo lee sin saber si pedirle otra dirección o esperar.
    expect(String(escrito[0].data.correoFalloMotivo)).toContain('550');
  });
});

describe('el envío que sale bien pero rechaza a alguien', () => {
  it('marca solo a la rechazada y limpia a la que sí salió', async () => {
    const { s, escrito } = servicio({
      accepted: ['buena@ejemplo.test'],
      rejected: ['mala@ejemplo.test'],
    });
    const r = await s.enviar(carta(['buena@ejemplo.test', 'mala@ejemplo.test']));

    expect(r.estado).toBe('ENVIADO');
    const marca = escrito.find((e) => e.data.correoFallaEn instanceof Date);
    const limpia = escrito.find((e) => e.data.correoFallaEn === null);

    expect(marca?.where).toEqual({ correo: { in: ['mala@ejemplo.test'] } });
    /// Y la limpieza solo toca a las que estaban marcadas: sin eso,
    /// cada correo que sale reescribe la fila de todo el que lo
    /// recibe.
    expect(limpia?.where).toEqual({
      correo: { in: ['buena@ejemplo.test'] },
      correoFallaEn: { not: null },
    });
    expect(limpia?.data.correoFalloMotivo).toBeNull();
  });

  /**
   * NODEMAILER A VECES DEVUELVE OBJETOS, no cadenas. Leerlo sin mirar
   * guardaría «[object Object]» como correo: la marca no casaría con
   * nadie, y nadie se enteraría de que no casa.
   */
  it('entiende las direcciones que vienen como objeto', async () => {
    const { s, escrito } = servicio({
      accepted: [],
      rejected: [{ address: 'mala@ejemplo.test', name: '' }],
    });
    await s.enviar(carta(['mala@ejemplo.test']));
    expect(escrito[0].where).toEqual({ correo: { in: ['mala@ejemplo.test'] } });
  });

  /// En minúsculas, como se guardan en `personas`: comparando el
  /// texto crudo, «Ana@Ejemplo.test» no casaría con la fila y la
  /// marca se perdería en silencio.
  it('normaliza antes de buscar la ficha', async () => {
    const { s, escrito } = servicio({
      accepted: [],
      rejected: ['  Ana@Ejemplo.TEST '],
    });
    await s.enviar(carta(['Ana@Ejemplo.TEST']));
    expect(escrito[0].where).toEqual({ correo: { in: ['ana@ejemplo.test'] } });
  });
});

describe('la marca no puede estorbar al envío', () => {
  /**
   * Si apuntar falla, el correo ya salió o ya falló, y lo que está en
   * juego es una marca de ayuda. Tumbar por ella la respuesta de un
   * formulario público sería cambiar un aviso por una caída.
   */
  it('si la base no responde, el envío sigue contando como enviado', async () => {
    const prisma = {
      persona: {
        updateMany: () => Promise.reject(new Error('la base no está')),
      },
    };
    const s = new CorreoService(prisma as never);
    (s as unknown as { abrir: () => unknown }).abrir = () => ({
      sendMail: () =>
        Promise.resolve({
          messageId: 'id-1',
          accepted: ['ana@ejemplo.test'],
          rejected: [],
        }),
    });

    await expect(s.enviar(carta(['ana@ejemplo.test']))).resolves.toMatchObject({
      estado: 'ENVIADO',
    });
  });

  /**
   * CON DESVÍO NO SE APUNTA NADA, y esto es lo que cazó el error.
   *
   * En pruebas y en preproducción todo el correo se desvía a un buzón
   * del equipo. Lo que el servidor aceptó o rechazó es ESA dirección,
   * así que apuntarlo marcaría el correo del operador como malo
   * ---y, peor, dejaría la de la persona sin marcar, diciendo que
   * está bien---.
   *
   * La primera versión de este fichero falló aquí con
   * «proyectosena@grupo-ae.com.co» donde esperaba a la persona. El
   * fallo era del código.
   */
  it('con el correo desviado no se marca a nadie', async () => {
    process.env.ENTORNO = 'prueba';
    process.env.CORREO_REDIRIGIR_A = 'equipo@grupo-ae.com.co';

    const { s, escrito } = servicio(new Error('550 mailbox unavailable'));
    const r = await s.enviar(carta(['ana@ejemplo.test']));

    expect(r.estado).toBe('FALLO');
    /// Ni la de la persona ni la del equipo.
    expect(escrito).toEqual([]);
  });

  /// Y sin direcciones no se pregunta a la base: un `IN ()` vacío es
  /// una consulta por nada.
  it('sin rechazadas no toca la base', async () => {
    const { s, escrito } = servicio({
      accepted: ['ana@ejemplo.test'],
      rejected: [],
    });
    await s.enviar(carta(['ana@ejemplo.test']));
    expect(escrito.filter((e) => e.data.correoFallaEn instanceof Date)).toEqual(
      [],
    );
  });
});
