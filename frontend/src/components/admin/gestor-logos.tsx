"use client";

import { useEffect, useRef, useState } from "react";

import { Boton, CLASE_CONTROL } from "@/components/admin/marco-admin";
import { useMarca } from "@/components/marca-publica";
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
import { esFondoOscuro, variantesParaElFondo } from "@/lib/logos-por-fondo";
import type { ColoresTema, Esquema } from "@/lib/tema";

type Props = {
  /** Sin él, los de la marca general. */
  formularioId?: string;
  /** Los generales, para poder enseñar qué se hereda. */
  heredados?: Logo[];
  /** La paleta con la que se previsualiza. */
  temas?: Record<Esquema, ColoresTema>;
  alCambiar?: (logos: Logo[]) => void;
};

/** Hasta tres logos, en orden de cabecera. */
export function GestorLogos({ formularioId, heredados, temas, alCambiar }: Props) {
  const { marca } = useMarca();
  const [logos, setLogos] = useState<Logo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  /// Con que tema entra el proximo. `AMBOS` de salida: es lo que
  /// aguanta un logo sin texto, que es el caso normal.
  const [esquemaNuevo, setEsquemaNuevo] = useState<EsquemaDeLogo>("AMBOS");
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
  /// La del ámbito que se edita; la general de respaldo.
  const paleta = temas ?? marca?.temas ?? null;

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

      {mostrados.length > 0 && paleta && (
        <div className="rounded-lg border border-borde bg-fondo p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-texto-suave">
            Así se ven, sobre los fondos de verdad
          </p>
          {/* LOS DOS SITIOS DONDE SALEN, Y NO SON EL MISMO FONDO.

              Antes esta placa se pintaba sobre el `--fondo` de
              cada tema --casi blanco y casi negro--, y ahí el
              logo se elegía por el TEMA. La cabecera del panel
              no funciona así: se pinta sobre `encabezadoFondo`,
              que el gremio elige, y la variante sale de la
              CLARIDAD DE ESA FRANJA. Con las dos franjas
              oscuras --el caso de esta casa: #702482 en claro y
              #3b1644 en oscuro-- la previsualización enseñaba
              el logo de texto negro sobre blanco en «tema
              claro» y la cabecera de verdad enseñaba el blanco.
              O sea que decía lo contrario de lo que pasaba.

              Va la misma regla que la cabecera --el módulo es
              uno-- y va el color de verdad, sacado de la paleta
              que se está editando. */}
          <p className="mb-3 text-xs text-texto-suave">
            El panel elige la versión por la claridad de la franja, no por el
            tema. El sitio público sí va por el tema.
          </p>
          {(["CLARO", "OSCURO"] as const).map((tema) => {
            const c = paleta[tema] ?? {};
            const franja = c.encabezadoFondo ?? "#ffffff";
            const placas = [
              {
                clave: "panel",
                rotulo: "Panel · franja del encabezado",
                fondo: franja,
                texto: c.encabezadoTexto ?? "#0f172a",
                logos: variantesParaElFondo(mostrados, esFondoOscuro(franja)),
                placaBlanca: false,
              },
              {
                clave: "publico",
                rotulo: "Sitio público · tarjeta",
                fondo: c.superficie ?? "#ffffff",
                texto: c.texto ?? "#0f172a",
                logos: mostrados.filter(
                  (l) => l.esquema === "AMBOS" || l.esquema === tema,
                ),
                /// Lo mismo que hace la cabecera pública.
                placaBlanca:
                  tema === "OSCURO" &&
                  !mostrados.some((l) => l.esquema === "OSCURO"),
              },
            ];
            return (
              <div key={tema} className="mb-4 last:mb-0">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-texto-suave">
                  {tema === "CLARO" ? "Tema claro" : "Tema oscuro"}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {placas.map((placa) => (
                    <div key={placa.clave}>
                      <p className="mb-1 text-xs text-texto-suave">{placa.rotulo}</p>
                      <div
                        className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg px-4 py-3"
                        style={{ background: placa.fondo, color: placa.texto }}
                      >
                        {placa.logos.length === 0 ? (
                          <span className="text-sm opacity-70">
                            Ningún logo sale aquí.
                          </span>
                        ) : (
                          placa.logos.map((logo) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={logo.id}
                              src={urlLogo(logo)}
                              alt={logo.etiqueta}
                              /// La altura de la cabecera de verdad.
                              className={`h-16 w-auto max-w-[14rem] object-contain ${
                                placa.placaBlanca
                                  ? "rounded bg-white px-2 py-1"
                                  : ""
                              }`}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  ))}
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

      <div className="flex flex-wrap items-end gap-3">
        {/* EL TEMA SE ELIGE ANTES DE SUBIR, no despues.
            Subiendo primero y corrigiendo en la lista, un logo de
            texto blanco sale un rato en el tema claro -- donde es
            justo invisible--, que es el problema que este campo
            existe para quitar. */}
        <label className="min-w-44">
          <span className="mb-1 block text-xs text-texto-suave">
            El que suba, ¿en qué tema sale?
          </span>
          <select
            value={esquemaNuevo}
            disabled={ocupado}
            onChange={(e) => setEsquemaNuevo(e.target.value as EsquemaDeLogo)}
            className={CLASE_CONTROL}
          >
            {ESQUEMAS_DE_LOGO.map((valor) => (
              <option key={valor} value={valor}>
                {NOMBRE_DEL_ESQUEMA[valor]}
              </option>
            ))}
          </select>
        </label>

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
              void accion(() =>
                adminApi.subirLogo(archivo, etiqueta, formularioId, esquemaNuevo),
              );
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
