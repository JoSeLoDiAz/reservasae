"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { IconoCerrar } from "./iconos";

/**
 * El panel lateral que se abre al pinchar una fila.
 *
 * Sustituye a la fila que se desplegaba dentro de la tabla:
 * con columnas que se quitan y se ponen, un `colSpan` fijo
 * se descuadra solo. Aquí el detalle no depende de cuántas
 * columnas haya a la vista.
 */
export function Cajon({
  titulo,
  subtitulo,
  alCerrar,
  pie,
  children,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  alCerrar: () => void;
  pie?: ReactNode;
  children: ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    caja.current?.focus();
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [alCerrar]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        onClick={alCerrar}
        aria-label="Cerrar el panel"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
      />
      <div
        ref={caja}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="relative flex h-full w-full max-w-lg flex-col border-l border-borde bg-superficie shadow-2xl outline-none"
      >
        <header className="flex items-start gap-3 border-b border-borde px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-sm text-texto-suave">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="rounded-lg p-1 transition hover:bg-superficie-alterna"
          >
            <IconoCerrar tamano={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {pie && <footer className="border-t border-borde px-6 py-4">{pie}</footer>}
      </div>
    </div>
  );
}

/** Un dato del panel; si no hay valor, no ocupa sitio. */
export function Dato({ titulo, valor }: { titulo: string; valor: ReactNode }) {
  if (valor === null || valor === undefined || valor === "") return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-texto-suave">{titulo}</dt>
      <dd className="mt-0.5">{valor}</dd>
    </div>
  );
}
