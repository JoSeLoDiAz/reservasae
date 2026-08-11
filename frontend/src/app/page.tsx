import { notFound } from "next/navigation";

/**
 * La raíz devuelve 404. Es deliberado: el sitio no tiene puerta de entrada.
 *
 * Lo que sí existe: /britcham-adee, /adecopria, /consulta y /admin.
 */
export default function SinPaginaDeInicio() {
  notFound();
}
