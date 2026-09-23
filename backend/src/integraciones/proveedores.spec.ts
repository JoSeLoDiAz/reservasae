/** La llave dice QUIEN llama, y una llave floja no entra. */

import {
  firmaDe,
  hayAlgunaLlave,
  proveedorDeLaClave,
  proveedoresConLlave,
  PROVEEDORES,
} from './proveedores';

const LUCID = 'llave-de-lucid-larga-y-aleatoria-0123456789';
const NUA = 'llave-de-nua-tambien-larga-y-aleatoria-9876543210';

describe('de quién es la llave', () => {
  it('reconoce a cada proveedor por la SUYA', () => {
    const env = { LUCID_WEBHOOK_SECRET: LUCID, NUA_WEBHOOK_SECRET: NUA };
    expect(proveedorDeLaClave(LUCID, env)).toBe('lucid');
    expect(proveedorDeLaClave(NUA, env)).toBe('nua');
  });

  /**
   * ES EL DEFECTO QUE ESTO VIENE A CERRAR.
   *
   * Antes el proveedor salía de la cabecera `x-origen-sistema`,
   * que caía en «lucid» por omisión: un segundo chatbot que no
   * la mandara escribía en el espacio de ids de Lucid y su
   * conversación se perdía en silencio.
   */
  it('la llave de uno NUNCA devuelve al otro', () => {
    const env = { LUCID_WEBHOOK_SECRET: LUCID, NUA_WEBHOOK_SECRET: NUA };
    expect(proveedorDeLaClave(NUA, env)).not.toBe('lucid');
    expect(proveedorDeLaClave(LUCID, env)).not.toBe('nua');
  });

  it('sin llave, o con una que no es de nadie, no entra', () => {
    const env = { LUCID_WEBHOOK_SECRET: LUCID, NUA_WEBHOOK_SECRET: NUA };
    expect(proveedorDeLaClave(undefined, env)).toBeNull();
    expect(proveedorDeLaClave('', env)).toBeNull();
    expect(proveedorDeLaClave('otra-cosa-larga-pero-que-no-es-ninguna-0000', env)).toBeNull();
  });

  /// Falla CERRADO: sin variables la puerta contesta 401 a todo,
  /// que es la mitad que sostiene no tumbar el arranque.
  it('sin ninguna variable no entra nadie', () => {
    expect(proveedorDeLaClave(LUCID, {})).toBeNull();
    expect(hayAlgunaLlave({})).toBe(false);
  });

  it('una llave corta no vale, aunque esté puesta', () => {
    const env = { LUCID_WEBHOOK_SECRET: 'corta' };
    expect(proveedorDeLaClave('corta', env)).toBeNull();
    expect(hayAlgunaLlave(env)).toBe(false);
  });

  /// Están en el repositorio: quien las deje puestas no tiene
  /// llave, tiene un adorno.
  it('las del ejemplo no valen', () => {
    const env = { LUCID_WEBHOOK_SECRET: 'cambiar-por-un-secreto-largo-y-aleatorio' };
    expect(proveedorDeLaClave(env.LUCID_WEBHOOK_SECRET, env)).toBeNull();
    expect(hayAlgunaLlave(env)).toBe(false);
  });

  it('un proveedor puede estar configurado y el otro no', () => {
    const env = { LUCID_WEBHOOK_SECRET: LUCID };
    expect(proveedoresConLlave(env)).toEqual(['lucid']);
    expect(proveedorDeLaClave(LUCID, env)).toBe('lucid');
    expect(proveedorDeLaClave(NUA, env)).toBeNull();
  });
});

describe('la firma de la nota', () => {
  /// La firma y la llave salen del MISMO sitio. Escritas en dos
  /// lados, una nota de un proveedor acabaría firmada por el
  /// otro -- y las notas no se borran.
  it('cada proveedor firma con lo suyo', () => {
    expect(firmaDe('lucid')).toBe('Lucid (WhatsApp)');
    expect(firmaDe('nua')).toBe('Nua Talker (WhatsApp)');
  });

  it('todos los del registro tienen firma y variable propias', () => {
    const firmas = new Set(PROVEEDORES.map((p) => p.firma));
    const variables = new Set(PROVEEDORES.map((p) => p.variable));
    expect(firmas.size).toBe(PROVEEDORES.length);
    expect(variables.size).toBe(PROVEEDORES.length);
    for (const p of PROVEEDORES) expect(p.firma.trim()).not.toBe('');
  });
});
