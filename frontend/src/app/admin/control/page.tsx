"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { BotonPdf } from "@/components/admin/boton-pdf";
import { n } from "@/components/admin/graficos";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import { Aviso, CLASE_CONTROL } from "@/components/admin/marco-admin";
import { ComiteMarketing } from "@/components/admin/comite-marketing";
import { Desplegable } from "@/components/admin/desplegable";
import { PanelProceso } from "@/components/admin/panel-proceso";
import {
  ContextoRecorteDeControl,
  enlaceAlInforme,
  PanelReservas,
} from "@/components/admin/panel-reservas";
import { Cargando } from "@/components/admin/piezas";
import {
  crmApi,
  ETIQUETA_RANGO,
  type Control,
  type Filtros,
  type Rango,
} from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

/**
 * Los dos del periodo, marcados.
 *
 * Mandan sobre la pantalla entera —y sobre los otros cinco
 * filtros, que recortan DENTRO del periodo elegido—, y con los
 * siete pintados igual no habia forma de saberlo. Fondo y borde
 * de marca, y el texto en negrita: se leen antes que los demas
 * sin sacarlos de la fila.
 */
/// Las dos cajas de fecha, marcadas como los periodos.
///
/// SIN el `w-full` de `CLASE_CONTROL`: en la fila de la cabecera
/// se estiraban hasta el canto derecho --687 px para «20/09/2026»--
/// y la fila entera se descuadraba (cliente, 20 sep 2026). Una
/// fecha ocupa lo que ocupa una fecha.
const CLASE_PERIODO =
  CLASE_CONTROL.replace("w-full ", "")
    .replace("border-campo-borde", "border-marca/45")
    .replace("bg-campo-fondo", "bg-marca-suave")
    .replace("text-texto", "font-semibold text-marca");

/** Los periodos que se ofrecen, en su orden. */
const RANGOS: Rango[] = [
  "HOY",
  "AYER",
  "SEMANA",
  "MES",
  "MES_PASADO",
  "TRIMESTRE",
  "ANO",
  "TODO",
  "PERSONALIZADO",
];


/**
 * Cuántos días abarca un periodo, con el criterio de
 * `ventana.ts`. Null es «no recorta»: TODO, y también un
 * PERSONALIZADO a medias, que el backend trata como TODO.
 *
 * Hace falta aquí porque la respuesta solo trae las fechas
 * del periodo elegido, no las del comparado, y sin las dos
 * duraciones no hay forma de avisar de que no coinciden.
 */
/**
 * CON QUÉ SE COMPARA, dicho con su nombre.
 *
 * Decía «el periodo anterior, del mismo tamaño», y con «Hoy»
 * elegido arriba eso no dice nada: es AYER. «Si tengo periodo y
 * escojo hoy, ¿con qué lo comparo?» (cliente, 20 sep 2026). Cada
 * periodo tiene su anterior y se llama de alguna manera.
 */
function anteriorDe(rango: Rango, desde: string, hasta: string): string {
  switch (rango) {
    /// «AYER» A SECAS ERA FALSO.
    ///
    /// Con «Hoy», el backend recorta el periodo en curso en
    /// «ahora» y compara contra el MISMO TRAMO de ayer --medido:
    /// la ventana va de las 00:00 a la 1:37 y la de comparación
    /// de las 00:00 de ayer a la 1:37 de ayer--, y aquí se
    /// rotulaba como el día entero. Las tres casillas decían
    /// «igual que ayer» cuando ayer entraron cuatro personas. La
    /// cifra estaba bien; la palabra, mal, y es la palabra la que
    /// se lee.
    case "HOY":
      return "Ayer a esta misma hora";
    /// «Ayer» sí es un día cerrado, así que su anterior es
    /// anteayer entero: el backend no recorta nada (ventana.ts).
    case "AYER":
      return "Anteayer";
    case "SEMANA":
      return "Los 7 días anteriores";
    case "MES":
      return "Los 30 días anteriores";
    case "TRIMESTRE":
      return "Los 90 días anteriores";
    case "MES_PASADO":
      return "El mes de antes";
    case "ANO":
      return "Los 12 meses anteriores";
    case "PERSONALIZADO": {
      const d = diasDeRango("PERSONALIZADO", desde, hasta);
      if (!d) return "Los días justo anteriores";
      return d === 1 ? "El día anterior" : `Los ${d} días anteriores`;
    }
    default:
      /// «Desde el principio» no tiene anterior: no hay nada antes
      /// del primer dato. Quien lo elija no ve la comparación.
      return "";
  }
}

