/** Con qué se reconoce un lead que ya llegó. */

/**
 * Los webhooks reintentan, y quien los manda ni lo ve. Sin una
 * llave estable, un parpadeo de red crea dos personas.
 *
 * Se admiten dos llaves, en este orden:
 *
 *   1. `externoId` — el id del emisor, si lo tiene.
 *   2. El DOCUMENTO — que es la identidad en todo el sistema:
 *      `Persona` es única por `(tipoDocumentoSepId,
 *      numeroDocumento)`, así que usarlo aquí es la misma regla
 *      y no una segunda.
 *
 * El documento se NORMALIZA antes de formar la llave, y eso es
 * lo que hace que sirva: `1.020.304.050` y `1020304050` son la
 * misma cédula, y sin normalizar darían dos leads que nadie
 * relaciona. Es el mismo defecto que tuvo la preinscripción
 * pública.
 *
 * El prefijo `doc:` no es decorativo: sin él, un emisor cuyo
 * `externoId` fuera un número de cédula chocaría con el lead
 * derivado de esa misma cédula, y uno se comería al otro.
 */

import { normalizarDocumento } from '../comun/documento';

export type Llave = { llave: string } | { falta: string };

export function llaveDelLead(dto: {
  externoId?: string | null;
  tipoDocumentoSepId?: number | null;
  numeroDocumento?: string | null;
}): Llave {
  const propio = (dto.externoId ?? '').trim();
  if (propio) return { llave: propio };

  const numero = dto.numeroDocumento
    ? normalizarDocumento(dto.numeroDocumento)
    : null;
  const tipo = dto.tipoDocumentoSepId;

  if (numero && tipo !== null && tipo !== undefined) {
    return { llave: `doc:${tipo}-${numero}` };
  }

  /// Sin ninguna de las dos NO se guarda, y es deliberado.
  ///
  /// Este webhook no rechaza por datos flojos —un lead sin
  /// apellido entra igual— pero esto no es un dato flojo: es no
  /// tener con qué reconocerlo. Aceptarlo significa que el
  /// primer reintento crea un duplicado que nadie va a
  /// relacionar nunca, y limpiarlo después es a mano.
  return {
    falta:
      'Falta con qué reconocer este lead si vuelve. Mande el documento ' +
      '(tipoDocumentoSepId y numeroDocumento) o, si no lo tiene, un ' +
      'externoId propio. Sin una de las dos, un reintento crearía otra ' +
      'persona.',
  };
}
