/** Nadie le habla al backend sin mirar si falló. */

/// `pedir()` dice de sí mismo que es «la única puerta de
/// salida al backend»: esto lo comprueba. Un `fetch` crudo que
/// no mira `ok` castea el cuerpo del error a lo que esperaba
/// —y en la carga masiva eso reventaba la pantalla y, peor,
/// seguía adelante como si hubiera funcionado.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const PANEL = join(__dirname, '..', '..', '..', 'frontend', 'src');

/**
 * Los que hablan por su cuenta, y por qué.
 *
 * Quien añada uno tiene que decir por qué no pasa por la
 * puerta común.
 */
const APARTE: Record<string, string> = {
  'lib/pedir.ts': 'es la puerta',
  'components/firma-convoca.tsx':
    'la versión del pie: mira ok y sin ella la firma sale igual',
  'lib/campanas-api.ts': 'multipart propio; mira ok y manda el gremio',
  'lib/plantillas-correo-api.ts': 'multipart propio; mira ok y manda el gremio',
  'lib/plantillas-api.ts': 'multipart propio; mira ok y manda el gremio',
};

function fuentes(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return fuentes(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });
}

const crudos = fuentes(PANEL).flatMap((archivo) => {
  const texto = readFileSync(archivo, 'utf8');
  const relativo = relative(PANEL, archivo).split(sep).join('/');
  const cuantos = (texto.match(/fetch\(\s*[`"']\/api/g) ?? []).length;
  return cuantos ? [{ relativo, cuantos }] : [];
});

describe('el panel habla con el backend por una sola puerta', () => {
  it('encontró el código del panel', () => {
    expect(fuentes(PANEL).length).toBeGreaterThan(50);
    expect(crudos.length).toBeGreaterThan(0);
  });

  it.each(crudos.map((c) => [c.relativo]))(
    '%s no llama a /api por su cuenta',
    (relativo: string) => {
      expect(APARTE[relativo]).toBeDefined();
    },
  );

  it('lo apartado sigue existiendo: nada sobra en la lista', () => {
    for (const archivo of Object.keys(APARTE)) {
      expect(crudos.map((c) => c.relativo)).toContain(archivo);
    }
  });
});
