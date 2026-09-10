import { redirect } from "next/navigation";

/**
 * Se fusionó con Control de Inscritos.
 *
 * Esta pantalla era «Panel Control de Inscritos» y vivía al
 * lado de «Control de inscritos». Dos entradas del menú
 * contando lo mismo por caminos distintos. Ahora es la
 * pestaña «Metas y avance» de la otra.
 *
 * La ruta no se borra: alguien la tiene en marcadores, y una
 * página que desaparece sin decir a dónde se fue es peor que
 * una que redirige.
 */
export default function PaginaSeguimiento() {
  redirect("/admin/control");
}
