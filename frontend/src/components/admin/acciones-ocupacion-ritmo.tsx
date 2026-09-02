"use client";

/** Las acciones de formación: cuánto llevan y a qué ritmo. */

/**
 * Fusión de dos bloques que hablaban de las MISMAS quince
 * acciones: «Qué va más lento» y «Avance por acción de
 * formación». Eran dos vistas del mismo conjunto, y tenerlas
 * separadas obligaba a cruzar a mano cuál de las estancadas era
 * además la que más lejos está de su tope.
 *
 * Ordenada por ritmo ASCENDENTE dentro de cada gremio: arriba
 * lo más parado, que es donde hay que empujar. Ordenarla por
 * avance pondría arriba lo que va bien, que es justo lo que no
 * hay que mirar.
 */

import Link from "next/link";

import { BarraAvance, n } from "./graficos";
import { Bloque } from "./piezas";
import { Tendencia, textoDeEstado } from "./ritmo";
import { bonito } from "@/lib/api";
import type { FilaAccion, InformeProyeccion } from "@/lib/tableros-api";

export function AccionesOcupacionRitmo({
  acciones,
  proyeccion,
}: {
  acciones: FilaAccion[];
  proyeccion: InformeProyeccion;
}) {
  /// El ritmo de cada acción, por id. El join va por `id` y no
  /// por código: el código se repite entre convenios.
  const ritmoDe = new Map(proyeccion.acciones.map((p) => [p.id, p]));

  const porConvenio = new Map<string, FilaAccion[]>();
  for (const a of acciones) {
    const k = a.convenioSigla ?? a.convenio;
    porConvenio.set(k, [...(porConvenio.get(k) ?? []), a]);
  }

  for (const lista of porConvenio.values()) {
    lista.sort((x, y) => {
      const rx = ritmoDe.get(x.id)?.ritmoDiario ?? 0;
      const ry = ritmoDe.get(y.id)?.ritmoDiario ?? 0;
      return rx - ry;
    });
  }

  return (
    <Bloque
      sinRelleno
      titulo="Acciones de formación: ocupación y ritmo"
      descripcion="Lo más parado, arriba. Pulse una acción para ver su detalle."
    >
      {/* La tabla scrollea dentro de su caja: cinco columnas
          apretadas en un portátil cortan el nombre del curso,
          que es lo que identifica la fila. */}
      <div className="caja-scroll overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-borde text-left">
              {["Acción", "Avance sobre el tope", "Ritmo/día", "Tendencia", "A este ritmo"].map(
                (c, i) => (
                  <th
                    key={c}
                    className={`px-4 py-2.5 text-[10.5px] font-bold tracking-[0.05em] uppercase text-texto-suave ${
                      i === 0 ? "pl-7" : ""
                    } ${i === 2 ? "text-right" : ""}`}
                  >
                    {c}
                  </th>
                ),
              )}
            </tr>
          </thead>

          {[...porConvenio.entries()].map(([sigla, lista]) => (
            <tbody key={sigla}>
              <tr>
                <td
                  colSpan={5}
                  className="bg-superficie-alterna px-4 py-2 pl-7 text-[0.625rem] font-semibold tracking-[0.1em] uppercase text-texto-suave"
                >
                  {sigla}
                </td>
              </tr>

              {lista.map((a) => {
                const p = ritmoDe.get(a.id) ?? null;
                return (
                  <tr key={a.id} className="border-b border-hairline">
                    <td className="max-w-[20rem] px-4 py-2.5 pl-7">
                      <Link
                        href={`/admin/acciones/${a.id}`}
                        className="hover:text-marca hover:underline"
                      >
                        <span className="font-mono text-xs text-texto-suave">
                          {a.codigo}
                        </span>{" "}
                        <span className="text-[13px]">{bonito(a.nombre)}</span>
                      </Link>
                      {a.enEspera > 0 && (
                        <span className="mt-0.5 block text-[11px] text-aviso">
                          {n(a.enEspera)} en lista de espera
                        </span>
                      )}
                      {!a.visible && (
                        <span className="mt-0.5 block text-[11px] text-texto-suave">
                          sin publicar
                        </span>
                      )}
                    </td>

                    <td className="min-w-[10rem] px-4 py-2.5">
                      <BarraAvance valor={a.ocupados} maximo={a.cupos} compacta />
                    </td>

                    {/* El signo y el color, porque un ritmo
                        negativo no es «poco»: es que se está
                        cancelando más de lo que entra. */}
                    <td
                      className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                        !p || p.ritmoDiario === 0
                          ? "text-texto-suave"
                          : p.ritmoDiario < 0
                            ? "text-error"
                            : "text-exito"
                      }`}
                    >
                      {p ? `${p.ritmoDiario > 0 ? "+" : ""}${p.ritmoDiario.toFixed(1)}` : "—"}
                    </td>

                    <td className="px-4 py-2.5 text-[12.5px]">
                      {p ? <Tendencia p={p} /> : <span className="text-texto-suave">—</span>}
                    </td>

                    <td className="px-4 py-2.5 pr-7 text-[12.5px] text-texto-suave">
                      {p ? textoDeEstado(p) : "Sin datos de ritmo."}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </Bloque>
  );
}
