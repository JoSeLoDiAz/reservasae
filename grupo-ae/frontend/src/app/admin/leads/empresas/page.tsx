"use client";

import { ListaDeOportunidades } from "@/components/admin/lista-de-oportunidades";

export default function PaginaLeadsEmpresas() {
  return (
    <ListaDeOportunidades
      embudo="EMPRESA"
      titulo="Leads de empresas"
      descripcion="Negocios con NIT detrás: ciclo de semanas, propuesta por escrito y alguien que decide."
    />
  );
}
