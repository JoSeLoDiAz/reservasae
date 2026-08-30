"use client";

/** Cuándo va a salir esta campaña, dicho antes de lanzarla. */

/// La pregunta que la pantalla no contestaba.
///
/// Alguien lanzaba a las siete de la noche, no veía salir
/// nada, y creía que estaba roto. La respuesta —«sale mañana a
/// las ocho»— la sabía el servidor y no la decía nadie.
///
/// Lo calcula el SERVIDOR y no esto: las reglas de horario
/// viven en el backend, y copiarlas aquí crearía dos verdades
/// que el día que alguien cambie el horario se separan.

import { useEffect, useState } from "react";

import { campanasApi, type CuandoSale } from "@/lib/campanas-api";

export function CuandoVaASalir({ cuantos }: { cuantos: number }) {
  const [r, setR] = useState<CuandoSale | null>(null);

  useEffect(() => {
    let vivo = true;
    void campanasApi
      .cuandoSale(cuantos)
      .then((x) => vivo && setR(x))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [cuantos]);

  if (!r) return null;

  return (
    /// Punto y texto, no una caja de color.
    ///
    /// Era un recuadro amarillo con borde y radio en medio del
    /// formulario, y ahi dentro competia con los campos en vez
    /// de acompaniarlos. El color se queda -- dice si sale ya o
    /// si espera -- pero en el punto y en la letra.
    <div className="flex items-baseline gap-2.5 py-1 text-[0.78125rem]">
      <span
        aria-hidden
        className="mt-[1px] h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ background: r.ahora ? "var(--marca)" : "var(--aviso)" }}
      />
      <div className="min-w-0 flex-1">
      <p className={r.ahora ? "font-semibold" : "font-semibold text-aviso"}>
        {r.cuando}
      </p>
      {r.tarda && <p className="mt-1 text-texto-suave">{r.tarda}</p>}
      <p className="mt-2 text-[0.71875rem] text-texto-suave">
        Sale de a uno, entre las {r.horario.desde}:00 y las {r.horario.hasta}:00,
        de lunes a viernes. Máximo {r.horario.topeDiario} al día — el resto del
        cupo se deja para el correo normal de la oficina.
      </p>
      </div>
    </div>
  );
}
