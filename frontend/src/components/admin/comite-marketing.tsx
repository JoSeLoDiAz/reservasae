"use client";

import { useCallback, useEffect, useState } from "react";

import { Desplegable } from "./desplegable";
import { n } from "./graficos";
import { Bloque } from "./piezas";
import { CLASE_CONTROL } from "./marco-admin";
import { crmApi, type PlaneacionDePauta } from "@/lib/crm-api";
import { pedir } from "@/lib/pedir";
import { bonito } from "@/lib/api";

type Accion = {
  id: string;
  codigo: string;
  nombre: string;
  convenio: string;
  grupos: Array<{ id: string; numero: number; etiqueta: string }>;
};

/// Solo el catálogo: la tabla la sirve la otra ruta.
type Catalogo = { acciones: Accion[] };

const COSTO_POR_OMISION = 12000;

/// Grande y en pesos no cabe en una columna: a partir del
/// millón se abrevia, que es como se habla de un presupuesto.
function pesos(v: number): string {
  if (v >= 1_000_000) {
    return `$${(v / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
  }
  return `$${v.toLocaleString("es-CO")}`;
}

/**
 * La tabla de planeación de pauta.
 *
 * Sin tarjetas ni gráficos, a propósito: es una herramienta de
 * cálculo. Se mueven dos números arriba —cuántos leads cuesta
 * un inscrito y cuánto cuesta un lead— y la tabla entera se
 * recalcula.
 */
export function ComiteMarketing() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [datos, setDatos] = useState<PlaneacionDePauta | null>(null);
  const [accionId, setAccionId] = useState("");
  const [coberturaId, setCoberturaId] = useState("");
  const [conversion, setConversion] = useState(3);
  const [costo, setCosto] = useState(COSTO_POR_OMISION);

  useEffect(() => {
    void (async () => {
      const c = await pedir<Catalogo>("/admin/participantes/control/por-accion");
      setCatalogo(c);
      if (c.acciones.length > 0) setAccionId(c.acciones[0].id);
    })();
  }, []);

  const cargar = useCallback(async () => {
    if (!accionId) return;
    setDatos(await crmApi.planeacionDePauta(accionId, coberturaId || undefined));
  }, [accionId, coberturaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const accion = catalogo?.acciones.find((a) => a.id === accionId);
  const grupos = accion?.grupos ?? [];

  /// Las cinco columnas calculadas, en un sitio: la tabla y su
  /// fila de totales las necesitan iguales.
  const calcular = (f: {
    totalCupos: number;
    reservados: number;
    inscritos: number;
    leadsOrganicos: number;
    leadsImportados: number;
  }) => {
    const pendientes = Math.max(0, f.totalCupos - f.inscritos - f.reservados);
    const totalLeads = f.leadsOrganicos + f.leadsImportados;
    const sePuedenInscribir = Math.floor(totalLeads / conversion);
    const faltan = Math.max(0, pendientes - sePuedenInscribir);
    const leadsPauta = faltan * conversion;
    return {
      pendientes,
      totalLeads,
      sePuedenInscribir,
      faltan,
      leadsPauta,
      costoPauta: leadsPauta * costo,
    };
  };

  return (
    <div className="flex flex-col gap-3">
      {/* los seis filtros, en una línea */}
      <div className="rounded-lg border border-borde bg-superficie px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <p className="shrink-0 text-[0.6875rem] font-medium text-texto-suave">
              Acción de formación
            </p>
            <div className="w-[380px]">
              <Desplegable
                alto={32}
                marcador="Elija una acción"
                valor={accionId}
                opciones={(catalogo?.acciones ?? []).map((a) => ({
                  valor: a.id,
                  etiqueta: `${a.codigo} · ${bonito(a.nombre)}`,
                  detalle: a.convenio,
                }))}
                alElegir={(v) => {
                  setAccionId(v);
                  setCoberturaId("");
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <p className="shrink-0 text-[0.6875rem] font-medium text-texto-suave">Grupo</p>
            <div className="w-[190px]">
              <Desplegable
                alto={32}
                marcador="Todos los grupos"
                valor={coberturaId}
                opciones={[
                  { valor: "", etiqueta: "Todos los grupos" },
                  ...grupos.map((g) => ({ valor: g.id, etiqueta: g.etiqueta })),
                ]}
                alElegir={setCoberturaId}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <p className="shrink-0 text-[0.6875rem] font-medium text-texto-suave">
              Conversión
            </p>
            <select
              className={`${CLASE_CONTROL} max-w-[9rem]`}
              value={conversion}
              onChange={(e) => setConversion(Number(e.target.value))}
              aria-label="Leads por inscrito"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                <option key={v} value={v}>
                  {v} {v === 1 ? "lead" : "leads"} · 1 inscrito
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <p className="shrink-0 text-[0.6875rem] font-medium text-texto-suave">
              Costo por lead
            </p>
            <input
              type="number"
              min={0}
              step={500}
              className={`${CLASE_CONTROL} max-w-[8rem]`}
              value={costo}
              onChange={(e) => setCosto(Math.max(0, Number(e.target.value)))}
              aria-label="Costo por lead de pauta, en pesos"
            />
          </div>
        </div>
      </div>

      <Bloque
        sinRelleno
        titulo="Planeación de pauta"
        descripcion="Cuánta pauta hay que comprar, por departamento, para cerrar los cupos que faltan."
      >
        {!datos || datos.filas.length === 0 ? (
          <p className="px-7 py-6 text-[0.78125rem] text-texto-suave">
            {accionId
              ? "Esta acción de formación no tiene oferta cargada en ningún departamento."
              : "Elija una acción de formación para calcular la pauta."}
          </p>
        ) : (
          <>
            <div className="caja-scroll tabla-fija overflow-auto">
              <table className="tabla-datos w-full">
                <thead>
                  <tr>
                    <th>Departamento</th>
                    <th>Total cupos</th>
                    <th>Reservados</th>
                    <th>Inscritos</th>
                    <th>Cupos pend.</th>
                    <th>Leads orgánicos</th>
                    <th>Leads importados</th>
                    <th>Total leads</th>
                    <th>Se pueden inscribir</th>
                    <th>Faltan</th>
                    <th>Leads pauta</th>
                    <th>Costo pauta</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.filas.map((f) => {
                    const c = calcular(f);
                    return (
                      <tr key={f.departamento}>
                        <td>{f.departamento}</td>
                        <td className="tabular-nums">{n(f.totalCupos)}</td>
                        <td className="tabular-nums">{n(f.reservados)}</td>
                        <td className="font-semibold text-exito tabular-nums">
                          {n(f.inscritos)}
                        </td>
                        <td className="tabular-nums">{n(c.pendientes)}</td>
                        <td className="tabular-nums">{n(f.leadsOrganicos)}</td>
                        <td className="tabular-nums">{n(f.leadsImportados)}</td>
                        <td className="tabular-nums">{n(c.totalLeads)}</td>
                        <td className="tabular-nums">{n(c.sePuedenInscribir)}</td>
                        <td className="tabular-nums">{n(c.faltan)}</td>
                        <td className="font-semibold tabular-nums">{n(c.leadsPauta)}</td>
                        <td className="font-semibold text-marca tabular-nums">
                          {pesos(c.costoPauta)}
                        </td>
                      </tr>
                    );
                  })}
                  {(() => {
                    const t = datos.totales;
                    const c = calcular(t);
                    return (
                      <tr className="font-bold">
                        <td>Total</td>
                        <td className="tabular-nums">{n(t.totalCupos)}</td>
                        <td className="tabular-nums">{n(t.reservados)}</td>
                        <td className="text-exito tabular-nums">{n(t.inscritos)}</td>
                        <td className="tabular-nums">{n(c.pendientes)}</td>
                        <td className="tabular-nums">{n(t.leadsOrganicos)}</td>
                        <td className="tabular-nums">{n(t.leadsImportados)}</td>
                        <td className="tabular-nums">{n(c.totalLeads)}</td>
                        <td className="tabular-nums">{n(c.sePuedenInscribir)}</td>
                        <td className="tabular-nums">{n(c.faltan)}</td>
                        <td className="tabular-nums">{n(c.leadsPauta)}</td>
                        <td className="text-marca tabular-nums">{pesos(c.costoPauta)}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            <p className="border-t border-borde px-7 py-3 text-[0.6875rem] leading-relaxed text-texto-suave">
              Cupos pend. = total cupos − inscritos − reservados. Se pueden inscribir =
              total leads ÷ conversión. Faltan = cupos pendientes − los que se pueden
              inscribir. Leads pauta = faltan × conversión. Costo pauta = leads pauta ×
              costo por lead.
              <br />
              Total cupos y Reservados vienen del CRM; los reservados descuentan cupo
              aunque todavía no figuren como inscritos.
            </p>
          </>
        )}
      </Bloque>
    </div>
  );
}
