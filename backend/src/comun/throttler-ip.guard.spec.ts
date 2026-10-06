/** El límite de peticiones cuenta por sesión, no por oficina. */

/**
 * CONTABA SOLO POR IP, y en una oficina eso es un cubo COMPARTIDO.
 *
 * Las cinco gestoras de ADECOPRIA salen por la misma dirección, así
 * que entre todas tenían 60 peticiones por minuto. Una pantalla del
 * panel se come varias nada más abrirse ---la tira, el resumen, las
 * dos tablas, la cuenta de avisos--- y cada bloque se refresca solo
 * cada treinta segundos. Con dos pestañas y tres personas trabajando,
 * el límite salta sin que nadie esté abusando: las respuestas se van
 * en 429 y la pantalla se queda a medias.
 *
 * Comprobado contra el backend de verdad antes de escribir esto: dos
 * cuentas desde la misma máquina, 45 peticiones cada una ---90 en
 * total, con el límite en 60--- y ningún 429; y 70 peticiones SIN
 * sesión siguen cortándose a las 60.
 *
 * Aquí se fija lo que esa prueba a mano no puede dejar fijado: de
 * dónde sale la clave con la que se cuenta.
 */

import { ThrottlerIpGuard } from './throttler-ip.guard';

/// El guardia con un firmante de mentira. Se construye a mano ---y no
/// con el contenedor de Nest--- porque lo que se prueba es una
/// función: de qué saca la clave.
function guardia(verificar: (t: string) => { sub: string }) {
  const jwt = {
    verify: (t: string) => verificar(t),
  } as unknown as import('@nestjs/jwt').JwtService;

  return new ThrottlerIpGuard(
    [{ name: 'default', ttl: 60_000, limit: 60 }],
    {} as never,
    {} as never,
    jwt,
  );
}

/// `getTracker` es protegido: esto es lo que se está probando.
const clave = (g: ThrottlerIpGuard, req: unknown): Promise<string> =>
  (
    g as unknown as { getTracker: (r: unknown) => Promise<string> }
  ).getTracker(req);

const CON_SESION = {
  cookies: { convoca_sesion: 'un-token' },
  headers: { 'cf-connecting-ip': '200.1.2.3' },
};

describe('con sesión válida, cuenta por la sesión', () => {
  it('la clave es el sujeto del token', async () => {
    const g = guardia(() => ({ sub: 'admin-7' }));
    await expect(clave(g, CON_SESION)).resolves.toBe('sesion:admin-7');
  });

  /**
   * LO QUE DE VERDAD ARREGLA EL FALLO: dos compañeras en la MISMA
   * oficina, con la misma IP, en cubos distintos.
   */
  it('dos cuentas de la misma oficina no comparten cubo', async () => {
    const a = guardia(() => ({ sub: 'ana' }));
    const b = guardia(() => ({ sub: 'lucia' }));
    const req = { ...CON_SESION };
    expect(await clave(a, req)).not.toBe(await clave(b, req));
  });
});

describe('sin sesión válida, cuenta por la IP', () => {
  /**
   * Y ESTO ES LA MITAD DEL ARREGLO. Tomando la cookie tal cual,
   * cualquiera podría mandar una inventada y distinta en cada
   * peticion y estrenar cubo cada vez, que es exactamente el abuso
   * que este guardia existe para frenar. Una cookie que no verifica
   * cuenta como anónima.
   */
  it('una cookie falsa o caducada no estrena cubo: vuelve a la IP', async () => {
    const g = guardia(() => {
      throw new Error('firma mala');
    });
    await expect(clave(g, CON_SESION)).resolves.toBe('ip:200.1.2.3');
  });

  it('sin cookie, por la IP', async () => {
    const g = guardia(() => ({ sub: 'no-deberia-llamarse' }));
    await expect(
      clave(g, { cookies: {}, headers: { 'cf-connecting-ip': '8.8.8.8' } }),
    ).resolves.toBe('ip:8.8.8.8');
  });

  /// Un token sin `sub` tampoco: sin sujeto no hay a quién contarle.
  it('un token sin sujeto cuenta por la IP', async () => {
    const g = guardia(() => ({ sub: '' }));
    await expect(clave(g, CON_SESION)).resolves.toBe('ip:200.1.2.3');
  });

  /**
   * Y LA IP ES LA REAL, la de Cloudflare: detrás del proxy todas las
   * peticiones llegan con la del proxy, y entonces el cubo anónimo
   * sería uno solo para medio país.
   */
  it('la IP sale de `CF-Connecting-IP` antes que de `X-Forwarded-For`', async () => {
    const g = guardia(() => ({ sub: '' }));
    await expect(
      clave(g, {
        cookies: {},
        headers: {
          'cf-connecting-ip': '200.1.2.3',
          'x-forwarded-for': '10.0.0.1, 10.0.0.2',
        },
      }),
    ).resolves.toBe('ip:200.1.2.3');
  });
});
