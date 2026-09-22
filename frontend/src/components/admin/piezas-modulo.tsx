"use client";

/** Las piezas con las que se dibuja cada módulo del Resumen. */

/**
 * De dónde salen.
 *
 * El cliente mandó una maqueta hecha fuera del sistema y pidió que
 * la pantalla «vaya muy de manera igual» a ella. Esto es lo que la
 * hace reconocible, traído al vocabulario de este panel:
 *
 *   - el submenú de los cinco módulos arriba,
 *   - la cabecera con su número en un disco,
 *   - la FRASE que resume el módulo en una línea,
 *   - la barra de dos segmentos con su leyenda.
 *
 * LO QUE NO SE TRAJO, Y POR QUÉ. La maqueta lleva los colores
 * escritos a fuego —`#5E1D72`, `#11897C`…—, tipografía Figtree y
 * una librería de gráficas por CDN. Aquí ningún componente escribe
 * un color suelto: la paleta la elige el administrador y son 39
 * tokens, así que un morado a fuego saldría morado sobre el verde
 * de ADECOPRIA. El acento de cada módulo sale de un token, y el
 * fondo de ese acento con `color-mix` sobre el mismo token —que es
 * el patrón que este panel ya usa para las cifras—.
 */

import Link from "next/link";

/**
 * El acento de cada módulo, de un token y no de un hex.
 *
 * La maqueta les da cuatro colores para que se distingan de un
 * vistazo, y eso sí vale la pena. Se eligieron tokens que ya
 * existen y que el administrador puede mover con su paleta; los de
 * etapa sirven porque están medidos para distinguirse entre sí
 * —«nueve colores salidos de un solo tono dejarían de
 * distinguirse»—.
 */
export const ACENTO: Record<number, string> = {
  1: "var(--marca)",
  2: "var(--etapa-interesado)",
  3: "var(--etapa-en-formacion)",
  4: "var(--aviso)",
  5: "var(--etapa-certificado)",
};

export const MODULOS_DEL_RESUMEN = [
  { n: 1, id: "modulo-1", corto: "Reservas afiliados" },
  { n: 2, id: "modulo-2", corto: "Leads e inscripciones" },
  { n: 3, id: "modulo-3", corto: "Seguimiento académico" },
  { n: 4, id: "modulo-4", corto: "Tráfico de página" },
  { n: 5, id: "modulo-5", corto: "Seguimiento de asesores" },
] as const;

/**
 * El submenú de los cinco, que además ES la pestaña.
 *
 * «Poner un submenú de cada uno de los 5 módulos… son módulos
 * INDEPENDIENTES para no recargar el sitio» (Josse, 22 sep 2026).
 * Así que no son anclas: pulsar cambia qué módulo está montado, y
 * el que no está montado no pide nada.
 *
 * `aria-current` y no solo el color: quien navega con lector de
 * pantalla tiene que saber cuál está abierto, y el color no se lo
 * dice. Es la misma regla que el semáforo de cupos —«lleva SIEMPRE
 * icono y texto, no solo color»—.
 *
 * `no-imprimir` porque en el papel no se pulsa nada, y el
 * encabezado de impresión ya dice qué módulo trae la hoja.
 */
