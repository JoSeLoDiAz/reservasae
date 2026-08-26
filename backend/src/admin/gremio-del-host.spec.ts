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

  it('la etiqueta se lee aunque no exista el convenio', () => {
    expect(etiquetaDelHost('otro.reservasae.com')).toBe('otro');
  });
});
