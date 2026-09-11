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
///
/// LA FORMA, igual que en el Resumen: bandas a sangre que se tocan
/// y a las que separa una regla de 1 px. La de en medio es el
/// tablero, y se come el alto que sobre.

import { useCallback, useEffect, useState } from "react";

import { Cargando, Vacio as TableroVacio } from "@/components/admin/piezas";
import { Banda } from "@/components/admin/piezas-de-venta";
import {
  Cliente,
  Codigo,
  Persona,
  colorDeEtapa,
  Dinero,
  Etapa,
  Porcentaje,
  Puerta,
  Reloj,
  Rotulo,
} from "@/components/admin/datos-del-negocio";
import { CajonOportunidad } from "@/components/admin/cajon-oportunidad";
import { Aviso } from "@/components/admin/marco-admin";
import { ErrorApi } from "@/lib/api";
import {
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

/// Una semana quieta es el umbral de «esto lleva parado», y el
/// reloj mide minutos: aquí se traduce una sola vez.
const MINUTOS_POR_DIA = 1_440;
const UMBRAL_QUIETA = 7 * MINUTOS_POR_DIA;

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
  /// Cual esta abierta de lado. El tablero se queda detras.
  const [abierta, setAbierta] = useState<string | null>(null);
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
    <div className="flex min-h-0 w-full grow flex-col">
      {/*
        Una sola franja arriba, no tres tarjetas.
        Aquí había un selector, un bloque de reloj y TRES tarjetas de
        cifra, cada una con su borde: seis objetos con seis marcos
        para tres datos. La regla de esta casa es contar bloques
        antes de tocar tamaños, y seis era el problema.
      */}
      <Banda>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="flex gap-2">
            {EMBUDOS.map((e) => (
              <button
                key={e.valor}
                type="button"
                onClick={() => setEmbudo(e.valor)}
                aria-pressed={embudo === e.valor}
                className={
                  "rounded-xs px-3 py-2 text-left transition-colors " +
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-campo-foco " +
                  (embudo === e.valor
                    ? "bg-marca text-marca-texto"
                    : "text-texto hover:bg-superficie-alterna")
                }
              >
                <span className="block text-[0.8125rem] leading-[1.4]">
                  {e.rotulo}
                </span>
                <span
                  className={
                    "block text-[0.65625rem] leading-[1.3] tracking-[0.02em] " +
                    (embudo === e.valor ? "" : "text-texto-suave")
                  }
                >
                  {e.abajo}
                </span>
              </button>
            ))}
          </div>

          {tablero && <Cifras tablero={tablero} />}
        </div>
      </Banda>

      {error && (
        <Banda>
          <Aviso tipo="error">{error}</Aviso>
        </Banda>
      )}

      <Espera esperando={esperando} />

      {cargando && !tablero ? (
        <Banda crece sinRegla>
          <Cargando que="Armando el embudo…" />
        </Banda>
      ) : tablero ? (
        <Columnas tablero={tablero} ahora={ahora} alAbrir={setAbierta} />
      ) : null}

      <CajonOportunidad
        id={abierta}
        alCerrar={() => setAbierta(null)}
        alCambiar={() => void cargar(embudo)}
      />
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
 *
 * Era un bloque con cabecera teñida de azul. Ahora es una banda más,
 * con el mismo marco que todas: lo que la distingue no es un fondo
 * de color, es que es la única de la pantalla donde puede salir
 * algo caliente.
 */
function Espera({ esperando }: { esperando: SinRespuesta[] }) {
  const urgentes = esperando.filter((e) => e.minutosEsperando >= 5);

  if (esperando.length === 0) {
    return (
      <Banda>
        <p className="text-[0.8125rem] text-texto">
          Nadie esperando.{" "}
          <span className="text-texto-suave">
            Todo lo que entró ya tiene una primera respuesta.
          </span>
        </p>
      </Banda>
    );
  }

  return (
    <Banda>
      <p className="text-[0.8125rem] text-texto">
        <span className="font-semibold tabular-nums text-error">
          {esperando.length}
        </span>{" "}
        sin primera respuesta
        <span className="text-texto-suave">
          {" · "}
          {urgentes.length > 0
            ? `${urgentes.length} llevan más de cinco minutos. Ahí es donde se pierde la venta.`
            : "Todavía dentro de los cinco minutos."}
        </span>
      </p>

      <ul className="mt-3 flex flex-col">
        {esperando.slice(0, 8).map((e) => (
          <li
            key={e.id}
            className="flex items-baseline justify-between gap-4 border-t border-hairline py-2 first:border-0 first:pt-0"
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <Codigo>{e.codigo}</Codigo>
              <span className="truncate text-[0.8125rem] text-texto">
                {e.titulo}
              </span>
              {e.campana && <Puerta campana={e.campana} />}
            </span>
            <Reloj minutos={e.minutosEsperando} umbral={5} vencido />
          </li>
        ))}
      </ul>
    </Banda>
  );
}

/**
 * Las dos cifras, en línea y sin marco.
 *
 * Las dos y nunca una: «sobre la mesa» es el tamaño del embudo y
 * «esperado» es lo que un adulto cuenta con cobrar. Enseñar solo la
 * primera es como los CRMs cuentan historias bonitas; enseñar solo
 * la segunda esconde cuánto trabajo hay encima.
 *
 * «Sobre la mesa» es la cifra de portada de esta pantalla: 34 px, y
 * lo más grande que hay en ella. Antes lo más grande y más negro de
 * la pantalla eran las palabras «Sin valor» de una ficha, o sea que
 * la ausencia de plata pesaba más que la plata.
 */
function Cifras({ tablero }: { tablero: Tablero }) {
  const { pronostico } = tablero;
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
      <div>
        <Rotulo>Sobre la mesa</Rotulo>
        <p className="mt-1">
          <Dinero valor={pronostico.total} portada />
        </p>
        <p className="secundario mt-1">
          {pronostico.cuantas} abiertas
        </p>
      </div>
      <div>
        <Rotulo>Esperado</Rotulo>
        <p className="mt-1">
          {/* Apagado mientras las probabilidades sean del modelo:
              el gris dice «esto es un supuesto». */}
          <Dinero
            valor={pronostico.ponderado}
            tamano="columna"
            supuesto={pronostico.probabilidadesEstimadas}
          />
        </p>
        <p className="secundario mt-1">
          {pronostico.probabilidadesEstimadas
            ? "con probabilidades estimadas"
            : "con probabilidades propias"}
        </p>
      </div>
    </div>
  );
}

