"use client";

import { useEffect, useRef, useState } from "react";

import { Campo, CLASE_CONTROL } from "@/components/admin/marco-admin";
import { adminApi, type PlantillaTema } from "@/lib/admin-api";
import {
  contraste,
  nivelContraste,
  type CatalogoColores,
  type ColoresTema,
  type Esquema,
} from "@/lib/tema";

const ESQUEMAS: Esquema[] = ["CLARO", "OSCURO"];

export type Herencia = {
  /** Claves propias de este formulario. */
  sobreescritos: Record<Esquema, string[]>;
  alHeredarClave: (esquema: Esquema, clave: string) => void;
  alHeredarTodo: () => void;
};

type Props = {
  temas: Record<Esquema, ColoresTema>;
  catalogo: CatalogoColores;
  esquema: Esquema;
  alCambiarEsquema: (esquema: Esquema) => void;
  /** Un color suelto del esquema visible. */
  alCambiarColor: (clave: string, valor: string) => void;
  /** Las dos paletas de golpe. */
  alReemplazarTemas: (temas: Record<Esquema, ColoresTema>) => void;
  herencia?: Herencia;
  acciones?: React.ReactNode;
};

export function EditorColores({
  temas,
  catalogo,
  esquema,
  alCambiarEsquema,
  alCambiarColor,
  alReemplazarTemas,
  herencia,
  acciones,
}: Props) {
  const colores = temas[esquema];
  const propios = new Set(herencia?.sobreescritos[esquema] ?? []);
  const totalPropios = herencia
    ? new Set(ESQUEMAS.flatMap((e) => herencia.sobreescritos[e])).size
    : 0;

  return (
    <div className="space-y-8">
      {herencia && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borde bg-superficie-alterna p-4 text-sm">
          <span>
            {totalPropios === 0
              ? "Este formulario usa la apariencia general."
              : `Este formulario cambia ${totalPropios} de ${catalogo.tokens.length} colores.`}
          </span>
          {totalPropios > 0 && (
            <button
              type="button"
              onClick={herencia.alHeredarTodo}
              className="rounded-lg border border-borde px-3 py-1.5 hover:bg-fondo"
            >
              Volver a heredar todo
            </button>
          )}
        </div>
      )}

      <Plantillas alElegir={alReemplazarTemas} />
      <ColorPrincipal actual={colores.marca} alDerivar={alReemplazarTemas} />

      <div className="inline-flex rounded-lg border border-borde p-0.5">
        {ESQUEMAS.map((valor) => (
          <button
            key={valor}
            type="button"
            onClick={() => alCambiarEsquema(valor)}
            className={`rounded-md px-4 py-1.5 text-sm transition ${
              esquema === valor
                ? "bg-marca-suave font-medium text-marca"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            {valor === "CLARO" ? "Modo claro" : "Modo oscuro"}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-start">
        <div className="space-y-8">
          <details className="rounded-lg border border-borde">
            <summary className="cursor-pointer select-none px-4 py-3 font-medium">
              Ajustar los {catalogo.tokens.length} colores uno a uno
            </summary>
            <div className="space-y-7 border-t border-borde p-4">
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
                        <Campo
                          key={token.clave}
                          etiqueta={token.etiqueta}
                          ayuda={token.ayuda}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={colores[token.clave] ?? "#000000"}
                              onChange={(e) => alCambiarColor(token.clave, e.target.value)}
                              className="size-10 shrink-0 cursor-pointer rounded border border-borde"
                              aria-label={token.etiqueta}
                            />
                            <input
                              value={colores[token.clave] ?? ""}
                              onChange={(e) => alCambiarColor(token.clave, e.target.value)}
                              pattern="#[0-9a-fA-F]{6}"
                              className={`${CLASE_CONTROL} font-mono`}
                            />
                          </div>
                          {herencia && (
                            <InsigniaHerencia
                              propio={propios.has(token.clave)}
                              alHeredar={() => herencia.alHeredarClave(esquema, token.clave)}
                            />
                          )}
                        </Campo>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        </div>

        <div className="lg:sticky lg:top-6">
          <VistaPrevia colores={colores} />
        </div>
      </div>

      <RevisionContraste
        colores={colores}
        catalogo={catalogo}
        alCorregir={async () => {
          const corregidos = await adminApi.corregirContraste(colores);
          alReemplazarTemas({ ...temas, [esquema]: corregidos });
        }}
      />

      {acciones}
    </div>
  );
}

function InsigniaHerencia({
  propio,
  alHeredar,
}: {
  propio: boolean;
  alHeredar: () => void;
}) {
  if (!propio) {
    return (
      <span className="mt-1 inline-block text-xs text-texto-suave">
        Heredado de la apariencia general
      </span>
    );
  }
  return (
    <span className="mt-1 inline-flex items-center gap-2 text-xs">
      <span className="whitespace-nowrap font-semibold text-marca">
        Propio
      </span>
      <button type="button" onClick={alHeredar} className="underline text-texto-suave">
        Volver a heredar
      </button>
    </span>
  );
}

// plantillas

function Plantillas({
  alElegir,
}: {
  alElegir: (temas: Record<Esquema, ColoresTema>) => void;
}) {
  const [plantillas, setPlantillas] = useState<PlantillaTema[] | null>(null);

  useEffect(() => {
    void adminApi.plantillas().then(setPlantillas).catch(() => setPlantillas([]));
  }, []);

  if (!plantillas?.length) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">
        Empiece por una combinación
      </h3>
      <p className="mt-1 text-sm text-texto-suave">
        Todas están comprobadas: ningún texto queda por debajo del contraste
        mínimo. Después puede retocar lo que quiera.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {plantillas.map((p) => (
          <button
            key={p.clave}
            type="button"
            onClick={() => alElegir(p.temas)}
            className="rounded-lg border border-borde p-3 text-left transition hover:border-marca"
          >
            <MuestraPlantilla colores={p.temas.CLARO} />
            <p className="mt-2 font-medium">{p.nombre}</p>
            <p className="text-sm text-texto-suave">{p.descripcion}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function MuestraPlantilla({ colores }: { colores: ColoresTema }) {
  return (
    <div
      className="overflow-hidden rounded border"
      style={{ background: colores.fondo, borderColor: colores.borde }}
      aria-hidden
    >
      <div
        className="h-4"
        style={{
          background: colores.encabezadoFondo,
          borderBottom: `1px solid ${colores.encabezadoBorde}`,
        }}
      />
      <div className="flex items-center gap-1.5 p-2">
        <span
          className="rounded px-2 py-0.5 text-[10px] font-medium"
          style={{ background: colores.marca, color: colores.marcaTexto }}
        >
          Botón
        </span>
        {["exito", "aviso", "error"].map((estado) => (
          <span
            key={estado}
            className="size-3 rounded-full"
            style={{ background: colores[estado] }}
          />
        ))}
      </div>
    </div>
  );
}

// color principal

/** Un color y de ahí salen los 28. */
function ColorPrincipal({
  actual,
  alDerivar,
}: {
  actual: string;
  alDerivar: (temas: Record<Esquema, ColoresTema>) => void;
}) {
  const [color, setColor] = useState(actual);
  const [conColor, setConColor] = useState(false);
  const [ajustado, setAjustado] = useState<string | null>(null);
  const secuencia = useRef(0);
  const derivado = useRef<string | null>(null);
  const montado = useRef(false);

  // sincroniza con el color de fuera
  useEffect(() => {
    if (actual.toLowerCase() !== derivado.current) setColor(actual);
  }, [actual]);

  useEffect(() => {
    // no derivar en el primer render
    if (!montado.current) {
      montado.current = true;
      return;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;

    const id = setTimeout(() => {
      const mia = ++secuencia.current;
      void adminApi
        .derivar(color, conColor)
        .then((temas) => {
          if (mia !== secuencia.current) return;
          derivado.current = temas.CLARO.marca.toLowerCase();
          setAjustado(
            derivado.current === color.toLowerCase() ? null : temas.CLARO.marca,
          );
          alDerivar(temas);
        })
        .catch(() => {});
    }, 200);

    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, conColor]);

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">
        O elija un solo color
      </h3>
      <p className="mt-1 text-sm text-texto-suave">
        El resto de la paleta se calcula a partir de él, en claro y en oscuro, y
        se corrige lo que no se lea.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#1d4ed8"}
          onChange={(e) => setColor(e.target.value)}
          className="size-11 shrink-0 cursor-pointer rounded border border-borde"
          aria-label="Color principal"
        />
        <input
          value={color}
          onChange={(e) => setColor(e.target.value)}
          pattern="#[0-9a-fA-F]{6}"
          className={`${CLASE_CONTROL} max-w-[10rem] font-mono`}
          aria-label="Color principal en hexadecimal"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={conColor}
            onChange={(e) => setConColor(e.target.checked)}
            className="size-4 accent-[var(--marca)]"
          />
          Barra superior del color de la marca
        </label>
      </div>

      {ajustado && (
        <p className="mt-2 flex items-center gap-2 text-sm text-texto-suave">
          <span
            aria-hidden
            className="inline-block size-4 shrink-0 rounded border border-borde"
            style={{ background: ajustado }}
          />
          Se ajustó a <span className="font-mono">{ajustado}</span>: el color
          elegido no llega al contraste mínimo para un enlace sobre fondo claro.
          Los amarillos y los verdes claros salen bastante más oscuros.
        </p>
      )}
    </div>
  );
}

// vista previa

/** Vista previa con los colores sin guardar. */
export function VistaPrevia({ colores }: { colores: ColoresTema }) {
  const c = (clave: string) => colores[clave] ?? "transparent";

  return (
    <div
      className="overflow-hidden rounded-xl border"
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
                    background:
                      i === 1
                        ? c("tablaFilaResaltada")
                        : i % 2
                          ? c("tablaFilaAlterna")
                          : "transparent",
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

// revisión de contraste

/** Mide cada par contra la WCAG. */
export function RevisionContraste({
  colores,
  catalogo,
  alCorregir,
}: {
  colores: ColoresTema;
  catalogo: CatalogoColores;
  alCorregir?: () => Promise<void>;
}) {
  const [corrigiendo, setCorrigiendo] = useState(false);

  const resultados = catalogo.comprobacionesContraste.map((c) => {
    const razon = contraste(colores[c.frente] ?? "", colores[c.fondo] ?? "");
    return { ...c, razon, nivel: razon === null ? null : nivelContraste(razon, c.grande) };
  });

  const fallos = resultados.filter((r) => r.nivel === "INSUFICIENTE");

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">
        Legibilidad
      </h3>
      <p className="mt-1 text-sm text-texto-suave">
        Contraste según la WCAG: mínimo 4,5 para texto normal y 3 para títulos
        grandes.
      </p>

      {fallos.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-aviso/30 bg-aviso-suave p-3 text-sm text-aviso">
          <span>
            {fallos.length === 1
              ? "Hay 1 combinación que no se lee bien."
              : `Hay ${fallos.length} combinaciones que no se leen bien.`}{" "}
            Puede guardar igual, pero habrá gente que no consiga leer esa parte.
          </span>
          {alCorregir && (
            <button
              type="button"
              disabled={corrigiendo}
              onClick={async () => {
                setCorrigiendo(true);
                try {
                  await alCorregir();
                } finally {
                  setCorrigiendo(false);
                }
              }}
              className="shrink-0 rounded-lg border border-aviso/40 px-3 py-1.5 font-medium hover:bg-superficie disabled:opacity-50"
            >
              {corrigiendo
                ? "Corrigiendo…"
                : `Corregir ${fallos.length === 1 ? "el aviso" : `los ${fallos.length} avisos`}`}
            </button>
          )}
        </div>
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
