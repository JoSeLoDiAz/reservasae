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
 * La cifra grande con su icono en un cuadro teñido. El
 * fondo sale de `color-mix` sobre el mismo token que el
 * trazo, así que un solo color da los dos y sigue
 * obedeciendo al editor de apariencia.
 */
export function TarjetaCifra({
  etiqueta,
  valor,
  pie,
  icono: Icono,
  tono = "marca",
  href,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  pie?: React.ReactNode;
  icono?: Icono;
  tono?: Tono;
  href?: string;
}) {
  const color = VARIABLE[tono];

  const cuerpo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-texto-suave">{etiqueta}</p>
        {Icono && (
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style={{
              backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
              color,
            }}
          >
            <Icono tamano={18} />
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums">{valor}</p>
      {pie && <p className="mt-1 text-xs text-texto-suave">{pie}</p>}
    </>
  );

  const clase =
    "rounded-2xl border border-borde bg-superficie p-5 shadow-sm transition" +
    (href ? " block no-underline hover:border-marca hover:shadow-md" : "");

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
  const clases: Record<Tono, string> = {
    marca: "bg-marca-suave text-marca",
    exito: "bg-exito-suave text-exito",
    aviso: "bg-aviso-suave text-aviso",
    error: "bg-error-suave text-error",
    neutro: "bg-superficie-alterna text-texto-suave",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${clases[tono]}`}
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
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {descripcion && (
          <p className="mt-1 max-w-2xl text-sm text-texto-suave">{descripcion}</p>
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
