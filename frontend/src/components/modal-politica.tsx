"use client";

/** La política de tratamiento, en un modal que se puede volver a leer. */

/**
 * Quien llega aquí ya autorizó al reservar su cupo, así que la
 * muralla de texto no le suma ninguna garantía y le empuja fuera
 * de pantalla lo único que vino a hacer. Pero poder consultarla
 * cuando quiera SÍ es parte de la ley, así que no se quita: se
 * guarda detrás de un botón.
 *
 * Era un `<details>` con una palomita de texto. Ahora es un modal
 * de verdad, con la forma que ya usa el panel
 * (`confirmar-borrado.tsx`): mismo velo, mismo `role="dialog"`,
 * misma tecla de escape.
 *
 * Del rediseño: la sombra SÓLO va en lo que flota —modales,
 * desplegables, cajón, toast—, el borde es de 1px, y el icono va
 * dibujado en trazo con `currentColor`, nunca un emoji ni un
 * carácter suelto como «✓».
 */

import { useEffect, useRef } from "react";

export function ModalPolitica({
  titulo,
  contenido,
  version,
  alCerrar,
}: {
  titulo: string;
  contenido: string;
  version: number;
  alCerrar: () => void;
}) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /// Escape cierra, que es lo que espera cualquiera. Un modal
    /// del que solo se sale con el ratón se siente atrapado.
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", tecla);
    /// El foco entra en el modal: quien navega con teclado se
    /// quedaba tabulando el formulario de detrás.
    caja.current?.focus();
    return () => window.removeEventListener("keydown", tecla);
  }, [alCerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
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
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-marca/25 text-marca">
            <IconoEscudo />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg leading-snug font-semibold">{titulo}</h2>
            <p className="mt-0.5 text-sm text-texto-suave">
              Versión {version} · usted la aceptó al reservar su cupo
            </p>
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

        <div className="caja-scroll flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed whitespace-pre-wrap">
          {contenido}
        </div>

        <footer className="border-t border-borde px-6 py-4 text-right">
          <button
            type="button"
            onClick={alCerrar}
            className="rounded-xl bg-marca px-5 py-2.5 text-sm font-medium text-marca-texto transition hover:bg-marca-fuerte"
          >
            Entendido
          </button>
        </footer>
      </div>
    </div>
  );
}

/// Dibujados, no importados: son dos. Usan `currentColor`, así que
/// toman el color del tema.
function IconoEscudo() {
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
      <path d="M12 3l7 3v5.5c0 4.3-2.9 8.2-7 9.5-4.1-1.3-7-5.2-7-9.5V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

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
      aria-hidden
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}
