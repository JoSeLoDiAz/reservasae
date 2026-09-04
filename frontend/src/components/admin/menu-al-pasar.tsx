/** Abrir el menú al pasar por encima. */

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// esperas de intención, en ms
const ABRIR = 110;
const CERRAR = 240;

/** Si el dispositivo apunta de verdad. */
export function usePuedeApuntar(): boolean {
  const [puede, setPuede] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const mirar = () => setPuede(mq.matches);
    mirar();
    mq.addEventListener("change", mirar);
    return () => mq.removeEventListener("change", mirar);
  }, []);

  return puede;
}

/** Qué se mira, con retardo a la ida y a la vuelta. */
export function useIntencion() {
  const [mirando, setMirando] = useState<string | null>(null);
  const reloj = useRef<number | null>(null);

  const parar = useCallback(() => {
    if (reloj.current !== null) {
      window.clearTimeout(reloj.current);
      reloj.current = null;
    }
  }, []);

  const abrir = useCallback(
    (clave: string) => {
      parar();
      reloj.current = window.setTimeout(() => setMirando(clave), ABRIR);
    },
    [parar],
  );

  const cerrar = useCallback(() => {
    parar();
    reloj.current = window.setTimeout(() => setMirando(null), CERRAR);
  }, [parar]);

  // al entrar al panel: no cerrar, sin reabrir
  const mantener = parar;

  // al pulsar, al navegar y con Escape
  const cerrarYa = useCallback(() => {
    parar();
    setMirando(null);
  }, [parar]);

  useEffect(() => parar, [parar]);

  return { mirando, abrir, cerrar, cerrarYa, mantener };
}

const ANCHO = 236;
const MARGEN = 12;

/** El panel que sale al lado del icono. */
export function PanelDelModulo({
  ancla,
  etiqueta,
  descripcion,
  alEntrar,
  alSalir,
  alCerrar,
  children,
}: {
  ancla: HTMLElement | null;
  etiqueta: string;
  descripcion?: string;
  alEntrar: () => void;
  alSalir: () => void;
  alCerrar: () => void;
  children: React.ReactNode;
}) {
  const caja = useRef<HTMLDivElement | null>(null);
  const [sitio, setSitio] = useState<{
    top: number;
    left: number;
    ancho: number;
  } | null>(null);

  // se mide y se coloca antes de pintar
  useLayoutEffect(() => {
    if (!ancla) return;

    const colocar = () => {
      const icono = ancla.getBoundingClientRect();
      const alto = caja.current?.offsetHeight ?? 0;
      const ancho = Math.min(ANCHO, window.innerWidth - MARGEN * 2);

      // a la derecha; si no cabe, a la izquierda
      const derecha = icono.right + 8;
      const cabeDerecha = derecha + ancho + MARGEN <= window.innerWidth;
      const izquierda = icono.left - ancho - 8;
      const left = cabeDerecha ? derecha : Math.max(MARGEN, izquierda);

      const tope = Math.max(MARGEN, window.innerHeight - alto - MARGEN);
      const top = Math.min(Math.max(MARGEN, icono.top - 6), tope);

      setSitio({ top, left, ancho });
    };

    colocar();
    window.addEventListener("resize", colocar);
    window.addEventListener("scroll", colocar, true);
    return () => {
      window.removeEventListener("resize", colocar);
      window.removeEventListener("scroll", colocar, true);
    };
  }, [ancla, children]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [alCerrar]);

  if (!ancla || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={caja}
      role="group"
      aria-label={etiqueta}
      onPointerEnter={alEntrar}
      onPointerLeave={alSalir}
      style={{
        top: sitio?.top ?? -9999,
        left: sitio?.left ?? -9999,
        width: sitio?.ancho ?? ANCHO,
        maxHeight: `calc(100vh - ${MARGEN * 2}px)`,
      }}
      className="no-imprimir barra-visible fixed z-50 overflow-y-auto rounded-xl border border-encabezado-borde bg-encabezado-fondo px-2 py-2 text-encabezado-texto shadow-lg"
    >
      <p className="px-2.5 pt-1 pb-0.5 text-[13px] font-semibold">{etiqueta}</p>
      {descripcion && (
        <p className="px-2.5 pb-1.5 text-[11px] leading-snug opacity-65">
          {descripcion}
        </p>
      )}
      {children}
    </div>,
    document.body,
  );
}