function diasDeRango(rango: Rango, desde: string, hasta: string): number | null {
  const hoy = new Date();
  const [y, m, dia] = [hoy.getFullYear(), hoy.getMonth(), hoy.getDate()];

  switch (rango) {
    case "HOY":
    case "AYER":
      return 1;
    case "SEMANA":
      return 7;
    case "MES":
      return 30;
    case "TRIMESTRE":
      return 90;
    case "MES_PASADO":
      // dia 0: el ultimo del mes pasado
      return new Date(y, m, 0).getDate();
    case "ANO":
      return Math.round((Date.UTC(y, m, dia + 1) - Date.UTC(y - 1, m, dia + 1)) / 86_400_000);
    case "PERSONALIZADO": {
      if (!desde || !hasta) return null;
      const a = Date.parse(`${desde}T00:00:00Z`);
      const b = Date.parse(`${hasta}T00:00:00Z`);
      if (Number.isNaN(a) || Number.isNaN(b) || a > b) return null;
      // el «hasta» va incluido
      return Math.round((b - a) / 86_400_000) + 1;
    }
    default:
      return null;
  }
}

function textoDuracion(dias: number | null): string {
  if (dias === null) return "todo el histórico";
  return `${n(dias)} ${dias === 1 ? "día" : "días"}`;
}

/// Las TRES pantallas. Antes eran entradas del menú que contaban
/// lo mismo por caminos distintos.
/// Con el nombre entero: «Proceso» dentro de un desplegable
/// rotulado «Qué mirar» no dice qué se está eligiendo (cliente,
/// 21 sep 2026).
///
/// «Tráfico del formulario» estuvo aquí UN DÍA. Entró el 21 sep
/// 2026 fusionado con esta pantalla y el 22 volvió a su sitio:
/// «eso lo dejamos en el listado principal porque eso no es
/// inscritos» (Josse). Tiene razón en lo de fondo: el tráfico
/// ocurre ANTES de que exista el lead, y esta pantalla cuenta lo
/// que le pasa a un lead que ya existe.
///
/// NO se queda además como pestaña: la misma pantalla en dos
/// sitios es el «eran dos entradas y nadie sabía a cuál entrar»
/// que este módulo ya resolvió una vez. Lo que sí se queda es el
/// camino de vuelta, más abajo, para los enlaces ya repartidos.
///
/// «Reservas» entró el mismo día, y va AL FINAL para no mover de
/// sitio las que ya conocen. Es el informe que el cliente
/// armaba a mano en una hoja de cálculo, y a él lleva el botón «Ver
/// reservas» del bloque «Cupos apartados por empresas».
const PESTANAS = [
  { clave: "metas", etiqueta: "Proceso de inscripción" },
  { clave: "comite", etiqueta: "Comité Marketing" },
  { clave: "reservas", etiqueta: "Reservas" },
] as const;

type Pestana = (typeof PESTANAS)[number]["clave"];

function esPestana(v: string | null): v is Pestana {
  return PESTANAS.some((p) => p.clave === v);
}

const LLAVE_PESTANA = "control:pestana";

/**
 * La página, dentro de un `Suspense`.
 *
 * `useSearchParams` en una página de cliente OBLIGA a envolverla: sin
 * el `Suspense`, `next build` no puede prerenderizarla y la
 * compilación de producción se cae. En desarrollo no se nota, que es
 * como se cuela. El respaldo es el mismo «Cargando» del resto del
 * panel, sin cifras falsas: dura lo que tarda en hidratar.
 */
export default function PaginaControl() {
  return (
    <Suspense fallback={<Cargando que="Cargando Control de Inscritos…" />}>
      <ContenidoControl />
    </Suspense>
  );
}

