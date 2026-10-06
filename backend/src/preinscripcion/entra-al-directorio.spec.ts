/** La organización que teclea la persona entra al directorio. */

/**
 * `empresas` e `instituciones` son dos tablas distintas a
 * propósito: la primera son las organizaciones del CRM, la
 * segunda el maestro de NIT compartido entre los gremios.
 *
 * Nadie las conectaba. Así que una organización que llegaba por
 * el formulario público quedaba en `empresas` y NO aparecía en
 * «Empresas registradas» ni la veía el buscador del RUES, que
 * trabaja sobre el directorio. Lo notó quien probaba: «debería
 * salir Vise porque es la que tiene asociada el lead».
 *
 * Lo que este spec fija es lo que entra y lo que NO.
 */

import { entraAlDirectorio } from './entra-al-directorio';

describe('lo que se apunta en el directorio', () => {
  it('una organización con NIT y nombre, sí', () => {
    expect(
      entraAlDirectorio({
        nit: '860507033',
        razonSocial: 'Vise LTDA',
        esRutPropio: false,
      }),
    ).toBe(true);
  });

  it('sin razón social, no: quedaría un NIT sin nombre', () => {
    /// El directorio existe para responder «¿de quién es este
    /// NIT?». Una fila sin nombre no responde nada y ensucia
    /// las búsquedas de todos los gremios.
    expect(
      entraAlDirectorio({
        nit: '860507033',
        razonSocial: '',
        esRutPropio: false,
      }),
    ).toBe(false);
    expect(
      entraAlDirectorio({
        nit: '860507033',
        razonSocial: '   ',
        esRutPropio: false,
      }),
    ).toBe(false);
  });

  it('sin NIT, no hay nada que apuntar', () => {
    expect(
      entraAlDirectorio({
        nit: '',
        razonSocial: 'Vise LTDA',
        esRutPropio: false,
      }),
    ).toBe(false);
  });
});

describe('el independiente con RUT entra, como cualquier otra', () => {
  /**
   * HASTA EL 1 OCT 2026 NO ENTRABA, Y ERA A PROPÓSITO.
   *
   * El argumento escrito era: ahí el «NIT» es la CÉDULA de una
   * persona, y el directorio es una tabla COMPARTIDA que ven los dos
   * gremios y que recorre el buscador web.
   *
   * El cliente revisó el caso y decidió al revés: «más allá de que no
   * sea un NIT es una empresa común y corriente, solo que cambia su
   * naturaleza o composición». Ante el SENA esa persona ES su unidad
   * económica y el F7 la reporta como tal, así que dejarla fuera del
   * maestro la volvía invisible justo donde se la busca: no salía en
   * «Empresas registradas», que es lo que él encontró.
   *
   * Este spec fija la decisión NUEVA. Si algún día se quiere acotar
   * ---no enseñarla fuera de su gremio, o que el buscador web no la
   * consulte--- eso va ENCIMA de esta regla, no en lugar de ella.
   */
  it('el trabajador independiente que usa su cédula de RUT entra', () => {
    expect(
      entraAlDirectorio({
        nit: '1026300012',
        razonSocial: 'Mauricio Andrés Palma Mesa',
        esRutPropio: true,
      }),
    ).toBe(true);
  });

  it('y le siguen aplicando las dos condiciones de siempre', () => {
    /// Ser independiente no lo exime: sin nombre o sin número no hay
    /// qué apuntar, igual que para una empresa.
    expect(
      entraAlDirectorio({
        nit: '52123456',
        razonSocial: '',
        esRutPropio: true,
      }),
    ).toBe(false);
    expect(
      entraAlDirectorio({
        nit: '',
        razonSocial: 'Ana Gómez',
        esRutPropio: true,
      }),
    ).toBe(false);
    expect(
      entraAlDirectorio({
        nit: '52123456',
        razonSocial: 'Ana Gómez',
        esRutPropio: true,
      }),
    ).toBe(true);
  });
});
