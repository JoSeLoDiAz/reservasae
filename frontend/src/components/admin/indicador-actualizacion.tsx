"use client";

import { useEffect, useState } from "react";

/** Texto relativo tipo «hace 2 min». */
function hace(desde: Date, ahora: number): string {
  const segundos = Math.max(0, Math.floor((ahora - desde.getTime()) / 1000));
  if (segundos < 10) return "hace un momento";
  if (segundos < 60) return `hace ${Math.floor(segundos / 10) * 10} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `hace ${horas} h`;
}

export function IndicadorActualizacion({
  actualizadoEn,
  refrescando,
  desactualizado,
  alRefrescar,
}: {
  actualizadoEn: Date | null;
  refrescando: boolean;
  desactualizado: boolean;
  alRefrescar: () => void;
}) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="no-imprimir flex flex-wrap items-center gap-3 text-sm text-texto-suave">
      {/* sin lectura en voz alta */}
      <span aria-live="off">
        {actualizadoEn ? `Actualizado ${hace(actualizadoEn, ahora)}` : "Cargando…"}
      </span>

      {desactualizado && (
        <span className="rounded-full bg-aviso-suave px-2 py-0.5 text-xs font-medium text-aviso">
          Sin conexión con el servidor
        </span>
      )}

      <button
        type="button"
        onClick={alRefrescar}
        disabled={refrescando}
        className="rounded-lg border border-borde px-3 py-1 hover:bg-fondo disabled:opacity-50"
      >
        {refrescando ? "Actualizando…" : "Actualizar"}
      </button>
    </div>
  );
}

/** Marca temporal para el PDF. */
export function SelloDeDatos({ actualizadoEn }: { actualizadoEn: Date | null }) {
  if (!actualizadoEn) return null;
  return (
    <p className="solo-impresion text-sm text-texto-suave">
      Datos a{" "}
      {actualizadoEn.toLocaleString("es-CO", {
        dateStyle: "long",
        timeStyle: "short",
      })}
    </p>
  );
}