function ContenidoControl() {
  /**
   * LA PANTALLA LA DICE LA DIRECCIÓN, SIEMPRE.
   *
   * Antes se leía `?pantalla` de `window.location` UNA vez, al montar.
   * Un enlace a `/admin/control?pantalla=reservas` pulsado DESDE
   * Control es la misma ruta: Next no vuelve a montar la página, el
   * parámetro cambiaba en la barra y la pantalla se quedaba en
   * «Proceso de inscripción». Es el «ver reservas no funciona» del
   * cliente (21 sep 2026), y la razón por la que el enlace del
   * tráfico daba un rodeo por `/admin/trafico`. `useSearchParams` se
   * entera de cada cambio de la dirección --un enlace, el botón
   * Atrás, un `pushState`--, así que ya no hay nada que copiar a un
   * estado ni que acordarse de volver a leer.
   */
  const direccion = useSearchParams();
  const router = useRouter();
  const pedida = direccion.get("pantalla");
  const pestana: Pestana = esPestana(pedida) ? pedida : "metas";

  /**
   * EL CAMINO DE VUELTA DE `?pantalla=trafico`.
   *
   * El tráfico vivió aquí un día y su enlace se repartió --el
   * Resumen apuntaba a él, y quien lo tuviera abierto lo pegó en
   * un chat--. Sin esto, esos enlaces caerían en la pantalla
   * RECORDADA sin decir nada: no es un 404, es peor, porque el
   * enlace parece funcionar y lleva a otro informe.
   *
   * Se hace con `replace` y no con `push`: volver atrás desde el
   * tráfico tiene que salir de aquí, no rebotar otra vez.
   */
  useEffect(() => {
    if (pedida === "trafico") router.replace("/admin/trafico");
  }, [pedida, router]);

  /**
   * EL TÍTULO DE LA PESTAÑA DEL NAVEGADOR, TAMBIÉN.
   *
   * El h1 ya dice el informe elegido, pero la pestaña seguía en
   * «Convoca CRM» en las cuatro pantallas: con dos informes abiertos
   * en dos pestañas no había forma de saber cuál era cuál, y era lo
   * otro que podía querer decir «¿por qué no cambia el título?»
   * (cliente, 21 sep 2026). Se restaura al salir para no dejarle el
   * nombre de un informe a la pantalla siguiente.
   */
  useEffect(() => {
    const antes = document.title;
    const nombre = PESTANAS.find((p) => p.clave === pestana)?.etiqueta ?? "Control de Inscritos";
    document.title = `${nombre} · Control de Inscritos · Convoca CRM`;
    return () => {
      document.title = antes;
    };
  }, [pestana]);

  /**
   * SIN `?pantalla`, MANDA LO RECORDADO: quien vive en una pantalla
   * no tiene por qué volver a elegirla en cada visita.
   *
   * Se escribe EN LA DIRECCIÓN, con `replaceState`, y no en un
   * estado aparte: si la pantalla recordada viviera solo en un
   * estado, «Atrás» desde el informe volvía a `/admin/control` a
   * secas y aterrizaba otra vez en el informe --lo recordado--, no
   * en la pantalla de la que se venía. Con la pantalla siempre en la
   * dirección, cada paso del historial sabe cuál era.
   *
   * Se lee en un efecto y no al crear el estado: `localStorage` no
   * existe en el servidor, y leerlo al pintar sería un desajuste de
   * hidratación.
   */
  useEffect(() => {
    if (esPestana(pedida)) return;
    /// `trafico` YA NO ES UNA PESTAÑA, así que cae aquí — y este
    /// efecto le escribiría la pantalla recordada en la dirección
    /// mientras el de arriba lo está mandando a `/admin/trafico`.
    /// Dos escrituras a la misma dirección en el mismo pintado, y
    /// gana la que termine antes: el enlace viejo aterrizaba a
    /// veces en el informe recordado.
    if (pedida === "trafico") return;
    let guardada: string | null = null;
    try {
      guardada = window.localStorage.getItem(LLAVE_PESTANA);
    } catch {
      // navegador sin almacenamiento: se queda con la de por defecto
    }
    const p = new URLSearchParams(window.location.search);
    p.set("pantalla", esPestana(guardada) ? guardada : "metas");
    window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
  }, [pedida]);

  /**
   * AL CAMBIAR DE PANTALLA, ARRIBA DEL TODO.
   *
   * El botón «Ver reservas» está al fondo de «Proceso de
   * inscripción». Sin esto se aterrizaba a mitad del informe --el
   * contenedor que se desplaza es `<main>` y conserva su posición--,
   * con la tabla de organizaciones a la vista y ni el título ni las
   * cifras: parecía otra vez que no había pasado nada.
   */
  const pestanaAnterior = useRef(pestana);
  useEffect(() => {
    if (pestanaAnterior.current === pestana) return;
    pestanaAnterior.current = pestana;
    document.getElementById("contenido")?.scrollTo({ top: 0 });
  }, [pestana]);

  /// Elegir en el desplegable es navegar: se APILA en el historial
  /// (`pushState`) para que «Atrás» vuelva a la pantalla de antes.
  function cambiar(a: Pestana) {
    try {
      window.localStorage.setItem(LLAVE_PESTANA, a);
    } catch {
      // no poder recordarlo no es motivo para no cambiar
    }
    /// El informe hereda el gremio y la acción que tenga puestos
    /// «Proceso»: así el desplegable y el botón «Ver reservas»
    /// aterrizan en el mismo recorte, y no uno en ADECOPRIA y el otro
    /// en los dos gremios.
    ///
    /// Y a las demás pantallas se llevan los cinco filtros que ya
    /// estén en la dirección. Se cambiaba a `?pantalla=X` a secas, y
    /// al volver a «Proceso» desde Tráfico o Comité el gremio elegido
    /// se había perdido: el mismo defecto del «149 contra 539»
    /// (21 sep 2026), por otra puerta.
    const actual = new URLSearchParams(window.location.search);
    const siguientes = new URLSearchParams({ pantalla: a });
    for (const llave of ["convenioId", "accionFormacionId", "grupoId", "asesorId", "departamentoSepId"]) {
      const valor = actual.get(llave);
      if (valor) siguientes.set(llave, valor);
    }
    const destino =
      a === "reservas"
        ? enlaceAlInforme(cortes)
        : `${window.location.pathname}?${siguientes.toString()}`;
    window.history.pushState(null, "", destino);
  }

  const [rango, setRango] = useState<Rango>("TODO");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  // AUTO: el previo de siempre
  /**
   * Con qué se compara. «NINGUNO» es no comparar.
   *
   * «Si escojo esas dos fechas, esa es la comparativa, ¿no?, ¿por
   * qué sale comparar con?» (cliente, 20 sep 2026). Elegir dos
   * fechas es elegir QUÉ PERIODO se mira; comparar es otra cosa y
   * antes era obligatoria. Ahora se puede no comparar, y al elegir
   * «Entre dos fechas» se deja de comparar sola: quien quiera la
   * comparación la pide.
   */
  const [contra, setContra] = useState<Rango | "AUTO" | "NINGUNO">("AUTO");
  const [contraDesde, setContraDesde] = useState("");
  const [contraHasta, setContraHasta] = useState("");

  /// «Desde el principio» no tiene con qué compararse: no hay
  /// nada antes del primer dato. Ahí no se ofrece la comparación
  /// --ni el desplegable ni el enlace-- en vez de ofrecer una que
  /// no significa nada (cliente, 20 sep 2026).
  const anterior = anteriorDe(rango, desde, hasta);
  const sePuedeComparar = anterior !== "";
  const sinComparar = contra === "NINGUNO" || !sePuedeComparar;
  const eligio = contra !== "AUTO" && !sinComparar;

  /**
   * Los cortes que elige el panel de arriba, para que ESTA
   * mitad de la pantalla corte igual.
   *
   * El periodo lo manda la cabecera y los cortes el panel, pero
   * las dos consultas los llevan: si solo cortase una, el
   * embudo diría «BRITCHAM» y el ritmo seguiría contando los
   * dos gremios en la misma pantalla.
   */
  ///
  /// ARRANCA CON LOS DE LA DIRECCIÓN, no vacío. Los cinco filtros de
  /// «Proceso» viven en la dirección desde el 21 sep 2026, pero esta
  /// página pedía su primer `/control` con `{}` antes de que el panel
  /// le avisara: al recargar con `?convenioId=…` salía «De los dos
  /// gremios», y la segunda consulta --ya con el gremio-- se
  /// descartaba porque la primera seguía en vuelo (medido). Con la
  /// misma forma que arma el panel en `filtros`, para que su aviso
  /// no cambie la clave y no dispare una consulta de más.
  const [cortes, setCortes] = useState<Filtros>(() => {
    const leer = (llave: string) => direccion.get(llave) || undefined;
    const departamento = leer("departamentoSepId");
    return {
      convenioId: leer("convenioId"),
      accionFormacionId: leer("accionFormacionId"),
      grupoId: leer("grupoId"),
      asesorId: leer("asesorId"),
      departamentoSepId: departamento ? Number(departamento) : undefined,
    };
  });

  /// La clave del refresco lleva los cortes: sin ellos, cambiar
  /// de gremio no volvía a pedir nada y se quedaba lo anterior.
  /// `grupoId` va con los demás: sin él, elegir un grupo recortaba
  /// el embudo de la izquierda --que lo pide el panel-- y dejaba
  /// el gráfico de columnas contando a otras ciento treinta
  /// personas, con el pie afirmando que las dos mitades son la
  /// misma gente.
  const claveCortes = [
    cortes.convenioId,
    cortes.accionFormacionId,
    cortes.grupoId,
    cortes.asesorId,
    cortes.departamentoSepId,
  ].join("|");

  const vivos = useDatosVivos<Control>(
    useCallback(
      () =>
        crmApi.control({
          rango,
          desde: desde || undefined,
          hasta: hasta || undefined,
          contra: eligio ? contra : undefined,
          contraDesde: contra === "AUTO" ? undefined : contraDesde || undefined,
          contraHasta: contra === "AUTO" ? undefined : contraHasta || undefined,
          convenioId: cortes.convenioId,
          accionFormacionId: cortes.accionFormacionId,
          grupoId: cortes.grupoId,
          asesorId: cortes.asesorId,
          departamentoSepId: cortes.departamentoSepId,
        }),
      [rango, desde, hasta, contra, contraDesde, contraHasta, cortes, eligio],
    ),
    {
      clave: `${rango}|${desde}|${hasta}|${contra}|${contraDesde}|${contraHasta}|${claveCortes}`,
    },
  );

  /**
   * Si el `control` que se está pintando es del periodo ELEGIDO.
   *
   * `useDatosVivos` conserva la respuesta anterior mientras pide
   * la siguiente --a propósito: vaciar la pantalla en cada
   * vuelta es peor--, así que cuando una consulta no vuelve, lo
   * que se ve es del periodo de antes. El panel necesita saberlo
   * para decirlo dentro del bloque en vez de dejar que se lea
   * como el resultado de lo que se acaba de elegir.
   *
   * Se compara por RANGO y no por la etiqueta: con dos fechas
   * elegidas el backend rotula «del 1 al 15 de septiembre» y el
   * desplegable dice «Un rango de fechas», que son la misma cosa
   * dicha de dos maneras.
   *
   * Se arranca por `desactualizado` --«falló el último
   * intento»--: si la última consulta salió bien, lo que se ve
   * es lo pedido o está a punto de serlo, y el aviso no puede
   * asomar medio segundo en cada cambio de periodo, que es una
   * espera normal y no un fallo.
   */
  const controlAlDia =
    !vivos.desactualizado ||
    !vivos.datos ||
    (vivos.datos.ventana.rango === rango &&
      (rango !== "PERSONALIZADO" ||
        ((vivos.datos.ventana.desde ?? "") === desde &&
          (vivos.datos.ventana.hasta ?? "") === hasta)));

  const diasA = diasDeRango(rango, desde, hasta);
  const diasB = eligio ? diasDeRango(contra as Rango, contraDesde, contraHasta) : diasA;
  // tambien en automatico: mes pasado
  const duracionDistinta =
    !sinComparar &&
    ((eligio && diasA !== diasB) ||
      (!eligio &&
        (vivos.datos?.ventana.etiquetaAnterior ?? '').includes('días contra')));

  return (
    <ContextoRecorteDeControl.Provider value={cortes}>
    <div className="flex flex-col gap-3 px-4 pt-3 pb-6">
      {/* En el informe, la cabecera NO va al papel: allí la
          reemplaza su propio encabezado de impresión («Reservas
          ADECOPRIA» y el recorte), y el PDF empezaría por un título
          --«Control de Inscritos»-- que no es el del informe. En las
          otras pantallas se queda como estaba. */}
      <header
        className={`flex flex-wrap items-start justify-between gap-4 ${
          pestana === "reservas" ? "no-imprimir" : ""
        }`}
      >
        <div className="min-w-0">
          {/* EL TÍTULO ES EL DEL INFORME ELEGIDO.
              Decía «Control de Inscritos» en las cuatro pantallas, y
              al elegir «Tráfico del formulario» en «Informes» la
              cabecera seguía igual: «no entiendo por qué no cambia el
              título» (cliente, 21 sep 2026). Lo que se está mirando es
              el informe, así que él manda en el h1; «Control de
              Inscritos» baja a rótulo de encima, para que no se pierda
              en qué módulo se está. */}
          <p className="text-[0.625rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
            Control de Inscritos
          </p>
          <h1 className="mt-0.5 text-[1.125rem] font-bold tracking-[-0.02em] text-titulo">
            {PESTANAS.find((p) => p.clave === pestana)?.etiqueta ?? "Control de Inscritos"}
          </h1>
          {/* Corto. Dos intentos anteriores explicaban la
              pantalla en tres renglones y el cliente los paró los
              dos: «algo profesional, como: seguimiento y control
              de leads» (20 sep 2026). */}
          {/* «Personas» y no «leads»: el bloque, los cinco
              desplegables y el pie cuentan personas, y dos
              palabras para lo mismo --una de ellas en inglés-- en
              la misma pantalla fue lo primero que se preguntó
              (cliente, 21 sep 2026). */}
          {/* UNA DESCRIPCIÓN POR PANTALLA, no una para las tres:
              «Reservas» cuenta cupos y «Proceso» cuenta personas, y
              una sola frase describiría mal a una de las dos. */}
          <p className="mt-0.5 text-[0.78125rem] text-texto-suave">
            {pestana === "reservas"
              ? /* Propia: la de Proceso hablaría de «personas que se
                   inscriben», y aquí lo que se cuenta son cupos que
                   apartó una organización, con o sin nombre. */
                "Los cupos que apartaron las organizaciones: cuántos, en qué acción de formación y cuántos ya tienen una persona detrás."
              : "Seguimiento y control de las personas que se inscriben, de la primera entrada a la inscripción."}
          </p>
        </div>
        {/* LA COMPARACIÓN, AL FRENTE DEL TÍTULO.

            Bajó un tiempo a la tarjeta de filtros y no es su
            sitio: los cinco filtros recortan QUÉ se mira --y se
            cambian a menudo--, mientras que el periodo y su
            comparación enmarcan la pantalla ENTERA, incluida la
            pestaña del comité. Enmarcar es cosa de la cabecera.

            El indicador va con ellos, y solo en «Proceso»: en la
            otra pestaña diría una hora que no le corresponde. */}
        <div className="flex flex-wrap items-end gap-4">
          {/* «Qué mirar» estaba suelto en su propio renglón debajo
              del título; va con el periodo, que es la otra decisión
              que enmarca la pantalla entera (cliente, 20 sep
              2026), y a su izquierda. */}
          <div className="no-imprimir">
            {/* «Informes» y no «Qué pantalla»: «no que se llame que
                Pantalla sino Informes» (cliente, 21 sep 2026). Lo que
                se elige aquí son informes --el tráfico, el proceso, el
                comité, las reservas--, y el rótulo lo dice. */}
            <p className="mb-1.5 text-[0.625rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
              Informes
            </p>
            <div className="w-[210px]">
              <Desplegable
                alto={34}
                /// El rótulo de encima es visual; un lector de
                /// pantalla solo oye el botón, y sin esto decía
                /// «Tráfico del formulario» sin decir que es un
                /// selector de informe.
                etiquetaAria="Informes"
                marcador="Informes"
                valor={pestana}
                opciones={PESTANAS.map((p) => ({
                  valor: p.clave,
                  etiqueta: p.etiqueta,
                }))}
                alElegir={(v) => cambiar(v as typeof pestana)}
              />
            </div>
          </div>

          {/* El informe de reservas nació de un PDF que el cliente
              imprimía, así que se puede llevar impreso. Va donde en
              «Proceso» va el periodo: el informe no lleva periodo
              --es una foto, y los cupos apartados no dependen de
              una ventana--, y este es el hueco que queda. */}
          {pestana === "reservas" && <BotonPdf />}

          {pestana === "metas" && (
            <>
            <div>
              {/* DOS PREGUNTAS, DOS RÓTULOS.

                  Iban bajo un solo «Periodo y comparación», y el
                  segundo desplegable decía «vs. anterior» sin
                  decir nunca contra qué: con dos fechas elegidas
                  parecía que sobraba --«¿por qué cuando selecciono
                  fechas me sale vs. lo anterior?», cliente, 20 sep
                  2026--. Ahora se leen como lo que son: QUÉ
                  PERIODO se mira, y CONTRA QUÉ se compara. */}
              <p className="mb-1.5 text-[0.625rem] font-bold tracking-[0.08em] uppercase text-texto-suave">
                Periodo
              </p>
              {/* Anchos de verdad: son dos frases --«Desde el
                  principio», «vs. el mes pasado»--, no dos
                  palabras, y apretados se leen cortados. */}
              {/* El mínimo es para los DOS desplegables --«Desde el
                  principio», «vs. el mes pasado» no caben en menos--;
                  las cajas de fecha traen el suyo y con este se
                  estiraban a media pantalla (cliente, 20 sep 2026). */}
              <div className="flex flex-wrap items-center gap-2 [&>button]:min-w-[11.5rem] [&>div]:min-w-[11.5rem]">
                <ControlesDePeriodo
                  parte="periodo"
                  etiquetaAnterior={anterior}
                  rango={rango}
                  alCambiarRango={(r) => {
                    setRango(r);
                    /// Elegir dos fechas apaga la comparación: es
                    /// lo que el cliente espera al ponerlas.
                    ///
                    /// Y SOLO CON DOS FECHAS. Pasar por «Desde el
                    /// principio» apagaba la comparación de todos
                    /// los periodos siguientes sin decirlo: en
                    /// TODO no se notaba --ese periodo no ofrece
                    /// comparación-- pero el estado se quedaba
                    /// puesto, y al volver a «Últimos 30 días» el
                    /// bloque había perdido los cuatro «antes N»,
                    /// la segunda frase de la tasa y la raya del
                    /// promedio sin que nadie tocara nada. Con
                    /// TODO no hace falta apagar: `sePuedeComparar`
                    /// ya es falso porque no tiene anterior.
                    if (r === "PERSONALIZADO") setContra("NINGUNO");
                  }}
                  desde={desde}
                  alCambiarDesde={setDesde}
                  hasta={hasta}
                  alCambiarHasta={setHasta}
                  contra={contra}
                  alCambiarContra={setContra}
                  contraDesde={contraDesde}
                  alCambiarContraDesde={setContraDesde}
                  contraHasta={contraHasta}
                  alCambiarContraHasta={setContraHasta}
                />
              </div>
            </div>

            {/* COMPARAR ES SÍ O NO, no un desplegable.

                Quedaban tres opciones y dos no se sostenían:
                «Otras dos fechas» compara «Hoy» contra un rango de
                tres días --«no entiendo para qué otras dos fechas,
                sé racional», cliente, 20 sep 2026-- y «Sin
                comparación» es no pulsar. Así que cada periodo
                tiene UN anterior --ayer, los 7 días anteriores, el
                mes de antes-- y esto solo lo enciende o lo apaga.
                «Desde el principio» no lo ofrece: no hay nada
                antes del primer dato. */}
            {sePuedeComparar &&
              (sinComparar ? (
                <button
                  type="button"
                  onClick={() => setContra("AUTO")}
                  className="mb-1 text-[0.78125rem] text-marca underline underline-offset-2"
                >
                  Comparar con {anterior.toLowerCase()}
                </button>
              ) : (
                <p className="mb-1 flex items-center gap-2 text-[0.78125rem] text-texto">
                  <span>
                    Comparando con{" "}
                    <strong className="font-semibold text-titulo">
                      {anterior.toLowerCase()}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setContra("NINGUNO")}
                    className="text-texto-suave underline underline-offset-2 hover:text-texto"
                  >
                    quitar
                  </button>
                </p>
              ))}

            {/* QUITAR LO ELEGIDO. «¿No veo eliminar filtro o algo
                así?» (cliente, 20 sep 2026): los cinco filtros de
                abajo tienen su «Limpiar» y el periodo no tenía
                ninguno, así que había que acordarse de cuál era el
                de siempre. Sale solo cuando hay algo que quitar. */}
            {(rango !== "TODO" || contra !== "AUTO") && (
              <button
                type="button"
                onClick={() => {
                  setRango("TODO");
                  setDesde("");
                  setHasta("");
                  setContra("AUTO");
                  setContraDesde("");
                  setContraHasta("");
                }}
                className="mb-1 text-[0.78125rem] text-texto-suave underline underline-offset-2 hover:text-texto"
              >
                Quitar el periodo
              </button>
            )}

            <IndicadorActualizacion
              actualizadoEn={vivos.actualizadoEn}
              refrescando={vivos.refrescando}
              desactualizado={vivos.desactualizado}
              alRefrescar={vivos.refrescar}
            />
            </>
          )}
        </div>
      </header>

      {pestana === "comite" && <ComiteMarketing />}

      {/* Trae sus propios filtros --gremio, acción, dónde se dicta,
          fechas de reserva--, igual que el tráfico trae los suyos.
          El periodo de arriba no le sirve: cuenta cupos apartados,
          que no dependen de una ventana. */}
      {pestana === "reservas" && <PanelReservas />}

      {pestana === "metas" && (
        <>
      {/* El aviso no cabe arriba con los filtros: es prosa, y solo
          aparece cuando los dos periodos no duran lo mismo. */}
      {duracionDistinta && (
        <p className="rounded-xl bg-aviso-suave px-3 py-2 text-xs text-aviso">
          <strong className="font-semibold">Los dos periodos no duran lo mismo:</strong>{" "}
          {ETIQUETA_RANGO[rango].toLowerCase()} abarca {textoDuracion(diasA)} y{" "}
          {ETIQUETA_RANGO[contra as Rango].toLowerCase()} abarca {textoDuracion(diasB)}.
          Comparar volumen entre ventanas de distinta duración no significa nada —la más
          larga gana siempre—; la media de días de lead a inscrito sí se puede leer.
        </p>
      )}

      {/* La pantalla entera. Antes esto era `PanelMetas` plegado
          al pie más un `Cuerpo` de siete tarjetas y cuatro
          bloques anidados, y los dos contaban lo mismo por
          caminos distintos: «en qué punto está cada quien» salía
          dos veces, «de dónde vienen» otras dos y el ritmo, tres.

          El periodo se le pasa como `periodo` y el dato de esa
          consulta como `control`: los filtros mandan sobre toda
          la pantalla y tienen que verse en una sola fila. */}
      <PanelProceso
        alCambiarFiltros={setCortes}
        control={vivos.datos}
        comparar={!sinComparar}
        etiquetaAnterior={anterior}
        /// Cómo se llama lo ELEGIDO aquí arriba, al instante. El
        /// panel no rotula ninguna cifra con esto --cada cifra
        /// lleva el nombre del periodo del que salió--: le sirve
        /// para poder decir qué periodo se pidió cuando la
        /// consulta falla y lo que se ve sigue siendo el anterior.
        etiquetaPeriodo={ETIQUETA_RANGO[rango]}
        controlAlDia={controlAlDia}
      />

      {/* El error del periodo se queda: `PanelProceso` avisa de
          los suyos, pero esta consulta es de la pagina y si se
          cae en silencio el ritmo y el desglose salen vacios sin
          decir por que. */}
      {vivos.error && <Aviso tipo="error">{vivos.error}</Aviso>}
        </>
      )}
    </div>
    </ContextoRecorteDeControl.Provider>
  );
}

