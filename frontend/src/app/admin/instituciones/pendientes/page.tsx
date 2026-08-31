import { redirect } from "next/navigation";

/**
 * «Por revisar» dejó de ser una página: es una pestaña del banco de
 * empresas.
 *
 * Nunca estuvo en el menú --se llegaba escribiendo la URL--, y por eso
 * las propuestas del buscador web se quedaban esperando sin que nadie
 * supiera que existían. La ruta se queda redirigiendo por si alguien la
 * tiene guardada.
 */
export default function PendientesMudado() {
  redirect("/admin/instituciones");
}