export function TirasDeModulos({
  activo,
  alElegir,
}: {
  activo: number;
  alElegir: (n: number) => void;
}) {
  return (
    <nav
      aria-label="Módulos del resumen"
      className="no-imprimir caja-scroll -mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
    >
      {MODULOS_DEL_RESUMEN.map((m) => {
        const puesto = m.n === activo;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => alElegir(m.n)}
            aria-current={puesto ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[0.78125rem] font-semibold whitespace-nowrap transition ${
              puesto
                ? "border-borde bg-superficie-alterna text-texto"
                : "border-transparent text-texto-suave hover:bg-current/10 hover:text-texto"
            }`}
          >
            <span
              aria-hidden
              className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold"
              style={{
                color: ACENTO[m.n],
                background: `color-mix(in srgb, ${ACENTO[m.n]} ${puesto ? 22 : 14}%, transparent)`,
              }}
            >
              {m.n}
            </span>
            {m.corto}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * El armazón de un módulo: su disco con el número, su título y su
 * bajada.
 *
 * El disco va TEÑIDO y no relleno de color con el número en blanco,
 * como lo dibuja la maqueta: «el color va en el texto y en marcas
 * pequeñas, no en fondos», y este panel ya deshizo ese mismo adorno
 * una vez. Teñido se lee igual de bien y sobrevive a las dieciséis
 * plantillas de tema.
 */
export function Modulo({
  numero,
  titulo,
  descripcion,
  acciones,
  children,
}: {
  numero: number;
  titulo: string;
  descripcion: string;
  acciones?: React.ReactNode;
  children: React.ReactNode;
}) {
  const acento = ACENTO[numero] ?? "var(--marca)";
  return (
    <section
      id={`modulo-${numero}`}
      /// `scroll-mt` para que el ancla no deje el título debajo de
      /// la cabecera pegada.
      className="imprimible-bloque scroll-mt-32 overflow-hidden rounded-2xl border border-borde bg-superficie"
      style={{ borderTop: `2px solid ${acento}` }}
    >
      <header className="flex flex-wrap items-start gap-3 px-6 pt-5 pb-4">
        <span
          aria-hidden
          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.9375rem] font-extrabold"
          style={{
            color: acento,
            background: `color-mix(in srgb, ${acento} 16%, transparent)`,
          }}
        >
          {numero}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.0625rem] font-bold tracking-[-0.01em] text-titulo">
            {titulo}
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-texto-suave">{descripcion}</p>
        </div>
        {acciones && <div className="no-imprimir flex items-center gap-2">{acciones}</div>}
      </header>
      <div className="flex flex-col gap-5 px-6 pb-6">{children}</div>
    </section>
  );
}

/**
 * La frase que resume el módulo en una línea.
 *
 * Es lo más característico de la maqueta y lo que de verdad aporta:
 * antes de leer ninguna cifra, una frase dice qué está pasando. Va
 * con el acento del módulo a la izquierda, no con un fondo de
 * color: el tinte es del 8 %, que es una marca, no un fondo.
 */
export function FraseDelModulo({
  numero,
  children,
}: {
  numero: number;
  children: React.ReactNode;
}) {
  const acento = ACENTO[numero] ?? "var(--marca)";
  return (
    <p
      className="rounded-xl px-4 py-2.5 text-[0.875rem] leading-snug"
      style={{
        borderLeft: `3px solid ${acento}`,
        background: `color-mix(in srgb, ${acento} 8%, transparent)`,
      }}
    >
      {children}
    </p>
  );
}

/** La cifra de una frase, para que se lea sin buscarla. */
export function Cifra({ children }: { children: React.ReactNode }) {
  return <strong className="font-bold tabular-nums text-titulo">{children}</strong>;
}

/**
 * La tira de cifras del módulo, cada una en su caja.
 *
 * La maqueta las dibuja separadas y con su propio borde, no pegadas
 * en una sola tira. Se respeta: con cuatro o cinco cifras, la caja
 * suelta se lee de un vistazo y la tira pegada se lee como una
 * tabla.
 *
 * Borde de 1px y sin sombra, que es la regla de la casa: la sombra
 * queda para lo que flota.
 */
export function Cifras({ children }: { children: React.ReactNode }) {
  return (
    <div className="imprimible-cifras grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
  );
}

export function CifraDelModulo({
  etiqueta,
  valor,
  pie,
  tono,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  pie?: React.ReactNode;
  /// El pie es lo único que se tiñe: el número se queda del color
  /// del texto. Un número teñido compite con la cifra de al lado.
  tono?: "bueno" | "aviso";
}) {
  return (
    <div className="rounded-xl border border-borde px-3.5 py-3">
      <div className="text-[0.71875rem] font-semibold text-texto-suave">{etiqueta}</div>
      <div className="mt-0.5 text-[1.625rem] leading-tight font-extrabold tracking-[-0.02em] tabular-nums text-titulo">
        {valor}
      </div>
      {pie && (
        <div
          className={`text-[0.75rem] ${
            tono === "bueno"
              ? "text-exito"
              : tono === "aviso"
                ? "text-aviso"
                : "text-texto-suave"
          }`}
        >
          {pie}
        </div>
      )}
    </div>
  );
}

/** El enlace al detalle, al pie del módulo. */
export function VerDetalle({ a, children }: { a: string; children: React.ReactNode }) {
  /// ENLACE Y NO BOTÓN: «la navegación hacia atrás es un enlace, no
  /// un botón. Los botones son acciones». Ir a mirar no cambia nada.
  return (
    <Link
      href={a}
      className="text-[0.78125rem] font-semibold text-marca underline underline-offset-2"
    >
      {children}
    </Link>
  );
}

/** La leyenda de una barra de dos segmentos. */
export function Leyenda({ de }: { de: Array<{ nombre: string; color: string }> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.71875rem] text-texto-suave">
      {de.map((x) => (
        <span key={x.nombre} className="inline-flex items-center gap-1.5">
          <i
            aria-hidden
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: x.color }}
          />
          {x.nombre}
        </span>
      ))}
    </div>
  );
}

export type FilaDoble = {
  clave: string;
  etiqueta: string;
  /** Lo hecho: el primer segmento. */
  hecho: number;
  /** El total de la fila. El resto va en el segundo segmento. */
  total: number;
  /** Lo que se escribe a la derecha. */
  derecha: React.ReactNode;
};

/**
 * La barra de dos segmentos: lo conseguido y lo que falta.
 *
 * TODAS LAS FILAS SE MIDEN CONTRA EL MAYOR, no cada una contra su
 * propio total: si cada barra llenara su ancho, una institución con
 * 4 cupos se vería igual de grande que una con 56, y la lista
 * dejaría de decir quién pesa más. El porcentaje va escrito a la
 * derecha, que es donde se lee.
 */
export function BarrasDobles({
  filas,
  colorHecho,
  colorFalta,
  vacio = "Sin datos todavía.",
  maximoFilas,
}: {
  filas: FilaDoble[];
  colorHecho: string;
  colorFalta: string;
  vacio?: string;
  maximoFilas?: number;
}) {
  if (filas.length === 0)
    return <p className="text-[0.8125rem] text-texto-suave">{vacio}</p>;

  const tope = Math.max(1, ...filas.map((f) => f.total));
  const visibles = maximoFilas ? filas.slice(0, maximoFilas) : filas;

  return (
    <div className="flex flex-col gap-2">
      {visibles.map((f) => (
        <div
          key={f.clave}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1"
        >
          <span className="truncate text-[0.8125rem]" title={f.etiqueta}>
            {f.etiqueta}
          </span>
          <span className="text-right text-[0.78125rem] whitespace-nowrap text-texto-suave tabular-nums">
            {f.derecha}
          </span>
          <div
            className="col-span-2 flex h-3.5 overflow-hidden rounded-[5px]"
            style={{ background: "var(--track, color-mix(in srgb, var(--borde) 55%, transparent))" }}
            role="img"
            aria-label={`${f.etiqueta}: ${f.hecho} de ${f.total}`}
          >
            <span
              style={{
                width: `${(Math.min(f.hecho, f.total) / tope) * 100}%`,
                background: colorHecho,
              }}
            />
            <span
              style={{
                width: `${(Math.max(0, f.total - f.hecho) / tope) * 100}%`,
                background: colorFalta,
              }}
            />
          </div>
        </div>
      ))}
      {maximoFilas && filas.length > maximoFilas && (
        <p className="text-[0.71875rem] text-texto-suave">
          Y {filas.length - maximoFilas} más. El detalle completo va en su
          informe.
        </p>
      )}
    </div>
  );
}

/**
 * La fila de filtros de un módulo, como la dibuja el ejemplo.
 *
 * Va en su propia caja tenue y arriba del todo, antes de la frase:
 * primero se decide qué se mira y después se lee el resumen de eso.
 *
 * `no-imprimir`, y el encabezado de impresión lleva el alcance: en
 * el papel no se filtra nada, pero hay que saber con qué se
 * imprimió —«ahí el número viaja sin el menú del que salió»—.
 */
export function FiltrosDelModulo({ children }: { children: React.ReactNode }) {
  return (
    <div className="no-imprimir flex flex-wrap items-end gap-3 rounded-xl bg-superficie-alterna px-3.5 py-3">
      {children}
    </div>
  );
}

export function Filtro({
  etiqueta,
  valor,
  alCambiar,
  opciones,
  todos = "Todas",
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  opciones: Array<{ id: string; nombre: string }>;
  todos?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[0.6875rem] font-semibold text-texto-suave">{etiqueta}</span>
      <select
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        className={`max-w-[15rem] min-w-[9rem] truncate rounded-lg border bg-campo-fondo px-2.5 py-1.5 text-[0.78125rem] ${
          /// El que está puesto se NOTA. Un filtro activo que se ve
          /// igual que uno vacío explica resultados que nadie se
          /// explica: es la misma razón por la que las fichas de
          /// filtro de las tablas se quedan visibles.
          valor ? "border-marca" : "border-campo-borde"
        }`}
      >
        <option value="">{todos}</option>
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
