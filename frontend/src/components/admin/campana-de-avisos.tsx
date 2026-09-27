"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Cajon } from "./cajon";
import { IconoCampana } from "./iconos";
import { PildoraEtapa } from "./etapa";
import { notificacionesApi, type Notificacion } from "@/lib/notificaciones-api";

/// Cada cuánto se pregunta por el número. Solo el contador, que es
/// un entero: traer la lista entera para pintar un punto sería
/// treinta fichas cada medio minuto.
const CADA = 30_000;

/// Más de esto y el globo dice «9+». Con dos cifras el globo crece,
/// se sale del avatar y empuja la fila --y la fila de módulos ya se
/// mide al píxel para que «Configuración» no caiga debajo--.
const TOPE = 9;

/**
 * La campana, al lado del perfil.
 *
 * Lo pidió Josse el 26 sep 2026 señalando el SICC: «poner una
 * campana al lado del perfil, y que salga 1, 2, y si son 12 pues
 * sale un 9+».
 *
 * NO PINTA EL DETALLE: cada aviso dice qué pasó y lleva a la ficha,
 * que es la que manda. El cajón es un atajo, no una segunda pantalla
 * donde atender.
 */
export function CampanaDeAvisos() {
  const [sinLeer, setSinLeer] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<Notificacion[] | null>(null);
  const [fallo, setFallo] = useState(false);

  /// En una ref para que el temporizador no se reinicie en cada
  /// pintado, que es la misma razón que en `datos-vivos`.
  const vivo = useRef(true);

  const contar = useCallback(async () => {
    try {
      const r = await notificacionesApi.cuenta();
      if (vivo.current) {
        setSinLeer(r.sinLeer);
        setFallo(false);
      }
    } catch {
      /// Un fallo NO pone el contador en cero: decir «no tiene nada»
      /// cuando no se pudo preguntar es peor que no decir nada. Se
      /// queda el último número bueno.
      if (vivo.current) setFallo(true);
    }
  }, []);

  useEffect(() => {
    vivo.current = true;
    void contar();
    const t = setInterval(() => {
      /// Con la pestaña oculta no se pregunta: nadie lo está mirando.
      if (!document.hidden) void contar();
    }, CADA);
    return () => {
      vivo.current = false;
      clearInterval(t);
    };
  }, [contar]);

  const abrir = async () => {
    setAbierto(true);
    setFilas(null);
    try {
      const r = await notificacionesApi.listar({ limite: 20 });
      setFilas(r.notificaciones);
      setSinLeer(r.sinLeer);
    } catch {
      setFilas([]);
      setFallo(true);
    }
  };

  const marcarTodas = async () => {
    try {
      await notificacionesApi.leerTodas();
      setSinLeer(0);
      setFilas((f) => f?.map((n) => ({ ...n, leida: true })) ?? null);
    } catch {
      setFallo(true);
    }
  };

  const alAbrirUna = (id: string) => {
    /// Optimista a propósito: la persona se va a la ficha y esta
    /// pantalla se desmonta, así que esperar la respuesta no sirve
    /// de nada. Si falla, el aviso sigue sin leer y vuelve a salir.
    setSinLeer((n) => Math.max(0, n - 1));
    void notificacionesApi.leida(id).catch(() => {});
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void abrir()}
        aria-label={
          sinLeer > 0 ? `Avisos: ${sinLeer} sin leer` : "Avisos, ninguno sin leer"
        }
        className="relative flex items-center rounded-xl px-2 py-2 transition hover:bg-current/10"
      >
        <IconoCampana tamano={19} />
        {sinLeer > 0 && (
          /// El globo lleva el NÚMERO y no solo un punto: «cuántas»
          /// es la pregunta, y un punto obliga a abrir para saberlo.
          <span className="absolute top-0.5 right-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-error px-1 text-[0.625rem] leading-none font-bold text-white tabular-nums">
            {sinLeer > TOPE ? `${TOPE}+` : sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <Cajon
          titulo="Avisos"
          subtitulo="Lo que les pasa a las fichas que usted lleva."
          alCerrar={() => setAbierto(false)}
          pie={
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/admin/notificaciones"
                onClick={() => setAbierto(false)}
                className="text-[0.8125rem] font-medium text-marca underline hover:no-underline"
              >
                Ver todas
              </Link>
              {sinLeer > 0 && (
                <button
                  type="button"
                  onClick={() => void marcarTodas()}
                  className="text-[0.8125rem] text-texto-suave underline hover:text-texto"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>
          }
        >
          {filas === null ? (
            <p className="px-1 py-6 text-center text-sm text-texto-suave">
              Cargando…
            </p>
          ) : filas.length === 0 ? (
            /// Un bloque vacío dice POR QUÉ lo está.
            <p className="px-1 py-6 text-center text-sm text-texto-suave">
              {fallo
                ? "No se pudieron traer los avisos. Vuelva a abrir en un momento."
                : "Todavía no hay avisos. Aquí sale cuando alguien de sus fichas completa sus datos o escribe."}
            </p>
          ) : (
            <ul className="divide-y divide-borde">
              {filas.map((n) => (
                <li key={n.id} className={n.leida ? "" : "bg-superficie-alterna"}>
                  <Link
                    href={`/admin/participantes/${n.participanteId}`}
                    onClick={() => {
                      setAbierto(false);
                      if (!n.leida) alAbrirUna(n.id);
                    }}
                    className="block px-3 py-2.5 hover:bg-superficie-alterna"
                  >
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className="font-medium">{n.quien}</span>
                      <PildoraEtapa etapa={n.etapa} />
                      {!n.leida && (
                        <span className="text-[0.6875rem] font-semibold text-marca">
                          Nuevo
                        </span>
                      )}
                      <span className="ml-auto text-[0.75rem] text-texto-suave tabular-nums">
                        {cuando(n.creadoEn)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[0.8125rem]">{n.titulo}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cajon>
      )}
    </>
  );
}

/**
 * Cuándo fue, en hora de BOGOTÁ.
 *
 * No con `toLocaleString()` a secas: eso usa la zona del navegador,
 * y el Excel de leads ya se descuadró un día entero por leer una
 * fecha en una zona distinta de la que enseña la pantalla.
 */
function cuando(iso: string): string {
  const d = new Date(iso);
  const dia = (x: Date) =>
    x.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const hora = d.toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (dia(d) === dia(new Date())) return hora;
  return d.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
  });
}
