import { redirect } from "next/navigation";

/**
 * El tráfico dejó de ser una pantalla suelta: es la pantalla
 * «Tráfico del formulario» de Control de Inscritos.
 *
 * Lo pidió el cliente el 21 sep 2026 —«Tráfico del formulario
 * fusionado con Control de inscritos en (Qué pantalla)»— porque
 * las dos cuentan el mismo camino por tramos distintos: aquí, del
 * anuncio a la preinscripción; allí, de la preinscripción a la
 * inscripción. Seguir a una persona obligaba a salir y volver a
 * entrar por el menú.
 *
 * La ruta se queda redirigiendo porque estuvo en el menú desde
 * que existe la pantalla, y hay quien la tiene guardada y quien
 * la pegó en un chat.
 */
export default function TraficoMudado() {
  redirect("/admin/informes/trafico");
}
