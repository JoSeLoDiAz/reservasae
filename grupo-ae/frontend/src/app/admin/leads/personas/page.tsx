"use client";

import { ListaDeOportunidades } from "@/components/admin/lista-de-oportunidades";

export default function PaginaLeadsPersonas() {
  return (
    <ListaDeOportunidades
      embudo="PERSONA"
      titulo="Leads de personas"
      descripcion="Venta directa a personas: ciclo corto y alto volumen. Responder rápido es la prioridad."
    />
  );
}
