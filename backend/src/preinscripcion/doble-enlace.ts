/** Un emisor de enlaces que no escribe nada. Para los tests. */

import type { EnlaceDeCompletado } from './enlace-de-completado';

/// Devuelve siempre el mismo token, para poder afirmar sobre
/// el sin que la prueba dependa del azar.
export function dobleDeEnlace(token = 'TOKEN-DE-PRUEBA'): EnlaceDeCompletado {
  const enlace = { token, expiraEn: new Date('2026-12-31T00:00:00Z') };
  return {
    vivo: async () => enlace,
    emitir: async () => enlace,
    emitirOReusar: async () => enlace,
  } as unknown as EnlaceDeCompletado;
}
