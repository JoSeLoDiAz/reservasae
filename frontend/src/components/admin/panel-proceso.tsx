/** Todo el proceso de inscripción, de interesado a inscrito. */

/**
 * La pestaña «Proceso», rediseñada.
 *
 * Se llamaba «Metas y avance» y era una lista de bloques
 * anidados: siete tarjetas de cifra, cuatro títulos con franja
 * de color y las metas plegadas al pie. Contaba las mismas
 * cosas y no contaba ninguna historia.
 *
 * El orden de aquí SÍ es una historia, y es la que trae a
 * coordinación: cuánta gente entró y dónde se cae (embudo),
 * cómo de bien va eso (tasas), de qué está hecha esa gente
 * (convenio y modalidad), dónde está hoy y si sus datos
 * sirven, a qué ritmo entra y por dónde, dónde vive y quién la
 * atiende, y por último el detalle por acción.
 *
 * Se renombra a «Proceso» porque la columna vertebral ya no es
 * la comparación meta-contra-real: es el embudo. Pero la meta
 * NO se pierde —es dato real y el equipo la usa—: va anclada al
 * hito «Inscritos», que es el único sitio donde significa algo.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { Desplegable } from "./desplegable";
import { EmbudoProceso, type Hito } from "./embudo-proceso";
import { MapaColombia } from "./mapa-colombia";
import { Aviso } from "./marco-admin";
import {
  Donut,
  Medidor,
  n,
  SERIE,
  type PorcionDonut,
} from "./graficos";
import { PendientesDeHoy } from "./pendientes-de-hoy";
import { Bloque } from "./piezas";
import { colorEtapa } from "./etapa";
import { ErrorApi } from "@/lib/api";
import {
  crmApi,
  ETIQUETA_ETAPA,
  ETIQUETA_ORIGEN,
  type Control,
  type Etapa,
  type Filtros,
  type MetricasInscripciones,
  type Origen,
  type Resumen,
} from "@/lib/crm-api";

/// Las tres fases del embudo, para agrupar las etapas.
/// Sin agrupar, cinco barras seguidas no dicen cuál es avance y
/// cuál es salida.
const FASES: Array<{ titulo: string; etapas: Etapa[] }> = [
  { titulo: "Captación", etapas: ["INTERESADO", "CONTACTADO", "DATOS_COMPLETOS"] },
  { titulo: "Inscritos", etapas: ["INSCRITO"] },
  { titulo: "Salida", etapas: ["PERDIDO"] },
];

/// La paleta de los canales, fijada: el punto de la lista tiene
/// que ser del color de su porción en la dona, y con el ciclo por
/// defecto de `Donut` los dos se elegían por separado.
const PALETA_CANAL = [
  "var(--serie-1)",
  "var(--serie-2)",
  "var(--exito)",
  "var(--aviso)",
  "var(--marca-fuerte)",
];

/**
 * El nombre de una acción, en minúscula con la primera en alta.
 *
 * En la base están en MAYÚSCULA SOSTENIDA, y once renglones
 * seguidos así se leen a trompicones: la mayúscula quita a las
 * letras la forma por la que se reconocen de un vistazo. Solo
 * cambia cómo se ve; el dato no se toca, y en los formatos SEP
 * —que sí son el contrato con el SENA— sale como está guardado.
 */
function frase(s: string): string {
  return s ? s.charAt(0) + s.slice(1).toLowerCase() : s;
}

function pct(parte: number, total: number): string {
  if (total <= 0) return "0 %";
  return `${Math.round((parte / total) * 100)} %`;
}

