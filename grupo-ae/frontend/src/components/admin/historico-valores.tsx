"use client";

/** Qué decía antes cada dato, y cómo volver a como estaba. */

/// Es el otro historial, y son dos cosas distintas:
///
///   «Historial»          →  qué HIZO alguien
///   «Qué decía antes»    →  qué DECÍA el dato
///
/// El primero no sirve para deshacer —«Ana cambió el correo el
/// martes» no dice cuál era— y el segundo no dice quién lo
/// tocó. Por eso están separados y por eso hacen falta los dos.

import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/admin/toast";
import { ErrorApi } from "@/lib/api";
import { crmApi, type ValorAnterior } from "@/lib/crm-api";

function cuando(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function HistoricoDeValores({
  participanteId,
  puedeEscribir,
}: {
  participanteId: string;
  puedeEscribir: boolean;
}) {
  const toast = useToast();
  const [filas, setFilas] = useState<ValorAnterior[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setFilas(await crmApi.historico(participanteId));
  }, [participanteId]);

  useEffect(() => {
    void cargar().catch(() => setFilas([]));
  }, [cargar]);

  async function restablecer(f: ValorAnterior) {
    setOcupado(f.id);
    try {
      await crmApi.restablecer(participanteId, f.id);
      toast.exito(`${f.etiqueta} volvió a como estaba.`);
      await cargar();
      // la ficha de al lado también cambió
      window.location.reload();
    } catch (e) {
      toast.error((e as ErrorApi).message);
    } finally {
      setOcupado(null);
    }
  }

  if (!filas) return <p className="text-sm text-texto-suave">Cargando…</p>;

  if (filas.length === 0) {
    return (
      <p className="text-sm text-texto-suave">
        Todavía no se le ha cambiado ningún dato. Cuando alguien corrija algo,
        aquí queda qué decía antes y quién lo tocó.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {filas.map((f) => (
        <li
          key={f.id}
          className="rounded-xl border border-borde bg-superficie-alterna p-3"
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm font-medium">{f.etiqueta}</span>
            <span className="text-xs text-texto-suave">
              {cuando(f.creadoEn)} · lo cambió {f.actorNombre}
            </span>
          </div>

          <p className="mt-1.5 text-sm">
            {f.porQueSinValor ? (
              /// Se dice POR QUÉ no hay valor. Un hueco a secas
              /// se lee como un error del sistema.
              <span className="text-texto-suave italic">{f.porQueSinValor}</span>
            ) : (
              <>
                <span className="text-texto-suave">Antes decía: </span>
                <span className="font-mono text-[13px]">{f.valorAnterior}</span>
              </>
            )}
          </p>

          {f.restauradoEn ? (
            <p className="mt-2 text-xs text-exito">
              Se restableció el {cuando(f.restauradoEn)}
              {f.restauradoPor && ` por ${f.restauradoPor.nombre}`}
            </p>
          ) : (
            puedeEscribir &&
            f.sePuedeRestablecer && (
              <button
                type="button"
                disabled={ocupado === f.id}
                onClick={() => void restablecer(f)}
                className="mt-2 text-xs text-marca underline disabled:opacity-50"
              >
                {ocupado === f.id
                  ? "Restableciendo…"
                  : "Devolverlo a como estaba"}
              </button>
            )
          )}
        </li>
      ))}
    </ol>
  );
}
