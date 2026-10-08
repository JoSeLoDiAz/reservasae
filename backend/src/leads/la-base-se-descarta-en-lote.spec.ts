/** En BBDD Leads se descarta en lote, como en la Mesa, y de cien en cien. */

/**
 * Pendiente 7 (7 oct 2026). La ruta `descartar-lote` ya existía y solo
 * la usaba la Mesa. BBDD Leads tenía casillas para marcar y solo
 * dejaba repartir.
 *
 * Y la tabla deja marcar «las N filtradas», que pasa del tope del
 * servidor: sin partir el lote en tramos, marcar toda la base y
 * repartirla o descartarla fallaba entera.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import 'reflect-metadata';

import { TOPE_DEL_LOTE_DE_LEADS } from './dto';

const pagina = () =>
  readFileSync(
    join(
      __dirname, '..', '..', '..',
      'frontend', 'src', 'app', 'admin', 'bbdd-leads', 'page.tsx',
    ),
    'utf8',
  );

const api = () =>
  readFileSync(
    join(__dirname, '..', '..', '..', 'frontend', 'src', 'lib', 'mesa-api.ts'),
    'utf8',
  );

describe('BBDD Leads descarta en lote', () => {
  it('la barra del lote ofrece descartar', () => {
    expect(pagina()).toContain('<DescartarLoteDeLaBase');
    expect(pagina()).toContain('mesaApi.descartarLote(tramo');
  });

  /// El motivo es obligatorio en el servidor; el botón no se enciende
  /// sin él para no mandar una petición que va a volver con error.
  it('sin motivo no se puede', () => {
    expect(pagina()).toContain('disabled={trabajando || !motivo.trim()}');
  });
});

describe('de cien en cien', () => {
  it('el tope de la pantalla es el del servidor', () => {
    expect(api()).toContain(
      `export const TOPE_DEL_LOTE = ${TOPE_DEL_LOTE_DE_LEADS};`,
    );
  });

  it('repartir y descartar van por tramos', () => {
    const p = pagina();
    expect(p).toContain('mesaApi.asignar(tramo, asesorId)');
    expect(p).not.toContain('mesaApi.asignar(ids,');
    expect((p.match(/enTramos\(ids\)/g) ?? []).length).toBe(2);
  });
});
