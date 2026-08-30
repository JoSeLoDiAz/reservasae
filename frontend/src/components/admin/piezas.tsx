/** Piezas visuales que repiten todas las pantallas. */

import Link from "next/link";

import type { Icono } from "./iconos";

export type Tono = "marca" | "exito" | "aviso" | "error" | "neutro";

const VARIABLE: Record<Tono, string> = {
  marca: "var(--marca)",
  exito: "var(--exito)",
  aviso: "var(--aviso)",
  error: "var(--error)",
  neutro: "var(--texto-suave)",
};

/**
 * Un indicador, como una CELDA de la franja.
 *
 * Era una tarjeta con borde, radio y su icono en un cuadro
 * tenido. Ahora es una celda de la banda de indicadores: la
 * separacion la pone la raya de la izquierda, no una caja.
 *
 * El icono se fue. El prototipo no lo tiene, y con ocho
 * indicadores en fila ocho cuadros de color pesaban mas que
 * las propias cifras. La prop se sigue aceptando para no
 * tocar las 27 llamadas, pero no se pinta.
 *
 * Rotulo de 10px en versalita, cifra de 32 y pie de 11,5: los
 * tres en rem, que es lo que deja que el ajuste de texto del
 * panel los siga escalando.
 */
/**
 * La tarjeta de cifra de Gestión de leads, tal cual: suelta, con
 * su borde y su curva, y sombra solo al pasar por encima — que es
 * lo único que puede flotar en el contenido.
 */
export function Cifra({
  etiqueta,
  valor,
  pie,
  color = "var(--titulo)",
}: {
  etiqueta: string;
  valor: number;
  pie?: string | null;
  color?: string;
}) {
  return (
    <div
      className={
        "min-w-[150px] flex-1 rounded-lg border border-borde bg-superficie px-3.5 py-2 transition " +
        "hover:border-marca/40 hover:shadow-[0_2px_14px_-6px_rgba(15,23,42,0.28)]"
      }
    >
      <div className="truncate leading-none text-texto-suave" style={{ fontSize: "0.6875rem" }} title={etiqueta}>
        {etiqueta}
      </div>
      <div className="mt-1 font-bold leading-none tabular-nums" style={{ fontSize: "1.0625rem", color }}>
        {valor}
      </div>
      {pie && (
        <div className="mt-1 truncate leading-none text-texto-suave" style={{ fontSize: "0.6875rem" }}>
          {pie}
        </div>
      )}
    </div>
  );
}

/**
 * Una sección en su propia caja, sobre el fondo de la página.
 *
 * Es la contraria de `Tarjeta`: aquella es una franja a sangre
 * con raya abajo, y sirve cuando la pantalla entera es una
 * columna de franjas. Esta es para pantallas al estilo de
 * Gestión de leads, donde el contenido va sobre el fondo con
 * margen y cada bloque se despega con su borde.
 *
 * El relleno lateral es de 28px y NO se cambia: hay listas que
 * lo compensan con `-mx-7` para llegar de borde a borde.
 */
export function Bloque({
  titulo,
  descripcion,
  acciones,
  sinRelleno,
  estirado,
  children,
}: {
  titulo?: string;
  descripcion?: React.ReactNode;
  /** Botones a la derecha del título. */
  acciones?: React.ReactNode;
  /** Para tablas, que traen su propio relleno. */
  sinRelleno?: boolean;
  /** Que ocupe todo el alto: dos bloques de una fila miden igual. */
  estirado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        "overflow-hidden rounded-lg border border-borde bg-superficie " +
        (estirado ? "flex h-full flex-col" : "")
      }
    >
      {(titulo || acciones) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-borde bg-marca-suave px-7 py-3">
          <div className="min-w-0">
            {titulo && (
              <h2 className="text-[0.875rem] font-semibold text-titulo">{titulo}</h2>
            )}
            {descripcion && (
              <p className="mt-0.5 text-[0.75rem] text-texto-suave">{descripcion}</p>
            )}
          </div>
          {acciones}
        </div>
      )}
      <div
        className={
          (sinRelleno ? "" : "px-7 py-4") + (estirado ? " min-h-0 grow" : "")
        }
      >
        {children}
      </div>
    </section>
  );
}

