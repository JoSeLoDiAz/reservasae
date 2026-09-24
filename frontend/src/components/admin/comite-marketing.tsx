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
  const [convenio, setConvenio] = useState("");
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

  /// Los convenios salen del propio catálogo: uno inventado no
  /// tendría ninguna acción detrás, y la lista se acota sola a
  /// los que esta cuenta puede ver.
  const convenios = [...new Set((catalogo?.acciones ?? []).map((a) => a.convenio))].sort();

  /// Hay un grupo elegido: la fila deja de hablar de la ciudad entera.
  const porGrupo = coberturaId !== "";
  const visibles = (catalogo?.acciones ?? []).filter(
    (a) => !convenio || a.convenio === convenio,
  );

  /// Las cinco columnas calculadas, en un sitio: la tabla y su
  /// fila de totales las necesitan iguales.
  const calcular = (f: {
    totalCupos: number;
    reservados: number;
    inscritos: number;
    leadsOrganicos: number;
    leadsImportados: number;
  }) => {
    /// LOS RESERVADOS NO DESCUENTAN CUPO. NUNCA.
    ///
    /// Restaban --salvo con un grupo elegido-- y el cliente lo corrigió:
    /// «las reservas no descuentan, no entiendo por qué cambias esto, se
    /// materializa cuando llega, ahí sí» (23 sep 2026). Una reserva es
    /// una intención de una organización: aparta cupos en una ciudad,
    /// sin nombres, y puede no llegar nadie. El cupo se consume cuando
    /// la persona existe y queda inscrita, y ahí ya lo cuenta
    /// `inscritos`. Restar las dos cosas contaba el mismo cupo dos veces
    /// y hacía comprar menos pauta de la que se necesita.
    ///
    /// La columna «Reservados» se queda: dice cuánta intención hay
    /// detrás, que es información para el comité, pero no toca la
    /// cuenta.
    const pendientes = Math.max(0, f.totalCupos - f.inscritos);
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
      {/* LOS FILTROS, EN SU CAJA Y A LA IZQUIERDA. Iban sin caja y
          pegados a la derecha, encima del título: «abajo, acomodado
          estos filtros» (cliente, 23 sep 2026). Con rótulo ENCIMA de
          cada control, como en Mesa de entrada, que es lo que deja
          alinearlos sin que cada pareja se coloque a su aire. */}
      <div className="rounded-lg border border-borde bg-superficie px-4 py-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="w-[11rem]">
            <p className="mb-1.5 text-[12.5px] font-medium">Convenio</p>
            {/* El desplegable de la casa, como los otros dos de esta
                misma barra: dos nativos en medio de tres de la casa se
                veían de otra familia --lista cuadrada y azul del
                sistema--. */}
            <Desplegable
                alto={32}
                etiquetaAria="Convenio"
                marcador="Ambos convenios"
                valor={convenio}
                opciones={[
                  { valor: "", etiqueta: "Ambos convenios" },
                  ...convenios.map((c) => ({ valor: c, etiqueta: c })),
                ]}
                alElegir={(v) => {
                  setConvenio(v);
                  /// Si la acción elegida no es de ese convenio, se pasa
                  /// a la primera que sí: dejarla puesta enseñaría una
                  /// tabla que el filtro dice no estar mirando.
                  const quedan = (catalogo?.acciones ?? []).filter(
                    (a) => !v || a.convenio === v,
                  );
                  if (!quedan.some((a) => a.id === accionId)) {
                    setAccionId(quedan[0]?.id ?? "");
                    setCoberturaId("");
                  }
                }}
              />
          </div>

          <div className="w-[min(420px,100%)] grow">
            <p className="mb-1.5 text-[12.5px] font-medium">Acción de formación</p>
            <Desplegable
                alto={32}
                marcador="Elija una acción"
                valor={accionId}
                opciones={visibles.map((a) => ({
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

          <div className="w-[190px]">
            <p className="mb-1.5 text-[12.5px] font-medium">Grupo</p>
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

          <div className="w-[9.5rem]">
            <p className="mb-1.5 text-[12.5px] font-medium">Conversión</p>
            <Desplegable
                alto={32}
                etiquetaAria="Leads por inscrito"
                valor={String(conversion)}
                opciones={Array.from({ length: 10 }, (_, i) => i + 1).map((v) => ({
                  valor: String(v),
                  etiqueta: `${v} ${v === 1 ? "lead" : "leads"} · 1 inscrito`,
                }))}
                alElegir={(v) => setConversion(Number(v))}
              />
          </div>

          <div className="w-[8.5rem]">
            <p className="mb-1.5 text-[12.5px] font-medium">Costo por lead</p>
            <input
              type="number"
              min={0}
              step={500}
              className={`${CLASE_CONTROL} w-full`}
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
                    {!porGrupo && <th>Reservados</th>}
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
                        {!porGrupo && (
                          <td className="tabular-nums">{n(f.reservados)}</td>
                        )}
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
                        {!porGrupo && (
                          <td className="tabular-nums">{n(t.reservados)}</td>
                        )}
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

            {/* SIN EL PIE DE FÓRMULAS. Estaban las cinco cuentas
                escritas --«cupos pend. = total cupos − inscritos…»-- y
                la nota de los reservados, y el cliente las quitó (23 sep
                2026): los títulos de las columnas ya las nombran, y la
                nota de los reservados dejó de ser cierta el mismo día.
                Las cuentas viven en `calcular`, con su comentario. */}
          </>
        )}
      </Bloque>
    </div>
  );
}
