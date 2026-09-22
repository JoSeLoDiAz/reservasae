"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  agruparPor,
  granoInicial,
  granoQueCabe,
  rellenarDias,
  QUE_ES_UNA_COLUMNA,
  type Cubeta,
  type DiaDelEmbudo,
  type Grano,
} from "./agrupar-dias";

/** Piezas de visualización del tablero. */

export type EstadoSemaforo = "DISPONIBLE" | "ULTIMOS_CUPOS" | "COMPLETO";

const numero = new Intl.NumberFormat("es-CO");

export function n(valor: number): string {
  return numero.format(valor);
}

/** Un decimal y con coma, que es el separador de aqui. */
export function dec(valor: number): string {
  return valor.toLocaleString("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
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
    <div className="border-b border-borde bg-superficie px-7 py-5">
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
  tamano = 60,
  etiqueta,
}: {
  porcentaje: number;
  color?: string;
  tamano?: number;
  etiqueta?: string;
}) {
  /// Las medidas del prototipo: lienzo de 72, radio 30 y trazo
  /// de 6. Y la pista en `--hairline`, no en
  /// `--superficie-alterna`: el anillo va DENTRO de una banda
  /// que ya usa ese tono de fondo, y con los dos iguales la
  /// parte vacia del anillo desaparecia.
  const radio = 30;
  const circunferencia = 2 * Math.PI * radio;
  const avance = Math.max(0, Math.min(porcentaje, 100));

  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 72 72"
      role="img"
      aria-label={`${etiqueta ? `${etiqueta}: ` : ""}${avance.toFixed(1).replace(".", ",")} por ciento`}
      className="shrink-0"
    >
      <circle cx="36" cy="36" r={radio} fill="none" stroke="var(--hairline)" strokeWidth="6" />
      <circle
        cx="36"
        cy="36"
        r={radio}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${(avance / 100) * circunferencia} ${circunferencia}`}
        transform="rotate(-90 36 36)"
        className="transition-[stroke-dasharray] duration-500"
      />
      {/* Sin cifra DENTRO del anillo.
          A 60px el porcentaje quedaba en 15px apretado contra
          el trazo, y ademas se repetia con el numero grande de
          al lado. El anillo dice la proporcion; el numero, el
          dato. Cada uno una cosa. El valor exacto sigue estando
          para quien no ve el dibujo: va en el `aria-label`. */}
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
      {/* El PORCENTAJE es la cifra grande, y el conteo va
          debajo. Es lo que hace el demo, y tiene su logica: el
          anillo dibuja una proporcion, asi que la cifra que lo
          acompania tiene que ser esa misma proporcion. Con el
          conteo arriba, el dibujo y el numero decian cosas
          distintas y habia que traducir de uno a otro.

          El porcentaje vivia DENTRO del anillo en 15px; al
          bajar el anillo a 60px ya no cabia, y aqui se lee
          mejor. */}
      <div className="min-w-0">
        <p className="text-[1.5rem] font-bold leading-none tracking-[-0.025em] tabular-nums text-titulo">
          {porcentaje.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %
        </p>
        <p className="mt-1 text-[0.71875rem] text-texto-suave">
          <span className="font-semibold text-texto">
            {typeof cifra === "number" ? n(cifra) : cifra}
          </span>{" "}
          {detalle}
        </p>
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
                  className="w-[30%] max-w-6 rounded-t-[5px] transition-opacity hover:opacity-70"
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
  /// Coma decimal, que es la de aqui: `toFixed` da «0.0», y en
  /// la misma pantalla convivia con los «6,9 %» que ya salian
  /// bien de `toLocaleString`. Dos separadores distintos en una
  /// cifra y otra se lee como un fallo, y lo es.
  const pct = porcentaje.toLocaleString("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const texto = `${n(valor)} de ${n(maximo)} · ${pct} %`;

  return (
    <div>
      {etiqueta && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0">{etiqueta}</span>
          <span className="shrink-0 tabular-nums text-texto-suave">
            <strong className="font-semibold text-texto">{n(valor)}</strong> de{" "}
            {n(maximo)} · {pct} %
          </span>
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
          className="h-full rounded-full bg-gradient-to-r from-marca to-marca/40 transition-[width] duration-500"
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
  sufijoUno,
  vacio = "Sin datos todavía.",
  maximoFilas,
}: {
  /// `clave` cuando dos filas puedan llamarse igual: «AF1 ·
  /// grupo 1» existe en los dos gremios. Sin ella React
  /// entiende que son la misma fila y una de las dos
  /// desaparece o se duplica.
  datos: Array<{ clave?: string; etiqueta: string; valor: number; detalle?: string }>;
  sufijo?: string;
  /**
   * El sufijo cuando la fila vale UNO.
   *
   * Sin esto, `sufijo=" personas"` escribía «BOGOTÁ D.C · 1
   * personas» —lo delató una medición del 21 sep 2026—. La lista
   * no puede saber si su sufijo se pluraliza, así que lo dice
   * quien llama; si no lo dice, se usa el mismo y no pasa nada
   * (con « %» o «cupos/día» no hay singular que escribir).
   */
  sufijoUno?: string;
  vacio?: string;
  maximoFilas?: number;
}) {
  /// «Y 8 MÁS» TENÍA QUE PODER ABRIRSE.
  ///
  /// Era un renglón de texto muerto: «y 8 más» —«pero ¿cuáles
  /// son?» (cliente, 21 sep 2026)—. La lista se corta para que un
  /// ranking de treinta departamentos no empuje media pantalla,
  /// y eso sigue bien; lo que estaba mal es que el resto no
  /// tuviera puerta. Ahora la tiene, y nace cerrada.
  ///
  /// El estado va aquí y no en quien llama: el corte es cosa de
  /// esta lista, y así se abre cada una por su cuenta sin que
  /// abrir la de departamentos abra también la de asesores.
  const [todas, setTodas] = useState(false);

  if (!datos.length) {
    return <p className="py-6 text-center text-sm text-texto-suave">{vacio}</p>;
  }

  const recorta = Boolean(maximoFilas) && datos.length > (maximoFilas ?? 0);
  const visibles = recorta && !todas ? datos.slice(0, maximoFilas) : datos;
  /// El tope sale de TODAS las filas y no de las visibles: si
  /// saliera de las visibles, al abrir la lista las barras se
  /// reescalarían y la primera se encogería sin que su cifra
  /// haya cambiado.
  const tope = Math.max(...datos.map((d) => d.valor), 1);

  return (
    <ul className="space-y-2.5">
      {visibles.map((d, i) => (
        // la posición cierra el paso a cualquier repetido que
        // quede: esta lista es un ranking fijo, no se reordena
        // ni se filtra en el navegador
        <li key={d.clave ?? `${d.etiqueta}#${i}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate" title={d.etiqueta}>
              {d.etiqueta}
            </span>
            <span className="shrink-0 tabular-nums">
              {n(d.valor)}
              {d.valor === 1 ? (sufijoUno ?? sufijo) : sufijo}
              {d.detalle && <span className="ml-2 text-xs text-texto-suave">{d.detalle}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-superficie-alterna">
            <div
              className="h-full rounded-full bg-gradient-to-r from-marca to-marca/40"
              style={{ width: `${(d.valor / tope) * 100}%` }}
            />
          </div>
        </li>
      ))}
      {recorta && (
        <li className="pt-1">
          {/* DICE CUÁNTAS Y QUÉ VA A PASAR AL PULSARLO. «Y 8 más»
              no era ni una cifra que se pueda usar ni un camino a
              ninguna parte. */}
          <button
            type="button"
            onClick={() => setTodas((v) => !v)}
            className="text-xs font-medium text-marca underline underline-offset-2 hover:text-marca-fuerte"
          >
            {todas
              ? `Ver solo las ${n(maximoFilas ?? 0)} primeras`
              : `Ver las otras ${n(datos.length - (maximoFilas ?? 0))}`}
          </button>
        </li>
      )}
    </ul>
  );
}

