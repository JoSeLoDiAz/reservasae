"use client";

/** El embudo: en qué anda cada negocio y cuánto suma. */

/// Dos cifras arriba y nunca una sola. «Sobre la mesa» es el
/// tamaño del embudo y «esperado» es lo que un adulto cuenta con
/// cobrar; enseñar solo la primera es como los CRMs cuentan
/// historias bonitas, y enseñar solo la segunda esconde cuánto
/// trabajo hay encima.
///
/// Y una advertencia que no se quita hasta que sea mentira: las
/// probabilidades son un supuesto mientras no haya cierres propios
/// con los que recalcularlas.

import { useCallback, useEffect, useState } from "react";

import { Bloque, Cargando, Pildora, Vacio } from "@/components/admin/piezas";
import { Aviso } from "@/components/admin/marco-admin";
import { ErrorApi } from "@/lib/api";
import {
  enPesos,
  haceCuanto,
  oportunidadesApi,
  type ColumnaDelEmbudo,
  type OportunidadEnTablero,
  type SinRespuesta,
  type Tablero,
  type TipoEmbudo,
} from "@/lib/oportunidades-api";

const EMBUDOS: Array<{ valor: TipoEmbudo; rotulo: string; abajo: string }> = [
  { valor: "EMPRESA", rotulo: "Empresas", abajo: "Semanas o meses" },
  { valor: "PERSONA", rotulo: "Personas", abajo: "Días" },
];

export default function PaginaEmbudo() {
  const [embudo, setEmbudo] = useState<TipoEmbudo>("EMPRESA");
  const [tablero, setTablero] = useState<Tablero | null>(null);
  const [esperando, setEsperando] = useState<SinRespuesta[]>([]);
  const [cargando, setCargando] = useState(true);
  /// El instante con el que se miden los dias quietos.
  ///
  /// Se fija al traer los datos y no se calcula dentro de cada
  /// ficha: `Date.now()` durante el render es impuro -- React lo
  /// senala -- y ademas daria un instante distinto por tarjeta, de
  /// modo que dos fichas iguales podrian salir con dias distintos.
  const [ahora, setAhora] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (cual: TipoEmbudo) => {
    setCargando(true);
    setError(null);
    try {
      const [t, s] = await Promise.all([
        oportunidadesApi.tablero(cual),
        oportunidadesApi.sinRespuesta(),
      ]);
      setTablero(t);
      setEsperando(s);
      setAhora(Date.now());
    } catch (e) {
      setError(
        e instanceof ErrorApi
          ? e.message
          : "No pudimos traer el embudo. Vuelva a intentarlo.",
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar(embudo);
  }, [cargar, embudo]);

  return (
    /*
      `px-4 pt-4 pb-6` como el resto del panel. Sin esto el contenido
      arranca pegado al borde de la ventana y todo se lee apretado
      por mucho aire que tenga por dentro.
    */
    <div className="flex flex-col gap-6 px-4 pt-4 pb-6">
      {/*
        Una sola franja arriba, no tres tarjetas.
        Aquí había un selector, un bloque de reloj y TRES tarjetas de
        cifra, cada una con su borde: seis objetos con seis marcos
        para tres datos. La regla de esta casa es contar bloques
        antes de tocar tamaños, y seis era el problema.
      */}
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div className="flex gap-2">
          {EMBUDOS.map((e) => (
            <button
              key={e.valor}
              type="button"
              onClick={() => setEmbudo(e.valor)}
              aria-pressed={embudo === e.valor}
              className={`rounded-lg px-3.5 py-2 text-left transition ${
                embudo === e.valor
                  ? "bg-marca text-white"
                  : "opacity-60 hover:bg-current/5 hover:opacity-100"
              }`}
            >
              <span className="block text-sm font-semibold">{e.rotulo}</span>
              <span className="block text-xs opacity-80">{e.abajo}</span>
            </button>
          ))}
        </div>

        {tablero && <Cifras tablero={tablero} />}
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <RelojDeRespuesta esperando={esperando} />

      {cargando && !tablero ? (
        <Cargando que="Armando el embudo…" />
      ) : tablero ? (
        <Columnas tablero={tablero} ahora={ahora} />
      ) : null}
    </div>
  );
}

/**
 * Lo único del tablero que exige una acción HOY.
 *
 * Va arriba de todo y antes que el dinero a propósito. El resto de
 * la pantalla se mira una vez al día; esto se mira ahora, porque
 * cada minuto que una fila pasa aquí vale menos que el anterior:
 * contestar dentro de los primeros cinco minutos multiplica por
 * veintiuno la probabilidad de calificar frente a media hora.
 *
 * Cuando está vacío se dice que está vacío, y se celebra. Un
 * indicador que solo aparece cuando hay problema enseña a la gente
 * a no mirar esa zona de la pantalla.
 */
function RelojDeRespuesta({ esperando }: { esperando: SinRespuesta[] }) {
  const urgentes = esperando.filter((e) => e.minutosEsperando >= 5);

  if (esperando.length === 0) {
    return (
      <div className="rounded-lg border border-borde px-4 py-3 text-sm">
        <span className="font-semibold">Nadie esperando.</span>{" "}
        <span className="opacity-70">
          Todo lo que entró ya tiene una primera respuesta.
        </span>
      </div>
    );
  }

  return (
    <Bloque
      titulo={`${esperando.length} sin primera respuesta`}
      descripcion={
        urgentes.length > 0
          ? `${urgentes.length} llevan más de cinco minutos. Ahí es donde se pierde la venta.`
          : "Todavía dentro de los cinco minutos."
      }
    >
      <ul className="flex flex-col gap-2">
        {esperando.slice(0, 8).map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-baseline justify-between gap-2 border-b border-borde/60 pb-2 last:border-0 last:pb-0"
          >
            <span className="min-w-0">
              <span className="font-mono text-xs opacity-60">{e.codigo}</span>{" "}
              <span className="text-sm">{e.titulo}</span>
              {e.campana && (
                <span className="ml-2 text-xs opacity-60">· {e.campana}</span>
              )}
            </span>
            <Pildora tono={e.minutosEsperando >= 5 ? "error" : "aviso"}>
              {haceCuanto(e.minutosEsperando)}
            </Pildora>
          </li>
        ))}
      </ul>
    </Bloque>
  );
}

