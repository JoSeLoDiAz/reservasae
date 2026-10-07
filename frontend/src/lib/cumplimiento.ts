/** Inscritos sobre la meta. Espejo del backend, atado por un spec. */

/**
 * LA MISMA REGLA QUE `backend/src/crm/proyeccion-metas.ts`.
 *
 * El panel la necesita porque la fila Total NO se promedia: se
 * recalcula sumando las filas, que es lo correcto --una acción con tres
 * leads pesaría igual que una con mil--. Pero recalcular con otra regla
 * es lo que hacía que el Total imprimiera una cifra donde todas sus
 * filas imprimían «—».
 *
 * `backend/src/crm/el-cumplimiento-no-se-separa.spec.ts` compara las dos
 * copias. Si alguien toca una, falla el build.
 */
export function cumplimiento(inscritos: number, meta: number): number | null {
  if (meta <= 0) return null;
  return inscritos / meta;
}
