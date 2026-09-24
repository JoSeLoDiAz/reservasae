"use client";

/**
 * SEGUIMIENTO ACADÉMICO: el resumen del aula, sin nombres.
 *
 * Aquí vivía el tablero de cohortes --periodo, comparación, avance
 * medio-- y el cliente lo rehizo entero el 23 sep 2026: «filtro:
 * acción de formación, grupos (individual o todo); resumen: número de
 * grupos, total de beneficiarios por grupo matriculados, estados de
 * cada uno de los participantes». Y con una condición que manda sobre
 * todo lo demás: «importante, no mostrar las personas sino los
 * resúmenes o cantidades».
 *
 * Lo viejo no se pierde: `tablero-academico.ts` sigue en el backend
 * con sus cortes por acción, grupo y asesor, y de ahí come el tablero
 * de asesores.
 */

import { TableroSeguimientoAcademico } from "@/components/admin/tablero-seguimiento-academico";

export default function PaginaDeSeguimientoAcademico() {
  return <TableroSeguimientoAcademico />;
}
