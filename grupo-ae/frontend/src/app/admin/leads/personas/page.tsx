"use client";

import { ListaDeOportunidades } from "@/components/admin/lista-de-oportunidades";

export default function PaginaLeadsPersonas() {
  return (
    <ListaDeOportunidades
      embudo="PERSONA"
      titulo="Leads de personas"
      descripcion="Venta directa: ciclo de días y volumen alto. Aquí la primera respuesta pesa más que la etapa."
    />
  );
}
