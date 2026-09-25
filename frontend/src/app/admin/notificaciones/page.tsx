"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { Aviso } from "@/components/admin/marco-admin";
import { Encabezado, Vacio, BotonSuave } from "@/components/admin/piezas";
import { PildoraEtapa } from "@/components/admin/etapa";
import { useDatosVivos } from "@/lib/datos-vivos";
import { notificacionesApi, type Notificacion } from "@/lib/notificaciones-api";

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
  const [soloSinLeer, setSoloSinLeer] = useState(false);
  const [marcando, setMarcando] = useState(false);

  const cargar = useCallback(
    () => notificacionesApi.listar({ sinLeer: soloSinLeer, limite: 50 }),
    [soloSinLeer],
  );

  /// Se refresca sola: es una bandeja, y una bandeja que hay que
  /// recargar a mano deja de mirarse. La clave hace que cambiar
  /// el filtro vuelva a pedir en vez de reusar lo de antes.
  const { datos, error, refrescar } = useDatosVivos(cargar, {
    clave: soloSinLeer ? "sin-leer" : "todas",
  });

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
    <div>
      <Encabezado
        titulo="Mis notificaciones"
        descripcion={
          <>
            Lo que les pasa a las fichas que usted lleva. Se avisa desde que
            una ficha es suya: antes de que se le asigne, no hay a quién
            avisar.
          </>
        }
      >
        {sinLeer > 0 && (
          <BotonSuave onClick={marcarTodas} disabled={marcando}>
            {marcando ? "Marcando…" : `Marcar las ${sinLeer} como leídas`}
          </BotonSuave>
        )}
      </Encabezado>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="mb-4 flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => setSoloSinLeer(false)}
          className={`rounded-lg px-3 py-1.5 ${
            soloSinLeer
              ? "text-texto-suave hover:bg-superficie-alterna"
              : "bg-superficie-alterna font-medium"
          }`}
        >
          Todas
        </button>
        <button
          type="button"
          onClick={() => setSoloSinLeer(true)}
          className={`rounded-lg px-3 py-1.5 ${
            soloSinLeer
              ? "bg-superficie-alterna font-medium"
              : "text-texto-suave hover:bg-superficie-alterna"
          }`}
        >
          Sin leer{sinLeer > 0 ? ` (${sinLeer})` : ""}
        </button>
      </div>

      {filas.length === 0 ? (
        /// Un bloque vacío dice POR QUÉ lo está, que es la regla
        /// del handoff. «Sin notificaciones» a secas se lee como
        /// una pantalla que no cargó.
        <Vacio titulo={soloSinLeer ? "Nada sin leer" : "Todavía no hay avisos"}>
          {soloSinLeer
            ? "Ya atendió todo lo que había."
            : "Aquí saldrá cuando alguien de sus fichas complete sus datos, escriba por WhatsApp o revoque su autorización. Si no lleva ninguna ficha asignada, no recibirá avisos."}
        </Vacio>
      ) : (
        <ul className="divide-y divide-borde rounded-2xl border border-borde">
          {filas.map((n) => (
            <Fila key={n.id} n={n} alAbrir={() => void marcarUna(n.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Fila({ n, alAbrir }: { n: Notificacion; alAbrir: () => void }) {
  return (
    <li className={n.leida ? "" : "bg-superficie-alterna"}>
      <Link
        href={`/admin/participantes/${n.participanteId}`}
        onClick={alAbrir}
        className="flex items-start gap-3 px-4 py-3 hover:bg-superficie-alterna"
      >
        {/* El punto acompaña; lo que distingue es la palabra «Nuevo». */}
        <span
          aria-hidden
          className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
            n.leida ? "bg-transparent" : "bg-marca"
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="font-medium">{n.quien}</span>
            <span className="text-sm text-texto-suave tabular-nums">
              {n.documento}
            </span>
            <PildoraEtapa etapa={n.etapa} />
            {!n.leida && (
              <span className="text-xs font-medium text-marca">Nuevo</span>
            )}
          </span>
          <span className="mt-0.5 block">{n.titulo}</span>
          {n.detalle && (
            <span className="mt-0.5 block text-sm text-texto-suave">
              {n.detalle}
            </span>
          )}
        </span>
        <span className="shrink-0 text-sm text-texto-suave tabular-nums">
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
