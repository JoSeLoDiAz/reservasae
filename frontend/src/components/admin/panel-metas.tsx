"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Desplegable } from "./desplegable";

import { EmbudoProceso, type Hito } from "@/components/admin/embudo-proceso";
import { Aviso, CLASE_CONTROL } from "@/components/admin/marco-admin";
import {
  GraficasInscripciones,
  TargetsInscripciones,
} from "@/components/admin/metricas-inscripciones";
import { Bloque } from "@/components/admin/piezas";
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
export function PanelMetas({
  alCambiarFiltros,
}: {
  /**
   * Avisa hacia arriba de los cortes elegidos.
   *
   * La pantalla entera se filtra con los mismos seis, y el
   * cuerpo de periodos pide `control` por su cuenta: sin esto,
   * el embudo cortaba por gremio y el ritmo seguía con los dos.
   * Media cifra respondiendo al filtro es peor que ninguna.
   */
  alCambiarFiltros?: (f: Filtros) => void;
} = {}) {
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

  /// El aviso va en su propio efecto y no dentro de `cargar`:
  /// metido allí, el padre se enteraría solo cuando la consulta
  /// terminase bien, y con la red lenta la mitad de la pantalla
  /// se quedaría mirando el filtro anterior.
  useEffect(() => {
    alCambiarFiltros?.(filtros);
  }, [filtros, alCambiarFiltros]);

  /**
   * El embudo, ACUMULADO: quién llegó a cada hito.
   *
   * Se arma desde `resumen.etapas` y no desde `control.embudo`
   * a propósito. El del control viene recortado a las cinco
   * etapas de inscripción —y con razón, ver el comentario de
   * `control.ts:46`—, así que quien pasó al aula desaparece:
   * un acumulado hecho con eso contaría como «no inscritos» a
   * los veintitrés que están en formación.
   *
   * «Alcanzó el hito X» = está en X o más adelante. Contar solo
   * a quien está PARADO en cada etapa da un embudo que sube y
   * baja, y un embudo que sube no se puede leer.
   */
  const hitos = useMemo<Hito[]>(() => {
    if (!resumen) return [];
    const en = new Map(resumen.etapas.map((e) => [e.etapa, e.total]));
    const c = (...es: Etapa[]) => es.reduce((s, e) => s + (en.get(e) ?? 0), 0);

    /// Todo lo que hay DESPUÉS de inscribirse, tanto lo que
    /// acabó bien como las cuatro formas de salir del aula.
    const trasInscribir = c(
      "EN_FORMACION",
      "CERTIFICADO",
      "RETIRADO",
      "NO_APROBO",
      "DESERTO",
      "ABANDONO",
    );
    const inscritos = c("INSCRITO") + trasInscribir;
    const conDatos = inscritos + c("DATOS_COMPLETOS");

    /// SUPUESTO, y hay que decirlo: a quien se marcó PERDIDO se
    /// le cuenta como contactado. No sabemos en qué punto se
    /// perdió —la ficha guarda la etapa de ahora, no por dónde
    /// pasó—, y darlo por no contactado inflaría la caída del
    /// primer paso, que es justo la que más se mira.
    const contactados = conDatos + c("CONTACTADO") + c("PERDIDO");
    const entraron = contactados + c("INTERESADO");

    return [
      { etapa: "INTERESADO", etiqueta: "Entraron", total: entraron },
      { etapa: "CONTACTADO", etiqueta: "Contactados", total: contactados },
      { etapa: "DATOS_COMPLETOS", etiqueta: "Con datos", total: conDatos },
      { etapa: "INSCRITO", etiqueta: "Inscritos", total: inscritos },
    ];
  }, [resumen]);

  const notas = useMemo(() => {
    if (!resumen) return [];
    const en = new Map(resumen.etapas.map((e) => [e.etapa, e.total]));
    const g = (e: Etapa) => en.get(e) ?? 0;
    return [
      {
        cifra: g("INTERESADO") + g("CONTACTADO") + g("DATOS_COMPLETOS"),
        etiqueta: "aún no se inscriben",
        detalle:
          "Siguen en el embudo de captación: interesados, contactados o con los datos ya completos.",
        tono: "aviso" as const,
      },
      {
        cifra: g("DATOS_COMPLETOS"),
        etiqueta: "listos para inscribir",
        detalle:
          "Tienen los datos completos y no están inscritos. Es lo que se puede cerrar hoy sin pedir nada más.",
        tono: "marca" as const,
      },
      {
        cifra: g("PERDIDO"),
        etiqueta: "no interesados",
        detalle: "Dijeron que no. Salen del embudo y no vuelven a contarse como pendientes.",
        tono: "error" as const,
      },
      {
        cifra: g("INSCRITO"),
        etiqueta: "inscritos sin entrar al aula",
        detalle:
          "Ya están inscritos pero su grupo todavía no arranca, o no se ha registrado su avance.",
        tono: "exito" as const,
      },
    ];
  }, [resumen]);

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

      {/* El embudo ABRE, y no las cifras sueltas.
          La pregunta que trae aquí a coordinación es «dónde se
          me cae la gente», y eso no lo contesta un marcador:
          lo contesta ver los cuatro hitos con su caída. */}
      {hitos.length > 0 && hitos[0].total > 0 && (
        <Bloque
          estirado
          titulo="El proceso de inscripción, paso a paso"
          descripcion="Cuántos llegan a cada hito y cuántos se caen entre uno y otro. Cada hito cuenta a quien lo alcanzó, aunque hoy esté más adelante."
        >
          <EmbudoProceso hitos={hitos} notas={notas} />
        </Bloque>
      )}

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
