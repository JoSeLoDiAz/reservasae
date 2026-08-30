"use client";

import { useState } from "react";
import { Bloque } from "./piezas";

import type { MetricasInscripciones as Repartos, Reparto } from "@/lib/crm-api";

import { Donut, ListaBarras, Medidor, n } from "./graficos";

/// El porcentaje de una parte, o raya si no hay sobre que
/// calcularlo. Un «0%» con base cero no es cero: es que no
/// hay nada, y son dos cosas distintas.
function pct(valor: number, base: number): string {
  if (base <= 0) return "—";
  return `${Math.round((valor / base) * 1000) / 10}%`;
}

/// El mayor de un reparto. Los repartos vienen ordenados de
/// mayor a menor salvo el de etapa, que va en el orden del
/// proceso: por eso se busca y no se toma el primero.
function mayor(datos: Reparto[]): Reparto | null {
  if (datos.length === 0) return null;
  return datos.reduce((a, b) => (b.valor > a.valor ? b : a));
}

/// El codigo de la accion, que es lo unico que cabe en un eje.
/// Vienen como «AF7 · SALTO ADELANTE (LEAPFROGGING): …».
function codigo(etiqueta: string): string {
  return etiqueta.split(" · ")[0] ?? etiqueta;
}

/**
 * Un indicador: una cifra y su guia al pasar el raton.
 *
 * En una sola linea de alto. Ocho indicadores en tarjetas
 * altas empujan las graficas fuera de la pantalla, y lo que
 * hay que ver primero es el reparto, no el titular.
 */
function Target({
  etiqueta,
  cifra,
  detalle,
  guia,
}: {
  etiqueta: string;
  cifra: string;
  detalle: string;
  guia: string;
}) {
  return (
    /// Celda de la franja, no tarjeta.
    ///
    /// La cifra iba a la derecha en pequenio y el rotulo a la
    /// izquierda. Ahora se apila -- rotulo, cifra grande, pie --
    /// que es como se lee un indicador: primero que mide, luego
    /// cuanto. Con ocho en fila, ocho cifras alineadas abajo se
    /// comparan de un vistazo; a la derecha de cada caja, no.
    <div
      title={guia}
      className={
        "rounded-lg border border-borde bg-superficie px-3.5 py-2 transition " +
        "hover:border-marca/40 hover:shadow-[0_2px_14px_-6px_rgba(15,23,42,0.28)]"
      }
    >
      <span className="block truncate text-[0.6875rem] leading-none text-texto-suave">
        {etiqueta}
      </span>
      <span className="mt-1 block text-[1.0625rem] leading-none font-bold tabular-nums text-titulo">
        {cifra}
      </span>
      <span className="mt-1 block truncate text-[0.6875rem] leading-none text-texto-suave">
        {detalle}
      </span>
    </div>
  );
}

