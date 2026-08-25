import Link from "next/link";

import {
  ETIQUETA_DATOS_EMPRESA,
  ETIQUETA_ETAPA,
  ETIQUETA_ORIGEN_LEAD,
  type FilaParticipante,
} from "@/lib/crm-api";

import { PildoraEtapa } from "./etapa";
import type { Columna } from "./tabla";

/// Fecha y hora, no solo fecha: dos leads del mismo dia se
/// ordenan mal si la hora no viaja, y saber a que hora entro
/// es lo que deja medir en cuanto se reacciono.
function fechaHora(valor: string | null): string {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const TONO_EMPRESA: Record<FilaParticipante["datosEmpresa"], string> = {
  SIN: "bg-superficie-alterna text-texto-suave",
  PARCIAL: "bg-aviso-suave text-aviso",
  COMPLETA: "bg-exito-suave text-exito",
};

/**
 * Las columnas de un lead, en un solo sitio.
 *
 * Las usan Inscripciones e Inscritos: son la misma fila
 * mirada en dos momentos del proceso. Definirlas dos veces
 * garantiza que se separen a la primera que se toque una.
 *
 * Estan todas: la persona elige cuales ve desde el selector
 * de columnas. `aparte` solo decide cuales vienen marcadas
 * de entrada, no cuales existen.
 */
export function columnasDeParticipante(): Columna<FilaParticipante>[] {
  return [
    {
      clave: "creadoEn",
      titulo: "Fecha de creación",
      valor: (f) => f.creadoEn,
      pinta: (f) => (
        <span className="whitespace-nowrap font-mono text-xs">
          {fechaHora(f.creadoEn)}
        </span>
      ),
    },
    {
      clave: "correo",
      titulo: "Correo",
      valor: (f) => f.correo,
      filtro: "texto",
    },
    {
      clave: "celular",
      titulo: "Número de teléfono",
      valor: (f) => f.celular,
      filtro: "texto",
    },
    {
      clave: "nombre",
      titulo: "Nombre completo",
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
      clave: "tipoDocumento",
      titulo: "Tipo documento",
      valor: (f) => f.tipoDocumento,
      filtro: "opciones",
    },
    {
      clave: "numeroDocumento",
      titulo: "Número documento",
      valor: (f) => f.numeroDocumento,
      pinta: (f) => <span className="font-mono text-sm">{f.numeroDocumento}</span>,
      filtro: "texto",
    },
    {
      clave: "departamento",
      titulo: "Departamento",
      valor: (f) => f.departamento,
      filtro: "opciones",
    },
    {
      clave: "municipio",
      titulo: "Municipio",
      valor: (f) => f.municipio,
      filtro: "opciones",
    },
    {
      /// Solo el codigo. El nombre completo pasa de sesenta
      /// caracteres y una fila con eso deja de leerse.
      clave: "accionCodigo",
      titulo: "Acción formación interés",
      valor: (f) => f.accionCodigo,
      pinta: (f) =>
        f.accionCodigo ? (
          <span title={f.accion ?? undefined} className="font-mono text-sm">
            {f.accionCodigo}
          </span>
        ) : null,
      filtro: "opciones",
    },
    {
      clave: "asesor",
      titulo: "Asesor",
      valor: (f) => f.asesor?.nombre ?? "Sin asignar",
      filtro: "opciones",
    },
    {
      clave: "etapa",
      titulo: "Etapa lead",
      valor: (f) => ETIQUETA_ETAPA[f.etapa],
      pinta: (f) => <PildoraEtapa etapa={f.etapa} />,
      filtro: "opciones",
    },
    {
      clave: "datos",
      titulo: "Estado de los datos",
      valor: (f) => (f.datos === "COMPLETOS" ? "Datos completos" : "Datos parciales"),
      pinta: (f) => (
        <span
          title={
            f.datos === "COMPLETOS"
              ? "La ficha tiene todo lo que hace falta."
              : `Falta: ${f.faltaDeLaPersona.join(", ")}`
          }
          className={`rounded-lg px-2 py-0.5 text-sm font-medium whitespace-nowrap ${
            f.datos === "COMPLETOS"
              ? "bg-exito-suave text-exito"
              : "bg-aviso-suave text-aviso"
          }`}
        >
          {f.datos === "COMPLETOS" ? "Datos completos" : "Datos parciales"}
        </span>
      ),
      filtro: "opciones",
    },
    {
      clave: "origenLead",
      titulo: "Origen lead",
      valor: (f) => ETIQUETA_ORIGEN_LEAD[f.origenLead],
      filtro: "opciones",
    },
    {
      clave: "ultimaActividad",
      titulo: "Última actividad",
      valor: (f) => f.ultimaActividad,
      pinta: (f) => (
        <span className="whitespace-nowrap font-mono text-xs">
          {fechaHora(f.ultimaActividad)}
        </span>
      ),
    },
    {
      /// De donde viene, no donde esta: sirve para ver por
      /// que camino llego a la etapa de hoy.
      clave: "etapaAnterior",
      titulo: "Última etapa lead",
      valor: (f) => (f.etapaAnterior ? ETIQUETA_ETAPA[f.etapaAnterior] : "Sin cambios"),
      filtro: "opciones",
    },
    {
      clave: "cambios",
      titulo: "Cambios realizados",
      numerica: true,
      valor: (f) => f.cambios,
      filtro: "numero",
    },
    {
      clave: "datosEmpresa",
      titulo: "Datos de empresa",
      valor: (f) => ETIQUETA_DATOS_EMPRESA[f.datosEmpresa],
      pinta: (f) => (
        <span
          className={`rounded-lg px-2 py-0.5 text-sm font-medium whitespace-nowrap ${
            TONO_EMPRESA[f.datosEmpresa]
          }`}
        >
          {ETIQUETA_DATOS_EMPRESA[f.datosEmpresa]}
        </span>
      ),
      filtro: "opciones",
    },
    {
      clave: "notas",
      titulo: "Notas",
      numerica: true,
      valor: (f) => f.notas,
      filtro: "numero",
    },
    {
      clave: "gremio",
      titulo: "Gremio",
      valor: (f) => f.gremio,
      filtro: "opciones",
    },
    {
      clave: "antiguedadDias",
      titulo: "Antigüedad lead en días",
      numerica: true,
      valor: (f) => f.antiguedadDias,
      filtro: "numero",
    },
  ];
}
