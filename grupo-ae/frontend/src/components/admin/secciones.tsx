/** El vocabulario de secciones del rediseño. */

/// Con estas ocho piezas se componen las 34 pantallas que no
/// tienen diseño propio. No es un capricho de reutilización:
/// es lo que hace que una pantalla nueva salga ya con el
/// estilo de la casa sin que nadie tenga que acordarse de los
/// tamaños.
///
/// Las medidas salen del prototipo (`Convoca Rediseño.dc.html`),
/// no del README: donde los dos se contradicen manda el
/// prototipo, que es lo que dice DECISIONES.md.
///
/// Y una regla que atraviesa todo el archivo, de DECISIONES 7:
/// los TAMAÑOS DE LETRA van en `rem` para que el ajuste de
/// accesibilidad del panel (80 %-150 %) los siga escalando; las
/// MEDIDAS DE CAJA -- rellenos, alturas, anchos -- van en px,
/// porque no deben crecer con el texto. Si crecieran, subir el
/// texto separaría las filas el doble y se perdería la
/// densidad, que es justo lo que hace útil esta herramienta.

import type React from "react";

/// LA ESCALA SE APLASTA SOBRE LOS NUEVE PAPELES.
///
/// Aquí vivían NUEVE tamaños propios —10, 10,5, 11,5, 12, 12,5,
/// 13, 13,5, 14,5 y 32— y este archivo lo usan ocho pantallas.
/// Cinco de esos nueve son de los que la dirección retira, y
/// entre el más grande de los de texto (14,5) y el más pequeño
/// (10) había un factor de 1,45: por eso en estas pantallas
/// nada pesa más que nada.
///
/// Se conservan las nueve LLAVES, para no tocar los cuarenta
/// sitios que las nombran, y se apuntan a los papeles de
/// `globals.css`. Cinco de ellas dejan de ser un tamaño
/// distinto y pasan a ser un sinónimo: `menudo`, `cuerpo` y
/// `fila` son el dato de 13; `titulo` es el título de bloque, y
/// `cifra` es la cifra de portada, que son 34 y no 32 porque
/// solo hay un escalón ahí arriba.
///
/// Si a alguien le hace falta un décimo, el caso está mal
/// resuelto: se arregla el caso.
const T = {
  /** Rótulo en versalita. */
  rotulo: "0.625rem", // 10px
  /** Código, y lo que acompaña sin competir. */
  codigo: "0.65625rem", // 10,5px
  /** Secundario. */
  pie: "0.71875rem", // 11,5px
  menudo: "0.71875rem", // era 12px
  /** Dato. */
  cuerpo: "0.8125rem", // era 12,5px
  parrafo: "0.8125rem", // 13px
  fila: "0.8125rem", // era 13,5px
  /** Título de bloque: manda el peso 700, no el tamaño. */
  titulo: "0.8125rem", // era 14,5px
  /** La cifra de portada, el único escalón de arriba. */
  cifra: "2.125rem", // era 32px
} as const;

/**
 * La banda.
 *
 * Cada sección es una franja a lo ancho sobre `--superficie`,
 * separada de la siguiente por una raya. **No es una tarjeta**:
 * no lleva radio, ni margen, ni sombra.
 *
 * Ese es el cambio de fondo del rediseño. Antes cada bloque era
 * una caja flotando sobre el fondo, y una pantalla con seis
 * bloques eran seis cajas apiladas compitiendo entre ellas.
 * Ahora la estructura se lee por líneas.
 */
