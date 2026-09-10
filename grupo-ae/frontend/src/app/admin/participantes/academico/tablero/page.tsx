import { redirect } from "next/navigation";

/**
 * El tablero dejó de ser una página: es la pestaña «Tablero» de
 * Seguimiento académico.
 *
 * La ruta se queda redirigiendo porque estuvo en el menú y hay quien la
 * tiene guardada. Un enlace que muere en un 404 se lee como que la
 * pantalla desapareció, y no desapareció: se mudó.
 */
export default function TableroMudado() {
  redirect("/admin/participantes/academico");
}
