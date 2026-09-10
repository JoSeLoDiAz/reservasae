/** La regla del `/api`, fijada. */

/// Esto no se nota probando en local --el rewrite del Next tapa
/// la diferencia-- y no se nota probando en el servidor, porque
/// nadie pulsa los enlaces de un correo de prueba. Se nota
/// cuando a trescientas personas les llega un correo cuyos
/// enlaces van todos al 404.

import { API_EN_LOCAL, urlPublica, urlPublicaDeLaApi } from './url-publica';

describe('por dónde se llega desde fuera', () => {
  const antes = process.env.URL_PUBLICA;

  afterEach(() => {
    if (antes === undefined) delete process.env.URL_PUBLICA;
    else process.env.URL_PUBLICA = antes;
  });

  /// Una PANTALLA va sin `/api`: nginx manda `/` al Next.
  /// `preinscripcion` la usa así para `/completar/<token>`.
  it('la del frontend va tal cual, sin /api', () => {
    process.env.URL_PUBLICA = 'https://prueba.reservasae.com';
    expect(urlPublica()).toBe('https://prueba.reservasae.com');
  });

  /// Un ENDPOINT va con `/api`: es lo único que nginx manda al
  /// backend, y le quita el prefijo al pasarlo.
  it('la de la API lleva /api, que es lo único que llega al backend', () => {
    process.env.URL_PUBLICA = 'https://prueba.reservasae.com';
    expect(urlPublicaDeLaApi()).toBe('https://prueba.reservasae.com/api');
  });

  it('la barra de más al final no duplica la del /api', () => {
    process.env.URL_PUBLICA = 'https://prueba.reservasae.com///';
    expect(urlPublicaDeLaApi()).toBe('https://prueba.reservasae.com/api');
  });

  it('sin URL_PUBLICA las dos dan null, y decide quien llama', () => {
    delete process.env.URL_PUBLICA;
    expect(urlPublica()).toBeNull();
    expect(urlPublicaDeLaApi()).toBeNull();

    process.env.URL_PUBLICA = '   ';
    expect(urlPublicaDeLaApi()).toBeNull();
  });

  /// El respaldo de local también lleva `/api`: el front de
  /// desarrollo reescribe `/api/*` hacia el backend, así que
  /// sin el prefijo tampoco llegaría allí.
  it('el respaldo de local también lleva /api', () => {
    expect(API_EN_LOCAL).toContain('/api');
  });
});
