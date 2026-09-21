"use client";

/** El próximo paso de un negocio: lo que hay que hacer, y cuándo. */

/**
 * LA PREGUNTA QUE EL CRM NO SABÍA CONTESTAR.
 *
 * «¿Qué sigue con este negocio?». La ficha tenía «Nota», que cuenta lo
 * que PASÓ, pero nada para comprometer lo que va a pasar: sin fecha no
 * hay recordatorio, sin recordatorio no hay agenda, y sin agenda el
 * asesor trabaja de memoria (auditoría del 18 sep 2026).
 *
 * Aquí se agenda (llamada, WhatsApp, reunión…) con fecha y hora, se
 * marca hecha cuando se hace, y se registra lo que ya se hizo sin
 * haberlo agendado. Lo HECHO es lo que cuenta el bananeo: por eso esta
 * sección es la que por fin lo puede encender.
 *
 * La Nota de la ficha NO cambia: sigue siendo el apunte libre.
 */

import { useCallback, useEffect, useState } from "react";

import { Boton, CLASE_CONTROL } from "@/components/admin/marco-admin";
import { Rotulo } from "@/components/admin/datos-del-negocio";
import { ErrorApi } from "@/lib/api";
import {
  cuandoVence,
  gestionesApi,
  ROTULO_GESTION,
  TIPOS_DE_GESTION,
  type Gestion,
  type TipoGestion,
} from "@/lib/gestiones-api";

