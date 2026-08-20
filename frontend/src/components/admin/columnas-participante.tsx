import Link from "next/link";

import { diasDesde, ETIQUETA_ETAPA, type FilaParticipante } from "@/lib/crm-api";

import { PildoraEtapa } from "./etapa";
import type { Columna } from "./tabla";

/**
 * Las columnas de una persona, en un solo sitio.
 *
 * Las usan Inscripciones e Inscritos: son la misma fila
 * mirada en dos momentos del proceso. Definirlas dos veces
 * garantiza que se separen a la primera que se toque una.
 */
export function columnasDeParticipante(): Columna<FilaParticipante>[] {
  return [
    {
      clave: "documento",
      titulo: "Documento",
      fija: true,
      valor: (f) => f.documento,
      pinta: (f) => <span className="font-mono text-sm">{f.documento}</span>,
      filtro: "texto",
    },
    {
      clave: "nombre",
      titulo: "Nombre",
      fija: true,
      valor: (f) => f.nombre,
      pinta: (f) => (
        <Link href={"/admin/participantes/" + f.id} className="underline">
          {f.nombre}
        </Link>
      ),
      filtro: "texto",
    },
    {
      clave: "etapa",
      titulo: "Etapa",
      valor: (f) => ETIQUETA_ETAPA[f.etapa],
      pinta: (f) => <PildoraEtapa etapa={f.etapa} />,
      filtro: "opciones",
    },
    {
      clave: "accion",
      titulo: "Acción de formación",
      valor: (f) => f.accion,
      filtro: "opciones",
    },
    { clave: "ubicacion", titulo: "Ubicación", valor: (f) => f.ubicacion, filtro: "opciones" },
    {
      clave: "asesor",
      titulo: "Asesor",
      valor: (f) => f.asesor?.nombre ?? "Sin asignar",
      filtro: "opciones",
    },
    {
      clave: "dias",
      titulo: "Días",
      numerica: true,
      valor: (f) => diasDesde(f.creadoEn),
      filtro: "numero",
    },
    { clave: "correo", titulo: "Correo", aparte: true, valor: (f) => f.correo, filtro: "texto" },
    { clave: "celular", titulo: "Celular", aparte: true, valor: (f) => f.celular, filtro: "texto" },
    {
      clave: "convenio",
      titulo: "Convenio",
      aparte: true,
      valor: (f) => f.convenio,
      filtro: "opciones",
    },
    {
      clave: "notas",
      titulo: "Notas",
      aparte: true,
      numerica: true,
      valor: (f) => f.notas,
      filtro: "numero",
    },
    {
      clave: "creadoEn",
      titulo: "Entró el",
      aparte: true,
      valor: (f) => f.creadoEn.slice(0, 10),
    },
  ];
}
