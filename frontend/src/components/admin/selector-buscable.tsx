"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CLASE_CONTROL } from "./marco-admin";

export type OpcionBuscable = {
  id: string;
  /// Lo que se lee en la lista y en el campo.
  etiqueta: string;
  /// Segunda línea, más pequeña.
  detalle?: string;
  /// Texto extra por el que también se busca.
  busca?: string;
  deshabilitada?: boolean;
};

const sinTildes = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Desplegable con el buscador dentro, no al lado. Un
 * `<select>` nativo no admite escribir para filtrar, y con
 * quince acciones en decenas de ubicaciones desplegar y
 * leer no es forma de encontrar nada.
 */
export function SelectorBuscable({
  opciones,
  valor,
  alElegir,
  marcador = "Buscar…",
  vacio = "Sin asignar",
  etiqueta,
  clase,
}: {
  opciones: OpcionBuscable[];
  valor: string;
  alElegir: (id: string) => void;
  marcador?: string;
  /// Lo que dice sin elegir nada: en un filtro, «todos».
  vacio?: string;
  /// Para el lector de pantalla, si no va dentro de Campo.
  etiqueta?: string;
  /// El ancho: en un filtro no ocupa la fila entera.
  clase?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [escrito, setEscrito] = useState("");
  const caja = useRef<HTMLDivElement>(null);

  const elegida = opciones.find((o) => o.id === valor);

  const visibles = useMemo(() => {
    const aguja = sinTildes(escrito.trim());
    if (!aguja) return opciones;
    return opciones.filter((o) =>
      sinTildes(`${o.etiqueta} ${o.detalle ?? ""} ${o.busca ?? ""}`).includes(aguja),
    );
  }, [opciones, escrito]);

  // fuera y Escape cierran, como cualquier desplegable
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", alPulsar);
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alPulsar);
      window.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  function elegir(id: string) {
    alElegir(id);
    setAbierto(false);
    setEscrito("");
  }

  return (
    <div className={`relative ${clase ?? ""}`} ref={caja}>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        aria-label={etiqueta}
        className={`${CLASE_CONTROL} flex items-center gap-2 text-left`}
      >
        <span className="min-w-0 grow truncate">
          {elegida ? (
            <>
              {elegida.etiqueta}
              {elegida.detalle && (
                <span className="text-texto-suave"> · {elegida.detalle}</span>
              )}
            </>
          ) : (
            <span className="text-texto-suave">{vacio}</span>
          )}
        </span>
        <span aria-hidden className="shrink-0 text-texto-suave">
          ▾
        </span>
      </button>

      {abierto && (
        <div className="absolute z-40 mt-1 w-full min-w-64 max-w-[90vw] overflow-hidden rounded-xl border border-borde bg-superficie shadow-lg">
          <div className="border-b border-borde p-2">
            <input
              autoFocus
              value={escrito}
              onChange={(e) => setEscrito(e.target.value)}
              placeholder={marcador}
              className={CLASE_CONTROL}
              aria-label="Buscar en la lista"
            />
          </div>

          <ul role="listbox" className="barra-visible max-h-72 overflow-y-auto p-1">
            <li>
              <button
                type="button"
                onClick={() => elegir("")}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-texto-suave hover:bg-superficie-alterna"
              >
                {vacio}
              </button>
            </li>

            {visibles.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  disabled={o.deshabilitada}
                  onClick={() => elegir(o.id)}
                  role="option"
                  aria-selected={o.id === valor}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition disabled:opacity-40 ${
                    o.id === valor
                      ? "bg-marca-suave font-medium text-marca"
                      : "hover:bg-superficie-alterna"
                  }`}
                >
                  <span className="block">{o.etiqueta}</span>
                  {o.detalle && (
                    <span className="block text-xs text-texto-suave">{o.detalle}</span>
                  )}
                </button>
              </li>
            ))}

            {visibles.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-texto-suave">
                Ninguna coincide con «{escrito}»
              </li>
            )}
          </ul>

          {escrito && visibles.length > 0 && (
            <p className="border-t border-borde px-3 py-1.5 text-xs text-texto-suave">
              {visibles.length} de {opciones.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
