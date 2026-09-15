/** El lector del registro de nginx. */

/**
 * Las líneas de este spec son de PRODUCCIÓN, copiadas del
 * `access_log` del 13 y el 14 de septiembre de 2026 con la IP
 * cambiada. Inventarlas dejaría el lector probado contra el
 * formato que yo creo que tiene nginx, que es justo el error
 * que hay que evitar aquí.
 */

import {
  diaBogota,
  hostDe,
  interpretarLinea,
  navegadorDe,
  reconstruir,
} from './leer-registro';

/// Las cuatro peticiones que deja una visita de la pauta.
const HTML =
  '181.51.1.1 - - [13/Sep/2026:14:02:11 +0000] "GET /adecopria/preinscripcion?utm_source=fb&utm_medium=paid&fbclid=IwAR123 HTTP/1.1" 200 20458 "https://m.facebook.com/" "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 [FBAN/FB4A;FBAV/470.0]" "-"';
const CATALOGO =
  '181.51.1.1 - - [13/Sep/2026:14:02:13 +0000] "GET /api/preinscripcion/adecopria HTTP/1.1" 200 8814 "https://adecopria.reservasae.com/adecopria/preinscripcion" "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 [FBAN/FB4A;FBAV/470.0]" "-"';
const ENVIO =
  '181.51.1.1 - - [13/Sep/2026:14:08:24 +0000] "POST /api/preinscripcion/adecopria HTTP/1.1" 201 312 "https://adecopria.reservasae.com/adecopria/preinscripcion" "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 [FBAN/FB4A;FBAV/470.0]" "-"';
const ROBOT =
  '66.220.149.1 - - [13/Sep/2026:14:00:02 +0000] "GET /api/preinscripcion/adecopria HTTP/1.1" 200 8814 "-" "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" "-"';
const BALIZA =
  '181.51.1.1 - - [14/Sep/2026:23:30:00 +0000] "POST /api/preinscripcion/adecopria/paso HTTP/1.1" 204 0 "-" "Mozilla/5.0" "-"';

/// 15 sep 2026, 00:00 UTC. Todo lo de antes se reconstruye.
const CORTE = Date.parse('2026-09-15T00:00:00Z');

describe('interpretar una línea', () => {
  it('saca las siete piezas de una línea de verdad', () => {
    const p = interpretarLinea(HTML)!;

    expect(p.ip).toBe('181.51.1.1');
    expect(p.metodo).toBe('GET');
    expect(p.ruta).toBe('/adecopria/preinscripcion');
    expect(p.consulta).toContain('utm_source=fb');
    expect(p.estado).toBe(200);
    expect(p.referente).toBe('https://m.facebook.com/');
    expect(p.agente).toContain('FBAV');
  });

  it('un guion en el referente es que no hubo, no la cadena "-"', () => {
    expect(interpretarLinea(ROBOT)!.referente).toBe('');
  });

  it('lo que no es una línea de nginx devuelve null', () => {
    expect(interpretarLinea('')).toBeNull();
    expect(interpretarLinea('2026/09/13 [error] 7#7: *1 upstream')).toBeNull();
  });

  it('el día es el de BOGOTÁ, no el de UTC', () => {
    /// Las 23:30 UTC del 14 son las 18:30 del 14 en Bogotá; las
    /// 02:00 UTC del 15 son las 21:00 del 14. Con el día de UTC,
    /// las cinco horas de tarde-noche --cuando la gente
    /// diligencia-- se cargan al día siguiente.
    expect(diaBogota(Date.parse('2026-09-14T23:30:00Z'))).toBe('2026-09-14');
    expect(diaBogota(Date.parse('2026-09-15T02:00:00Z'))).toBe('2026-09-14');
    expect(diaBogota(Date.parse('2026-09-15T05:00:00Z'))).toBe('2026-09-15');
  });

  it('honra el desfase de la propia línea', () => {
    const conDesfase = HTML.replace('+0000', '-0500');
    /// 14:02 en -0500 son las 19:02 UTC, o sea las 14:02 de
    /// Bogotá: el mismo día.
    expect(diaBogota(interpretarLinea(conDesfase)!.ms)).toBe('2026-09-13');
  });
});

describe('el navegador y el referente', () => {
  it('distingue las dos apps de Meta, con Instagram primero', () => {
    expect(navegadorDe('Mozilla/5.0 [FBAN/FB4A;FBAV/470.0]')).toBe(
      'APP_FACEBOOK',
    );
    expect(navegadorDe('Mozilla/5.0 Instagram 446.0.0.49.77 Android')).toBe(
      'APP_INSTAGRAM',
    );
    /// El navegador de Instagram manda TAMBIEN las marcas de
    /// Facebook en algunas versiones, y al revés no pasa.
    expect(navegadorDe('Instagram 446 [FBAV/470.0]')).toBe('APP_INSTAGRAM');
    expect(navegadorDe('Mozilla/5.0 (iPhone) Safari/604.1')).toBe('OTRO');
  });

  it('del referente sale el HOST y nada más', () => {
    /// Nunca la URL entera: ahí caben datos de la página
    /// anterior. Es lo mismo que manda la baliza.
    expect(hostDe('https://m.facebook.com/algo?x=1')).toBe('m.facebook.com');
    expect(hostDe('no es una url')).toBe('');
    expect(hostDe('')).toBe('');
  });
});

