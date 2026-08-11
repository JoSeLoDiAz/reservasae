"use client";

import { useId, useState } from "react";

/** Piezas de visualización del tablero. */

export type EstadoSemaforo = "DISPONIBLE" | "ULTIMOS_CUPOS" | "COMPLETO";

const numero = new Intl.NumberFormat("es-CO");

export function n(valor: number): string {
  return numero.format(valor);
}

// cifras

export function TarjetaCifra({
  titulo,
  valor,
  sufijo,
  detalle,
  tono = "normal",
}: {
  titulo: string;
  valor: number | string;
  sufijo?: string;
  detalle?: string;
  tono?: "normal" | "exito" | "aviso";
}) {
  const color =
    tono === "exito" ? "text-exito" : tono === "aviso" ? "text-aviso" : "text-titulo";

  return (
    <div className="rounded-xl border border-borde bg-superficie p-5">
      <p className="text-sm text-texto-suave">{titulo}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${color}`}>
        {typeof valor === "number" ? n(valor) : valor}
        {sufijo && <span className="ml-1 text-xl font-normal text-texto-suave">{sufijo}</span>}
      </p>
      {detalle && <p className="mt-1 text-xs text-texto-suave">{detalle}</p>}
    </div>
  );
}

/** Anillo de avance: una magnitud contra su tope. */
export function Anillo({
  porcentaje,
  color = "var(--marca)",
  tamano = 84,
  etiqueta,
}: {
  porcentaje: number;
  color?: string;
  tamano?: number;
  etiqueta?: string;
}) {
  const radio = 34;
  const circunferencia = 2 * Math.PI * radio;
  const avance = Math.max(0, Math.min(porcentaje, 100));

  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 80 80"
      role="img"
      aria-label={`${etiqueta ? `${etiqueta}: ` : ""}${avance.toFixed(1).replace(".", ",")} por ciento`}
      className="shrink-0"
    >
      <circle cx="40" cy="40" r={radio} fill="none" stroke="var(--superficie-alterna)" strokeWidth="9" />
      <circle
        cx="40"
        cy="40"
        r={radio}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${(avance / 100) * circunferencia} ${circunferencia}`}
        transform="rotate(-90 40 40)"
        className="transition-[stroke-dasharray] duration-500"
      />
      <text
        x="40"
        y="41"
        textAnchor="middle"
        fontSize="15"
        fontWeight="680"
        fill="var(--titulo)"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {avance.toFixed(1).replace(".", ",")}%
      </text>
    </svg>
  );
}

export function Medidor({
  porcentaje,
  color,
  cifra,
  detalle,
  etiqueta,
}: {
  porcentaje: number;
  color?: string;
  cifra: string | number;
  detalle: string;
  etiqueta?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <Anillo porcentaje={porcentaje} color={color} etiqueta={etiqueta} />
      <div className="min-w-0">
        <p className="text-3xl font-semibold leading-none tabular-nums text-titulo">
          {typeof cifra === "number" ? n(cifra) : cifra}
        </p>
        <p className="mt-1.5 text-xs text-texto-suave">{detalle}</p>
      </div>
    </div>
  );
}

