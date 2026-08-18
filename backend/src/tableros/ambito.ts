/** El filtro por convenio, escrito una sola vez. */

import { Prisma } from '../../generated/prisma';

/**
 * Cada tabla llega al convenio por un camino distinto y
 * escribirlo 28 veces es garantizar que uno salga mal.
 * Un ámbito vacío no devuelve nada, que es lo correcto
 * cuando la cuenta no tiene concesión en ningún convenio.
 */

export const deConvenio = (ambito: string[]) => ({ convenioId: { in: ambito } });

/// La oferta cuelga de la acción.
export const ofertaDeConvenio = (ambito: string[]): Prisma.OfertaWhereInput => ({
  accionFormacion: { convenioId: { in: ambito } },
});

/// La reserva cuelga de la oferta, que cuelga de la acción.
export const reservaDeConvenio = (ambito: string[]): Prisma.ReservaWhereInput => ({
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
export const empresaDeConvenio = (ambito: string[]): Prisma.EmpresaWhereInput => ({
  reservas: { some: reservaDeConvenio(ambito) },
});

/// La respuesta cuelga de la reserva.
export const respuestaDeConvenio = (ambito: string[]): Prisma.RespuestaWhereInput => ({
  reserva: reservaDeConvenio(ambito),
});

/**
 * Para el SQL crudo. Devuelve el fragmento que ata la
 * consulta al ámbito, listo para intercalar en el WHERE.
 * Un ámbito vacío produce `FALSE`, no un IN () inválido.
 */
export function sqlDeConvenio(ambito: string[], aliasReserva = 'r'): Prisma.Sql {
  if (ambito.length === 0) return Prisma.sql`FALSE`;
  return Prisma.sql`EXISTS (
    SELECT 1
      FROM ofertas o
      JOIN acciones_formacion af ON af.id = o."accionFormacionId"
     WHERE o.id = ${Prisma.raw(`${aliasReserva}."ofertaId"`)}
       AND af."convenioId" IN (${Prisma.join(ambito)})
  )`;
}
