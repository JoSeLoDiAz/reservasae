"use client";

import { useEffect, useRef, useState } from "react";

import {
  aplicarAjustes,
  type Ajustes,
  AJUSTES_POR_DEFECTO,
  leerAjustes,
  LLAVE_ACCESIBILIDAD,
} from "@/lib/accesibilidad";

export function PanelAccesibilidad({ alCerrar }: { alCerrar: () => void }) {
  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES_POR_DEFECTO);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAjustes(leerAjustes());
  }, []);

  // cerrar con Escape o pinchando fuera: un panel del que
  // solo se sale con la equis se queda abierto
  useEffect(() => {
    const conTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    const conClic = (e: MouseEvent) => {
      const donde = e.target as HTMLElement;
      if (caja.current?.contains(donde)) return;

      /// El boton que lo abre no cuenta como «fuera».
      ///
      /// Sin esto, el segundo clic no cerraba: el `mousedown`
      /// lo cerraba y el `click` que venia detras lo volvia a
      /// abrir, porque para entonces el estado ya decia que
      /// estaba cerrado. Se veia como si el panel se quedara
      /// pegado.
      if (donde.closest?.("[data-abre-panel]")) return;

      alCerrar();
    };
    document.addEventListener("keydown", conTecla);
    // en el siguiente ciclo: si no, el clic que lo abrio
    // lo cierra en el acto
    const id = window.setTimeout(() => document.addEventListener("mousedown", conClic), 0);
    return () => {
      document.removeEventListener("keydown", conTecla);
      document.removeEventListener("mousedown", conClic);
      window.clearTimeout(id);
    };
  }, [alCerrar]);

  function cambiar(parcial: Partial<Ajustes>) {
    const nuevos = { ...ajustes, ...parcial };
    setAjustes(nuevos);
    aplicarAjustes(nuevos);
    try {
      window.localStorage.setItem(LLAVE_ACCESIBILIDAD, JSON.stringify(nuevos));
    } catch {
      // en privado localStorage puede fallar
    }
  }

  return (
    <div
      ref={caja}
      role="dialog"
      aria-label="Accesibilidad"
      /// Hacia ARRIBA, no hacia abajo.
      ///
      /// El boton vive abajo: colgando hacia abajo, el panel
      /// salia de la pantalla y no se leia ni la mitad.
      /// `bottom-full` lo apoya sobre el boton y crece hacia el
      /// espacio que si hay. Eso no ha cambiado en ninguna de las
      /// tres mudanzas del boton.
      ///
      /// `right-0` Y NO `left-0`, y esto sí cambió el 12 sep 2026.
      /// Aquí decía lo contrario, y con razón mientras el botón
      /// vivía al pie de una barra angosta pegada a la izquierda:
      /// anclado a la derecha, el panel de 18rem se salía por el
      /// otro lado. Ahora el botón está en una píldora flotante en
      /// el borde DERECHO de la ventana, así que la advertencia se
      /// invirtió: anclado a la izquierda, la tarjeta se salía de
      /// la pantalla y se veía cortada.
      /// `text-texto` NO es decorativo: es lo que impide que esta
      /// tarjeta se quede ilegible según desde dónde se abra.
      ///
      /// El 12 sep 2026 el botón se fue a una píldora flotante que
      /// lleva el color del encabezado --blanco sobre el verde--, y
      /// todo lo de aquí que no declaraba color lo heredó: el
      /// título, «Tamaño del texto», «Quitar animaciones» y
      /// «Restablecer» salieron en blanco sobre `--superficie`, o
      /// sea invisibles. Los textos de ayuda sí se leían, porque
      /// usan `text-texto-suave` explícito -- y eso era la pista.
      ///
      /// Una tarjeta que pone su propio FONDO tiene que poner su
      /// propio TEXTO. Así da igual desde qué contexto se monte.
      className="absolute right-0 bottom-full z-50 mb-2 w-72 rounded-xl border border-borde bg-superficie p-4 text-texto shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">Accesibilidad</h2>
        <button
          onClick={alCerrar}
          aria-label="Cerrar"
          className="-mt-1 -mr-1 rounded-lg px-2 py-1 text-lg leading-none text-texto-suave transition hover:bg-superficie-alterna"
        >
          ✕
        </button>
      </div>

      <label className="mt-4 block text-sm">
        <span className="flex items-center justify-between">
          Tamaño del texto
          <span className="font-mono text-xs text-texto-suave">{ajustes.texto} %</span>
        </span>
        <input
          type="range"
          min={90}
          max={140}
          step={10}
          value={ajustes.texto}
          onChange={(e) => cambiar({ texto: Number(e.target.value) })}
          className="mt-2 w-full"
        />
      </label>

      <label className="mt-4 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={ajustes.sinMovimiento}
          onChange={(e) => cambiar({ sinMovimiento: e.target.checked })}
          className="mt-0.5"
        />
        <span>
          Quitar animaciones
          <span className="block text-xs text-texto-suave">
            Si su sistema ya lo pide, se respeta sin tocar esto.
          </span>
        </span>
      </label>

      <label className="mt-3 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={ajustes.enlacesSubrayados}
          onChange={(e) => cambiar({ enlacesSubrayados: e.target.checked })}
          className="mt-0.5"
        />
        <span>
          Subrayar todos los enlaces
          <span className="block text-xs text-texto-suave">
            Para no depender del color al distinguirlos.
          </span>
        </span>
      </label>

      <button
        onClick={() => cambiar(AJUSTES_POR_DEFECTO)}
        className="mt-4 text-sm text-marca underline"
      >
        Restablecer
      </button>
    </div>
  );
}
