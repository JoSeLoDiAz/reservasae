import { redirect } from "next/navigation";

/**
 * El cronograma dejó de ser una página: es la pestaña «Cronograma» de
 * Acciones de formación.
 *
 * Eran dos entradas del menú con la misma lista debajo, agrupada igual
 * y con el mismo buscador. La ruta se queda redirigiendo porque estuvo
 * en el menú y hay quien la tiene guardada.
 */
export default function CronogramaMudado() {
  redirect("/admin/acciones");
}
