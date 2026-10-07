/** El departamento y la ciudad del lead tienen por dónde salir. */

/**
 * «SI TENGO DEPARTAMENTO NO QUEDA NI NADA» (cliente, 7 oct 2026),
 * sobre su base de 1.252 personas recién cargada en BBDD Leads.
 *
 * El dato se cargaba bien y se guardaba bien: `departamentoSepId` y
 * `municipioSepId` llevan en el modelo desde el principio, y son los
 * que deciden qué sede le toca a cada quien. Lo que no tenía era
 * SALIDA: viajaban solo dentro de `crudo`, que es lo que rellena el
 * formulario de corrección y no se enseña en ninguna tabla.
 *
 * Desde fuera, un dato guardado que no sale por ninguna parte es
 * exactamente igual que un dato que no se cargó. Por eso lo que se
 * fija aquí no es que se GUARDE ---eso ya estaba--- sino que el
 * servidor lo DEVUELVA, con nombre y fuera de `crudo`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FUENTE = readFileSync(
  join(__dirname, 'mesa-de-entrada.service.ts'),
  'utf8',
);

/// El trozo que arma la fila, hasta donde empieza `crudo`: lo de
/// dentro de `crudo` no cuenta, que es justo el defecto.
const FILA = FUENTE.slice(
  FUENTE.indexOf('porDonde: l.origenSistema'),
  FUENTE.indexOf('crudo: {'),
);

describe('la fila del lead dice dónde vive', () => {
  it('trae el departamento, y FUERA de `crudo`', () => {
    expect(FILA).toContain('departamento: l.departamentoSepId');
  });

  it('y la ciudad', () => {
    expect(FILA).toContain('ciudad: l.municipioSepId');
  });

  /**
   * Y CON NOMBRE, NO CON EL NÚMERO DEL SEP. Mandar el id obligaría a
   * la pantalla a tener su propia copia del catálogo ---una segunda
   * verdad, que envejece sola y en silencio---. Es la misma lección
   * del documento, que salía como «1 · 1020304050».
   */
  it('resueltos contra el catálogo del SEP, que vive aquí', () => {
    expect(FILA).toContain('DEPARTAMENTO_POR_ID.get');
    expect(FILA).toContain('MUNICIPIO_POR_ID.get');
  });

  /**
   * Y LOS MISMOS QUE DECIDEN LA SEDE. Si la columna saliera de un
   * sitio y la sede de otro, la pantalla podría decir «ANTIOQUIA» y
   * la conversión buscar cobertura en otro departamento: el asesor
   * leería una cosa y pasaría otra, sin nada que lo delate.
   */
  it('y son los mismos campos con los que se resuelve la sede', () => {
    const sede = FUENTE.slice(
      FUENTE.indexOf('const o = sedeQueTendra('),
      FUENTE.indexOf('return o?.ubicacion.nombre'),
    );
    expect(sede).toContain('DEPARTAMENTO_POR_ID.get(l.departamentoSepId)');
    expect(sede).toContain('MUNICIPIO_POR_ID.get(l.municipioSepId)');
  });
});
