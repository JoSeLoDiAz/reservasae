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

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { Cargando, Vacio as TableroVacio } from "@/components/admin/piezas";
import { Banda } from "@/components/admin/piezas-de-venta";
import {
  Cliente,
  Codigo,
  Persona,
  colorDeEtapa,
  Dinero,
  Etapa,
  esperaVencida,
  Porcentaje,
  Puerta,
  Reloj,
  Rotulo,
  Senales,
} from "@/components/admin/datos-del-negocio";
import { CajonOportunidad } from "@/components/admin/cajon-oportunidad";
import { NuevoNegocio } from "@/components/admin/nuevo-negocio";
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
  { valor: "EMPRESA", rotulo: "Empresas", abajo: "Ciclo de semanas" },
  { valor: "PERSONA", rotulo: "Personas", abajo: "Ciclo de días" },
];

/// Una semana quieta es el umbral de «esto lleva parado», y el
/// reloj mide minutos: aquí se traduce una sola vez.
const MINUTOS_POR_DIA = 1_440;
const UMBRAL_QUIETA = 7 * MINUTOS_POR_DIA;

/**
 * Qué se dice cuando algo no llega.
 *
 * El mensaje del servidor se enseña tal cual cuando es de los que
 * dicen QUÉ falta —un 403, un 404, uno de validación—, que es lo
 * que sirve. Pero un 500 de Nest llega como «Internal server
 * error», en inglés y sin nada que hacer con él; ahí va la frase
 * de la casa.
 */
function mensajeDe(e: unknown, porDefecto: string): string {
  return e instanceof ErrorApi && e.estado < 500 ? e.message : porDefecto;
}