/** Barras de dos series por categoría. */
export function BarrasAgrupadas({
  categorias,
  series,
}: {
  categorias: Array<{ etiqueta: string; valores: number[] }>;
  series: Array<{ nombre: string; color: string }>;
}) {
  if (!categorias.length) {
    return <p className="py-6 text-center text-sm text-texto-suave">Sin datos.</p>;
  }
  const tope = Math.max(...categorias.flatMap((c) => c.valores), 1);

  return (
    <div>
      <div className="flex h-36 items-end gap-3">
        {categorias.map((categoria) => (
          <div key={categoria.etiqueta} className="flex h-full min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex h-full items-end justify-center gap-[2px]">
              {categoria.valores.map((valor, i) => (
                <div
                  key={series[i].nombre}
                  title={`${categoria.etiqueta} · ${series[i].nombre}: ${n(valor)}`}
                  className="w-[30%] max-w-6 rounded-t transition-opacity hover:opacity-70"
                  style={{
                    height: `${Math.max((valor / tope) * 100, valor > 0 ? 1.5 : 0)}%`,
                    background: series[i].color,
                  }}
                />
              ))}
            </div>
            <span className="truncate text-center text-[10.5px] text-texto-suave">
              {categoria.etiqueta}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-texto-suave">
        {series.map((s) => (
          <span key={s.nombre} className="inline-flex items-center gap-1.5">
            <i className="block size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.nombre}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Escalones de color de las series. */
export const SERIE = {
  uno: "var(--serie-1)",
  dos: "var(--serie-2)",
  tres: "var(--serie-3)",
};

// barra de avance

export function BarraAvance({
  valor,
  maximo,
  etiqueta,
  compacta = false,
}: {
  valor: number;
  maximo: number;
  etiqueta?: string;
  compacta?: boolean;
}) {
  const porcentaje = maximo > 0 ? Math.min((valor / maximo) * 100, 100) : 0;
  const texto = `${n(valor)} de ${n(maximo)} (${porcentaje.toFixed(1)} %)`;

  return (
    <div>
      {etiqueta && (
        <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
          <span>{etiqueta}</span>
          <span className="tabular-nums text-texto-suave">{texto}</span>
        </div>
      )}
      <div
        role="meter"
        aria-valuenow={valor}
        aria-valuemin={0}
        aria-valuemax={maximo}
        aria-label={etiqueta ? `${etiqueta}: ${texto}` : texto}
        title={texto}
        className={`w-full overflow-hidden rounded-full bg-superficie-alterna ${
          compacta ? "h-1.5" : "h-2.5"
        }`}
      >
        <div
          className="h-full rounded-full bg-marca transition-[width] duration-500"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

/** Ranking horizontal de barras. */
export function ListaBarras({
  datos,
  sufijo,
  vacio = "Sin datos todavía.",
  maximoFilas,
}: {
  datos: Array<{ etiqueta: string; valor: number; detalle?: string }>;
  sufijo?: string;
  vacio?: string;
  maximoFilas?: number;
}) {
  if (!datos.length) {
    return <p className="py-6 text-center text-sm text-texto-suave">{vacio}</p>;
  }

  const visibles = maximoFilas ? datos.slice(0, maximoFilas) : datos;
  const tope = Math.max(...visibles.map((d) => d.valor), 1);

  return (
    <ul className="space-y-2.5">
      {visibles.map((d) => (
        <li key={d.etiqueta}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate" title={d.etiqueta}>
              {d.etiqueta}
            </span>
            <span className="shrink-0 tabular-nums">
              {n(d.valor)}
              {sufijo}
              {d.detalle && <span className="ml-2 text-xs text-texto-suave">{d.detalle}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-superficie-alterna">
            <div
              className="h-full rounded-full bg-marca"
              style={{ width: `${(d.valor / tope) * 100}%` }}
            />
          </div>
        </li>
      ))}
      {maximoFilas && datos.length > maximoFilas && (
        <li className="pt-1 text-xs text-texto-suave">
          y {n(datos.length - maximoFilas)} más
        </li>
      )}
    </ul>
  );
}

// estado

const ESTADOS: Record<
  EstadoSemaforo,
  { texto: string; clase: string; icono: React.ReactNode }
> = {
  DISPONIBLE: {
    texto: "Disponible",
    clase: "bg-exito-suave text-exito",
    icono: <IconoCirculoCheck />,
  },
  ULTIMOS_CUPOS: {
    texto: "Últimos cupos",
    clase: "bg-aviso-suave text-aviso",
    icono: <IconoTriangulo />,
  },
  COMPLETO: { texto: "Completo", clase: "bg-error-suave text-error", icono: <IconoCirculoX /> },
};

/** Icono + texto, nunca solo color. */
export function EtiquetaEstado({ estado }: { estado: EstadoSemaforo }) {
  const e = ESTADOS[estado];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${e.clase}`}
    >
      {e.icono}
      {e.texto}
    </span>
  );
}

// serie por día

type Punto = { dia: string; reservas: number; cupos: number };

/** Barras de cupos por día. */
export function BarrasPorDia({ datos }: { datos: Punto[] }) {
  const [encima, setEncima] = useState<number | null>(null);
  const id = useId();

  if (!datos.length) {
    return (
      <p className="py-8 text-center text-sm text-texto-suave">
        Todavía no hay reservas que mostrar.
      </p>
    );
  }

  const maximo = Math.max(...datos.map((d) => d.cupos), 1);
  const punto = encima !== null ? datos[encima] : null;

  return (
    <div className="relative">
      {/* rejilla de tres referencias */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40">
        {[0, 0.5, 1].map((f) => (
          <div
            key={f}
            className="absolute inset-x-0 border-t border-borde/60"
            style={{ top: `${f * 100}%` }}
          >
            <span className="absolute -top-2 right-0 bg-superficie pl-1 text-[10px] tabular-nums text-texto-suave">
              {n(Math.round(maximo * (1 - f)))}
            </span>
          </div>
        ))}
      </div>

      <div className="flex h-40 items-end gap-[2px]" role="img" aria-describedby={id}>
        {datos.map((d, i) => (
          <div
            key={d.dia}
            className="group relative flex h-full flex-1 items-end"
            onMouseEnter={() => setEncima(i)}
            onMouseLeave={() => setEncima(null)}
          >
            {/* zona sensible de altura completa */}
            <div
              className="w-full rounded-t bg-marca transition-opacity"
              style={{
                height: `${Math.max((d.cupos / maximo) * 100, d.cupos > 0 ? 2 : 0)}%`,
                opacity: encima === null || encima === i ? 1 : 0.45,
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-texto-suave">
        <span>{fecha(datos[0].dia)}</span>
        <span>{fecha(datos[datos.length - 1].dia)}</span>
      </div>

      {punto && (
        <div className="mt-3 rounded-lg bg-superficie-alterna px-3 py-2 text-sm">
          <span className="font-medium">{fecha(punto.dia, true)}</span>
          <span className="text-texto-suave">
            {" "}
            · {n(punto.cupos)} cupos en {n(punto.reservas)}{" "}
            {punto.reservas === 1 ? "reserva" : "reservas"}
          </span>
        </div>
      )}

      {/* la misma serie en texto */}
      <p id={id} className="sr-only">
        {datos.map((d) => `${d.dia}: ${d.cupos} cupos`).join(". ")}
      </p>
    </div>
  );
}

function fecha(iso: string, largo = false): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("es-CO", {
    day: "numeric",
    month: largo ? "long" : "short",
    ...(largo ? { year: "numeric" } : {}),
  });
}

// iconos

const TRAZO = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function IconoCirculoCheck() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" aria-hidden {...TRAZO}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

function IconoTriangulo() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" aria-hidden {...TRAZO}>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4M12 17.5v.01" />
    </svg>
  );
}

function IconoCirculoX() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" aria-hidden {...TRAZO}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </svg>
  );
}