export function Seccion({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-b border-borde bg-superficie ${className}`}>
      {children}
    </div>
  );
}

/// El encabezado que comparten varias secciones.
function Encabezado({ titulo, nota }: { titulo?: string; nota?: string }) {
  if (!titulo && !nota) return null;
  return (
    <div className="px-6 pt-5 pb-1">
      {titulo && (
        <div className="font-bold text-titulo" style={{ fontSize: T.titulo }}>
          {titulo}
        </div>
      )}
      {nota && (
        <div className="mt-1 text-texto-suave" style={{ fontSize: T.menudo }}>
          {nota}
        </div>
      )}
    </div>
  );
}

/**
 * La cabecera de una pantalla.
 *
 * Titulo a 21px/700 y la nota debajo. El relleno es 26px
 * arriba, 28 a los lados y 22 abajo -- y baja a 16 arriba
 * cuando hay enlace «Volver», porque el enlace ya ocupa esa
 * banda y con los 26 se abria un hueco.
 *
 * El «Volver» es un ENLACE y no un boton, a proposito: ir
 * hacia atras no es una accion de la misma clase que
 * «Guardar», y mezclarlas en la misma barra las confunde.
 */
export function CabeceraDePantalla({
  titulo,
  nota,
  volver,
  acciones,
}: {
  titulo: string;
  nota?: React.ReactNode;
  /// `{ href, texto }` del enlace de vuelta.
  volver?: { href: string; texto: string };
  acciones?: React.ReactNode;
}) {
  return (
    <Seccion>
      {volver && (
        <div className="px-6 pt-4">
          <a
            href={volver.href}
            className="text-marca no-underline hover:underline"
            style={{ fontSize: T.cuerpo }}
          >
            ← Volver a {volver.texto}
          </a>
        </div>
      )}
      <div
        className={`flex flex-wrap items-start justify-between gap-4 px-6 pb-4 ${
          volver ? "pt-4" : "pt-6"
        }`}
      >
        <div className="min-w-0">
          <h1
            className="font-bold text-titulo"
            style={{ fontSize: "1.1875rem", letterSpacing: "-0.02em" }}
          >
            {titulo}
          </h1>
          {nota && (
            <div
              className="mt-1 max-w-[760px] text-texto-suave"
              style={{ fontSize: T.cuerpo, lineHeight: 1.6 }}
            >
              {nota}
            </div>
          )}
        </div>
        {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
      </div>
    </Seccion>
  );
}

/* ── 2. kpis ─────────────────────────────────────────────── */

export type Indicador = {
  rotulo: string;
  valor: React.ReactNode;
  pie?: string;
};

/**
 * La franja de indicadores.
 *
 * Un bloque dividido por líneas, **no tarjetas sueltas**. El
 * README decía tarjetas con borde y radio; el prototipo dice
 * esto, y en pantallas concretas manda el prototipo.
 *
 * Lo de las columnas no es adorno. Con más de cinco se parte en
 * dos filas iguales -- `ceil(n/2)` -- para que ocho salgan 4+4
 * y no 7+1. Una fila de siete y otra de uno se lee como si al
 * último le pasara algo.
 */
export function Kpis({ items }: { items: Indicador[] }) {
  if (items.length === 0) return null;

  const columnas =
    items.length > 5
      ? `repeat(${Math.ceil(items.length / 2)},minmax(0,1fr))`
      : "repeat(auto-fit,minmax(200px,1fr))";

  return (
    <Seccion>
      <div
        className="grid gap-px border-t border-hairline bg-hairline"
        style={{ gridTemplateColumns: columnas }}
      >
        {items.map((k, i) => (
          <div key={`${k.rotulo}-${i}`} className="bg-superficie px-6 pt-4 pb-5">
            <div
              className="font-bold uppercase text-texto-suave"
              style={{ fontSize: T.rotulo, letterSpacing: "0.1em" }}
            >
              {k.rotulo}
            </div>
            <div
              className="mt-2 font-bold text-titulo tabular-nums"
              style={{ fontSize: T.cifra, letterSpacing: "-0.03em" }}
            >
              {k.valor}
            </div>
            {k.pie && (
              <div className="mt-1 text-texto-suave" style={{ fontSize: T.pie }}>
                {k.pie}
              </div>
            )}
          </div>
        ))}
      </div>
    </Seccion>
  );
}

/* ── 3. lista ────────────────────────────────────────────── */

export type ElementoDeLista = {
  codigo?: string;
  titulo: string;
  sub?: string;
  derecha?: React.ReactNode;
  /// Porcentaje de la barra de avance. Sin esto no hay barra.
  pct?: number;
  estado?: string;
  colorEstado?: string;
  href?: string;
  alPulsar?: () => void;
};

/**
 * Cuántas columnas dejan menos huecos.
 *
 * Se prueban 2, 3 y 4 y gana la que menos sobre. Con cinco
 * elementos salen 3 columnas (3+2); con ocho, 4 (4+4). Una
 * rejilla con un hueco grande al final se lee como si faltara
 * algo, y aquí no falta nada.
 */
export function columnasEquilibradas(n: number): number {
  if (n <= 2) return n || 1;
  let mejor = 2;
  let hueco = n % 2 ? 1 : 0;
  for (const k of [3, 4]) {
    if (k > n) continue;
    const h = (k - (n % k)) % k;
    if (h <= hueco) {
      hueco = h;
      mejor = k;
    }
  }
  return mejor;
}

export function Lista({
  titulo,
  nota,
  items,
  vacio,
  columnas = 1,
}: {
  titulo?: string;
  nota?: string;
  items: ElementoDeLista[];
  /// Qué decir cuando no hay nada. **Obligatorio en la
  /// práctica**: un bloque vacío tiene que decir por qué está
  /// vacío, nunca quedarse en blanco.
  vacio?: string;
  /// 1 fija una columna; 2 reparte con `columnasEquilibradas`.
  columnas?: 1 | 2;
}) {
  const rejilla =
    columnas === 2 && items.length > 0
      ? `repeat(${columnasEquilibradas(items.length)},minmax(0,1fr))`
      : "1fr";

  return (
    <Seccion>
      <Encabezado titulo={titulo} nota={nota} />
      <div className="grid pt-3 pb-1" style={{ gridTemplateColumns: rejilla }}>
        {items.length === 0 ? (
          <div
            className="px-6 py-6 text-center text-texto-suave"
            style={{ fontSize: T.cuerpo }}
          >
            {vacio ?? "No hay nada aquí todavía."}
          </div>
        ) : (
          items.map((it, i) => {
            const dentro = (
              <>
                {it.codigo && (
                  <div
                    className="shrink-0 basis-[30px] text-texto-suave"
                    style={{ fontSize: T.codigo, letterSpacing: "0.05em" }}
                  >
                    {it.codigo}
                  </div>
                )}
                <div className="min-w-0 flex-[1_1_320px]">
                  <div
                    className="text-titulo [overflow-wrap:anywhere]"
                    style={{ fontSize: T.fila }}
                  >
                    {it.titulo}
                  </div>
                  {it.sub && (
                    <div className="mt-1 text-texto-suave" style={{ fontSize: T.pie }}>
                      {it.sub}
                    </div>
                  )}
                </div>
                {it.pct !== undefined && (
                  <div className="h-1 w-[130px] shrink-0 overflow-hidden rounded-full bg-superficie-alterna">
                    <div
                      className="h-full rounded-full bg-marca"
                      style={{ width: `${Math.max(0, Math.min(100, it.pct))}%` }}
                    />
                  </div>
                )}
                {it.derecha !== undefined && (
                  <div
                    className="shrink-0 text-right tabular-nums text-texto"
                    style={{ fontSize: T.menudo, minWidth: 104 }}
                  >
                    {it.derecha}
                  </div>
                )}
                {it.estado && (
                  <div
                    className="shrink-0 text-right font-semibold"
                    style={{
                      fontSize: T.menudo,
                      minWidth: 88,
                      color: it.colorEstado ?? "var(--exito)",
                    }}
                  >
                    {it.estado}
                  </div>
                )}
              </>
            );

            const clases =
              "flex flex-wrap items-center gap-4 border-t border-hairline px-6 py-3";

            if (it.href) {
              return (
                <a
                  key={`${it.titulo}-${i}`}
                  href={it.href}
                  className={`${clases} no-underline transition hover:bg-tabla-fila-resaltada`}
                >
                  {dentro}
                </a>
              );
            }
            return (
              <div
                key={`${it.titulo}-${i}`}
                onClick={it.alPulsar}
                className={`${clases} ${it.alPulsar ? "cursor-pointer transition hover:bg-tabla-fila-resaltada" : ""}`}
              >
                {dentro}
              </div>
            );
          })
        )}
      </div>
    </Seccion>
  );
}

/* ── 4. barra ────────────────────────────────────────────── */

/**
 * La barra de acciones.
 *
 * Los botones que abren cosas van a la izquierda y las acciones
 * de la pantalla a la derecha, empujadas con `ml-auto`. No es
 * simetría: es que la vista busca a la derecha lo que ejecuta,
 * y a la izquierda lo que navega.
 */
export function BarraDeAcciones({
  buscador,
  izquierda,
  derecha,
  alBuscar,
  valorBusqueda,
}: {
  /// El texto de dentro del campo. `false` lo quita.
  buscador?: string | false;
  izquierda?: React.ReactNode;
  derecha?: React.ReactNode;
  alBuscar?: (v: string) => void;
  valorBusqueda?: string;
}) {
  return (
    <Seccion>
      <div className="flex flex-wrap items-center gap-2 px-6 pt-4 pb-3">
        {buscador !== false && (
          <div className="flex h-[34px] min-w-[190px] max-w-[400px] flex-[1_1_240px] items-center gap-2 rounded-plano border border-campo-borde bg-campo-fondo px-3">
            <svg viewBox="0 0 16 16" className="h-[13px] w-[13px] shrink-0 opacity-50" aria-hidden>
              <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth={1.6} />
              <line x1="10.8" y1="10.8" x2="14" y2="14" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
            </svg>
            <input
              value={valorBusqueda}
              onChange={(e) => alBuscar?.(e.target.value)}
              placeholder={buscador ?? "Buscar en lo que está a la vista…"}
              className="min-w-0 flex-1 border-none bg-transparent outline-none"
              style={{ fontSize: T.cuerpo }}
            />
          </div>
        )}
        {izquierda}
        {derecha && <div className="ml-auto flex flex-wrap gap-2">{derecha}</div>}
      </div>
    </Seccion>
  );
}

/// Los dos botones de la barra, con las medidas del prototipo:
/// alto 34, radio 10, 12,5px y peso 600.
export function BotonDeBarra({
  primario,
  children,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primario?: boolean }) {
  return (
    <button
      {...resto}
      className={`inline-flex h-[32px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-plano border px-3 font-semibold transition ${
        primario
          ? "border-marca bg-marca text-marca-texto hover:border-marca-fuerte hover:bg-marca-fuerte"
          : "border-borde bg-superficie text-titulo hover:bg-superficie-alterna"
      } ${resto.className ?? ""}`}
      style={{ fontSize: T.cuerpo, ...resto.style }}
    >
      {children}
    </button>
  );
}

/* ── 5. filtros ──────────────────────────────────────────── */

/**
 * La rejilla de filtros.
 *
 * Ocupa el ancho entero y reparte en columnas de mínimo 150px.
 * **No se quedan encogidos a la izquierda**: media pantalla
 * vacía al lado de cuatro desplegables pequeños se lee como si
 * la pantalla estuviera a medio cargar.
 */
export function Filtros({ children }: { children: React.ReactNode }) {
  return (
    <Seccion>
      <div
        className="grid gap-2 px-6 py-3"
        style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}
      >
        {children}
      </div>
    </Seccion>
  );
}

/// Un desplegable con la medida de la casa, para no repetirla
/// en cada pantalla.
export function SelectorDeFiltro({
  children,
  ...resto
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...resto}
      className={`h-[34px] w-full min-w-0 rounded-plano border border-campo-borde bg-campo-fondo px-2 text-texto ${resto.className ?? ""}`}
      style={{ fontSize: T.cuerpo, ...resto.style }}
    >
      {children}
    </select>
  );
}

/* ── 6. aviso ────────────────────────────────────────────── */

/**
 * Un aviso de una línea.
 *
 * Punto de color y texto, **sin caja, sin fondo y sin barra
 * lateral**. Es la misma regla que la de los estados en la
 * tabla: el color va en la marca pequeña y en la letra, no en
 * un rectángulo que compita con el contenido.
 */
export function AvisoDeSeccion({
  children,
  color = "var(--marca)",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <Seccion>
      <div className="flex items-baseline gap-2 px-6 py-3">
        <span
          aria-hidden
          className="h-[7px] w-[7px] shrink-0 -translate-y-px rounded-full"
          style={{ background: color }}
        />
        <div
          className="max-w-[980px] flex-1 text-texto"
          style={{ fontSize: T.cuerpo, lineHeight: 1.55 }}
        >
          {children}
        </div>
      </div>
    </Seccion>
  );
}

/* ── 7. texto ────────────────────────────────────────────── */

/**
 * Título, nota y cuerpo.
 *
 * La nota se corta a 760px porque es prosa y una línea larga
 * se pierde al volver. El CUERPO no lleva tope: los textos del
 * proyecto vienen en mayúsculas, y una columna estrecha de
 * mayúsculas es ilegible.
 */
export function TextoDeSeccion({
  titulo,
  nota,
  cuerpo,
  children,
}: {
  titulo?: string;
  nota?: string;
  cuerpo?: string;
  children?: React.ReactNode;
}) {
  return (
    <Seccion>
      <div className="px-6 pt-5 pb-4">
        {titulo && (
          <div className="font-bold text-titulo" style={{ fontSize: T.titulo }}>
            {titulo}
          </div>
        )}
        {nota && (
          <div
            className="mt-1 max-w-[760px] text-texto-suave"
            style={{ fontSize: T.cuerpo, lineHeight: 1.6 }}
          >
            {nota}
          </div>
        )}
        {cuerpo && (
          <p
            className="mt-3.5 text-texto [text-wrap:pretty]"
            style={{ fontSize: T.parrafo, lineHeight: 1.7 }}
          >
            {cuerpo}
          </p>
        )}
        {children}
      </div>
    </Seccion>
  );
}

/* ── 8. dona ─────────────────────────────────────────────── */

export type PorcionDeDona = {
  etiqueta: string;
  valor: React.ReactNode;
  /// El porcentaje del total. Es lo que decide el arco.
  pct: number;
  color: string;
};

/**
 * El anillo con su leyenda.
 *
 * Se dibuja con `stroke-dasharray` sobre un solo círculo por
 * porción, girado −90° para que el primer arco arranque
 * arriba y no a las tres en punto.
 *
 * El radio es 52 sobre un lienzo de 132 y el trazo mide 17: eso
 * deja un anillo, no un queso. La cifra del centro es el total,
 * no un porcentaje -- quien mira esto quiere saber cuántos son,
 * y la proporción ya se la cuenta el dibujo.
 *
 * El SVG se pinta a 188px fijos: es una medida de caja y no
 * debe crecer con el ajuste de texto, o se saldría de su hueco.
 */
export function Dona({
  titulo,
  nota,
  total,
  unidad,
  porciones,
}: {
  titulo?: string;
  nota?: string;
  total: React.ReactNode;
  unidad?: string;
  porciones: PorcionDeDona[];
}) {
  const R = 52;
  const CIRCUNFERENCIA = 2 * Math.PI * R;

  let acumulado = 0;
  const arcos = porciones.map((p) => {
    const largo = (CIRCUNFERENCIA * Math.max(0, p.pct)) / 100;
    const arco = {
      color: p.color,
      trazo: `${largo.toFixed(2)} ${(CIRCUNFERENCIA - largo).toFixed(2)}`,
      desfase: (-acumulado).toFixed(2),
    };
    acumulado += largo;
    return arco;
  });

  return (
    <Seccion>
      <Encabezado titulo={titulo} nota={nota} />
      <div className="flex flex-wrap items-center gap-8 px-6 pt-5 pb-6">
        <div className="relative h-[188px] w-[188px] shrink-0">
          <svg
            viewBox="0 0 132 132"
            className="h-[188px] w-[188px] -rotate-90"
            aria-hidden
          >
            {arcos.map((a, i) => (
              <circle
                key={i}
                cx="66"
                cy="66"
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={17}
                strokeDasharray={a.trazo}
                strokeDashoffset={a.desfase}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="font-bold tabular-nums text-titulo"
              style={{ fontSize: "2.125rem", letterSpacing: "-0.03em" }}
            >
              {total}
            </div>
            {unidad && (
              <div className="text-texto-suave" style={{ fontSize: T.cuerpo }}>
                {unidad}
              </div>
            )}
          </div>
        </div>

        <ul className="flex min-w-[190px] flex-1 flex-col gap-3">
          {porciones.map((p, i) => (
            <li
              key={`${p.etiqueta}-${i}`}
              className="flex items-center gap-2"
              style={{ fontSize: T.fila }}
            >
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ background: p.color }}
              />
              <span className="min-w-0 flex-1 truncate text-texto">{p.etiqueta}</span>
              <span className="font-bold tabular-nums text-titulo">{p.valor}</span>
              <span className="shrink-0 basis-[52px] text-right tabular-nums text-texto-suave">
                {String(p.pct).replace(".", ",")} %
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Seccion>
  );
}

/* ── 9. embudo ───────────────────────────────────────────── */

export type TramoDeEmbudo = {
  etiqueta: string;
  total: number;
  color: string;
};

/**
 * El embudo por etapas, en UNA fila.
 *
 * El servidor ya manda este reparto en cada carga de la lista y
 * hasta ahora no lo miraba nadie: se pagaba la consulta y se
 * tiraba el resultado.
 *
 * Total, barra y leyenda van en la misma linea, no apilados.
 * Es una tira de contexto encima de la tabla, no un panel: si
 * ocupa tres renglones empuja las filas hacia abajo y quita
 * justo lo que uno vino a mirar.
 *
 * En la leyenda el color va en el NUMERO y la etiqueta se queda
 * en gris. Al reves -- etiqueta de color y numero neutro -- se
 * lee la palabra y no la cifra, que es lo que se compara.
 *
 * «Sin asesor» va detras de una raya vertical: no es una etapa
 * del proceso, es una cola de trabajo. Sin la raya parece el
 * septimo paso del embudo, y una persona sin asesor puede
 * estar en cualquiera de los seis.
 */
export function Embudo({
  tramos,
  sinAsesor,
}: {
  tramos: TramoDeEmbudo[];
  sinAsesor?: number;
}) {
  /// Tarjetas INDIVIDUALES que llenan el ancho de la tabla.
  ///
  /// Cada una con su marco y su hueco -- no una barra dividida
  /// en trozos -- pero repartiendose entre todas el mismo ancho
  /// que la tabla de abajo. Sueltas y alineadas a la izquierda
  /// dejaban medio metro vacio a la derecha y no se entendia
  /// que fueran el resumen de lo de abajo.
  ///
  /// El marco es el mismo que el de la tabla -- borde de 1px y
  /// radio de 10 -- para que los dos bloques se lean como parte
  /// de la misma pantalla.
  /// «Sin asesor» va sin raya de separacion: cada tarjeta ya
  /// tiene su marco, y una raya entre dos marcos es una linea
  /// que no separa nada. Que va aparte se ve por el hueco.
  const Tarjeta = ({
    etiqueta,
    valor,
    color,
  }: {
    etiqueta: string;
    valor: number;
    color: string;
  }) => (
    <div
      className={
        "flex-1 min-w-[112px] rounded-plano border border-borde bg-superficie px-3 py-2 transition " +
        /// La sombra al pasar por encima: suave y hacia fuera,
        /// para que la tarjeta se despegue un punto sin
        /// moverse. Es lo unico que flota aqui, y solo mientras
        /// el raton esta encima.
        "hover:border-marca/40 hover:shadow-[0_2px_14px_-6px_rgba(15,23,42,0.28)]"
      }
    >
      {/* Apretadas a proposito: cada pixel de alto que se
          ahorran aqui es una fila mas de tabla, que es lo que
          se vino a mirar. Bajan de 61px a 46 sin perder nada --
          el rotulo se sigue leyendo y la cifra sigue mandando. */}
      <div
        className="truncate leading-none text-texto-suave"
        style={{ fontSize: T.pie }}
        title={etiqueta}
      >
        {etiqueta}
      </div>
      <div
        className="mt-1 font-bold leading-none tabular-nums"
        style={{ fontSize: "1.25rem", letterSpacing: "-0.02em", color }}
      >
        {valor}
      </div>
    </div>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {tramos.map((t) => (
        <Tarjeta
          key={t.etiqueta}
          etiqueta={t.etiqueta}
          valor={t.total}
          color={t.color}
        />
      ))}
      {sinAsesor !== undefined && sinAsesor > 0 && (
        /// Separada del resto: no es una etapa del proceso, es
        /// una cola de trabajo. Quien no tiene asesor puede
        /// estar en cualquiera de las cinco.
        <div className="flex flex-1 pl-1">
          <Tarjeta etiqueta="Sin asesor" valor={sinAsesor} color="var(--aviso)" />
        </div>
      )}
    </div>
  );
}

/* ── la lista en columnas ────────────────────────────────── */

/**
 * UNA LISTA DEL CRM SE LEE EN COLUMNAS, Y ESTA ES LA PIEZA.
 *
 * Vivía dentro de `app/admin/campanas/page.tsx`. Sube aquí en
 * cuanto la usa la segunda pantalla —Plantillas—, con la regla
 * 15 de la dirección: lo que se decide se aplica en la pieza
 * compartida y las pantallas cambian solas. Dos copias de una
 * maqueta divergen el día que alguien toque una.
 *
 * Lo que la pieza garantiza, y por eso no se escribe a mano en
 * ninguna pantalla:
 *
 * - La fila llega al canto derecho. Una fila que apila sus
 *   datos en el 25 % izquierdo se lee de a un renglón, y una
 *   lista de cuarenta filas no se lee de a un renglón: se baja
 *   la vista por una columna y se comparan las cuarenta.
 * - El rótulo y su dato comparten la MISMA rejilla. Escritas
 *   por separado se desalinean el día que alguien toque un
 *   ancho.
 * - Por debajo de `anchoMinimo` se desplaza LA BANDA, nunca la
 *   página.
 * - Es consulta de CONTENEDOR y no de ventana: la barra lateral
 *   se pliega y la banda gana 180 px sin que la ventana cambie
 *   de tamaño. Lo que decide cuántas columnas caben es el ancho
 *   de la lista, que es lo que mide el ojo.
 *
 * Lo que NO decide la pieza son los anchos: los pone cada
 * pantalla, porque el ancho de una columna lo fija su DATO
 * —`$ 999.999.999` a 13 px tabular son 104 px— y eso cambia de
 * una lista a otra. Van como clase literal para que Tailwind
 * las vea al compilar; una plantilla armada en tiempo de
 * ejecución no genera CSS.
 */
export const SOLO_ANCHA = "hidden @[1600px]:block";

export type ColumnaDeLista = {
  /** El rótulo en versalita. Vacío en la de acciones. */
  texto: string;
  /** `text-right` en lo que se compara como cifra. */
  alineado?: string;
  /** Lo que la columna gobierna y no cabe en el rótulo. */
  ayuda?: string;
  /** Solo con la banda ancha. En estrecho DESAPARECE. */
  soloAncha?: boolean;
};

export function ListaEnColumnas({
  rejilla,
  anchoMinimo,
  columnas,
  children,
}: {
  /// `grid grid-cols-[...] @[1600px]:grid-cols-[...]`, escrita
  /// literal en la pantalla. La misma para la cabecera y para
  /// cada fila.
  rejilla: string;
  /// La suma de los anchos base. Por debajo, la banda se
  /// desplaza por dentro.
  anchoMinimo: number;
  columnas: ColumnaDeLista[];
  children: React.ReactNode;
}) {
  return (
    <div className="@container min-h-0 grow overflow-x-auto border-b border-borde bg-superficie">
      <div style={{ minWidth: anchoMinimo }}>
        <div className={`${rejilla} border-b border-borde`}>
          {columnas.map((h, i) => (
            <div
              key={i}
              title={h.ayuda}
              className={`rotulo-bloque px-3 py-2 ${h.alineado ?? ""} ${
                h.soloAncha ? SOLO_ANCHA : ""
              } ${i === 0 ? "pl-6" : ""} ${
                i === columnas.length - 1 ? "pr-6" : ""
              }`}
            >
              {h.texto}
            </div>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Una celda: 13 px y `--pad-fila` arriba y abajo.
 *
 * La fila mide 33 px y ninguna celda pasa de un renglón. Un
 * segundo renglón multiplica por 1,6 el alto de la lista entera
 * para ganar cinco palabras que se leen mejor al abrir la fila,
 * y una lista con dos alturas de fila deja de escanearse: el
 * ojo necesita un paso constante para bajar por una columna.
 */
export function Celda({
  children,
  className = "",
  primera,
  ultima,
  titulo,
}: {
  children: React.ReactNode;
  className?: string;
  /// Lleva la sangría de 24 px de la izquierda del panel.
  primera?: boolean;
  ultima?: boolean;
  /// El texto entero, para lo que se recorta.
  titulo?: string;
}) {
  return (
    <div
      title={titulo}
      className={`min-w-0 truncate px-3 ${primera ? "pl-6" : ""} ${
        ultima ? "pr-6" : ""
      } ${className}`}
      style={{ paddingTop: "var(--pad-fila)", paddingBottom: "var(--pad-fila)" }}
    >
      {children}
    </div>
  );
}
