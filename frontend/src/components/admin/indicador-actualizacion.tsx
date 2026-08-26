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

  /// Mientras todo va bien, no se pinta NADA.
  ///
  /// La pantalla se refresca sola cada treinta segundos y al
  /// volver a la pestaña. Un botón «Actualizar» al lado de
  /// algo que ya se actualiza solo no hace nada que no vaya
  /// a pasar igual, y ocupa el sitio donde debería estar lo
  /// que sí importa.
  ///
  /// Lo único que no se puede adivinar mirando es que el
  /// servidor dejó de contestar y lo que hay en pantalla ya
  /// no es de fiar. Para eso se enciende esto.
  if (!desactualizado) return null;

  return (
    <div className="no-imprimir flex flex-wrap items-center gap-3 text-sm text-texto-suave">
      {/* Callado mientras todo va bien.
          
          La pantalla se refresca sola cada treinta segundos:
          decir «Actualizado hace un momento» treinta veces por
          minuto no informa de nada, porque nunca dice otra
          cosa. Un aviso que siempre dice lo mismo deja de
          leerse, y el día que diga algo distinto tampoco se
          va a leer.
          
          Solo habla cuando hay algo que contar: que el
          servidor no contestó y lo que está viendo ya no es
          de fiar. Eso sí no se puede adivinar mirando. */}
      <span
        aria-live="polite"
        className="rounded-full bg-aviso-suave px-2.5 py-0.5 text-xs font-medium text-aviso"
      >
        Sin conexión · lo que ve es de{" "}
        {actualizadoEn ? hace(actualizadoEn, ahora) : "antes"}
      </span>

      {/* Reintentar aquí SÍ vale: la pantalla vuelve a
          probar sola, pero cada treinta segundos, y quien
          está mirando una pantalla caída no quiere esperar
          medio minuto para saber si ya volvió. */}
      <button
        type="button"
        onClick={alRefrescar}
        disabled={refrescando}
        className="rounded-lg border border-borde px-3 py-1 hover:bg-fondo disabled:opacity-50"
      >
        {refrescando ? "Reintentando…" : "Reintentar"}
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