export function TarjetaCifra({
  etiqueta,
  valor,
  pie,
  tono = "marca",
  href,
  compacta,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  pie?: React.ReactNode;
  /// Se acepta y NO se pinta: ver el comentario de arriba.
  icono?: Icono;
  tono?: Tono;
  href?: string;
  /// Menos alta, para pantallas donde la cifra acompaña y lo
  /// que se viene a mirar es la lista de abajo.
  compacta?: boolean;
}) {
  const cuerpo = (
    <>
      <p
        className="font-semibold uppercase text-texto-suave"
        style={{ fontSize: "0.625rem", letterSpacing: "0.1em" }}
      >
        {etiqueta}
      </p>
      <p
        className={(compacta ? "mt-1" : "mt-2") + " font-bold tabular-nums"}
        style={{
          fontSize: compacta ? "1.5rem" : "2rem",
          letterSpacing: "-0.03em",
          color: tono === "marca" ? "var(--titulo)" : VARIABLE[tono],
        }}
      >
        {valor}
      </p>
      {pie && (
        <p className="mt-[3px] text-texto-suave" style={{ fontSize: "0.71875rem" }}>
          {pie}
        </p>
      )}
    </>
  );

  const clase =
    (compacta ? "bg-superficie px-7 pt-3 pb-[13px] transition" : "bg-superficie px-7 pt-[18px] pb-5 transition") +
    (href ? " block no-underline hover:bg-tabla-fila-resaltada" : "");

  return href ? (
    <Link href={href} className={clase}>
      {cuerpo}
    </Link>
  ) : (
    <div className={clase}>{cuerpo}</div>
  );
}

/**
 * Estado en una píldora. Lleva SIEMPRE texto: el color
 * acompaña, nunca es lo único que distingue.
 */
export function Pildora({
  tono = "neutro",
  children,
}: {
  tono?: Tono;
  children: React.ReactNode;
}) {
  /// El color va en la LETRA, no en una caja.
  ///
  /// Era una pildora con fondo tenido y radio completo. En una
  /// tabla de 400 filas, 400 rectangulos de color compiten con
  /// los datos en vez de ordenarlos: uno acaba viendo la
  /// alfombra de colores y no la fila que buscaba.
  ///
  /// Se conserva el peso 600, que es lo que sigue haciendo que
  /// el estado destaque sin fondo. Y se conserva el texto: el
  /// color acompania, nunca es lo unico que distingue -- en
  /// papel y en daltonismo el color no llega.
  const clases: Record<Tono, string> = {
    marca: "text-marca",
    exito: "text-exito",
    aviso: "text-aviso",
    error: "text-error",
    neutro: "text-texto-suave",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold whitespace-nowrap ${clases[tono]}`}
      style={{ fontSize: "0.75rem" }}
    >
      {children}
    </span>
  );
}

/** Encabezado de pantalla: título, apoyo y acciones. */
export function Encabezado({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    /// Una banda mas, con su relleno propio.
    ///
    /// Llevaba `mb-6` y ningun relleno lateral: eso funcionaba
    /// cuando el contenedor de la pagina ponia el margen. Ahora
    /// las secciones van a sangre y el relleno lo pone cada una,
    /// asi que sin esto el titulo quedaba pegado al canto.
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px]">
      <div className="min-w-0">
        <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">
          {titulo}
        </h1>
        {descripcion && (
          <p className="mt-1.5 max-w-[760px] text-[0.78125rem] leading-relaxed text-texto-suave">
            {descripcion}
          </p>
        )}
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </header>
  );
}

/** Cuando no hay nada que mostrar, decir por qué. */
export function Vacio({
  titulo,
  children,
  icono: Icono,
}: {
  titulo: string;
  children?: React.ReactNode;
  icono?: Icono;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-borde px-6 py-12 text-center">
      {Icono && (
        <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-superficie-alterna text-texto-suave">
          <Icono tamano={22} />
        </span>
      )}
      <p className="font-medium">{titulo}</p>
      {children && (
        <p className="mx-auto mt-1 max-w-md text-sm text-texto-suave">{children}</p>
      )}
    </div>
  );
}

/** El botón que no es la acción principal. */
export function BotonSuave({
  children,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...resto}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-borde bg-superficie px-4 py-2.5 text-sm font-medium transition hover:bg-superficie-alterna disabled:opacity-50 ${resto.className ?? ""}`}
    >
      {children}
    </button>
  );
}

/**
 * Lo que se ve mientras llega la respuesta. Un bloque
 * gris con la forma de lo que va a venir orienta más que
 * la palabra "cargando", y evita el salto cuando entra.
 */
export function Esqueleto({
  filas = 3,
  conCifras = false,
}: {
  filas?: number;
  conCifras?: boolean;
}) {
  return (
    <div className="space-y-4" aria-hidden>
      <span className="sr-only" aria-live="polite">
        Cargando la información
      </span>

      {conCifras && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-borde bg-superficie p-5"
            >
              <div className="h-3.5 w-24 animate-pulse rounded-full bg-current/10" />
              <div className="mt-4 h-8 w-16 animate-pulse rounded-lg bg-current/10" />
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-borde bg-superficie p-5">
        <div className="h-4 w-40 animate-pulse rounded-full bg-current/10" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: filas }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-current/10" />
              <div className="h-3.5 grow animate-pulse rounded-full bg-current/10" />
              <div className="h-3.5 w-16 shrink-0 animate-pulse rounded-full bg-current/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
