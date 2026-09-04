/** Con qué rol se presenta la cuenta en la cabecera. */

/// `RolAdmin` solo dice si es superadmin: lo que gobierna es
/// la concesión, y era lo que no llegaba a la pantalla.

import type { RolAdmin, RolConvenio } from '../../generated/prisma';

export type AmbitoDeRol = {
  roles: Record<string, RolConvenio[]>;
  gremioElegido: string | null;
  concedidos: string[];
};

/**
 * Su concesión, si es UNA sola. Null si no.
 *
 * Null también para el superadmin: ahí lo que hay que leer es
 * que es superadmin, no en qué gremio.
 */
export function rolQueSeEnsena(
  rolAdmin: RolAdmin,
  ambito: AmbitoDeRol,
): RolConvenio | null {
  if (rolAdmin === 'SUPERADMIN') return null;

  // por el subdominio manda el gremio de la direccion
  const gremios = ambito.gremioElegido
    ? [ambito.gremioElegido]
    : ambito.concedidos;

  const suyos = new Set(gremios.flatMap((g) => ambito.roles[g] ?? []));
  return suyos.size === 1 ? [...suyos][0] : null;
}
