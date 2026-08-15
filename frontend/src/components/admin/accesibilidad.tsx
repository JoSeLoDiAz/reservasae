"use client";

import { useEffect, useState } from "react";

/** Ajustes que el sistema operativo no siempre ofrece. */
export type Ajustes = {
  /** Escala del texto, en porcentaje. */
  texto: number;
  /** Quitar transiciones aunque el sistema no lo pida. */
  sinMovimiento: boolean;
  /** Subrayar todos los enlaces, no solo al pasar. */
  enlacesSubrayados: boolean;
};

const POR_DEFECTO: Ajustes = {
  texto: 100,
  sinMovimiento: false,
  enlacesSubrayados: false,
};

const LLAVE = "convoca:accesibilidad";

export function leerAjustes(): Ajustes {
  try {
    const crudo = window.localStorage.getItem(LLAVE);
    if (!crudo) return POR_DEFECTO;
    return { ...POR_DEFECTO, ...(JSON.parse(crudo) as Partial<Ajustes>) };
  } catch {
    return POR_DEFECTO;
  }
}

function aplicar(ajustes: Ajustes) {
  const raiz = document.documentElement;
  // el rem manda: escala la interfaz entera
  raiz.style.fontSize = `${ajustes.texto}%`;
  raiz.dataset.sinMovimiento = ajustes.sinMovimiento ? "si" : "";
  raiz.dataset.enlacesSubrayados = ajustes.enlacesSubrayados ? "si" : "";
}

/** Fija los ajustes antes de pintar, como el del tema. */
export const SCRIPT_ACCESIBILIDAD = `
(function () {
  try {
    var a = JSON.parse(localStorage.getItem(${JSON.stringify(LLAVE)}) || '{}');
    var r = document.documentElement;
    if (typeof a.texto === 'number' && a.texto >= 80 && a.texto <= 150) {
      r.style.fontSize = a.texto + '%';
    }
    if (a.sinMovimiento) r.dataset.sinMovimiento = 'si';
    if (a.enlacesSubrayados) r.dataset.enlacesSubrayados = 'si';
  } catch (e) {}
})();
`;

export function PanelAccesibilidad({ alCerrar }: { alCerrar: () => void }) {
  const [ajustes, setAjustes] = useState<Ajustes>(POR_DEFECTO);

  useEffect(() => {
    setAjustes(leerAjustes());
  }, []);

  function cambiar(parcial: Partial<Ajustes>) {
    const nuevos = { ...ajustes, ...parcial };
    setAjustes(nuevos);
    aplicar(nuevos);
    try {
      window.localStorage.setItem(LLAVE, JSON.stringify(nuevos));
    } catch {
      // en privado localStorage puede fallar
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Accesibilidad"
      className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-borde bg-superficie p-4 shadow-lg"
    >
      <div className="flex items-start justify-between">
        <h2 className="text-sm font-semibold">Accesibilidad</h2>
        <button onClick={alCerrar} className="text-texto-suave" aria-label="Cerrar">
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
        onClick={() => cambiar(POR_DEFECTO)}
        className="mt-4 text-sm text-marca underline"
      >
        Restablecer
      </button>
    </div>
  );
}
