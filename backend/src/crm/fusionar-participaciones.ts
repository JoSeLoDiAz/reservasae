/** Unir dos fichas de la misma persona en acciones distintas. */

/**
 * «El sistema debe estar blindado. La única opción es crear una
 * herramienta de unificación para esos casos y dejar el lead de
 * acuerdo a qué AF realmente va a elegir, y fusionar los datos, pero
 * teniendo la posibilidad de CÓMO fusionarlos» (cliente, 1 oct 2026).
 *
 * El blindaje ---que «una sola acción de formación» guarde también la
 * puerta del panel--- evita los nuevos. Los que ya existen no se
 * arreglan solos: Alejandro está en AF2 desde septiembre con Julieth y
 * en AF6 desde hoy con Katherine, y las dos lo están llamando.
 *
 * QUÉ SE FUSIONA Y QUÉ NO, que es lo que decide si esto sirve.
 *
 * La PERSONA no se toca: es una sola, con un registro en `personas`.
 * Su nombre, su documento, su correo y su domicilio no están
 * duplicados y aquí no se tocan.
 *
 * Lo que está duplicado es la PARTICIPACIÓN, y de ella se elige:
 *   - cuál sobrevive ---o sea, a qué acción va de verdad---,
 *   - y campo por campo, de cuál de las dos sale cada valor.
 *
 * Y LO QUE NO SE ELIGE, PORQUE NO SE PIERDE NUNCA: las notas de
 * gestión, los movimientos de etapa, los leads de origen y los avances
 * del aula se MUEVEN todos a la que sobrevive. Esa es la gestión que
 * hicieron las dos asesoras, y una fusión que la tire convierte una
 * herramienta de orden en una de borrado.
 *
 * LA QUE PIERDE NO SE BORRA: se la quita de su curso por la misma
 * puerta de siempre ---`borrarParticipacion`---, que deja su
 * constancia. Y antes de quitarla ya se le han llevado sus notas.
 */

import type { EtapaParticipante } from '../../generated/prisma';

/// Lo que se puede elegir de dónde sale. Son los campos de la
/// PARTICIPACIÓN que pueden diferir entre las dos fichas; los de la
/// persona no están porque no están duplicados.
export const CAMPOS_FUSIONABLES = [
  'etapa',
  'asesorId',
  'empresaId',
  'cargoEnEmpresa',
  'nivelEducativo',
  'nivelOcupacional',
  'nivelOcupacionalSepId',
  'beneficiarioPrevio',
  'origenLead',
  'campanaDeEntrada',
] as const;

export type CampoFusionable = (typeof CAMPOS_FUSIONABLES)[number];

export type FichaParaFusionar = {
  id: string;
  etapa: EtapaParticipante;
  asesorId: string | null;
  empresaId: string | null;
  cargoEnEmpresa: string | null;
  nivelEducativo: string | null;
  nivelOcupacional: string | null;
  nivelOcupacionalSepId: number | null;
  beneficiarioPrevio: boolean | null;
  origenLead: string | null;
  campanaDeEntrada: string | null;
};

/**
 * Qué queda en la ficha que sobrevive.
 *
 * `deDonde` dice, por campo, de cuál de las dos fichas sale el valor.
 * Lo que no se nombre se queda como está en la que sobrevive: elegir
 * campo por campo es una ayuda, no una obligación de rellenar diez
 * casillas para unir dos fichas.
 *
 * NO SE ESCRIBE UN NULO ENCIMA DE UN DATO. Si se pide traer un campo
 * de la otra ficha y la otra lo tiene vacío, se deja el que ya había:
 * fusionar no puede perder datos, y una casilla mal pulsada no puede
 * borrar el asesor de alguien. Para vaciar un campo está su pantalla.
 */
export function comoQuedaLaFusion(
  conservar: FichaParaFusionar,
  absorbida: FichaParaFusionar,
  deDonde: Partial<Record<CampoFusionable, string>>,
): Partial<Record<CampoFusionable, unknown>> {
  const queda: Record<string, unknown> = {};

  for (const campo of CAMPOS_FUSIONABLES) {
    const pedida = deDonde[campo];
    if (!pedida || pedida === conservar.id) continue;
    if (pedida !== absorbida.id) continue;

    const valor = absorbida[campo];
    if (valor === null || valor === undefined) continue;
    queda[campo] = valor;
  }

  return queda;
}

/**
 * ¿Se pueden unir estas dos?
 *
 * Mismo convenio y misma persona, y no la misma ficha. Unir dos
 * personas distintas sería mezclar a dos seres humanos en uno; unir
 * entre gremios movería a alguien de convenio sin que nadie lo
 * decida, y el convenio es lo que se le reporta al SENA.
 */
export function porQueNoSePuedenUnir(
  conservar: { id: string; personaId: string; convenioId: string },
  absorbida: { id: string; personaId: string; convenioId: string },
): string | null {
  if (conservar.id === absorbida.id) {
    return 'Son la misma ficha.';
  }
  if (conservar.personaId !== absorbida.personaId) {
    return 'Son dos personas distintas. Unir fichas solo vale para la misma persona repetida en dos acciones.';
  }
  if (conservar.convenioId !== absorbida.convenioId) {
    return 'Están en gremios distintos, y el gremio es lo que se le reporta al SENA. Eso se corrige antes de unir.';
  }
  return null;
}
