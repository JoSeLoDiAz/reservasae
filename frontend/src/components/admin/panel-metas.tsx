"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Desplegable } from "./desplegable";

import { Aviso, CLASE_CONTROL } from "@/components/admin/marco-admin";
import {
  GraficasInscripciones,
  TargetsInscripciones,
} from "@/components/admin/metricas-inscripciones";
import { SelectorBuscable } from "@/components/admin/selector-buscable";
import { ErrorApi } from "@/lib/api";
import {
  crmApi,
  ETAPAS_A_MANO,
  ETIQUETA_ETAPA,
  type Etapa,
  type Filtros,
  type MetricasInscripciones as TipoMetricas,
  type Resumen,
} from "@/lib/crm-api";

/**
 * Metas y avance, por dimensión.
 *
 * Era una pantalla aparte -- «Panel Control de Inscritos» --
 * al lado de «Control de inscritos», y las dos hablaban de lo
 * mismo. Ahora son dos pestañas de una sola.
 *
 * No se fundieron los filtros porque no filtran lo mismo:
 * esta corta por gremio, acción, etapa, asesor y
 * departamento; la otra corta por fechas y compara periodos.
 * Meterlos en una sola fila daría a entender que se combinan,
 * y no se combinan.
 *
 * Solo mira: aquí no se cambia la etapa de nadie ni se asigna
 * asesor. Eso vive en Gestión de leads, que es la otra vista
 * del mismo grupo de personas.
 */
export function PanelMetas() {
  const [convenioId, setConvenioId] = useState("");
  const [accionFormacionId, setAccionFormacionId] = useState("");
  const [etapa, setEtapa] = useState("");
  const [estado, setEstado] = useState<"" | "COMPLETO" | "PARCIAL">("");
  const [asesorId, setAsesorId] = useState("");
  const [departamentoSepId, setDepartamentoSepId] = useState("");

  const [metricas, setMetricas] = useState<TipoMetricas | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtros = useMemo<Filtros>(
    () => ({
      convenioId: convenioId || undefined,
      accionFormacionId: accionFormacionId || undefined,
      etapa: (etapa || undefined) as Filtros["etapa"],
      estado: estado || undefined,
      asesorId: asesorId || undefined,
      departamentoSepId: departamentoSepId ? Number(departamentoSepId) : undefined,
    }),
    [convenioId, accionFormacionId, etapa, estado, asesorId, departamentoSepId],
  );

  const cargar = useCallback(async () => {
    // el resumen trae las opciones de los desplegables; las
    // metricas, lo que se pinta. Los dos con el mismo filtro
    const [met, res] = await Promise.all([
      crmApi.metricas(filtros),
      crmApi.resumen(filtros),
    ]);
    setMetricas(met);
    setResumen(res);
  }, [filtros]);

  useEffect(() => {
    void cargar().catch((e) => setError((e as ErrorApi).message));
  }, [cargar]);

  const hayFiltro = Boolean(
    convenioId || accionFormacionId || etapa || estado || asesorId || departamentoSepId,
  );

  function quitarFiltros() {
    setConvenioId("");
    setAccionFormacionId("");
    setEtapa("");
    setEstado("");
    setAsesorId("");
    setDepartamentoSepId("");
  }

  return (
    <div className="space-y-6">
      {error && <Aviso tipo="error">{error}</Aviso>}

      <TargetsInscripciones metricas={metricas} />

      {/* El orden es el de las graficas de abajo: se filtra por
          lo que se esta mirando. */}
      {/* Seis en rejilla y no en fila: asi ocupan el mismo
          ancho que las graficas de abajo y no quedan cortos. */}
      {/* La rejilla del redisenio: `auto-fit` con minimo de
          150px y 8px de hueco, no seis columnas fijas. Con las
          fijas, en una pantalla estrecha caian a dos y cada
          filtro se quedaba en 300px -- el doble de lo que
          necesita -- y en una ancha sobraba sitio al final. */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}
      >
        <Desplegable
          alto={34}
          marcador="Gremios"
          valor={convenioId}
          opciones={[
            { valor: "", etiqueta: "Gremios" },
            ...(metricas?.porGremio ?? []).map((g) => ({ valor: g.convenioId, etiqueta: g.gremio, detalle: `${g.conversion.base} leads` })),
          ]}
          alElegir={setConvenioId}
        />

        <SelectorBuscable
          clase="w-full"
          etiqueta="Filtrar por acción de formación"
          valor={accionFormacionId}
          alElegir={setAccionFormacionId}
          vacio="Toda la formación"
          marcador="AF8, inteligencia artificial…"
          opciones={(resumen?.acciones ?? []).map((a) => ({
            id: a.id,
            etiqueta: `${a.codigo} · ${a.nombre}`,
            detalle: `${a.total} ${a.total === 1 ? "lead" : "leads"}`,
          }))}
        />

        <Desplegable
          alto={34}
          marcador="Etapa"
          valor={etapa}
          opciones={[
            { valor: "", etiqueta: "Etapa" },
            ...ETAPAS_A_MANO.map((e: Etapa) => ({ valor: e, etiqueta: ETIQUETA_ETAPA[e] })),
          ]}
          alElegir={setEtapa}
        />

        <Desplegable
          alto={34}
          marcador="Estado de los datos"
          valor={estado}
          opciones={[
            { valor: "", etiqueta: "Estado de los datos" },
            { valor: "COMPLETO", etiqueta: "Datos completos" },
            { valor: "PARCIAL", etiqueta: "Datos parciales" },
          ]}
          alElegir={(v) => setEstado(v as "" | "COMPLETO" | "PARCIAL")}
        />

        <Desplegable
          alto={34}
          marcador="Asesores"
          valor={asesorId}
          opciones={[
            { valor: "", etiqueta: "Asesores" },
            ...(resumen?.asesores ?? []).map((a) => ({
              valor: a.id,
              etiqueta: a.nombre,
              detalle: `${a.total} ${a.total === 1 ? "lead" : "leads"}`,
            })),
          ]}
          alElegir={setAsesorId}
        />

        <Desplegable
          alto={34}
          marcador="Departamentos"
          valor={departamentoSepId}
          opciones={[
            { valor: "", etiqueta: "Departamentos" },
            ...(resumen?.departamentos ?? [])
              .filter((d) => d.id !== null)
              .map((d) => ({
                valor: String(d.id),
                etiqueta: d.nombre,
                detalle: `${d.total} ${d.total === 1 ? "lead" : "leads"}`,
              })),
          ]}
          alElegir={setDepartamentoSepId}
        />

      </div>

      {hayFiltro && (
        <button className="text-sm text-marca underline" onClick={quitarFiltros}>
          Quitar filtros
        </button>
      )}

      <GraficasInscripciones metricas={metricas} />
    </div>
  );
}
