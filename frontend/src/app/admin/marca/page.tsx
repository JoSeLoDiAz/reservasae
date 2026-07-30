"use client";

import { useEffect, useRef, useState } from "react";

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
import {
  contraste,
  nivelContraste,
  type CatalogoColores,
  type ColoresTema,
  type Esquema,
} from "@/lib/tema";

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
  const colores = marca.temas[pestana];

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
        <div className="inline-flex rounded-lg border border-borde p-0.5">
          {(["CLARO", "OSCURO"] as const).map((esquema) => (
            <button
              key={esquema}
              type="button"
              onClick={() => setPestana(esquema)}
              className={`rounded-md px-4 py-1.5 text-sm transition ${
                pestana === esquema
                  ? "bg-marca-suave font-medium text-marca"
                  : "text-texto-suave hover:text-texto"
              }`}
            >
              {esquema === "CLARO" ? "Modo claro" : "Modo oscuro"}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-7">
          {catalogo.grupos.map((grupo) => {
            const tokens = catalogo.tokens.filter((t) => t.grupo === grupo.clave);
            if (!tokens.length) return null;
            return (
              <div key={grupo.clave}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">
                  {grupo.etiqueta}
                </h3>
                <p className="mt-1 text-sm text-texto-suave">{grupo.descripcion}</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {tokens.map((token) => (
                    <Campo key={token.clave} etiqueta={token.etiqueta} ayuda={token.ayuda}>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={colores[token.clave] ?? "#000000"}
                          onChange={(e) => cambiarColor(token.clave, e.target.value)}
                          className="size-10 shrink-0 cursor-pointer rounded border border-borde"
                          aria-label={token.etiqueta}
                        />
                        <input
                          value={colores[token.clave] ?? ""}
                          onChange={(e) => cambiarColor(token.clave, e.target.value)}
                          pattern="#[0-9a-fA-F]{6}"
                          className={`${CLASE_CONTROL} font-mono`}
                        />
                      </div>
                    </Campo>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <VistaPrevia colores={colores} />
        <RevisionContraste colores={colores} catalogo={catalogo} />

        <div className="mt-6 flex flex-wrap gap-3">
          <Boton
            type="button"
            disabled={guardando}
            onClick={() => conError(() => adminApi.actualizarTema(pestana, colores))}
          >
            {guardando
              ? "Guardando…"
              : `Guardar modo ${pestana === "CLARO" ? "claro" : "oscuro"}`}
          </Boton>
          <button
            type="button"
            disabled={guardando}
            onClick={() => conError(() => adminApi.restablecerTema(pestana))}
            className="rounded-lg border border-borde px-5 py-2 text-sm hover:bg-fondo disabled:opacity-50"
          >
            Restablecer este modo
          </button>
        </div>
      </Tarjeta>
    </div>
  );
}

/**
 * La vista previa pinta con los colores que hay en el formulario, aún sin
 * guardar, en vez de usar las variables CSS. Es lo que permite descartar una
 * combinación antes de aplicarla a todo el sitio.
 */
function VistaPrevia({ colores }: { colores: ColoresTema }) {
  const c = (clave: string) => colores[clave] ?? "transparent";

  return (
    <div
      className="mt-8 overflow-hidden rounded-xl border"
      style={{ background: c("fondo"), borderColor: c("borde") }}
    >
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{
          background: c("encabezadoFondo"),
          color: c("encabezadoTexto"),
          borderBottom: `1px solid ${c("encabezadoBorde")}`,
        }}
      >
        <span className="font-semibold">Convoca</span>
        <span className="text-sm opacity-70">Encabezado</span>
      </div>

      <div className="space-y-4 p-5">
        <h4 className="text-xl font-semibold" style={{ color: c("titulo") }}>
          Reserve sus cupos de formación
        </h4>
        <p style={{ color: c("texto") }}>Texto normal de un párrafo del formulario.</p>
        <p className="text-sm" style={{ color: c("textoSuave") }}>
          Texto secundario: las ayudas bajo los campos se ven así.
        </p>

        <div
          className="rounded-lg p-4"
          style={{ background: c("marcaSuave"), color: c("marca") }}
        >
          Zona resaltada, como el resumen de una oferta.
        </div>

        <div
          className="space-y-3 rounded-lg border p-4"
          style={{ background: c("superficie"), borderColor: c("borde") }}
        >
          <div className="flex flex-wrap gap-2">
            {[
              { texto: "Disponible", frente: "exito", fondo: "exitoSuave" },
              { texto: "Últimos cupos", frente: "aviso", fondo: "avisoSuave" },
              { texto: "Completo", frente: "error", fondo: "errorSuave" },
            ].map((e) => (
              <span
                key={e.texto}
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ background: c(e.fondo), color: c(e.frente) }}
              >
                {e.texto}
              </span>
            ))}
          </div>

          <input
            readOnly
            value="Un campo del formulario"
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              background: c("campoFondo"),
              color: c("texto"),
              border: `1px solid ${c("campoBorde")}`,
              outline: `2px solid ${c("campoFoco")}`,
              outlineOffset: "2px",
            }}
          />

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["Curso", "Ubicación", "Cupos"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left font-semibold"
                    style={{
                      background: c("tablaCabeceraFondo"),
                      color: c("tablaCabeceraTexto"),
                      borderBottom: `1px solid ${c("tablaBorde")}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["AF01", "Amazonas", "13"],
                ["AF08", "Medellín", "78"],
                ["AF04", "Cartagena", "39"],
              ].map((fila, i) => (
                <tr
                  key={fila[0]}
                  style={{
                    background: i === 1 ? c("tablaFilaResaltada") : i % 2 ? c("tablaFilaAlterna") : "transparent",
                    color: c("texto"),
                  }}
                >
                  {fila.map((celda) => (
                    <td
                      key={celda}
                      className="px-3 py-2"
                      style={{ borderBottom: `1px solid ${c("tablaBorde")}` }}
                    >
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: c("marca"), color: c("marcaTexto") }}
            >
              Reservar cupos
            </span>
            <span
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: c("marcaFuerte"), color: c("marcaTexto") }}
            >
              Con el ratón encima
            </span>
            <span className="underline" style={{ color: c("marca") }}>
              Un enlace
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Es fácil elegir un gris bonito sobre blanco y dejar el formulario ilegible
 * sin darse cuenta. Esto mide el contraste real de cada par contra el mínimo
 * de la WCAG y lo dice antes de guardar. No bloquea: avisa.
 */
function RevisionContraste({
  colores,
  catalogo,
}: {
  colores: ColoresTema;
  catalogo: CatalogoColores;
}) {
  const resultados = catalogo.comprobacionesContraste.map((c) => {
    const razon = contraste(colores[c.frente] ?? "", colores[c.fondo] ?? "");
    return { ...c, razon, nivel: razon === null ? null : nivelContraste(razon, c.grande) };
  });

  const fallos = resultados.filter((r) => r.nivel === "INSUFICIENTE");

  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">
        Legibilidad
      </h3>
      <p className="mt-1 text-sm text-texto-suave">
        Contraste según la WCAG: mínimo 4,5 para texto normal y 3 para títulos
        grandes.
      </p>

      {fallos.length > 0 && (
        <p className="mt-3 rounded-lg border border-aviso/30 bg-aviso-suave p-3 text-sm text-aviso">
          {fallos.length === 1
            ? "Hay 1 combinación que no se lee bien."
            : `Hay ${fallos.length} combinaciones que no se leen bien.`}{" "}
          Puede guardar igual, pero habrá gente que no consiga leer esa parte.
        </p>
      )}

      <ul className="mt-3 divide-y divide-borde text-sm">
        {resultados.map((r) => (
          <li key={r.descripcion} className="flex items-center justify-between gap-4 py-2">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-grid size-6 shrink-0 place-items-center rounded border border-borde text-[10px] font-bold"
                style={{ background: colores[r.fondo], color: colores[r.frente] }}
              >
                Aa
              </span>
              {r.descripcion}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-texto-suave">
                {r.razon ? `${r.razon.toFixed(1)}:1` : "—"}
              </span>
              <EtiquetaNivel nivel={r.nivel} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EtiquetaNivel({ nivel }: { nivel: string | null }) {
  const estilos: Record<string, string> = {
    AAA: "bg-exito-suave text-exito",
    AA: "bg-exito-suave text-exito",
    "AA-GRANDE": "bg-aviso-suave text-aviso",
    INSUFICIENTE: "bg-error-suave text-error",
  };
  const textos: Record<string, string> = {
    AAA: "Excelente",
    AA: "Correcto",
    "AA-GRANDE": "Solo títulos",
    INSUFICIENTE: "No se lee",
  };
  if (!nivel) return <span className="text-texto-suave">color inválido</span>;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estilos[nivel]}`}>
      {textos[nivel]}
    </span>
  );
}
