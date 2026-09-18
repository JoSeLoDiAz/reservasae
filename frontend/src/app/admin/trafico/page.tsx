"use client";

/**
 * Qué pasa entre el anuncio y la preinscripción.
 *
 * Existe porque la pauta gastaba dinero, la gente llegaba al
 * formulario y no se preinscribía nadie — y no había forma de
 * saber dónde se iba.
 *
 * MANDA LA SERIE, no el embudo. El cliente lo pidió así: «un
 * comparativo entre fechas desde que inició y de ahí en
 * adelante». Comparar contra el periodo anterior daría un −100 %
 * que solo diría que antes no había contador; la curva desde el
 * día uno sí dice algo.
 *
 * Las cifras son un SUELO, no un total, y eso se dice en
 * pantalla: no ven a quien se va antes de que la página termine
 * de pintar ni a quien usa bloqueador.
 */

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import {
  EmbudoProceso,
  type Hito,
  type NotaDelEmbudo,
} from "@/components/admin/embudo-proceso";
import {
  Chispa,
  Donut,
  DosSeriesPorDia,
  Delta,
  ListaBarras,
  n,
  type PorcionDonut,
} from "@/components/admin/graficos";
import { Aviso } from "@/components/admin/marco-admin";
import { Encabezado, Vacio } from "@/components/admin/piezas";
import { ErrorApi } from "@/lib/api";
import {
  crmApi,
  type CorteDeVisitas,
  type EmbudoPublico,
  type HistoricoDeTrafico,
} from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

/// Cómo se lee cada peldaño, y de qué color. El color sale de
/// las etapas del CRM para no inventar una segunda paleta.
const PELDANOS: Array<{ paso: string; etiqueta: string; etapa: Hito["etapa"] }> = [
  { paso: "LLEGO", etiqueta: "Abrieron el enlace", etapa: "INTERESADO" },
  { paso: "CATALOGO_LISTO", etiqueta: "Vieron el formulario", etapa: "INTERESADO" },
  { paso: "ELIGIO_UBICACION", etiqueta: "Eligieron su ciudad", etapa: "CONTACTADO" },
  { paso: "VIO_ACCIONES", etiqueta: "Vieron los cursos", etapa: "CONTACTADO" },
  { paso: "ELIGIO_ACCION", etiqueta: "Eligieron un curso", etapa: "DATOS_COMPLETOS" },
  { paso: "AUTORIZO", etiqueta: "Autorizaron sus datos", etapa: "DATOS_COMPLETOS" },
  { paso: "DATOS_COMPLETOS", etiqueta: "Llenaron todo", etapa: "INSCRITO" },
  { paso: "ENVIO", etiqueta: "Pulsaron confirmar", etapa: "INSCRITO" },
  { paso: "REGISTRADO", etiqueta: "Quedaron preinscritos", etapa: "CERTIFICADO" },
];

const COMO_SE_LEE: Record<string, string> = Object.fromEntries(
  PELDANOS.map((p) => [p.paso, p.etiqueta]),
);

const RANGOS = [
  { valor: "HOY", etiqueta: "Hoy" },
  { valor: "SEMANA", etiqueta: "7 días" },
  { valor: "MES", etiqueta: "30 días" },
  { valor: "TODO", etiqueta: "Desde el inicio" },
];

/// De dónde venían. «No dejó rastro» y no «Directa»: lo cierto
/// es la ausencia de referencia, no que tecleara la dirección.
///
/// Este diccionario vive AQUÍ y en ningún otro sitio. Hubo una
/// copia en el servidor que nadie importaba: dos diccionarios sin
/// nada que los ate es el defecto que este cambio vino a evitar.
const NOMBRE_PROCEDENCIA: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  /// Sabemos que fue Meta y no cuál de las dos: no se inventa.
  META: "Meta (sin precisar cuál)",
  CORREO: "Correo",
  WHATSAPP: "WhatsApp",
  BUSQUEDA: "Buscador",
  QR: "Código QR",
  RESERVA: "Reserva de empresa",
  INTERNO: "Otra página nuestra",
  OTRA_WEB: "Otra página web",
  OTRO_DECLARADO: "Otro canal etiquetado",
  SIN_REFERENCIA: "No dejó rastro",
};

const NOMBRE_ANCHO: Record<string, string> = {
  MOVIL: "Celular",
  TABLET: "Tableta",
  ESCRITORIO: "Computador",
};

