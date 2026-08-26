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
      /// El boton vive al pie de la barra lateral: colgando
      /// hacia abajo, el panel salia de la pantalla y no se
      /// leia ni la mitad. `bottom-full` lo apoya sobre el
      /// boton y crece hacia el espacio que si hay.
      ///
      /// `left-0` y no `right-0`: la barra es angosta, y
      /// alineado a la derecha el panel de 18rem se salia por
      /// el otro lado.
      className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-xl border border-borde bg-superficie p-4 shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">Accesibilidad</h2>
        <button
          onClick={alCerrar}
          aria-label="Cerrar"
          className="-mt-1 -mr-1 rounded-lg px-2 py-1 text-lg leading-none text-texto-suave hover:bg-superficie-alterna"
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