export function PanelProceso({
  control,
  alCambiarFiltros,
}: {
  /// El periodo ya no entra aquí: vive en la cabecera de la
  /// página, al frente del título. Enmarca la pantalla entera
  /// --las dos pestañas--, y estos filtros solo recortan esta.
  /**
   * El control del periodo, YA PEDIDO por la página.
   *
   * No se pide aquí a propósito. La página ya lo trae con el
   * periodo elegido y su comparación; pidiéndolo el panel por su
   * cuenta salían dos consultas iguales salvo en las fechas —las
   * suyas, ninguna— y el «ritmo de inscripción» contaba todo el
   * histórico mientras la cabecera decía «este mes».
   */
  control?: Control | null;
  alCambiarFiltros?: (f: Filtros) => void;
}) {
  const [convenioId, setConvenioId] = useState("");
  const [accionFormacionId, setAccionFormacionId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [etapa, setEtapa] = useState("");
  const [asesorId, setAsesorId] = useState("");
  const [departamentoSepId, setDepartamentoSepId] = useState("");

  const [metricas, setMetricas] = useState<MetricasInscripciones | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accionAbierta, setAccionAbierta] = useState<string | null>(null);

  const filtros = useMemo<Filtros>(
    () => ({
      convenioId: convenioId || undefined,
      accionFormacionId: accionFormacionId || undefined,
      grupoId: grupoId || undefined,
      etapa: (etapa || undefined) as Filtros["etapa"],
      asesorId: asesorId || undefined,
      departamentoSepId: departamentoSepId ? Number(departamentoSepId) : undefined,
    }),
    [convenioId, accionFormacionId, grupoId, etapa, asesorId, departamentoSepId],
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [met, res] = await Promise.all([
        crmApi.metricas(filtros),
        crmApi.resumen(filtros),
      ]);
      setMetricas(met);
      setResumen(res);
      setError(null);
    } finally {
      setCargando(false);
    }
  }, [filtros]);

  useEffect(() => {
    void cargar().catch((e) => setError((e as ErrorApi).message));
  }, [cargar]);

  useEffect(() => {
    alCambiarFiltros?.(filtros);
  }, [filtros, alCambiarFiltros]);

  const enEtapa = useMemo(
    () => new Map((resumen?.etapas ?? []).map((e) => [e.etapa, e.total])),
    [resumen],
  );
  const g = useCallback((...es: Etapa[]) => es.reduce((s, e) => s + (enEtapa.get(e) ?? 0), 0), [enEtapa]);

  /**
   * El embudo, ACUMULADO: quién llegó a cada hito.
   *
   * Desde `resumen.etapas` y no desde `control.embudo`: aquel va
   * recortado a las cinco de inscripción —con razón, ver
   * `control.ts:46`— y quien pasó al aula desaparecería, así que
   * los veintitrés en formación contarían como «no inscritos».
   */
  const hitos = useMemo<Hito[]>(() => {
    if (!resumen) return [];
    const trasInscribir = g(
      "EN_FORMACION",
      "CERTIFICADO",
      "RETIRADO",
      "NO_APROBO",
      "DESERTO",
      "ABANDONO",
    );
    const inscritos = g("INSCRITO") + trasInscribir;
    const conDatos = inscritos + g("DATOS_COMPLETOS");
    /// SUPUESTO: a quien se marcó PERDIDO se le cuenta como
    /// contactado. No sabemos en qué punto se perdió, y darlo
    /// por no contactado inflaría la caída del primer paso.
    const contactados = conDatos + g("CONTACTADO") + g("PERDIDO");
    const entraron = contactados + g("INTERESADO");
    return [
      { etapa: "INTERESADO", etiqueta: "Entraron", total: entraron },
      { etapa: "CONTACTADO", etiqueta: "Contactados", total: contactados },
      { etapa: "DATOS_COMPLETOS", etiqueta: "Con datos", total: conDatos },
      { etapa: "INSCRITO", etiqueta: "Inscritos", total: inscritos },
    ];
  }, [resumen, g]);

  const entraron = hitos[0]?.total ?? 0;
  const contactados = hitos[1]?.total ?? 0;
  const inscritos = hitos[3]?.total ?? 0;
  const perdidos = g("PERDIDO");

  /**
   * Lo que se pinta en «Dónde está cada persona hoy».
   *
   * En «Inscrito» va TODO el que llegó a inscribirse, no solo
   * quien sigue parado en esa etapa: los que ya pasaron al aula
   * se inscribieron igual, y contando solo a los parados las
   * cinco barras sumaban 60 de 107 —cuarenta y siete personas
   * desaparecidas de una tarjeta que promete decir dónde está
   * cada una—. El alcance sigue siendo inscripción: el aula es
   * Gestión Académica, y por eso se suma a «Inscrito» en vez de
   * abrir etapas nuevas.
   */
  const valorDeFase = useCallback(
    (e: Etapa) => (e === "INSCRITO" ? inscritos : enEtapa.get(e) ?? 0),
    [inscritos, enEtapa],
  );

  /// El ancho de las barras va contra la etapa más alta, no
  /// contra el total: contra el total, cuatro de las cinco
  /// quedaban en un hilo de dos píxeles.
  const cimaDeFase = useMemo(
    () => Math.max(1, ...FASES.flatMap((f) => f.etapas).map(valorDeFase)),
    [valorDeFase],
  );

  const notas = useMemo(
    () => [
      {
        cifra: entraron - inscritos - perdidos,
        etiqueta: "aún no se inscriben",
        detalle: "Entraron y todavía no llegaron a inscrito ni dijeron que no.",
        tono: "error" as const,
      },
      {
        cifra: g("INTERESADO", "CONTACTADO", "DATOS_COMPLETOS"),
        etiqueta: "en captación por cerrar",
        detalle: "Siguen en los tres peldaños de captación: se pueden trabajar hoy.",
        tono: "aviso" as const,
      },
      {
        cifra: perdidos,
        etiqueta: "no interesados",
        detalle: "Dijeron que no. Salen del embudo y no cuentan como pendientes.",
        tono: "neutro" as const,
      },
      {
        cifra: inscritos,
        etiqueta: "inscritos",
        detalle: "Llegaron a inscribirse, estén hoy en el aula o no.",
        tono: "exito" as const,
      },
    ],
    [entraron, inscritos, perdidos, g],
  );

  /// Mientras llega el dato nuevo, lo viejo se atenúa y no se
  /// vacía: un esqueleto hace perder la referencia de lo que se
  /// estaba mirando, y aquí se mira para comparar.
  const claseCargando = cargando && control ? "opacity-45 pointer-events-none" : "";

  /// Ver el comentario de `meta` en el embudo.
  const metaComparable = !asesorId && !departamentoSepId && !etapa;

  const hayFiltro = Boolean(
    convenioId || accionFormacionId || grupoId || etapa || asesorId || departamentoSepId,
  );

  function quitarFiltros() {
    setConvenioId("");
    setAccionFormacionId("");
    setGrupoId("");
    setEtapa("");
    setAsesorId("");
    setDepartamentoSepId("");
  }

  const donutConvenio: PorcionDonut[] = (control?.porConvenio ?? []).map((c) => ({
    etiqueta: c.etiqueta,
    valor: c.total,
  }));
  const donutModalidad: PorcionDonut[] = (control?.porModalidad ?? []).map((c) => ({
    etiqueta: c.etiqueta,
    valor: c.total,
  }));
  /**
   * Los canales, UNA sola vez: la dona y la lista salen de aquí.
   *
   * De `conversionPorOrigen` y no de `porOrigen` porque la lista
   * necesita además cuántos inscribe cada canal, que va en el
   * `title`. Ordenados por volumen y con la paleta fijada a mano,
   * para que el color del punto de la lista sea el de su porción.
   */
  const canales = useMemo(() => {
    const filas = [...(control?.conversionPorOrigen ?? [])].sort((a, b) => b.leads - a.leads);
    const cima = Math.max(1, ...filas.map((f) => f.leads));
    return filas.map((f, i) => {
      const etiqueta = ETIQUETA_ORIGEN[f.etiqueta as Origen] ?? f.etiqueta;
      return {
        etiqueta,
        leads: f.leads,
        color: PALETA_CANAL[i % PALETA_CANAL.length],
        ancho: (f.leads / cima) * 100,
        pista: `${etiqueta}: ${n(f.leads)} personas, ${n(f.inscritos)} inscritos (${Math.round(
          f.conversion * 100,
        )} %)`,
      };
    });
  }, [control]);

  const donutOrigen: PorcionDonut[] = canales.map((c) => ({
    etiqueta: c.etiqueta,
    valor: c.leads,
    color: c.color,
  }));

  /// Verde lo completo y ámbar lo que falta: son un estado bueno
  /// y uno por resolver, no dos categorías cualesquiera, y con
  /// los colores de serie no se distinguía cuál era cuál.
  const donutDatos: PorcionDonut[] = [...(metricas?.porEstado ?? [])]
    .sort((a, b) => b.valor - a.valor)
    .map((e) => ({
      etiqueta: e.etiqueta,
      valor: e.valor,
      color: /completo/i.test(e.etiqueta) ? "var(--exito)" : "var(--aviso)",
    }));

  /// Los grupos de la acción abierta, para el desglose.
  /**
   * El gremio que se está mirando, si es uno solo.
   *
   * Puede serlo por filtro o porque en el corte no hay más que
   * uno. En los dos casos la dona de convenio sobra —una sola
   * porción no reparte nada— y hace falta su nombre para el
   * subtítulo.
   */
  const gremioUnico = useMemo(() => {
    if (convenioId) {
      return (metricas?.porGremio ?? []).find((g) => g.convenioId === convenioId)?.gremio ?? null;
    }
    const cs = control?.porConvenio ?? [];
    return cs.length === 1 ? cs[0].etiqueta : null;
  }, [convenioId, metricas, control]);

  /**
   * Las acciones del gremio, para la dona que ocupa el hueco.
   *
   * Con un solo gremio la tarjeta «Por convenio» no dice nada, y
   * dejar «Por modalidad» sola a lo ancho desperdicia media
   * fila. Lo que sí interesa entonces es en qué acciones se
   * reparte ESE gremio.
   *
   * Cinco y «Otras acciones»: con once porciones la dona es un
   * arcoíris ilegible y la leyenda tapa la tarjeta. Las que se
   * agrupan siguen contando —la suma cuadra con el total—, solo
   * dejan de tener porción propia.
   */
  const CIMA_ACCIONES = 5;
  const donutAcciones: PorcionDonut[] = useMemo(() => {
    const filas = [...(control?.porAccion ?? [])].sort((a, b) => b.total - a.total);
    if (filas.length === 0) return [];
    const cabeza = filas.slice(0, CIMA_ACCIONES).map((f, i) => {
      /// «AF1 · NOMBRE» → «AF1 · Nombre». El código en alta, que
      /// es como se nombra, y el resto en frase: igual que en el
      /// desglose de abajo, que habla de las mismas acciones.
      const codigo = f.etiqueta.split(" ")[0] ?? "";
      const resto = f.etiqueta.slice(codigo.length);
      return {
        etiqueta: `${codigo}${frase(resto)}`,
        valor: f.total,
        color: PALETA_CANAL[i % PALETA_CANAL.length],
      };
    });
    const cola = filas.slice(CIMA_ACCIONES).reduce((t, f) => t + f.total, 0);
    return cola > 0
      ? [...cabeza, { etiqueta: "Otras acciones", valor: cola, color: "var(--superficie-alterna)" }]
      : cabeza;
  }, [control]);

  /// Los grupos de la acción abierta, también de más a menos.
  const gruposDe = (codigo: string) =>
    (control?.porGrupo ?? [])
      .filter((x) => x.clave?.startsWith(codigo))
      .sort((a, b) => b.total - a.total);

  /// Los gremios del ámbito. Con uno solo, su filtro no sale:
  /// ofrecería elegir lo único que hay.
  const gremios = metricas?.porGremio ?? [];

  return (
    <div className="space-y-4">
      {error && <Aviso tipo="error">{error}</Aviso>}

      {/* ── 1 · Filtros, y cuánta gente hay dentro ── */}
      <div className="rounded-xl border border-borde bg-superficie px-4 py-3.5">
        <p className="mb-2.5 text-[0.6875rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
          Filtros
          {entraron > 0 && (
            <span className="ml-2.5 font-normal tracking-normal text-marca normal-case">
              <strong className="font-semibold tabular-nums">{n(entraron)}</strong> personas
              en el proceso
            </span>
          )}
          {hayFiltro && (
            <button
              onClick={quitarFiltros}
              className="ml-3 font-normal tracking-normal text-texto-suave underline normal-case hover:text-texto"
            >
              Limpiar
            </button>
          )}
        </p>

        {/* Los CINCO que recortan qué se mira. El periodo y su
            comparación se subieron a la cabecera: enmarcan la
            pantalla entera, y aquí abajo el «vs. anterior»
            parecía un recorte más.

            `auto-fit` con mínimo de 150px: caben los cinco en
            una fila ancha y bajan solos al estrechar, sin
            «breakpoint» que mantener. */}
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}
        >
            {/* El gremio solo cuando hay más de uno.
                Con un solo gremio en el ámbito, el desplegable
                ofrece elegir lo único que hay: ocupa sitio y no
                recorta nada. */}
            {gremios.length > 1 && (
              <Desplegable
                alto={34}
                marcador="Gremios"
                etiquetaAria="Gremio"
                valor={convenioId}
                opciones={[
                  { valor: "", etiqueta: "Gremios" },
                  ...gremios.map((x) => ({
                    valor: x.convenioId,
                    etiqueta: x.gremio,
                    detalle: `${x.conversion.base} leads`,
                  })),
                ]}
                alElegir={setConvenioId}
              />
            )}

            {/* Desplegable y no buscador: los cinco filtros se
                abren igual, con su segunda línea en gris. Un
                control que se comporta distinto que sus vecinos
                obliga a aprenderlo aparte. */}
            <Desplegable
              alto={34}
              marcador="Acción de formación"
              etiquetaAria="Acción de formación"
              valor={accionFormacionId}
              opciones={[
                { valor: "", etiqueta: "Acción de formación" },
                ...(resumen?.acciones ?? []).map((a) => ({
                  valor: a.id,
                  etiqueta: `${a.codigo} · ${a.nombre}`,
                  detalle: `${a.total} ${a.total === 1 ? "lead" : "leads"}`,
                })),
              ]}
              alElegir={setAccionFormacionId}
            />

            <Desplegable
              alto={34}
              marcador="Grupo"
              etiquetaAria="Grupo"
              valor={grupoId}
              opciones={[
                { valor: "", etiqueta: "Grupo" },
                ...(resumen?.grupos ?? []).map((g) => ({
                  valor: g.id,
                  /// Con el código de su acción delante: «Grupo 1»
                  /// existe en las quince acciones.
                  etiqueta: `${g.accion} · Grupo ${g.numero}`,
                  detalle: `${g.total} ${g.total === 1 ? "lead" : "leads"}`,
                })),
              ]}
              alElegir={setGrupoId}
            />

            <Desplegable
              alto={34}
              marcador="Etapas"
              etiquetaAria="Etapa"
              valor={etapa}
              opciones={[
                { valor: "", etiqueta: "Etapas" },
                ...(resumen?.etapas ?? []).map((e) => ({
                  valor: e.etapa,
                  etiqueta: ETIQUETA_ETAPA[e.etapa],
                  detalle: `${e.total} ${e.total === 1 ? "lead" : "leads"}`,
                })),
              ]}
              alElegir={setEtapa}
            />

            <Desplegable
              alto={34}
              marcador="Asesores"
              etiquetaAria="Asesor"
              valor={asesorId}
              opciones={[
                { valor: "", etiqueta: "Asesores" },
                ...(resumen?.asesores ?? []).map((a) => ({
                  valor: a.id,
                  etiqueta: a.nombre,
                  detalle: `${a.total} ${a.total === 1 ? "lead" : "leads"}`,
                })),
              ]}
              alElegir={setAsesorId}
            />

            <Desplegable
              alto={34}
              marcador="Departamentos"
              etiquetaAria="Departamento"
              valor={departamentoSepId}
              opciones={[
                { valor: "", etiqueta: "Departamentos" },
                ...(resumen?.departamentos ?? []).map((d) => ({
                  valor: String(d.id),
                  etiqueta: d.nombre,
                  detalle: `${d.total} ${d.total === 1 ? "lead" : "leads"}`,
                })),
              ]}
              alElegir={setDepartamentoSepId}
            />
        </div>
      </div>

      {/* La barra fina de arriba mientras llega el dato nuevo.
          El encargo la pide junto al atenuado, y hace falta: la
          opacidad sola, en una pantalla que ya es clara, casi no
          se nota, y quien cambia un filtro no sabe si pasó algo.
          `aria-hidden` porque el aviso de verdad para un lector
          de pantalla es el `aria-busy` de abajo. */}
      {cargando && control && (
        <div className="h-0.5 overflow-hidden rounded-full bg-superficie-alterna" aria-hidden>
          <div className="h-full w-1/3 animate-[recorrer_1.1s_ease-in-out_infinite] rounded-full bg-marca" />
        </div>
      )}

      <div
        className={`space-y-4 transition-opacity ${claseCargando}`}
        aria-busy={cargando && Boolean(control)}
      >
        {/* ── 2 · El embudo ── */}
        <Bloque
          estirado
          titulo="El proceso de inscripción, paso a paso"
          descripcion="Cuántos llegan a cada hito y cuántos se caen entre uno y otro."
        >
          <EmbudoProceso
            hitos={hitos}
            notas={notas}
            /* La meta solo cuando se puede comparar de verdad.
               El backend ya la acota por gremio y por acción,
               que es como se compromete con el SENA. Pero una
               meta no se reparte por asesor, ni por departamento,
               ni por etapa: con uno de esos tres puesto, arriba
               habría un numerador filtrado y abajo una meta que
               no lo está, y el porcentaje sería mentira. Antes de
               enseñar una cifra falsa, ninguna. */
            meta={metaComparable ? control?.metaComprometida ?? null : null}
          />
        </Bloque>

        {/* ── 3 · Lo que hay que hacer hoy ──

            Segundo puesto y no noveno: es lo unico de la
            pantalla que se HACE. Lo de arriba y lo de abajo
            describe —cuantos entraron, donde se caen, de donde
            vienen— y esto dice que hacer, con el nombre de a
            quien llamar.

            Va justo debajo del embudo a proposito: el embudo
            enseña donde se cae la gente y esto dice como
            recogerla. Al final se leia despues de todo lo que
            solo se mira, que es como se perdio la primera vez. */}
        <PendientesDeHoy control={control ?? null} />

        {/* ── 4 · Las tres tasas y el tiempo ── */}
        <div className="grid gap-4 min-[620px]:grid-cols-2 min-[1120px]:grid-cols-4">
          <Bloque estirado>
            <Medidor
              porcentaje={entraron > 0 ? (inscritos / entraron) * 100 : 0}
              cifra={inscritos}
              etiqueta="Tasa de inscripción"
              detalle={`de ${n(entraron)} llegaron a inscribirse.`}
            />
          </Bloque>
          <Bloque estirado>
            <Medidor
              porcentaje={entraron > 0 ? (contactados / entraron) * 100 : 0}
              cifra={contactados}
              etiqueta="Tasa de contacto"
              detalle={`de ${n(entraron)} ya fueron contactados.`}
            />
          </Bloque>
          <Bloque estirado>
            <Medidor
              porcentaje={entraron > 0 ? (perdidos / entraron) * 100 : 0}
              /* Verde hasta el 15 %, ámbar hasta el 30 y rojo por
                 encima. En rojo fijo, un 4,7 % de pérdida —que es
                 bueno— se leía como una alarma. */
              color={
                perdidos / Math.max(entraron, 1) <= 0.15
                  ? "var(--exito)"
                  : perdidos / Math.max(entraron, 1) <= 0.3
                    ? "var(--aviso)"
                    : "var(--error)"
              }
              cifra={perdidos}
              etiqueta="Tasa de pérdida"
              detalle={`de ${n(entraron)} se marcaron como no interesados.`}
            />
          </Bloque>
          <Bloque estirado>
            <div>
              <p className="text-[0.65625rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
                De lead a inscrito
              </p>
              <p className="mt-2 text-[1.5rem] font-bold leading-none tracking-[-0.025em] tabular-nums text-titulo">
                {control?.diasHastaInscribir != null
                  ? `${Math.round(control.diasHastaInscribir)} días`
                  : "—"}
              </p>
              <p className="mt-1 text-[0.71875rem] text-texto-suave">
                de media desde que llega una persona hasta que se inscribe.
              </p>
            </div>
          </Bloque>
        </div>

        {/* ── 5 · De qué está hecha esa gente ── */}
        <div className="grid gap-4 min-[1000px]:grid-cols-2">
          {/* Con un solo gremio la tarta de convenios sobra —una
              sola porción no reparte nada— y en su hueco entra
              cómo se reparten las acciones DE ESE gremio, que es
              la pregunta que queda cuando ya se sabe cuál es.
              El encargo decía dejar «Por modalidad» sola a lo
              ancho; media fila vacía no informa de nada. */}
          {donutConvenio.length > 1 && !gremioUnico ? (
            <Bloque titulo="Por convenio" descripcion="Cómo se reparten entre los dos gremios.">
              <Donut datos={donutConvenio} detalleCentro="personas" />
            </Bloque>
          ) : (
            <Bloque
              titulo="Por acción de formación"
              descripcion={
                gremioUnico
                  ? `Cómo se reparten sus acciones dentro de ${gremioUnico}.`
                  : "Cómo se reparten las acciones de formación."
              }
            >
              <Donut
                datos={donutAcciones}
                detalleCentro="personas"
                vacio="Sin acciones con personas."
              />
            </Bloque>
          )}
          <Bloque titulo="Por modalidad" descripcion="Presencial frente a virtual.">
            <Donut datos={donutModalidad} detalleCentro="personas" vacio="Sin modalidad registrada." />
          </Bloque>
        </div>

        {/* ── 6 · Dónde está cada quien y si sus datos sirven ── */}
        <div className="grid gap-4 min-[1000px]:grid-cols-2">
          <Bloque
            titulo="Dónde está cada persona hoy"
            descripcion="Las etapas de la inscripción, agrupadas por fase."
          >
            <div className="space-y-4">
              {FASES.map((f) => {
                const filas = f.etapas.filter((e) => valorDeFase(e) > 0);
                if (filas.length === 0) return null;
                return (
                  <div key={f.titulo}>
                    <p className="mb-2 text-[0.625rem] font-bold tracking-[0.1em] text-marca uppercase">
                      {f.titulo}
                    </p>
                    <ul className="space-y-2.5">
                      {filas.map((e) => {
                        const v = valorDeFase(e);
                        return (
                          <li key={e}>
                            <div className="flex items-baseline justify-between gap-3 text-[0.84375rem]">
                              <span className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                                  style={{ background: colorEtapa(e) }}
                                  aria-hidden
                                />
                                {ETIQUETA_ETAPA[e]}
                              </span>
                              <span className="shrink-0 font-semibold tabular-nums">
                                {n(v)}
                                <span className="ml-2 text-[0.71875rem] font-normal text-texto-suave">
                                  {pct(v, entraron)}
                                </span>
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-superficie-alterna">
                              <div
                                className="h-full rounded-full transition-[width] duration-500"
                                style={{
                                  width: `${cimaDeFase > 0 ? (v / cimaDeFase) * 100 : 0}%`,
                                  background: colorEtapa(e),
                                }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Bloque>

          <Bloque
            titulo="Estado de los datos"
            descripcion="Cuántas fichas están completas y cuántas a medias."
          >
            <Donut datos={donutDatos} detalleCentro="personas" vacio="Sin fichas todavía." />
          </Bloque>
        </div>

        {/* ── 7 · A qué ritmo entra y por dónde ── */}
        <div className="grid gap-4 min-[1000px]:grid-cols-2">
          <Bloque
            titulo="Ritmo de inscripción"
            descripcion="Inscritos por el día en que se inscribieron."
          >
            <Serie datos={control?.serie ?? []} />
          </Bloque>

          <Bloque
            titulo="De dónde vienen"
            descripcion="Volumen por canal y cuánto convierte cada uno."
          >
            {/* Dona a la izquierda y UNA lista a la derecha:
                punto de color, canal, cuántos, y la barra debajo.
                Tenía la leyenda de la dona MÁS un bloque aparte de
                barras, y las dos decían lo mismo dos veces. Lo que
                no dice la dona —cuántos inscribe cada canal— va en
                el `title`, que es donde el encargo lo pide. */}
            <div className="flex flex-wrap items-center gap-4">
              <Donut datos={donutOrigen} tamano={128} detalleCentro="personas" soloDibujo />
              <ul className="min-w-[170px] flex-1 space-y-2.5">
                {canales.map((c) => (
                  <li key={c.etiqueta} title={c.pista}>
                    <div className="flex items-baseline gap-2 text-[0.78125rem]">
                      <span
                        className="inline-block h-2 w-2 shrink-0 self-center rounded-full"
                        style={{ background: c.color }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{c.etiqueta}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{n(c.leads)}</span>
                    </div>
                    <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-superficie-alterna">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${c.ancho}%`, background: c.color }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Bloque>
        </div>

        {/* ── 8 · Dónde vive y quién la atiende ── */}
        <div className="grid gap-4 min-[1000px]:grid-cols-[0.9fr_1.1fr]">
          <Bloque
            titulo="Por departamento"
            descripcion="Dónde vive la gente. Pase el cursor para la cantidad."
          >
            <MapaColombia
              datos={(resumen?.departamentos ?? []).map((d) => ({
                nombre: d.nombre,
                total: d.total,
              }))}
            />
          </Bloque>

          <Bloque
            titulo="Rendimiento por asesor"
            descripcion="Cuántos lleva y cuántos convierte a inscrito cada uno."
          >
            <TablaAsesores filas={control?.porAsesor ?? []} />
          </Bloque>
        </div>

        {/* ── 9 · El detalle, con sus grupos dentro ── */}
        <Bloque
          estirado
          titulo="Desglose por acción de formación"
          descripcion="Haga clic en una acción para ver el avance de sus grupos."
        >
          <DesgloseAcciones
            filas={control?.porAccion ?? []}
            total={entraron}
            abierta={accionAbierta}
            alAbrir={setAccionAbierta}
            grupos={gruposDe}
          />
        </Bloque>

      </div>
    </div>
  );
}

/** El ritmo, como área. */
function Serie({ datos }: { datos: Array<{ dia: string; total: number }> }) {
  if (datos.length === 0) {
    return <p className="py-8 text-center text-[0.84375rem] text-texto-suave">Sin inscritos en el periodo.</p>;
  }
  const cima = Math.max(1, ...datos.map((d) => d.total));
  const ancho = 100;
  const alto = 100;
  const paso = datos.length > 1 ? ancho / (datos.length - 1) : 0;
  const puntos = datos.map((d, i) => `${i * paso},${alto - (d.total / cima) * alto}`);
  const area = `0,${alto} ${puntos.join(" ")} ${(datos.length - 1) * paso},${alto}`;

  return (
    <div>
      <div className="h-[140px]">
        <svg
          viewBox={`0 0 ${ancho} ${alto}`}
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <polygon points={area} fill={SERIE.uno} opacity={0.14} />
          <polyline
            points={puntos.join(" ")}
            fill="none"
            stroke={SERIE.uno}
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[0.625rem] text-texto-suave tabular-nums">
        <span>{fecha(datos[0].dia)}</span>
        <span>{fecha(datos[datos.length - 1].dia)}</span>
      </div>
    </div>
  );
}

function fecha(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

/** Quién lleva cuántos y cuántos convierte. */
function TablaAsesores({
  filas,
}: {
  filas: Array<{
    asesorId: string | null;
    etiqueta: string;
    asignados: number;
    inscritosSiempre: number;
    conversion: number;
  }>;
}) {
  if (filas.length === 0) {
    return <p className="py-8 text-center text-[0.84375rem] text-texto-suave">Sin asesores con fichas.</p>;
  }
  /// Por conversión y con «Sin asignar» al final: no es un
  /// asesor, y colado entre ellos por su tasa parecía el mejor
  /// del equipo. Es la regla del prototipo.
  const orden = [...filas].sort((a, b) => {
    const sa = a.asesorId === null;
    const sb = b.asesorId === null;
    if (sa !== sb) return sa ? 1 : -1;
    return b.conversion - a.conversion;
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[0.84375rem]">
        <thead>
          <tr className="border-b border-hairline text-[0.625rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
            <th className="pb-2 text-left font-bold">Asesor</th>
            <th className="pb-2 text-right font-bold">Total</th>
            <th className="pb-2 text-right font-bold">Inscr.</th>
            <th className="pb-2 pl-4 text-left font-bold">Conversión</th>
          </tr>
        </thead>
        <tbody>
          {orden.map((f) => (
            <tr
              key={f.asesorId ?? "sin"}
              className="border-b border-hairline last:border-0 transition hover:bg-tabla-fila-resaltada"
            >
              <td className="py-2 text-marca">{f.etiqueta}</td>
              <td className="py-2 text-right tabular-nums">{n(f.asignados)}</td>
              <td className="py-2 text-right font-semibold tabular-nums">{n(f.inscritosSiempre)}</td>
              <td className="py-2 pl-4">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 min-w-[60px] flex-1 overflow-hidden rounded-full bg-superficie-alterna">
                    <div
                      className="h-full rounded-full bg-marca"
                      style={{ width: `${Math.round(f.conversion * 100)}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[0.71875rem] tabular-nums">
                    {Math.round(f.conversion * 100)} %
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** El ranking por acción, y sus grupos al desplegar. */
function DesgloseAcciones({
  filas,
  total,
  abierta,
  alAbrir,
  grupos,
}: {
  filas: Array<{ etiqueta: string; total: number }>;
  total: number;
  abierta: string | null;
  alAbrir: (v: string | null) => void;
  grupos: (codigo: string) => Array<{ etiqueta: string; total: number; inicio: string | null }>;
}) {
  if (filas.length === 0) {
    return <p className="py-8 text-center text-[0.84375rem] text-texto-suave">Sin acciones con inscritos.</p>;
  }
  const cima = Math.max(1, ...filas.map((f) => f.total));
  /// De más a menos, no por código: es un ranking, y quien mira
  /// esto quiere ver primero la acción que más gente mueve.
  const orden = [...filas].sort((a, b) => b.total - a.total);

  return (
    <ul className="divide-y divide-hairline">
      {orden.map((f) => {
        /// El código va delante de la etiqueta: «AF1 · nombre».
        const codigo = f.etiqueta.split(" ")[0] ?? f.etiqueta;
        const nombre = frase(f.etiqueta.slice(codigo.length).replace(/^\s*·\s*/, ""));
        const abierto = abierta === f.etiqueta;
        const sus = abierto ? grupos(codigo) : [];

        return (
          <li key={f.etiqueta}>
            <button
              type="button"
              onClick={() => alAbrir(abierto ? null : f.etiqueta)}
              className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-tabla-fila-resaltada"
            >
              <span
                className={`shrink-0 text-texto-suave transition-transform ${abierto ? "rotate-90" : ""}`}
                aria-hidden
              >
                ›
              </span>
              <span className="w-10 shrink-0 text-[0.84375rem] font-semibold text-marca">
                {codigo}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.84375rem] text-titulo">
                {nombre || f.etiqueta}
              </span>
              <span className="hidden h-1.5 w-40 shrink-0 overflow-hidden rounded-full bg-superficie-alterna sm:block">
                <span
                  className="block h-full rounded-full bg-marca"
                  style={{ width: `${(f.total / cima) * 100}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-[0.84375rem] font-semibold tabular-nums">
                {n(f.total)}
              </span>
              <span className="w-10 shrink-0 text-right text-[0.71875rem] text-texto-suave tabular-nums">
                {pct(f.total, total)}
              </span>
            </button>

            {abierto && (
              <div className="pb-3 pl-[4.25rem]">
                {sus.length === 0 ? (
                  <p className="text-[0.78125rem] text-texto-suave">Sin grupos registrados.</p>
                ) : (
                  <ul className="space-y-2">
                    {sus.map((gr) => (
                      <li key={gr.etiqueta} className="flex items-center gap-3 text-[0.78125rem]">
                        <span className="min-w-0 flex-1 truncate text-texto-suave">
                          {gr.etiqueta}
                          {gr.inicio && (
                            <span className="ml-2 opacity-70">arranca {fecha(gr.inicio)}</span>
                          )}
                        </span>
                        <span className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-superficie-alterna">
                          <span
                            className="block h-full rounded-full bg-marca opacity-70"
                            style={{ width: `${(gr.total / Math.max(1, f.total)) * 100}%` }}
                          />
                        </span>
                        <span className="w-6 shrink-0 text-right font-semibold tabular-nums">
                          {n(gr.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
