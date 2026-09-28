"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Cajon } from "./cajon";
import { IconoCampana } from "./iconos";
import { PildoraEtapa } from "./etapa";
import { notificacionesApi, type Notificacion } from "@/lib/notificaciones-api";
import {
  estadoDelPermiso,
  guardarSonido,
  mostrarAviso,
  pedirPermiso,
  sonar,
  sonidoEncendido,
  type EstadoDelPermiso,
} from "@/lib/alerta-de-avisos";

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

  /**
   * CUÁNTOS HABÍA LA VEZ ANTERIOR, para saber si LLEGÓ algo.
   *
   * Sin esto no hay forma de distinguir «hay tres avisos» de
   * «acaban de entrar tres»: el contador dice cuántos hay, no
   * cuántos son nuevos, y sonar por los que ya estaban sería sonar
   * en cada vuelta del temporizador.
   *
   * Arranca en nulo ---y no en cero--- a propósito: la PRIMERA
   * consulta no es una llegada. Quien abre el CRM con ocho avisos
   * pendientes de ayer no necesita que le suene ocho veces; los ve
   * en el globo.
   */
  const habia = useRef<number | null>(null);

  /**
   * EL PERMISO Y EL SONIDO, LEÍDOS AL MONTAR.
   *
   * Y tienen que leerse en un efecto, no en el estado inicial: en el
   * servidor no existen ni la API de avisos ni `localStorage`, así
   * que el primer pintado es siempre el de «no hay nada» y el del
   * navegador puede ser otro. Ponerlo en el `useState` daría un
   * pintado del servidor distinto del primero del cliente, que es el
   * fallo de hidratación clásico.
   *
   * El linter avisa de que esto es un `setState` dentro de un efecto,
   * y en general tiene razón ---encadena pintados---. Aquí corre UNA
   * vez al montar y lee dos cosas que solo existen en el navegador:
   * es justo el caso que la propia regla nombra como legítimo,
   * «sincronizar con un sistema de fuera de React».
   */
  const [permiso, setPermiso] = useState<EstadoDelPermiso>("sin-soporte");
  const [conSonido, setConSonido] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ver arriba: se lee el navegador al montar
    setPermiso(estadoDelPermiso());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- idem
    setConSonido(sonidoEncendido());
  }, []);

  const contar = useCallback(async () => {
    try {
      const r = await notificacionesApi.cuenta();
      if (vivo.current) {
        /// SOLO SI SUBIÓ. Que baje es alguien leyendo, y leer no se
        /// anuncia. Que suba es algo que entró mientras no miraba,
        /// que es justo lo que hay que decirle.
        const antes = habia.current;
        if (antes !== null && r.sinLeer > antes) {
          sonar();
          mostrarAviso(r.sinLeer - antes);
        }
        habia.current = r.sinLeer;
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
        className="relative flex items-center rounded-xl px-2.5 py-2.5 transition hover:bg-current/10"
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
            <div className="flex flex-col gap-2">
              {/* EL PERMISO SE PIDE AQUÍ Y CON UN CLIC.
                  Nunca al cargar la página: el navegador bloquea el
                  aviso automático, y aun sin bloquearlo una ventana
                  del sistema que nadie pidió se rechaza por reflejo
                  ---y rechazado no se puede volver a preguntar desde
                  la página, solo desde la barra de direcciones---. */}
              {permiso === "default" && (
                <div className="rounded-lg border border-borde bg-superficie-alterna px-3 py-2 text-[0.78125rem]">
                  <p className="text-texto">
                    ¿Quiere que le avisemos aunque tenga el CRM en otra
                    pestaña?
                  </p>
                  <button
                    type="button"
                    onClick={() => void pedirPermiso().then(setPermiso)}
                    className="mt-1 font-semibold text-marca underline underline-offset-2"
                  >
                    Activar los avisos del navegador
                  </button>
                </div>
              )}

              {/* DENEGADO NO SE VUELVE A PEDIR, se explica. Insistir
                  con un botón que ya no hace nada es peor que callar. */}
              {permiso === "denied" && (
                <p className="text-[0.78125rem] text-texto-suave">
                  Los avisos del navegador están bloqueados para esta página.
                  Se reactivan desde el candado de la barra de direcciones.
                </p>
              )}

              <label className="flex cursor-pointer items-center gap-2 text-[0.78125rem] text-texto-suave">
                <input
                  type="checkbox"
                  checked={conSonido}
                  onChange={(e) => {
                    setConSonido(e.target.checked);
                    guardarSonido(e.target.checked);
                    /// Suena al encenderlo, para que se oiga cómo es
                    /// antes de decidir. Se agradece no descubrirlo
                    /// por sorpresa a media mañana.
                    if (e.target.checked) sonar();
                  }}
                />
                Sonar cuando llegue un aviso
              </label>

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <Link
                href="/admin/notificaciones"
                onClick={() => setAbierto(false)}
                className="shrink-0 text-[0.8125rem] font-medium text-marca underline hover:no-underline"
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
                    {/* LA HORA VA FUERA DEL GRUPO QUE ENVUELVE.
                        Estaba dentro con `ml-auto`, y en un flex con
                        `flex-wrap` los margenes automaticos se
                        resuelven POR LINEA: al envolver --y a 317 px
                        utiles envuelve con cualquier nombre de unas
                        veinte letras, que aqui es lo normal-- la hora
                        caia sola en la linea de abajo pegada al borde
                        derecho, leyendose como si fuera del aviso
                        siguiente. Sacandola al eje de fuera, que no
                        envuelve, queda siempre arriba a la derecha y
                        el nombre no se corta nunca. */}
                    <span className="flex items-start gap-x-2">
                      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium">{n.quien}</span>
                        <PildoraEtapa etapa={n.etapa} />
                        {!n.leida && (
                          <span className="text-[0.6875rem] font-semibold text-marca">
                            Nuevo
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[0.75rem] leading-[1.45] text-texto-suave tabular-nums">
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
