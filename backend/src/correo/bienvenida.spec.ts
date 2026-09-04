/** El correo de acceso dice la verdad y no inyecta nada. */

import { armarBienvenida, enPalabras, esClaro, puertasDe } from './bienvenida';
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
    colores: {
      marca: '#9900b6',
      texto: '#17121b',
      encabezadoFondo: '#702482',
      encabezadoTexto: '#ffffff',
    },
    signo: 'https://reservasae.com/signo-convoca.png',
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

  it('sin logos ni signo no queda ninguna imagen rota', () => {
    expect(carta({ logos: [], signo: null }).html).not.toContain('<img');
  });

  it('con logos van todos', () => {
    const c = carta({
      logos: [
        { url: 'https://reservasae.com/api/marca/logos/a?v=1', alt: 'BritCham' },
        { url: 'https://reservasae.com/api/marca/logos/b?v=2', alt: 'ADEE' },
      ],
    });
    // tres: el signo de la firma y los dos de la entidad
    expect((c.html.match(/<img/g) ?? []).length).toBe(3);
  });

  /// Tres logos con el mismo `alt` dejan la cabecera
  /// inservible con lector de pantalla.
  it('cada logo se nombra: la etiqueta es su texto alternativo', () => {
    const c = carta({
      logos: [
        { url: 'https://x.test/a', alt: 'BritCham Colombia' },
        { url: 'https://x.test/b', alt: 'ADEE' },
      ],
    });
    expect(c.html).toContain('alt="BritCham Colombia"');
    expect(c.html).toContain('alt="ADEE"');
    /// El signo SI va con `alt=""`, y es lo correcto: el
    /// nombre esta escrito al lado, asi que repetirlo seria
    /// hacer que el lector de pantalla lo diga dos veces.
    expect((c.html.match(/alt=""/g) ?? []).length).toBe(1);
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

describe('el orden de arriba', () => {
  /// Lo pidio el cliente: primero la firma de Convoca y
  /// DESPUES el logo de la entidad.
  it('la firma va antes que el logo de la entidad', () => {
    const c = carta({
      signo: 'https://x.test/signo-convoca.png',
      logos: [{ url: 'https://x.test/grupo-ae.png', alt: 'Grupo AE' }],
    });
    const firma = c.html.indexOf('signo-convoca.png');
    const entidad = c.html.indexOf('grupo-ae.png');
    const nombre = c.html.indexOf('>Convoca CRM</div>');
    expect(firma).toBeGreaterThan(-1);
    expect(firma).toBeLessThan(nombre);
    expect(nombre).toBeLessThan(entidad);
  });

  it('el eslogan va DEBAJO del nombre', () => {
    const c = carta();
    expect(c.html.indexOf('>Convoca CRM</div>')).toBeLessThan(
      c.html.indexOf('Relaciones que generan resultados'),
    );
  });

  it('la firma va sobre la banda del encabezado', () => {
    expect(carta().html).toContain('background:#702482');
  });

  it('sin signo la firma sigue saliendo', () => {
    const c = carta({ signo: null });
    expect(c.html).toContain('Convoca CRM');
    expect(c.html).not.toContain('signo-convoca');
  });
});

describe('cuál de los dos signos', () => {
  /// El del panel va en `currentColor`; aquí hay que elegir.
  it('un encabezado de texto claro pide el signo blanco', () => {
    expect(esClaro('#ffffff')).toBe(true);
    expect(esClaro('#e8edf7')).toBe(true);
  });

  it('uno oscuro pide el otro', () => {
    expect(esClaro('#0f172a')).toBe(false);
    expect(esClaro('#17121b')).toBe(false);
  });

  it('sin color se supone claro, que es lo de siempre', () => {
    expect(esClaro(undefined)).toBe(true);
    expect(esClaro('rojo')).toBe(true);
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
