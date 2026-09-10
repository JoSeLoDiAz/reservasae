"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Barra de scroll arriba, gemela de la de abajo. */
export function ScrollDoble({ children }: { children: React.ReactNode }) {
  const arriba = useRef<HTMLDivElement>(null);
  const abajo = useRef<HTMLDivElement>(null);
  const contenido = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);

  // sin esto cada scroll dispara al otro y se pelean
  const moviendo = useRef<"arriba" | "abajo" | null>(null);

  const medir = useCallback(() => {
    if (contenido.current) setAncho(contenido.current.scrollWidth);
  }, []);

  useEffect(() => {
    medir();
    if (!contenido.current) return;
    const observador = new ResizeObserver(medir);
    observador.observe(contenido.current);
    return () => observador.disconnect();
  }, [medir]);

  function sincronizar(desde: "arriba" | "abajo") {
    if (moviendo.current && moviendo.current !== desde) return;
    moviendo.current = desde;
    const origen = desde === "arriba" ? arriba.current : abajo.current;
    const destino = desde === "arriba" ? abajo.current : arriba.current;
    if (origen && destino) destino.scrollLeft = origen.scrollLeft;
    requestAnimationFrame(() => {
      moviendo.current = null;
    });
  }

  const desborda = ancho > 0 && (abajo.current?.clientWidth ?? 0) < ancho;

  return (
    <div>
      <div
        ref={arriba}
        onScroll={() => sincronizar("arriba")}
        // solo la barra: el alto es el del pulgar
        className="barra-visible no-imprimir overflow-x-auto overflow-y-hidden"
        aria-hidden
        style={{ height: desborda ? 12 : 0 }}
      >
        <div style={{ width: ancho, height: 1 }} />
      </div>

      <div
        ref={abajo}
        onScroll={() => sincronizar("abajo")}
        className="barra-visible caja-scroll overflow-x-auto pb-2"
      >
        <div ref={contenido} style={{ width: "max-content" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
