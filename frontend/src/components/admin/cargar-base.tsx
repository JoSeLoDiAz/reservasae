"use client";

/** Subir una lista de correos, y ver qué trae antes de mandar. */

/// Una lista subida es la ÚNICA fuente de destinatarios que
/// nadie revisó. Los segmentos salen de la base propia, donde
/// los correos ya pasaron por un formulario; un .xlsx llega de
/// donde sea.
///
/// Por eso esta pantalla enseña TODO lo que se encontró antes
/// de que salga nada, y con la fila de cada descarte: decir
/// «hay 12 errores» sin decir cuáles obliga a repasar
/// trescientas filas a ojo, y quien tiene que mandar la
/// campaña hoy no las repasa: la manda con los doce dentro.

import { useState } from "react";

import { campanasApi, type RevisionDeBase } from "@/lib/campanas-api";

export function CargarBase({
  campanaId,
  alCargar,
}: {
  campanaId: string;
  /// Para que quien manda sepa cuántos quedaron.
  alCargar?: (listos: number) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState<RevisionDeBase | null>(null);

  async function subir(archivo: File) {
    setSubiendo(true);
    setError(null);
    try {
      const r = await campanasApi.subirBase(campanaId, archivo);
      setRevision(r);
      alCargar?.(r.listos);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-borde bg-superficie-alterna p-4">
      <div>
        <p className="text-sm font-medium">La lista de correos</p>
        <p className="mt-1 text-xs text-texto-suave">
          Dos columnas: el correo y el primer nombre. Descargue el formato y no
          le cambie los títulos de la primera fila — es por ahí que se reconoce
          cada columna.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Enlace normal y no fetch: es una descarga. */}
        <a
          href={campanasApi.urlFormatoBase()}
          className="rounded-xl border border-campo-borde bg-superficie px-4 py-2 text-sm transition hover:bg-superficie-alterna"
        >
          Descargar el formato
        </a>

        <label className="cursor-pointer rounded-xl border border-campo-borde bg-superficie px-4 py-2 text-sm transition hover:bg-superficie-alterna">
          {subiendo ? "Revisando…" : "Subir la base llena"}
          <input
            type="file"
            accept=".xlsx"
            /// `sr-only` y no `hidden`: con `display:none` el
            /// input deja de recibir el foco y no hay forma de
            /// llegar al campo con el teclado.
            className="sr-only"
            disabled={subiendo}
            onChange={(e) => {
              const f = e.target.files?.[0];
              // se limpia para poder volver a subir EL MISMO
              // archivo después de corregirlo: sin esto el
              // input no dispara y parece que no hizo nada
              e.target.value = "";
              if (f) void subir(f);
            }}
          />
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-error/30 bg-error-suave p-3 text-sm text-error">
          {error}
        </p>
      )}

      {revision && <Informe r={revision} />}
    </div>
  );
}

function Informe({ r }: { r: RevisionDeBase }) {
  const hayLios = r.descartados.length > 0 || r.sospechosos.length > 0;

  return (
    <div className="space-y-3 border-t border-borde pt-4">
      <div className="flex flex-wrap gap-4">
        <Cifra n={r.listos} que="entran" bien />
        {r.descartados.length > 0 && (
          <Cifra n={r.descartados.length} que="se caen" />
        )}
        {r.repetidos > 0 && <Cifra n={r.repetidos} que="repetidos" />}
      </div>

      {r.listos === 0 ? (
        <p className="rounded-lg border border-error/30 bg-error-suave p-3 text-sm text-error">
          No quedó ni un correo bueno. Revise el archivo: si la primera fila no
          dice «Correo», no se reconoce la columna.
        </p>
      ) : (
        <p className="text-xs text-texto-suave">
          {r.repetidos > 0 && (
            <>
              Los repetidos salen <strong>una sola vez</strong>: mandarle dos
              veces lo mismo a alguien es como se gana uno un «esto es spam».{" "}
            </>
          )}
          {/* Enterarse mañana de que la lista no cabe en un
              día es enterarse tarde. */}
          {r.diasQueTarda > 1 && (
            <>
              Con los topes puestos, esta lista tarda{" "}
              <strong>{r.diasQueTarda} días</strong> en salir entera.
            </>
          )}
        </p>
      )}

      {r.sospechosos.length > 0 && (
        <details className="rounded-lg border border-aviso/30 bg-aviso-suave p-3 text-xs">
          <summary className="cursor-pointer font-medium text-aviso">
            {r.sospechosos.length} parecen errores de dedo. Entran igual —
            mírelos
          </summary>
          <ul className="mt-2 space-y-1">
            {r.sospechosos.map((s) => (
              <li key={s.fila}>
                Fila {s.fila}: <span className="font-mono">{s.correo}</span> —{" "}
                {s.sospecha}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-texto-suave">
            No se corrigen solos: si resulta que sí era así, corregirlo sería
            mandarle el correo a otra persona.
          </p>
        </details>
      )}

      {r.descartados.length > 0 && (
        <details className="rounded-lg border border-borde bg-superficie p-3 text-xs">
          <summary className="cursor-pointer font-medium">
            Los {r.descartados.length} que se cayeron, con su fila
          </summary>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {r.descartados.map((d) => (
              <li key={`${d.fila}-${d.correo}`}>
                Fila {d.fila}:{" "}
                <span className="font-mono">{d.correo || "(vacío)"}</span> —{" "}
                {d.motivo}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-texto-suave">
            Corrija el archivo y vuelva a subirlo: reemplaza al anterior.
          </p>
        </details>
      )}

      {!hayLios && r.listos > 0 && (
        <p className="text-sm text-exito">
          Todo el archivo sirve. Ya puede lanzar.
        </p>
      )}
    </div>
  );
}

function Cifra({
  n,
  que,
  bien,
}: {
  n: number;
  que: string;
  bien?: boolean;
}) {
  return (
    <span className="text-sm">
      <strong
        className={`text-lg ${bien ? "text-exito" : "text-texto"}`}
      >
        {n}
      </strong>{" "}
      <span className="text-texto-suave">{que}</span>
    </span>
  );
}
