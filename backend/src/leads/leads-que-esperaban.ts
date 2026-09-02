/** Los leads que esa persona tenía esperando en la mesa. */

/**
 * El hueco que cierra, y que era real: el cruce funcionaba en un
 * solo sentido.
 *
 * Si el lead de Facebook llegaba DESPUÉS de que la persona ya
 * estuviera, `cruzar-con-el-crm` lo reconocía por su documento y
 * lo ataba a su ficha. Bien.
 *
 * Pero al revés no: el lead caía primero, la persona se
 * inscribía por su cuenta en el formulario público, y ese lead se
 * quedaba en «Sin atender» PARA SIEMPRE. Un asesor acababa
 * llamándola para ofrecerle un curso en el que ya estaba, la
 * cifra de pendientes contaba a quien no hay que atender, y —lo
 * peor para quien paga— la pauta que la trajo nunca constaba
 * como convertida.
 *
 * SOLO POR DOCUMENTO, y eso no es pereza.
 *
 * El cruce hacia atrás usa además correo y celular, pero ahí hay
 * un asesor que confirma antes de unir nada. Aquí no mira nadie:
 * corre solo al enviarse el formulario. Una familia que comparte
 * buzón acabaría con el lead de la madre cerrado por la
 * inscripción de la hija, y nadie se enteraría nunca.
 */

import { registrarToqueDeOrigen } from '../crm/origen-del-lead';

import type { OrigenParticipante } from '../../generated/prisma';

type Tx = {
  leadEntrante: {
    findMany(a: unknown): Promise<
      Array<{ id: string; origen: OrigenParticipante; origenSistema: string }>
    >;
    updateMany(a: unknown): Promise<{ count: number }>;
  };
  toqueDeOrigen: { upsert(a: unknown): Promise<unknown> };
};

/**
 * Ata a esta ficha los leads que la esperaban, y deja constancia
 * de por dónde llegó.
 *
 * Devuelve cuántos cerró. No lanza: que esto falle no puede
 * tumbar una inscripción que la persona ya completó.
 */
export async function cerrarLeadsQueEsperaban(
  tx: Tx,
  datos: {
    participanteId: string;
    convenioId: string;
    tipoDocumentoSepId: number;
    numeroDocumento: string;
  },
): Promise<number> {
  const esperando = await tx.leadEntrante.findMany({
    where: {
      convenioId: datos.convenioId,
      estado: 'PENDIENTE',
      participanteId: null,
      tipoDocumentoSepId: datos.tipoDocumentoSepId,
      numeroDocumento: datos.numeroDocumento,
    },
    select: { id: true, origen: true, origenSistema: true },
  });

  if (esperando.length === 0) return 0;

  /// Se atan TODOS los que esperaban, y ahora de verdad.
  ///
  /// Antes solo el primero podía apuntar a la ficha: los demás se
  /// cerraban sin vínculo, porque `participanteId` era @unique.
  /// Ese índice se quitó —decía «un participante, como mucho un
  /// lead», y el dominio dice lo contrario— así que los N se atan
  /// y en la ficha se ven los N.
  ///
  /// Importa para el comparativo: cada lead trae lo que la
  /// persona dijo en ese momento, y el que se quedaba sin vínculo
  /// desaparecía de la tabla que existe para compararlos.
  await tx.leadEntrante.updateMany({
    where: { id: { in: esperando.map((l) => l.id) } },
    data: {
      participanteId: datos.participanteId,
      estado: 'CONVERTIDO',
      procesadoEn: new Date(),
      motivo: 'La persona se inscribió por el formulario público.',
    },
  });

  /// Y la pauta se lleva su crédito.
  ///
  /// Se inscribió sola, sí, pero la trajo el anuncio. Sin esto la
  /// campaña que funcionó parece no haber funcionado, que es el
  /// mismo defecto que ya se arregló al pisar `origenLead`.
  ///
  /// `registrarToqueDeOrigen` no pisa el primer origen: lo suma
  /// al lado.
  for (const l of esperando) {
    await registrarToqueDeOrigen(tx, datos.participanteId, l.origen);
  }

  return esperando.length;
}
