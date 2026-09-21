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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Desplegable } from "./desplegable";
import { caidaMayor, EmbudoForma } from "./embudo-forma";
import { ALTO_CIFRA as ALTO_CIFRA_COLUMNA, EmbudoPorDia } from "./embudo-por-dia";
/// `EmbudoProceso` --las cuatro barras verticales-- ya no se
/// llama desde aquí, pero NO se borra: lo siguen usando el panel
/// académico y Tráfico del formulario, donde no hay dimensión de
/// día y cuatro barras están bien.
import { TarjetasDelEmbudo, type Hito } from "./embudo-proceso";
import { MapaColombia } from "./mapa-colombia";
import { Aviso } from "./marco-admin";
import {
  Donut,
  ListaBarras,
  Medidor,
  n,
  SERIE,
  type PorcionDonut,
} from "./graficos";
import { PendientesDeHoy, ReservasSinNombre } from "./pendientes-de-hoy";
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

/**
 * La lista del CATÁLOGO con la cuenta DEL PERIODO pegada.
 *
 * Los desplegables tienen dos preguntas distintas que contestar
 * y hasta ahora salían de la misma respuesta, que no podía con
 * las dos. Qué se puede elegir es todo lo que existe en el
 * ámbito --si sale de una respuesta recortada, al elegir
 * ANTIOQUIA la lista se queda en «Departamentos» y «ANTIOQUIA» y
 * no hay forma de saltar a Cundinamarca--. Y cuántos leads tiene
 * cada opción es del periodo de la cabecera --si no, con «Hoy»
 * puesto se ofrecía «ANTIOQUIA · 104 leads» y al elegirlo el
 * bloque contestaba «No entró nadie hoy»--.
 *
 * Así que la lista viene de una y la cifra de la otra, y lo que
 * el periodo no trae se enseña en cero, que es la verdad y
 * además se ve antes de pulsar.
 */
function conCuentaDelPeriodo<T extends { total: number }>(
  delAmbito: T[],
  delPeriodo: T[],
  clave: (x: T) => string | number | null,
): T[] {
  const cuenta = new Map(delPeriodo.map((x) => [clave(x), x.total]));
  return delAmbito.map((x) => ({ ...x, total: cuenta.get(clave(x)) ?? 0 }));
}

/**
 * El embudo, ACUMULADO: quién llegó a cada hito.
 *
 * Desde `resumen.etapas` y no desde `control.embudo`: aquel va
 * recortado a las cinco de inscripción —con razón, ver
 * `control.ts:46`— y quien pasó al aula desaparecería, así que
 * los veintitrés en formación contarían como «no inscritos».
 *
 * Función suelta y no `useMemo` en línea: ahora se calcula dos
 * veces, para el periodo y para el de comparación, y tienen que
 * salir por la MISMA regla.
 */
function hitosDe(res: Resumen | null): Hito[] {
  if (!res) return [];
  const en = new Map(res.etapas.map((e) => [e.etapa, e.total]));
  const g = (...es: Etapa[]) => es.reduce((t, e) => t + (en.get(e) ?? 0), 0);
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
}

/**
 * El hueco del embudo mientras no ha llegado su dato.
 *
 * Las dos mitades del bloque vienen de dos consultas y no llegan
 * a la vez: hubo pruebas en las que, ocho segundos después de
 * cambiar de periodo, se veían la leyenda y las columnas enteras
 * y a la izquierda NADA --ni figura ni frase--, con pinta de
 * resultado y no de espera. Media tarjeta pintada es una tarjeta
 * que miente; un hueco con forma de embudo no.
 */
function HuecoDelEmbudo() {
  return (
    <div className="mx-auto w-full max-w-[360px] py-1" aria-hidden>
      {[100, 74, 52, 34].map((ancho) => (
        <div
          key={ancho}
          className="mx-auto mb-2 animate-pulse rounded-[4px] bg-superficie-alterna"
          style={{ width: `${ancho}%`, height: 40 }}
        />
      ))}
    </div>
  );
}

/**
 * El sitio del gráfico de días cuando no hay días que repartir.
 *
 * Con «Hoy» o «Ayer» la serie es una sola columna, que no es un
 * gráfico: repetiría los mismos cuatro números del embudo, en
 * grande. Antes eso se resolvía quitando la mitad derecha y
 * dándole la tarjeta entera al embudo, y quedaban 1.100 px de
 * blanco —el 84 % de la tarjeta— sin una palabra que dijera por
 * qué había desaparecido media pantalla.
 */
function SinColumnas({
  cuando,
  hayFiltro,
  cuantos,
  dia,
}: {
  cuando: string | null;
  /// Si hay algún filtro puesto. `porDia.length <= 1` significa
  /// DOS cosas distintas --que el periodo es de un día («Hoy»,
  /// «Ayer») y que el filtro dejó a toda la gente en un día-- y
  /// aquí se escribía siempre la primera: con «Desde el
  /// principio» + Departamento «PUTUMAYO · 1 persona» la pantalla
  /// afirmaba que «Desde el principio» cabe en un solo día y
  /// mandaba elegir un periodo más largo, que además no existe.
  hayFiltro: boolean;
  /// Cuánta gente entró, y qué día. Es la información útil que la
  /// frase del periodo tapaba.
  cuantos: number;
  dia: string | null;
}) {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center rounded-[10px] border border-dashed border-borde px-5 py-6">
      <p className="max-w-[380px] text-center text-[0.84375rem] leading-relaxed text-texto-suave">
        {hayFiltro ? (
          <>
            <strong className="font-semibold text-titulo">
              Con estos filtros{" "}
              {cuantos === 1
                ? `entró una sola persona${dia ? `, el ${dia}` : ""}`
                : `entraron ${n(cuantos)} personas${dia ? `, todas el ${dia}` : ""}`}
            </strong>
            , así que no hay nada que repartir por fechas: el embudo de la izquierda ya lo
            cuenta todo.
          </>
        ) : (
          <>
            <strong className="font-semibold text-titulo">
              {cuando ? `«${cuando}» cabe en un solo día` : "El periodo cabe en un solo día"}
            </strong>
            , así que no hay nada que repartir por fechas: el embudo de la izquierda ya lo
            cuenta todo. Elija un periodo más largo para ver por qué día fue entrando la
            gente.
          </>
        )}
      </p>
    </div>
  );
}

/**
 * El bloque cuando en el periodo no entró nadie.
 *
 * UNA caja y no dos: la frase de arriba ya dice «No entró nadie
 * hoy», así que aquí lo que falta no es repetirlo sino decir qué
 * hacer. Antes esto eran 302 px de blanco con ocho rótulos a
 * cero flotando al lado, que parece una pantalla rota.
 */
function SinGente({ hayFiltro }: { hayFiltro: boolean }) {
  return (
    <div className="flex min-h-[140px] items-center justify-center rounded-[10px] border border-dashed border-borde px-5 py-8">
      <p className="max-w-[460px] text-center text-[0.8125rem] leading-relaxed text-texto-suave">
        No hay embudo que dibujar todavía.{" "}
        {hayFiltro
          ? "Pruebe con un periodo más largo, o quite alguno de los filtros de arriba."
          : "Pruebe con un periodo más largo."}
      </p>
    </div>
  );
}

/**
 * Cuánto tiene que pasar para volver a pedir LO MISMO.
 *
 * El fin de la ventana es «ahora» y `control` se repone solo
 * cada treinta segundos, así que cada vuelta traía un
 * `llegoHasta` nuevo y volvía a disparar estas consultas aunque
 * nadie hubiera elegido nada. En un cambio de filtro eso salía
 * DOS veces --la del gesto y la del borde que se movió al
 * llegar el `control` nuevo-- y eran cuatro peticiones tiradas
 * por gesto. Con el techo del servidor en sesenta por minuto,
 * al quinto o sexto cambio la pantalla se quedaba en 429, vacía
 * y congelada más de un minuto.
 *
 * Si lo único que se movió es ese borde y la respuesta todavía
 * es reciente, no se vuelve a pedir. Pasados estos segundos sí,
 * para que las cifras sigan vivas: por eso es MENOR que los
 * treinta del refresco, y no mayor.
 */
const REFRESCO_MINIMO = 20_000;

/**
 * Lo que se pintó, CON EL SELLO de a qué corte pertenece.
 *
 * Junto en un solo estado y no en tres sueltos, y con su
 * etiqueta dentro, porque el bloque tiene que poder decir
 * siempre de qué periodo son las cifras que enseña. Cuando una
 * petición fallaba --un 429 del limitador basta-- las cifras se
 * quedaban en las del periodo anterior y el rótulo saltaba al
 * nuevo: el desplegable decía «Últimos 7 días» y al lado se
 * leía «De las 131 personas que entraron en los últimos 30
 * días», con la frase de la tasa comparando dos periodos que no
 * eran esos. Pasaba porque el rótulo salía del estado de la
 * cabecera --que cambia al instante-- y las cifras de la
 * respuesta que no llegó. Viajando juntos no se puede volver a
 * escribir.
 */
