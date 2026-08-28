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

/// Cómo se llama cada etapa cuando hay que decírselo a una
/// persona. Las del enum están en mayúscula sostenida y con
/// guion bajo.
export const ETAPA_EN_PALABRAS: Record<string, string> = {
  INTERESADO: 'interesado',
  CONTACTADO: 'contactado',
  DATOS_COMPLETOS: 'con datos completos',
  INSCRITO: 'inscrito',
  EN_FORMACION: 'en formación',
  CERTIFICADO: 'certificado',
  PERDIDO: 'perdido',
  RETIRADO: 'retirado',
  NO_APROBO: 'no aprobó',
  DESERTO: 'desertó',
  ABANDONO: 'abandonó',
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

  const donde = etapasPermitidas.map(enPalabras).join(', ');

  if (!etapaActual) {
    return `Esta plantilla es para quien esté ${donde}, y esta ficha no tiene etapa.`;
  }

  return (
    `Esta persona está ${enPalabras(etapaActual)} y esta plantilla es ` +
    `para quien esté ${donde}.`
  );
}
