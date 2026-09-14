"use client";

/** El objetivo, el contenido y la competencia de una acción. */

/**
 * Lo pidió el cliente el 13 sep 2026: en la tarjeta de cada acción, un
 * «Más información» que abra estos tres textos.
 *
 * En una ventana y no en la tarjeta porque son tres párrafos del
 * proyecto —el objetivo de AF1 son 120 palabras— y quince tarjetas con
 * eso dentro dejan la pantalla sin forma de comparar. Quien está
 * eligiendo mira el código, la modalidad y las horas; el que quiere el
 * detalle lo pide.
 *
 * Misma forma que `modal-politica.tsx`: mismo velo, mismo `role`,
 * misma tecla de escape. Los iconos van dibujados con `currentColor`,
 * que es la regla de la casa.
 */

import { useEffect, useRef } from "react";

const CAMPOS = [
  { clave: "objetivo", etiqueta: "Objetivo" },
  { clave: "contenido", etiqueta: "Contenido" },
  { clave: "competencia", etiqueta: "Competencia" },
] as const;

export function ModalInformacionAccion({
  codigo,
  nombre,
  objetivo,
  contenido,
  competencia,
  alCerrar,
}: {
  codigo: string;
  nombre: string;
  objetivo: string | null;
  contenido: string | null;
  competencia: string | null;
  alCerrar: () => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const textos = { objetivo, contenido, competencia };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", tecla);
    caja.current?.focus();
    return () => window.removeEventListener("keydown", tecla);
  }, [alCerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Información de ${codigo}`}
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        ref={caja}
        tabIndex={-1}
        className="modal-entra flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-borde bg-superficie shadow-2xl outline-none"
      >
        <header className="flex items-start gap-4 border-b border-borde px-6 py-5">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs font-semibold tracking-wide text-marca">
              {codigo}
            </p>
            <h2 className="mt-0.5 text-lg leading-snug font-semibold text-balance">
              {nombre}
            </h2>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-texto-suave transition hover:bg-superficie-alterna"
          >
            <IconoCerrar />
          </button>
        </header>

        <div className="caja-scroll flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {CAMPOS.map((c) => {
            const valor = textos[c.clave];
            /// Sin texto no se pinta el apartado: un título con nada
            /// debajo parece que algo se rompió. La ventana solo se
            /// ofrece cuando hay al menos uno.
            if (!valor?.trim()) return null;
            return (
              <section key={c.clave}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                  {c.etiqueta}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">
                  {valor}
                </p>
              </section>
            );
          })}
        </div>

        <footer className="border-t border-borde px-6 py-4 text-right">
          <button
            type="button"
            onClick={alCerrar}
            className="rounded-xl bg-marca px-5 py-2.5 text-sm font-medium text-marca-texto transition hover:bg-marca-fuerte"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}

/// Dibujado y no importado, como en `modal-politica.tsx`: es uno.
function IconoCerrar() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