/**
 * Las dos cifras, en línea y sin marco.
 *
 * Las dos y nunca una: «sobre la mesa» es el tamaño del embudo y
 * «esperado» es lo que un adulto cuenta con cobrar. Enseñar solo la
 * primera es como los CRMs cuentan historias bonitas; enseñar solo
 * la segunda esconde cuánto trabajo hay encima.
 */
function Cifras({ tablero }: { tablero: Tablero }) {
  const { pronostico } = tablero;
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
      <div>
        <span className="block text-[11px] uppercase tracking-wide opacity-55">
          Sobre la mesa
        </span>
        <span className="block text-2xl font-semibold tabular-nums leading-tight">
          {enPesos(pronostico.total)}
        </span>
        <span className="block text-xs opacity-60">
          {pronostico.cuantas} abiertas
        </span>
      </div>
      <div>
        <span className="block text-[11px] uppercase tracking-wide opacity-55">
          Esperado
        </span>
        <span className="block text-2xl font-semibold tabular-nums leading-tight">
          {enPesos(pronostico.ponderado)}
        </span>
        <span className="block text-xs opacity-60">
          {pronostico.probabilidadesEstimadas
            ? "con probabilidades estimadas"
            : "con probabilidades propias"}
        </span>
      </div>
    </div>
  );
}