describe('reconstruir el tráfico', () => {
  it('una visita completa es una fila con su procedencia cruda', () => {
    const filas = reconstruir([HTML, CATALOGO, ENVIO], CORTE);

    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      dia: '2026-09-13',
      slug: 'adecopria',
      referente: 'm.facebook.com',
      utmFuente: 'fb',
      huboFbclid: true,
      navegador: 'APP_FACEBOOK',
      visitas: 1,
      envios: 1,
    });
  });

  it('NO clasifica la procedencia: eso lo hace el mismo SQL de siempre', () => {
    const filas = reconstruir([HTML, CATALOGO], CORTE);
    /// Si el lector dijera «FACEBOOK», habría dos
    /// clasificadores y la misma visita saldría de dos maneras
    /// según de qué fuente venga.
    expect(Object.keys(filas[0])).not.toContain('procedencia');
  });

  it('sin pedir el catálogo no hay visita', () => {
    /// El HTML lo piden también los rastreadores que no
    /// ejecutan JavaScript; el catálogo solo lo pide el
    /// formulario ya dibujado. Es el mismo denominador que usa
    /// la pantalla.
    expect(reconstruir([HTML], CORTE)).toHaveLength(0);
  });

  it('los rastreadores no cuentan', () => {
    expect(reconstruir([ROBOT], CORTE)).toHaveLength(0);
  });

  it('la baliza del embudo NO se cuenta como envío', () => {
    /// `/paso` es lo que ya está medido de verdad. Contarlo
    /// aquí sería contar dos veces por dos caminos.
    const filas = reconstruir([HTML, CATALOGO, BALIZA], CORTE);
    expect(filas[0].envios).toBe(0);
  });

  it('lo posterior al corte no se reconstruye', () => {
    /// Desde que arrancó el contador manda la medición de
    /// verdad. Sin el corte, el mismo día se contaría dos
    /// veces.
    const antes = Date.parse('2026-09-13T00:00:00Z');
    expect(reconstruir([HTML, CATALOGO], antes)).toHaveLength(0);
  });

  it('una IP que vuelve el mismo día es UNA visita', () => {
    const otraVez = CATALOGO.replace('14:02:13', '19:40:00');
    const filas = reconstruir([HTML, CATALOGO, otraVez], CORTE);

    expect(filas).toHaveLength(1);
    expect(filas[0].visitas).toBe(1);
  });

  it('la misma IP al día siguiente son dos visitas', () => {
    const filas = reconstruir(
      [
        HTML,
        CATALOGO,
        HTML.replace('13/Sep', '14/Sep'),
        CATALOGO.replace('13/Sep', '14/Sep'),
      ],
      CORTE,
    );

    expect(filas).toHaveLength(2);
    expect(filas.map((f) => f.dia)).toEqual(['2026-09-13', '2026-09-14']);
  });

  it('la atribución sale del PRIMER HTML del día, no del último', () => {
    /// El segundo ya lleva nuestro propio dominio de referente:
    /// quedarse con él borraría de dónde vino de verdad.
    const segundo = HTML.replace('14:02:11', '14:30:00')
      .replace('?utm_source=fb&utm_medium=paid&fbclid=IwAR123', '')
      .replace('https://m.facebook.com/', 'https://adecopria.reservasae.com/');

    const filas = reconstruir([segundo, HTML, CATALOGO], CORTE);
    expect(filas[0].referente).toBe('m.facebook.com');
    expect(filas[0].huboFbclid).toBe(true);
  });

  it('dos IPs con la misma procedencia se suman en una fila', () => {
    const otra = (l: string) => l.replace('181.51.1.1', '190.60.2.2');
    const filas = reconstruir(
      [HTML, CATALOGO, otra(HTML), otra(CATALOGO), otra(ENVIO)],
      CORTE,
    );

    expect(filas).toHaveLength(1);
    expect(filas[0].visitas).toBe(2);
    expect(filas[0].envios).toBe(1);
  });

  it('la IP no sale de la función', () => {
    /// Es un dato personal en Colombia. Se usa para agrupar y
    /// muere dentro: de aquí solo salen conteos.
    const filas = reconstruir([HTML, CATALOGO, ENVIO], CORTE);
    expect(JSON.stringify(filas)).not.toContain('181.51.1.1');
  });

  it('la raíz del subdominio no se atribuye, y por eso no entra', () => {
    /// nginx registra `GET /` y el formato `combined` no guarda
    /// el Host: no hay de dónde sacar el gremio.
    const raiz = HTML.replace('/adecopria/preinscripcion?', '/?');
    const filas = reconstruir([raiz, CATALOGO], CORTE);

    /// La visita sí cuenta --el catálogo sí lleva el slug--,
    /// pero sin procedencia: no se inventa.
    expect(filas).toHaveLength(1);
    expect(filas[0].referente).toBe('');
    expect(filas[0].navegador).toBe('OTRO');
  });

  it('un envío que no fue 201 no cuenta', () => {
    const rechazado = ENVIO.replace('" 201 ', '" 400 ');
    const filas = reconstruir([HTML, CATALOGO, rechazado], CORTE);
    expect(filas[0].envios).toBe(0);
  });
});
