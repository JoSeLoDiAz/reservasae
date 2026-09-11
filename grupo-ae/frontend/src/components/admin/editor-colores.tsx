"use client";

import { useEffect, useRef, useState } from "react";

import { CLASE_CONTROL } from "@/components/admin/marco-admin";
import { adminApi, type PlantillaTema } from "@/lib/admin-api";
import {
  contraste,
  nivelContraste,
  type CatalogoColores,
  type ColoresTema,
  type Esquema,
  seDistinguen,
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
              className="rounded-lg border border-borde px-3 py-1.5 transition hover:bg-fondo"
            >
              Volver a heredar todo
            </button>
          )}
        </div>
      )}

      <Plantillas alElegir={alReemplazarTemas} />
      <ColorPrincipal actual={colores.marca} alDerivar={alReemplazarTemas} />

      {/* Lo elegido se dice con la LETRA y la regla de 2 px, no
          con un fondo teñido: `--marca-suave` tiene dos sitios y
          solo dos --la entrada activa de la barra lateral y la
          fila de tabla bajo el ratón--, y esta era un tercero. */}
      <div className="border-borde inline-flex gap-6 border-b">
        {ESQUEMAS.map((valor) => (
          <button
            key={valor}
            type="button"
            onClick={() => alCambiarEsquema(valor)}
            className={`dato -mb-px border-b-2 pb-2 transition ${
              esquema === valor
                ? "border-marca text-marca"
                : "hover:text-texto border-transparent text-texto-suave"
            }`}
          >
            {valor === "CLARO" ? "Modo claro" : "Modo oscuro"}
          </button>
        ))}
      </div>

      {/* LA SEGUNDA REGIÓN ÚTIL: la vista previa al LADO, no
          debajo. Es la respuesta correcta al ancho sobrante de
          esta pantalla, y ya estaba: se conserva tal cual.

          Con `gap-8` --antes cero-- porque las dos columnas se
          tocaban y solo las separaba el borde del desplegable. */}
      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-start">
        <div className="space-y-8">
          <details className="rounded-plano border border-borde">
            <summary className="dato cursor-pointer px-4 py-3 select-none">
              Ajustar los {catalogo.tokens.length} colores uno a uno
            </summary>
            <div className="space-y-7 border-t border-borde p-4">
              {catalogo.grupos.map((grupo) => {
                const tokens = catalogo.tokens.filter((t) => t.grupo === grupo.clave);
                if (!tokens.length) return null;
                return (
                  <div key={grupo.clave}>
                    <h3 className="rotulo-bloque">
                      {grupo.etiqueta}
                    </h3>
                    <p className="secundario prosa mt-1">{grupo.descripcion}</p>

                    {/* LOS COLORES, EN REJILLA DENSA.

                        Iban a DOS columnas fijas, así que a 1920
                        cada casilla medía 570 px para escribir
                        `#2052dc`: siete caracteres, unos 62 px de
                        letra. Nueve veces su dato, treinta y nueve
                        veces seguidas, y la paleta entera no cabía
                        en tres pantallas.

                        `auto-fill` con un mínimo de 196: la
                        casilla mide lo que mide su dato y el
                        ancho decide cuántas caben --dos a 640,
                        seis a 1920--. Y las muestras quedan en
                        cuadrícula, que es lo que hace falta para
                        juzgar una paleta: un color no se aprueba
                        solo, se aprueba al lado de los otros. */}
                    <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-x-6 gap-y-4">
                      {tokens.map((token) => (
                        <div key={token.clave}>
                          {/* Ni el rótulo ni la ayuda pasan de un
                              renglón: el texto entero vive en el
                              `title`. Un segundo renglón en una
                              casilla lo es en las treinta y nueve. */}
                          <label
                            className="rotulo-bloque block truncate"
                            title={token.ayuda ? `${token.etiqueta} — ${token.ayuda}` : token.etiqueta}
                            htmlFor={`color-${esquema}-${token.clave}`}
                          >
                            {token.etiqueta}
                          </label>

                          <div className="mt-1.5 flex items-center gap-2">
                            <input
                              type="color"
                              value={colores[token.clave] ?? "#000000"}
                              onChange={(e) => alCambiarColor(token.clave, e.target.value)}
                              className="rounded-plano border-borde size-8 shrink-0 cursor-pointer border"
                              aria-label={token.etiqueta}
                            />
                            {/* Sin `font-mono`: una sola tipografía
                                en el producto, y `tabular-nums` ya
                                alinea los dígitos en columna. */}
                            <input
                              id={`color-${esquema}-${token.clave}`}
                              value={colores[token.clave] ?? ""}
                              onChange={(e) => alCambiarColor(token.clave, e.target.value)}
                              pattern="#[0-9a-fA-F]{6}"
                              className={`${CLASE_CONTROL} min-w-0 tabular-nums`}
                            />
                          </div>

                          {token.ayuda && (
                            <p className="micro mt-1 truncate" title={token.ayuda}>
                              {token.ayuda}
                            </p>
                          )}

                          {herencia && (
                            <InsigniaHerencia
                              propio={propios.has(token.clave)}
                              alHeredar={() => herencia.alHeredarClave(esquema, token.clave)}
                            />
                          )}
                        </div>
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
      <span className="micro mt-1 inline-block">
        Heredado de la apariencia general
      </span>
    );
  }
  return (
    <span className="micro mt-1 inline-flex items-center gap-2">
      <span className="whitespace-nowrap text-marca">
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
      <h3 className="rotulo-bloque">
        Empiece por una combinación
      </h3>
      <p className="secundario prosa mt-1">
        Todas están comprobadas: ningún texto queda por debajo del contraste
        mínimo. Después puede retocar lo que quiera.
      </p>
      {/* Cinco combinaciones a dos columnas dejaban una sola en
          el último renglón, con 1100 px de blanco al lado. Con
          `auto-fill` las cinco caben en una fila a 1920 y se
          comparan de un vistazo, que es para lo que están: se
          elige UNA, y elegir es comparar. */}
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-3">
        {plantillas.map((p) => (
          <button
            key={p.clave}
            type="button"
            onClick={() => alElegir(p.temas)}
            className="rounded-plano border border-borde p-3 text-left transition hover:border-marca"
          >
            <MuestraPlantilla colores={p.temas.CLARO} />
            <p className="dato mt-2">{p.nombre}</p>
            <p className="secundario">{p.descripcion}</p>
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
      <h3 className="rotulo-bloque">
        O elija un solo color
      </h3>
      <p className="secundario prosa mt-1">
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
          className={`${CLASE_CONTROL} max-w-[10rem] tabular-nums`}
          aria-label="Color principal en hexadecimal"
        />
        <label className="dato flex items-center gap-2">
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
        <p className="secundario mt-2 flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block size-4 shrink-0 rounded border border-borde"
            style={{ background: ajustado }}
          />
          Se ajustó a <span className="tabular-nums">{ajustado}</span>: el color
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
        <span className="font-semibold">Grupo AE</span>
        <span className="text-sm opacity-70">Encabezado</span>
      </div>

      <div className="space-y-4 p-5">
        <h4 className="text-xl font-semibold" style={{ color: c("titulo") }}>
          Solicite información de nuestros servicios
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
          {/* La vista previa enseña lo que se va a ver.
              Los tres estados iban aquí como píldoras rellenas,
              y esas ya no existen en ninguna pantalla: el estado
              va en la LETRA. Con la píldora, quien ajustaba el
              color lo juzgaba sobre un fondo teñido que no es el
              que va a tener delante. */}
          <div className="flex flex-wrap gap-4">
            {[
              { texto: "Disponible", frente: "exito" },
              { texto: "Últimos lugares", frente: "aviso" },
              { texto: "Completo", frente: "error" },
            ].map((e) => (
              <span
                key={e.texto}
                className="text-[0.75rem] font-semibold"
                style={{ color: c(e.frente) }}
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
                {["Servicio", "Ubicación", "Disponibilidad"].map((h) => (
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
                ["SV01", "Amazonas", "13"],
                ["SV02", "Medellín", "78"],
                ["SV04", "Cartagena", "39"],
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
              Solicitar información
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

  /// Dos varas de medir, porque son dos preguntas distintas.
  ///
  /// «¿Se LEE?» es texto sobre un fondo, y eso lo contesta la
  /// razon de la WCAG. «¿Se DISTINGUEN?» son dos colores de
  /// estado uno al lado del otro, y para eso la razon de la
  /// WCAG no sirve: mide luminosidad, y dos colores pueden
  /// diferir mucho de tono y poco de luminosidad. Con ella, la
  /// paleta de fabrica -- que esta elegida a proposito para
  /// verse bien -- fallaba las seis comprobaciones. Ver
  /// `seDistinguen` en `lib/tema.ts`.
  const resultados = catalogo.comprobacionesContraste.map((c) => {
    const a = colores[c.frente] ?? "";
    const b = colores[c.fondo] ?? "";

    if (c.entreEstados) {
      const d = seDistinguen(a, b);
      return {
        ...c,
        razon: d?.distancia ?? null,
        nivel: d === null ? null : d.bastante ? ("AA" as const) : ("INSUFICIENTE" as const),
      };
    }

    const razon = contraste(a, b);
    return { ...c, razon, nivel: razon === null ? null : nivelContraste(razon, c.grande) };
  });

  const fallos = resultados.filter((r) => r.nivel === "INSUFICIENTE");

  return (
    <div>
      <h3 className="rotulo-bloque">
        Legibilidad
      </h3>
      <p className="secundario prosa mt-1">
        Contraste según la WCAG: mínimo 4,5 para texto normal y 3 para títulos
        grandes. Los tres colores de estado se comprueban además{" "}
        <strong className="text-texto">entre sí</strong>: si se
        parecen demasiado, un dato verificado y uno sin verificar acaban del
        mismo color.
      </p>

      {fallos.length > 0 && (
        <div className="dato border-borde mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
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
              className="dato rounded-plano border-borde hover:bg-superficie-alterna disabled:text-texto-suave inline-flex h-[32px] shrink-0 items-center border px-3 transition"
            >
              {corrigiendo
                ? "Corrigiendo…"
                : `Corregir ${fallos.length === 1 ? "el aviso" : `los ${fallos.length} avisos`}`}
            </button>
          )}
        </div>
      )}

      <ul className="dato mt-3 divide-y divide-hairline">
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
              <span className="tabular-nums text-texto-suave">
                {/* «:1» solo en las razones de contraste. En las
                    filas de distincion el numero es una DISTANCIA
                    entre dos colores, no una razon, y ponerle
                    «:1» invita a compararlo con el 4,5 de la
                    WCAG, que es otra escala. */}
                {r.razon === null
                  ? "—"
                  : r.entreEstados
                    ? `distancia ${r.razon.toFixed(0)}`
                    : `${r.razon.toFixed(1)}:1`}
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
    /// EL COLOR VA EN LA LETRA, también aquí.
    ///
    /// Eran cuatro píldoras teñidas —verde, ámbar y rosa— en una
    /// tabla de treinta y siete filas: treinta y siete
    /// rectángulos de color compitiendo con los colores que se
    /// están revisando, que es lo único que esta pantalla existe
    /// para mirar. Y el ámbar y el rosa están reservados al
    /// tiempo que alguien lleva esperando.
    AAA: "text-exito",
    AA: "text-exito",
    "AA-GRANDE": "text-texto-suave",
    INSUFICIENTE: "text-titulo",
  };
  const textos: Record<string, string> = {
    AAA: "Excelente",
    AA: "Correcto",
    "AA-GRANDE": "Solo títulos",
    INSUFICIENTE: "No se lee",
  };
  if (!nivel) return <span className="text-texto-suave">color inválido</span>;
  return (
    <span className={`estado ${estilos[nivel]}`}>
      {textos[nivel]}
    </span>
  );
}