// estado

const ESTADOS: Record<
  EstadoSemaforo,
  { texto: string; clase: string }
> = {
  DISPONIBLE: {
    texto: "Disponible",
    clase: "text-exito",
  },
  ULTIMOS_CUPOS: {
    texto: "Últimos cupos",
    clase: "text-aviso",
  },
  COMPLETO: { texto: "Completo", clase: "text-error" },
};

/**
 * Icono + texto, nunca solo color.
 *
 * Sin fondo tenido: el color va en la letra y en el icono. Era
 * una pildora rellena, y en una tabla de catorce ubicaciones
 * catorce rectangulos de color pesan mas que las cifras que uno
 * vino a comparar. El icono se queda -- es lo que hace que el
 * estado se lea en papel y sin distinguir el color.
 */
export function EtiquetaEstado({ estado }: { estado: EstadoSemaforo }) {
  const e = ESTADOS[estado];
  return (
    /// Sin icono.
    ///
    /// Estaba para que «Completo» y «Ultimos cupos» se
    /// distinguieran sin color: rojo y ambar quedan a ΔE 4,9 bajo
    /// deuteranopia. Pero lo que de verdad los distingue es la
    /// PALABRA, que sigue ahi: la regla es no depender del color
    /// solo, y el texto ya la cumple. El icono era refuerzo.
    <span
      className={`whitespace-nowrap text-[0.75rem] font-semibold ${e.clase}`}
    >
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
              className="w-full rounded-t-[5px] bg-marca transition-opacity"
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
export function formatoPorcentaje(valor: number, total: number): string {
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
  tamano = 188,
  centro,
  detalleCentro,
  vacio = "Sin datos todavía.",
  soloDibujo = false,
}: {
  datos: PorcionDonut[];
  tamano?: number;
  centro?: string;
  detalleCentro?: string;
  vacio?: string;
  /**
   * Solo el anillo, sin su leyenda.
   *
   * Para cuando quien llama ya pinta la lista —con barras, o
   * con otra cifra al lado— y la leyenda de aquí seria la misma
   * informacion dos veces en la misma tarjeta.
   */
  soloDibujo?: boolean;
}) {
  if (!datos.length) {
    return <p className="py-6 text-center text-sm text-texto-suave">{vacio}</p>;
  }

  /// Las medidas del prototipo: lienzo de 132, radio 52 y
  /// trazo de 17, dibujado a 188px. Estaba en 100/38/13 a
  /// 148px -- el mismo dibujo a otra escala --, y al lado del
  /// anillo de 60px la relacion entre los dos no era la del
  /// disenio.
  const radio = 52;
  const circunferencia = 2 * Math.PI * radio;
  const suma = datos.reduce((t, d) => t + Math.max(d.valor, 0), 0);
  const conColor = datos.map((d, i) => ({
    ...d,
    color: d.color ?? CICLO_SERIE[i % CICLO_SERIE.length],
  }));
  const dibujables = conColor.filter((d) => d.valor > 0);
  // separación entre porciones
  const hueco = dibujables.length > 1 ? 1.5 : 0;

  /// EL TOTAL VA DENTRO, SIEMPRE.
  ///
  /// Quien llama pasaba `detalleCentro="personas"` y no `centro`,
  /// así que el agujero del anillo decía «personas» a secas: la
  /// palabra sin la cifra. «Adentro del personas el total, como
  /// está en Tráfico del formulario» (cliente, 21 sep 2026) —allí
  /// sí se pasaba, y por eso esa pantalla se veía terminada y
  /// estas cuatro no.
  ///
  /// Sale de la suma de las porciones y no de un dato aparte: es
  /// la cifra que el propio anillo reparte, así que no puede
  /// contradecir a la leyenda de al lado.
  const enElCentro = centro ?? n(suma);

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
    <div
      className={
        soloDibujo
          ? "flex shrink-0"
          : "flex w-full flex-col items-center gap-5 sm:flex-row"
      }
    >
      <svg
        width={tamano}
        height={tamano}
        viewBox="0 0 132 132"
        role="img"
        aria-label={conColor
          .map((d) => `${d.etiqueta}: ${n(d.valor)}, ${formatoPorcentaje(d.valor, suma)}`)
          .join(". ")}
        className="shrink-0"
      >
        <circle
          cx="66"
          cy="66"
          r={radio}
          fill="none"
          stroke="var(--hairline)"
          strokeWidth="17"
        />
        {segmentos.map((s, i) => (
          <circle
            key={`${s.etiqueta}-${i}`}
            cx="66"
            cy="66"
            r={radio}
            fill="none"
            stroke={s.color}
            strokeWidth="17"
            strokeDasharray={`${Math.max(s.largo - hueco, 0.8)} ${circunferencia}`}
            strokeDashoffset={-s.desfase}
            transform="rotate(-90 66 66)"
            className="transition-[stroke-dasharray] duration-500"
          >
            <title>{`${s.etiqueta}: ${n(s.valor)}`}</title>
          </circle>
        ))}
        {suma === 0 && (
          /// Todo a cero: una raya en el centro. Sin ella, un
          /// anillo gris y vacío se lee como «esto no cargó»
          /// cuando lo que dice es «aquí no hay nadie».
          <text
            x="66"
            y={detalleCentro ? 64 : 74}
            textAnchor="middle"
            fontSize="26.5"
            fontWeight="700"
            fill="var(--texto-suave)"
          >
            —
          </text>
        )}
        {suma > 0 && (
          /// Centrado en 66 y reescalado con el lienzo.
          ///
          /// El texto seguia en las coordenadas del lienzo de
          /// 100 -- x=50 -- y con el de 132 se quedaba a la
          /// izquierda del centro. Los cuerpos salen de los del
          /// prototipo (38px y 12,5px sobre 188 de render) por
          /// la escala del lienzo: 132/188 = 0,702.
          <text
            x="66"
            y={detalleCentro ? 64 : 74}
            textAnchor="middle"
            fontSize="26.5"
            fontWeight="700"
            fill="var(--titulo)"
            style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}
          >
            {enElCentro}
          </text>
        )}
        {detalleCentro && (
          <text x="66" y="80" textAnchor="middle" fontSize="8.8" fill="var(--texto-suave)">
            {detalleCentro}
          </text>
        )}
      </svg>

      {!soloDibujo && (
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
      )}
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

/// EL MISMO ALTO QUE ANTES (era `h-40`): el bloque de tráfico no
/// da un salto con este arreglo.
const ALTO_BARRAS = 160;
/// MEDIO RENGLÓN DE AIRE ARRIBA. La cifra del tope va centrada
/// sobre su raya, así que la mitad de su renglón queda por encima
/// de la raya más alta. Sin este hueco se metía en la leyenda.
const AIRE_ARRIBA = 9;
/// EL CANAL DEL EJE, y por qué tiene un mínimo y no un valor
/// fijo: las cifras de tráfico no tienen techo conocido --son
/// visitas-- y «12.500» no cabe en lo que cabe «50». El ancho de
/// verdad se mide con lienzo en el efecto; esto es el suelo.
const ANCHO_EJE_MINIMO = 34;
/// Entre la cifra del eje y el principio del dibujo.
const AIRE_DEL_EJE = 6;
/// NINGUNA BARRA TOCA UN CANTO. El defecto que reportó el
/// cliente: la primera barra arrancaba a 1 px del canto interior
/// de la tarjeta y se leía como parte del borde.
const AIRE_INTERIOR = 6;
/// La separación entre columnas NO puede parecerse a la que hay
/// entre las dos barras de una misma columna: si se parecen, las
/// cuatro barras de dos días seguidos se leen como un solo
/// bloque --«se fusiona con la barra», dijo el cliente--. Seis
/// contra dos es lo que hace que la pareja se vea como pareja.
const SEPARACION_MINIMA = 6;
const SEPARACION_PAREJA = 2;
/// LA SEPARACIÓN CRECE CON LA COLUMNA, como en el embudo por
/// día: el 15 % del paso, con suelo y techo, y redondeada a
/// cuatro para que no cambie con cada píxel de arrastre.
const SEPARACION_MAXIMA = 24;
/// Por debajo de esto la pareja de barras son dos hilos: se sube
/// un peldaño de grano --de día a semana-- en vez de empujar la
/// página a lo ancho. Un poco más que en el embudo porque aquí
/// cada columna lleva DOS barras y su aire de en medio.
const MINIMO_POR_COLUMNA = 24;
/// Aunque quepan, más de 31 columnas no se leen.
const MAXIMO_COLUMNAS = 31;
/// EL TOPE DE ANCHO DE UNA COLUMNA, que es el otro defecto del
/// reporte: con tres días en una pantalla de 1.600 px salían dos
/// losas de 253 px pegadas a la izquierda. Con tope, pocas
/// columnas se centran y queda aire a los lados; la pareja mide
/// como mucho 96 px, o sea 47 px por barra.
const MAXIMO_POR_COLUMNA = 96;
/// El suelo de una barra con gente: por debajo de tres píxeles no
/// se distingue del filete con el que se marca el día en cero, y
/// eso es justo lo contrario de lo que hay que ver.
const MINIMO_BARRA = 3;
/// Más de siete fechas bajo el eje no se leen de un vistazo.
const MAXIMO_ROTULOS = 7;
/// Un cuadratín entero de aire entre dos fechas escritas: con
/// menos se leen como un solo bloque.
const AIRE_ENTRE_FECHAS = 10;
/// Las fechas y las cifras del eje, en píxeles, para poder
/// medirlas con lienzo con la misma letra con la que se pintan.
const LETRA_EJE = 10;

/// LAS DOS SERIES, METIDAS EN DOS CASILLAS DEL MÓDULO DEL EMBUDO.
///
/// `agrupar-dias.ts` no sabe qué son sus cuatro números: los
/// rellena, los agrupa y los suma. Y lo que hace falta de él es
/// justo lo que no se debe volver a escribir: el relleno de los
/// días sin dato, el lunes como principio de semana, el ISO leído
/// a mediodía --en UTC se corría un día en Bogotá, que es lo que
/// hacía el `siguienteDia` que había aquí-- y los rótulos
/// «8–14 sep». Se reusa tal cual y no se toca.
const CASILLA_A = "entraron" as const;
const CASILLA_B = "contactados" as const;

/**
 * Une las dos series en un día por fila.
 *
 * Ya NO rellena los huecos: de eso se encarga `rellenarDias`, que
 * además sabe hasta dónde llega el periodo. Aquí solo se cruzan
 * las dos listas por día.
 */
function unirPorDia(
  a: Array<{ dia: string; total: number }>,
  b: Array<{ dia: string; total: number }>,
): DiaDelEmbudo[] {
  const porDia = new Map<string, DiaDelEmbudo>();
  const meter = (
    lista: Array<{ dia: string; total: number }>,
    casilla: typeof CASILLA_A | typeof CASILLA_B,
  ) => {
    for (const d of lista) {
      const fila =
        porDia.get(d.dia) ??
        { dia: d.dia, entraron: 0, contactados: 0, conDatos: 0, inscritos: 0 };
      /// Se SUMA en vez de asignar: si la respuesta trae el mismo
      /// día dos veces --pasa cuando se cruzan dos orígenes-- lo
      /// honrado es sumarlos, no quedarse con el último.
      fila[casilla] += d.total;
      porDia.set(d.dia, fila);
    }
  };
  meter(a, CASILLA_A);
  meter(b, CASILLA_B);
  return [...porDia.values()].sort((x, y) => x.dia.localeCompare(y.dia));
}

/// Los peldaños con los que se redondea el tope del eje. El tope
/// es SIEMPRE el doble de uno de ellos, así que la raya de la
/// mitad cae en un número entero y el eje no miente.
///
/// COPIADO A PROPÓSITO de `embudo-por-dia`, no importado: ese
/// archivo ya trae `n` y `dec` de este, y traerse su `topeBonito`
/// cerraría el círculo entre los dos módulos. Sacarlo a un tercer
/// archivo es tocar código que hoy no es mío.
const PASOS_DEL_EJE = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** El tope del eje, redondeado hacia arriba a una cifra redonda. */
function topeDelEje(cima: number): number {
  const medio = Math.max(0.5, cima / 2);
  const escala = 10 ** Math.floor(Math.log10(medio));
  for (const p of PASOS_DEL_EJE) {
    const paso = p * escala;
    if (paso >= medio && Number.isInteger(paso)) return paso * 2;
  }
  return Math.ceil(medio) * 2;
}

/**
 * El canal del eje SUPUESTO, mientras el lienzo no ha medido.
 *
 * Con el mínimo a secas, un tope de cinco cifras se salía de la
 * tarjeta por la izquierda en el primer pintado. Seis píxeles por
 * carácter sobra para una letra de 10 px.
 */
function ejeSupuesto(tope: number): number {
  return Math.max(ANCHO_EJE_MINIMO, n(tope).length * 6 + AIRE_DEL_EJE + 2);
}

/**
 * Dos series diarias enfrentadas, columna a columna.
 *
 * Tiene el mismo esqueleto que el embudo por día --el que aprobó
 * el cliente--: eje Y con su canal propio a la izquierda, tope de
 * ancho por columna, fechas centradas bajo su columna y grano que
 * se agrupa cuando no caben todos los días. Lo que había eran
 * tres rayas cruzando el dibujo con su cifra `absolute right-0`
 * encima de las barras, columnas de `flex-1` sin tope --dos losas
 * con tres días de dato-- y dos fechas puestas con
 * `justify-between`, ninguna debajo de su columna.
 */
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

  /**
   * El GRANO y el CANAL en estado; el ancho, en una referencia.
   *
   * Guardar el ancho en estado es repintar en cada píxel que se
   * arrastra, y con un `ResizeObserver` encima eso se realimenta.
   * Lo que de verdad cambia el dibujo son valores DISCRETOS --qué
   * vale una columna, cuánto mide el canal del eje, cuánto aire
   * va entre columnas, cada cuántas se escribe una fecha--, y el
   * objeto se devuelve igual cuando ninguno se movió.
   */
  const caja = useRef<HTMLDivElement>(null);
  const ancho = useRef(0);
  const [medida, setMedida] = useState<{
    grano: Grano;
    anchoEje: number;
    separacion: number;
    cada: number;
    sangraInicio: number;
    sangraFin: number;
  } | null>(null);

  const llenos = useMemo(
    () => rellenarDias(unirPorDia(a.datos, b.datos)),
    [a.datos, b.datos],
  );

  useEffect(() => {
    const nodo = caja.current;
    if (!nodo || llenos.length === 0) return;

    /// Un lienzo suelto para medir texto: `measureText` da el
    /// ancho de verdad con la letra de la casa. A ojo --tantos
    /// píxeles por carácter-- se elige mal justo en el caso
    /// límite, que es cuando se rotulan todas las fechas.
    const medidor = document.createElement("canvas").getContext("2d");
    if (medidor) medidor.font = `${LETRA_EJE}px ${getComputedStyle(nodo).fontFamily}`;
    const anchoDe = (t: string) =>
      medidor ? medidor.measureText(t).width : t.length * 6;

    const medir = (w: number) => {
      ancho.current = w;
      /// DOS PASADAS, y no es capricho: el canal del eje depende
      /// de la cifra más alta, la cifra más alta depende del
      /// grano --al agrupar por semanas cada columna suma siete
      /// días-- y el grano depende del ancho que deja el canal.
      /// Se empieza por el canal mínimo y se vuelve a preguntar
      /// con el de verdad.
      let anchoEje = ANCHO_EJE_MINIMO;
      let grano: Grano = "dia";
      let cubetas: Cubeta[] = [];
      for (let pasada = 0; pasada < 2; pasada += 1) {
        const util = w - anchoEje - 2 * AIRE_INTERIOR;
        const maximo = Math.min(
          MAXIMO_COLUMNAS,
          Math.max(7, Math.floor(util / MINIMO_POR_COLUMNA)),
        );
        grano = granoQueCabe(llenos, maximo);
        cubetas = agruparPor(llenos, grano);
        const tope = topeDelEje(
          Math.max(1, ...cubetas.map((c) => Math.max(c[CASILLA_A], c[CASILLA_B]))),
        );
        anchoEje = Math.max(
          ANCHO_EJE_MINIMO,
          Math.ceil(anchoDe(n(tope)) + AIRE_DEL_EJE + 2),
        );
      }

      const cuantas = Math.max(1, cubetas.length);
      const util = Math.max(1, w - anchoEje - 2 * AIRE_INTERIOR);
      /// El paso es lo que le toca a cada columna CON su aire.
      const bruto = Math.max(1, util / cuantas);
      const separacion = Math.min(
        SEPARACION_MAXIMA,
        Math.max(SEPARACION_MINIMA, Math.round((bruto * 0.15) / 4) * 4),
      );
      const porColumna = Math.min(MAXIMO_POR_COLUMNA, bruto - separacion);
      const paso = porColumna + separacion;

      let anchoRotulo = 0;
      for (const c of cubetas) anchoRotulo = Math.max(anchoRotulo, anchoDe(c.etiqueta));
      /// Ni dos fechas más juntas de un cuadratín, ni más de
      /// siete en total.
      const cada = Math.max(
        1,
        Math.ceil(cuantas / MAXIMO_ROTULOS),
        Math.ceil((anchoRotulo + AIRE_ENTRE_FECHAS) / Math.max(1, paso)),
      );

      /// LO QUE SE SALE DE LOS EXTREMOS, EN PÍXELES.
      ///
      /// Las fechas van todas centradas bajo su columna, que es lo
      /// que hace que un eje de tiempo se lea como de paso
      /// constante. Lo único que hay que corregir es que el rótulo
      /// de un extremo se salga de la tarjeta, y se corre
      /// exactamente lo que sobra. El ancho DE VERDAD de la
      /// columna sale del reparto de `flex-1` y no del
      /// `porColumna` redondeado.
      const columnaReal = Math.min(
        MAXIMO_POR_COLUMNA,
        (util - (cuantas - 1) * separacion) / cuantas,
      );
      const holgura = Math.max(
        0,
        (util - (cuantas * columnaReal + (cuantas - 1) * separacion)) / 2,
      );
      const ultimoRotulado = Math.floor((cuantas - 1) / cada) * cada;
      const sobraPrimera = (anchoDe(cubetas[0]?.etiqueta ?? "") - columnaReal) / 2;
      const sobraUltima =
        ultimoRotulado === cuantas - 1
          ? (anchoDe(cubetas[cuantas - 1]?.etiqueta ?? "") - columnaReal) / 2
          : 0;
      /// Bajo el eje el canal está vacío --las cifras viven a la
      /// altura del dibujo--, así que la primera fecha puede
      /// invadirlo. A la derecha solo hay el aire interior.
      const nueva = {
        grano,
        anchoEje,
        separacion,
        cada,
        /// `ceil` y no `round`: quedarse a un píxel corto deja el
        /// rótulo fuera de la tarjeta, que es el defecto.
        sangraInicio: Math.ceil(
          Math.max(0, sobraPrimera - holgura - AIRE_INTERIOR - anchoEje),
        ),
        sangraFin: Math.ceil(Math.max(0, sobraUltima - holgura - AIRE_INTERIOR)),
      };
      /// El MISMO objeto cuando nada cambió: así React no repinta
      /// y el observador no se muerde la cola.
      setMedida((v) =>
        v &&
        v.grano === nueva.grano &&
        v.anchoEje === nueva.anchoEje &&
        v.separacion === nueva.separacion &&
        v.cada === nueva.cada &&
        v.sangraInicio === nueva.sangraInicio &&
        v.sangraFin === nueva.sangraFin
          ? v
          : nueva,
      );
    };

    medir(nodo.getBoundingClientRect().width);
    const observador = new ResizeObserver((entradas) => {
      const w = entradas[0]?.contentRect.width ?? 0;
      if (Math.abs(w - ancho.current) < 1) return;
      medir(w);
    });
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [llenos]);

  /// Mientras no hay medida, el grano sale de CUÁNTOS días hay.
  /// Suponer un ancho --el de un celular, por ejemplo-- hacía
  /// saltar la maquetación en escritorio en cuanto llegaba la
  /// medida de verdad.
  const grano = medida?.grano ?? granoInicial(llenos.length);
  const separacion = medida?.separacion ?? SEPARACION_MINIMA;
  const cubetas = useMemo(() => agruparPor(llenos, grano), [llenos, grano]);

  const colorA = a.color ?? SERIE.uno;
  const colorB = b.color ?? SERIE.dos;
  const totalA = cubetas.reduce((s, c) => s + c[CASILLA_A], 0);
  const totalB = cubetas.reduce((s, c) => s + c[CASILLA_B], 0);

  if (cubetas.length === 0) {
    return <p className="py-8 text-center text-[0.84375rem] text-texto-suave">{vacio}</p>;
  }

  const tope = topeDelEje(
    Math.max(1, ...cubetas.map((c) => Math.max(c[CASILLA_A], c[CASILLA_B]))),
  );
  const anchoEje = medida?.anchoEje ?? ejeSupuesto(tope);
  const alto = (v: number) =>
    v <= 0 ? 0 : Math.max(MINIMO_BARRA, Math.round((v / tope) * ALTO_BARRAS));

  /// QUÉ COLUMNAS LLEVAN FECHA: ancladas a la primera --0, cada,
  /// 2·cada…--, que es como el paso del eje sale parejo. La
  /// última puede quedarse sin rótulo: esa fecha ya la dice la
  /// cabecera del bloque.
  const cada = medida?.cada ?? Math.max(1, Math.ceil(cubetas.length / MAXIMO_ROTULOS));
  const hayParciales = cubetas.some((c) => c.parcial);
  /// Con `?? null` porque al cambiar de grano --o de periodo--
  /// mientras el puntero está encima, el índice puede quedar
  /// fuera del arreglo nuevo.
  const detalle = encima !== null ? (cubetas[encima] ?? null) : null;

  const series = [
    { nombre: a.nombre, color: colorA, casilla: CASILLA_A, total: totalA },
    { nombre: b.nombre, color: colorB, casilla: CASILLA_B, total: totalB },
  ];

  return (
    /// `min-w-0`: sin él este gráfico le pide a su columna de la
    /// rejilla el ancho de su contenido más ancho.
    <div ref={caja} className="min-w-0">
      {/* LA LEYENDA, con el total del periodo de cada serie: es la
          cifra con la que se comprueba a mano que el gráfico
          cuadra con las tarjetas de arriba. */}
      <ul className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-texto">
        {series.map((s) => (
          <li key={s.nombre} className="inline-flex items-center gap-1.5">
            <span
              className="block h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: s.color }}
              aria-hidden
            />
            {s.nombre}{" "}
            <span className="font-semibold text-titulo tabular-nums">{n(s.total)}</span>
          </li>
        ))}
      </ul>

      <div className="relative" style={{ height: AIRE_ARRIBA + ALTO_BARRAS }}>
        {/* LA REJILLA: cero, la mitad y el tope, cada una con su
            cifra EN EL CANAL DE LA IZQUIERDA. Antes la cifra iba
            `absolute right-0`, o sea encima de las barras de la
            derecha, y no había canal: por eso «no se veía la
            línea». */}
        {[1, 0.5, 0].map((f) => (
          <div
            key={f}
            className="pointer-events-none absolute right-0 border-t"
            style={{
              left: anchoEje,
              top: AIRE_ARRIBA + (1 - f) * ALTO_BARRAS,
              /// LA RAYA DEL CERO NO ES UNA RAYA DE REJILLA: es la
              /// línea de base sobre la que se apoyan las barras.
              /// Pintada igual que las otras dos, el gráfico
              /// parecía flotar y la barra se comía la raya.
              borderTopColor:
                f === 0
                  ? "color-mix(in oklab, var(--texto-suave) 80%, var(--superficie))"
                  : "var(--hairline)",
            }}
          >
            <span
              className="absolute -top-[7px] right-full text-[0.625rem] whitespace-nowrap text-texto-suave tabular-nums"
              style={{ paddingRight: AIRE_DEL_EJE }}
            >
              {n(Math.round(tope * f))}
            </span>
          </div>
        ))}

        {/* CADA COLUMNA, SU CASILLA; Y LAS CASILLAS, A TODO LO
            ANCHO.
            Estuvo con el grupo centrado y tope por casilla, y con
            tres días en una tarjeta de 1.500 px eso dejaba las
            tres barras apiñadas en el medio con 613 px de vacío a
            cada lado --medido--. El vacío ya lo había parado el
            cliente antes: «¿cómo se pierde todo este espacio?».
            Ahora la casilla se reparte el ancho --`flex-1`, sin
            tope-- y el tope se lo lleva la PAREJA DE BARRAS de
            dentro: con pocos días quedan repartidas y esbeltas, y
            con muchos se juntan hasta tocarse. Es lo que hace una
            hoja de cálculo con tres categorías.
            El área va metida `AIRE_INTERIOR` por los dos lados,
            que es lo que hace que ninguna barra toque un canto. */}
        <div
          className="absolute flex items-end"
          style={{
            left: anchoEje + AIRE_INTERIOR,
            right: AIRE_INTERIOR,
            top: AIRE_ARRIBA,
            bottom: 0,
            gap: separacion,
          }}
        >
          {cubetas.map((c, i) => {
            const apagada = encima !== null && encima !== i;
            return (
              <button
                key={c.clave}
                type="button"
                /// Botón y no `div`: en celular no hay puntero, y
                /// TOCAR la columna es lo que enseña sus cifras.
                /// De paso llega por teclado.
                className="flex h-full min-w-0 flex-1 cursor-default items-end justify-center transition-opacity"
                style={{ opacity: apagada ? 0.45 : 1 }}
                aria-label={`${c.etiquetaLarga}: ${a.nombre} ${n(c[CASILLA_A])}, ${
                  b.nombre
                } ${n(c[CASILLA_B])}`}
                onMouseEnter={() => setEncima(i)}
                onMouseLeave={() => setEncima(null)}
                onFocus={() => setEncima(i)}
                onBlur={() => setEncima(null)}
                /// Fija y no alterna: en el celular el toque dispara
                /// `mouseenter` y `focus` antes que `click`, y al
                /// alternar el primer toque no enseñaba nada. Es el
                /// mismo defecto medido en «Cómo fue entrando la
                /// gente» el 21 sep 2026.
                onClick={() => setEncima(i)}
              >
                {/* LA PAREJA, con el tope. Va en su propia caja y
                    no en el botón: el botón es la CASILLA --la
                    zona que se puede señalar, que conviene ancha--
                    y esto es el DIBUJO, que conviene esbelto. */}
                <span
                  className="flex h-full w-full items-end justify-center"
                  style={{ maxWidth: MAXIMO_POR_COLUMNA, gap: SEPARACION_PAREJA }}
                >
                {series.map((s) => {
                  const v = c[s.casilla];
                  return (
                    <span
                      key={s.nombre}
                      className="block min-w-0 flex-1 rounded-t-[3px]"
                      style={{
                        /// UN CERO ES UN DATO, no un hueco: se
                        /// dibuja como un filete de 2 px del color
                        /// del borde. Sin esto, un día sin gente y
                        /// un día que no vino en la respuesta se
                        /// verían igual.
                        height: v > 0 ? alto(v) : 2,
                        background: v > 0 ? s.color : "var(--borde)",
                      }}
                    />
                  );
                })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* EL EJE X. Las fechas llevan el mismo tope, el mismo aire
          y la misma separación que las columnas, así que cada una
          cae bajo la suya. Antes eran dos --la primera y la
          última-- puestas con `justify-between`. */}
      <div
        className="mt-1.5 flex justify-center"
        style={{
          marginLeft: anchoEje + AIRE_INTERIOR,
          marginRight: AIRE_INTERIOR,
          gap: separacion,
        }}
      >
        {cubetas.map((c, i) => {
          /// Solo se corrige lo que DE VERDAD se sale de la
          /// tarjeta, en píxeles medidos (ver `sangraInicio` y
          /// `sangraFin`). Alinear la primera y la última a su
          /// borde «por si acaso» es lo que hacía que el eje
          /// pareciera de paso irregular.
          const corrimiento =
            i === 0
              ? (medida?.sangraInicio ?? 0)
              : i === cubetas.length - 1
                ? -(medida?.sangraFin ?? 0)
                : 0;
          return (
            <span
              key={c.clave}
              /// CENTRADA DE VERDAD sobre su columna: con `flex-1
              /// text-center` y un rótulo más ancho que su
              /// casilla, Chrome no desborda hacia el borde de
              /// inicio y corre la fecha a la derecha. Con la
              /// casilla vacía y el texto centrado por
              /// `translateX(-50%)`, la fecha cae en el eje de su
              /// columna y se sale por los dos lados por igual.
              ///
              /// NUNCA se recorta: se sale hacia las casillas de
              /// al lado, que están vacías a propósito --`cada`
              /// se calcula midiendo el rótulo más largo contra
              /// el paso entre columnas--. Con `truncate` el eje
              /// de un celular decía «31 ago – …», que no dice de
              /// qué mes es.
              /// SIN TOPE, igual que la casilla de arriba: la
              /// fecha va centrada en el eje de SU casilla, y si
              /// la casilla no midiera lo mismo que allá, la fecha
              /// dejaría de caer bajo su columna.
              className="relative min-w-0 flex-1 text-[0.625rem] whitespace-nowrap text-texto-suave tabular-nums"
            >
              <span
                className="absolute top-0 left-1/2 whitespace-nowrap"
                style={{ transform: `translateX(calc(-50% + ${corrimiento}px))` }}
              >
                {i % cada === 0 ? c.etiqueta : ""}
              </span>
            </span>
          );
        })}
      </div>

      {/* EL DETALLE, en su renglón de siempre. El hueco se reserva
          para que el bloque no dé un salto al señalar, y mientras
          nadie señala nada DICE QUE ESTÁ AHÍ: treinta píxeles en
          blanco bajo un gráfico se leen como algo que no cargó. */}
      <div className="mt-2 min-h-[34px]">
        {detalle ? (
          <p className="rounded-[9px] bg-superficie-alterna px-3 py-1.5 text-[0.8125rem] leading-snug">
            <span className="font-semibold text-titulo">{detalle.etiquetaLarga}</span>
            <span className="text-texto-suave">
              {" "}
              · {a.nombre}: {n(detalle[CASILLA_A])} · {b.nombre}:{" "}
              {n(detalle[CASILLA_B])}
            </span>
          </p>
        ) : (
          <p className="px-3 py-1.5 text-[0.8125rem] leading-snug text-texto-suave">
            Señale una columna —con el puntero o tocándola— para ver sus cifras.
          </p>
        )}
      </div>

      <p className="mt-1 text-[0.6875rem] leading-snug text-texto-suave">
        {QUE_ES_UNA_COLUMNA[grano]}
        {hayParciales &&
          " La primera y la última pueden cubrir menos días que las demás, así que salen más bajas."}
      </p>

      {/* Las dos series en texto, que es la costumbre de los
          gráficos de esta casa. */}
      <p className="sr-only">
        {cubetas
          .map(
            (c) =>
              `${c.etiquetaLarga}: ${c[CASILLA_A]} ${a.nombre}, ${c[CASILLA_B]} ${b.nombre}`,
          )
          .join(". ")}
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
      {titulo && (
        <p className="text-[0.6875rem] leading-none text-texto-suave">{titulo}</p>
      )}
      {/* El mismo cuerpo que `Cifra`: dos escalas para el mismo
          tipo de dato es lo que hacía que la pantalla se leyera
          como pedazos de pantallas distintas. */}
      <p
        className={`mt-1 text-[1.0625rem] font-bold leading-none tabular-nums ${TONO_TEXTO[tono]}`}
      >
        {hay ? `${porciento.toFixed(1).replace(".", ",")} %` : "—"}
      </p>
      <p className="mt-1 text-[0.6875rem] tabular-nums text-texto-suave">
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
  /// Por omision no se encoge, que es lo que quiere una chispa
  /// metida en una linea de texto. Con `w-full h-auto` se
  /// estira a lo que mida su columna: el `viewBox` ya esta
  /// puesto, asi que escala sin deformarse.
  clase = "shrink-0",
}: {
  datos: number[];
  ancho?: number;
  alto?: number;
  color?: string;
  etiqueta?: string;
  clase?: string;
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
      className={clase}
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

// area de una serie

/**
 * La serie de un periodo, con el area rellena.
 *
 * Hermana de `Chispa` y no la misma: la chispa es un trazo que
 * cabe en una linea de texto y no lleva escala. Esta es la
 * grafica de un bloque -- se estira a su columna, marca el
 * ultimo dia con un punto y deja los dos extremos rotulados --,
 * que es lo que hace falta cuando la serie ES el contenido y no
 * un adorno al lado de una cifra.
 *
 * El degradado va de la marca al vacio: da volumen sin meter un
 * segundo color, que en una serie de un solo dato seria un
 * color que no significa nada.
 */
export function AreaDeSerie({
  datos,
  alto = 132,
  desde,
  hasta,
  etiqueta,
}: {
  datos: number[];
  alto?: number;
  /** Rotulo del extremo izquierdo. */
  desde?: string;
  /** Y del derecho. */
  hasta?: string;
  etiqueta?: string;
}) {
  if (!datos.length) return null;

  /// Coordenadas en una caja fija que el `viewBox` escala: asi
  /// la grafica se adapta al ancho sin recalcular nada.
  const ancho = 600;
  const margen = 6;
  const maximo = Math.max(...datos);
  const minimo = Math.min(...datos);
  const plano = maximo === minimo;
  const paso = datos.length > 1 ? (ancho - margen * 2) / (datos.length - 1) : 0;

  const puntos = datos.map((v, i) => {
    const x = margen + i * paso;
    const y = plano
      ? alto / 2
      : alto - margen - ((v - minimo) / (maximo - minimo)) * (alto - margen * 2);
    return [x, y] as const;
  });

  const trazo = puntos.map(([x, y]) => `${x},${y}`).join(" ");
  const ultimo = puntos[puntos.length - 1];
  /// El area cierra contra el suelo de la caja, no contra el
  /// minimo: cerrar contra el minimo deja el relleno flotando.
  const relleno = `${margen},${alto} ${trazo} ${ultimo[0]},${alto}`;
  const id = `area-${datos.length}-${Math.round(maximo)}`;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${etiqueta ? `${etiqueta}, ` : ""}de ${n(datos[0])} a ${n(
          datos[datos.length - 1],
        )}`}
        className="h-auto w-full"
        style={{ height: alto }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--marca)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--marca)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <polygon points={relleno} fill={`url(#${id})`} />
        {puntos.length > 1 && (
          <polyline
            points={trazo}
            fill="none"
            stroke="var(--marca)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <circle
          cx={ultimo[0]}
          cy={ultimo[1]}
          r="4"
          fill="var(--superficie)"
          stroke="var(--marca)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {(desde || hasta) && (
        <figcaption className="mt-1 flex justify-between text-[0.6875rem] text-texto-suave">
          <span>{desde}</span>
          <span>{hasta}</span>
        </figcaption>
      )}
    </figure>
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
