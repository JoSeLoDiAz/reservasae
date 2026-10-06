/** Cuántas plazas de una oferta están ocupadas de verdad. */

/**
 * SON DOS COSAS Y EL SISTEMA SOLO CONTABA UNA.
 *
 * `Oferta.cuposOcupados` lo mueve SOLO `reservas.service.ts`: son las
 * plazas que una empresa aparta. En `admin.service.ts` hasta se llama
 * `cuposReservados`, que es lo que es.
 *
 * Quien se inscribe por su cuenta ---la mayoría--- no estaba en ningún
 * contador. Así que todo lo que restaba `cuposMaximos - cuposOcupados`
 * creía que había sitio de más.
 *
 * Lo vio el cliente el 2 oct 2026 comparando dos pantallas: el sitio
 * público decía 422 libres en AF1, y el panel de la misma acción decía
 * 520 de tope, 98 apartados y 120 personas ya dentro. 520 − 98 = 422.
 * La cuenta cuadraba exactamente en las cuatro acciones.
 *
 * ESTE FICHERO EXISTE PORQUE LA CUENTA ESTABA COPIADA EN SIETE SITIOS,
 * y arreglarla en uno dejó al de al lado diciendo otra cosa: el catálogo
 * pasó a contar bien mientras la preinscripción seguía con el número
 * viejo, o sea las dos pantallas públicas contradiciéndose. Una
 * decisión en siete copias se arregla seis veces y la séptima se queda.
 */

import { OCUPAN_SILLA } from '../crm/etapas';

/**
 * Las plazas ocupadas de una oferta.
 *
 * NO SE SUMAN TODOS LOS INSCRITOS, y esa es la parte delicada: quien
 * entró POR una reserva de empresa ya está contado en `apartadas` ---la
 * empresa apartó su plaza--- y contarlo otra vez cerraría ofertas que
 * tienen sitio, que es el daño opuesto y igual de malo.
 */
export function plazasOcupadas(
  apartadas: number,
  porSuCuenta: number,
): number {
  return apartadas + porSuCuenta;
}

/// Lo mínimo que hace falta para preguntar. Se declara así ---y no con
/// `PrismaService`--- para poder pasarle también el `tx` de una
/// transacción, que es donde lo necesita el camino que escribe.
type PuedeContar = {
  participante: {
    groupBy: (args: unknown) => Promise<
      Array<{ ofertaId: string | null; _count: { _all: number } }>
    >;
  };
};

/**
 * Cuánta gente entró POR SU CUENTA en cada oferta, por su id.
 *
 * `reservaId: null` es la clave: separa a quien se inscribió solo de
 * quien vino nominado por la reserva de una empresa. Ese campo existe
 * justamente para marcar esa diferencia.
 *
 * `OCUPAN_SILLA` y no «todos los participantes»: un lead interesado no
 * ocupa nada, y contarlo cerraría la oferta a gente que todavía puede
 * entrar.
 */
export async function inscritosPorSuCuenta(
  db: PuedeContar,
  ofertaIds: string[],
): Promise<Map<string, number>> {
  if (ofertaIds.length === 0) return new Map();

  const filas = await db.participante.groupBy({
    by: ['ofertaId'],
    where: {
      ofertaId: { in: ofertaIds },
      reservaId: null,
      etapa: { in: OCUPAN_SILLA },
    },
    _count: { _all: true },
  });

  return new Map(
    filas
      .filter((f): f is { ofertaId: string; _count: { _all: number } } =>
        Boolean(f.ofertaId),
      )
      .map((f) => [f.ofertaId, f._count._all]),
  );
}

/** Lo mismo para una sola oferta, que es lo que pide el que escribe. */
export async function ocupadasDeLaOferta(
  db: PuedeContar,
  oferta: { id: string; cuposOcupados: number },
): Promise<number> {
  const sueltos = await inscritosPorSuCuenta(db, [oferta.id]);
  return plazasOcupadas(oferta.cuposOcupados, sueltos.get(oferta.id) ?? 0);
}
