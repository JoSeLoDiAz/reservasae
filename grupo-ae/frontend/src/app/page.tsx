import { notFound } from "next/navigation";

import { IndicePruebas } from "@/components/indice-pruebas";

/** La raíz devuelve 404; en pruebas, un índice. */
export default function SinPaginaDeInicio() {
  if (process.env.ENTORNO === "prueba") return <IndicePruebas />;
  notFound();
}
