"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EditorColores } from "@/components/admin/editor-colores";
import {
  AparienciaHeredada,
  type Propios,
} from "@/components/admin/apariencia-heredada";
import { GestorLogos } from "@/components/admin/gestor-logos";
import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  Tarjeta,
} from "@/components/admin/marco-admin";
import { useMarca } from "@/components/marca-publica";
import {
  adminApi,
  type Marca,
  type MarcaDeGremio,
  type ModoPorDefecto,
} from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import { formulariosApi } from "@/lib/formularios-api";
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
  /// Si se entro por la direccion de un gremio.
  ///
  /// Aqui manda porque lo que esta pantalla edita es la marca
  /// GENERAL, y eso desde la puerta de un gremio significaria
  /// cambiarsela a los dos.
  const [gremio, setGremio] = useState<{
    fijo: boolean;
    sigla: string | null;
    formularioId: string | null;
    /// La paleta propia del formulario que le da la cara.
    /// Solo las claves que difieren: es lo que la herencia
    /// necesita y lo unico que hay guardado.
    propios: Propios;
  } | null>(null);
  const [pestana, setPestana] = useState<Esquema>("CLARO");
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void adminApi.marca().then(setMarca);
    void adminApi
      .yo()
      .then(async (yo) => {
        if (!yo.gremioFijo) {
          setGremio({
            fijo: false,
            sigla: null,
            formularioId: null,
            propios: { CLARO: {}, OSCURO: {} },
          });
          return;
        }

        const suyos = await adminApi.marcaDeGremios().catch(() => []);
        const mio = suyos[0];
        const suId = mio?.formularioMarcaId ?? null;

        // su paleta no viene en marcaDeGremios
        const suyo = suId
          ? await formulariosApi.obtener(suId).catch(() => null)
          : null;

        setGremio({
          fijo: true,
          sigla: mio?.sigla ?? null,
          formularioId: suId,
          propios: {
            CLARO: suyo?.coloresClaro ?? {},
            OSCURO: suyo?.coloresOscuro ?? {},
          },
        });
      })
      .catch(() => setGremio(null));
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
          {gremio?.fijo
            ? "Esta es la marca GENERAL, la que comparten los dos gremios. La de este gremio se edita en su formulario."
            : "Colores, textos y logo. Al guardar se aplican en todo el sistema, también en este panel."}
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {guardado && !error && <Aviso tipo="exito">Cambios guardados.</Aviso>}

      <MarcaDeCadaGremio />

      {gremio?.fijo ? (
        gremio.formularioId ? (
          /// El editor del gremio, aqui mismo.
          ///
          /// Es el MISMO componente que usa la apariencia del
          /// formulario, no una copia: el calculo de que se
          /// aparta de la general vive ahi dentro, y dos
          /// implementaciones del mismo diff acabarian
          /// guardando las 37 claves en una de las dos.
          <AparienciaHeredada
            key={gremio.formularioId}
            formularioId={gremio.formularioId}
            general={marca}
            iniciales={gremio.propios}
            tituloLogos={`Logos de ${gremio.sigla ?? "este gremio"}`}
            tituloColores={`Colores de ${gremio.sigla ?? "este gremio"}`}
            descripcionLogos="Hasta tres, uno por entidad: las del convenio más la capacitadora. Sin ninguno propio se muestran los generales. SVG, PNG o WebP con fondo transparente, máximo 1 MB cada uno; se ven a 80 px de alto."
          />
        ) : (
          <Tarjeta titulo="La apariencia de este gremio">
            <AvisoDeGremio gremio={gremio} que="los logos y los colores" />
          </Tarjeta>
        )
      ) : (
        <Tarjeta
          titulo="Logos de la cabecera"
          descripcion="Hasta tres, uno por entidad. SVG, PNG o WebP con fondo transparente, máximo 1 MB cada uno. Se muestran a 80 px de alto, así que conviene entregarlos a 960 × 288 px o mayor, o en SVG. JPG no sirve: no tiene transparencia y deja un recuadro blanco."
        >
          <GestorLogos />
        </Tarjeta>
      )}

      {gremio?.fijo ? (
        <Tarjeta titulo="Textos y colores del sitio">
          <AvisoDeGremio gremio={gremio} que="los textos y los colores" />
        </Tarjeta>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

/**
 * De qué formulario sale la marca de cada gremio.
 *
 * La apariencia solo existe a nivel de formulario, así que hay
 * que decir cuál de ellos le da su cara al subdominio. Va aquí
 * y no en la apariencia de cada formulario porque es una
 * decisión del gremio: hace falta ver los dos a la vez para
 * saber cuál está puesto.
 */
function MarcaDeCadaGremio() {
  const { recargar } = useMarca();
  const [gremios, setGremios] = useState<MarcaDeGremio[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    void adminApi
      .marcaDeGremios()
      .then(setGremios)
      /// Un no aquí solo quiere decir que esta cuenta no es
      /// superadmin: la tarjeta desaparece y no estorba.
      .catch(() => setGremios([]));
  }, []);

  if (!gremios || gremios.length === 0) return null;

  async function elegir(convenioId: string, formularioId: string) {
    setError(null);
    setOcupado(convenioId);
    try {
      setGremios(
        await adminApi.fijarMarcaDeGremio(convenioId, formularioId || null),
      );
      // el panel se repinta con la marca nueva
      await recargar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Tarjeta
      titulo="La cara de cada gremio"
      descripcion="Cada gremio entra por su propia dirección, y allí el sitio sale con los colores y los logos de uno de sus formularios. Aquí se elige cuál. Sin elegir ninguno, ese gremio usa la marca general de abajo."
    >
      <div className="space-y-4">
        {error && <Aviso tipo="error">{error}</Aviso>}

        {gremios.map((g) => (
          <div
            key={g.id}
            className="rounded-xl border border-linea bg-superficie-alt p-4"
          >
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-semibold">{g.sigla ?? g.nombre}</span>
              <code className="text-xs text-texto-suave">{g.direccion}</code>
            </div>

            {g.formularios.length === 0 ? (
              <p className="text-sm text-texto-suave">
                Este gremio todavía no tiene formularios, así que usa la marca
                general.
              </p>
            ) : (
              <Campo
                etiqueta="Formulario que le da la marca"
                ayuda="Vale también uno en borrador: publicar al público y elegir la paleta del panel son dos decisiones distintas."
              >
                <select
                  value={g.formularioMarcaId ?? ""}
                  disabled={ocupado === g.id}
                  onChange={(e) => void elegir(g.id, e.target.value)}
                  className={CLASE_CONTROL}
                >
                  <option value="">La marca general</option>
                  {g.formularios.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.titulo}
                      {f.publicado ? "" : " (borrador)"}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>
        ))}
      </div>
    </Tarjeta>
  );
}

/**
 * Por la puerta de un gremio, esto no se edita aquí.
 *
 * Lo que estos bloques escriben es la marca general -- una
 * sola fila de `marca`, una sola de `temas` y los logos con
 * `formularioId = null` -- así que editarla desde la dirección
 * de un gremio se la cambiaría a los dos. Eso es exactamente
 * el fallo que reportó el cliente: un logo subido entrando por
 * ADECOPRIA salía también en BRITCHAM.
 *
 * No lleva enlace a ninguna parte: la apariencia del gremio ya
 * está en esta misma pantalla, arriba. Un enlace que se va a
 * otro sitio para hacer lo que se puede hacer aquí es peor que
 * ninguno.
 */
function AvisoDeGremio({
  gremio,
  que,
}: {
  gremio: { sigla: string | null; formularioId: string | null };
  que: string;
}) {
  const nombre = gremio.sigla ?? "este gremio";

  if (!gremio.formularioId) {
    return (
      <div className="rounded-xl border border-aviso/30 bg-aviso-suave p-4 text-sm text-aviso">
        <p className="font-medium">{nombre} todavía no tiene una cara propia.</p>
        <p className="mt-1">
          Elija arriba de qué formulario sale su marca. Hasta entonces usa la
          general, y lo que se cambie aquí lo verían los dos gremios.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-linea bg-superficie-alt p-4 text-sm">
      <p>
        Esto es lo <strong>general</strong>, lo que comparten los dos gremios, y
        por eso no se edita desde aquí. Lo de {nombre} está arriba.
      </p>
    </div>
  );
}
