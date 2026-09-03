"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export type OpcionDesplegable = {
  valor: string;
  etiqueta: string;
  /** Segunda línea, en gris. */
  detalle?: string;
  desactivada?: boolean;
};

/**
 * Un desplegable con la misma curva y los mismos colores que el
 * resto del panel.
 *
 * El `<select>` nativo NO se puede redondear: la lista de
 * opciones la dibuja el sistema operativo, con su cuadro
 * cuadrado y su azul, y ninguna regla de CSS llega ahí. La única
 * forma de que la lista abierta se parezca a la interfaz es no
 * usar la lista del sistema.
 *
 * Lleva sombra porque FLOTA, que es la excepción que el diseño
 * permite: modales, desplegables, cajón y toast.
 */
export function Desplegable({
  valor,
  opciones,
  alElegir,
  marcador = "Seleccione una opción",
  desactivado,
  id,
  etiquetaAria,
  alto = 32,
  enBarra,
  subrayado,
}: {
  valor: string;
  opciones: OpcionDesplegable[];
  alElegir: (valor: string) => void;
  marcador?: string;
  desactivado?: boolean;
  id?: string;
  /// Cómo se llama cuando NO hay una etiqueta visible al lado.
  ///
  /// Un `<select>` acepta `aria-label` y esto no lo tenía, así
  /// que al cambiar uno por otro el control se quedaba sin
  /// nombre: quien navega con lector de pantalla oye el valor
  /// —«Gestor de inscripción»— y no de qué es.
  etiquetaAria?: string;
  /// Para poder cuadrarlo con el campo de al lado: en una barra
  /// de filtros todo tiene que medir lo mismo.
  alto?: number;
  /// En la barra lateral: el disparador va con los tokens del
  /// ENCABEZADO, que es lo que pinta esa barra. Con los del
  /// campo saldria una caja blanca sobre una barra de color.
  enBarra?: boolean;
  /// Sin caja, solo una raya debajo. Es como se ven los campos
  /// de la barra de gestión de un lead, donde cuatro cajas
  /// seguidas pesarían más que la ficha entera.
  subrayado?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [marcada, setMarcada] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const tecleo = useRef({ texto: "", cuando: 0 });
  const propio = useId();
  const idLista = `${id ?? propio}-lista`;

  const elegida = opciones.find((o) => o.valor === valor) ?? null;

  /// Al abrir, el foco de teclado arranca en la que ya está
  /// elegida y no en la primera: es donde el ojo la busca.
  useLayoutEffect(() => {
    if (!abierto) return;
    const i = opciones.findIndex((o) => o.valor === valor);
    setMarcada(i >= 0 ? i : 0);
  }, [abierto, valor, opciones]);

  useEffect(() => {
    if (!abierto) return;
    lista.current
      ?.querySelector<HTMLElement>(`[data-i="${marcada}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [abierto, marcada]);

  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent) {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    }
    /// En scroll y en cambio de tamaño se cierra: el panel va
    /// colocado con `absolute` y quedaria flotando lejos.
    function cerrar() {
      setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    window.addEventListener("resize", cerrar);
    return () => {
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("resize", cerrar);
    };
  }, [abierto]);

  function mover(paso: number) {
    setMarcada((i) => {
      const n = opciones.length;
      if (!n) return 0;
      let j = i;
      for (let k = 0; k < n; k++) {
        j = (j + paso + n) % n;
        if (!opciones[j].desactivada) return j;
      }
      return i;
    });
  }

  function elegir(i: number) {
    const o = opciones[i];
    if (!o || o.desactivada) return;
    alElegir(o.valor);
    setAbierto(false);
    caja.current?.querySelector("button")?.focus();
  }

  function teclas(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setAbierto(false);
      return;
    }
    if (!abierto && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setAbierto(true);
      return;
    }
    if (!abierto) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      mover(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      mover(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setMarcada(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setMarcada(opciones.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      elegir(marcada);
    } else if (e.key.length === 1) {
      /// Teclear busca, como en el nativo: si no, una lista de
      /// quince cursos solo se recorre con la flecha.
      const ahora = Date.now();
      const t = ahora - tecleo.current.cuando < 900 ? tecleo.current.texto + e.key : e.key;
      tecleo.current = { texto: t, cuando: ahora };
      const i = opciones.findIndex(
        (o) => !o.desactivada && o.etiqueta.toLowerCase().startsWith(t.toLowerCase()),
      );
      if (i >= 0) setMarcada(i);
    }
  }

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        id={id}
        role="combobox"
        aria-label={etiquetaAria}
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-haspopup="listbox"
        disabled={desactivado}
        onClick={() => setAbierto((v) => !v)}
        onKeyDown={teclas}
        style={{ height: alto }}
        className={
          subrayado
            ? "flex w-full items-center gap-2 rounded-none border-0 border-b bg-transparent px-0 " +
              "text-left text-[0.84375rem] transition disabled:cursor-not-allowed disabled:opacity-60 " +
              (abierto ? "border-marca" : "border-campo-borde hover:border-marca/60")
            : "flex w-full items-center gap-2 rounded-lg border px-3 " +
          "text-left text-[0.78125rem] transition disabled:cursor-not-allowed disabled:opacity-60 " +
          (enBarra
            ? "bg-transparent " +
              (abierto ? "border-current" : "border-encabezado-borde/60 hover:border-current/60")
            : "bg-campo-fondo " +
              (abierto ? "border-marca" : "border-campo-borde hover:border-marca/60"))
        }
      >
        <span className={"min-w-0 flex-1 truncate " + (elegida ? "" : "text-texto-suave")}>
          {elegida?.etiqueta ?? marcador}
        </span>
        <span
          aria-hidden="true"
          className={
            "shrink-0 text-texto-suave transition-transform " + (abierto ? "rotate-180" : "")
          }
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 4.5 6 8l3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {abierto && (
        <ul
          ref={lista}
          id={idLista}
          role="listbox"
          tabIndex={-1}
          onKeyDown={teclas}
          className={
            "caja-scroll absolute top-[calc(100%+4px)] right-0 left-0 z-50 max-h-72 overflow-auto " +
            "rounded-lg border border-borde bg-superficie py-1 " +
            "shadow-[0_10px_30px_-10px_rgba(15,23,42,0.28)]"
          }
        >
          {opciones.length === 0 && (
            <li className="px-3 py-2 text-[0.78125rem] text-texto-suave">
              No hay opciones disponibles.
            </li>
          )}
          {opciones.map((o, i) => {
            const esta = o.valor === valor;
            return (
              <li key={o.valor || `_${i}`} data-i={i}>
                <button
                  type="button"
                  role="option"
                  aria-selected={esta}
                  disabled={o.desactivada}
                  onMouseEnter={() => setMarcada(i)}
                  onClick={() => elegir(i)}
                  className={
                    "sin-aro flex w-full items-start gap-2 px-3 py-[7px] text-left " +
                    "text-[0.78125rem] transition disabled:opacity-50 " +
                    (i === marcada ? "bg-marca-suave " : "") +
                    (esta ? "font-semibold text-marca" : "text-texto")
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug">{o.etiqueta}</span>
                    {o.detalle && (
                      <span className="mt-0.5 block text-[0.71875rem] font-normal text-texto-suave">
                        {o.detalle}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
