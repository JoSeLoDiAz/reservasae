/** En qué etapa tiene sentido cada plantilla. */

/// Una «confirmación de inscripción» a quien todavía no está
/// inscrito es una mentira firmada por el gremio, y de las
/// que no se recogen: la persona se queda esperando un cupo
/// que nadie le dio, y se entera el día que llame.
///
/// Vive aparte porque lo usan los dos lados: la lista que
/// pinta el desplegable y la compuerta del envío. Si cada uno
/// llevara su copia, un día el desplegable ofrecería una que
/// el servidor rechaza, y quien la escogió no entendería por
/// qué.

import type { EtapaParticipante } from '../../../generated/prisma';

/**
 * TODAS las etapas, y a propósito todas.
 *
 * El primer intento dejó fuera las de salida --PERDIDO,
 * RETIRADO, NO_APROBO, DESERTO, ABANDONO-- con el argumento
 * de que a quien se fue no se le escribe. Es falso, y es
 * justo al revés: a esa persona es a la que hay que
 * escribirle. «No quedó seleccionado esta vez», «lo
 * esperamos en la próxima convocatoria», «cuéntenos por qué
 * lo dejó». Sin esas etapas, el sistema solo sabe felicitar.
 *
 * El orden es el del recorrido: primero el embudo, luego los
 * finales buenos, luego los que no lo son.
 */
export const TODAS_LAS_ETAPAS = [
  'INTERESADO',
  'CONTACTADO',
  'DATOS_COMPLETOS',
  'INSCRITO',
  'EN_FORMACION',
  'CERTIFICADO',
  'NO_APROBO',
  'DESERTO',
  'ABANDONO',
  'RETIRADO',
  'PERDIDO',
] as const;

/// Cómo se llama cada etapa cuando hay que decírselo a una
/// persona. Las del enum están en mayúscula sostenida y con
/// guion bajo.
///
/// SON LAS MISMAS PALABRAS DEL PANEL, EN MINÚSCULA. Este mapa se
/// había quedado fuera de la regla de «una etapa, un nombre»: el
/// panel decía «No calificó» y este aviso «no cerró» para el mismo
/// `NO_APROBO`, así que quien leía el bloqueo buscaba en el
/// selector una casilla que no existía. Desde el 18 sep 2026 dice
/// lo mismo que `ETIQUETA_ETAPA` (`frontend/src/lib/crm-api.ts`) y
/// que el embudo, y `correo/campanas/una-etapa-un-nombre.spec.ts`
/// lo compara con los otros cuatro sitios.
///
/// Se quitó el «con» de «con datos completos» y «con propuesta
/// enviada»: el aviso de abajo pone cada nombre entre comillas,
/// como una etiqueta, y una etiqueta no lleva preposición.
export const ETAPA_EN_PALABRAS: Record<string, string> = {
  INTERESADO: 'solicitud de negocio',
  CONTACTADO: 'contactado',
  DATOS_COMPLETOS: 'calificado',
  INSCRITO: 'cotización enviada',
  EN_FORMACION: 'en negociación',
  CERTIFICADO: 'cerrado ganado',
  PERDIDO: 'cerrado perdido',
  RETIRADO: 'canceló',
  NO_APROBO: 'no aprobó la compra',
  DESERTO: 'desistió',
  ABANDONO: 'dejó de responder',
};

export function enPalabras(e: string): string {
  return ETAPA_EN_PALABRAS[e] ?? e.toLocaleLowerCase('es-CO');
}

/**
 * Por qué NO se le puede mandar esta plantilla, o null.
 *
 * Lista vacía quiere decir «en cualquier etapa», y es lo que
 * valía antes de que esto existiera: las plantillas que ya
 * están escritas no cambian de comportamiento.
 */
export function porQueNo(
  etapasPermitidas: EtapaParticipante[],
  etapaActual: EtapaParticipante | null,
): string | null {
  if (etapasPermitidas.length === 0) return null;
  if (etapaActual && etapasPermitidas.includes(etapaActual)) return null;

  /// Cada nombre entre comillas, como en la etapa actual. Sin
  /// ellas la frase se partía: «para quien esté en canceló, dejó
  /// de responder» no se lee como dos etapas sino como una
  /// oración rota. Con comillas se lee como lo que es, una lista
  /// de casillas del selector.
  const donde = etapasPermitidas.map((e) => `«${enPalabras(e)}»`).join(', ');

  /// «Ficha» y no «oportunidad»: la etapa que se mira es la del
  /// contacto, no la del negocio, y es lo mismo que dice la
  /// pantalla de campañas —«la etapa es la de su ficha»—.
  if (!etapaActual) {
    return `Esta plantilla es solo para ${donde}, y esta ficha no tiene etapa.`;
  }

  return (
    `Esta persona está en la etapa «${enPalabras(etapaActual)}» y esta plantilla es ` +
    `solo para ${donde}.`
  );
}