function Columnas({ tablero, ahora }: { tablero: Tablero; ahora: number }) {
  const conAlgo = tablero.columnas.some((c) => c.cuantas > 0);

  if (!conAlgo) {
    return (
      <Vacio titulo="Todavía no hay oportunidades">
        Cuando entre un lead y alguien lo tome, aparecerá aquí en «Captado».
      </Vacio>
    );
  }

  /**
   * Los cerrados NO son columnas.
   *
   * Aquí estaban las siete etapas en fila, y siete columnas de ancho
   * fijo no caben en ninguna pantalla: «Ganado» quedaba cortado a la
   * derecha y para ver el embudo entero había que arrastrar. Un
   * tablero que no se ve entero no es un tablero.
   *
   * Y el arreglo no era estrechar las columnas, era quitar las que
   * sobran: lo ganado y lo perdido ya no se trabaja. Van abajo, en
   * una línea, que es todo el sitio que merecen en la pantalla donde
   * se decide a qué dedicar la semana.
   *
   * Las abiertas se reparten el ancho disponible en vez de medir lo
   * mismo pase lo que pase: cinco en empresas, tres en personas, y
   * en una ventana estrecha se envuelven solas.
   */
  const abiertas = tablero.columnas.filter(
    (c) => c.etapa !== "GANADO" && c.etapa !== "PERDIDO",
  );
  const cerradas = tablero.columnas.filter(
    (c) => c.etapa === "GANADO" || c.etapa === "PERDIDO",
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-5">
        {abiertas.map((c) => (
          <Columna key={c.etapa} columna={c} ahora={ahora} />
        ))}
      </div>

      <Cerradas columnas={cerradas} />

      {tablero.pronostico.probabilidadesEstimadas && (
        <p className="max-w-prose text-xs opacity-55">
          Los porcentajes de cada columna son <strong>estimados</strong>: salen
          de la forma del embudo, no de nuestro histórico. Se recalculan con los
          primeros cierres propios, y por embudo separado.
        </p>
      )}
    </div>
  );
}

/** Lo ya cerrado, en una línea. No se trabaja: se cuenta. */
function Cerradas({ columnas }: { columnas: ColumnaDelEmbudo[] }) {
  const hayAlgo = columnas.some((c) => c.cuantas > 0);
  if (!hayAlgo) return null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-borde pt-4 text-sm">
      {columnas.map((c) => (
        <span key={c.etapa} className="flex items-baseline gap-2">
          <span className="opacity-55">{c.rotulo}</span>
          <span className="font-medium">
            {c.cuantas === 1 ? "1 negocio" : `${c.cuantas} negocios`}
          </span>
          <span className="tabular-nums opacity-70">{enPesos(c.total)}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Una columna sin caja.
 *
 * El encabezado era una tarjeta con borde encima de tarjetas con
 * borde: un marco alrededor de cada marco. Ahora es un rótulo con
 * una regla debajo, que separa igual y no compite con las fichas.
 */
function Columna({ columna, ahora }: { columna: ColumnaDelEmbudo; ahora: number }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="border-b-2 border-borde pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-semibold">{columna.rotulo}</h3>
          <span className="shrink-0 text-xs tabular-nums opacity-55">
            {columna.probabilidad} %
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2 pt-0.5">
          <span className="text-xs opacity-55">
            {columna.cuantas === 1 ? "1 negocio" : `${columna.cuantas} negocios`}
          </span>
          <span className="text-xs font-medium tabular-nums">
            {enPesos(columna.total)}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {columna.oportunidades.length === 0 ? (
          <p className="py-6 text-center text-xs opacity-35">Vacía</p>
        ) : (
          columna.oportunidades.map((o) => <Ficha key={o.id} o={o} ahora={ahora} />)
        )}
      </div>
    </section>
  );
}

function Ficha({ o, ahora }: { o: OportunidadEnTablero; ahora: number }) {
  /// Los días quieta se calculan aquí y no en el servidor porque
  /// dependen de cuándo se MIRA la pantalla, no de cuándo se pidió
  /// el dato. Con el tablero abierto media hora, un cálculo del
  /// servidor se queda viejo sin avisar.
  const diasQuieta = Math.floor(
    (ahora - new Date(o.ultimoToqueEn).getTime()) / 86_400_000,
  );

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-borde px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[0.7rem] opacity-45">{o.codigo}</span>
        {diasQuieta >= 7 && <Pildora tono="aviso">{diasQuieta} d quieta</Pildora>}
      </div>

      <p className="text-sm font-medium leading-snug">{o.titulo}</p>

      {o.deQuien && <p className="text-xs opacity-65">{o.deQuien}</p>}

      <div className="flex items-baseline justify-between gap-2 border-t border-borde/50 pt-2.5">
        <span className="text-base font-semibold tabular-nums">
          {o.valor > 0 ? enPesos(o.valor) : "Sin valor"}
        </span>
        <span
          className={`text-xs ${o.asesor ? "opacity-60" : "font-medium text-error"}`}
        >
          {o.asesor?.nombre ?? "Sin dueño"}
        </span>
      </div>

      {o.campana && (
        <span className="text-[0.7rem] opacity-50">{o.campana}</span>
      )}
    </article>
  );
}