/**
 * Los dos desplegables del periodo, para la cabecera.
 *
 * Vivían en una franja propia debajo de las pestañas, con borde y fondo,
 * ocupando el ancho entero para dos selects. Aquí arriba pesan lo que
 * tienen que pesar: son el filtro de la pantalla, no un bloque más.
 */
/**
 * Los dos selectores de periodo, SUELTOS.
 *
 * Devuelve un fragmento y no un `div`: van dentro de la misma
 * rejilla que los otros cinco filtros, en una sola fila con
 * ellos. Envueltos en su propio contenedor formaban una segunda
 * linea, y separados parecian mandar sobre cosas distintas
 * cuando mandan sobre la misma pantalla.
 */
function ControlesDePeriodo({
  rango,
  alCambiarRango,
  desde,
  alCambiarDesde,
  hasta,
  alCambiarHasta,
  contra,
  alCambiarContra,
  contraDesde,
  alCambiarContraDesde,
  contraHasta,
  alCambiarContraHasta,
  parte,
  etiquetaAnterior,
}: {
  rango: Rango;
  alCambiarRango: (r: Rango) => void;
  desde: string;
  alCambiarDesde: (v: string) => void;
  hasta: string;
  alCambiarHasta: (v: string) => void;
  contra: Rango | "AUTO" | "NINGUNO";
  alCambiarContra: (r: Rango | "AUTO" | "NINGUNO") => void;
  contraDesde: string;
  alCambiarContraDesde: (v: string) => void;
  contraHasta: string;
  /// «periodo» son el rango y sus fechas; «comparacion», contra
  /// qué. Se pintan en grupos distintos y cada uno con su rótulo.
  parte: "periodo" | "comparacion";
  /// Cómo se llama el periodo anterior AL ELEGIDO: «Ayer», «Los 7
  /// días anteriores»… Vacío = el periodo no tiene anterior.
  etiquetaAnterior: string;
  alCambiarContraHasta: (v: string) => void;
}) {
  if (parte === "periodo") {
    return (
      <>
      {/* `Desplegable` y no `<select>`: la lista de un select
          la dibuja el sistema operativo, con su cuadro cuadrado
          y su azul, y al lado de los cinco filtros --que sí se
          abren con los colores del panel-- se veía de otra
          aplicación. */}
      <Desplegable
        alto={34}
        etiquetaAria="Periodo"
        valor={rango}
        opciones={RANGOS.map((r) => ({ valor: r, etiqueta: ETIQUETA_RANGO[r] }))}
        alElegir={(v) => alCambiarRango(v as Rango)}
      />

      {rango === "PERSONALIZADO" && (
        <>
          <input
            type="date"
            className={`${CLASE_PERIODO} w-[9.5rem]`}
            value={desde}
            max={hasta || undefined}
            onChange={(e) => alCambiarDesde(e.target.value)}
            aria-label="Desde"
            title="Desde"
          />
          <input
            type="date"
            className={`${CLASE_PERIODO} w-[9.5rem]`}
            value={hasta}
            min={desde || undefined}
            onChange={(e) => alCambiarHasta(e.target.value)}
            aria-label="Hasta"
            title="Hasta"
          />
        </>
      )}

      </>
    );
  }

  return (
    <>
      {/* TRES OPCIONES Y NO DIEZ.

          Ofrecía los ocho rangos: con un rango propio elegido
          arriba, comparar contra «Hoy» o «Últimos 90 días» es
          comparar ventanas de distinta duración, que no significa
          nada --la más larga gana siempre, y por eso existe el
          aviso amarillo--. «Si selecciono una fecha de inicio y
          fin, ¿por qué me saldría todo esto?» (cliente, 20 sep
          2026). Queda lo que sí se puede leer: nada, el tramo de
          antes, u otras dos fechas que elija. */}
      <Desplegable
        alto={34}
        etiquetaAria="Comparar con"
        valor={contra}
        opciones={[
          { valor: "NINGUNO", etiqueta: "Sin comparación" },
          { valor: "AUTO", etiqueta: etiquetaAnterior || "El periodo anterior" },
          { valor: "PERSONALIZADO", etiqueta: "Otras dos fechas" },
        ]}
        alElegir={(v) => alCambiarContra(v as Rango | "AUTO" | "NINGUNO")}
      />

      {contra === "PERSONALIZADO" && (
        <>
          <input
            type="date"
            className={`${CLASE_PERIODO} w-[9.5rem]`}
            value={contraDesde}
            max={contraHasta || undefined}
            onChange={(e) => alCambiarContraDesde(e.target.value)}
            aria-label="Comparar desde"
            title="Comparar desde"
          />
          <input
            type="date"
            className={`${CLASE_PERIODO} w-[9.5rem]`}
            value={contraHasta}
            min={contraDesde || undefined}
            onChange={(e) => alCambiarContraHasta(e.target.value)}
            aria-label="Comparar hasta"
            title="Comparar hasta"
          />
        </>
      )}
    </>
  );
}
