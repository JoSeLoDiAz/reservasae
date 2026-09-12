"use client";

import { useEffect, useRef, useState } from "react";

import { Boton, CLASE_CONTROL } from "@/components/admin/marco-admin";
import {
  adminApi,
  ESQUEMAS_DE_LOGO,
  MAXIMO_LOGOS,
  NOMBRE_DEL_ESQUEMA,
  urlLogo,
  type EsquemaDeLogo,
  type Logo,
} from "@/lib/admin-api";
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
          {/* LOS DOS TEMAS, uno al lado del otro.

              Antes se veía una sola fila, la del tema en que
              estuviera el panel, y con logos marcados por tema eso
              esconde justo lo que hay que revisar: si el archivo de
              oscuro se lee sobre el fondo oscuro. La placa de la
              derecha va con el fondo del tema contrario a mano
              —`#0d1614` es el `--fondo` oscuro— porque una
              previsualización que dependa del tema del panel no
              sirve para comprobar el otro. */}
          {(
            [
              ["CLARO", "En tema claro", "#f4f7f5", "#14231f"],
              ["OSCURO", "En tema oscuro", "#0d1614", "#e7efec"],
            ] as const
          ).map(([tema, rotulo, fondo, texto]) => {
            const deEsteTema = mostrados.filter(
              (l) => l.esquema === "AMBOS" || l.esquema === tema,
            );
            return (
              <div key={tema} className="mb-3 last:mb-0">
                <p className="mb-1 text-xs text-texto-suave">{rotulo}</p>
                <div
                  className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg px-4 py-3"
                  style={{ background: fondo, color: texto }}
                >
                  {deEsteTema.length === 0 ? (
                    <span className="text-sm opacity-70">
                      Ningún logo sale en este tema.
                    </span>
                  ) : (
                    deEsteTema.map((logo) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={logo.id}
                        src={urlLogo(logo)}
                        alt={logo.etiqueta}
                        /// La misma altura que en la cabecera de
                        /// verdad (`LogosDelGremio`): lo que se ve
                        /// aquí es lo que se publica.
                        className="h-16 w-auto max-w-[14rem] object-contain"
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
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

              {/* EN QUÉ TEMA SALE.

                  Un logo institucional es un archivo cerrado: el de
                  ADECOPRIA lleva el nombre en negro y sobre el
                  fondo oscuro no se lee. Aquí se sube la versión
                  de texto oscuro marcada «Solo en claro» y la de
                  texto blanco marcada «Solo en oscuro», y cada una
                  sale cuando le toca. Lo normal es dejarlo en «Los
                  dos temas»: un logo sin texto aguanta los dos
                  fondos y no hay que subir nada dos veces. */}
              <label className="min-w-40">
                <span className="mb-1 block text-xs text-texto-suave">
                  ¿En qué tema sale?
                </span>
                <select
                  value={logo.esquema}
                  disabled={ocupado}
                  onChange={(e) =>
                    accion(() =>
                      adminApi.actualizarLogo(logo.id, {
                        esquema: e.target.value as EsquemaDeLogo,
                      }),
                    )
                  }
                  className={CLASE_CONTROL}
                >
                  {ESQUEMAS_DE_LOGO.map((valor) => (
                    <option key={valor} value={valor}>
                      {NOMBRE_DEL_ESQUEMA[valor]}
                    </option>
                  ))}
                </select>
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
                  className="rounded-lg border border-borde px-3 py-2 text-sm transition hover:bg-fondo disabled:opacity-30"
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
                  className="rounded-lg border border-borde px-3 py-2 text-sm transition hover:bg-fondo disabled:opacity-30"
                >
                  →
                </button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => accion(() => adminApi.borrarLogo(logo.id))}
                  className="ml-2 rounded-lg border border-borde px-3 py-2 text-sm text-error transition hover:bg-error-suave disabled:opacity-50"
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
