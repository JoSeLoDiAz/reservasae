"use client";

import { useEffect, useRef, useState } from "react";

import { CLASE_CONTROL } from "./marco-admin";

/**
 * Borrar no se deshace, así que pide escribir algo del
 * propio dato —el NIT, el documento— antes de dejar. Un
 * "¿está seguro?" se acepta sin leer; teclear un número
 * obliga a mirar cuál se está borrando.
 */
export function ConfirmarBorrado({
  titulo,
  descripcion,
  palabra,
  etiquetaPalabra,
  alConfirmar,
  alCerrar,
}: {
  titulo: string;
  descripcion: React.ReactNode;
  palabra: string;
  etiquetaPalabra: string;
  alConfirmar: () => Promise<void>;
  alCerrar: () => void;
}) {
  const [escrito, setEscrito] = useState("");
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campo.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !borrando) alCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [alCerrar, borrando]);

  const coincide = escrito.trim() === palabra;

  async function borrar() {
    if (!coincide) return;
    setBorrando(true);
    setError(null);
    try {
      await alConfirmar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo borrar.");
      setBorrando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !borrando) alCerrar();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-borde bg-superficie p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-error">{titulo}</h2>
        <div className="mt-2 text-sm text-texto-suave">{descripcion}</div>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-medium">
            {etiquetaPalabra}{" "}
            <span className="font-mono text-texto-suave">{palabra}</span>
          </span>
          <input
            ref={campo}
            value={escrito}
            onChange={(e) => setEscrito(e.target.value)}
            disabled={borrando}
            className={`${CLASE_CONTROL} font-mono`}
            autoComplete="off"
          />
        </label>

        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-error/30 bg-error-suave p-3 text-sm text-error">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={alCerrar}
            disabled={borrando}
            className="text-sm text-texto-suave underline disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={borrar}
            disabled={!coincide || borrando}
            className="rounded-xl bg-error px-5 py-2.5 text-sm font-medium text-superficie shadow-sm transition disabled:opacity-40"
          >
            {borrando ? "Borrando…" : "Borrar definitivamente"}
          </button>
        </div>
      </div>
    </div>
  );
}
