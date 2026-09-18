/** Los dominios se comparan con frontera de punto. */

/// Las dos formas cortas estuvieron escritas y las dos estaban
/// mal, cada una en un sentido: `LIKE '%facebook.com'` casa
/// `notfacebook.com`, y `LIKE 'google.%'` NO casa `www.google.com`,
/// que es justo lo que manda el navegador. Se fueron a producción
/// y las encontró una revisión, no un test. Este es el test.

import { procedenciaSql, PROCEDENCIAS } from './procedencia';

/// Los valores que Prisma va a mandar como parámetros. La forma
/// del SQL no se inspecciona: lo que importa es con qué se compara.
function parametros(): string[] {
  const sql = procedenciaSql();
  return (sql.values as unknown[]).filter((v): v is string => typeof v === 'string');
}

describe('cómo se comparan los dominios', () => {
  const valores = parametros();

  /// Un patrón que ACABA en `.%` compara por prefijo, y el host
  /// real casi siempre empieza por `www.`.
  it('no compara ningún dominio por prefijo', () => {
    const porPrefijo = valores.filter((v) => !v.startsWith('%') && v.endsWith('%'));
    expect(porPrefijo).toEqual([]);
  });

  /// `%facebook.com` sin el punto casa `notfacebook.com`.
  it('todo comodín de sufijo lleva el punto de frontera', () => {
    const sufijos = valores.filter((v) => v.startsWith('%'));
    expect(sufijos.length).toBeGreaterThan(0);
    for (const s of sufijos) expect(s.startsWith('%.')).toBe(true);
  });

  /// Cada dominio va dos veces: exacto y como sufijo. Si falta
  /// una, o `google.com` a secas no entra, o `www.google.com` no.
  it('cada dominio se compara exacto Y como sufijo', () => {
    const sufijos = valores.filter((v) => v.startsWith('%.')).map((v) => v.slice(2));
    const exactos = new Set(valores.filter((v) => !v.includes('%')));
    for (const d of sufijos) expect(exactos.has(d)).toBe(true);
  });

  it('busca los buscadores que de verdad usa la gente', () => {
    for (const d of ['google.com', 'bing.com', 'duckduckgo.com']) {
      expect(valores).toContain(d);
      expect(valores).toContain(`%.${d}`);
    }
  });

  /// WhatsApp Web si deja referente, y se estaba contando como
  /// «otra pagina web» (18 sep 2026).
  it('reconoce WhatsApp Web por su referente', () => {
    expect(valores).toContain('whatsapp.com');
  });

  it('el CASE nombra todas las procedencias declaradas', () => {
    const texto = procedenciaSql().strings.join(' ');
    for (const p of PROCEDENCIAS) expect(texto).toContain(`'${p}'`);
  });
});
