"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { Aviso, useAdmin } from "@/components/admin/marco-admin";
import { Encabezado, Vacio, BotonSuave } from "@/components/admin/piezas";
import { PildoraEtapa } from "@/components/admin/etapa";
import { useDatosVivos } from "@/lib/datos-vivos";
import { notificacionesApi, type Notificacion } from "@/lib/notificaciones-api";

/// Las tres vistas. «equipo» solo existe para quien responde por
/// él: lo decide el SERVIDOR --acota por los gremios donde lidera--
/// y esto solo esconde la pestaña.
type Vista = "todas" | "sinLeer" | "equipo";

/**
 * Lo que le pasó a las fichas que lleva, desde que se fue.
 *
 * LA UNIDAD ES LA FICHA Y EL DESTINO ES LA FICHA. Cada aviso dice
 * qué pasó y lleva a la persona: aquí no se resuelve nada, se
 * entra. Duplicar la gestión en esta pantalla daría dos sitios
 * donde atender lo mismo, y la ficha es la que manda.
 *
 * NO SE PINTA NADA QUE LA FICHA NO DIGA. El aviso guarda el título
 * congelado y una línea; el detalle --las notas, el avance, la
 * empresa-- vive allá.
 */
export default function Notificaciones() {
  const { admin } = useAdmin();
  const veElEquipo = admin?.puede?.verElEquipo === true;
  const [vista, setVista] = useState<Vista>("todas");
  const [marcando, setMarcando] = useState(false);

  const cargar = useCallback(
    () =>
      vista === "equipo"
        ? notificacionesApi.equipo({ limite: 100 })
        : notificacionesApi.listar({ sinLeer: vista === "sinLeer", limite: 50 }),
    [vista],
  );

  /// Se refresca sola: es una bandeja, y una bandeja que hay que
  /// recargar a mano deja de mirarse. La clave hace que cambiar
  /// el filtro vuelva a pedir en vez de reusar lo de antes.
  const { datos, error, refrescar } = useDatosVivos(cargar, { clave: vista });

  const marcarUna = async (id: string) => {
    try {
      await notificacionesApi.leida(id);
      refrescar();
    } catch {
      /// Fallar al marcar no puede tumbar la pantalla: el aviso
      /// sigue ahí y la ficha sigue abriéndose.
    }
  };

  const marcarTodas = async () => {
    setMarcando(true);
    try {
      await notificacionesApi.leerTodas();
      refrescar();
    } finally {
      setMarcando(false);
    }
  };

  const filas = datos?.notificaciones ?? [];
  const sinLeer = datos?.sinLeer ?? 0;

  return (
    /// LA MISMA CÁSCARA QUE EL RESTO DEL PANEL.
    ///
    /// Nació con un `<div>` pelado: sin margen lateral y sin aire
    /// arriba, así que la cabecera quedaba pegada a la banda azul y
    /// el texto a los bordes de la ventana ---«déjale línea de
    /// respeto» (cliente, 26 sep 2026)---. `px-4 pt-3 pb-6` con
    /// `gap-3` es lo que usan Resumen, SEP, Acciones y la ficha de
    /// la persona; no es una medida nueva, es la de la casa.
    <div className="flex flex-col gap-3 px-4 pt-3 pb-6">
      <Encabezado
        titulo="Mis notificaciones"
        descripcion={
          vista === "equipo"
            ? "Todo lo que le llegó al equipo, y si ya lo atendieron. Mirarlo aquí no se lo marca como leído a nadie."
            : "Lo que les pasa a las fichas que usted lleva. Se avisa desde que una ficha es suya: antes de que se le asigne, no hay a quién avisar."
        }
      >
        {vista !== "equipo" && sinLeer > 0 && (
          <BotonSuave onClick={marcarTodas} disabled={marcando}>
            {marcando ? "Marcando…" : `Marcar las ${sinLeer} como leídas`}
          </BotonSuave>
        )}
      </Encabezado>

      {/* LA BANDA PONE SU PROPIO RELLENO LATERAL.
          `<main>` va A SANGRE a proposito --«el relleno lo pone
          cada banda por dentro», marco-admin-- y esta pantalla
          no lo ponia en ninguna: en el telefono la lista pegaba
          con el canto de la pantalla, sin los 16 px de guardia.

          `px-4` y no `px-7`: es el mismo canto que el `mx-4` del
          encabezado de arriba, y con mas la lista quedaria mas
          adentro que su propio titulo. */}
      <section className="px-4 pt-1 pb-6">

      {error && <Aviso tipo="error">{error}</Aviso>}

      {/* Sin `mb-4`: el hueco lo pone el `gap-3` de la columna, y
          los dos juntos daban el doble de aire aquí que entre las
          demás piezas. */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Pestana activa={vista === "todas"} alPulsar={() => setVista("todas")}>
          Mías
        </Pestana>
        <Pestana activa={vista === "sinLeer"} alPulsar={() => setVista("sinLeer")}>
          Sin leer{vista !== "equipo" && sinLeer > 0 ? ` (${sinLeer})` : ""}
        </Pestana>
        {/* SOLO PARA QUIEN RESPONDE POR EL EQUIPO. La pestaña se
            esconde, pero quien manda es el servidor: acota por los
            gremios donde esta cuenta lidera y contesta vacío si no
            lidera en ninguno. */}
        {veElEquipo && (
          <Pestana activa={vista === "equipo"} alPulsar={() => setVista("equipo")}>
            Del equipo
          </Pestana>
        )}
      </div>

      {/* LAS ESQUINAS DE LA LISTA SE RECORTAN FILA A FILA, y no con
          `overflow-hidden`: aquello se llevaria por delante el aro de
          foco de todas las filas. El fondo de una fila sin leer se
          pinta DESPUES del borde del padre, asi que sin esto la
          primera y la ultima salen en pico --y en la pestana «Sin
          leer» van todas sin leer--. */}
      {filas.length === 0 ? (
        /// Un bloque vacío dice POR QUÉ lo está, que es la regla
        /// del handoff. «Sin notificaciones» a secas se lee como
        /// una pantalla que no cargó.
        <Vacio
          titulo={
            vista === "sinLeer"
              ? "Nada sin leer"
              : vista === "equipo"
                ? "Al equipo no le ha llegado nada"
                : "Todavía no hay avisos"
          }
        >
          {vista === "sinLeer"
            ? "Ya atendió todo lo que había."
            : vista === "equipo"
              ? "Aquí sale lo que reciben los asesores de sus gremios, con quién lo tiene y si ya lo leyó."
              : "Aquí saldrá cuando alguien de sus fichas complete sus datos, escriba por WhatsApp o revoque su autorización. Si no lleva ninguna ficha asignada, no recibirá avisos."}
        </Vacio>
      ) : (
        <ul className="divide-y divide-borde rounded-2xl border border-borde [&>li:first-child]:rounded-t-2xl [&>li:first-child>a]:rounded-t-2xl [&>li:last-child]:rounded-b-2xl [&>li:last-child>a]:rounded-b-2xl">
          {filas.map((n) => (
            <Fila
              key={n.id}
              n={n}
              deOtro={vista === "equipo"}
              alAbrir={vista === "equipo" ? undefined : () => void marcarUna(n.id)}
            />
          ))}
        </ul>
      )}
      </section>
    </div>
  );
}

/** Una pestaña de la barra. */
function Pestana({
  activa,
  alPulsar,
  children,
}: {
  activa: boolean;
  alPulsar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={alPulsar}
      className={`rounded-lg px-3 py-1.5 ${
        activa
          ? "bg-superficie-alterna font-medium"
          : "text-texto-suave hover:bg-superficie-alterna"
      }`}
    >
      {children}
    </button>
  );
}

function Fila({
  n,
  deOtro,
  alAbrir,
}: {
  n: Notificacion;
  /// Es de otra persona: se mira, no se marca.
  deOtro?: boolean;
  alAbrir?: () => void;
}) {
  return (
    <li className={n.leida ? "" : "bg-superficie-alterna"}>
      <Link
        href={`/admin/participantes/${n.participanteId}`}
        onClick={alAbrir}
        className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3 hover:bg-superficie-alterna"
      >
        {/* El punto acompaña; lo que distingue es la palabra «Nuevo». */}
        <span
          aria-hidden
          className={`mt-2 hidden h-2 w-2 shrink-0 rounded-full sm:block ${
            n.leida ? "bg-transparent" : "bg-marca"
          }`}
        />
        <span className="min-w-0 flex-1 basis-[15rem]">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{n.quien}</span>
            <span className="text-sm text-texto-suave tabular-nums">
              {n.documento}
            </span>
            <PildoraEtapa etapa={n.etapa} />
            {!n.leida && (
              <span className="text-xs font-medium text-marca">
                {deOtro ? "Sin leer" : "Nuevo"}
              </span>
            )}
            {deOtro && n.asesor && (
              /// De quién es el aviso. Es la columna que hace útil
              /// esta vista: no qué pasó, sino qué pasó y quién no
              /// lo ha mirado.
              <span className="text-xs text-texto-suave">· {n.asesor}</span>
            )}
          </span>
          <span className="mt-0.5 block">{n.titulo}</span>
          {n.detalle && (
            <span className="mt-0.5 block text-sm text-texto-suave">
              {n.detalle}
            </span>
          )}
        </span>
        <span className="shrink-0 pl-5 text-sm text-texto-suave tabular-nums sm:pl-0">
          {cuando(n.creadoEn)}
        </span>
      </Link>
    </li>
  );
}

/**
 * Cuándo fue, en hora de BOGOTÁ.
 *
 * No con `toLocaleString()` a secas: eso usa la zona del
 * navegador, y el Excel de leads ya se descuadró un día entero por
 * leer una fecha en otra zona que la pantalla.
 */
function cuando(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const dia = (x: Date) =>
    x.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const hora = d.toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (dia(d) === dia(hoy)) return hora;
  return `${d.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
  })} ${hora}`;
}
