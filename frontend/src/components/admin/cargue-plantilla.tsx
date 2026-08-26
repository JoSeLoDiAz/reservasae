"use client";

/** Bajar el formato, llenarlo y subirlo. */

/// Los dos botones viven en la barra de la tabla, junto a
/// «Descargar en Excel», porque son de la misma familia: sacar
/// y meter datos. Van con otro color para que no se confundan
/// -- uno baja un informe, los otros dos cambian la base.
///
/// La confirmación no cabe en una barra, así que sale en un
/// recuadro sobre la pantalla: es una decisión, y una decisión
/// merece que uno se detenga.

import { useEffect, useRef, useState } from "react";

import { ErrorApi } from "@/lib/api";
import { plantillasApi, type ResultadoCargue } from "@/lib/plantillas-api";

import { Boton } from "./marco-admin";

/// Ni relleno como «Descargar en Excel» ni gris como los
/// demás: borde y letra en el color de la marca. Se leen como
/// un grupo aparte sin gritar.
const CLASE =
  "rounded-xl border border-marca px-4 py-2 text-sm font-medium " +
  "whitespace-nowrap text-marca no-underline transition hover:bg-marca-suave " +
  "disabled:opacity-50";

export function CarguePlantilla({
  entidad,
  admiteNuevas,
  alTerminar,
}: {
  entidad: "instituciones" | "empresas" | "reservas";
  /// Si el archivo puede traer filas que no existen.
  admiteNuevas: boolean;
  alTerminar: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [ensayo, setEnsayo] = useState<ResultadoCargue | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function limpiar() {
    setArchivo(null);
    setEnsayo(null);
    setError(null);
    if (entrada.current) entrada.current.value = "";
  }

  /// Al elegir el archivo se revisa, no se aplica.
  async function revisar(f: File) {
    setOcupado(true);
    setError(null);
    try {
      setEnsayo(await plantillasApi.cargar(entidad, f, true));
      setArchivo(f);
    } catch (e) {
      setError((e as ErrorApi).message);
      setEnsayo(null);
      setArchivo(null);
    } finally {
      setOcupado(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function aplicar() {
    if (!archivo) return;
    setOcupado(true);
    setError(null);
    try {
      await plantillasApi.cargar(entidad, archivo, false);
      limpiar();
      alTerminar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <a href={plantillasApi.urlFormato(entidad)} className={CLASE} download>
        Descargar formato
      </a>

      <label className={`${CLASE} cursor-pointer`}>
        {ocupado && !ensayo ? "Revisando…" : "Cargar archivo"}
        <input
          ref={entrada}
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void revisar(f);
          }}
        />
      </label>

      {(ensayo || error) && (
        <Confirmacion
          nombre={archivo?.name ?? ""}
          r={ensayo}
          error={error}
          ocupado={ocupado}
          admiteNuevas={admiteNuevas}
          alAplicar={aplicar}
          alCerrar={limpiar}
        />
      )}
    </>
  );
}

/** Qué va a pasar, antes de que pase. */
function Confirmacion({
  nombre,
  r,
  error,
  ocupado,
  admiteNuevas,
  alAplicar,
  alCerrar,
}: {
  nombre: string;
  r: ResultadoCargue | null;
  error: string | null;
  ocupado: boolean;
  admiteNuevas: boolean;
  alAplicar: () => void;
  alCerrar: () => void;
}) {
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [alCerrar]);

  const puede = Boolean(r) && r!.reparos.length === 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        onClick={alCerrar}
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
      />

      <div
        role="dialog"
        aria-label="Confirmar el cargue"
        className="relative w-full max-w-xl rounded-2xl border border-borde bg-superficie p-6 shadow-2xl"
      >
        <h2 className="text-lg font-semibold">
          {error
            ? "No se pudo leer el archivo"
            : puede
              ? "Esto es lo que va a pasar"
              : "El archivo tiene problemas"}
        </h2>

        {nombre && (
          <p className="mt-1 font-mono text-xs text-texto-suave">{nombre}</p>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-error/30 bg-error-suave p-4 text-sm text-error">
            {error}
          </p>
        )}

        {r && r.reparos.length > 0 && (
          <div className="mt-4 rounded-xl border border-error/30 bg-error-suave p-4 text-sm">
            <p className="text-error">
              No se escribió nada. Corrija el archivo y vuelva a subirlo.
            </p>
            <ul className="mt-2 space-y-1 text-error">
              {/* diez y no más: con doscientos, la lista deja
                  de ayudar y solo asusta */}
              {r.reparos.slice(0, 10).map((p, i) => (
                <li key={i}>
                  {p.fila > 1 && <strong>Fila {p.fila}: </strong>}
                  {p.problema}
                </li>
              ))}
            </ul>
            {r.reparos.length > 10 && (
              <p className="mt-2 text-texto-suave">
                …y {r.reparos.length - 10} más.
              </p>
            )}
          </div>
        )}

        {r && puede && (
          <div className="mt-4 space-y-2 rounded-xl border border-borde bg-superficie-alterna p-4 text-sm">
            <p>
              <strong>{r.leidas}</strong> {r.leidas === 1 ? "fila" : "filas"} en el
              archivo.
            </p>
            <p>
              Se corrigen <strong>{r.actualizadas}</strong>
              {admiteNuevas && r.creadas > 0 && (
                <> y se crean <strong>{r.creadas}</strong></>
              )}
              .
            </p>
            {r.vacias > 0 && (
              <p className="text-texto-suave">
                {r.vacias} {r.vacias === 1 ? "celda venía" : "celdas venían"} en
                blanco. Esos datos <strong className="text-texto">no se tocan</strong>:
                una celda vacía no borra lo que hay.
              </p>
            )}
            <p className="text-texto-suave">
              Queda registrado quién lo hizo y cuándo. Todavía no se ha escrito
              nada.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {puede && (
            <Boton onClick={alAplicar} disabled={ocupado}>
              {ocupado ? "Cargando…" : "Confirmar y cargar"}
            </Boton>
          )}
          <button type="button" onClick={alCerrar} className="text-sm underline">
            {puede ? "Cancelar" : "Cerrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
