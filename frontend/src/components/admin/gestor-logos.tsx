"use client";

import { useEffect, useRef, useState } from "react";

import { Boton, CLASE_CONTROL } from "@/components/admin/marco-admin";
import { adminApi, MAXIMO_LOGOS, urlLogo, type Logo } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";

type Props = {
  /** Sin él, los de la marca general. */
  formularioId?: string;
  /** Los generales, para poder enseñar qué se hereda. */
  heredados?: Logo[];
  alCambiar?: (logos: Logo[]) => void;
};

/** Hasta tres logos, en orden de cabecera. */
export function GestorLogos({ formularioId, heredados, alCambiar }: Props) {
  const [logos, setLogos] = useState<Logo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const entradaArchivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void adminApi.logos(formularioId).then(setLogos).catch(() => setLogos([]));
  }, [formularioId]);

  async function accion(fn: () => Promise<Logo[]>) {
    setError(null);
    setOcupado(true);
    try {
      const siguientes = await fn();
      setLogos(siguientes);
      alCambiar?.(siguientes);
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }

  if (!logos) return <p className="text-sm text-texto-suave">Cargando…</p>;

  const hereda = Boolean(formularioId) && logos.length === 0;
  const mostrados = hereda ? (heredados ?? []) : logos;

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg border border-error/30 bg-error-suave p-3 text-sm text-error">
          {error}
        </p>
      )}

      {hereda && (
        <p className="text-sm text-texto-suave">
          {mostrados.length
            ? "Ahora mismo usa los logos de la apariencia general. En cuanto suba uno aquí, este formulario deja de heredarlos."
            : "No hay logos. En la cabecera se muestra el nombre de la aplicación."}
        </p>
      )}

      {mostrados.length > 0 && (
        <div className="rounded-lg border border-borde bg-fondo p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-texto-suave">
            Así se ve la cabecera
          </p>
          {/* al tamano real: lo que se ve aqui es lo que se publica */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {mostrados.map((logo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={logo.id}
                src={urlLogo(logo)}
                alt={logo.etiqueta}
                className="h-20 w-auto max-w-[14rem] object-contain"
              />
            ))}
          </div>
        </div>
      )}

      {logos.length > 0 && (
        <ul className="divide-y divide-borde">
          {logos.map((logo, i) => (
            <li key={logo.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="grid h-12 w-24 shrink-0 place-items-center rounded border border-borde bg-fondo p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlLogo(logo)}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
              </span>

              <label className="min-w-48 flex-1">
                <span className="mb-1 block text-xs text-texto-suave">
                  Nombre de la entidad
                </span>
                <input
                  defaultValue={logo.etiqueta}
                  disabled={ocupado}
                  onBlur={(e) => {
                    const etiqueta = e.target.value.trim();
                    if (etiqueta && etiqueta !== logo.etiqueta) {
                      void accion(() => adminApi.actualizarLogo(logo.id, { etiqueta }));
                    }
                  }}
                  className={CLASE_CONTROL}
                />
              </label>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={ocupado || i === 0}
                  title="Mover a la izquierda"
                  aria-label={`Mover ${logo.etiqueta} a la izquierda`}
                  onClick={() =>
                    accion(() => adminApi.actualizarLogo(logo.id, { direccion: "IZQUIERDA" }))
                  }
                  className="rounded-lg border border-borde px-3 py-2 text-sm hover:bg-fondo disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  disabled={ocupado || i === logos.length - 1}
                  title="Mover a la derecha"
                  aria-label={`Mover ${logo.etiqueta} a la derecha`}
                  onClick={() =>
                    accion(() => adminApi.actualizarLogo(logo.id, { direccion: "DERECHA" }))
                  }
                  className="rounded-lg border border-borde px-3 py-2 text-sm hover:bg-fondo disabled:opacity-30"
                >
                  →
                </button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => accion(() => adminApi.borrarLogo(logo.id))}
                  className="ml-2 rounded-lg border border-borde px-3 py-2 text-sm text-error hover:bg-error-suave disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>

              <p className="w-full text-xs text-texto-suave">{logo.nombre}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={entradaArchivo}
          type="file"
          accept="image/svg+xml,image/png,image/webp"
          /// `sr-only` y no `hidden`: con `display:none` el
          /// input deja de recibir el foco y no hay forma de
          /// llegar al campo con el teclado.
          className="sr-only"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            if (archivo) {
              const etiqueta = archivo.name.replace(/\.[^.]+$/, "");
              void accion(() => adminApi.subirLogo(archivo, etiqueta, formularioId));
            }
            e.target.value = "";
          }}
        />
        <Boton
          type="button"
          disabled={ocupado || logos.length >= MAXIMO_LOGOS}
          onClick={() => entradaArchivo.current?.click()}
        >
          Añadir logo
        </Boton>
        <span className="text-sm text-texto-suave">
          {logos.length} de {MAXIMO_LOGOS}
          {logos.length >= MAXIMO_LOGOS && " · quite uno para añadir otro"}
        </span>
      </div>
    </div>
  );
}
