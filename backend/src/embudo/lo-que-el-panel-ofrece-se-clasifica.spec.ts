/** Lo que el panel deja marcar, el servidor lo sabe clasificar. */

/// El armador de enlaces de `/admin/formularios-publicos` ofrece
/// un canal y lo escribe como `utm_source`. Si ofreciera uno que
/// `procedenciaSql()` no reconoce, ese envío caería en «Otro
/// declarado» — o sea, marcado y sin separar, que es lo mismo que
/// no marcarlo, y sin que nada falle. Dos verdades sobre la misma
/// decisión, el patrón de siempre.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { procedenciaSql } from './procedencia';

const ARCHIVO = join(
  __dirname,
  '..',
  '..',
  '..',
  'frontend',
  'src',
  'components',
  'admin',
  'formulario-publico.tsx',
);

/** Los `utm` que el panel ofrece en su desplegable. */
function canalesDelPanel(texto: string): string[] {
  const abre = texto.indexOf('export const CANALES_DEL_ENLACE = [');
  if (abre < 0) throw new Error('El panel no declara CANALES_DEL_ENLACE');
  const cierra = texto.indexOf('] as const;', abre);
  if (cierra < 0) throw new Error('CANALES_DEL_ENLACE sin cerrar');
  const cuerpo = texto.slice(abre, cierra);
  return [...cuerpo.matchAll(/utm:\s*"([^"]*)"/g)].map((m) => m[1]);
}

/// Los valores contra los que compara el `CASE`, tal como Prisma
/// los va a mandar. Se miran los PARÁMETROS y no el texto del
/// SQL, igual que en `procedencia.spec.ts`.
const RECONOCIDOS = new Set(
  (procedenciaSql().values as unknown[]).filter(
    (v): v is string => typeof v === 'string',
  ),
);

describe('los canales que ofrece el panel', () => {
  const canales = canalesDelPanel(readFileSync(ARCHIVO, 'utf8'));

  it('el panel ofrece alguno, y uno de ellos es no marcar', () => {
    expect(canales.length).toBeGreaterThan(1);
    expect(canales).toContain('');
  });

  it('todos los demás los clasifica el servidor', () => {
    const marcables = canales.filter((c) => c !== '');
    expect(marcables.length).toBeGreaterThan(0);
    for (const c of marcables) expect(RECONOCIDOS.has(c)).toBe(true);
  });

  /// El correo es el que motivó todo esto: un mailing sin
  /// etiqueta se contaba como «otra página web».
  it('el correo está entre lo que se puede marcar', () => {
    expect(canales).toContain('correo');
  });

  /// La pauta SI se ofrece desde el 18 sep 2026, y solo como
  /// `meta`: el enlace del anuncio no sabe si se vio en Facebook o
  /// en Instagram, y ofrecer una de las dos seria inventarlo.
  it('la pauta se marca como Meta, nunca como una red concreta', () => {
    expect(canales).toContain('meta');
    for (const prohibido of ['fb', 'facebook', 'ig', 'instagram']) {
      expect(canales).not.toContain(prohibido);
    }
  });
});
