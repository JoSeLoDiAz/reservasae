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
 *
 * PULSAR UNA ACCIÓN ABRE SUS GRUPOS, Y DICE CÓMO VAN.
 *
 * Antes el nombre era un enlace y se iba a la pantalla de la
 * acción, que es otra cosa. Y el primer intento de desplegado
 * enseñaba el REPARTO del proyecto --«Medellín 78 · Bogotá 65 ·
 * Antioquia 52», «250 + 30 % = 325»--, que es su estructura, no
 * cómo va: eso ya vive en la pantalla de la acción y aquí no
 * contesta nada.
 *
 * Lo que se enseña ahora es lo que se viene a mirar: cuánta
 * gente lleva dentro cada grupo contra sus cupos, y en qué
 * punto está su ventana de inscripción --abierta, por cerrar,
 * cerrada, o sin fecha cargada--.
 */

import Link from "next/link";
import { Fragment, useState } from "react";

import { BarraAvance, n } from "./graficos";
import { Bloque } from "./piezas";
import { Tendencia, textoDeEstado } from "./ritmo";
import { bonito } from "@/lib/api";
import type {
  FilaAccion,
  GrupoDeAccion,
  InformeProyeccion,
} from "@/lib/tableros-api";

const MODALIDAD: Record<string, string> = {
  PRESENCIAL: "Presencial",
  VIRTUAL: "Virtual",
  HIBRIDA: "Híbrido",
};

const FECHA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function fechaCorta(iso: string): string {
  return FECHA.format(new Date(`${iso}T00:00:00Z`));
}

