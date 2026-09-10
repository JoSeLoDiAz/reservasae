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
      entraAlDirectorio({ nit: '860507033', razonSocial: 'Vise LTDA', esRutPropio: false }),
    ).toBe(true);
  });

  it('sin razón social, no: quedaría un NIT sin nombre', () => {
    /// El directorio existe para responder «¿de quién es este
    /// NIT?». Una fila sin nombre no responde nada y ensucia
    /// las búsquedas de todos los gremios.
    expect(
      entraAlDirectorio({ nit: '860507033', razonSocial: '', esRutPropio: false }),
    ).toBe(false);
    expect(
      entraAlDirectorio({ nit: '860507033', razonSocial: '   ', esRutPropio: false }),
    ).toBe(false);
  });

  it('sin NIT, no hay nada que apuntar', () => {
    expect(
      entraAlDirectorio({ nit: '', razonSocial: 'Vise LTDA', esRutPropio: false }),
    ).toBe(false);
  });
});

describe('la cédula de alguien NO entra, y es lo que más importa', () => {
  it('el trabajador independiente que usa su cédula de RUT queda fuera', () => {
    /// Ahí el «NIT» es la CÉDULA de una persona, y el
    /// directorio es una tabla COMPARTIDA de organizaciones que
    /// ven los dos gremios y que el buscador web recorre.
    ///
    /// Meter cédulas ahí es esparcir un dato personal a un
    /// sitio que nadie consideró personal — el mismo error que
    /// los .xlsx del SEP que hubo que sacar del historial.
    expect(
      entraAlDirectorio({
        nit: '1026300012',
        razonSocial: 'Mauricio Andrés Palma Mesa',
        esRutPropio: true,
      }),
    ).toBe(false);
  });

  it('ni aunque venga con todo lo demás bien', () => {
    expect(
      entraAlDirectorio({ nit: '52123456', razonSocial: 'Ana Gómez', esRutPropio: true }),
    ).toBe(false);
  });
});
