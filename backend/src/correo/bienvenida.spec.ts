/** El correo de acceso dice la verdad y no inyecta nada. */

import { armarBienvenida, enPalabras, puertasDe } from './bienvenida';
import { hostDelGremio } from '../comun/host-del-gremio';

const GREMIOS = [
  { slug: 'adecopria', sigla: 'ADECOPRIA' },
  { slug: 'britcham-adee', sigla: 'BRITCHAM ADEE' },
];

const base = {
  hostDelSitio: 'reservasae.com',
  gremios: GREMIOS,
  hostDeGremio: (slug: string) => hostDelGremio('reservasae.com', slug),
};

const carta = (extra: Record<string, unknown> = {}) =>
  armarBienvenida({
    nombre: 'Catalina Hernandez',
    correo: 'catalina@grupo-ae.com.co',
    claveTemporal: 'Xk4m-92pQ',
    papel: 'Country Manager',
    gremios: ['ADECOPRIA', 'BRITCHAM ADEE'],
    puertas: [{ etiqueta: 'ADECOPRIA', url: 'https://adecopria.reservasae.com/admin' }],
    colores: { marca: '#9900b6', texto: '#17121b' },
    logos: [],
    nombreApp: 'Convoca CRM',
    eslogan: 'Relaciones que generan resultados',
    ...extra,
  });

describe('por dónde se le dice que entre', () => {
  const antes = { ...process.env };
  afterEach(() => {
    process.env = { ...antes };
  });

  it('una puerta por cada gremio suyo, con su dirección', () => {
    const p = puertasDe({
      ...base,
      esSuperadmin: false,
      puertaGeneralSoloSuperadmin: true,
    });
    expect(p.map((x) => x.url)).toEqual([
      'https://adecopria.reservasae.com/admin',
      'https://britcham-adee.reservasae.com/admin',
    ]);
  });

  /// Mandarle un enlace que lo rechaza es el mismo defecto
  /// que ofrecerle un botón que da 403.
  it('la puerta general NO se ofrece a quien no la puede abrir', () => {
    const p = puertasDe({
      ...base,
      esSuperadmin: false,
      puertaGeneralSoloSuperadmin: true,
    });
    expect(p.map((x) => x.etiqueta)).not.toContain('Panel general');
  });

  it('al superadmin sí, y va primero', () => {
    const p = puertasDe({
      ...base,
      esSuperadmin: true,
      puertaGeneralSoloSuperadmin: true,
    });
    expect(p[0]).toEqual({
      etiqueta: 'Panel general',
      url: 'https://reservasae.com/admin',
    });
    expect(p).toHaveLength(3);
  });

  it('con la puerta general abierta la ve cualquiera', () => {
    const p = puertasDe({
      ...base,
      esSuperadmin: false,
      puertaGeneralSoloSuperadmin: false,
    });
    expect(p[0].etiqueta).toBe('Panel general');
  });

  it('en pruebas las direcciones llevan el prefijo', () => {
    process.env.ENTORNO = 'prueba';
    const p = puertasDe({
      ...base,
      hostDelSitio: 'prueba.reservasae.com',
      hostDeGremio: (slug) => hostDelGremio('prueba.reservasae.com', slug),
      esSuperadmin: false,
      puertaGeneralSoloSuperadmin: true,
    });
    expect(p[0].url).toBe('https://pre-adecopria.reservasae.com/admin');
  });
});

describe('lo que dice el correo', () => {
  it('lleva el usuario, la clave y el papel, en los dos formatos', () => {
    const c = carta();
    for (const texto of [c.texto, c.html]) {
      expect(texto).toContain('catalina@grupo-ae.com.co');
      expect(texto).toContain('Xk4m-92pQ');
      expect(texto).toContain('Country Manager');
    }
  });

  it('dice que la clave es temporal: sin eso parece la definitiva', () => {
    const c = carta();
    expect(c.texto).toContain('temporal');
    expect(c.html).toContain('temporal');
  });

  it('lleva todas sus puertas y ninguna más', () => {
    const c = carta({
      puertas: [
        { etiqueta: 'Panel general', url: 'https://reservasae.com/admin' },
        { etiqueta: 'ADECOPRIA', url: 'https://adecopria.reservasae.com/admin' },
      ],
    });
    expect(c.html).toContain('https://reservasae.com/admin');
    expect(c.html).toContain('https://adecopria.reservasae.com/admin');
    expect(c.html).not.toContain('britcham');
  });

  /// El nombre lo teclea un administrador.
  it('un nombre con etiquetas no inyecta HTML', () => {
    const c = carta({ nombre: '<img src=x onerror=alert(1)>' });
    expect(c.html).not.toContain('<img src=x');
    expect(c.html).toContain('&lt;img');
  });

  it('sin logos no queda ninguna imagen rota', () => {
    expect(carta({ logos: [] }).html).not.toContain('<img');
  });

  it('con logos van todos', () => {
    const c = carta({
      logos: ['https://reservasae.com/api/marca/logos/a?v=1', 'https://reservasae.com/api/marca/logos/b?v=2'],
    });
    expect((c.html.match(/<img/g) ?? []).length).toBe(2);
  });

  /// Un color inventado acaba dentro de un `style`.
  it('un color que no es un hex se cae al neutro', () => {
    const c = carta({
      colores: { marca: 'rojo; } body{display:none}', texto: '#17121b' },
    });
    expect(c.html).not.toContain('display:none');
    expect(c.html).toContain('#4b3f52');
  });

  it('el asunto lleva el nombre del producto', () => {
    expect(carta().asunto).toBe('Su acceso a Convoca CRM');
  });

  it('se lee en el móvil: declara viewport y la caja cede', () => {
    const c = carta();
    expect(c.html).toContain('width=device-width');
    expect(c.html).toContain('max-width:600px');
    expect(c.html).toContain('@media (max-width:620px)');
  });
});

describe('la lista en palabras', () => {
  it('une con «y», que es como se lee', () => {
    expect(enPalabras([])).toBe('');
    expect(enPalabras(['A'])).toBe('A');
    expect(enPalabras(['A', 'B'])).toBe('A y B');
    expect(enPalabras(['A', 'B', 'C'])).toBe('A, B y C');
  });
});
