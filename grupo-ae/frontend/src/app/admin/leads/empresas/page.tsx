"use client";

import { ListaDeOportunidades } from "@/components/admin/lista-de-oportunidades";

export default function PaginaLeadsEmpresas() {
  return (
    <ListaDeOportunidades
      embudo="EMPRESA"
      titulo="Leads de empresas"
      descripcion="Oportunidades con empresas e instituciones: ciclo de semanas y cotización formal."
    />
  );
}
