"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  enPortal,
  rotulo,
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
  /**
   * UN TÍTULO DENTRO DE LA LISTA, en la primera línea y sin poder
   * elegirse.
   *
   * «No me gusta; si el "Seleccione la vista" dentro del desplegable
   * como título, no sé, pero se ve asqueroso» (cliente, 1 oct 2026),
   * sobre el rótulo en versalitas que iba FUERA, a la izquierda. Ese
   * rótulo cuesta sitio en la fila y grita; dentro dice lo mismo y
   * solo cuando se abre, que es cuando hace falta.
   */
  /**
   * QUE LA LISTA SE SALGA DEL RECORTE.
   *
   * La lista va `absolute` dentro del disparador, y eso basta en una
   * página normal. Dentro de una TABLA no: `.caja-scroll` lleva
   * `overflow: auto` para que la tabla recorra a lo ancho, y lo que
   * sobresale de un contenedor con `overflow` se recorta. Una lista de
   * quince opciones abierta en la cabecera de una columna quedaría
   * cortada por el borde de la tabla.
   *
   * Con esto la lista se pinta en `document.body` y se coloca con
   * `fixed` sobre las coordenadas medidas del disparador: ya no hay
   * ancestro que la recorte. Se paga que haya que CERRARLA al recorrer
   * ---un `fixed` no acompaña al scroll de dentro--- y de eso se
   * encarga el efecto de más abajo, que escucha en captura.
   *
   * No se pone por omisión: donde no hay recorte, `absolute` acompaña
   * al disparador sola y no hay nada que cerrar.
   */
  enPortal?: boolean;
  rotulo?: string;
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
  /// De qué lado y hacia dónde se abre la lista. Ver el efecto que los
  /// mide más abajo.
  const [lado, setLado] = useState<"izq" | "der">("izq");
  const [arriba, setArriba] = useState(false);
  /// Dónde cae el disparador en la ventana, para colocar la lista
  /// cuando va por portal. Solo se usa con `enPortal`.
  const [ancla, setAncla] = useState<DOMRect | null>(null);
  const tecleo = useRef({ texto: "", cuando: 0 });
  const propio = useId();
  const idLista = `${id ?? propio}-lista`;

  const elegida = opciones.find((o) => o.valor === valor) ?? null;

  /// Al `body` o donde estaba. `document` no existe en el servidor, de
  /// ahí la guarda: esta lista solo se pinta con el panel ya abierto.
  const envolver = (nodo: React.ReactElement) =>
    enPortal && typeof document !== "undefined"
      ? createPortal(nodo, document.body)
      : nodo;

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

  /// DE QUÉ LADO SE ABRE, MEDIDO.
  ///
  /// La lista nace pegada al canto izquierdo del disparador y crece a
  /// la derecha lo que pida su opción más larga. En un filtro que vive
  /// al final de una barra eso la manda fuera de la ventana: medido el
  /// 23 sep 2026 en Mesa de entrada, el filtro de estado abría hasta
  /// 1.601 px en una ventana de 1.600 --«revisa las superposiciones»--,
  /// y encima el `<main>` scrollea, así que lo que sobresale se recorta
  /// en vez de asomar.
  ///
  /// Así que se mide después de pintar y, si no cabe, se cambia de
  /// lado; y si tampoco cabe abajo, se abre hacia arriba. No se calcula
  /// a mano el ancho: la lista ya está en el DOM y lo dice ella.
  /// Se decide con el ANCHO y el ALTO de la lista, no con dónde está
  /// pintada ahora: si se mirara su borde derecho, una lista ya volteada
  /// mediría bien --porque está volteada-- y se devolvería al lado malo
  /// en la siguiente apertura, alternando sola.
  useLayoutEffect(() => {
    if (!abierto) return;
    const l = lista.current?.getBoundingClientRect();
    const d = caja.current?.getBoundingClientRect();
    if (!l || !d) return;
    const margen = 8;
    const noCabeALaDerecha = d.left + l.width > window.innerWidth - margen;
    const cabeALaIzquierda = d.right - l.width > margen;
    const noCabeAbajo = d.bottom + 4 + l.height > window.innerHeight - margen;
    /// Hacia arriba solo si arriba hay MÁS sitio que abajo: si no, se
    /// queda abajo y la propia lista scrollea, que es mejor que abrirse
    /// hacia un hueco igual de corto.
    const hayMasSitioArriba = d.top > window.innerHeight - d.bottom;
    /// Se mide después de pintar: es la única forma de saber cuánto
    /// pide la lista.
    setLado(noCabeALaDerecha && cabeALaIzquierda ? "der" : "izq");
    setArriba(noCabeAbajo && hayMasSitioArriba);
  }, [abierto, opciones]);

  /// La posición del disparador, al abrir y al cambiar de tamaño.
  useLayoutEffect(() => {
    if (!abierto || !enPortal) return;
    setAncla(caja.current?.getBoundingClientRect() ?? null);
  }, [abierto, enPortal]);

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
    /// EN CAPTURA, y esto no sobra: el scroll de un contenedor de
    /// dentro ---la tabla--- NO burbujea hasta `window`. Sin la fase de
    /// captura, recorrer la tabla con la lista abierta la dejaba
    /// flotando sobre la pantalla, quieta y lejos de su columna.
    document.addEventListener("scroll", cerrar, true);
    return () => {
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("resize", cerrar);
      document.removeEventListener("scroll", cerrar, true);
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
        {/* EL RÓTULO, DENTRO DEL PROPIO CONTROL y encima del valor.
            «¿Dónde está el título?» (cliente, 1 oct 2026): puesto solo
            en la lista, con el desplegable cerrado no se veía nada. Aquí
            está siempre, no cuesta una fila de pantalla como el rótulo
            de fuera, y no compite con el valor porque va en letra
            chica y en gris. */}
        {rotulo ? (
          <span className="flex min-w-0 flex-1 flex-col items-start justify-center leading-tight">
            <span className="text-[0.5625rem] font-bold tracking-[0.08em] uppercase text-texto-suave">
              {rotulo}
            </span>
            <span className={"w-full truncate " + (elegida ? "" : "text-texto-suave")}>
              {elegida?.etiqueta ?? marcador}
            </span>
          </span>
        ) : (
          <span className={"min-w-0 flex-1 truncate " + (elegida ? "" : "text-texto-suave")}>
            {elegida?.etiqueta ?? marcador}
          </span>
        )}
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

      {abierto && envolver(
        <ul
          ref={lista}
          id={idLista}
          role="listbox"
          tabIndex={-1}
          onKeyDown={teclas}
          className={
            /// Nunca MÁS ESTRECHO que el disparador, y tan
            /// ancho como su opción más larga.
            ///
            /// Estaba clavado a `left-0 right-0`, o sea al ancho
            /// exacto del botón: en un filtro angosto --«vs.
            /// anterior»-- la lista salía apretada y opciones
            /// como «vs. desde el principio» se cortaban. Ahora
            /// arranca en el borde izquierdo y crece lo que
            /// necesite, con tope para que no se vaya de la
            /// pantalla.
            "caja-scroll z-50 max-h-72 w-max max-w-[24rem] overflow-auto " +
            (enPortal ? "fixed " : "absolute min-w-full ") +
            (enPortal
              ? ""
              : (arriba ? "bottom-[calc(100%+4px)] " : "top-[calc(100%+4px)] ") +
                (lado === "der" ? "right-0 " : "left-0 ")) +
            "rounded-lg border border-borde bg-superficie py-1 " +
            "shadow-[0_10px_30px_-10px_rgba(15,23,42,0.28)]"
          }
          style={
            enPortal && ancla
              ? {
                  minWidth: ancla.width,
                  ...(arriba
                    ? { bottom: window.innerHeight - ancla.top + 4 }
                    : { top: ancla.bottom + 4 }),
                  ...(lado === "der"
                    ? { right: window.innerWidth - ancla.right }
                    : { left: ancla.left }),
                }
              : undefined
          }
        >
          {rotulo && (
            <li
              aria-hidden
              className="border-b border-hairline px-3 pt-1 pb-2 text-[0.625rem] font-bold tracking-[0.08em] uppercase text-texto-suave"
            >
              {rotulo}
            </li>
          )}
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
                  /// LA ELEGIDA, CON RELLENO SÓLIDO (cliente, 24
                  /// sep 2026). Ver el porqué en `SelectorBuscable`:
                  /// se cambian los dos a la vez para que no queden
                  /// dos aspectos del mismo control.
                  className={
                    "sin-aro flex w-full items-start gap-2 px-3 py-[7px] text-left " +
                    "text-[0.78125rem] transition disabled:opacity-50 " +
                    (esta
                      ? "bg-marca font-semibold text-marca-texto"
                      : (i === marcada ? "bg-marca-suave " : "") + "text-texto")
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug">{o.etiqueta}</span>
                    {o.detalle && (
                      <span
                        className={
                          "mt-0.5 block text-[0.71875rem] font-normal " +
                          (esta ? "opacity-80" : "text-texto-suave")
                        }
                      >
                        {o.detalle}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>,
      )}
    </div>
  );
}
