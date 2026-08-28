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
    <div
      className={`rounded-xl border p-4 text-sm ${
        r.ahora
          ? "border-borde bg-superficie-alterna"
          : "border-aviso/30 bg-aviso-suave"
      }`}
    >
      <p className={r.ahora ? "font-medium" : "font-medium text-aviso"}>
        {r.cuando}
      </p>
      {r.tarda && <p className="mt-1 text-texto-suave">{r.tarda}</p>}
      <p className="mt-2 text-xs text-texto-suave">
        Sale de a uno, entre las {r.horario.desde}:00 y las {r.horario.hasta}:00,
        de lunes a viernes. Máximo {r.horario.topeDiario} al día — el resto del
        cupo se deja para el correo normal de la oficina.
      </p>
    </div>
  );
}
