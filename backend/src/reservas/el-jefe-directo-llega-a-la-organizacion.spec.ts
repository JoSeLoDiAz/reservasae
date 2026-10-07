/** Lo que la empresa escribe en el formulario llega a donde se busca. */

/**
 * «LAS PERSONAS LLENAN LOS DATOS DE EMPRESA EN EL FORMULARIO
 * PERSONALIZADO Y QUEDA LA NOTIFICACIÓN, PERO NO QUEDA, ¿SÍ ME
 * ENTIENDES?» (cliente, 7 oct 2026).
 *
 * Y era cierto, aunque el dato sí se guardaba. El nombre, el cargo y
 * el correo del jefe directo se escribían SOLO en la reserva, y
 * `faltaDeLaEmpresa` ---la regla que decide si una ficha pasa a datos
 * completos, y la que llena el F7--- los busca en la ORGANIZACIÓN.
 *
 * Resultado: la empresa los escribía, el sistema avisaba de la
 * reserva, y todas las fichas de esa empresa se quedaban en
 * «Interesado» pidiendo «nombre del jefe directo» para siempre. El
 * dato estaba guardado a un palmo de donde se buscaba, que es la peor
 * clase de fallo: todo parece funcionar.
 *
 * Se prueba leyendo el fuente porque `asegurarEmpresa` es privado y
 * vive dentro de una transacción; lo que hay que fijar es que los tres
 * campos entren en el escrito de la organización y que lo hagan SOLO
 * EN HUECO, porque esa ruta es pública.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FUENTE = readFileSync(join(__dirname, 'reservas.service.ts'), 'utf8');

/// El cuerpo de `asegurarEmpresa`, que es donde se escribe la
/// organización. Fuera de ahí, estos campos son los de la reserva.
const asegurar = () => {
  const i = FUENTE.indexOf('private async asegurarEmpresa');
  expect(i).toBeGreaterThan(-1);
  return FUENTE.slice(i);
};

describe('el jefe directo llega a la organización', () => {
  it('los tres campos entran en lo que se escribe', () => {
    const b = asegurar();
    expect(b).toContain('contactoNombre: dto.contactoNombre');
    expect(b).toContain('contactoCargo: dto.contactoCargo');
    expect(b).toContain('contactoCorreo: dto.contactoCorreo');
  });

  /**
   * SOLO EN HUECO, y es la mitad del arreglo.
   *
   * Esa ruta es PÚBLICA y sin sesión: pisar lo guardado dejaría que
   * cualquiera mandara una reserva con el NIT de una empresa real y
   * le cambiara el jefe directo, que es el correo al que después va
   * el reporte. Es la misma regla que ya protegía la razón social.
   */
  it('y no pisan lo que la organización ya tenía', () => {
    const b = asegurar();
    expect(b).toContain(
      'contactoNombre: yaExiste.contactoNombre || datos.contactoNombre',
    );
    expect(b).toContain(
      'contactoCargo: yaExiste.contactoCargo || datos.contactoCargo',
    );
    expect(b).toContain(
      'contactoCorreo: yaExiste.contactoCorreo || datos.contactoCorreo',
    );
  });

  /// Y hay que traérselos para poder mirar si están vacíos: sin esto
  /// `yaExiste.contactoNombre` es `undefined` siempre y la regla de
  /// arriba pisaría lo guardado sin querer.
  it('se leen los guardados antes de decidir', () => {
    const b = asegurar();
    const i = b.indexOf('select: {');
    expect(b.slice(i, i + 400)).toContain('contactoNombre: true');
  });
});

describe('y siguen estando en la reserva', () => {
  /**
   * No se mueven: en la reserva son el contacto de ESA reserva ---la
   * persona que la hizo, que puede cambiar entre una y otra--- y en
   * la organización son el jefe que viaja al F7. Son dos cosas con el
   * mismo nombre.
   */
  it('la reserva conserva su propio contacto', () => {
    const i = FUENTE.indexOf('const datos = {');
    expect(i).toBeGreaterThan(-1);
    const bloque = FUENTE.slice(i, FUENTE.indexOf('};', i));
    expect(bloque).toContain('contactoNombre: dto.contactoNombre');
    expect(bloque).toContain('contactoCelular');
  });
});
