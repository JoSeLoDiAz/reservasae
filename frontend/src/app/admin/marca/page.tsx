"use client";

import { useEffect, useRef, useState } from "react";

import { EditorColores } from "@/components/admin/editor-colores";
import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  Tarjeta,
} from "@/components/admin/marco-admin";
import { useMarca } from "@/components/marca-publica";
import { adminApi, urlLogo, type Marca, type ModoPorDefecto } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import type { ColoresTema, Esquema } from "@/lib/tema";

const MODOS: Array<{ valor: ModoPorDefecto; etiqueta: string; ayuda: string }> = [
  {
    valor: "SISTEMA",
    etiqueta: "Según el dispositivo",
    ayuda: "Respeta la preferencia de quien entra. Es lo que espera la mayoría.",
  },
  { valor: "CLARO", etiqueta: "Siempre claro", ayuda: "Arranca en claro aunque el dispositivo pida oscuro." },
  { valor: "OSCURO", etiqueta: "Siempre oscuro", ayuda: "Arranca en oscuro aunque el dispositivo pida claro." },
];

export default function PaginaMarca() {
  const { recargar } = useMarca();
  const [marca, setMarca] = useState<Marca | null>(null);
  const [pestana, setPestana] = useState<Esquema>("CLARO");
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const entradaArchivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void adminApi.marca().then(setMarca);
  }, []);

  if (!marca) return <p className="text-texto-suave">Cargando…</p>;

  const catalogo = marca.catalogoColores;

  function cambiarCampo<C extends keyof Marca>(campo: C, valor: Marca[C]) {
    setMarca((p) => (p ? { ...p, [campo]: valor } : p));
    setGuardado(false);
  }

  function cambiarColor(clave: string, valor: string) {
    setMarca((p) =>
      p
        ? { ...p, temas: { ...p.temas, [pestana]: { ...p.temas[pestana], [clave]: valor } } }
        : p,
    );
    setGuardado(false);
  }

  // plantilla o derivacion: cambian los dos modos a la vez
  function reemplazarTemas(temas: Record<Esquema, ColoresTema>) {
    setMarca((p) => (p ? { ...p, temas } : p));
    setGuardado(false);
  }

  async function conError(accion: () => Promise<Marca>) {
    setError(null);
    setGuardando(true);
    try {
      setMarca(await accion());
      setGuardado(true);
      // Refresca el proveedor para que el propio panel se repinte con los
      // colores recién guardados: es la mejor comprobación de que funcionan.
      await recargar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setGuardando(false);
    }
  }

  const logo = urlLogo(marca);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Apariencia</h1>
        <p className="mt-1 text-texto-suave">
          Colores, textos y logo. Al guardar se aplican en todo el sistema,
          también en este panel.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {guardado && !error && <Aviso tipo="exito">Cambios guardados.</Aviso>}

      <Tarjeta
        titulo="Logo"
        descripcion="SVG, PNG o WebP con fondo transparente. Máximo 1 MB. Se muestra a unos 40 px de alto, así que conviene entregarlo a 480 × 144 px o mayor. JPG no sirve: no tiene transparencia y deja un recuadro blanco."
      >
        <div className="flex flex-wrap items-center gap-6">
          <div className="grid h-24 w-56 place-items-center rounded-lg border border-dashed border-borde bg-fondo p-3">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Logo actual" className="max-h-full max-w-full" />
            ) : (
              <span className="text-sm text-texto-suave">Sin logo</span>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <input
              ref={entradaArchivo}
              type="file"
              accept="image/svg+xml,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) void conError(() => adminApi.subirLogo(archivo));
                e.target.value = "";
              }}
            />
            <Boton type="button" onClick={() => entradaArchivo.current?.click()}>
              {logo ? "Reemplazar logo" : "Subir logo"}
            </Boton>
            {logo && (
              <button
                type="button"
                onClick={() => conError(() => adminApi.borrarLogo())}
                className="rounded-lg border border-borde px-5 py-2 text-sm hover:bg-fondo"
              >
                Quitar
              </button>
            )}
          </div>
        </div>
        {marca.logoNombre && (
          <p className="mt-3 text-xs text-texto-suave">Archivo: {marca.logoNombre}</p>
        )}
      </Tarjeta>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void conError(() =>
            adminApi.actualizarMarca({
              nombreApp: marca.nombreApp,
              tituloPublico: marca.tituloPublico,
              subtituloPublico: marca.subtituloPublico,
              piePagina: marca.piePagina ?? "",
              modoPorDefecto: marca.modoPorDefecto,
              permitirCambioDeModo: marca.permitirCambioDeModo,
            }),
          );
        }}
        className="space-y-6"
      >
        <Tarjeta titulo="Textos del sitio público">
          <div className="space-y-4">
            <Campo etiqueta="Nombre de la aplicación" ayuda="Pestaña del navegador y encabezado.">
              <input
                required
                value={marca.nombreApp}
                onChange={(e) => cambiarCampo("nombreApp", e.target.value)}
                className={CLASE_CONTROL}
              />
            </Campo>

            <Campo etiqueta="Título principal">
              <input
                required
                value={marca.tituloPublico}
                onChange={(e) => cambiarCampo("tituloPublico", e.target.value)}
                className={CLASE_CONTROL}
              />
            </Campo>

            <Campo etiqueta="Texto de introducción">
              <textarea
                rows={3}
                value={marca.subtituloPublico}
                onChange={(e) => cambiarCampo("subtituloPublico", e.target.value)}
                className={CLASE_CONTROL}
              />
            </Campo>

            <Campo etiqueta="Pie de página" ayuda="Opcional.">
              <input
                value={marca.piePagina ?? ""}
                onChange={(e) => cambiarCampo("piePagina", e.target.value)}
                className={CLASE_CONTROL}
              />
            </Campo>
          </div>
        </Tarjeta>

        <Tarjeta
          titulo="Modo claro y oscuro"
          descripcion="Qué ve quien entra por primera vez, y si puede cambiarlo."
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {MODOS.map((m) => (
                <label
                  key={m.valor}
                  className={`cursor-pointer rounded-lg border p-4 transition ${
                    marca.modoPorDefecto === m.valor
                      ? "border-marca bg-marca-suave"
                      : "border-borde hover:border-marca/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="modo"
                    className="sr-only"
                    checked={marca.modoPorDefecto === m.valor}
                    onChange={() => cambiarCampo("modoPorDefecto", m.valor)}
                  />
                  <p className="font-medium">{m.etiqueta}</p>
                  <p className="mt-1 text-sm text-texto-suave">{m.ayuda}</p>
                </label>
              ))}
            </div>

            <label className="flex gap-3 text-sm">
              <input
                type="checkbox"
                checked={marca.permitirCambioDeModo}
                onChange={(e) => cambiarCampo("permitirCambioDeModo", e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--marca)]"
              />
              <span>
                Permitir que el visitante cambie entre claro y oscuro.
                <span className="mt-0.5 block text-texto-suave">
                  Si lo desactiva desaparece el conmutador. Quítelo solo si hace
                  falta: para bastante gente el modo oscuro no es un gusto sino
                  una necesidad.
                </span>
              </span>
            </label>
          </div>
        </Tarjeta>

        <Boton type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar textos y modo"}
        </Boton>
      </form>

      <Tarjeta
        titulo="Colores"
        descripcion="Cada modo tiene su paleta completa. No basta con aclarar u oscurecer la otra: en modo oscuro un color de marca muy saturado deslumbra y hace vibrar los bordes del texto."
      >
        <EditorColores
          temas={marca.temas}
          catalogo={catalogo}
          esquema={pestana}
          alCambiarEsquema={setPestana}
          alCambiarColor={cambiarColor}
          alReemplazarTemas={reemplazarTemas}
          acciones={
            <div className="flex flex-wrap gap-3">
              {/* los dos modos juntos: una plantilla cambia ambos */}
              <Boton
                type="button"
                disabled={guardando}
                onClick={() =>
                  conError(async () => {
                    await adminApi.actualizarTema("CLARO", marca.temas.CLARO);
                    return adminApi.actualizarTema("OSCURO", marca.temas.OSCURO);
                  })
                }
              >
                {guardando ? "Guardando…" : "Guardar colores"}
              </Boton>
              <button
                type="button"
                disabled={guardando}
                onClick={() =>
                  conError(async () => {
                    await adminApi.restablecerTema("CLARO");
                    return adminApi.restablecerTema("OSCURO");
                  })
                }
                className="rounded-lg border border-borde px-5 py-2 text-sm hover:bg-fondo disabled:opacity-50"
              >
                Restablecer los colores
              </button>
            </div>
          }
        />
      </Tarjeta>
    </div>
  );
}