/// Barras verticales. `ListaBarras` las pinta horizontales y
/// aqui hacen falta de pie, con el codigo abajo y el nombre
/// entero en el title: los nombres pasan de 60 caracteres.
function BarrasVerticales({ datos }: { datos: Reparto[] }) {
  if (datos.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-texto-suave">
        Todavía nadie con acción de formación.
      </p>
    );
  }

  const tope = Math.max(...datos.map((d) => d.valor), 1);

  return (
    <div className="flex items-end gap-2" style={{ height: 104 }}>
      {datos.map((d) => (
        <div
          key={d.etiqueta}
          title={`${d.etiqueta} — ${n(d.valor)}`}
          className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
        >
          <span className="text-xs font-medium tabular-nums text-texto-suave">
            {n(d.valor)}
          </span>
          {/* la altura en px y no en %: dentro de un flex el
              porcentaje se mide contra un alto que el padre no
              tiene fijado, y las barras salian de cero */}
          <div
            className="w-full rounded-t-md bg-marca"
            style={{ height: Math.max(Math.round((d.valor / tope) * 72), 4) }}
          />
          <span className="w-full truncate text-center text-[10px] text-texto-suave">
            {codigo(d.etiqueta)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Los ocho indicadores, en una franja. */
export function TargetsInscripciones({ metricas }: { metricas: Repartos | null }) {
  if (!metricas) {
    return (
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="h-[62px] animate-pulse rounded-lg border border-borde bg-superficie-alterna"
          />
        ))}
      </div>
    );
  }

  const {
    total,
    porEtapa,
    porEstado,
    porGremio,
    porDepartamento,
    sinDepartamento,
    porAsesor,
    conversion,
    promedioPorDia,
  } = metricas;

  const conDomicilio = total - sinDepartamento;
  const etapaLider = mayor(porEtapa);
  const estadoLider = mayor(porEstado);
  const deptoLider = mayor(porDepartamento);
  const asesorLider = mayor(porAsesor);

  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      <Target
        etiqueta="Etapa del lead"
        detalle={etapaLider?.etiqueta ?? "Sin datos"}
        cifra={etapaLider ? pct(etapaLider.valor, total) : "—"}
        guia="Etapa que concentra la mayor proporción de leads con los filtros aplicados."
      />

      <Target
        etiqueta="Estado del lead"
        detalle={estadoLider?.etiqueta ?? "Sin datos"}
        cifra={estadoLider ? pct(estadoLider.valor, total) : "—"}
        guia="Proporción de leads cuya lead ya reúne los datos exigidos por el reporte."
      />

      {porGremio.map((g) => {
        const punta = mayor(g.acciones);
        return (
          <Target
            key={g.convenioId}
            etiqueta={g.gremio}
            detalle={punta ? codigo(punta.etiqueta) : "Sin acción"}
            cifra={punta ? n(punta.valor) : "—"}
            guia={
              punta
                ? `Acción de formación con mayor captación en este gremio: ${punta.etiqueta}.`
                : "Este gremio aún no registra leads con acción de formación asignada."
            }
          />
        );
      })}

      <Target
        etiqueta="Departamento"
        detalle={deptoLider?.etiqueta ?? "Sin domicilio"}
        cifra={deptoLider ? pct(deptoLider.valor, conDomicilio) : "—"}
        guia="Departamento de mayor concentración, calculado sobre los leads con domicilio registrado."
      />

      <Target
        etiqueta="Inscripciones por asesor"
        detalle={asesorLider?.etiqueta ?? "Sin asignar"}
        cifra={asesorLider ? pct(asesorLider.valor, total) : "—"}
        guia="Asesor con la mayor proporción de la cartera bajo los filtros aplicados."
      />

      <Target
        etiqueta="Conversión"
        detalle={`${n(conversion.inscritos)} de ${n(conversion.base)}`}
        cifra={total > 0 ? `${conversion.porcentaje}%` : "—"}
        guia="Proporción de leads que alcanzaron la etapa de inscrito."
      />

      <Target
        etiqueta="Promedio ingreso leads por día"
        detalle={`${n(promedioPorDia.dias)} ${
          promedioPorDia.dias === 1 ? "día" : "días"
        } corridos`}
        cifra={promedioPorDia.dias > 0 ? String(promedioPorDia.valor) : "—"}
        guia="Leads registrados por día desde el ingreso del primero, sobre días corridos."
      />
    </div>
  );
}

/**
 * Las graficas, en el orden pedido.
 *
 * Todas del mismo alto para que se puedan comparar de un
 * vistazo: una torta grande al lado de un anillo pequeno hace
 * parecer que una pesa mas que la otra.
 */
export function GraficasInscripciones({ metricas }: { metricas: Repartos | null }) {
  /// Seis departamentos caben; los demas se piden. Un «y 14
  /// mas» sin forma de verlos no es un resumen, es un hueco.
  const [todosLosDeptos, setTodosLosDeptos] = useState(false);

  if (!metricas) return null;

  const {
    total,
    porEtapa,
    porEstado,
    porGremioTotal,
    porGremio,
    porDepartamento,
    sinDepartamento,
    porAsesor,
  } = metricas;

  const conDomicilio = total - sinDepartamento;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Bloque estirado titulo="Gremio">
        <div>
          <Donut
            datos={porGremioTotal.map((g) => ({ etiqueta: g.etiqueta, valor: g.valor }))}
            tamano={188}
            centro={n(total)}
            detalleCentro={total === 1 ? "lead" : "leads"}
            vacio="Nadie coincide con estos filtros."
          />
        </div>
      </Bloque>

      <Bloque estirado titulo="Acción de formación">
        <div className="space-y-4">
          {porGremio.map((g) => (
            <div key={g.convenioId}>
              <p className="mb-1.5 text-[10px] font-semibold tracking-[0.1em] text-texto-suave uppercase">
                {g.gremio}
              </p>
              <BarrasVerticales datos={g.acciones.slice(0, 8)} />
            </div>
          ))}
        </div>
      </Bloque>

      <Bloque estirado titulo="Etapa del lead">
        <div>
          <ListaBarras
            datos={porEtapa.map((e) => ({
              etiqueta: e.etiqueta,
              valor: e.valor,
              detalle: pct(e.valor, total),
            }))}
            vacio="Nadie coincide con estos filtros."
          />
        </div>
      </Bloque>

      <Bloque estirado titulo="Estado de los datos">
        <div>
          <Donut
            datos={[
              {
                etiqueta: porEstado[0]?.etiqueta ?? "Datos completos",
                valor: porEstado[0]?.valor ?? 0,
                color: "var(--exito)",
              },
              {
                etiqueta: porEstado[1]?.etiqueta ?? "Datos parciales",
                valor: porEstado[1]?.valor ?? 0,
                color: "var(--aviso)",
              },
            ]}
            tamano={188}
            centro={n(total)}
            detalleCentro={total === 1 ? "lead" : "leads"}
          />
        </div>
      </Bloque>

      <Bloque estirado titulo="Asesores">
        <div>
          <Donut
            datos={porAsesor.map((a) => ({ etiqueta: a.etiqueta, valor: a.valor }))}
            tamano={188}
            centro={n(total)}
            detalleCentro={total === 1 ? "lead" : "leads"}
            vacio="Nadie tiene leads asignados."
          />
        </div>
      </Bloque>

      <Bloque estirado titulo="Departamentos">
        <div>
          <ListaBarras
            datos={porDepartamento.map((d) => ({
              etiqueta: d.etiqueta,
              valor: d.valor,
              detalle: pct(d.valor, conDomicilio),
            }))}
            maximoFilas={todosLosDeptos ? undefined : 6}
            vacio="Nadie tiene domicilio capturado."
          />
          {porDepartamento.length > 6 && (
            <button
              type="button"
              onClick={() => setTodosLosDeptos(!todosLosDeptos)}
              className="mt-3 text-sm text-marca underline"
            >
              {todosLosDeptos
                ? "Ver solo los seis primeros"
                : `Ver los ${n(porDepartamento.length)} departamentos`}
            </button>
          )}
          {sinDepartamento > 0 && (
            /* el reparto descarta estos leads: decir cuantos
               son es lo que impide que la cifra engane */
            <p className="mt-3 border-t border-borde pt-3 text-xs text-texto-suave">
              {n(sinDepartamento)}{" "}
              {sinDepartamento === 1 ? "lead queda fuera" : "leads quedan fuera"} por no
              tener domicilio registrado.
            </p>
          )}
        </div>
      </Bloque>

      {/* Una conversion por gremio: son dos, y la del conjunto
          no dice cual de los dos esta convirtiendo. */}
      {porGremio.map((g) => (
        <Bloque estirado key={g.convenioId} titulo={`Conversión · ${g.gremio}`}>
          <div>
            <Medidor
              porcentaje={g.conversion.porcentaje}
              color="var(--exito)"
              cifra={g.conversion.base > 0 ? `${g.conversion.porcentaje}%` : "—"}
              detalle={`${n(g.conversion.inscritos)} de ${n(
                g.conversion.base,
              )} llegaron a inscrito`}
            />
          </div>
        </Bloque>
      ))}
    </div>
  );
}