type Cargado = {
  /// Qué se pidió: los cinco cortes, el inicio de las dos
  /// ventanas y el nombre del periodo. El FIN no entra: se mueve
  /// solo. Es `claveActual`, y ahí está el porqué de cada pieza.
  clave: string;
  /// Cómo se llamaba el periodo cuando se pidieron estas cifras.
  etiqueta: string;
  /// Y aquel con el que se comparan. Null = no se compara.
  etiquetaAnterior: string | null;
  metricas: MetricasInscripciones | null;
  delPeriodo: Resumen | null;
  delAnterior: Resumen | null;
};

export function PanelProceso({
  control,
  comparar = true,
  etiquetaAnterior = null,
  etiquetaPeriodo = null,
  controlAlDia = true,
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
  /// Falso = no se compara con nada: ni barra gris ni leyenda.
  comparar?: boolean;
  /// Cómo se llama el periodo anterior: «ayer», «los 7 días
  /// anteriores»… Lo decide la cabecera y el embudo lo repite.
  /// Sin esto, arriba decía «los 7 días anteriores» y el gráfico
  /// «el mismo tramo del periodo anterior» (cliente, 20 sep 2026).
  etiquetaAnterior?: string | null;
  /// Cómo se llama el periodo ELEGIDO en el desplegable de la
  /// cabecera, al instante. No se usa para rotular ninguna cifra
  /// --para eso está el sello de `Cargado`-- sino para poder
  /// decir, cuando una consulta falla, qué periodo se pidió y no
  /// se pudo traer.
  etiquetaPeriodo?: string | null;
  /// Si el `control` que llega es del periodo elegido. Falso =
  /// su consulta no volvió y lo que trae es del periodo de
  /// antes; entonces las columnas de la derecha tampoco son las
  /// que se pidieron, y hay que decirlo.
  controlAlDia?: boolean;
  alCambiarFiltros?: (f: Filtros) => void;
}) {
  const [convenioId, setConvenioId] = useState("");
  const [accionFormacionId, setAccionFormacionId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  /// SIN filtro de etapa, y es una decisión: ver el comentario de
  /// la fila de filtros, más abajo.
  const [asesorId, setAsesorId] = useState("");
  const [departamentoSepId, setDepartamentoSepId] = useState("");

  /// Lo cargado, con el sello de a qué corte pertenece. Ver `Cargado`.
  const [datos, setDatos] = useState<Cargado | null>(null);
  /**
   * QUÉ SE PUEDE ELEGIR: el catálogo del ámbito.
   *
   * Un `/resumen` sin periodo y sin ninguno de los cinco cortes.
   * Es lo que existe, no lo que hay ahora en pantalla, y por eso
   * no cambia en toda la sesión: se pide una vez.
   *
   * De aquí sale la LISTA de los cuatro desplegables. Salía de
   * la respuesta ya recortada por el propio filtro, así que al
   * elegir se quedaba con una sola opción --Departamentos 29 → 2,
   * Grupo 25 → 2, Acción de formación 13 → 2, Asesores 8 → 2-- y
   * para saltar de ANTIOQUIA a CUNDINAMARCA había que pulsar
   * «Limpiar», que borra los cinco filtros de golpe. «Que
   * funcionen los filtros» (cliente, 20 sep 2026).
   */
  const [catalogo, setCatalogo] = useState<Resumen | null>(null);
  /**
   * CUÁNTOS LEADS tiene cada opción en el periodo de la cabecera.
   *
   * El mismo `/resumen`, recortado solo por el periodo. Va
   * aparte del catálogo porque contesta otra pregunta, y sin los
   * cinco cortes porque un desplegable no puede contar con su
   * propio filtro puesto: diría que Cundinamarca tiene cero.
   *
   * Sin esto, la segunda línea en gris --«115 leads»-- decía lo
   * mismo con «Hoy» que con «Desde el principio», y se elegía
   * «ANTIOQUIA · 104 leads» para que el bloque contestara «No
   * entró nadie hoy». Solo se pide cuando cambia el PERIODO: un
   * cambio de filtro no la mueve.
   */
  const [opciones, setOpciones] = useState<Resumen | null>(null);
  /// Solo manda la ultima respuesta: cambiar de periodo dos
  /// veces seguidas no puede dejar pintada la primera.
  const turno = useRef(0);
  /// Qué se pidió la última vez, SIN el fin de la ventana.
  const ultimaClave = useRef<string | null>(null);
  /// Lo mismo, pero visible para el dibujo: hace falta para no
  /// enseñar el aviso de «esto es viejo» durante el medio
  /// segundo que va entre elegir y tener la respuesta.
  const [clavePedida, setClavePedida] = useState<string | null>(null);
  /// Cuándo contestó bien la última vez. Ver `REFRESCO_MINIMO`.
  const ultimaRespuesta = useRef(0);
  /// De qué periodo son las cuentas que ya están cargadas.
  /// `undefined` es «todavía ninguna».
  const periodoDeOpciones = useRef<string | undefined>(undefined);
  /// Si el catálogo ya llegó. No cambia en toda la sesión.
  const hayCatalogo = useRef(false);
  /// Sube uno cada vez que se pulsa «Volver a intentarlo».
  const [intento, setIntento] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accionAbierta, setAccionAbierta] = useState<string | null>(null);

  const filtros = useMemo<Filtros>(
    () => ({
      convenioId: convenioId || undefined,
      accionFormacionId: accionFormacionId || undefined,
      grupoId: grupoId || undefined,
      asesorId: asesorId || undefined,
      departamentoSepId: departamentoSepId ? Number(departamentoSepId) : undefined,
    }),
    [convenioId, accionFormacionId, grupoId, asesorId, departamentoSepId],
  );

  /// La ventana que la cabecera YA resolvió. Se usa tal cual:
  /// recalcular «hoy» aquí sería una segunda idea de dónde
  /// empieza el día en Bogotá.
  const actual = control?.ventana.instantes?.actual ?? null;
  const anterior = comparar ? (control?.ventana.instantes?.anterior ?? null) : null;
  const [aDesde, aHasta] = [actual?.desde, actual?.hasta];
  const [bDesde, bHasta] = [anterior?.desde, anterior?.hasta];

  /// Los dos rótulos, de la MISMA respuesta que trae la ventana.
  /// Se sellan con las cifras (ver `Cargado`) y entran en la
  /// clave: si el periodo cambia de nombre, lo que hay pintado
  /// deja de valer aunque las fechas se parezcan.
  const rotuloPeriodo = control?.ventana.etiqueta ?? null;
  const rotuloAnterior = comparar
    ? (etiquetaAnterior?.toLowerCase() ?? control?.ventana.etiquetaAnterior ?? null)
    : null;

  /**
   * QUÉ SE ESTÁ PIDIENDO ahora mismo, en una cadena.
   *
   * Los cinco cortes, el inicio de las dos ventanas y el nombre
   * del periodo. El FIN no entra a propósito: es «ahora» y se
   * mueve solo (ver `REFRESCO_MINIMO`).
   *
   * TODO lo que entra aquí sale de `control`, nunca del estado
   * de la cabecera. El estado de la cabecera cambia al instante y
   * `control` tarda su medio segundo: metiendo aquí el nombre que
   * la cabecera le da al periodo anterior, un cambio de periodo
   * disparaba las consultas DOS veces, una con la ventana vieja
   * y otra con la nueva, que es justo lo que se quiere evitar.
   *
   * Sirve para dos cosas: para no repetir una consulta que ya se
   * hizo, y para saber si lo que hay pintado es de este corte o
   * de otro.
   */
  const claveActual = useMemo(
    () => JSON.stringify([filtros, aDesde ?? null, bDesde ?? null, rotuloPeriodo]),
    [filtros, aDesde, bDesde, rotuloPeriodo],
  );

  /**
   * EL EMBUDO NO OBEDECÍA AL PERIODO (18 sep 2026).
   *
   * Pedía `resumen` solo con los cinco filtros de abajo: con
   * «Hoy» y «vs. ayer» arriba seguía pintando todo el histórico,
   * mientras los bloques de al lado sí se vaciaban. «Seleccioné y
   * no sirvió», con razón. Ahora corta por `creadoEn` --cuándo
   * llegó el lead--, que es la fecha con la que `control` corta
   * su propio embudo.
   */
  /**
   * EN SILENCIO cuando solo avanzó el reloj (18 sep 2026).
   *
   * Con «Hoy», «7 días» o «30 días» el fin de la ventana es AHORA,
   * y la página refresca cada 30 s: el fin cambiaba en cada vuelta,
   * esto recargaba con `cargando` y el panel se atenuaba y dejaba
   * de responder cada medio minuto. Lo vio José. Solo se atenúa
   * cuando cambia lo que la persona ELIGIÓ --filtros o el inicio de
   * un periodo--; lo demás es el mismo periodo, más reciente.
   */
  const cargar = useCallback(async () => {
    /// SIN `control` no se pide nada. La ventana la resuelve él,
    /// y pedir antes de que llegue es pedir con la ventana
    /// equivocada y tener que repetirlo entero un instante
    /// después: era la mitad de las peticiones de la carga en
    /// frío y de cada cambio de periodo.
    if (rotuloPeriodo === null) return;

    const clave = claveActual;
    const mismaEleccion = clave === ultimaClave.current;
    /// Lo único que se movió es el borde «ahora» y la respuesta
    /// es de hace nada: no hay nada nuevo que traer.
    if (mismaEleccion && Date.now() - ultimaRespuesta.current < REFRESCO_MINIMO) return;

    const mio = ++turno.current;
    ultimaClave.current = clave;
    setClavePedida(clave);
    if (!mismaEleccion) setCargando(true);
    /// Sin ningún corte puesto, la consulta del periodo y la de
    /// las cuentas son LA MISMA URL, así que se pide una y sirve
    /// para las dos.
    const sinRecorte =
      !filtros.convenioId &&
      !filtros.accionFormacionId &&
      !filtros.grupoId &&
      !filtros.asesorId &&
      !filtros.departamentoSepId;
    /// Las cuentas de los desplegables solo dependen del PERIODO
    /// --no llevan los cinco cortes--, así que cambiar un filtro
    /// no las mueve y no hace falta volver a pedirlas. Y sin
    /// periodo no se piden nunca: entonces son el catálogo.
    const pedirOpciones =
      Boolean(aDesde) && !sinRecorte && periodoDeOpciones.current !== aDesde;
    /// El catálogo, una sola vez en toda la sesión.
    const pedirCatalogo = !hayCatalogo.current;
    try {
      const [met, per, ant, ops, cat] = await Promise.all([
        /// `metricas` también lleva el periodo, para que «Estado
        /// de los datos» hable del periodo de la cabecera como
        /// todo lo demás. Ya NO alimenta el desplegable de
        /// gremios: aquella cuenta recorta por etapa y el bloque
        /// no, así que ofrecía 98 y al pulsarla contestaba 103.
        crmApi.metricas({ ...filtros, llegoDesde: aDesde, llegoHasta: aHasta }),
        /// TODAS las cifras del bloque salen de aquí. Con «Desde
        /// el principio» las dos fechas van vacías y es el
        /// resumen de siempre; con cualquier otro periodo, el
        /// recorte por `creadoEn`, que es la fecha con la que
        /// `control` corta su propio embudo.
        crmApi.resumen({ ...filtros, llegoDesde: aDesde, llegoHasta: aHasta }),
        bDesde && bHasta
          ? crmApi.resumen({ ...filtros, llegoDesde: bDesde, llegoHasta: bHasta })
          : Promise.resolve(null),
        pedirOpciones
          ? crmApi.resumen({ llegoDesde: aDesde, llegoHasta: aHasta })
          : Promise.resolve(null),
        pedirCatalogo ? crmApi.resumen({}) : Promise.resolve(null),
      ]);
      if (mio !== turno.current) return;
      /// Con periodo y sin cortes, `per` YA es la consulta de las
      /// cuentas: misma URL, una sola petición.
      const cuentasNuevas = ops ?? (aDesde && sinRecorte ? per : null);
      if (cuentasNuevas) {
        setOpciones(cuentasNuevas);
        periodoDeOpciones.current = aDesde;
      }
      if (cat) {
        setCatalogo(cat);
        hayCatalogo.current = true;
      }
      setDatos({
        clave,
        etiqueta: rotuloPeriodo,
        etiquetaAnterior: rotuloAnterior,
        metricas: met,
        delPeriodo: per,
        delAnterior: ant,
      });
      /// Solo al salir bien: si falló, la próxima vuelta tiene
      /// que poder reintentar sin esperar a `REFRESCO_MINIMO`.
      ultimaRespuesta.current = Date.now();
      setError(null);
    } finally {
      if (mio === turno.current) setCargando(false);
    }
  }, [filtros, aDesde, aHasta, bDesde, bHasta, claveActual, rotuloPeriodo, rotuloAnterior]);

  /**
   * REINTENTA cuando el servidor pide esperar (429).
   *
   * Cambiar cinco o seis filtros seguidos a ritmo normal agota el
   * tope de peticiones por minuto, y entonces `Promise.all` no
   * guarda nada: la tarjeta se quedaba con lo viejo --o vacía en
   * la primera carga-- y sin nada que dijera que hay que esperar.
   * Se reintenta dos veces con ocho segundos de aire, que es lo
   * que tarda la ventana del servidor en abrirse otra vez, y
   * mientras tanto el aviso lo dice en español (ver `pedir.ts`).
   */
  useEffect(() => {
    let vivo = true;
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const intentar = (quedan: number) => {
      void cargar().catch((e) => {
        if (!vivo) return;
        setError((e as ErrorApi).message);
        if (quedan > 0 && e instanceof ErrorApi && e.estado === 429) {
          reloj = setTimeout(() => intentar(quedan - 1), 8000);
        }
      });
    };
    intentar(2);
    return () => {
      vivo = false;
      if (reloj) clearTimeout(reloj);
    };
    /// `intento` está a propósito: es el botón «Volver a
    /// intentarlo» del aviso, y sin él pulsarlo no dispararía
    /// nada porque nada más de la lista habría cambiado.
  }, [cargar, intento]);

  useEffect(() => {
    alCambiarFiltros?.(filtros);
  }, [filtros, alCambiarFiltros]);

  /// Las tres respuestas que se están pintando, desempaquetadas.
  /// Todas del MISMO sello: ver `Cargado`.
  const metricas = datos?.metricas ?? null;
  const delPeriodo = datos?.delPeriodo ?? null;
  const delAnterior = datos?.delAnterior ?? null;

  /**
   * Lo pintado NO es de lo que está elegido.
   *
   * Es decir: la consulta falló --429, o sin conexión-- y lo que
   * se ve es lo de antes. Puede fallar cualquiera de las dos
   * mitades, y las dos cuentan: si falla `/resumen` se queda
   * atrás el embudo, y si falla `/control` se quedan atrás las
   * columnas Y la ventana con la que se pide todo lo demás.
   *
   * Para el embudo hacen falta tres cosas: que haya algo
   * pintado, que su sello no sea el de ahora, y que la consulta
   * de ahora YA se haya lanzado y terminado. Sin las dos
   * últimas, el aviso asomaría medio segundo en cada cambio de
   * periodo, que es una espera normal y no un fallo.
   */
  /// Y SE MIRA MITAD POR MITAD.
  ///
  /// Al morder el limitador, `/resumen` se va en 429 y el embudo,
  /// las caídas y las tres casillas se quedan con el corte
  /// anterior, mientras `/control` sí vuelve y la leyenda y las
  /// columnas ya son del corte nuevo. El aviso decía «son las de
  /// antes de cambiar los filtros» de todo el bloque, y eso solo
  /// era cierto de la mitad izquierda: la derecha SÍ es la
  /// pedida, y es la que quien acaba de elegir el filtro va a
  /// leer como respuesta. Se atenúa solo la mitad vieja, para
  /// que se vea de un golpe cuál es cuál.
  const embudoDesfasado =
    Boolean(datos) &&
    datos?.clave !== claveActual &&
    clavePedida === claveActual &&
    !cargando;
  const columnasDesfasadas = Boolean(datos) && !controlAlDia;
  const desfasado = embudoDesfasado || columnasDesfasadas;
  const mitadDesfasada =
    embudoDesfasado && columnasDesfasadas
      ? "ambas"
      : embudoDesfasado
        ? "izquierda"
        : columnasDesfasadas
          ? "derecha"
          : null;

  const enEtapa = useMemo(
    () => new Map((delPeriodo?.etapas ?? []).map((e) => [e.etapa, e.total])),
    [delPeriodo],
  );
  const g = useCallback((...es: Etapa[]) => es.reduce((s, e) => s + (enEtapa.get(e) ?? 0), 0), [enEtapa]);

  const hitos = useMemo(() => hitosDe(delPeriodo), [delPeriodo]);
  /// Null cuando no hay con qué comparar: «Desde el principio»
  /// no tiene periodo anterior.
  /// LOS CUATRO PASOS se comparan, pero SIN color.
  ///
  /// Estuvo solo la entrada, porque los del periodo anterior
  /// tuvieron más tiempo para avanzar y un «menos» en los pasos de
  /// abajo se leía como que iba peor (José, 18 sep 2026). Pero
  /// entonces al comparar «no se veía nada» (Mauricio, 20 sep):
  /// tres de las cuatro barras no decían nada del otro periodo.
  /// Ahora se enseñan las cuatro --barra gris detrás y tabla
  /// debajo-- y lo que se quita es el COLOR: el número cuenta, no
  /// afirma que vaya mejor o peor. La nota del pie lo dice.
  const hitosAntes = useMemo(
    () => (delAnterior ? hitosDe(delAnterior).map((h) => h.total) : null),
    [delAnterior],
  );

  /**
   * CUÁNTOS DÍAS ABARCA EL PERIODO, según la propia respuesta.
   *
   * Null = no hay corte («Desde el principio»). Sirve para dos
   * cosas: explicar por qué la tasa del periodo anterior siempre
   * sale más alta, y decidir si tiene sentido repartir la gente
   * por fechas --que es cosa del PERIODO y no de cuántas filas
   * devolvió el servidor--.
   */
  const diasDelPeriodo = useMemo(() => {
    const v = control?.ventana.instantes?.actual;
    if (!v) return null;
    /// Hacia ARRIBA: el periodo en curso se recorta en «ahora»,
    /// así que «Últimos 30 días» a las tres de la mañana mide
    /// 29,1 días, y decir 29 al lado de un rótulo que dice 30
    /// parece un error de cuenta.
    const dias = (Date.parse(v.hasta) - Date.parse(v.desde)) / 86_400_000;
    return dias > 0 ? Math.ceil(dias) : null;
  }, [control]);

  /// «en los últimos 30 días», «entre dos fechas»: el periodo
  /// dicho como se lee dentro de una frase.
  ///
  /// Del SELLO de las cifras y NO del desplegable de la cabecera:
  /// aquel cambia al instante y estas cifras pueden ser de la
  /// respuesta anterior. Así no se puede volver a leer «De las
  /// 131 personas que entraron en los últimos 30 días» con
  /// «Últimos 7 días» elegido arriba.
  const cuandoEnFrase = useMemo(() => {
    const cuando = (datos?.etiqueta ?? "el periodo").toLowerCase();
    if (/^(hoy|ayer)$/.test(cuando)) return cuando;
    if (/^(entre|desde|hasta|del)/.test(cuando)) return cuando;
    if (/^últimos?/.test(cuando)) return `en los ${cuando}`;
    return `en ${cuando}`;
  }, [datos]);

  /// La misma historia en una frase. Va encima de las barras.
  const resumenDelEmbudo = useMemo(() => {
    if (hitos.length === 0) return null;
    const [entro, cont, conDatos, insc] = hitos.map((h) => h.total);
    const en = cuandoEnFrase;
    if (entro === 0) return `No entró nadie ${en}.`;
    const gente = entro === 1 ? "la persona que entró" : `las ${n(entro)} personas que entraron`;
    /// Con UNA persona el verbo va en singular: salía «1 ya
    /// fueron contactadas» (cliente, 20 sep 2026).
    const trozo = (v: number, plural: string, singular: string, ninguna: string) =>
      v === 0 ? ninguna : v === 1 ? `1 ${singular}` : `${n(v)} ${plural}`;
    return (
      `De ${gente} ${en}: ` +
      `${trozo(cont, "ya fueron contactadas", "ya fue contactada", "ninguna ha sido contactada")}, ` +
      `${trozo(
        conDatos,
        "tienen sus datos completos",
        "tiene sus datos completos",
        "ninguna tiene sus datos completos",
      )} y ` +
      `${trozo(insc, "quedaron inscritas", "quedó inscrita", "ninguna se ha inscrito todavía")}.`
    );
  }, [hitos, cuandoEnFrase]);

  /**
   * LA TASA, que es la única comparación honesta.
   *
   * «26 inscritos antes contra 15 ahora» parece un desplome y no
   * lo es: la gente del periodo anterior tuvo más tiempo para
   * avanzar (José, 18 sep 2026). Lo que sí se puede comparar es
   * qué proporción de los que entran acaba inscrita. Va en
   * palabras, sin flecha y sin color: cuenta, no afirma.
   */
  const fraseDeLaTasa = useMemo(() => {
    const entro = hitos[0]?.total ?? 0;
    const insc = hitos[3]?.total ?? 0;
    if (entro <= 0) return null;
    const ahora = `Se inscribe el ${n(Math.round((insc / entro) * 100))} % de quien entra.`;
    if (!hitosAntes || (hitosAntes[0] ?? 0) <= 0) return ahora;
    const antes = n(Math.round((hitosAntes[3] / hitosAntes[0]) * 100));
    /// Del sello, igual que la etiqueta del periodo: esta frase
    /// compara DOS cifras y las dos tienen que venir de la misma
    /// respuesta que su nombre. Con el rótulo sacado del estado
    /// de la cabecera se leyó «el 28 %… en los 7 días anteriores
    /// era el 57 %» cuando las dos cifras eran de otros periodos.
    const cuando = (datos?.etiquetaAnterior ?? "el periodo anterior").toLowerCase();
    /// «En ayer era…» no se dice: «ayer» ya es un complemento.
    /// Con `\b` y no `$` porque el anterior de «Hoy» ya no se
    /// llama «ayer» a secas: ver `anteriorDe` en la cabecera.
    const dicho = /^(hoy|ayer|anteayer)\b/.test(cuando)
      ? `${cuando.charAt(0).toUpperCase()}${cuando.slice(1)} era`
      : `En ${cuando} era`;
    /**
     * Y POR QUÉ ESA RESTA NO ES UNA CAÍDA.
     *
     * El escalón sigue la EDAD de la ventana --medido: 0 % con
     * 7 días, 26 % con 30, 39 % desde el principio-- porque la
     * gente del periodo anterior lleva un periodo entero más
     * para inscribirse. Sin decirlo, la frase engaña y siempre
     * hacia abajo, y es justo la cifra que se repite en una
     * reunión. El propio código ya se lo calla en los «antes N»
     * de los cuatro pasos por esta misma razón (José, 18 sep
     * 2026); aquí faltaba.
     */
    const dias = diasDelPeriodo;
    const media = control?.diasHastaInscribir;
    const porque = dias
      ? `, pero esa gente ha tenido ${n(dias)} ${dias === 1 ? "día" : "días"} más para inscribirse` +
        (media != null
          ? ` (desde que entra una persona hasta que se inscribe pasan ${n(
              Math.round(media),
            )} días de media)`
          : "")
      : "";
    return `${ahora} ${dicho} el ${antes} %${porque}.`;
  }, [hitos, hitosAntes, datos, diasDelPeriodo, control]);

  /**
   * CUANDO NO HAY CON QUÉ COMPARAR, DECIRLO.
   *
   * «Desde el principio» es el periodo con el que ABRE la
   * pantalla, y ahí la tercera pregunta --¿voy mejor o peor?--
   * no tiene respuesta de ninguna clase: desaparecen a la vez
   * los cuatro «antes N», los tres renglones de las casillas, la
   * segunda frase de la tasa y el control «Comparando con…» de
   * la cabecera, y nada dice por qué. Es coherente que no haya
   * comparación --no hay nada antes del primer dato-- pero eso
   * hay que escribirlo: una pregunta contestada con «no se puede
   * contestar» no es lo mismo que una pregunta sin contestar.
   */
  const sinConQueComparar = etiquetaAnterior === "";

  /**
   * EN QUÉ PASO SE QUEDA MÁS GENTE, dicho y no calculado.
   *
   * La figura pinta las tres caídas y, hasta ahora, las tres
   * iguales: tres cifras del mismo tamaño y el mismo rojo, y la
   * comparación a cargo de quien mira. Con «Desde el principio»
   * --la vista de entrada-- la mayor iba escrita LA ÚLTIMA,
   * debajo de dos más pequeñas, así que leyendo de arriba abajo
   * y quedándose con la primera uno se lleva la respuesta
   * equivocada. Es el dato por el que se abre esta pantalla.
   */
  const fraseDelCuello = useMemo(() => {
    const may = caidaMayor(hitos);
    if (!may || may.cuantos <= 0) return null;
    const donde = [
      "no han sido contactadas todavía",
      "ya fueron contactadas y no tienen sus datos completos",
      "tienen sus datos completos y no se han inscrito",
    ][may.paso];
    if (!donde) return null;
    return `Donde más gente se queda: ${n(may.cuantos)} ${
      may.cuantos === 1 ? "persona" : "personas"
    } ${donde}.`;
  }, [hitos]);

  /**
   * Cuánta gente entraba AL DÍA en el periodo anterior.
   *
   * `delAnterior` no trae serie por día, así que sale del total
   * repartido entre los días de la ventana anterior. Es el número
   * de la raya horizontal del gráfico de días, y por eso es un
   * PROMEDIO DIARIO: comparar el total de un periodo contra una
   * columna de un día sería mezclar peras con manzanas.
   */
  const promedioAnterior = useMemo(() => {
    const v = control?.ventana.instantes?.anterior;
    if (!v || !hitosAntes) return null;
    const cuantos = (Date.parse(v.hasta) - Date.parse(v.desde)) / 86400000;
    if (!(cuantos > 0)) return null;
    return hitosAntes[0] / cuantos;
  }, [control, hitosAntes]);

  /// Sin ventana, el servidor recorta la serie por día a 60 días
  /// —y solo esa serie—, así que con «Desde el principio» el
  /// embudo abarca más tiempo que las columnas. Se dice en el pie
  /// del gráfico en vez de callarlo.
  const serieRecortada = !control?.ventana.desde;

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

  /**
   * En qué acabó la gente del periodo. TRES casillas y no cuatro.
   *
   * Eran cuatro y dos decían 46 --«aún no se inscriben» y «en
   * captación por cerrar»--: la misma gente contada por dos
   * caminos, uno restando y otro sumando etapas. «¿Cómo
   * interpreto las tarjetas?» (cliente, 20 sep 2026). Ahora cada
   * persona del periodo cae en una sola, y las tres suman lo que
   * entró: se puede comprobar de un vistazo.
   */
  /// Los días del periodo, tal como los devuelve el servidor.
  const porDia = useMemo(() => control?.embudoPorDia ?? [], [control]);

  /// Las mismas tres cifras en el periodo con el que se compara.
  const deAntes = useMemo(() => {
    if (!delAnterior) return null;
    const h = hitosDe(delAnterior);
    const en = new Map(delAnterior.etapas.map((e) => [e.etapa, e.total]));
    const inscritosAntes = h[3]?.total ?? 0;
    const perdidosAntes = en.get("PERDIDO") ?? 0;
    return {
      enProceso: (h[0]?.total ?? 0) - inscritosAntes - perdidosAntes,
      inscritos: inscritosAntes,
      perdidos: perdidosAntes,
    };
  }, [delAnterior]);

  /**
   * LA MISMA GUARDA QUE YA TIENE EL EMBUDO.
   *
   * Cuando el periodo anterior no trae a nadie --la base arranca
   * el 7 de agosto de 2026, así que julio, los 90 días anteriores
   * y los 12 meses anteriores están vacíos-- el embudo se calla
   * los «antes N», la frase de la tasa se calla la comparación y
   * la raya del promedio no se dibuja. Las casillas no tenían la
   * guarda y escribían «+74 frente al mes de antes (0)»: se lee
   * como que se pasó de cero a setenta y cuatro, y lo que pasa es
   * que no hay con qué comparar. Pasaba en 3 de los 9 periodos.
   */
  const hayAntes = (hitosAntes?.[0] ?? 0) > 0;

  const notas = useMemo(
    () => [
      {
        cifra: entraron - inscritos - perdidos,
        antes: hayAntes ? (deAntes?.enProceso ?? null) : null,
        etiqueta: "siguen en proceso, sin inscribirse",
        detalle:
          "De los que entraron en el periodo: no se han inscrito y tampoco han dicho que no. Son los que se pueden trabajar hoy.",
        tono: "aviso" as const,
      },
      {
        cifra: inscritos,
        antes: hayAntes ? (deAntes?.inscritos ?? null) : null,
        /// DICE A QUIÉN CUENTA, en su propio renglón.
        ///
        /// Decía «32 se inscribieron» y 460 px más abajo «Ritmo
        /// de inscripción» decía «72 inscritos en el periodo»:
        /// dos respuestas para la misma pregunta y el mismo
        /// periodo, y ninguna de las dos decía a quién contaba.
        /// Esta cuenta a los que ENTRARON en el periodo y
        /// acabaron inscritos; aquella, a los que SE
        /// INSCRIBIERON en el periodo, entraran cuando entraran.
        /// Es cambio de texto, no de consulta.
        etiqueta: "de los que entraron ya se inscribieron",
        detalle:
          "Llegaron a inscribirse, estén hoy estudiando el curso o no. Quien entró antes del periodo y se inscribió en estos días no cuenta aquí: eso lo dice «Ritmo de inscripción».",
        tono: "exito" as const,
      },
      {
        cifra: perdidos,
        antes: hayAntes ? (deAntes?.perdidos ?? null) : null,
        etiqueta: "dijeron que no",
        detalle: "Marcados como no interesados. Salen del embudo.",
        tono: "neutro" as const,
      },
    ],
    [entraron, inscritos, perdidos, deAntes, hayAntes],
  );

  /// Mientras llega el dato nuevo, lo viejo se atenúa y no se
  /// vacía: un esqueleto hace perder la referencia de lo que se
  /// estaba mirando, y aquí se mira para comparar.
  ///
  const claseCargando = cargando && control ? "opacity-45 pointer-events-none" : "";

  /// Y si la consulta FALLÓ, lo viejo se queda atenuado: hasta
  /// ahora `setCargando(false)` iba en el `finally`, así que en
  /// cuanto se rendía el intento las cifras del corte anterior
  /// volvían a plena opacidad y se leían como el resultado del
  /// filtro nuevo. El aviso de arriba del bloque va aparte, sin
  /// atenuar: es lo único que hay que leer en ese momento.
  const claseDesfasado = desfasado ? "opacity-55" : "";
  /// Una por mitad: ver `embudoDesfasado` / `columnasDesfasadas`.
  const claseEmbudo = embudoDesfasado ? "opacity-55" : "";
  const claseColumnas = columnasDesfasadas ? "opacity-55" : "";

  /**
   * Cuándo la meta del SENA se puede dividir entre lo de arriba.
   *
   * El backend acota la meta por gremio y por acción, que es como
   * se compromete. NO se reparte por grupo, ni por asesor, ni por
   * departamento: con uno de esos puesto, arriba habría un
   * numerador recortado y abajo una meta entera.
   *
   * Y el PERIODO es un filtro más del numerador --el que más
   * recorta--: con «Hoy» salía «meta 3.690 · 0 %» y con «Desde el
   * principio» «meta 3.690 · 2 %», la misma meta y tres cifras
   * distintas solo por mover un desplegable. La meta es de toda
   * la convocatoria, así que solo se enseña cuando el numerador
   * también lo es.
   */
  const periodoCompleto = !control?.ventana.desde;
  const metaComparable =
    !asesorId && !departamentoSepId && !grupoId && periodoCompleto;
  const meta = metaComparable ? (control?.metaComprometida ?? null) : null;

  /**
   * Si las dos mitades del bloque cuentan a la MISMA gente.
   *
   * El embudo sale de `/resumen` y las columnas de `/control`:
   * son dos consultas distintas, así que el pie no puede AFIRMAR
   * que una es la suma de la otra sin haberlo comprobado. Se
   * comprueba aquí, sumando la serie por día contra lo que entró,
   * y solo entonces se dice.
   */
  const sumaPorDia = useMemo(
    () => porDia.reduce((s, d) => s + d.entraron, 0),
    [porDia],
  );

  /**
   * SI HAY ALGO QUE REPARTIR POR FECHAS.
   *
   * Lo decide EL PERIODO, no cuántas filas devolvió el servidor.
   * Con `porDia.length > 1` bastaba un filtro flaco para perder
   * el gráfico: con «Últimos 30 días» + Departamento
   * CUNDINAMARCA el servidor devuelve UNA fila --2 personas, el
   * 29 de agosto-- y la pantalla afirmaba que «Últimos 30 días»
   * cabe en un solo día. Con la ventana en la mano se pintan las
   * 30 columnas con una sola barra, que además enseña de un
   * vistazo que llevamos veintitantos días sin nadie de ese
   * departamento. `rellenarDias` ya sabe rellenar los huecos
   * hasta los bordes del periodo.
   *
   * Sin ventana --«Desde el principio»-- no hay más remedio que
   * mirar las filas: ahí el periodo no tiene bordes.
   */
  const hayColumnas =
    porDia.length > 1 || (porDia.length === 1 && (diasDelPeriodo ?? 1) > 1);

  /**
   * CUÁNDO SE PUEDE AFIRMAR EL CUADRE.
   *
   * Dos condiciones y las dos hacen falta. Que las cifras que se
   * están pintando sean del corte elegido --si no, la izquierda
   * es de un filtro y la derecha de otro, que es como el pie
   * llegó a decir «suman las 5 personas» sobre unas columnas que
   * sumaban 131--; y que la suma DÉ, contada aquí mismo.
   *
   * `serieRecortada` YA NO entra. Estaba para el recorte de 60
   * días del servidor, pero lo tapaba de más: con «Desde el
   * principio» --la vista con la que se abre la pantalla-- las
   * columnas sumaban 206 y el embudo decía 206, y aun así el pie
   * se callaba el cuadre y encima avisaba de un desajuste que no
   * existía. Si de verdad falta serie, la suma no da y la
   * condición de abajo lo caza sola.
   */
  const cuadran = !desfasado && hayColumnas && entraron > 0 && sumaPorDia === entraron;

  const hayFiltro = Boolean(
    convenioId || accionFormacionId || grupoId || asesorId || departamentoSepId,
  );

  function quitarFiltros() {
    setConvenioId("");
    setAccionFormacionId("");
    setGrupoId("");
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
      return (catalogo?.convenios ?? []).find((c) => c.id === convenioId)?.nombre ?? null;
    }
    const cs = control?.porConvenio ?? [];
    return cs.length === 1 ? cs[0].etiqueta : null;
  }, [convenioId, catalogo, control]);

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

  /**
   * Las CINCO listas de los desplegables.
   *
   * Qué se puede elegir sale del catálogo del ámbito y cuánta
   * gente tiene cada uno del periodo de la cabecera. Ver
   * `conCuentaDelPeriodo`.
   *
   * Sin periodo --«Desde el principio»-- las dos respuestas son
   * la misma consulta, así que el catálogo hace de las dos y no
   * se pide nada de más.
   *
   * LOS GREMIOS ENTRARON AQUÍ (21 sep 2026). Salían de
   * `/metricas`, que recorta por etapa a las cinco del embudo,
   * mientras el bloque sale de `/resumen`, que descarta la etapa
   * a propósito: la lista ofrecía «ADECOPRIA · 98 personas» y al
   * elegirlo el bloque contestaba 103 --la diferencia era la
   * gente que ya pasó al aula: EN_FORMACION, CERTIFICADO,
   * RETIRADO, ABANDONO--. Los otros cuatro salían de `/resumen` y
   * cuadraban al dígito. Ahora los cinco cuentan lo mismo.
   */
  const cuentas = aDesde ? opciones : catalogo;
  const listas = useMemo(
    () => ({
      convenios: conCuentaDelPeriodo(
        catalogo?.convenios ?? [],
        cuentas?.convenios ?? [],
        (c) => c.id,
      ),
      acciones: conCuentaDelPeriodo(
        catalogo?.acciones ?? [],
        cuentas?.acciones ?? [],
        (a) => a.id,
      ),
      grupos: conCuentaDelPeriodo(catalogo?.grupos ?? [], cuentas?.grupos ?? [], (g) => g.id),
      asesores: conCuentaDelPeriodo(
        catalogo?.asesores ?? [],
        cuentas?.asesores ?? [],
        (a) => a.id,
      ),
      departamentos: conCuentaDelPeriodo(
        catalogo?.departamentos ?? [],
        cuentas?.departamentos ?? [],
        (d) => d.id,
      ),
    }),
    [catalogo, cuentas],
  );

  /// El nombre del curso detrás de su código, para que el
  /// desplegable de grupos no ofrezca «AF1 · Grupo 1» a secas.
  const nombreDeAccion = useMemo(
    () => new Map((catalogo?.acciones ?? []).map((a) => [a.codigo, frase(a.nombre)])),
    [catalogo],
  );

  return (
    <div className="space-y-4">
      {error && <Aviso tipo="error">{error}</Aviso>}

      {/* ── 1 · Filtros, y cuánta gente hay dentro ── */}
      <div className="rounded-xl border border-borde bg-superficie px-4 py-3.5">
        <p className="mb-2.5 text-[0.6875rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
          Filtros
          {/* «20 personas de qué putas» (cliente, 20 sep 2026):
              decía «en el proceso», que no dice ni de cuándo ni de
              dónde salen. Son las que ENTRARON en el periodo de
              arriba, ya recortadas por estos filtros. */}
          {entraron > 0 && (
            <span className="ml-2.5 font-normal tracking-normal text-marca normal-case">
              <strong className="font-semibold tabular-nums">{n(entraron)}</strong>{" "}
              {entraron === 1 ? "persona entró" : "personas entraron"} {cuandoEnFrase}
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
            {listas.convenios.length > 1 && (
              <Desplegable
                alto={34}
                marcador="Gremios"
                etiquetaAria="Gremio"
                valor={convenioId}
                opciones={[
                  { valor: "", etiqueta: "Gremios" },
                  ...listas.convenios.map((x) => ({
                    valor: x.id,
                    etiqueta: x.nombre,
                    detalle: `${n(x.total)} ${x.total === 1 ? "persona" : "personas"}`,
                  })),
                ]}
                alElegir={setConvenioId}
              />
            )}

            {/* Desplegable y no buscador: los cinco filtros se
                abren igual, con su segunda línea en gris. Un
                control que se comporta distinto que sus vecinos
                obliga a aprenderlo aparte.

                LAS OPCIONES SALEN DE `opciones`, NO DE LAS CIFRAS
                DEL BLOQUE. Es la misma consulta recortada solo por
                el periodo: así la lista no se queda con una sola
                entrada al elegir --se podía entrar en ANTIOQUIA y
                no salir sin borrar los cinco filtros-- y la
                segunda línea cuenta la gente del periodo de
                arriba, no la de todo el histórico. */}
            <Desplegable
              alto={34}
              marcador="Acción de formación"
              etiquetaAria="Acción de formación"
              valor={accionFormacionId}
              opciones={[
                { valor: "", etiqueta: "Acción de formación" },
                ...listas.acciones.map((a) => ({
                  valor: a.id,
                  etiqueta: `${a.codigo} · ${frase(a.nombre)}`,
                  /// «personas» y no «leads»: la cabecera de la
                  /// pantalla, el bloque y el pie cuentan
                  /// personas, y dos palabras para lo mismo --una
                  /// de ellas en inglés-- en la misma pantalla es
                  /// lo primero que se preguntó (cliente, 21 sep
                  /// 2026).
                  detalle: `${n(a.total)} ${a.total === 1 ? "persona" : "personas"}`,
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
                ...listas.grupos.map((g) => ({
                  valor: g.id,
                  /// Con el código de su acción delante: «Grupo 1»
                  /// existe en las quince acciones.
                  etiqueta: `${g.accion} · Grupo ${g.numero}`,
                  /// Y CON EL NOMBRE DEL CURSO en la segunda
                  /// línea: «AF1» es un código que no dice nada a
                  /// quien no lo haya aprendido (cliente, 21 sep
                  /// 2026), y aquí ya había un renglón libre.
                  detalle: [
                    nombreDeAccion.get(g.accion),
                    `${n(g.total)} ${g.total === 1 ? "persona" : "personas"}`,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                })),
              ]}
              alElegir={setGrupoId}
            />

            {/* AQUÍ VIVÍA «Etapas», Y SE QUITA (20 sep 2026).
                No recortaba nada de esta pantalla: `/resumen`
                descarta la etapa a propósito --es la respuesta de
                la que sale el reparto POR etapa que dibuja el
                embudo-- y `/control` ni la recibe. Se elegía
                «Interesado · 40 leads», se encendía «Limpiar» y
                no se movía una sola cifra: ni el embudo, ni la
                leyenda, ni las tres casillas, ni los medidores.

                Y aunque se aplicara, no querría decir nada aquí:
                este embudo es ACUMULADO --quién llegó a cada
                paso-- y recortarlo a una etapa lo deja en una
                sola barra. «Que funcionen los filtros» (cliente,
                20 sep 2026): un control que se marca como puesto
                y no recorta nada es peor que no tenerlo. Para
                mirar una etapa está la pantalla de leads, que sí
                filtra por ella. */}

            <Desplegable
              alto={34}
              marcador="Asesores"
              etiquetaAria="Asesor"
              valor={asesorId}
              opciones={[
                { valor: "", etiqueta: "Asesores" },
                ...listas.asesores.map((a) => ({
                  valor: a.id,
                  etiqueta: a.nombre,
                  detalle: `${n(a.total)} ${a.total === 1 ? "persona" : "personas"}`,
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
                /* «Sin departamento» NO se ofrece, y no es capricho.
                   Esa fila llega con id nulo, así que el valor
                   viajaba como la palabra «null», se convertía en
                   NaN y el servidor contestaba 400 a dos de las
                   tres consultas. Peor: el NaN se quedaba pegado al
                   filtro y TODO lo que se tocara después fallaba
                   igual --medido: 52 respuestas 400 seguidas y el
                   bloque 115 s enseñando las cifras de otro
                   filtro--. Filtrar «a quien le falta el
                   departamento» es una consulta que el backend hoy
                   no acepta; mientras no exista, no se ofrece.
                   Esas personas siguen contadas en el total. */
                ...listas.departamentos
                  .filter((d) => d.id !== null && d.id !== undefined && Number.isFinite(Number(d.id)))
                  .map((d) => ({
                    valor: String(d.id),
                    etiqueta: d.nombre,
                    detalle: `${n(d.total)} ${d.total === 1 ? "persona" : "personas"}`,
                  })),
              ]}
              alElegir={setDepartamentoSepId}
            />
        </div>

        {/* LAS PALABRAS DEL OFICIO, EXPLICADAS DONDE SALEN.
            «No sé qué es un gremio ni por qué ADECOPRIA es uno»,
            «AF1 es un código que no me dice nada» (cliente, 21
            sep 2026). Una línea debajo de los cinco cuesta un
            renglón y evita tener que aprenderse el vocabulario
            en otra pantalla. */}
        <p className="mt-2 text-[0.6875rem] leading-snug text-texto-suave">
          Gremio: la agremiación que trae a las personas. Acción de formación: el curso, con
          su código («AF1»). Grupo: cada ficha de ese curso.
        </p>
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
          titulo="Embudo de inscripción"
          /// LOS CUATRO PASOS, NOMBRADOS.
          ///
          /// Decía «de una etapa a la siguiente» y en la pantalla
          /// no había ningún sitio que dijera cuáles son ni
          /// cuántas (cliente, 21 sep 2026). Nombrarlas aquí
          /// cuesta un renglón y deja de ser vocabulario del
          /// oficio.
          descripcion="Cuántas personas pasan de un paso al siguiente —entraron, contactadas, con sus datos completos, inscritas— y en cuál se detiene el proceso."
        >
          {/* EL AVISO, DENTRO DEL BLOQUE Y SIN ATENUAR.
              Cuando una consulta no vuelve --el 429 del
              limitador, o sin conexión-- lo que se ve es del
              corte anterior. Antes el único aviso estaba en la
              cabecera de la pantalla, hablaba de tiempo («lo que
              ve es de hace un momento») y no de que las cifras
              son de OTRO periodo, y quedaba a media pantalla del
              bloque. Aquí se dice de qué son las cifras, qué es
              lo que no se pudo traer, y se ofrece reintentar. */}
          {desfasado && (
            <p className="mb-4 rounded-xl border border-aviso/30 bg-aviso-suave px-3 py-2 text-[0.78125rem] leading-snug text-aviso">
              <strong className="font-semibold">
                {/* QUÉ MITAD ESTÁ VIEJA, y no «el bloque».
                    Cuando lo que falla es `/resumen` y `/control`
                    sí vuelve, la mitad derecha SÍ es la pedida
                    --es la que quien acaba de elegir el filtro va
                    a leer como respuesta-- y el aviso hablaba de
                    las dos por igual. */}
                {mitadDesfasada === "izquierda"
                  ? "El embudo y las tres casillas no son lo que pidió."
                  : mitadDesfasada === "derecha"
                    ? "Las columnas por día no son lo que pidió."
                    : "Estas cifras no son las que pidió."}
              </strong>{" "}
              {/* Con el nombre del periodo tal como lo dice el
                  desplegable, entre comillas: «son de los últimos
                  30 días» se tuerce con «Desde el principio» y con
                  «Un rango de fechas». */}
              {etiquetaPeriodo && datos?.etiqueta && datos.etiqueta !== etiquetaPeriodo
                ? `Son las de «${datos.etiqueta}»; no se pudieron traer las de «${etiquetaPeriodo}».`
                : "Son las de antes de cambiar los filtros; no se pudieron traer las nuevas."}{" "}
              <button
                type="button"
                onClick={() => setIntento((i) => i + 1)}
                className="font-semibold underline underline-offset-2"
              >
                Volver a intentarlo
              </button>
            </p>
          )}

          <div>
          {/* LAS TRES FRASES, fuera de los dos gráficos: qué
              pasó, en qué paso se queda más gente, y si mejora o
              empeora. Son las tres preguntas con las que se abre
              esta pantalla, y valen aunque no se mire ningún
              dibujo.

              `max-w-[68ch]`: sin medida, a 1.600 px estas frases
              salían de 137 caracteres en un solo renglón, casi el
              doble de lo que un ojo sigue sin perder la línea.
              Ninguno de los tres tableros de referencia deja
              correr una línea de texto a todo lo ancho. */}
          <div className={`mb-4 space-y-1 ${claseEmbudo}`}>
            {resumenDelEmbudo && (
              <p className="max-w-[68ch] text-[0.84375rem] leading-relaxed text-texto">
                {resumenDelEmbudo}
              </p>
            )}
            {fraseDelCuello && (
              <p className="max-w-[68ch] text-[0.84375rem] leading-relaxed text-texto">
                {fraseDelCuello}
              </p>
            )}
            {fraseDeLaTasa && (
              <p className="max-w-[68ch] text-[0.84375rem] leading-relaxed text-texto">
                {fraseDeLaTasa}
              </p>
            )}
            {/* Y SI NO HAY CON QUÉ COMPARAR, EN SU SITIO.
                Ver `sinConQueComparar`. */}
            {sinConQueComparar && entraron > 0 && (
              <p className="max-w-[68ch] text-[0.84375rem] leading-relaxed text-texto-suave">
                «{datos?.etiqueta ?? "Desde el principio"}» no se compara con nada: es todo lo
                que hay. Elija arriba un periodo más corto para ver si va mejor o peor.
              </p>
            )}
            {/* Y LO MISMO CUANDO EL PERIODO ANTERIOR ESTÁ VACÍO.
                Pasa en tres de los nueve periodos --la base
                arranca el 7 de agosto de 2026, así que julio, los
                90 días anteriores y los 12 meses anteriores no
                traen a nadie--: la cabecera dice «Comparando con
                el mes de antes» y el bloque no enseña una sola
                comparación, sin decir por qué. */}
            {!sinConQueComparar && comparar && hitosAntes && !hayAntes && entraron > 0 && (
              <p className="max-w-[68ch] text-[0.84375rem] leading-relaxed text-texto-suave">
                En {datos?.etiquetaAnterior ?? "el periodo anterior"} no hay nadie con quien
                comparar, así que esta vez no se compara: los datos empiezan después.
              </p>
            )}
          </div>

          {/* DOS MITADES DEL MISMO DATO. A la izquierda, dónde se
              queda la gente --con forma de embudo, que es la
              figura que el cliente reconoce--; a la derecha, qué
              día entró cada uno y hasta dónde ha llegado. Con un
              solo día no hay columnas que pintar y el embudo se
              queda con todo el ancho. */}
          {/* LA MISMA REJILLA EN TODOS LOS PERIODOS.
              Cuando no hay serie por día --«Hoy», «Ayer»-- el
              embudo se quedaba con la tarjeta entera: la figura
              se centraba en 1.408 px y dejaba el 84 % de la
              tarjeta en blanco, sin decir por qué había
              desaparecido media pantalla. Ahora la columna de la
              derecha explica que todo el periodo cae en un solo
              día, y el embudo mide lo mismo siempre.

              `min-w-0` en los dos hijos: sin él, la columna de
              la rejilla crece hasta el contenido más ancho del
              gráfico de columnas y arrastra al embudo. A 390 px
              con «Desde el principio» el bloque entero se salía
              61 px de la tarjeta, y como la página no tiene
              barra horizontal, eso no se podía ni alcanzar. */}
          {/* EL CORTE DE DOS COLUMNAS, A 760 px Y NO A 1.000.
              Entre 760 y 999 px la rejilla colapsaba a una sola
              columna y la figura --que tiene tope de 360 px-- se
              quedaba sola en una franja de 400 px de ancho
              mientras todo lo demás seguía pegado al margen. A
              760 px una figura de 280 y un gráfico de 368 ya
              conviven sin apretarse. */}
          {hitos.length > 0 && entraron === 0 ? (
            <SinGente hayFiltro={hayFiltro} />
          ) : (
          <div className="grid gap-6 min-[760px]:grid-cols-[minmax(280px,360px)_1fr]">
            <div className={`min-w-0 ${claseEmbudo}`}>
              {hitos.length > 0 ? (
                <EmbudoForma
                  hitos={hitos}
                  /// Lo que el gráfico de al lado reserva encima
                  /// de sus columnas para la cifra: bajando la
                  /// figura otro tanto, la primera banda arranca
                  /// en la misma raya que el tope del eje y la
                  /// punta acaba en la del cero.
                  sangriaArriba={hayColumnas ? ALTO_CIFRA_COLUMNA : 0}
                  /// NADA de «antes N» cuando el periodo anterior
                  /// no trajo a nadie: con «El mes pasado» el
                  /// embudo escribía «antes 0» en los cuatro
                  /// pasos y se leía como que se pasó de cero a
                  /// 136, cuando lo que ocurre es que la base
                  /// empieza después. La frase de la tasa y la
                  /// raya del gráfico ya se callaban en ese caso;
                  /// esto faltaba.
                  antes={hitosAntes && (hitosAntes[0] ?? 0) > 0 ? hitosAntes : null}
                  /// Del sello de las cifras, no del desplegable:
                  /// el «antes N» de cada paso tiene que llamarse
                  /// como el periodo del que salió.
                  etiquetaAntes={datos?.etiquetaAnterior ?? null}
                  meta={meta}
                />
              ) : (
                <HuecoDelEmbudo />
              )}
            </div>
            <div className={`min-w-0 ${claseColumnas}`}>
              {hayColumnas ? (
                <EmbudoPorDia
                  dias={porDia}
                  promedioAnterior={promedioAnterior}
                  /// Solo cuando de verdad FALTA serie. `control`
                  /// la recorta a 60 días cuando no hay ventana,
                  /// pero eso no quiere decir que falte gente: con
                  /// «Desde el principio» las columnas sumaban las
                  /// mismas 206 del embudo y aun así se avisaba de
                  /// un desajuste que no existía, en la vista con
                  /// la que se abre la pantalla. Si falta, la suma
                  /// se queda corta y ahí sí se dice.
                  serieRecortada={serieRecortada && sumaPorDia < entraron}
                  ventana={control?.ventana.instantes?.actual ?? null}
                />
              ) : (
                <SinColumnas
                  cuando={datos?.etiqueta ?? null}
                  hayFiltro={hayFiltro}
                  cuantos={sumaPorDia}
                  dia={porDia[0] ? fecha(porDia[0].dia) : null}
                />
              )}
            </div>
          </div>
          )}

          {/* LA FRASE QUE AMARRA LAS DOS MITADES.
              Es la respuesta a «que todo cuadre», dicha en
              palabras y comprobable sumando a mano: sin ella, dos
              maneras de contar la misma gente --cuántos llegaron
              a cada paso y dónde se quedaron-- se leen como peras
              y manzanas.

              Pero solo se AFIRMA cuando se ha comprobado. Las dos
              mitades vienen de dos consultas distintas, y basta
              con que una se quede atrás para que la frase sea
              falsa impresa: con el filtro de grupo llegó a decir
              «suman las 5 personas» sobre unas columnas que
              sumaban 131. Cuando no cuadra, se dice qué es cada
              mitad, que informa sin prometer una aritmética que
              en ese momento no se sostiene. Ver `cuadran`. */}
          {hayColumnas && entraron > 0 && (
            <p
              className={`mt-3 max-w-[68ch] text-[0.6875rem] leading-snug text-texto-suave ${claseDesfasado}`}
            >
              {cuadran ? (
                <>
                  Los cuatro colores de las columnas suman{" "}
                  {entraron === 1
                    ? "la persona que entró"
                    : `las ${n(entraron)} personas que entraron`}
                  : el embudo de la izquierda es la suma de las barras de la derecha.
                </>
              ) : (
                <>
                  A la izquierda, dónde se queda la gente; a la derecha, qué día entró cada
                  una. Cada persona está contada una sola vez y en un solo color.
                </>
              )}
            </p>
          )}

          {/* Las tres casillas y la frase van FUERA del gráfico:
              con la vista por día desaparecían, porque vivían
              dentro del embudo del periodo. */}
          <div className={claseEmbudo}>
            <TarjetasDelEmbudo notas={notas} etiquetaAntes={datos?.etiquetaAnterior ?? null} />
          </div>
          </div>
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
                De la primera entrada a la inscripción
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
          <Bloque titulo="Por modalidad" descripcion="Virtual, presencial e híbrida.">
            <Donut datos={donutModalidad} detalleCentro="personas" vacio="Sin modalidad registrada." />
          </Bloque>
        </div>

        {/* ── 6 · Dónde está cada quien y si sus datos sirven ── */}
        <div className="grid gap-4 min-[1000px]:grid-cols-2">
          <Bloque
            titulo="Dónde está cada persona hoy"
            descripcion="En qué paso está parada cada persona hoy, agrupados por fase."
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
            /// A QUIÉN CUENTA, y en qué se diferencia del embudo.
            ///
            /// Decía «Inscritos por el día en que se inscribieron»
            /// --«lo leí tres veces antes de caer en que es
            /// distinto de la otra cifra de inscritos» (cliente,
            /// 21 sep 2026)--. El embudo cuenta a los que
            /// ENTRARON en el periodo y acabaron inscritos; esto
            /// cuenta a los que SE INSCRIBIERON en el periodo,
            /// entraran cuando entraran. Por eso las dos cifras
            /// son distintas y las dos están bien.
            descripcion="Cuenta a quien SE INSCRIBIÓ en el periodo, entrara cuando entrara. El embudo de arriba cuenta a quien ENTRÓ en el periodo, así que las dos cifras no tienen por qué coincidir."
          >
            <Serie datos={control?.serie ?? []} cuando={cuandoEnFrase} />
          </Bloque>

          <Bloque
            titulo="De dónde vienen"
            /// DICE DE QUÉ HABLA, porque no obedece al periodo.
            ///
            /// Sale de `conversionPorOrigen`, que el backend
            /// calcula a propósito sin ventana --si no, con «Hoy»
            /// todas las conversiones caen a cero y la tabla se
            /// ordena por quién tuvo suerte esta mañana
            /// (crm/control.ts)--. El problema no era el dato
            /// sino el rótulo: con «Hoy» la pantalla decía arriba
            /// «No entró nadie hoy» y dos dedos más abajo listaba
            /// 101 personas, pegado a un vecino que sí dice
            /// «la gente del periodo». Si un bloque no hace caso
            /// al periodo, tiene que decirlo él.
            descripcion="Volumen por canal y cuánto convierte cada uno. Obedece a los cinco filtros, pero NO al periodo de arriba: cuenta a todas las personas, entraran cuando entraran."
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
        {/* Tres bloques y no dos: «prefiero eso como campo aparte
            al lado del mapa... y reducirle al mapa» (cliente, 20
            sep 2026). El mapa dice DÓNDE se concentra, la lista
            CUÁNTOS, y el tercero quién los atiende. */}
        <div className="grid gap-4 min-[1000px]:grid-cols-[0.75fr_0.85fr_1.1fr]">
          <Bloque titulo="Por departamento" descripcion="Dónde vive la gente del periodo.">
            <MapaColombia
              datos={(delPeriodo?.departamentos ?? []).map((d) => ({
                nombre: d.nombre,
                total: d.total,
              }))}
            />
          </Bloque>

          <Bloque
            titulo="Cantidad por departamento"
            descripcion="De más a menos, con lo que pesa cada uno."
          >
            <ListaBarras
              datos={[...(delPeriodo?.departamentos ?? [])]
                .sort((a, b) => b.total - a.total)
                .map((d) => ({
                  clave: String(d.id ?? d.nombre),
                  etiqueta: d.nombre,
                  valor: d.total,
                }))}
              sufijo=" personas"
              maximoFilas={8}
              vacio="Sin personas en el periodo."
            />
          </Bloque>

          <Bloque
            titulo="Rendimiento por asesor"
            descripcion="Cuántos lleva y cuántos convierte a inscrito cada uno."
          >
            <TablaAsesores filas={control?.porAsesor ?? []} />
          </Bloque>
        </div>

        {/* Los cupos de empresas, ABAJO y en su bloque: no son
            leads y no se cuentan con ellos. */}
        <ReservasSinNombre control={control ?? null} />

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
/**
 * El ritmo de inscripción, con sus cifras.
 *
 * Era una curva sin un solo número: no decía cuántos, ni cuándo
 * fue el mejor día, ni qué altura tenía el pico --«¿los putos
 * datos en cada punta?»-- y encima dejaba media tarjeta en blanco
 * porque el alto estaba clavado en 140 px mientras el bloque de
 * al lado la estiraba (cliente, 20 sep 2026).
 */
function Serie({
  datos,
  cuando,
}: {
  datos: Array<{ dia: string; total: number }>;
  /// El periodo dicho como se lee dentro de una frase: «en los
  /// últimos 30 días». Hace falta para que la cifra diga a quién
  /// cuenta sin obligar a subir a la cabecera.
  cuando: string;
}) {
  if (datos.length === 0) {
    return (
      <p className="py-8 text-center text-[0.84375rem] text-texto-suave">
        Sin inscritos en el periodo.
      </p>
    );
  }

  const total = datos.reduce((t, d) => t + d.total, 0);
  const cima = Math.max(1, ...datos.map((d) => d.total));
  const mejor = datos.reduce((a, b) => (b.total > a.total ? b : a));
  const ancho = 100;
  const alto = 100;
  const paso = datos.length > 1 ? ancho / (datos.length - 1) : 0;
  const en = (i: number, v: number) => ({ x: i * paso, y: alto - (v / cima) * alto });
  const puntos = datos.map((d, i) => `${en(i, d.total).x},${en(i, d.total).y}`);
  const area = `0,${alto} ${puntos.join(" ")} ${(datos.length - 1) * paso},${alto}`;
  const iMejor = datos.indexOf(mejor);
  const pMejor = en(iMejor, mejor.total);
  const ultimo = datos[datos.length - 1];

  return (
    <div className="flex h-full flex-col">
      {/* DICE A QUIÉN CUENTA, en su propio renglón.
          «72 inscritos en el periodo» convivía en la misma
          pantalla con «32 se inscribieron» del embudo, y ninguna
          de las dos decía de qué gente hablaba: no había forma de
          saber cuál llevar a la reunión. */}
      <p className="max-w-[68ch] text-[0.84375rem] leading-relaxed text-texto">
        <strong className="font-semibold text-titulo">{n(total)}</strong>{" "}
        {total === 1 ? "persona se inscribió" : "personas se inscribieron"} {cuando}, hayan
        entrado cuando hayan entrado · el mejor día fue el{" "}
        <strong className="font-semibold text-titulo">{fecha(mejor.dia)}</strong>, con{" "}
        {n(mejor.total)}.
      </p>

      <div className="relative mt-3 min-h-[150px] grow">
        {/* La cima, escrita: sin ella la curva no tiene escala. */}
        <span className="absolute top-0 right-0 text-[0.625rem] text-texto-suave tabular-nums">
          {n(cima)}
        </span>
        <span className="absolute right-0 bottom-0 text-[0.625rem] text-texto-suave tabular-nums">
          0
        </span>
        <svg viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" className="h-full w-full">
          <polygon points={area} fill={SERIE.uno} opacity={0.14} />
          <polyline
            points={puntos.join(" ")}
            fill="none"
            stroke={SERIE.uno}
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
          />
          {/* El pico y el último día, marcados. */}
          <circle cx={pMejor.x} cy={pMejor.y} r={1.6} fill={SERIE.uno} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      <div className="mt-1 flex justify-between text-[0.625rem] text-texto-suave tabular-nums">
        <span>
          {fecha(datos[0].dia)} · {n(datos[0].total)}
        </span>
        <span>
          {fecha(ultimo.dia)} · {n(ultimo.total)}
        </span>
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
