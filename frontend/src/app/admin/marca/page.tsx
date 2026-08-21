"use client";

import { useEffect, useState } from "react";

import { EditorColores } from "@/components/admin/editor-colores";
import { GestorLogos } from "@/components/admin/gestor-logos";
import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  Tarjeta,
} from "@/components/admin/marco-admin";
import { useMarca } from "@/components/marca-publica";
import { adminApi, type Marca, type ModoPorDefecto } from "@/lib/admin-api";
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

  // plantilla o derivacion: cambia todo
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
      // repintar el panel con los colores nuevos
      await recargar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Apariencia</h1>
        <p className="mt-1 text-texto-suave">
          Colores, textos y logo. Al guardar se aplican en todo el sistema,
          también en este panel.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {guardado && !error && <Aviso tipo="exito">Cambios guardados.</Aviso>}

      <Tarjeta
        titulo="Logos de la cabecera"
        descripcion="Hasta tres, uno por entidad. SVG, PNG o WebP con fondo transparente, máximo 1 MB cada uno. Se muestran a 80 px de alto, así que conviene entregarlos a 960 × 288 px o mayor, o en SVG. JPG no sirve: no tiene transparencia y deja un recuadro blanco."
      >
        <GestorLogos />
      </Tarjeta>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void conError(() =>
            adminApi.actualizarMarca({
              nombreApp: marca.nombreApp,
              tituloPublico: marca.tituloPublico,
              subtituloPublico: marca.subtituloPublico,
              mensajeEncabezado: marca.mensajeEncabezado ?? "",
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
                className="rounded-xl border border-borde px-5 py-2 text-sm hover:bg-fondo disabled:opacity-50"
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
