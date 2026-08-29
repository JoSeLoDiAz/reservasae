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

/// El color va en la LETRA. Sin fondo, sin borde, sin
/// subrayado: en una tabla de 400 filas, 400 rectangulos de
/// color compiten con los datos en vez de ordenarlos, y el
/// subrayado se lee como un enlace que no lleva a ninguna
/// parte.
const TONO_EMPRESA: Record<FilaParticipante["datosEmpresa"], string> = {
  SIN: "text-texto-suave",
  PARCIAL: "text-aviso",
  COMPLETA: "text-exito",
};

/// Cuantos datos le faltan a la persona, escrito bien.
///
/// «Faltan 1» no lo dice nadie. Y va en UNA funcion porque se
/// escribe en dos sitios -- el valor que se ordena y exporta,
/// y lo que se pinta -- y con dos copias una se queda en
/// plural el dia que se toque la otra.
function pendientes(f: FilaParticipante): string {
  if (f.datos === "COMPLETOS") return "Sin pendientes";
  const n = f.faltaDeLaPersona.length;
  return n === 1 ? "Falta 1" : `Faltan ${n}`;
}

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
        <Link
          href={"/admin/participantes/" + f.id}
          // sin esto el clic sigue subiendo a la fila y abre
          // ADEMAS el cajon lateral: dos cosas de un clic
          onClick={(e) => e.stopPropagation()}
          className="underline"
        >
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
      /// «Datos pendientes» y no «Estado de los datos».
      ///
      /// Esta columna decía «Datos completos / Datos
      /// parciales» y la de al lado dice «Etapa: Datos
      /// completos». Con las mismas dos palabras para dos
      /// cosas distintas, ver «Datos completos» en una y
      /// «Datos parciales» en la otra parecía una
      /// contradicción del sistema, y no lo era:
      ///
      ///   · la ETAPA la mueve una persona;
      ///   · esto lo CALCULA `completitud.ts` mirando si están
      ///     el correo, el celular, la fecha de nacimiento, el
      ///     género, el estrato, el departamento, el municipio
      ///     y la dirección.
      ///
      /// Se puede estar en la etapa «Datos completos» y
      /// deberle datos al SENA. Ahora se dice CUÁNTOS faltan,
      /// que además es accionable: «Faltan 4» le dice al asesor
      /// que hay algo que pedir; «Datos parciales» no.
      titulo: "Datos pendientes",
      /// «Falta 1» y no «Faltan 1». Una sola función para los
      /// dos sitios donde se escribe —el valor que se ordena y
      /// exporta, y lo que se pinta— porque tenerlo dos veces
      /// es como uno de los dos se queda en plural.
      valor: (f) => pendientes(f),
      pinta: (f) => (
        <span
          title={
            f.datos === "COMPLETOS"
              ? "No le falta ningún dato de los que pide el reporte."
              : `Falta: ${f.faltaDeLaPersona.join(", ")}`
          }
          /// El color va en la LETRA, sin caja y sin subrayado.
          ///
          /// Sin caja porque en una tabla de 400 filas, 400
          /// rectángulos de color compiten con los datos en vez
          /// de ordenarlos. Y sin subrayado porque en una tabla
          /// el texto subrayado se lee como un enlace, y este
          /// no lleva a ninguna parte: se confundiría con las
          /// columnas que sí son pulsables.
          className={`font-medium whitespace-nowrap ${
            f.datos === "COMPLETOS" ? "text-exito" : "text-aviso"
          }`}
        >
          {pendientes(f)}
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
          className={`font-medium whitespace-nowrap ${TONO_EMPRESA[f.datosEmpresa]}`}
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
