"use client";

/** Mandarle un correo a un lead, con plantilla. */

/// El paso que hace que esto sea usable es la VISTA PREVIA.
/// Quien manda ve el texto ya con el nombre puesto, y ve los
/// huecos que no se pudieron llenar, antes de que salga. Un
/// correo mal armado sale una sola vez y no se puede recoger.

import { useCallback, useEffect, useState } from "react";

import { ErrorApi } from "@/lib/api";
import {
  plantillasCorreoApi,
  type PlantillaCorreo,
  type VistaPrevia,
} from "@/lib/plantillas-correo-api";

import { Boton, CLASE_CONTROL } from "./marco-admin";
import { useToast } from "./toast";

export function EnviarCorreo({ participanteId }: { participanteId: string }) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [plantillas, setPlantillas] = useState<PlantillaCorreo[] | null>(null);
  const [elegida, setElegida] = useState("");
  const [vista, setVista] = useState<VistaPrevia | null>(null);
  const [cargandoVista, setCargandoVista] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarPlantillas = useCallback(async () => {
    try {
      setPlantillas(await plantillasCorreoApi.paraEsteLead(participanteId));
    } catch (e) {
      setError((e as ErrorApi).message);
    }
  }, [participanteId]);

  useEffect(() => {
    if (abierto && !plantillas) void cargarPlantillas();
  }, [abierto, plantillas, cargarPlantillas]);

  /// Cada vez que cambia la plantilla se vuelve a pedir cómo
  /// quedaría: es una sola consulta y es lo que evita mandar
  /// a ciegas.
  useEffect(() => {
    if (!elegida) {
      setVista(null);
      return;
    }
    setCargandoVista(true);
    setError(null);
    plantillasCorreoApi
      .vistaPrevia(participanteId, elegida)
      .then(setVista)
      .catch((e) => setError((e as ErrorApi).message))
      .finally(() => setCargandoVista(false));
  }, [elegida, participanteId]);

  async function enviar() {
    setEnviando(true);
    try {
      const r = await plantillasCorreoApi.enviar(participanteId, elegida);
      /// Si va desviado hay que decirlo, y no como una nota al
      /// pie. En pruebas el correo NO le llega a la persona:
      /// dar por bueno un «se envió» deja al asesor creyendo
      /// que ya la avisó, y no la avisó.
      toast.exito(
        r.desviado
          ? `NO le llegó a ${r.para}: este es el entorno de pruebas y el correo ` +
              `se desvió a ${r.entregadoA.join(", ")}.`
          : `Se envió a ${r.para}.`,
      );
      setAbierto(false);
      setElegida("");
      setVista(null);
    } catch (e) {
      toast.error((e as ErrorApi).message);
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-xl border border-marca px-4 py-2 text-sm font-medium text-marca transition hover:bg-marca-suave"
      >
        Escribirle un correo
      </button>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-borde bg-superficie-alterna p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="plantilla" className="mb-1.5 block text-sm font-medium">
            Qué plantilla
          </label>
          <select
            id="plantilla"
            className={CLASE_CONTROL}
            value={elegida}
            onChange={(e) => setElegida(e.target.value)}
          >
            <option value="">Escoja una…</option>
            {(plantillas ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setElegida("");
          }}
          className="pb-2 text-sm underline"
        >
          Cerrar
        </button>
      </div>

      {plantillas?.length === 0 && (
        <p className="text-sm text-texto-suave">
          Todavía no hay plantillas. Se crean en Configuración → Plantillas de
          correo.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-error/30 bg-error-suave p-3 text-sm text-error">
          {error}
        </p>
      )}

      {cargandoVista && <p className="text-sm text-texto-suave">Armando…</p>}

      {vista && !cargandoVista && (
        <div className="space-y-3">
          {/* Los huecos primero: es lo que decide si se puede
              mandar o no, y hay que verlo antes que el texto. */}
          {vista.faltantes.length > 0 && (
            <div className="rounded-xl border border-aviso/30 bg-aviso-suave p-3 text-sm text-aviso">
              <p className="font-medium">
                Le faltan datos a {vista.nombre} para llenar esta plantilla
              </p>
              <p className="mt-1">
                {vista.faltantes.map((f) => `{{${f}}}`).join(", ")}. Se ven abajo,
                tal cual. Complételos en la ficha, o escoja otra plantilla.
              </p>
            </div>
          )}

          {!vista.para && (
            <div className="rounded-xl border border-error/30 bg-error-suave p-3 text-sm text-error">
              {vista.nombre} no tiene correo en la ficha. Sin correo no hay a dónde
              mandarlo.
            </div>
          )}

          <div className="rounded-xl border border-borde bg-superficie p-4">
            <p className="text-xs text-texto-suave">
              Para: <span className="font-mono">{vista.para ?? "—"}</span>
            </p>
            <p className="mt-1 font-medium">{vista.asunto}</p>
            <hr className="my-3 border-borde" />
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {vista.cuerpo}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Boton onClick={() => void enviar()} disabled={!vista.sePuede || enviando}>
              {enviando ? "Enviando…" : "Enviar"}
            </Boton>
            <span className="text-xs text-texto-suave">
              Así, tal cual, es como le va a llegar.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
