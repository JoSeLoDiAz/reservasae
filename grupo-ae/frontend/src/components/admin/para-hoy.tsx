"use client";

/** «¿A quién llamo hoy?»: lo vencido, lo de hoy y lo que nadie tiene agendado. */

/**
 * LA PRIMERA PREGUNTA DEL DÍA DE UN ASESOR.
 *
 * El Resumen decía cuánto dinero hay y dónde está, pero no qué hacer
 * esta mañana. La agenda y la lista de negocios «sin próximo paso»
 * existían en el backend y ninguna pantalla las mostraba (auditoría
 * del 18 sep 2026).
 *
 * Dos columnas: lo comprometido para hoy —con lo vencido arriba y en
 * rojo, que es lo que ya se falló— y los negocios abiertos que nadie
 * tiene agendados, que son los que se enfrían sin que nadie lo decida.
 *
 * Cada renglón lleva a la ficha del negocio en el embudo.
 *
 * Se carga APARTE del resto del Resumen: si la agenda falla, la
 * portada se sigue viendo entera, con un aviso solo aquí.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { Apoyo, Banda } from "@/components/admin/piezas-de-venta";
import { Codigo, Rotulo } from "@/components/admin/datos-del-negocio";
import { ErrorApi } from "@/lib/api";
import {
  cuandoVence,
  gestionesApi,
  ROTULO_GESTION,
  type Agenda,
  type GestionConNegocio,
  type SinProximoPaso,
} from "@/lib/gestiones-api";

const enlace = (id: string, embudo: string) => `/admin/embudo?abrir=${id}&embudo=${embudo}`;

function deQuien(g: GestionConNegocio): string | null {
  const o = g.oportunidad;
  return (
    o.empresa?.razonSocial ??
    (o.persona ? `${o.persona.primerNombre} ${o.persona.primerApellido}` : null)
  );
}

export function ParaHoy() {
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [sinPaso, setSinPaso] = useState<SinProximoPaso | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.allSettled([gestionesApi.agenda(true), gestionesApi.sinProximoPaso(true)]).then(
      ([a, s]) => {
        if (!vivo) return;
        if (a.status === "fulfilled") setAgenda(a.value);
        if (s.status === "fulfilled") setSinPaso(s.value);
        const fallo = [a, s].find((r) => r.status === "rejected") as
          | PromiseRejectedResult
          | undefined;
        if (fallo) {
          setError(
            fallo.reason instanceof ErrorApi
              ? `No pudimos traer toda la agenda: ${fallo.reason.message}`
              : "No pudimos traer toda la agenda.",
          );
        }
      },
    );
    return () => {
      vivo = false;
    };
  }, []);

  const ahora = new Date();
  const paraHoy = agenda ? [...agenda.vencidas, ...agenda.hoy] : [];

  return (
    <Banda className="@container">
      {error && <p className="estado mb-2">{error}</p>}
      <div className="grid gap-6 @[900px]:grid-cols-2">
        <section>
          <Rotulo titulo>Para hoy</Rotulo>
          <Apoyo>
            {agenda
              ? agenda.cuantas.vencidas > 0
                ? `${agenda.cuantas.vencidas} vencida${agenda.cuantas.vencidas === 1 ? "" : "s"} y ${agenda.cuantas.hoy} para hoy. Lo vencido va primero.`
                : `${agenda.cuantas.hoy} para hoy · ${agenda.cuantas.estaSemana} más esta semana.`
              : "Lo comprometido para hoy, del equipo."}
          </Apoyo>
          {agenda && paraHoy.length === 0 && (
            <p className="mt-3 text-[0.8125rem] text-texto-suave">
              Nada agendado para hoy. Se agenda desde la ficha de cada negocio, en «Próximo paso».
            </p>
          )}
          {paraHoy.length > 0 && (
            <ul className="mt-3 flex flex-col">
              {paraHoy.slice(0, 8).map((g) => {
                const vencida = g.venceEn !== null && new Date(g.venceEn) < ahora;
                return (
                  <li key={g.id} className="border-t border-hairline py-2 first:border-0 first:pt-0">
                    <Link
                      href={enlace(g.oportunidad.id, g.oportunidad.embudo)}
                      className="flex items-baseline justify-between gap-3 hover:underline"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[0.8125rem] text-texto">
                          {ROTULO_GESTION[g.tipo]} · {g.titulo}
                        </span>
                        <span className="block truncate text-[0.71875rem] text-texto-suave">
                          <Codigo>{g.oportunidad.codigo}</Codigo> {deQuien(g) ?? g.oportunidad.titulo}
                          {g.asesor ? ` · ${g.asesor.nombre}` : ""}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 text-[0.71875rem] tabular-nums ${vencida ? "text-error" : "text-texto-suave"}`}
                      >
                        {cuandoVence(g.venceEn, ahora)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <Rotulo titulo>Sin próximo paso</Rotulo>
          <Apoyo>
            Negocios abiertos que nadie tiene agendados: se enfrían sin que nadie lo decida.
          </Apoyo>
          {sinPaso && sinPaso.oportunidades.length === 0 && (
            <p className="mt-3 text-[0.8125rem] text-texto-suave">
              Todos los negocios abiertos tienen un siguiente paso.
            </p>
          )}
          {sinPaso && sinPaso.oportunidades.length > 0 && (
            <ul className="mt-3 flex flex-col">
              {sinPaso.oportunidades.slice(0, 8).map((o) => (
                <li key={o.id} className="border-t border-hairline py-2 first:border-0 first:pt-0">
                  <Link
                    href={enlace(o.id, o.embudo)}
                    className="flex items-baseline justify-between gap-3 hover:underline"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[0.8125rem] text-texto">{o.titulo}</span>
                      <span className="block truncate text-[0.71875rem] text-texto-suave">
                        <Codigo>{o.codigo}</Codigo> {o.deQuien ?? ""}
                        {o.asesor ? ` · ${o.asesor.nombre}` : " · sin asesor"}
                      </span>
                    </span>
                    <span className="shrink-0 text-[0.71875rem] tabular-nums text-texto-suave">
                      {o.diasQuieta === 0 ? "hoy" : `${o.diasQuieta} d quieta`}
                    </span>
                  </Link>
                </li>
              ))}
              {sinPaso.cuantas > 8 && (
                <li className="pt-2 text-[0.71875rem] text-texto-suave">y {sinPaso.cuantas - 8} más.</li>
              )}
            </ul>
          )}
        </section>
      </div>
    </Banda>
  );
}