const NOMBRE_ENTRADA: Record<string, string> = {
  SUBDOMINIO: "Por el subdominio del gremio",
  RUTA: "Por la dirección general",
  CRUZADA: "Cruzada: el gremio no coincide",
};

/// Por debajo de esto no se imprime porcentaje: una tasa con dos
/// visitas se lee igual que una con tres mil.
const MINIMO_PARA_TASA = 30;

function cuando(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

function diaCorto(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

export default function PaginaTrafico() {
  const [rango, setRango] = useState("TODO");
  /// Los dos periodos del calendario. Vacios = no se compara.
  const [a, setA] = useState({ desde: "", hasta: "" });
  const [b, setB] = useState({ desde: "", hasta: "" });
  const [datos, setDatos] = useState<EmbudoPublico | null>(null);
  const [error, setError] = useState<string | null>(null);

  const comparando = Boolean(a.desde && a.hasta && b.desde && b.hasta);

  const cargar = useCallback(async () => {
    try {
      setDatos(
        await crmApi.embudoPublico(
          comparando
            ? {
                rango: "PERSONALIZADO",
                desde: a.desde,
                hasta: a.hasta,
                contraDesde: b.desde,
                contraHasta: b.hasta,
              }
            : { rango },
        ),
      );
      setError(null);
    } catch (e) {
      setError((e as ErrorApi).message);
    }
  }, [rango, comparando, a.desde, a.hasta, b.desde, b.hasta]);

  useDatosVivos(cargar, { intervaloMs: 30_000 });

  const porPaso = useMemo(
    () => new Map((datos?.hitos ?? []).map((h) => [h.paso, h.visitas])),
    [datos],
  );
  const llegaron = porPaso.get("LLEGO") ?? 0;
  const vieron = porPaso.get("CATALOGO_LISTO") ?? 0;
  const eligieron = porPaso.get("ELIGIO_ACCION") ?? 0;
  const quedaron = porPaso.get("REGISTRADO") ?? 0;
  /// Las que hizo alguien. NO sale de `hitos`: no es un peldaño
  /// de la escalera, así que no entra en el embudo.
  const personas = datos?.personas ?? 0;

  const dias = datos?.porDia ?? [];
  const antes = useMemo(
    () => new Map((datos?.comparado?.hitos ?? []).map((h) => [h.paso, h.visitas])),
    [datos],
  );
  const contra = (paso: string) => (datos?.comparado ? (antes.get(paso) ?? 0) : null);

  /// El rótulo lo escribe la pantalla y no el servidor: allí sale
  /// «entre dos fechas», que comparado contra «entre dos fechas»
  /// no dice cuál es cuál.
  const rotuloA = comparando ? rotulo(a) : (datos?.etiqueta ?? "");
  const rotuloB = comparando ? rotulo(b) : (datos?.etiquetaAnterior ?? null);

  const hitos: Hito[] = PELDANOS.map((p) => ({
    etapa: p.etapa,
    etiqueta: p.etiqueta,
    total: porPaso.get(p.paso) ?? 0,
  }));

  const notas: NotaDelEmbudo[] = [
    {
      cifra: Math.max(llegaron - vieron, 0),
      etiqueta: "Se fueron cargando",
      detalle: "Cerraron antes de que el formulario apareciera.",
      tono: "aviso",
    },
    {
      cifra: Math.max(vieron - eligieron, 0),
      etiqueta: "Miraron y no eligieron",
      detalle: "Vieron la oferta y no tocaron ninguna tarjeta.",
      tono: "error",
    },
    {
      cifra: quedaron,
      etiqueta: "Se preinscribieron",
      detalle: "Ficha creada de verdad, escrita por el servidor.",
      tono: quedaron > 0 ? "exito" : "neutro",
    },
  ];

  const porcionesProcedencia: PorcionDonut[] = (datos?.procedencia ?? []).map((f) => ({
    etiqueta: NOMBRE_PROCEDENCIA[f.valor ?? ""] ?? "Sin dato",
    valor: f.visitas,
  }));

  const hayDatos = llegaron > 0;

  return (
    <div className="space-y-5">
      <Encabezado
        titulo="Tráfico del formulario"
        descripcion={
          <>
            Qué pasa entre el anuncio y la preinscripción. Se abre más de lo
            que se mira: las máquinas también abren, y «Personas» las descuenta.
            {datos?.contandoDesde && (
              <>
                {" "}
                <strong className="text-texto">
                  El contador empezó el {cuando(datos.contandoDesde)}
                </strong>
                : lo anterior a esa hora no se contó, aunque sí hubiera llegado
                gente.
              </>
            )}
          </>
        }
      >
        <div className="flex flex-wrap gap-1">
          {RANGOS.map((r) => (
            <button
              key={r.valor}
              type="button"
              onClick={() => setRango(r.valor)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                rango === r.valor
                  ? "bg-marca font-medium text-marca-texto"
                  : "border border-borde bg-superficie text-texto-suave hover:bg-superficie-alterna"
              }`}
            >
              {r.etiqueta}
            </button>
          ))}
        </div>
      </Encabezado>

      {/* El MISMO margen que el encabezado y que `Tarjeta`
          (`mx-3`). Desde el redisenio del 12 sep las bandas del
          panel ponen su propio margen, y estas cajas son de esta
          pantalla y no lo traian: el encabezado quedaba separado
          del canto y todo lo de abajo pegado a él. */}
      <div className="mx-3 space-y-5">
      {datos?.sinMarcarHoy && <AvisoSinMarcar {...datos.sinMarcarHoy} />}

      <ComoLeer hayHistorico={!!datos?.historico} />

      <ComparadorDeFechas
        a={a}
        b={b}
        alCambiarA={setA}
        alCambiarB={setB}
        comparando={comparando}
      />

      {error && <Aviso tipo="error">{error}</Aviso>}

      {datos && !hayDatos ? (
        <Vacio titulo="Todavía no hay visitas contadas">
          {datos.contandoDesde ? (
            <>
              El contador funciona desde el{" "}
              {new Date(datos.contandoDesde).toLocaleDateString("es-CO")}, pero en{" "}
              {datos.etiqueta.toLowerCase()} no llegó nadie. Si la pauta está
              activa, revise que el enlace del anuncio apunte a esta dirección.
            </>
          ) : (
            <>
              No se ha registrado ni una visita desde que existe esta pantalla. Si
              la página sí está recibiendo gente, lo que falla es la medición y no
              la pauta.
            </>
          )}
        </Vacio>
      ) : (
        <>
          {/* LAS DOS CIFRAS VAN JUNTAS Y NO SE SUSTITUYEN.
              «Abrieron» incluye maquinas --el escaner de enlaces
              de un proveedor de correo abre cada enlace del
              envio: el 16 sep 2026 eso fueron 565 de 599--, asi
              que dividir por ella da una tasa que parece exacta y
              no lo es. «Tocaron» es el denominador. Pero
              «Abrieron» NO se esconde: la diferencia entre las
              dos es cuanta gente llego y se fue, que en la pauta
              de Meta son decenas al dia y es informacion real. */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Resumen
              etiqueta="Abrieron el enlace"
              valor={llegaron}
              antes={contra("LLEGO")}
              etiquetaAntes={rotuloB}
              serie={dias.map((d) => d.llegaron)}
              color="var(--serie-1)"
              pie="Incluye máquinas: un escáner de correo abre cada enlace"
            />
            <Resumen
              etiqueta="Personas"
              valor={personas}
              etiquetaAntes={rotuloB}
              serie={dias.map((d) => d.llegaron)}
              color="var(--serie-3)"
              pie="Descontando lo que abren solas las máquinas"
            />
            <Resumen
              etiqueta="Eligieron un curso"
              valor={eligieron}
              antes={contra("ELIGIO_ACCION")}
              etiquetaAntes={rotuloB}
              serie={dias.map((d) => d.preinscritos)}
              color="var(--serie-2)"
              pie={
                personas >= MINIMO_PARA_TASA
                  ? `${Math.round((eligieron / personas) * 100)} % de las personas`
                  : "Aún son pocas para un porcentaje"
              }
            />
            <Resumen
              etiqueta="Se preinscribieron"
              valor={quedaron}
              antes={contra("REGISTRADO")}
              etiquetaAntes={rotuloB}
              serie={dias.map((d) => d.preinscritos)}
              color="var(--exito)"
              pie={
                quedaron === 0
                  ? "Ninguna todavía en este periodo"
                  : `${n(quedaron)} ficha${quedaron === 1 ? "" : "s"} creada${
                      quedaron === 1 ? "" : "s"
                    }`
              }
            />
          </div>

          {/* LA SERIE ES LA PROTAGONISTA: es el comparativo entre
              fechas que pidio el cliente, desde el arranque. */}
          <div className="rounded-2xl border border-borde bg-superficie p-5">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-texto-suave uppercase">
                Día a día, desde que arrancó el contador
              </h2>
              {dias.length > 0 && (
                <span className="text-xs text-texto-suave tabular-nums">
                  {diaCorto(dias[0].dia)} → {diaCorto(dias[dias.length - 1].dia)}
                </span>
              )}
            </div>
            <p className="mb-4 text-sm text-texto-suave">
              Se compara contra los días anteriores, no contra un periodo en el que
              no había contador.
            </p>
            <DosSeriesPorDia
              a={{
                nombre: "Abrieron el enlace",
                datos: dias.map((d) => ({ dia: d.dia, total: d.llegaron })),
                color: "var(--serie-1)",
              }}
              b={{
                nombre: "Se preinscribieron",
                datos: dias.map((d) => ({ dia: d.dia, total: d.preinscritos })),
                color: "var(--exito)",
              }}
              vacio="Todavía no hay ningún día con datos."
            />
          </div>

          {datos?.caidaMayor && (
            <p className="rounded-xl border border-aviso/40 bg-aviso-suave px-4 py-3 text-sm">
              <span className="font-semibold text-aviso">Donde más se cae: </span>
              <span className="text-texto">
                {datos.caidaMayor.sePerdieron === 1
                  ? "1 apertura se perdió"
                  : `${n(datos.caidaMayor.sePerdieron)} aperturas se perdieron`}{" "}
                entre «{COMO_SE_LEE[datos.caidaMayor.de] ?? datos.caidaMayor.de}» y «
                {COMO_SE_LEE[datos.caidaMayor.a] ?? datos.caidaMayor.a}».
              </span>
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            <div className="rounded-2xl border border-borde bg-superficie p-5">
              <h2 className="mb-4 text-sm font-semibold tracking-wide text-texto-suave uppercase">
                Paso a paso · {rotuloA}
              </h2>
              <EmbudoProceso hitos={hitos} notas={notas} />
            </div>

            <div className="rounded-2xl border border-borde bg-superficie p-5">
              <h2 className="mb-4 text-sm font-semibold tracking-wide text-texto-suave uppercase">
                De dónde venían
              </h2>
              <Donut
                datos={porcionesProcedencia}
                centro={n(llegaron)}
                detalleCentro="aperturas"
                vacio="Sin visitas en este periodo."
              />
            </div>
          </div>

          {datos && (
            <DespuesDePreinscribirse
              {...datos.despues}
              rotulo={rotuloA}
              comparando={comparando}
            />
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Corte
              titulo="Por dispositivo"
              filas={datos?.dispositivo ?? []}
              nombre={(v) => NOMBRE_ANCHO[v ?? ""] ?? "Sin dato"}
              total={llegaron}
            />
            <Corte
              titulo="Por qué dirección entraron"
              filas={datos?.entrada ?? []}
              nombre={(v) => NOMBRE_ENTRADA[v ?? ""] ?? "Sin dato"}
              total={llegaron}
            />
            {/* «Entrada directa» era FALSO y se veia: el 16 sep
                2026, 10.450 de estas venian de un envio de correo
                y el rotulo decia que habian entrado solas. Lo
                cierto es que el enlace no traia etiqueta. */}
            <Corte
              titulo="Por campaña"
              filas={datos?.campana ?? []}
              nombre={(v) => v ?? "El enlace no traía etiqueta"}
              total={llegaron}
              pie="Para que un envío salga aquí con su nombre, su enlace tiene que llevar «utm_campaign». Un correo masivo lleva además «utm_source=correo»."
            />
          </div>
        </>
      )}

      {/* ── ANTES DEL CONTADOR ──

          Va FUERA de la rama de arriba a proposito: esa solo
          se pinta cuando hay visitas medidas en el periodo, y
          este bloque es justo lo que hay que poder mirar
          cuando no las hay.

          Y va aparte, con su propio titulo y su propio
          rotulo, porque son cifras RECONSTRUIDAS del registro
          del servidor: sumarlas a las de arriba convertiria
          un agujero de medicion en una conclusion. */}
      {datos?.historico && <Historico h={datos.historico} />}
      </div>
    </div>
  );
}

/**
 * «Hoy entraron 35 personas por un enlace sin marcar.»
 *
 * Lo pidió Mauricio el 18 sep 2026 para blindar la atribución
 * SIN tocar el formulario: quien entra por la dirección pelada no
 * deja señal, y sin este aviso se descubría en el informe del
 * mes, con cientos de fichas ya en «Sin etiqueta». Va ARRIBA de
 * todo porque pide hacer algo hoy, y sale solo desde el umbral:
 * un aviso que está siempre encendido deja de leerse.
 */
function AvisoSinMarcar({
  personas,
  umbral,
  desde,
}: {
  personas: number;
  umbral: number;
  desde: Array<{ sitio: string; personas: number }>;
}) {
  if (personas < umbral) return null;
  return (
    <section
      role="status"
      className="rounded-2xl border border-aviso/40 bg-aviso-suave px-6 py-4 text-sm"
    >
      <p className="text-texto">
        <strong className="font-semibold text-aviso">
          Hoy entraron {n(personas)} personas por un enlace sin marcar.
        </strong>{" "}
        Alguien repartió la dirección del formulario sin sacarla del panel, y
        esas personas quedan como «Sin etiqueta» en Gestión de leads.
      </p>
      {desde.length > 0 && (
        <p className="mt-1.5 text-texto-suave">
          Llegaron sobre todo desde{" "}
          {desde.map((d, i) => (
            <span key={d.sitio}>
              {i > 0 && (i === desde.length - 1 ? " y " : ", ")}
              <strong className="font-mono text-texto">{d.sitio}</strong> ({n(d.personas)})
            </span>
          ))}
          .
        </p>
      )}
      <p className="mt-1.5 text-texto-suave">
        Saque el enlace desde{" "}
        <Link href="/admin/formularios-publicos" className="font-medium text-marca underline">
          Formularios públicos
        </Link>
        , eligiendo por dónde se reparte, y cámbielo donde se haya publicado.
      </p>
    </section>
  );
}

/** Las fichas del periodo, seguidas. */
function DespuesDePreinscribirse({
  recibieron,
  terminaron,
  rotulo,
  comparando,
}: {
  recibieron: number;
  terminaron: number;
  rotulo: string;
  comparando: boolean;
}) {
  const hayTasa = recibieron >= MINIMO_PARA_TASA;
  const parte = recibieron > 0 ? Math.min(terminaron / recibieron, 1) : 0;

  return (
    <section className="rounded-2xl border border-borde bg-superficie p-5">
      <h2 className="text-sm font-semibold tracking-wide text-texto-suave uppercase">
        Después de preinscribirse · {rotulo}
      </h2>
      <p className="mt-1 text-sm text-texto-suave">
        Cada ficha nueva recibe su enlace para completar datos. Se cuenta a
        hoy: quien se preinscribió en el periodo y terminó después, cuenta.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-3xl font-semibold text-titulo tabular-nums">
            {n(recibieron)}
          </p>
          <p className="text-sm text-texto-suave">
            recibieron su enlace al preinscribirse
          </p>
        </div>
        <div>
          <p className="text-3xl font-semibold text-exito tabular-nums">
            {n(terminaron)}
          </p>
          <p className="text-sm text-texto-suave">
            terminaron el formulario de completar
            {recibieron > 0 &&
              (hayTasa
                ? ` · ${Math.round(parte * 100)} %`
                : " · aún son pocas para un porcentaje")}
          </p>
        </div>
      </div>

      {recibieron > 0 && (
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-superficie-alterna"
          role="img"
          aria-label={`${n(terminaron)} de ${n(recibieron)} terminaron`}
        >
          <div className="h-full rounded-full bg-exito" style={{ width: `${parte * 100}%` }} />
        </div>
      )}

      <p className="mt-3 text-xs text-texto-suave">
        Quien ya tenía ficha no recibe enlace y no entra aquí.
        {comparando && " El comparador de fechas no compara este bloque."}
      </p>
    </section>
  );
}

/**
 * Cómo leer estas cifras, ARRIBA y en frases cortas.
 *
 * Estaba al final, como lista de seis párrafos, y el cliente lo
 * dijo: «esto debería ser visible arriba, y más fácil de
 * interpretar» (18 sep 2026). Quien mira la pantalla compara
 * con Meta ANTES de bajar, y ahí es donde hace falta saber que
 * la cifra de aquí sale menor a propósito. Cada idea es un
 * titular de pocas palabras y una frase: lo mismo que decía,
 * sin la explicación técnica de por qué.
 */
function ComoLeer({ hayHistorico }: { hayHistorico: boolean }) {
  const ideas: Array<[string, string]> = [
    [
      "Es un mínimo, no el total",
      "No cuenta a quien se va antes de que cargue la página ni a quien usa bloqueador.",
    ],
    [
      "Saldrá menos que en Meta, y está bien",
      "Meta cuenta clics, incluidos los de robots. Aquí solo cuentan las visitas que sí cargaron la página.",
    ],
    [
      "Una visita no es una persona",
      "Quien vuelve otro día cuenta dos veces. «Personas» quita además lo que abren las máquinas.",
    ],
    [
      "Solo desde que arrancó el contador",
      hayHistorico
        ? "Lo de antes va en su bloque aparte, más abajo. Son otras cifras y no se suman."
        : "Quien se preinscribió antes no sale aquí, aunque sí esté en Gestión de leads.",
    ],
    [
      `Porcentajes desde ${MINIMO_PARA_TASA} visitas`,
      "Con menos, un porcentaje no dice nada, así que no se muestra.",
    ],
    [
      "«No dejó rastro» casi siempre es correo o WhatsApp",
      "Esos enlaces no dejan señal si no van marcados. Márquelos en Formularios públicos.",
    ],
  ];

  return (
    <section className="rounded-2xl border border-borde bg-superficie-alterna px-6 py-4">
      <h2 className="text-xs font-medium tracking-wide text-texto-suave uppercase">
        Cómo leer estas cifras
      </h2>
      <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {ideas.map(([titular, frase]) => (
          <div key={titular}>
            <dt className="text-sm font-semibold text-texto">{titular}</dt>
            <dd className="mt-0.5 text-sm leading-snug text-texto-suave">{frase}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/// Una cifra grande con su tendencia. La chispa solo sale con dos
/// días o más: con uno sería una raya, y una raya se lee como un
/// fallo de dibujo, no como «todavía no hay historia».
function Resumen({
  etiqueta,
  valor,
  serie,
  color,
  pie,
  antes = null,
  etiquetaAntes = null,
}: {
  etiqueta: string;
  valor: number;
  serie: number[];
  color: string;
  pie?: string;
  /// Null cuando no se esta comparando: 0 es «hubo cero».
  antes?: number | null;
  etiquetaAntes?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-borde bg-superficie p-5">
      <p className="text-xs font-medium tracking-wide text-texto-suave uppercase">
        {etiqueta}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
        <p className="text-3xl font-semibold tabular-nums" style={{ color }}>
          {n(valor)}
        </p>
        {antes !== null && (
          <Delta valor={variacion(valor, antes)} contra={etiquetaAntes ?? undefined} />
        )}
      </div>
      {antes !== null && (
        <p className="mt-0.5 text-xs text-texto-suave tabular-nums">
          {n(antes)} en {etiquetaAntes ?? "el otro periodo"}
        </p>
      )}
      {serie.length > 1 && (
        <Chispa
          datos={serie}
          color={color}
          clase="mt-2 h-8 w-full"
          etiqueta={`${etiqueta}, día a día`}
        />
      )}
      {pie && <p className="mt-2 text-xs text-texto-suave">{pie}</p>}
    </div>
  );
}

/// Un corte con barras, no una lista de números sueltos: con dos
/// filas, una lista parece una caja vacía con texto dentro.
/// Lo que se lee debajo de cada barra.
///
/// El porcentaje va sobre las PERSONAS y NUNCA sobre las
/// aperturas: un escaner de enlaces infla aquellas, asi que
/// dividir por ellas da una tasa que parece exacta y no lo es.
/// Con pocas no se imprime ninguna: una tasa hecha de dos se lee
/// igual que una de tres mil.
function detalleDeFila(f: CorteDeVisitas): string | undefined {
  if (f.visitas === 0) return undefined;
  const gente = `${n(f.personas)} personas`;
  if (f.personas < MINIMO_PARA_TASA) return gente;
  return `${gente} · ${Math.round((f.envios / f.personas) * 100)} % se preinscribió`;
}

function Corte({
  titulo,
  filas,
  nombre,
  total,
  pie,
}: {
  titulo: string;
  filas: CorteDeVisitas[];
  nombre: (valor: string | null) => string;
  total: number;
  /// Lo que hay que hacer para que este corte diga algo. Va
  /// donde se lee la cifra, no en un manual que nadie abre.
  pie?: string;
}) {
  return (
    <div className="rounded-2xl border border-borde bg-superficie p-5">
      <h3 className="mb-3 text-sm font-semibold tracking-wide text-texto-suave uppercase">
        {titulo}
      </h3>
      {/* La barra es la APERTURA --el volumen que de verdad
          llego-- y el detalle lleva las que tocaron, que es el
          denominador del porcentaje. Un canal que abre mil veces
          y no toca ninguna tiene que verse: esa diferencia es el
          dato, no un estorbo. */}
      <ListaBarras
        datos={filas.map((f) => ({
          clave: f.valor ?? "sin",
          etiqueta: nombre(f.valor),
          valor: f.visitas,
          detalle: detalleDeFila(f),
        }))}
        vacio="Sin visitas en este periodo."
        maximoFilas={6}
      />
      {total > 0 && filas.length > 0 && (
        <p className="mt-3 text-xs text-texto-suave">
          Sobre {n(total)} apertura{total === 1 ? "" : "s"} del periodo. El
          porcentaje va sobre las personas.
        </p>
      )}
      {pie && <p className="mt-2 text-xs text-texto-suave">{pie}</p>}
    </div>
  );
}

/// Cuánto cambió, de -1 a +∞. Null si antes no había nada.
function variacion(actual: number, antes: number): number | null {
  if (antes === 0) return actual === 0 ? 0 : null;
  return (actual - antes) / antes;
}

/// «12 de sept» o «8 al 14 de sept», que es lo que hay que leer
/// arriba de una cifra para saber de qué día habla.
function rotulo({ desde, hasta }: { desde: string; hasta: string }): string {
  if (!desde || !hasta) return "";
  return desde === hasta ? diaCorto(desde) : `${diaCorto(desde)} al ${diaCorto(hasta)}`;
}

/// El día de hoy en Bogotá, en `YYYY-MM-DD`.
function hoyISO(dias = 0): string {
  const ahora = new Date(Date.now() - 5 * 60 * 60 * 1000 - dias * 86_400_000);
  return ahora.toISOString().slice(0, 10);
}

/**
 * Dos periodos del calendario, uno contra otro.
 *
 * Lo pidió el cliente así: «de tal fecha a tal fecha, hoy contra
 * ayer, un día contra otro en específico». No es un periodo
 * contra su previo — eso ya lo da la serie por día.
 *
 * No se exige que duren igual: «¿esta semana llevamos ya lo de
 * todo el mes pasado?» es una pregunta legítima, y por eso la
 * pantalla enseña los DOS rótulos y nunca «el periodo anterior».
 */
function ComparadorDeFechas({
  a,
  b,
  alCambiarA,
  alCambiarB,
  comparando,
}: {
  a: { desde: string; hasta: string };
  b: { desde: string; hasta: string };
  alCambiarA: (v: { desde: string; hasta: string }) => void;
  alCambiarB: (v: { desde: string; hasta: string }) => void;
  comparando: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  function limpiar() {
    alCambiarA({ desde: "", hasta: "" });
    alCambiarB({ desde: "", hasta: "" });
  }

  function hoyContraAyer() {
    alCambiarA({ desde: hoyISO(0), hasta: hoyISO(0) });
    alCambiarB({ desde: hoyISO(1), hasta: hoyISO(1) });
    setAbierto(true);
  }

  function semanaContraSemana() {
    alCambiarA({ desde: hoyISO(6), hasta: hoyISO(0) });
    alCambiarB({ desde: hoyISO(13), hasta: hoyISO(7) });
    setAbierto(true);
  }

  return (
    <div className="rounded-2xl border border-borde bg-superficie p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="rounded-lg border border-campo-borde px-3 py-1.5 text-sm text-texto transition hover:bg-superficie-alterna"
        >
          {abierto ? "Ocultar la comparación" : "Comparar dos fechas"}
        </button>
        <button
          type="button"
          onClick={hoyContraAyer}
          className="rounded-lg px-3 py-1.5 text-sm text-marca underline underline-offset-2"
        >
          Hoy contra ayer
        </button>
        <button
          type="button"
          onClick={semanaContraSemana}
          className="rounded-lg px-3 py-1.5 text-sm text-marca underline underline-offset-2"
        >
          Últimos 7 días contra los 7 anteriores
        </button>
        {comparando && (
          <button
            type="button"
            onClick={limpiar}
            className="ml-auto rounded-lg px-3 py-1.5 text-sm text-texto-suave underline underline-offset-2"
          >
            Quitar la comparación
          </button>
        )}
      </div>

      {abierto && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Periodo titulo="Periodo A" valor={a} alCambiar={alCambiarA} />
          <Periodo titulo="Contra el periodo B" valor={b} alCambiar={alCambiarB} />
        </div>
      )}

      {abierto && !comparando && (
        <p className="mt-3 text-xs text-texto-suave">
          Hacen falta las cuatro fechas para comparar. Mientras tanto se muestra el
          rango de arriba.
        </p>
      )}
    </div>
  );
}

function Periodo({
  titulo,
  valor,
  alCambiar,
}: {
  titulo: string;
  valor: { desde: string; hasta: string };
  alCambiar: (v: { desde: string; hasta: string }) => void;
}) {
  const clase =
    "rounded-lg border border-campo-borde bg-campo-fondo px-3 py-1.5 text-sm " +
    "outline-none focus:ring-2 focus:ring-campo-foco";
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium tracking-wide text-texto-suave uppercase">
        {titulo}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={valor.desde}
          max={valor.hasta || undefined}
          onChange={(e) => alCambiar({ ...valor, desde: e.target.value })}
          className={clase}
          aria-label={`${titulo}, desde`}
        />
        <span className="text-sm text-texto-suave">a</span>
        <input
          type="date"
          value={valor.hasta}
          min={valor.desde || undefined}
          onChange={(e) => alCambiar({ ...valor, hasta: e.target.value })}
          className={clase}
          aria-label={`${titulo}, hasta`}
        />
      </div>
    </div>
  );
}

/**
 * Lo de antes del contador, reconstruido del registro del
 * servidor.
 *
 * Tres cosas que el bloque dice en voz alta porque no se
 * pueden saber del registro, y callarlas seria dar por medido
 * lo que no lo esta:
 *
 *   1. NO hay peldanos intermedios. Se sabe quien pidio el
 *      formulario y quien mando el envio; nada de en medio.
 *   2. Un envio pudo ser de alguien que YA estaba: el
 *      servidor contesta 201 en los dos casos.
 *   3. La unidad es una IP en un dia, no una persona.
 */
function Historico({ h }: { h: HistoricoDeTrafico }) {
  const dias = h.porDia.map((d) => ({ dia: d.dia, total: d.llegaron }));
  const envios = h.porDia.map((d) => ({ dia: d.dia, total: d.preinscritos }));

  return (
    <div className="rounded-2xl border border-borde bg-superficie p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[0.9375rem] font-semibold text-titulo">
            Antes del contador
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-texto-suave">
            Reconstruido del <strong>registro del servidor</strong>, no del
            contador. Del {fechaCorta(h.desde)} al {fechaCorta(h.hasta)}.
          </p>
        </div>
        <p className="text-[0.8125rem] text-texto-suave tabular-nums">
          <strong className="text-titulo">{n(h.visitas)}</strong> visitas ·{" "}
          <strong className="text-titulo">{n(h.envios)}</strong> envíos
        </p>
      </div>

      <div className="mt-4">
        <DosSeriesPorDia
          a={{ nombre: "Abrieron el enlace", datos: dias }}
          b={{
            nombre: "Enviaron el formulario",
            datos: envios,
            color: "var(--exito)",
          }}
          vacio="No hay nada reconstruido todavía."
        />
      </div>

      {h.procedencia.length > 0 && (
        <div className="mt-5 border-t border-borde pt-4">
          <p className="text-[0.75rem] font-semibold tracking-[0.04em] text-texto-suave uppercase">
            De dónde venían
          </p>
          <div className="mt-2.5">
            <ListaBarras
              datos={h.procedencia.map((c) => ({
                etiqueta: NOMBRE_PROCEDENCIA[c.valor ?? ""] ?? c.valor ?? "Sin dato",
                valor: c.visitas,
                detalle: c.envios > 0 ? `${n(c.envios)} envíos` : undefined,
              }))}
              maximoFilas={6}
            />
          </div>
        </div>
      )}

      <p className="mt-4 text-[0.75rem] leading-relaxed text-texto-suave">
        El registro sabe quién pidió el formulario y quién lo envió, y{" "}
        <strong>nada de lo que pasa en medio</strong>: los peldaños del embudo
        empiezan con el contador. Un envío de aquí pudo ser de alguien que ya
        estaba registrado —el servidor contesta lo mismo en los dos casos— y la
        unidad es una dirección de internet en un día, no una persona.
      </p>
    </div>
  );
}

/// «2026-09-13» -> «13 de sept». Sin el año: el bloque ya dice
/// el rango entero arriba.
function fechaCorta(dia: string): string {
  return new Date(`${dia}T12:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}
