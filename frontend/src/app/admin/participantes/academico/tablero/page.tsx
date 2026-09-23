/**
 * El tablero académico: cómo va cada acción, cada grupo y cada
 * asesor, con sus cortes y su aviso de medibles.
 *
 * VUELVE A SER UNA PÁGINA. Esta ruta estuvo en el menú, luego
 * pasó a ser una pestaña de Seguimiento y la ruta se quedó
 * redirigiendo; ahora es otra vez una pantalla, con su entrada en
 * el menú de Académica: «estas dos opciones que queden en
 * Académica en lista desplegable» (cliente, 12 sep 2026).
 *
 * Es la misma URL que llevaba redirigiendo, así que quien la
 * tenga guardada aterriza justo donde esperaba.
 *
 * Hermana de Seguimiento, no su sustituta: aquella mira persona a
 * persona y esta por acción, grupo y asesor. Son la misma
 * pregunta con distinto zoom.
 */

import { TableroAcademico } from "@/components/admin/tablero-academico";

export default function PaginaTableroAcademico() {
  return (
    /// El mismo marco que Seguimiento, para que las dos hojas del
    /// módulo empiecen a la misma altura y con el mismo margen.
    <div className="flex flex-col gap-3 px-4 pt-3 pb-6">
      <TableroAcademico />
    </div>
  );
}
