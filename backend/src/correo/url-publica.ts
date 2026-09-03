/** Por dónde se llega desde fuera, y la trampa del `/api`. */

/// Lo que va dentro de un correo lo abre otra persona, en su
/// casa, sin sesión. Así que la dirección tiene que ser la
/// PÚBLICA y tiene que estar bien enrutada, y ahí hay una
/// trampa que ya costó tres direcciones rotas.
///
/// En el servidor, nginx solo enruta DOS cosas
/// (`docker/nginx/prueba.conf`):
///
///     location /       -> el frontend (Next)
///     location /api/   -> el backend, quitando el prefijo
///
/// Y el backend NO tiene `setGlobalPrefix`. O sea:
///
///   - una PANTALLA va sin `/api`  -> `/completar/<token>`
///   - un ENDPOINT va con `/api`   -> `/api/campanas/<id>/clic/...`
///
/// Sin el `/api`, la petición se la come el Next, que no tiene
/// esa ruta y devuelve su 404. En local no se nota, porque el
/// rewrite de `next.config.ts` manda `/api/:path*` al backend
/// pero el 404 del Next también sale igual de callado.
///
/// Esto es lo que estaba mal en el banner, el píxel de
/// apertura y --peor-- los enlaces medidos de las campañas: en
/// producción cada enlace de un correo llevaba a un 404 en vez
/// de a su destino.

/// La del frontend, tal cual está en `URL_PUBLICA`. Es la que
/// sirve para una PANTALLA.
///
/// Null cuando no está puesta: quien la llame decide qué hacer
/// con eso, que no es lo mismo para un enlace que para una
/// imagen.
export function urlPublica(): string | null {
  const v = process.env.URL_PUBLICA?.trim();
  return v ? v.replace(/\/+$/, '') : null;
}

/**
 * La misma, pero por donde se llega a la API.
 *
 * Es `URL_PUBLICA` + `/api`. Todo lo que dentro de un correo
 * apunte a un endpoint del backend --una imagen que sirve
 * nosotros, un píxel, un enlace medido-- tiene que salir de
 * aquí y no de `urlPublica()`.
 */
export function urlPublicaDeLaApi(): string | null {
  const base = urlPublica();
  return base ? `${base}/api` : null;
}

/// Para desarrollo: el front de local, que ya reescribe
/// `/api/*` hacia el backend. Se usa donde NO puede faltar una
/// dirección --un enlace tiene que llevar a alguna parte-- y
/// nunca donde valga más no poner nada.
export const API_EN_LOCAL = 'http://localhost:3100/api';
