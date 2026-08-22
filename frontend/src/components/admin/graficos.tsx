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
  chispa,
  delta,
}: {
  titulo: string;
  valor: number | string;
  sufijo?: string;
  detalle?: string;
  tono?: "normal" | "exito" | "aviso";
  /** La misma cifra a lo largo del tiempo. */
  chispa?: number[];
  /** El cambio contra otro periodo. */
  delta?: { valor: number | null; contra?: string | null; invertido?: boolean };
}) {
  const color =
    tono === "exito" ? "text-exito" : tono === "aviso" ? "text-aviso" : "text-titulo";
  const colorChispa =
    tono === "exito" ? "var(--exito)" : tono === "aviso" ? "var(--aviso)" : "var(--marca)";

  return (
    <div className="rounded-2xl border border-borde bg-superficie p-5 shadow-sm">
      <p className="text-sm text-texto-suave">{titulo}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className={`text-3xl font-semibold tabular-nums ${color}`}>
          {typeof valor === "number" ? n(valor) : valor}
          {sufijo && <span className="ml-1 text-xl font-normal text-texto-suave">{sufijo}</span>}
        </p>
        {chispa && <Chispa datos={chispa} color={colorChispa} etiqueta={titulo} />}
      </div>
      {detalle && <p className="mt-1 text-xs text-texto-suave">{detalle}</p>}
      {delta && (
        <Delta valor={delta.valor} contra={delta.contra} invertido={delta.invertido} />
      )}
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

type Punto = { dia: string; cupos: number; reservas?: number };

/** Barras por día; la unidad se puede renombrar. */
export function BarrasPorDia({
  datos,
  unidad = "cupos",
  vacio = "Todavía no hay reservas que mostrar.",
}: {
  datos: Punto[];
  unidad?: string;
  vacio?: string;
}) {
  const [encima, setEncima] = useState<number | null>(null);
  const id = useId();

  if (!datos.length) {
    return <p className="py-8 text-center text-sm text-texto-suave">{vacio}</p>;
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
            · {n(punto.cupos)} {unidad}
            {punto.reservas !== undefined &&
              ` en ${n(punto.reservas)} ${punto.reservas === 1 ? "reserva" : "reservas"}`}
          </span>
        </div>
      )}

      {/* la misma serie en texto */}
      <p id={id} className="sr-only">
        {datos.map((d) => `${d.dia}: ${d.cupos} ${unidad}`).join(". ")}
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

// tono compartido

/** El tono que decide el color de una pieza. */
export type Tono = "bueno" | "normal" | "aviso" | "malo";

const TONO_TEXTO: Record<Tono, string> = {
  bueno: "text-exito",
  normal: "text-titulo",
  aviso: "text-aviso",
  malo: "text-error",
};

const TONO_COLOR: Record<Tono, string> = {
  bueno: "var(--exito)",
  normal: "var(--marca)",
  aviso: "var(--aviso)",
  malo: "var(--error)",
};

/** Los tres escalones, en orden, para repartir. */
const CICLO_SERIE = [SERIE.uno, SERIE.dos, SERIE.tres];

/** Una parte sobre su total, ya con coma decimal. */
function formatoPorcentaje(valor: number, total: number): string {
  if (total <= 0) return "0,0 %";
  return `${((valor / total) * 100).toFixed(1).replace(".", ",")} %`;
}

// donut

/** Una porción del anillo; el color es opcional. */
export type PorcionDonut = { etiqueta: string; valor: number; color?: string };

/**
 * Anillo de varios segmentos con su leyenda al lado.
 *
 * Los colores se reparten en ciclo sobre los tres escalones
 * de serie, así que con más de tres porciones se repiten.
 * No estorba porque la leyenda siempre lleva la etiqueta y
 * la cifra: el color acompaña, nunca distingue él solo.
 *
 * Una porción en cero no dibuja segmento pero sí sale en la
 * leyenda con su cero; esconderla haría creer que el corte
 * no existe cuando lo que pasa es que está vacío.
 */
export function Donut({
  datos,
  tamano = 148,
  centro,
  detalleCentro,
  vacio = "Sin datos todavía.",
}: {
  datos: PorcionDonut[];
  tamano?: number;
  centro?: string;
  detalleCentro?: string;
  vacio?: string;
}) {
  if (!datos.length) {
    return <p className="py-6 text-center text-sm text-texto-suave">{vacio}</p>;
  }

  const radio = 38;
  const circunferencia = 2 * Math.PI * radio;
  const suma = datos.reduce((t, d) => t + Math.max(d.valor, 0), 0);
  const conColor = datos.map((d, i) => ({
    ...d,
    color: d.color ?? CICLO_SERIE[i % CICLO_SERIE.length],
  }));
  const dibujables = conColor.filter((d) => d.valor > 0);
  // separación entre porciones
  const hueco = dibujables.length > 1 ? 1.5 : 0;

  // arranca donde acabó el anterior
  const segmentos: Array<{
    etiqueta: string;
    valor: number;
    color: string;
    largo: number;
    desfase: number;
  }> = [];
  let acumulado = 0;
  for (const d of dibujables) {
    const largo = (d.valor / suma) * circunferencia;
    segmentos.push({
      etiqueta: d.etiqueta,
      valor: d.valor,
      color: d.color,
      largo,
      desfase: acumulado,
    });
    acumulado += largo;
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg
        width={tamano}
        height={tamano}
        viewBox="0 0 100 100"
        role="img"
        aria-label={conColor
          .map((d) => `${d.etiqueta}: ${n(d.valor)}, ${formatoPorcentaje(d.valor, suma)}`)
          .join(". ")}
        className="shrink-0"
      >
        <circle
          cx="50"
          cy="50"
          r={radio}
          fill="none"
          stroke="var(--superficie-alterna)"
          strokeWidth="13"
        />
        {segmentos.map((s, i) => (
          <circle
            key={`${s.etiqueta}-${i}`}
            cx="50"
            cy="50"
            r={radio}
            fill="none"
            stroke={s.color}
            strokeWidth="13"
            strokeDasharray={`${Math.max(s.largo - hueco, 0.8)} ${circunferencia}`}
            strokeDashoffset={-s.desfase}
            transform="rotate(-90 50 50)"
            className="transition-[stroke-dasharray] duration-500"
          >
            <title>{`${s.etiqueta}: ${n(s.valor)}`}</title>
          </circle>
        ))}
        {centro && (
          <text
            x="50"
            y={detalleCentro ? 48 : 55}
            textAnchor="middle"
            fontSize="17"
            fontWeight="680"
            fill="var(--titulo)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {centro}
          </text>
        )}
        {detalleCentro && (
          <text x="50" y="61" textAnchor="middle" fontSize="7.5" fill="var(--texto-suave)">
            {detalleCentro}
          </text>
        )}
      </svg>

      <ul className="w-full min-w-0 flex-1 space-y-2 text-sm">
        {conColor.map((d, i) => (
          <li key={`${d.etiqueta}-${i}`} className="flex items-baseline gap-2">
            <i className="block size-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate" title={d.etiqueta}>
              {d.etiqueta}
            </span>
            <span className="shrink-0 tabular-nums">{n(d.valor)}</span>
            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-texto-suave">
              {formatoPorcentaje(d.valor, suma)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// barras apiladas

/**
 * Una barra por fila, partida en segmentos.
 *
 * Con `volumen` la barra larga es la fila mayor, así que se
 * comparan tamaños; con `composicion` todas llenan el ancho
 * y lo que se compara es el reparto. Las dos preguntas son
 * legítimas y la respuesta a una no sirve para la otra.
 */
export function BarrasApiladas({
  filas,
  series,
  escala = "volumen",
  vacio = "Sin datos todavía.",
  maximoFilas,
}: {
  filas: Array<{ etiqueta: string; valores: number[]; detalle?: string }>;
  series: Array<{ nombre: string; color: string }>;
  escala?: "volumen" | "composicion";
  vacio?: string;
  maximoFilas?: number;
}) {
  if (!filas.length) {
    return <p className="py-6 text-center text-sm text-texto-suave">{vacio}</p>;
  }

  const visibles = maximoFilas ? filas.slice(0, maximoFilas) : filas;
  const totales = visibles.map((f) => f.valores.reduce((t, v) => t + Math.max(v, 0), 0));
  const tope = Math.max(...totales, 1);

  return (
    <div>
      <ul className="space-y-3">
        {visibles.map((fila, iFila) => {
          const total = totales[iFila];
          const base = escala === "composicion" ? total : tope;
          return (
            <li key={`${fila.etiqueta}-${iFila}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate" title={fila.etiqueta}>
                  {fila.etiqueta}
                </span>
                <span className="shrink-0 tabular-nums">
                  {n(total)}
                  {fila.detalle && (
                    <span className="ml-2 text-xs text-texto-suave">{fila.detalle}</span>
                  )}
                </span>
              </div>
              <div className="mt-1 flex h-2.5 w-full overflow-hidden rounded-full bg-superficie-alterna">
                {series.map((s, i) => {
                  const valor = Math.max(fila.valores[i] ?? 0, 0);
                  const ancho = base > 0 ? Math.max((valor / base) * 100, valor > 0 ? 1 : 0) : 0;
                  return (
                    <div
                      key={s.nombre}
                      title={`${fila.etiqueta} · ${s.nombre}: ${n(valor)}`}
                      className="h-full transition-[width] duration-500"
                      style={{ width: `${ancho}%`, background: s.color }}
                    />
                  );
                })}
              </div>
            </li>
          );
        })}
        {maximoFilas && filas.length > maximoFilas && (
          <li className="pt-1 text-xs text-texto-suave">y {n(filas.length - maximoFilas)} más</li>
        )}
      </ul>

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

// dos series por día

/** Una serie diaria con su nombre y su color. */
export type SeriePorDia = {
  nombre: string;
  datos: Array<{ dia: string; total: number }>;
  color?: string;
};

/** El día ISO siguiente, siempre en UTC. */
function siguienteDia(iso: string): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
}

/**
 * Une las dos series rellenando con cero los días vacíos.
 *
 * Sin el relleno, cuatro días de actividad repartidos en
 * noventa se dibujan pegados y se leen como cuatro días
 * seguidos: el hueco es parte del dato, no ruido.
 */
function unirPorDia(
  a: Array<{ dia: string; total: number }>,
  b: Array<{ dia: string; total: number }>,
): Array<{ dia: string; a: number; b: number }> {
  const dias = [...a.map((d) => d.dia), ...b.map((d) => d.dia)].sort();
  if (!dias.length) return [];

  const mapaA = new Map(a.map((d) => [d.dia, d.total]));
  const mapaB = new Map(b.map((d) => [d.dia, d.total]));
  const ultimo = dias[dias.length - 1];
  const salida: Array<{ dia: string; a: number; b: number }> = [];

  // tope de seguridad: tres años
  for (let dia = dias[0]; dia <= ultimo && salida.length < 1100; dia = siguienteDia(dia)) {
    salida.push({ dia, a: mapaA.get(dia) ?? 0, b: mapaB.get(dia) ?? 0 });
  }
  return salida;
}

/** Dos series diarias enfrentadas, día a día. */
export function DosSeriesPorDia({
  a,
  b,
  vacio = "Todavía no hay movimiento que mostrar.",
}: {
  a: SeriePorDia;
  b: SeriePorDia;
  vacio?: string;
}) {
  const [encima, setEncima] = useState<number | null>(null);
  const id = useId();

  const datos = unirPorDia(a.datos, b.datos);
  if (!datos.length) {
    return <p className="py-8 text-center text-sm text-texto-suave">{vacio}</p>;
  }

  const colorA = a.color ?? SERIE.uno;
  const colorB = b.color ?? SERIE.dos;
  const maximo = Math.max(...datos.map((d) => Math.max(d.a, d.b)), 1);
  const punto = encima !== null ? datos[encima] : null;
  const alto = (v: number) => `${Math.max((v / maximo) * 100, v > 0 ? 2 : 0)}%`;

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
            className="relative flex h-full flex-1 items-end justify-center gap-[1px]"
            onMouseEnter={() => setEncima(i)}
            onMouseLeave={() => setEncima(null)}
          >
            <div
              className="w-1/2 rounded-t transition-opacity"
              style={{
                height: alto(d.a),
                background: colorA,
                opacity: encima === null || encima === i ? 1 : 0.45,
              }}
            />
            <div
              className="w-1/2 rounded-t transition-opacity"
              style={{
                height: alto(d.b),
                background: colorB,
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

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-texto-suave">
        <span className="inline-flex items-center gap-1.5">
          <i className="block size-2.5 rounded-sm" style={{ background: colorA }} />
          {a.nombre}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="block size-2.5 rounded-sm" style={{ background: colorB }} />
          {b.nombre}
        </span>
      </div>

      {punto && (
        <div className="mt-3 rounded-lg bg-superficie-alterna px-3 py-2 text-sm">
          <span className="font-medium">{fecha(punto.dia, true)}</span>
          <span className="text-texto-suave">
            {" "}
            · {a.nombre}: {n(punto.a)} · {b.nombre}: {n(punto.b)}
          </span>
        </div>
      )}

      {/* las dos series en texto */}
      <p id={id} className="sr-only">
        {datos.map((d) => `${d.dia}: ${d.a} ${a.nombre}, ${d.b} ${b.nombre}`).join(". ")}
      </p>
    </div>
  );
}

// tasas

/** Un porcentaje grande con su fracción y su barra. */
export function Tasa({
  titulo,
  parte,
  total,
  tono = "normal",
  detalle,
}: {
  titulo?: string;
  parte: number;
  total: number;
  tono?: Tono;
  detalle?: string;
}) {
  const hay = total > 0;
  const porciento = hay ? (parte / total) * 100 : 0;
  const texto = `${n(parte)} de ${n(total)}`;

  return (
    <div>
      {titulo && <p className="text-sm text-texto-suave">{titulo}</p>}
      <p className={`mt-1 text-3xl font-semibold leading-none tabular-nums ${TONO_TEXTO[tono]}`}>
        {hay ? `${porciento.toFixed(1).replace(".", ",")} %` : "—"}
      </p>
      <p className="mt-1.5 text-xs tabular-nums text-texto-suave">
        {texto}
        {detalle && <span className="ml-2">· {detalle}</span>}
      </p>
      <div
        role="meter"
        aria-valuenow={parte}
        aria-valuemin={0}
        aria-valuemax={Math.max(total, parte, 1)}
        aria-label={titulo ? `${titulo}: ${texto}` : texto}
        title={texto}
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-superficie-alterna"
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.min(porciento, 100)}%`, background: TONO_COLOR[tono] }}
        />
      </div>
    </div>
  );
}

// termómetro

/** Un tramo de la tira, con su tono. */
export type TramoTermometro = { etiqueta: string; total: number; tono?: Tono };

/**
 * Tira partida en tramos, de mejor a peor.
 *
 * Cada tramo guarda un ancho mínimo aunque valga poco: sin
 * él, el tramo urgente con dos personas dentro se queda en
 * una línea de un píxel, que es justo el que hay que ver.
 * Por eso la cifra va escrita encima y no se deduce del
 * ancho, y la etiqueta acompaña siempre al color.
 */
export function Termometro({
  tramos,
  vacio = "Sin datos todavía.",
}: {
  tramos: TramoTermometro[];
  vacio?: string;
}) {
  if (!tramos.length) {
    return <p className="py-6 text-center text-sm text-texto-suave">{vacio}</p>;
  }

  return (
    <div className="caja-scroll overflow-x-auto">
      <ul className="flex min-w-max items-end gap-2 sm:min-w-0">
        {tramos.map((t, i) => {
          const tono = t.tono ?? "normal";
          return (
            <li
              key={`${t.etiqueta}-${i}`}
              className="min-w-0"
              style={{ flexGrow: Math.max(t.total, 0), flexBasis: 0, minWidth: "4rem" }}
              title={`${t.etiqueta}: ${n(t.total)}`}
            >
              <p className={`text-xl font-semibold leading-none tabular-nums ${TONO_TEXTO[tono]}`}>
                {n(t.total)}
              </p>
              <p className="mt-1 truncate text-[11px] text-texto-suave">{t.etiqueta}</p>
              <div
                className="mt-1.5 h-2 rounded-full"
                style={{ background: TONO_COLOR[tono] }}
                aria-hidden
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// chispa

/** Sparkline diminuto para meter dentro de una tarjeta. */
export function Chispa({
  datos,
  ancho = 64,
  alto = 20,
  color = "var(--marca)",
  etiqueta,
}: {
  datos: number[];
  ancho?: number;
  alto?: number;
  color?: string;
  etiqueta?: string;
}) {
  if (!datos.length) return null;

  const maximo = Math.max(...datos);
  const minimo = Math.min(...datos);
  const plano = maximo === minimo;
  const paso = datos.length > 1 ? (ancho - 4) / (datos.length - 1) : 0;

  const puntos = datos.map((v, i) => {
    const x = 2 + i * paso;
    const y = plano ? alto / 2 : alto - 2 - ((v - minimo) / (maximo - minimo)) * (alto - 4);
    return [x, y] as const;
  });
  const ultimo = puntos[puntos.length - 1];

  return (
    <svg
      width={ancho}
      height={alto}
      viewBox={`0 0 ${ancho} ${alto}`}
      role="img"
      aria-label={`${etiqueta ? `${etiqueta}, ` : ""}tendencia de ${n(datos[0])} a ${n(
        datos[datos.length - 1],
      )}`}
      className="shrink-0"
    >
      {puntos.length > 1 && (
        <polyline
          points={puntos.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <circle cx={ultimo[0]} cy={ultimo[1]} r="1.75" fill={color} />
    </svg>
  );
}

// delta

/**
 * El cambio contra otro periodo, con su flecha.
 *
 * Con `valor` en null no se pinta nada, ni un guion: sin
 * comparación no hay cifra que enseñar, y un guion se lee
 * como «cero» o como «se rompió algo».
 */
export function Delta({
  valor,
  contra,
  invertido = false,
}: {
  valor: number | null;
  contra?: string | null;
  invertido?: boolean;
}) {
  if (valor === null) return null;

  const puntos = Math.round(valor * 100);
  if (puntos === 0) {
    return (
      <p className="mt-1.5 text-xs text-texto-suave">
        {contra ? `igual que ${contra}` : "sin cambio"}
      </p>
    );
  }

  const sube = puntos > 0;
  const bueno = sube !== invertido;

  return (
    <p
      className={`mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs font-medium ${
        bueno ? "text-exito" : "text-error"
      }`}
    >
      {sube ? <IconoSube /> : <IconoBaja />}
      <span className="tabular-nums">
        {sube ? "+" : "−"}
        {n(Math.abs(puntos))} %
      </span>
      {contra && <span className="font-normal text-texto-suave">vs {contra}</span>}
    </p>
  );
}

function IconoSube() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" aria-hidden {...TRAZO}>
      <path d="M12 19.5V5" />
      <path d="m6 11 6-6 6 6" />
    </svg>
  );
}

function IconoBaja() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" aria-hidden {...TRAZO}>
      <path d="M12 4.5V19" />
      <path d="m6 13 6 6 6-6" />
    </svg>
  );
}
