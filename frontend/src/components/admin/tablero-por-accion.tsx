"use client";

import { useCallback, useEffect, useState } from "react";

import { Desplegable } from "./desplegable";
import { ListaBarras, n } from "./graficos";
import { Bloque } from "./piezas";
import { pedir } from "@/lib/pedir";
import { bonito } from "@/lib/api";

type Fila = {
  departamento: string;
  directo: number;
  pagada: number;
  organica: number;
  interesados: number;
  inscritos: number;
  descartados: number;
  total: number;
};

type Tablero = {
  acciones: Array<{
    id: string;
    codigo: string;
    nombre: string;
    convenio: string;
    grupos: Array<{ id: string; numero: number; etiqueta: string }>;
  }>;
  filas: Fila[];
  totales: Omit<Fila, "departamento">;
  porCanasta: Array<{ canasta: string; etiqueta: string; total: number }>;
  serie: Array<{ dia: string; llegaron: number; inscritos: number }>;
  conversion: Array<{
    canasta: string;
    etiqueta: string;
    base: number;
    inscritos: number;
    tasa: number;
  }>;
};

const porcentaje = (x: number) =>
  `${(x * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;

const diaCorto = (t: string) => {
  const [, m, d] = t.slice(0, 10).split("-");
  return `${d}/${m}`;
};

/**
 * El informe por acción de formación.
 *
 * Responde lo que las hojas del cliente respondían a mano: para
 * una acción —y si se quiere, para un grupo— de qué departamento
 * salió cada lead, por qué puerta entró y en qué quedó.
 */
export function TableroPorAccion() {
  const [datos, setDatos] = useState<Tablero | null>(null);
  const [accionId, setAccionId] = useState("");
  const [coberturaId, setCoberturaId] = useState("");

  const cargar = useCallback(async () => {
    const q = new URLSearchParams();
    if (accionId) q.set("accionFormacionId", accionId);
    if (coberturaId) q.set("coberturaId", coberturaId);
    setDatos(
      await pedir<Tablero>(
        `/admin/participantes/control/por-accion${q.size ? `?${q}` : ""}`,
      ),
    );
  }, [accionId, coberturaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const accion = datos?.acciones.find((a) => a.id === accionId);
  const grupos = accion?.grupos ?? [];
  const t = datos?.totales;
  const topeSerie = Math.max(...(datos?.serie ?? []).map((d) => d.llegaron), 1);

  return (
    <Bloque
      titulo="Comportamiento por acción de formación"
      descripcion="Para una acción concreta: de qué departamento llegó cada lead, por qué canal entró y en qué quedó. Es el corte que decide dónde reforzar la captación."
      acciones={
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-[330px]">
            <Desplegable
              alto={34}
              marcador="Elija una acción de formación"
              valor={accionId}
              opciones={[
                { valor: "", etiqueta: "Elija una acción de formación" },
                ...(datos?.acciones ?? []).map((a) => ({
                  valor: a.id,
                  etiqueta: `${a.codigo} · ${bonito(a.nombre)}`,
                  detalle: `${a.convenio} · ${a.grupos.length} grupos`,
                })),
              ]}
              alElegir={(v) => {
                setAccionId(v);
                setCoberturaId("");
              }}
            />
          </div>
          {grupos.length > 0 && (
            <div className="w-[220px]">
              <Desplegable
                alto={34}
                marcador="Todos los grupos"
                valor={coberturaId}
                opciones={[
                  { valor: "", etiqueta: "Todos los grupos" },
                  ...grupos.map((g) => ({ valor: g.id, etiqueta: g.etiqueta })),
                ]}
                alElegir={setCoberturaId}
              />
            </div>
          )}
        </div>
      }
    >
      {!accionId ? (
        <p className="text-[0.78125rem] text-texto-suave">
          Elija una acción de formación para ver su comportamiento. El informe es por
          acción: la suma de todas ya está en los cortes de arriba.
        </p>
      ) : !t || t.total === 0 ? (
        <p className="text-[0.78125rem] text-texto-suave">
          Esta acción todavía no tiene leads registrados
          {coberturaId ? " en el grupo seleccionado" : ""}.
        </p>
      ) : (
        <div className="space-y-5">
          {/* las cifras del corte */}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { r: "Leads registrados", v: t.total, p: "en esta acción" },
              {
                r: "Llegaron a inscrito",
                v: t.inscritos,
                p: `${porcentaje(t.inscritos / t.total)} del total`,
              },
              {
                r: "Todavía en gestión",
                v: t.interesados,
                p: "sin inscribir ni descartar",
              },
              {
                r: "Descartados",
                v: t.descartados,
                p: `${porcentaje(t.descartados / t.total)} del total`,
              },
            ].map((c) => (
              <div
                key={c.r}
                className="rounded-lg border border-borde bg-superficie px-3.5 py-2"
              >
                <div className="truncate text-[0.6875rem] leading-none text-texto-suave">
                  {c.r}
                </div>
                <div className="mt-1 text-[1.0625rem] leading-none font-bold text-titulo tabular-nums">
                  {n(c.v)}
                </div>
                <div className="mt-1 truncate text-[0.6875rem] leading-none text-texto-suave">
                  {c.p}
                </div>
              </div>
            ))}
          </div>

          {/* cómo se comportó, día a día, hasta hoy */}
          <section>
            <h3 className="text-[0.625rem] font-semibold tracking-[0.1em] text-marca uppercase">
              Día a día
            </h3>
            <p className="mt-1 text-[0.71875rem] text-texto-suave">
              Cada barra es un día, del primero con movimiento hasta hoy. La altura son
              los leads que llegaron; la parte oscura, los que acabaron inscritos.
            </p>
            {datos.serie.length === 0 ? (
              <p className="mt-2 text-[0.78125rem] text-texto-suave">
                Todavía no hay días con movimiento.
              </p>
            ) : (
              <div className="mt-3 flex gap-2">
                <div className="flex h-24 w-8 shrink-0 flex-col justify-between pt-3 text-right text-[0.65625rem] text-texto-suave tabular-nums">
                  <span>{n(topeSerie)}</span>
                  <span>0</span>
                </div>
                <div className="min-w-0 grow">
                  <div className="flex h-24 items-end gap-[2px] border-b border-borde">
                    {datos.serie.map((d) => (
                      <div
                        key={d.dia}
                        title={`${diaCorto(d.dia)}: ${n(d.llegaron)} leads · ${n(d.inscritos)} inscritos`}
                        className="relative flex min-w-0 flex-1 flex-col justify-end"
                        style={{ height: "100%" }}
                      >
                        {/* Apilada: la barra entera son los leads
                            que llegaron y la parte de abajo, los que
                            acabaron inscritos. El interior va al pie
                            con `justify-end`, o se pega arriba y la
                            proporcion se lee al reves. */}
                        <div
                          className="mx-auto flex w-full max-w-[26px] flex-col justify-end rounded-t-[5px] bg-gradient-to-t from-marca to-marca/40"
                          style={{
                            height: `${Math.max(2, (d.llegaron / topeSerie) * 100)}%`,
                          }}
                        >
                          <div
                            className="w-full rounded-t-[3px] bg-exito"
                            style={{
                              height: `${d.llegaron ? (d.inscritos / d.llegaron) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-1 flex justify-between text-[0.65625rem] text-texto-suave tabular-nums">
                    <span>{diaCorto(datos.serie[0].dia)}</span>
                    <span>{datos.serie.length} días</span>
                    <span>{diaCorto(datos.serie[datos.serie.length - 1].dia)}</span>
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* por dónde entraron, y cuál convierte */}
          <section className="grid gap-6 border-t border-hairline pt-4 lg:grid-cols-2">
            <div>
              <h3 className="text-[0.625rem] font-semibold tracking-[0.1em] text-marca uppercase">
                Por dónde entraron
              </h3>
              <div className="mt-3">
                <ListaBarras
                  datos={datos.porCanasta.map((c) => ({
                    clave: c.canasta,
                    etiqueta: c.etiqueta,
                    valor: c.total,
                    detalle: t.total ? porcentaje(c.total / t.total) : undefined,
                  }))}
                  vacio="Sin leads que repartir."
                />
              </div>
            </div>
            <div>
              <h3 className="text-[0.625rem] font-semibold tracking-[0.1em] text-marca uppercase">
                Cuánto convierte cada canal
              </h3>
              <p className="mt-1 text-[0.71875rem] text-texto-suave">
                No es lo mismo que el volumen: un canal puede traer muchos leads y
                convertir poco. Esta es la cifra que decide dónde reforzar.
              </p>
              <div className="mt-3">
                <ListaBarras
                  datos={datos.conversion.map((c) => ({
                    clave: c.canasta,
                    etiqueta: c.etiqueta,
                    valor: Math.round(c.tasa * 100),
                    detalle: `${n(c.inscritos)} de ${n(c.base)}`,
                  }))}
                  sufijo=" %"
                  vacio="Todavía no hay con qué comparar."
                />
              </div>
            </div>
          </section>

          {/* el detalle por departamento */}
          <section className="border-t border-hairline pt-4">
            <h3 className="text-[0.625rem] font-semibold tracking-[0.1em] text-marca uppercase">
              Detalle por departamento
            </h3>
            <div className="caja-scroll tabla-fija mt-3 max-h-[420px] overflow-auto rounded-lg border border-borde">
              <table className="tabla-datos w-full">
                <thead>
                  <tr>
                    <th>Departamento</th>
                    <th>Directo y referidos</th>
                    <th>Campaña pagada</th>
                    <th>Redes orgánicas</th>
                    <th>En gestión</th>
                    <th>Inscritos</th>
                    <th>Descartados</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.filas.map((f) => (
                    <tr key={f.departamento}>
                      <td>{f.departamento}</td>
                      <td className="tabular-nums">{n(f.directo)}</td>
                      <td className="tabular-nums">{n(f.pagada)}</td>
                      <td className="tabular-nums">{n(f.organica)}</td>
                      <td className="tabular-nums">{n(f.interesados)}</td>
                      <td className="font-semibold text-exito tabular-nums">
                        {n(f.inscritos)}
                      </td>
                      <td className="tabular-nums">{n(f.descartados)}</td>
                      <td className="font-semibold tabular-nums">{n(f.total)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td>Total</td>
                    <td className="tabular-nums">{n(t.directo)}</td>
                    <td className="tabular-nums">{n(t.pagada)}</td>
                    <td className="tabular-nums">{n(t.organica)}</td>
                    <td className="tabular-nums">{n(t.interesados)}</td>
                    <td className="text-exito tabular-nums">{n(t.inscritos)}</td>
                    <td className="tabular-nums">{n(t.descartados)}</td>
                    <td className="tabular-nums">{n(t.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </Bloque>
  );
}