export default function PaginaEmbudo() {
  const [embudo, setEmbudo] = useState<TipoEmbudo>("EMPRESA");
  const [tablero, setTablero] = useState<Tablero | null>(null);
  /// Quién espera primera respuesta. `null` es «todavía no se
  /// sabe» —porque no ha llegado o porque falló—, y NO es lo mismo
  /// que una lista vacía.
  ///
  /// Arrancaba en `[]`, y con eso la banda decía «Nadie esperando»
  /// mientras cargaba. Con las dos cargas por separado lo diría
  /// también cuando el servidor no contesta, y esa es la mentira
  /// más cara de esta pantalla: tranquiliza justo cuando alguien
  /// puede llevar una hora esperando.
  const [esperando, setEsperando] = useState<SinRespuesta[] | null>(null);
  /// El fallo de la banda, aparte del del tablero: cada una avisa
  /// en su sitio y ninguna tumba a la otra.
  const [errorEspera, setErrorEspera] = useState<string | null>(null);
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

  /// Abrir un negocio desde un enlace: `?abrir=<id>&embudo=PERSONA`.
  /// Lo usan «Para hoy» y la agenda del Resumen, que llevan directo
  /// a la ficha en vez de dejar al asesor buscándola en el tablero.
  /// Se lee una vez al montar, de `window.location`, para no pedirle
  /// a Next un límite de Suspense solo por esto.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("abrir");
    const cual = q.get("embudo");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cual === "PERSONA" || cual === "EMPRESA") setEmbudo(cual);
    if (id) setAbierta(id);
  }, []);
  const [error, setError] = useState<string | null>(null);

  /// El número del último pedido de cada carga.
  ///
  /// Al pasar rápido de «Empresas» a «Personas» vuelan dos pedidos
  /// del tablero a la vez, y el que se pinta es el que llega DE
  /// ÚLTIMO, no el que se pidió de último: podía quedar el tablero
  /// de empresas debajo de la pestaña de personas, con sus cifras
  /// arriba, sin nada que lo delatara. Cada respuesta mira si sigue
  /// siendo la vigente antes de pintarse; si no, se descarta.
  const turnoTablero = useRef(0);
  const turnoEspera = useRef(0);

  /**
   * DOS CARGAS QUE NO SE ESPERAN Y NO SE TUMBAN.
   *
   * Aquí había un `Promise.all` del tablero y de la banda de
   * espera, y `Promise.all` falla entero en cuanto falla uno: un
   * 500 de `sin-respuesta` se llevaba por delante el tablero, que
   * había llegado bien, y la pantalla quedaba en «No pudimos traer
   * el embudo». La banda es una ayuda y el tablero es la pantalla;
   * que la ayuda tumbe la pantalla es al revés.
   *
   * Tampoco es un `Promise.allSettled`: con eso ya no se tumban,
   * pero el tablero se sigue quedando esperando a la banda para
   * pintarse. Por separado, cada una se pinta cuando llega y avisa
   * en su sitio cuando falla.
   *
   * Ninguna de las dos toca el estado ANTES del primer `await`. Lo
   * que hay que limpiar al empezar —el «cargando», el aviso viejo—
   * se limpia en el clic que la pide (`elegirEmbudo`,
   * `reintentarEspera`), y el aviso de antes se quita cuando llega
   * la respuesta buena, no al salir el pedido: así un tablero que
   * se refresca tras guardar en el cajón no hace parpadear el aviso.
   */
  const cargarTablero = useCallback(async (cual: TipoEmbudo) => {
    const turno = ++turnoTablero.current;
    try {
      const t = await oportunidadesApi.tablero(cual);
      if (turno !== turnoTablero.current) return;
      setTablero(t);
      setAhora(Date.now());
      setError(null);
    } catch (e) {
      if (turno !== turnoTablero.current) return;
      /// Si lo que hay en pantalla es del OTRO embudo —se cambió de
      /// pestaña y el pedido nuevo falló—, se quita: el aviso encima
      /// del tablero de empresas, con «Personas» marcada, se lee
      /// como que personas tiene lo de empresas. El del mismo embudo
      /// sí se queda: es de hace un momento y sigue sirviendo.
      setTablero((antes) => (antes?.embudo === cual ? antes : null));
      setError(
        mensajeDe(e, "No pudimos traer el embudo. Vuelva a intentarlo."),
      );
    } finally {
      if (turno === turnoTablero.current) setCargando(false);
    }
  }, []);

  const cargarEspera = useCallback(async () => {
    const turno = ++turnoEspera.current;
    try {
      const s = await oportunidadesApi.sinRespuesta();
      if (turno !== turnoEspera.current) return;
      setEsperando(s);
      setErrorEspera(null);
    } catch (e) {
      if (turno !== turnoEspera.current) return;
      /// Lo que hubiera de antes se suelta, no se deja a la vista.
      /// Una lista de espera vieja puede decir «Nadie esperando»
      /// cuando ya entró alguien, y de todo lo que esta banda puede
      /// decir, eso es lo único que no se puede permitir. Mejor
      /// «no sabemos» que un «nadie» falso.
      setEsperando(null);
      setErrorEspera(
        mensajeDe(e, "Revise la conexión y vuelva a intentarlo."),
      );
    }
  }, []);

  /// Las dos a la vez, cada una por su lado. La banda se vuelve a
  /// pedir también al cambiar de pestaña, aunque no dependa del
  /// embudo —se filtra aquí—: es barata, y es lo que más rápido se
  /// queda viejo en toda la pantalla.
  const cargar = useCallback(
    (cual: TipoEmbudo) => {
      void cargarTablero(cual);
      void cargarEspera();
    },
    [cargarTablero, cargarEspera],
  );

  /// La regla `set-state-in-effect` se apaga en esta línea sola y
  /// con motivo: aquí nada se pinta de forma síncrona —las dos
  /// cargas escriben el estado después de su `await`—, pero la regla
  /// no sigue el `async` y marca igual cualquier setter alcanzable.
  /// Se comprobó con un componente mínimo: la marca sale aunque el
  /// único `setState` esté detrás del `await`.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar(embudo);
  }, [cargar, embudo]);

  /// Cambiar de pestaña: lo que se limpia, se limpia aquí. Sin el
  /// «cargando», una pestaña cuyo tablero había fallado se quedaba
  /// en blanco en vez de decir «Armando el embudo…».
  const elegirEmbudo = (cual: TipoEmbudo) => {
    if (cual === embudo) return;
    setCargando(true);
    setError(null);
    setEmbudo(cual);
  };

  /// Solo la banda. Se quita el aviso al pulsar, y la banda pasa a
  /// «Revisando…» mientras tanto: sin eso, el botón no da señal de
  /// haber hecho nada hasta que vuelve la respuesta.
  const reintentarEspera = () => {
    setErrorEspera(null);
    void cargarEspera();
  };

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
                onClick={() => elegirEmbudo(e.valor)}
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
          {/* Crear a mano. Si el negocio quedó en el otro embudo, se
              cambia de pestaña y el efecto recarga; en los dos casos
              se abre la ficha del negocio recién creado. */}
          <NuevoNegocio
            embudo={embudo}
            alCrear={(id, cual) => {
              if (cual === embudo) cargar(embudo);
              else elegirEmbudo(cual);
              setAbierta(id);
            }}
          />
        </div>
      </Banda>

      {error && (
        <Banda>
          <Aviso tipo="error">{error}</Aviso>
        </Banda>
      )}

      {/* Solo los del embudo de la pestaña: mezclaba personas en
          «Empresas», mientras las cifras de arriba sí filtraban.
          Si la banda falló, el aviso sale AQUÍ y en letra pequeña:
          el tablero de abajo se pinta igual. */}
      <Espera
        esperando={esperando?.filter((e) => e.embudo === embudo) ?? null}
        error={errorEspera}
        alReintentar={reintentarEspera}
      />

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
        alCambiar={() => cargar(embudo)}
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
 *
 * Y tiene dos estados más que no son «alguien» ni «nadie»: todavía
 * no ha llegado, y no llegó. Los dos se dicen como lo que son, en
 * letra pequeña y sin rojo —el rojo de este panel dice que alguien
 * lleva esperando, y un servidor caído no es eso—, pero sin
 * disfrazarse nunca de «Nadie esperando».
 */