function Columnas({
  tablero,
  ahora,
  alAbrir,
}: {
  tablero: Tablero;
  ahora: number;
  alAbrir: (id: string) => void;
}) {
  const conAlgo = tablero.columnas.some((c) => c.cuantas > 0);

  if (!conAlgo) {
    return (
      <Banda crece sinRegla>
        <TableroVacio titulo="Todavía no hay oportunidades">
          Cuando entre un lead y alguien lo tome, aparecerá aquí en «Captado».
        </TableroVacio>
      </Banda>
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
   */
  const abiertas = tablero.columnas.filter(
    (c) => c.etapa !== "GANADO" && c.etapa !== "PERDIDO",
  );
  const cerradas = tablero.columnas.filter(
    (c) => c.etapa === "GANADO" || c.etapa === "PERDIDO",
  );

  return (
    <>
      {/*
        UN TABLERO SE DESPLAZA EN HORIZONTAL. NO SE ENVUELVE. NUNCA.

        Aquí había `grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]`, y
        eso es exactamente lo que lo partió: cinco columnas de 224 px
        más cuatro separaciones no caben en el ancho útil, `auto-fit`
        está para envolver, y «En negociación» se caía al segundo
        renglón. Un kanban que se parte en dos deja de ser un kanban:
        la etapa que se cae parece de otro tablero.

        Columna de 268 px de SUELO, y lo que sobre repartido entre
        las cinco. Las dos mitades de esa regla hacen falta:

        - El suelo, porque en 1440 con la barra lateral no caben las
          cinco: se ven cuatro y la quinta asoma un dedo. QUE ASOME
          ES LA SEÑAL —dice que hay más embudo a la derecha— y es
          mejor que cinco columnas espichadas donde no cabe una
          cifra de ocho dígitos.
        - El reparto, porque a 1920 las cinco de 268 px terminan en
          1664 y la banda llega a 1896: 232 px de blanco al canto
          derecho, que es de lo que el dueño se queja. Aquí el
          sobrante NO se gasta abriendo columna: las columnas de un
          tablero son las etapas del embudo, y cuáles son ya está
          decidido —lo ganado y lo perdido van al pie, que no se
          trabajan—. Así que se reparte, y a 1920 la ficha mide 314
          y le cabe el título en dos renglones en vez de tres.

        El `-mx-6 px-6` es para que la barra de desplazamiento cruce
        la banda entera y las fichas conserven el mismo relleno de
        24 px que todo lo demás.
      */}
      {/*
        EL ALTO DEL TABLERO SE DECLARA, NO SE HEREDA.

        Aquí ponía `Banda crece` con `min-h-0 grow`, que pide el alto
        al padre. Y el padre —el área de contenido de `marco-admin`,
        línea 338— es `overflow-y-auto`: ya es un contenedor que
        desplaza. Un hijo con `grow` dentro de algo que desplaza no
        hereda alto; con `min-h-0` encima, **colapsa a cero**. El
        tablero salía de 100 px con dos barras anidadas dentro y las
        tarjetas invisibles.

        La cadena de `grow` es correcta cuando todos los ancestros
        cooperan, y aquí no cooperan. Se declara el alto contra la
        ventana y se acabó la dependencia: `100dvh` menos el marco
        (franja de pruebas, cabecera, la fila de cifras, el reloj y
        el pie). El `min-h` es el suelo: en una pantalla baja el
        tablero mide 26rem y desplaza, en vez de desaparecer.

        `dvh` y no `vh`: en el móvil, `vh` cuenta la barra del
        navegador que se esconde al bajar, y el tablero quedaría
        cortado justo por debajo del pliegue.
      */}
      <Banda className="overflow-hidden">
        <div
          className="-mx-6 grid h-[calc(100dvh-25rem)] min-h-[26rem] grid-flow-col auto-cols-[minmax(268px,1fr)] gap-4 overflow-x-auto overscroll-x-contain px-6"
        >
          {abiertas.map((c) => (
            <Columna
              key={c.etapa}
              columna={c}
              ahora={ahora}
              estimadas={tablero.pronostico.probabilidadesEstimadas}
              alAbrir={alAbrir}
            />
          ))}
        </div>
      </Banda>

      <Banda sinRegla>
        <Cerradas columnas={cerradas} />

        {tablero.pronostico.probabilidadesEstimadas && (
          <p className="mt-3 max-w-[68ch] text-[0.65625rem] leading-[1.3] tracking-[0.02em] text-texto-suave">
            Los porcentajes de cada columna son estimados: salen de la forma del
            embudo, no de nuestro histórico. Se recalculan con los primeros
            cierres propios, y por embudo separado.
          </p>
        )}
      </Banda>
    </>
  );
}

/** Lo ya cerrado, en una línea. No se trabaja: se cuenta. */
function Cerradas({ columnas }: { columnas: ColumnaDelEmbudo[] }) {
  const hayAlgo = columnas.some((c) => c.cuantas > 0);
  if (!hayAlgo) return null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
      {columnas.map((c) => (
        <span key={c.etapa} className="flex items-baseline gap-2">
          <Etapa etapa={c.etapa} rotulo={c.rotulo} />
          <span className="dato tabular-nums text-texto-suave">
            {c.cuantas}
          </span>
          <span className="text-texto-suave">·</span>
          <Dinero valor={c.total} ganado={c.etapa === "GANADO"} />
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
 * una regla de 2 px debajo, y esa regla lleva el color de la etapa:
 * es el ÚNICO color de la cabecera. De gris a azul profundo, cuanto
 * más oscuro más cerca del dinero, de modo que la rampa se lee
 * aunque no se sepan los nombres de las etapas.
 *
 * Y cada columna recorre por dentro. Así el tablero entero cabe en
 * el alto de la pantalla y una columna con nueve fichas no empuja a
 * las otras cuatro hacia abajo.
 */
function Columna({
  columna,
  ahora,
  estimadas,
  alAbrir,
}: {
  columna: ColumnaDelEmbudo;
  ahora: number;
  estimadas: boolean;
  alAbrir: (id: string) => void;
}) {
  /// `h-full` y no `min-h-0`: ahora el tablero SÍ tiene alto propio
  /// —lo declara contra la ventana— así que la columna puede tomarlo
  /// entero y desplazar dentro. Con `min-h-0` volvía a colapsar.
  return (
    <section className="flex h-full min-w-0 flex-col">
      <header
        className="sticky top-0 z-10 shrink-0 bg-superficie pb-2"
        style={{ borderBottom: "2px solid " + colorDeEtapa(columna.etapa) }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-[0.8125rem] leading-[1.3] font-bold text-titulo">
            {columna.rotulo}
          </h3>
          <span className="flex shrink-0 items-baseline gap-1.5">
            <span className="dato tabular-nums text-texto-suave">
              {columna.cuantas}
            </span>
            <span className="text-texto-suave">·</span>
            <Dinero valor={columna.total} />
          </span>
        </div>
      </header>

      {/*
        La columna vacía no dice «Vacía» flotando en 500 px de blanco:
        la regla de color y el `0 · —` de la cabecera ya lo dicen, y
        el hueco en blanco lo dice mejor que una palabra.
      */}
      <div className="flex min-h-0 grow flex-col gap-2 overflow-y-auto overscroll-y-contain pt-3">
        {columna.oportunidades.map((o) => (
          <Ficha key={o.id} o={o} ahora={ahora} alAbrir={alAbrir} />
        ))}
      </div>

      {/*
        El porcentaje baja al pie: es un supuesto, y estaba arriba a
        la derecha, donde debería estar el dinero de la columna.
      */}
      <p className="shrink-0 pt-2 text-right">
        <Porcentaje valor={columna.probabilidad} supuesto={estimadas} tamano="micro" />
      </p>
    </section>
  );
}

/**
 * La ficha: cuatro renglones y ni uno más.
 *
 * Llevaba cinco datos del mismo peso —código, título, empresa,
 * plata, dueño y campaña— y la plata no destacaba. Ahora el dinero
 * va a 20/700 abajo a la izquierda y es lo único grande que tiene.
 * La etapa se fue porque la dice la columna, y la campaña porque se
 * ve al abrir el cajón.
 */
function Ficha({
  o,
  ahora,
  alAbrir,
}: {
  o: OportunidadEnTablero;
  ahora: number;
  alAbrir: (id: string) => void;
}) {
  /// Los días quieta se calculan aquí y no en el servidor porque
  /// dependen de cuándo se MIRA la pantalla, no de cuándo se pidió
  /// el dato. Con el tablero abierto media hora, un cálculo del
  /// servidor se queda viejo sin avisar.
  const diasQuieta = Math.floor(
    (ahora - new Date(o.ultimoToqueEn).getTime()) / 86_400_000,
  );

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => alAbrir(o.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          alAbrir(o.id);
        }
      }}
      className="flex shrink-0 cursor-pointer flex-col gap-2 rounded-xs border border-borde bg-superficie p-3 text-left transition-colors hover:border-marca focus-visible:border-marca focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-campo-foco"
    >
      {/* El reloj solo sale si hay algo que mirar. Cuando no lo hay,
          ese hueco se queda vacío, y eso ya es información. */}
      <div className="flex min-h-[1rem] items-baseline justify-between gap-2">
        <Codigo>{o.codigo}</Codigo>
        {diasQuieta >= 7 && (
          <Reloj minutos={diasQuieta * MINUTOS_POR_DIA} umbral={UMBRAL_QUIETA} />
        )}
      </div>

      <p className="line-clamp-2 text-[0.8125rem] leading-[1.4] text-texto">
        {o.titulo}
      </p>

      {o.deQuien && (
        <p className="truncate text-[0.71875rem] text-texto-suave">
          {/* El sufijo societario, apagado: es obligación legal, no
              identidad, y en una columna es lo único que se repite. */}
          <Cliente nombre={o.deQuien} />
        </p>
      )}

      <div className="flex items-baseline justify-between gap-2">
        <Dinero valor={o.valor} tamano="columna" />
        <span className="min-w-0 shrink text-right">
          <Persona nombre={o.asesor?.nombre} micro />
        </span>
      </div>
    </article>
  );
}
