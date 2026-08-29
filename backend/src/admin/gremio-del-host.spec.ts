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

  describe('el prefijo `pre-` es del ENTORNO, no del gremio', () => {
    /// `pre-adecopria` y `adecopria` son el mismo gremio en dos
    /// entornos: los separa el tunel al que apunta el DNS.
    ///
    /// Sin quitar el prefijo, `pre-adecopria` no casaba con
    /// ningun convenio y la direccion caia a la PUERTA GENERAL,
    /// que es como el panel de pruebas acabo enseñando los DOS
    /// gremios en una direccion que dice ser de uno.

    it('pre-adecopria es ADECOPRIA', () => {
      expect(gremioDelHost('pre-adecopria.reservasae.com', CONVENIOS)?.id).toBe(
        'c1',
      );
    });

    it('y con guiones dentro del slug tambien', () => {
      expect(
        gremioDelHost('pre-britcham-adee.reservasae.com', CONVENIOS)?.id,
      ).toBe('c2');
    });

    it('NO cae en la puerta general, que es el defecto entero', () => {
      for (const h of [
        'pre-adecopria.reservasae.com',
        'pre-britcham-adee.reservasae.com',
      ]) {
        expect(gremioDelHost(h, CONVENIOS)).not.toBeNull();
      }
    });

    it('`pre` a secas no nombra a nadie', () => {
      expect(gremioDelHost('pre.reservasae.com', CONVENIOS)).toBeNull();
    });

    it('`pre-` de un gremio que no existe sigue siendo nadie', () => {
      expect(gremioDelHost('pre-cualquiera.reservasae.com', CONVENIOS)).toBeNull();
    });

    it('no se salta lo reservado poniendole el prefijo', () => {
      /// `pre-prueba` no puede volverse `prueba` y colarse: lo
      /// reservado se comprueba ANTES y DESPUES de quitarlo.
      expect(etiquetaDelHost('pre-prueba.reservasae.com')).toBeNull();
      expect(etiquetaDelHost('pre-www.reservasae.com')).toBeNull();
    });

    it('un Host que no es un dominio se rechaza igual', () => {
      /// El prefijo se quita DESPUES de validar el patron, asi
      /// que `//malo` muere antes y no por parecerse a uno.
      expect(etiquetaDelHost('//pre-malo.reservasae.com')).toBeNull();
    });
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
