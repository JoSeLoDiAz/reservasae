/// La dirección decide con qué gremio se entra, así que un
/// fallo aquí manda a alguien al panel del otro convenio.

import { etiquetaDelHost, gremioDelHost } from './gremio-del-host';

const CONVENIOS = [
  { id: 'c1', slug: 'adecopria' },
  { id: 'c2', slug: 'britcham-adee' },
];

describe('el gremio que nombra la dirección', () => {
  it('lo saca del subdominio', () => {
    expect(gremioDelHost('adecopria.reservasae.com', CONVENIOS)?.id).toBe('c1');
    expect(gremioDelHost('britcham-adee.reservasae.com', CONVENIOS)?.id).toBe('c2');
  });

  it('la puerta general no nombra ninguno', () => {
    for (const h of ['reservasae.com', 'www.reservasae.com', 'localhost:3000']) {
      expect(gremioDelHost(h, CONVENIOS)).toBeNull();
    }
  });

  it('el entorno de pruebas tampoco', () => {
    expect(gremioDelHost('prueba.reservasae.com', CONVENIOS)).toBeNull();
  });

  it('un subdominio que no es de nadie cae en la general', () => {
    expect(gremioDelHost('cualquiera.reservasae.com', CONVENIOS)).toBeNull();
  });

  it('no se cuela por mayúsculas, espacios ni puerto', () => {
    expect(gremioDelHost('  ADECOPRIA.Reservasae.com:443 ', CONVENIOS)?.id).toBe('c1');
  });

  it('sin host no hay gremio', () => {
    for (const h of [undefined, null, '', '   ']) {
      expect(gremioDelHost(h, CONVENIOS)).toBeNull();
    }
  });

  it('una IP no nombra un gremio', () => {
    expect(gremioDelHost('127.0.0.1:4000', CONVENIOS)).toBeNull();
    expect(gremioDelHost('100.101.40.99', CONVENIOS)).toBeNull();
  });

  it('un Host que no es un dominio no da etiqueta', () => {
    // metido en una URL, saldria del origen
    for (const h of [
      '//malo.reservasae.com',
      'a_b.reservasae.com',
      'MAL O.reservasae.com',
      '..reservasae.com',
      'a:b.reservasae.com',
    ]) {
      expect([h, etiquetaDelHost(h)]).toEqual([h, null]);
    }
  });

  it('la etiqueta se lee aunque no exista el convenio', () => {
    expect(etiquetaDelHost('otro.reservasae.com')).toBe('otro');
  });
});

/// Los subdominios de PRUEBAS, que llevan prefijo.
///
/// El 29 ago 2026 produccion se quedo con
/// `adecopria.reservasae.com` y pruebas se mudo a
/// `pre-adecopria.reservasae.com`. El codigo no sabia del
/// prefijo, asi que en pruebas el gremio dejaba de resolverse
/// —y con el, la marca del panel, la fijacion del gremio y los
/// dos webhooks—. No fallaba nada a la vista: simplemente
/// actuaba como si se hubiera entrado por la puerta general.
describe('el prefijo pre- de los subdominios de pruebas', () => {
  const CONVENIOS = [
    { id: 'a', slug: 'adecopria' },
    { id: 'b', slug: 'britcham-adee' },
  ];

  it('pre-adecopria es el mismo gremio que adecopria', () => {
    expect(etiquetaDelHost('pre-adecopria.reservasae.com')).toBe('adecopria');
  });

  it('tambien con un slug que ya lleva guion', () => {
    expect(etiquetaDelHost('pre-britcham-adee.reservasae.com')).toBe(
      'britcham-adee',
    );
  });

  it('y resuelve el convenio, que es lo que de verdad importa', () => {
    expect(
      gremioDelHost('pre-britcham-adee.reservasae.com', CONVENIOS)?.slug,
    ).toBe('britcham-adee');
  });

  it('produccion sigue igual', () => {
    expect(gremioDelHost('adecopria.reservasae.com', CONVENIOS)?.slug).toBe(
      'adecopria',
    );
  });

  it('«pre-» a secas no es un gremio', () => {
    expect(etiquetaDelHost('pre-.reservasae.com')).toBeNull();
  });
});