function Espera({
  esperando,
  error,
  alReintentar,
}: {
  /** `null`: todavía no se sabe. */
  esperando: SinRespuesta[] | null;
  error: string | null;
  alReintentar: () => void;
}) {
  if (error) {
    return (
      <Banda>
        <div
          role="status"
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
        >
          <p className="secundario">
            <span className="text-texto">
              No pudimos ver quién espera primera respuesta.
            </span>{" "}
            {error}
          </p>
          {/* Reintentar solo esta banda, no la pantalla: el tablero
              llegó bien y volver a pedirlo es gastar para nada. */}
          <button
            type="button"
            onClick={alReintentar}
            className="secundario rounded-xs border border-borde px-2 py-0.5 text-texto transition-colors hover:bg-superficie-alterna focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-campo-foco"
          >
            Reintentar
          </button>
        </div>
      </Banda>
    );
  }

  if (esperando === null) {
    return (
      <Banda>
        <p role="status" className="secundario">
          Revisando quién espera primera respuesta…
        </p>
      </Banda>
    );
  }

  /// CADA UNA CONTRA SU COMPROMISO, no todas contra cinco minutos.
  ///
  /// Esto era `minutosEsperando >= 5` para los dos embudos, y esta
  /// banda enseña los dos a la vez —lo que está esperando no se
  /// filtra por la pestaña—. Un negocio de empresa salía aquí como
  /// urgente a los seis minutos, cuando su compromiso son
  /// veinticuatro horas; y el `>=` además contaba como incumplido
  /// al que contestó justo en el minuto cinco.
  ///
  /// `esperaVencida` ya existía y ya hacía esto bien —la usa el
  /// cajón desde siempre—; solo que esta banda no la llamaba.
  const urgentes = esperando.filter((e) =>
    esperaVencida(e.minutosEsperando, e.embudo),
  );

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
          {/* Sin decir «cinco minutos»: aquí salen los dos
              embudos y el compromiso de cada uno es distinto
              —cinco minutos en personas, un día en empresas—. La
              frase decía cinco para las dos y era falsa en la
              mitad de los casos. */}
          {urgentes.length > 0
            ? `${urgentes.length} pasaron del tiempo comprometido. Ahí es donde se pierde la venta.`
            : "Todas dentro del tiempo comprometido."}
        </span>
      </p>

      <ul className="mt-3 flex flex-col">
        {esperando.slice(0, 8).map((e) => (
          <li
            key={e.id}
            className="flex items-baseline justify-between gap-4 border-t border-hairline py-2 first:border-0 first:pt-0"
          >
            {/* En el teléfono no caben código, título y puerta en un renglón:
                se truncaba a «Googl…». Ahí la fila se parte, y la puerta va
                en un solo bloque para que el «·» no quede suelto. */}
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 sm:flex-nowrap">
              <Codigo>{e.codigo}</Codigo>
              <span className="min-w-0 max-w-full truncate text-[0.8125rem] text-texto">
                {e.titulo}
              </span>
              {e.campana && (
                <span className="min-w-0 max-w-full truncate">
                  <Puerta campana={e.campana} />
                </span>
              )}
            </span>
            <Reloj minutos={e.minutosEsperando} embudo={e.embudo} vencido />
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
 *
 * «Valor COTIZADO en curso» y no «Valor en curso»: desde que el
 * negocio guarda también lo facturado, «valor» a secas ya no dice
 * cuál de los dos es. Esta suma es lo que se le ha cotizado a lo
 * que sigue abierto, y es el rótulo de aquí arriba el que le da
 * nombre a todas las cifras del tablero de abajo.
 */
function Cifras({ tablero }: { tablero: Tablero }) {
  const { pronostico } = tablero;
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
      <div>
        <Rotulo>Valor cotizado en curso</Rotulo>
        <p className="mt-1">
          <Dinero valor={pronostico.total} portada />
        </p>
        <p className="secundario mt-1">
          {pronostico.cuantas} abiertas
        </p>
      </div>
      <div>
        <Rotulo>Pronóstico</Rotulo>
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
          Cuando entre un lead y alguien lo tome, aparecerá aquí en «Solicitud de negocio».
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
            Los porcentajes de cada columna son estimados. Se ajustarán con
            los cierres reales de cada embudo.
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
          {/* Lo ganado aquí es lo COTIZADO de lo ganado, no lo que
              ya se facturó. En verde se lee como plata que entró, y
              el `title` es lo que deja deshacer esa lectura. */}
          <DineroCotizado titulo="Valor cotizado">
            <Dinero valor={c.total} ganado={c.etapa === "GANADO"} />
          </DineroCotizado>
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
            <DineroCotizado titulo="Valor cotizado de la etapa">
              <Dinero valor={columna.total} />
            </DineroCotizado>
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
 *
 * El renglón de más —«40 licencias · Google Workspace Business
 * Standard»— va pegado debajo de la plata y se gana el sitio: una
 * cifra sin lo que compra no se puede juzgar. $ 46.500.000 es un
 * buen negocio si son cuarenta licencias y uno regalado si son
 * cuatrocientas. Va en micro y apagado, así que no le compite a la
 * cifra; y no sale en los negocios que nacieron antes del
 * portafolio, que siguen siendo de cuatro renglones.
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
  const compra = queSeVende(o);

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

      {/* Muerto viviente y bananeo, DESPUÉS de la identidad.

          Estuvieron entre el título y el cliente, y partían en dos
          lo que se lee como una sola cosa: qué se vende y a quién.
          Aquí van pegadas al dinero, que es donde la marca
          importa: lo que dicen es que esa cifra de arriba no es de
          fiar.

          Tampoco arriba con el reloj: el reloj mide cuánto lleva
          quieta y estas dicen que el negocio está podrido; juntas
          en la misma línea se leen como grados de lo mismo.

          Salen solo cuando hay algo. La ficha sigue siendo de
          cuatro renglones en el caso normal, que es el que se
          repite treinta veces en una columna. */}
      <Senales senales={o.senales} />

      {/* La plata y lo que compra, en un solo bloque con 2 px entre
          los dos y no los 8 del resto de la ficha: separados a la
          misma distancia que el cliente, el renglón pequeño se leía
          como un dato más y no como el detalle de la cifra. */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <DineroCotizado titulo="Valor cotizado">
            <Dinero valor={o.valor} tamano="columna" />
          </DineroCotizado>
          <span className="min-w-0 shrink text-right">
            <Persona nombre={o.asesor?.nombre} micro />
          </span>
        </div>

        {/* Un renglón y recortado, con el texto entero en el
            `title`: hay nombres del portafolio de sesenta letras, y
            en dos renglones la ficha crecía por el dato que menos
            se mira. */}
        {compra && (
          <p className="micro truncate" title={compra}>
            {compra}
          </p>
        )}
      </div>
    </article>
  );
}

/**
 * Una cifra del tablero que es lo COTIZADO.
 *
 * El negocio guarda dos platas desde que se factura: lo que se
 * cotizó y lo que de verdad se facturó. Todas las cifras de esta
 * pantalla son la primera —el campo `valor`, que en pantalla se
 * llama «Valor cotizado»—, y nada en una cabecera de 268 px ni en
 * una ficha deja escribirlo al lado de cada una sin llenar el
 * tablero de la misma palabra treinta veces. Lo nombra el rótulo
 * de arriba, «Valor cotizado en curso», y aquí se dice al pasar el
 * puntero y al lector de pantalla, que no ve el rótulo de arriba
 * cuando recorre las fichas una por una.
 */
function DineroCotizado({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <span title={titulo} className="shrink-0">
      <span className="sr-only">{titulo}: </span>
      {children}
    </span>
  );
}

/// Miles con punto, como en toda la casa: «1.200 licencias».
const MILES = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

/**
 * «40 licencias · Google Workspace Business Standard».
 *
 * Cantidad con su unidad, y el servicio. Cada mitad sale sola si
 * la otra falta: sin cantidad, solo el servicio; sin unidad, solo
 * el número —«40 · Google Workspace…»—, que junto al nombre del
 * servicio se entiende. Solo el caso de una cantidad sin servicio
 * se escribe «Cantidad: 40», porque un «40» suelto en una ficha no
 * dice de qué. Y si no hay ni lo uno ni lo otro, no hay renglón.
 */
function queSeVende(o: OportunidadEnTablero): string | null {
  const nombre = o.servicio?.nombre?.trim() || null;
  const cuantos = o.cantidad !== null && o.cantidad > 0 ? o.cantidad : null;
  const unidad = unidadDe(o.servicio);

  const cantidad =
    cuantos === null
      ? null
      : unidad
        ? `${MILES.format(cuantos)} ${cuantos === 1 ? unidad : enPlural(unidad)}`
        : nombre
          ? MILES.format(cuantos)
          : `Cantidad: ${MILES.format(cuantos)}`;

  const partes = [cantidad, nombre].filter((p): p is string => Boolean(p));
  return partes.length > 0 ? partes.join(" · ") : null;
}

/**
 * La unidad del servicio, si el tablero la trae.
 *
 * Desde el 18 sep 2026 el tablero la manda (`servicio: { nombre,
 * unidad }`). Se sigue leyendo con cuidado —si viene, se usa; si
 * no, sale solo el número— porque un negocio viejo puede no tener
 * servicio, y un servicio puede tener la unidad en blanco.
 */
function unidadDe(servicio: OportunidadEnTablero["servicio"]): string | null {
  if (!servicio || !("unidad" in servicio)) return null;
  const { unidad } = servicio;
  return typeof unidad === "string" && unidad.trim() ? unidad.trim() : null;
}

/**
 * «licencia» → «licencias», «mes» → «meses», «sesión» → «sesiones».
 *
 * La unidad se guarda en singular —«licencia», «equipo», «curso»,
 * «dispositivo»— porque es como se lee al lado de la cantidad en el
 * cajón: «Cantidad (licencia)». Aquí va detrás de un número, y
 * «40 licencia» es de las cosas que hacen que un producto se vea
 * hecho a la carrera.
 *
 * Es texto libre del portafolio, así que la regla es la del
 * castellano y no una lista: vocal → +s; -z → -ces; aguda en -n o
 * -s → pierde la tilde y +es; -s o -x de una sílaba → +es, y de
 * más, se queda —así una unidad escrita ya en plural no sale
 * «licenciass»—; consonante → +es. Las siglas, tal cual. Si son
 * varias palabras se pluraliza la primera, que es el sustantivo:
 * «hora de soporte» → «horas de soporte».
 */
function enPlural(unidad: string): string {
  const [cabeza, ...resto] = unidad.split(/\s+/);
  const cola = resto.length > 0 ? " " + resto.join(" ") : "";

  if (/^[A-Z0-9]+$/.test(cabeza)) return cabeza + cola;
  if (/[aeiouáéíóú]$/i.test(cabeza)) return cabeza + "s" + cola;
  if (/z$/i.test(cabeza)) return cabeza.slice(0, -1) + "ces" + cola;

  const aguda = /([áéóú])([ns])$/i.exec(cabeza);
  if (aguda) {
    const sinTilde = aguda[1].normalize("NFD").replace(/\p{M}/gu, "");
    return cabeza.slice(0, -2) + sinTilde + aguda[2] + "es" + cola;
  }

  if (/[sx]$/i.test(cabeza)) {
    const unaSilaba = /^[^aeiouáéíóúü]*[aeiouáéíóúü]+[^aeiouáéíóúü]*$/i.test(cabeza);
    return (unaSilaba ? cabeza + "es" : cabeza) + cola;
  }

  return cabeza + "es" + cola;
}