/// La fecha de mañana a las 9, en el formato del campo: es el
/// compromiso más común, y dejar el campo vacío invita a no ponerlo.
function mananaALasNueve(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T09:00`;
}

export function ProximoPaso({
  oportunidadId,
  puedeEscribir = true,
  alCambiar,
}: {
  oportunidadId: string;
  puedeEscribir?: boolean;
  alCambiar?: () => void;
}) {
  const [datos, setDatos] = useState<{ pendientes: Gestion[]; hechas: Gestion[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoGestion>("LLAMADA");
  const [titulo, setTitulo] = useState("");
  const [cuando, setCuando] = useState(mananaALasNueve);
  const [yaLoHice, setYaLoHice] = useState(false);
  const [yendo, setYendo] = useState(false);
  const [verHechas, setVerHechas] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await gestionesApi.deOportunidad(oportunidadId);
      setDatos({ pendientes: r.pendientes, hechas: r.hechas });
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No pudimos traer las gestiones.");
    }
  }, [oportunidadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  async function agendar(evento: React.FormEvent) {
    evento.preventDefault();
    if (titulo.trim().length < 3) {
      setError("Escriba en una línea qué hay que hacer (al menos 3 letras).");
      return;
    }
    setYendo(true);
    setError(null);
    try {
      const fecha = cuando ? new Date(cuando).toISOString() : null;
      await gestionesApi.crear(oportunidadId, {
        tipo,
        titulo: titulo.trim(),
        /// «Ya lo hice» guarda la fecha como la de cuando se hizo;
        /// si no, es un compromiso con vencimiento.
        ...(yaLoHice ? { hechaEn: fecha ?? new Date().toISOString() } : { venceEn: fecha }),
      });
      setTitulo("");
      setYaLoHice(false);
      setCuando(mananaALasNueve());
      await cargar();
      alCambiar?.();
    } catch (e) {
      setError(
        e instanceof ErrorApi && e.estado < 500
          ? e.message
          : "No pudimos guardar la gestión. Lo que escribió sigue aquí; inténtelo otra vez.",
      );
    } finally {
      setYendo(false);
    }
  }

  async function marcar(g: Gestion, hecha: boolean) {
    setError(null);
    try {
      if (hecha) await gestionesApi.hecha(g.id);
      else await gestionesApi.reabrir(g.id);
      await cargar();
      alCambiar?.();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No pudimos cambiar la gestión.");
    }
  }

  const ahora = new Date();

  return (
    <section>
      <Rotulo>Próximo paso</Rotulo>
      {error && <p className="estado mt-2">{error}</p>}

      {!datos && !error && <p className="mt-2 text-[0.8125rem] text-texto-suave">Trayendo…</p>}

      {datos && (
        <>
          {datos.pendientes.length === 0 ? (
            <p className="mt-2 text-[0.8125rem] text-texto-suave">
              Nadie se ha comprometido a nada con este negocio. Agende el siguiente paso:
              así sale en la agenda y no se enfría.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {datos.pendientes.map((g) => {
                const vencida = g.venceEn !== null && new Date(g.venceEn) < ahora;
                return (
                  <li
                    key={g.id}
                    className="flex items-baseline justify-between gap-3 border-t border-hairline py-2 first:border-0"
                  >
                    <span className="min-w-0">
                      <span className="text-[0.8125rem] text-texto">
                        {ROTULO_GESTION[g.tipo]} · {g.titulo}
                      </span>
                      <span
                        className={`block text-[0.71875rem] ${vencida ? "text-error" : "text-texto-suave"}`}
                      >
                        {vencida ? "Vencida · " : ""}
                        {cuandoVence(g.venceEn, ahora)}
                        {g.asesor ? ` · ${g.asesor.nombre}` : ""}
                      </span>
                    </span>
                    {puedeEscribir && (
                      <button
                        type="button"
                        onClick={() => void marcar(g, true)}
                        className="estado shrink-0 text-marca underline-offset-2 hover:underline"
                      >
                        Hecha
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {puedeEscribir && (
            <form onSubmit={agendar} className="mt-3 grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <select
                aria-label="Tipo de gestión"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoGestion)}
                className={CLASE_CONTROL}
              >
                {TIPOS_DE_GESTION.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.rotulo}
                  </option>
                ))}
              </select>
              <input
                aria-label="Qué hay que hacer"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={160}
                placeholder="Ej.: enviarle la cotización de 40 licencias"
                className={CLASE_CONTROL}
              />
              <input
                type="datetime-local"
                aria-label={yaLoHice ? "Cuándo lo hizo" : "Para cuándo"}
                value={cuando}
                onChange={(e) => setCuando(e.target.value)}
                className={`${CLASE_CONTROL} sm:col-span-2`}
              />
              <label className="flex items-center gap-2 text-[0.8125rem] text-texto sm:col-span-2">
                <input
                  type="checkbox"
                  checked={yaLoHice}
                  onChange={(e) => setYaLoHice(e.target.checked)}
                />
                Ya lo hice: registrarlo como hecho con esa fecha
              </label>
              <div className="sm:col-span-2">
                <Boton type="submit" disabled={yendo || titulo.trim().length < 3}>
                  {yendo ? "Guardando…" : yaLoHice ? "Registrar lo hecho" : "Agendar"}
                </Boton>
              </div>
            </form>
          )}

          {datos.hechas.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setVerHechas((v) => !v)}
                className="estado text-texto-suave underline-offset-2 hover:underline"
              >
                {verHechas ? "Ocultar" : "Ver"} {datos.hechas.length}{" "}
                {datos.hechas.length === 1 ? "gestión hecha" : "gestiones hechas"}
              </button>
              {verHechas && (
                <ul className="mt-2 flex flex-col">
                  {datos.hechas.map((g) => (
                    <li
                      key={g.id}
                      className="flex items-baseline justify-between gap-3 border-t border-hairline py-2 first:border-0"
                    >
                      <span className="min-w-0 text-[0.8125rem] text-texto-suave">
                        {ROTULO_GESTION[g.tipo]} · {g.titulo}
                        <span className="block text-[0.71875rem]">
                          Hecha {cuandoVence(g.hechaEn, ahora).toLowerCase()}
                        </span>
                      </span>
                      {puedeEscribir && (
                        <button
                          type="button"
                          onClick={() => void marcar(g, false)}
                          className="estado shrink-0 text-texto-suave underline-offset-2 hover:underline"
                        >
                          Reabrir
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