export function AccionesOcupacionRitmo({
  acciones,
  proyeccion,
}: {
  acciones: FilaAccion[];
  proyeccion: InformeProyeccion;
}) {
  /// Varias a la vez, no una sola: comparar dos acciones es el
  /// motivo por el que se abren.
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  const alternar = (id: string) =>
    setAbiertas((previas) => {
      const siguiente = new Set(previas);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

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
      partible
      titulo="Acciones de formación"
      descripcion="Ritmo de inscripción por acción formativa. Pulse una acción para ver cómo van sus grupos."
    >
      {/* La tabla scrollea dentro de su caja: cinco columnas
          apretadas en un portátil cortan el nombre del curso,
          que es lo que identifica la fila. */}
      <div className="caja-scroll overflow-x-auto">
        <table className="w-full min-w-[880px] table-fixed text-sm">
          {/* Anchos explícitos, y `table-fixed` para que los
              respete.

              Sin esto el navegador reparte por contenido: las
              cuatro columnas de cifras se quedaban con la mitad
              --y ahí no hay nada que ensanchar, son números
              cortos-- y el nombre del curso, que es lo único
              largo y lo que identifica la fila, caía en tres
              renglones. Ahora manda la ACCIÓN, que es lo que se
              lee, y el veredicto del cronograma, que es la
              frase. */}
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[15%]" />
            <col className="w-[8%]" />
            <col className="w-[13%]" />
            <col className="w-[30%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-borde text-left">
              {[
                "Acción",
                "Avance sobre el tope",
                "Ritmo/día",
                "Tendencia",
                /// Era «A este ritmo», y ya no dice eso: la
                /// columna contesta contra la fecha de cierre
                /// del cronograma, no contra el infinito.
                "Contra el cronograma",
              ].map((c, i) => (
                <th
                  key={c}
                  className={`px-4 py-2.5 text-[10.5px] font-bold tracking-[0.05em] uppercase text-texto-suave ${
                    i === 0 ? "pl-7" : ""
                  } ${i === 2 ? "text-right" : ""}`}
                >
                  {c}
                </th>
              ))}
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
                const abierta = abiertas.has(a.id);

                return (
                  <Fragment key={a.id}>
                    <tr
                      className={`border-b border-hairline ${
                        abierta ? "bg-superficie-alterna/40" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 pl-7 align-top">
                        {/* Botón y no enlace: esto despliega,
                            no navega. Con `aria-expanded` para
                            que se sepa por teclado y por
                            lector. */}
                        <button
                          type="button"
                          onClick={() => alternar(a.id)}
                          aria-expanded={abierta}
                          className="imprimible flex items-start gap-1.5 text-left transition hover:text-marca"
                        >
                          <span
                            aria-hidden
                            className={`mt-1 text-[0.5rem] text-texto-suave transition-transform ${
                              abierta ? "rotate-90" : ""
                            }`}
                          >
                            &#9654;
                          </span>
                          <span>
                            <span className="font-mono text-xs text-texto-suave">
                              {a.codigo}
                            </span>{" "}
                            <span className="text-[13px]">{bonito(a.nombre)}</span>
                          </span>
                        </button>
                        {a.enEspera > 0 && (
                          <span className="mt-0.5 block pl-4 text-[11px] text-aviso">
                            {n(a.enEspera)} en lista de espera
                          </span>
                        )}
                        {!a.visible && (
                          <span className="mt-0.5 block pl-4 text-[11px] text-texto-suave">
                            sin publicar
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-2.5 align-top">
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
                        } align-top`}
                      >
                        {p
                          ? `${p.ritmoDiario > 0 ? "+" : ""}${p.ritmoDiario.toFixed(1)}`
                          : "—"}
                      </td>

                      <td className="px-4 py-2.5 align-top text-[12.5px]">
                        {p ? (
                          <Tendencia p={p} />
                        ) : (
                          <span className="text-texto-suave">—</span>
                        )}
                      </td>

                      <td className="px-4 py-2.5 pr-7 align-top text-[12.5px] text-texto-suave">
                        {p ? textoDeEstado(p) : "Sin datos de ritmo."}
                      </td>
                    </tr>

                    {abierta && (
                      <tr className="border-b border-hairline">
                        {/* Fondo de superficie y sin barra de
                            color al costado.

                            El fondo era `superficie-alterna`, el
                            MISMO que usa el carril de las barras
                            de avance, y sobre él la barra de un
                            grupo al 0 % era invisible: parecía
                            que no hubiera gráfico. Que cuelga de
                            su acción ya lo dicen la sangría y el
                            triángulo abierto de la fila. */}
                        <td
                          colSpan={5}
                          className="bg-superficie px-4 py-4 pl-11 pr-7"
                        >
                          <Grupos accion={a} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </Bloque>
  );
}

/**
 * Cómo va cada grupo de una acción, en columnas alineadas.
 *
 * Tres intentos y este es el que se sostiene. En rejilla de dos
 * columnas, una acción de UN grupo dejaba media fila en blanco.
 * En fichas de ancho acotado, dejaba en blanco TRES cuartos.
 * El error era tratar cada grupo como una tarjeta: el
 * desplegado ocupa el ancho de la tabla que lo contiene, y ese
 * ancho hay que llenarlo con información, no estirando una
 * ficha ni dejándolo vacío.
 *
 * Así que los grupos se leen como se lee la tabla de arriba:
 * una fila cada uno y las mismas cuatro columnas alineadas
 * --quién es, cómo va, qué le falta y hasta cuándo--, que
 * además es lo que permite comparar ocho grupos de un vistazo.
 * Con uno o con ocho se ve igual de lleno.
 */
function Grupos({ accion }: { accion: FilaAccion }) {
  if (accion.grupos.length === 0) {
    return (
      <p className="text-[0.8125rem] text-texto-suave">
        Esta acción todavía no tiene grupos programados.{" "}
        <Enlace id={accion.id} />
      </p>
    );
  }

  const sinFecha = accion.grupos.filter((g) => g.estadoVentana === "SIN_FECHAS").length;

  return (
    <div>
      <div className="grid gap-x-8 gap-y-1 md:grid-cols-[minmax(11rem,1.2fr)_minmax(12rem,1.5fr)_minmax(9rem,1fr)_minmax(12rem,1.4fr)]">
        <Cabecera>Grupo</Cabecera>
        <Cabecera>Inscritos sobre sus cupos</Cabecera>
        <Cabecera>Faltan</Cabecera>
        <Cabecera>Inscripción</Cabecera>

        {accion.grupos.map((g) => (
          <FilaGrupo key={g.numero} grupo={g} />
        ))}
      </div>

      {/* Sin fecha no hay cierre, y sin cierre no hay
          predicción. Decirlo aquí es lo accionable: alguien
          carga la fecha y la columna del cronograma empieza a
          contestar. */}
      {sinFecha > 0 && (
        <p className="mt-4 text-[0.75rem] text-aviso">
          {sinFecha === 1
            ? "Un grupo sin fecha de inicio: sin ella no se puede calcular su cierre."
            : `${n(sinFecha)} grupos sin fecha de inicio: sin ella no se puede calcular su cierre.`}
        </p>
      )}

      <p className="mt-4">
        <Enlace id={accion.id} />
      </p>
    </div>
  );
}

/// Los rótulos solo existen en pantalla ancha: apilado, cada
/// dato ya va con su propia palabra y repetirlos sobraría.
function Cabecera({ children }: { children: React.ReactNode }) {
  return (
    <div className="hidden pb-2 text-[0.625rem] font-bold tracking-[0.06em] uppercase text-texto-suave md:block">
      {children}
    </div>
  );
}

/**
 * Un grupo: cuántos tiene, cuántos le faltan y con cuántos
 * leads cuenta para llenarlos.
 *
 * Ese es el orden y es una sola decisión: si faltan 27 y hay 40
 * por depurar, se llama; si faltan 27 y no hay ninguno, el
 * problema es de captación y no de gestión, y se resuelve en
 * otro sitio.
 *
 * La cifra no se repite. Un intento anterior ponía «0 de 39
 * (0,0 %)» sobre la barra y debajo «0 inscritos», que es lo
 * mismo dicho dos veces.
 */
function FilaGrupo({ grupo: g }: { grupo: GrupoDeAccion }) {
  const cerrada = g.estadoVentana === "CERRADA";
  const pct = g.cuposMaximos > 0 ? (g.inscritos / g.cuposMaximos) * 100 : 0;

  return (
    <>
      <div className="border-t border-hairline pt-2.5 text-[0.8125rem] md:border-t-0 md:pt-2">
        <span className="font-semibold text-titulo">Grupo {g.numero}</span>
        <span className="text-texto-suave">
          {" "}
          · {MODALIDAD[g.modalidad] ?? g.modalidad}
          {g.sede ? ` · ${bonito(g.sede)}` : ""}
        </span>
      </div>

      <div className="flex items-center gap-3 md:pt-2">
        <div
          role="meter"
          aria-valuenow={g.inscritos}
          aria-valuemin={0}
          aria-valuemax={g.cuposMaximos}
          aria-label={`Grupo ${g.numero}: ${n(g.inscritos)} de ${n(g.cuposMaximos)}`}
          className="h-2 min-w-0 grow overflow-hidden rounded-full border border-borde/60 bg-superficie"
        >
          <div
            className="h-full rounded-full bg-marca transition-[width] duration-500"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <span className="shrink-0 text-[0.75rem] text-texto-suave tabular-nums">
          <strong className="font-semibold text-texto">{n(g.inscritos)}</strong> de{" "}
          {n(g.cuposMaximos)}
        </span>
      </div>

      <div className="text-[0.75rem] text-texto-suave md:pt-2">
        {g.faltan === 0 ? (
          <span className="font-semibold text-exito">Completo</span>
        ) : (
          <>
            <strong
              className={`font-semibold tabular-nums ${
                cerrada ? "text-texto" : "text-aviso"
              }`}
            >
              {n(g.faltan)}
            </strong>{" "}
            cupos
            {/* La bolsa con la que se llenan, solo mientras
                quede ventana: en un grupo cerrado, ofrecer
                leads invita a un trabajo que ya no sirve para
                este grupo. */}
            {!cerrada && (
              <span className="block">
                {g.porDepurar > 0 ? (
                  <>
                    <strong className="font-semibold tabular-nums text-texto">
                      {n(g.porDepurar)}
                    </strong>{" "}
                    {g.porDepurar === 1 ? "lead por depurar" : "leads por depurar"}
                  </>
                ) : (
                  "sin leads por depurar"
                )}
              </span>
            )}
          </>
        )}
      </div>

      <div className="pb-2.5 text-[0.75rem] md:pt-2 md:pb-0">
        <Ventana grupo={g} />
      </div>
    </>
  );
}

/**
 * En qué punto va la ventana de inscripción del grupo.
 *
 * El color no va solo: cada estado lleva su palabra, porque
 * ámbar y rojo quedan a menos de cinco de distancia bajo
 * deuteranopia y la ventana cerrada no se puede confundir con
 * la que está por cerrar.
 */
function Ventana({ grupo: g }: { grupo: GrupoDeAccion }) {
  if (g.estadoVentana === "SIN_FECHAS" || !g.cierre) {
    return (
      <span className="font-semibold text-aviso">Sin fecha en el cronograma</span>
    );
  }

  if (g.estadoVentana === "CERRADA") {
    return (
      <span className="text-texto-suave">Cerrada el {fechaCorta(g.cierre)}</span>
    );
  }

  const habiles = g.diasHabilesRestantes;
  const cuantos =
    habiles === null
      ? null
      : habiles === 0
        ? "último día"
        : habiles === 1
          ? "queda 1 día hábil"
          : `quedan ${n(habiles)} días hábiles`;

  /// AVISANDO es la ventana de los tres dias de margen: es
  /// cuando todavia se puede llamar a alguien, y por eso se
  /// pinta y no se deja en gris.
  const urgente = g.estadoVentana === "AVISANDO";

  return (
    <span className={urgente ? "font-semibold text-aviso" : "text-texto-suave"}>
      {urgente ? "Cierra" : "Abierta hasta"} el {fechaCorta(g.cierre)}
      {cuantos && <span className="block font-normal">{cuantos}</span>}
    </span>
  );
}

function Enlace({ id }: { id: string }) {
  return (
    <Link
      href={`/admin/acciones/${id}`}
      className="text-[0.71875rem] font-semibold text-marca hover:underline"
    >
      Abrir la acción completa
    </Link>
  );
}
