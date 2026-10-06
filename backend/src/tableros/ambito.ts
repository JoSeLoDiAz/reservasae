/** El filtro por convenio, escrito una sola vez. */

import { Prisma } from '../../generated/prisma';

/**
 * Cada tabla llega al convenio por un camino distinto y
 * escribirlo 28 veces es garantizar que uno salga mal.
 * Un ámbito vacío no devuelve nada, que es lo correcto
 * cuando la cuenta no tiene concesión en ningún convenio.
 */

export const deConvenio = (ambito: string[]) => ({
  convenioId: { in: ambito },
});

/// La oferta cuelga de la acción.
export const ofertaDeConvenio = (
  ambito: string[],
): Prisma.OfertaWhereInput => ({
  accionFormacion: { convenioId: { in: ambito } },
});

/// La reserva cuelga de la oferta, que cuelga de la acción.
export const reservaDeConvenio = (
  ambito: string[],
): Prisma.ReservaWhereInput => ({
  oferta: { accionFormacion: { convenioId: { in: ambito } } },
});

/// La cobertura cuelga del grupo.
export const coberturaDeConvenio = (
  ambito: string[],
): Prisma.GrupoCoberturaWhereInput => ({
  grupo: { accionFormacion: { convenioId: { in: ambito } } },
});

/// La empresa no cuelga de nada: se la reconoce por tener
/// al menos una reserva dentro del ámbito.
export const empresaDeConvenio = (
  ambito: string[],
): Prisma.EmpresaWhereInput => ({
  reservas: { some: reservaDeConvenio(ambito) },
});

/**
 * La organización del ámbito, HAYA RESERVADO O NO.
 *
 * `empresaDeConvenio` reconoce a la empresa por tener una reserva, y
 * para las tarjetas de reservas está bien: ahí la pregunta es cuántas
 * han apartado cupos. Pero EL LISTADO DE ORGANIZACIONES no pregunta
 * eso, y usándolo se comía a todas las que entraron por otra puerta.
 *
 * Por el formulario público la persona declara su organización ---o su
 * RUT, si es independiente--- y ahí NO HAY NINGUNA RESERVA. Esas
 * organizaciones existen, tienen gente inscrita y cuelgan de ellas sus
 * participantes, pero el listado no las enseñaba NUNCA. «En dónde queda
 * el listado de empresas, no veo las de RUT» (cliente, 2 oct 2026);
 * medido en la base de pruebas: de 31 organizaciones solo salían 13, y
 * cinco tenían gente inscrita detrás.
 *
 * No se tocó `empresaDeConvenio` porque sus otros dos usos ---la
 * tarjeta de organizaciones del tablero y el corte por tamaño--- viven
 * entre cifras de reservas, y ahí mezclar las que no han reservado
 * cambiaría lo que esas cifras han dicho siempre. Son dos preguntas
 * distintas y ahora cada una tiene la suya.
 */
export const organizacionDeConvenio = (
  ambito: string[],
): Prisma.EmpresaWhereInput => ({
  OR: [
    { reservas: { some: reservaDeConvenio(ambito) } },
    { participantes: { some: { convenioId: { in: ambito } } } },
  ],
});

/// La respuesta cuelga de la reserva.
export const respuestaDeConvenio = (
  ambito: string[],
): Prisma.RespuestaWhereInput => ({
  reserva: reservaDeConvenio(ambito),
});

/**
 * Para el SQL crudo. Devuelve el fragmento que ata la
 * consulta al ámbito, listo para intercalar en el WHERE.
 * Un ámbito vacío produce `FALSE`, no un IN () inválido.
 */
export function sqlDeConvenio(
  ambito: string[],
  aliasReserva = 'r',
): Prisma.Sql {
  if (ambito.length === 0) return Prisma.sql`FALSE`;
  return Prisma.sql`EXISTS (
    SELECT 1
      FROM ofertas o
      JOIN acciones_formacion af ON af.id = o."accionFormacionId"
     WHERE o.id = ${Prisma.raw(`${aliasReserva}."ofertaId"`)}
       AND af."convenioId" IN (${Prisma.join(ambito)})
  )`;
}
