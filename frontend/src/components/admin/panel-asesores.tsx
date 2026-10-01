"use client";

/** Seguimiento de asesores: dos subvistas, inscripciones y académicos. */

/**
 * «SEGUIMIENTO DE ASESORES, DOS SUBVISTAS: ASESORES INSCRIPCIONES Y
 * ASESORES ACADÉMICOS» (cliente, 23 sep 2026).
 *
 * Las dos contestan la misma pregunta con datos distintos: ¿va a llegar
 * esta persona a su fecha, o hay que reforzarla? Por eso comparten el
 * mismo dibujo --una fila por asesor, con su carga, su ritmo y su
 * color-- y solo cambian las columnas de en medio.
 *
 * LA CIFRA QUE MANDA ES «CUÁNTOS POR DÍA». Un porcentaje de avance no
 * dice si se llega; «te faltan 40 en 4 días hábiles, o sea 10 diarios,
 * y vienes haciendo 3» sí, y además dice cuánto refuerzo hace falta. Es
 * lo que el cliente llamó «cálculo de seguimiento incremental».
 *
 * EL COLOR NO ES DECORACIÓN: es la alerta predictiva que pidió. Sale de
 * comparar lo exigido con lo que el asesor viene haciendo de verdad, y
 * se calcula en el servidor (`seguimiento-de-asesores.ts`) para que la
 * pantalla y cualquier aviso futuro no puedan discrepar.
 */

import { useCallback, useMemo, useState } from "react";

import {
  crmApi,
  type FilaDeAsesor,
  type FilaDeAsesorAcademico,
  type FilaDeProyeccion,
  type FilaDeProyeccionAcademica,
  type VentanaDeLlegada,
  type Veredicto,
  type RitmoDeAsesor,
} from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";
import { alcanza } from "@/lib/admin-api";

import { DesgloseDelAsesor } from "./desglose-del-asesor";
import { useAdmin } from "./marco-admin";
import { useToast } from "./toast";
import {
  etiquetaDelAnterior,
  FiltroDePeriodo,
  PERIODO_INICIAL,
  ventanaAnterior,
  ventanaDe,
  type Periodo,
} from "./filtro-de-periodo";
import { n } from "./graficos";
import { Aviso } from "./marco-admin";
import { SelectorBuscable } from "./selector-buscable";
import { CifraCompacta, Encabezado, Esqueleto, Vacio } from "./piezas";
import { RepartoDiario, type AsesorDelReparto } from "./reparto-diario";
import { type Columna, Tabla } from "./tabla";

/**
 * LA META DIARIA, ENTERA Y HACIA ARRIBA.
 *
 * Cuántos tiene que resolver HOY para llegar a su fecha: la meta
 * global repartida entre los días de trabajo que quedan, contados de
 * lunes a sábado ---seis, que es como trabaja el equipo---.
 *
 * ES INCREMENTAL SOLA, sin llevar ningún arrastre. Si hoy tocaban
 * tres y no se hizo ninguno, mañana lo que falta sigue igual y los
 * días que quedan son uno menos, así que la meta sube. «Si no se
 * cumple es incremental al siguiente día» (cliente, 26 sep 2026) es
 * exactamente esto. Guardar el arrastre aparte sería una segunda
 * cuenta viviendo al lado de la primera, y el día que discrepen no
 * habría forma de saber cuál manda.
 *
 * HACIA ARRIBA y no al más cercano: con 0,2 al día, la meta entera
 * no puede ser cero. Cero es «no haga nada hoy», y así no se llega.
 */
const metaDiaria = (porDia: number | null) =>
  porDia === null ? "—" : n(Math.ceil(porDia));

type Subvista =
  | "inscripciones"
  | "academicos"
  | "proyeccion"
  | "proyeccionAcademica";

/// SIN FRASE AL LADO (cliente, 23 sep 2026). Cada tabla ya dice contra
/// qué fecha corre en su propia descripción y en su pie; repetirlo
/// arriba costaba un renglón y no añadía nada.
/**
 * RESUMEN O CALENDARIO, en un desplegable.
 *
 * Dos botones ocupaban una banda entera de la pantalla para decir dos
 * palabras. Aquí va al lado de «Descargar en Excel», en la barra que
 * ya existe, y no cuesta ni un pixel de alto.
 */
function ElegirComoSeVe({
  valor,
  alCambiar,
}: {
  valor: "resumen" | "calendario";
  alCambiar: (v: "resumen" | "calendario") => void;
}) {
  return (
    <select
      aria-label="Cómo se ve"
      value={valor}
      onChange={(e) => alCambiar(e.target.value as "resumen" | "calendario")}
      className="h-[34px] rounded-lg border border-campo-borde bg-campo-fondo px-2 text-[0.78125rem] text-texto outline-none focus:border-campo-foco"
    >
      <option value="resumen">Resumen</option>
      <option value="calendario">Calendario</option>
    </select>
  );
}

const SUBVISTAS: Array<{ clave: Subvista; etiqueta: string }> = [
  { clave: "inscripciones", etiqueta: "Asesores de inscripciones" },
  { clave: "academicos", etiqueta: "Asesores académicos" },
  /// LA TERCERA, y aquí el asesor pasa a segundo plano: lo macro es
  /// la acción de formación. Las dos de arriba contestan «¿quién va
  /// mal?»; esta, «¿esta acción llega a sus cupos antes de cerrar?».
  { clave: "proyeccion", etiqueta: "Proyección Inscripciones" },
  /// LA CUARTA. La misma pregunta con otro reloj: allí si la acción
  /// llena sus cupos antes de cerrar; aquí si certifica a su gente
  /// antes de que acabe el curso.
  { clave: "proyeccionAcademica", etiqueta: "Proyección Académica" },
];

/// Cómo se lee cada veredicto y de qué color va.
const VEREDICTO: Record<Veredicto, { texto: string; color: string }> = {
  SIN_FECHA: { texto: "Sin fecha", color: "var(--aviso)" },
  NO_LLEGA: { texto: "No llega", color: "var(--error)" },
  APRETADO: { texto: "Apretado", color: "var(--aviso)" },
  CERRADO: { texto: "Cerrado", color: "var(--texto-suave)" },
  LLEGA: { texto: "Llega", color: "var(--exito)" },
  CUBIERTO: { texto: "Cubierto", color: "var(--exito)" },
};

/// Cómo se lee cada estado y de qué color va. `SIN_PLAZO` va en gris y
/// NO en verde: no se sabe si va bien, y un verde ahí es una mentira
/// tranquilizadora.
const SEMAFORO: Record<RitmoDeAsesor["estado"], { texto: string; clase: string }> = {
  TERMINADO: { texto: "Terminado", clase: "text-exito" },
  AL_DIA: { texto: "Al día", clase: "text-exito" },
  AJUSTADO: { texto: "Ajustado", clase: "text-aviso" },
  EN_RIESGO: { texto: "Necesita refuerzo", clase: "text-error" },
  VENCIDO: { texto: "Vencido", clase: "text-error" },
  SIN_PLAZO: { texto: "Sin fecha", clase: "text-texto-suave" },
};

const dec = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("es-CO", { maximumFractionDigits: 1 });

const dia = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("es-CO", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : "—";

/**
 * UNA CIFRA CON LA DEL OTRO PERIODO DEBAJO.
 *
 * «Volver dinámico las tarjetas, gráficos y tablas para saber los
 * comparativos» (cliente, 27 sep 2026). Es el MISMO componente que ya
 * usa `tabla-por-accion.tsx`, copiado a propósito: dos flechas con
 * distinta forma o distinto color en la misma pantalla se leen como si
 * midieran cosas distintas.
 *
 * Debajo y no al lado: estas tablas llegan a once columnas, y dos
 * números en la misma línea las parten todas.
 *
 * La de arriba es la del periodo elegido y manda. La de abajo es la
 * del otro, en gris y más pequeña, con su flecha: ▲ subió, ▼ bajó,
 * = igual. Sin comparación puesta se pinta solo la de arriba.
 */
function Cifra({ ahora, antes }: { ahora: number; antes: number | null }) {
  if (antes === null) return <>{n(ahora)}</>;
  const d = ahora - antes;
  return (
    <>
      {n(ahora)}
      <span
        className="block text-[0.6875rem] leading-tight font-normal"
        style={{
          color: d === 0 ? "var(--texto-suave)" : d > 0 ? "var(--exito)" : "var(--error)",
        }}
      >
        {d === 0 ? "=" : d > 0 ? "▲" : "▼"} {n(antes)}
      </span>
    </>
  );
}

/**
 * LA MISMA COMPARACIÓN, PARA LA TIRA DE CIFRAS DE ARRIBA.
 *
 * `CifraCompacta` solo admite TEXTO en su pie, así que aquí la flecha
 * va en el gris del pie y no en verde o rojo. Se prefiere eso a
 * montar una tarjeta propia al lado de las suyas: dos tarjetas
 * parecidas pero distintas en la misma fila es peor que una flecha
 * sin color, y `piezas.tsx` no es de esta tarea.
 */
const comparado = (ahora: number, antes: number | null | undefined) => {
  if (antes === null || antes === undefined) return undefined;
  const d = ahora - antes;
  return `${d === 0 ? "=" : d > 0 ? "▲" : "▼"} ${n(antes)}`;
};

/**
 * CONTRA QUÉ SE COMPARA, DICHO UNA VEZ POR SUBVISTA.
 *
 * Sin esto, la segunda cifra de cada celda es un número sin dueño: es
 * lo que ya pasó con las tarjetas de Seguimiento Académico.
 */
function ContraQue({ rotulo }: { rotulo: string }) {
  return (
    <p className="text-[0.8125rem] text-texto-suave">
      Debajo de cada cifra, la misma de{" "}
      <strong className="font-medium text-titulo">{rotulo}</strong>.
    </p>
  );
}

/** Lo que cada subvista necesita para pedir y pintar los dos periodos. */
type ConPeriodo = {
  ventana: VentanaDeLlegada;
  /// El tramo de antes, o NULO si el periodo elegido no tiene anterior
  /// («Desde el principio»). Nulo quiere decir: no se compara nada y
  /// la subvista sale como siempre.
  ventanaAntes: VentanaDeLlegada | null;
  /// Cómo se llama ese tramo, para poder decirlo con palabras.
  rotuloAnterior: string;
};

export function PanelAsesores() {
  const [subvista, setSubvista] = useState<Subvista>("inscripciones");

  /**
   * QUÉ SE MIRA EN «Asesores de inscripciones»: el resumen o el
   * calendario. Vive AQUÍ y no dentro de la subvista porque su
   * interruptor comparte barra con el periodo, y la barra es de esta
   * pantalla.
   */
  const [comoSeVe, setComoSeVe] = useState<"resumen" | "calendario">("resumen");

  /// EL PERIODO VIVE AQUÍ, NO DENTRO DE CADA SUBVISTA: «en todos los
  /// tableros debo tener filtros» (cliente, 27 sep 2026), y un filtro
  /// que se reinicia al cambiar de pestaña obliga a elegirlo tres
  /// veces para comparar las tres caras del mismo mes.
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_INICIAL);

  /// LA VENTANA DEL PERIODO ELEGIDO. Los cuatro endpoints ya aceptan
  /// `llegoDesde`/`llegoHasta` y recortan de verdad, así que aquí solo
  /// hay que traducir el periodo y bajarlo.
  const ventana = useMemo(() => ventanaDe(periodo), [periodo]);

  /**
   * EL TRAMO DE ANTES, de la misma duración.
   *
   * «Es realmente volver dinámico las tarjetas, gráficos y tablas para
   * saber los comparativos» (cliente, 27 sep 2026). Un conteo solo no
   * dice si se va mejor o peor; con el de al lado, sí.
   *
   * NULO CUANDO NO HAY CON QUÉ COMPARAR: «Desde el principio» no tiene
   * anterior y `ventanaAnterior` devuelve un objeto sin fechas. Pedirlo
   * igual traería OTRA VEZ todo el histórico con cara de ser el tramo
   * de antes, que es la flecha que miente.
   */
  const ventanaAntes = useMemo(() => {
    const v = ventanaAnterior(periodo);
    return v.llegoDesde && v.llegoHasta ? v : null;
  }, [periodo]);

  /// CÓMO SE LLAMA ESE TRAMO. Un rango a medida no tiene nombre hecho
  /// ---`etiquetaDelAnterior` devuelve vacío---, pero sí tiene tramo
  /// anterior, así que se le dice lo que es en vez de dejar la segunda
  /// cifra sin dueño.
  const rotuloAnterior =
    etiquetaDelAnterior(periodo.rango) || "el tramo anterior, de la misma duración";

  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-6 [&>header]:mx-0 [&>header]:mb-0">
      {/* SIN FRASE DEBAJO DEL TÍTULO (cliente, 23 sep 2026). Cada
          bloque ya dice lo suyo, y una segunda explicación arriba
          costaba veinte píxeles de alto en todas las pantallas. */}
      {/* LAS CUATRO SUBVISTAS, EN UN DESPLEGABLE AL LADO DEL TÍTULO.

          «No se puede organizado al frente del título: Seguimiento de
          asesores» (cliente, 30 sep 2026). Ocupaban una caja propia
          debajo, con su borde, para decir cuatro palabras.

          Van en el encabezado y NO por `AccionesDePagina`: ese portal
          escribe en la barra del MENÚ, y al probarlo las cuatro se
          montaron encima de «Formularios» y «Configuración».

          Y EL PERIODO VA CON ELLAS, en la misma fila: «no sé si esto
          como periodo para que ambos queden en la misma fila»
          (cliente, 1 oct 2026). Solo él ocupaba una banda entera de
          la pantalla, y en tres de las cuatro subvistas esa banda no
          llevaba nada más. */}
      <Encabezado compacto titulo="Seguimiento de asesores">
        {/* EN DESPLEGABLE, no en cuatro botones: «¿no entendiste que
            esto en desplegable?» (cliente, 1 oct 2026). Las cuatro
            etiquetas son largas y se comían la fila del título entera;
            una sola casilla dice lo mismo y deja sitio al periodo. */}
        <select
          aria-label="Qué se mira"
          value={subvista}
          onChange={(e) => setSubvista(e.target.value as Subvista)}
          className="h-[34px] rounded-lg border border-campo-borde bg-campo-fondo px-2 text-[0.8125rem] font-medium text-texto outline-none focus:border-campo-foco"
        >
          {SUBVISTAS.map((s) => (
            <option key={s.clave} value={s.clave}>
              {s.etiqueta}
            </option>
          ))}
        </select>
        <FiltroDePeriodo periodo={periodo} alCambiar={setPeriodo} />
      </Encabezado>

      {/* LAS DOS VENTANAS BAJAN A LAS CUATRO. Se pasan los objetos ya
          resueltos y no el periodo: así la subvista no tiene que saber
          qué es «el mes pasado» ni cuál es su anterior, solo pedir lo
          que le digan. */}
      {subvista === "inscripciones" && (
        <DeInscripciones
          {...{ ventana, ventanaAntes, rotuloAnterior }}
          /// EL CUADRO DE DIANITA LLEVA A DONDE SALEN SUS CIFRAS.
          alIrALaProyeccion={() => setSubvista("proyeccion")}
          comoSeVe={comoSeVe}
          alCambiarComoSeVe={setComoSeVe}
        />
      )}
      {subvista === "academicos" && (
        <Academicos {...{ ventana, ventanaAntes, rotuloAnterior }} />
      )}
      {subvista === "proyeccion" && (
        <Proyeccion {...{ ventana, ventanaAntes, rotuloAnterior }} />
      )}
      {subvista === "proyeccionAcademica" && (
        <ProyeccionAcademica {...{ ventana, ventanaAntes, rotuloAnterior }} />
      )}
    </div>
  );
}

/**
 * LO QUE SE ENSEÑA DE CADA ASESOR.
 *
 * Con una acción de formación elegida, las cuatro cifras de carga son
 * LAS DE ESA ACCIÓN y no las del asesor entero: es lo que hace útil
 * el filtro. El ritmo, el plazo y el estado siguen siendo del asesor
 * completo ---se calculan contra el cierre más próximo de todas sus
 * acciones--- y el pie de la tabla lo dice, porque un número que
 * cambia de significado sin avisar es peor que no tenerlo.
 */
type Vista = FilaDeAsesor & {
  visto: {
    total: number;
    gestionados: number;
    resueltos: number;
    /// Los dos lados de `resueltos`, que son dos columnas.
    inscritos: number;
    descartados: number;
    pendientes: number;
  };
};

/**
 * LAS CIFRAS DE UNA FILA, con la acción elegida o sin ella.
 *
 * FUERA DEL COMPONENTE porque lo usan LOS DOS PERIODOS: el de ahora y
 * el de antes tienen que recortarse por la misma acción, o se acabaría
 * comparando el total de uno contra una sola acción del otro. Nulo =
 * ese asesor no tiene carga en la acción elegida.
 */
function vistoDe(f: FilaDeAsesor, accion: string): Vista["visto"] | null {
  if (!accion) {
    return {
      total: f.carga.total,
      gestionados: f.carga.gestionados,
      resueltos: f.carga.resueltos,
      inscritos: f.inscritos ?? 0,
      descartados: f.descartados ?? 0,
      pendientes: f.ritmo.pendientes,
    };
  }
  const suya = (f.porAccion ?? []).find((a) => a.accionFormacionId === accion);
  /// Sin carga en esa acción, el asesor no sale: la pregunta es
  /// «quién lleva esto», y una fila de ceros la contesta mal.
  if (!suya) return null;
  return {
    total: suya.total,
    gestionados: suya.gestionados,
    resueltos: suya.resueltos,
    inscritos: suya.inscritos,
    descartados: suya.descartados,
    pendientes: suya.pendientes,
  };
}

/// LA MISMA LLAVE PARA LOS DOS PERIODOS. `asesorId` es nulo en la fila
/// de «Sin asesor asignado», y dos nulos no se encuentran en un `Map`.
const llaveDeAsesor = (f: { asesorId: string | null }) => f.asesorId ?? "sin-asesor";

function DeInscripciones({
  ventana,
  ventanaAntes,
  rotuloAnterior,
  alIrALaProyeccion,
  comoSeVe,
  alCambiarComoSeVe,
}: ConPeriodo & {
  alIrALaProyeccion?: () => void;
  /// Lo decide la barra de arriba, que es donde vive su interruptor.
  comoSeVe: "resumen" | "calendario";
  alCambiarComoSeVe: (v: "resumen" | "calendario") => void;
}) {
  /// La clave lleva el periodo dentro: sin eso, cambiarlo no vuelve
  /// a pedir y la tabla se queda enseñando el periodo de antes. Y
  /// lleva TAMBIÉN el tramo con el que se compara, que es otro dato
  /// que cambia lo que hay que pedir.
  const clave = JSON.stringify(ventana);
  const claveAntes = JSON.stringify(ventanaAntes);

  /// LOS DOS PERIODOS EN LA MISMA CONSULTA. Dos `useDatosVivos`
  /// separados se refrescan cada uno por su lado, y durante un
  /// instante la tabla enseñaría el periodo nuevo contra el anterior
  /// viejo: dos cifras que no son comparables con cara de serlo.
  const cargar = useCallback(
    async (): Promise<{
      ahora: FilaDeAsesor[];
      antes: FilaDeAsesor[] | null;
      proyeccion: FilaDeProyeccion[];
    }> => {
      const [ahora, antes, proyeccion] = await Promise.all([
        crmApi.asesoresDeInscripciones(ventana),
        ventanaAntes ? crmApi.asesoresDeInscripciones(ventanaAntes) : null,
        crmApi.proyeccionDeInscripciones(ventana),
      ]);
      return { ahora, antes, proyeccion };
    },
    [ventana, ventanaAntes],
  );
  const vivos = useDatosVivos<{
    ahora: FilaDeAsesor[];
    antes: FilaDeAsesor[] | null;
    proyeccion: FilaDeProyeccion[];
  }>(cargar, { clave: `asesores-inscripciones-${clave}-${claveAntes}` });

  /// LO QUE ALIMENTA EL CUADRO DE DIANITA: lo que falta por cubrir,
  /// hasta cuándo, y los asesores con nombre. Sale de la proyección
  /// que viaja en la misma consulta, así que las dos mitades de esta
  /// pantalla no pueden decir cosas distintas.
  const reparto = repartoDeLaProyeccion(
    vivos.datos?.proyeccion ?? [],
    vivos.datos?.ahora ?? [],
  );

  /// EL FILTRO POR ACCIÓN, SIN TOCAR EL SERVIDOR (cliente, 23 sep
  /// 2026: «que tenga filtros, y no sé si se puede como Control de
  /// inscritos»).
  ///
  /// Cada fila ya trae su reparto por acción, así que elegir una es
  /// leer de ahí en vez de volver a pedir. Los endpoints de asesores
  /// no aceptan filtros ---solo el ámbito--- y añadírselos habría
  /// sido una consulta más por cada clic para un dato que ya estaba
  /// en la mano.
  const [accion, setAccion] = useState("");
  /// A quién se le está mirando el desglose.
  /// QUÉ ASESOR TIENE EL DESGLOSE ABIERTO. Ya no es un cajón: la
  /// subtabla sale DEBAJO, como en Control de inscritos, y por eso el
  /// nombre del estado cambió con ella.
  const [desglosado, setDesglosado] = useState<FilaDeAsesor | null>(null);

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto />;
  /// El resto de la subvista sigue leyendo una lista, como siempre.
  const datos = vivos.datos.ahora;
  const comparando = vivos.datos.antes !== null;
  if (datos.length === 0) {
    return (
      <Vacio titulo="Todavía no hay leads repartidos">
        Aquí aparece cada asesor en cuanto tenga personas asignadas.
      </Vacio>
    );
  }

  /// LAS ACCIONES QUE SALEN EN EL FILTRO son las que alguien tiene
  /// asignadas, no el catálogo: un filtro con quince acciones vacías
  /// hace perder el tiempo. Y se sacan de TODAS las filas, no de las
  /// que quedan filtradas, que es el fallo que ya costó una vuelta en
  /// Seguimiento del aula.
  ///
  /// CON EL NOMBRE Y NO SOLO EL CÓDIGO: hay dos acciones con código
  /// «AF1», así que una lista de códigos ofrecía «AF1» dos veces sin
  /// forma de saber cuál era cuál. Es la misma trampa que ya costó
  /// una vuelta en los grupos del aula.
  const acciones = [
    ...new Map(
      datos
        .flatMap((f) => f.porAccion ?? [])
        .filter((a) => a.accionFormacionId && a.codigo)
        .map((a) => [
          a.accionFormacionId!,
          { codigo: a.codigo!, nombre: a.nombre },
        ]),
    ),
  ]
    .map(([id, a]) => ({
      id,
      etiqueta: a.nombre ? `${a.codigo} · ${a.nombre}` : a.codigo,
    }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));

  const filas: Vista[] = datos
    .map((f) => {
      const visto = vistoDe(f, accion);
      return visto ? { ...f, visto } : null;
    })
    .filter((f): f is Vista => f !== null);

  /// LAS MISMAS CIFRAS DEL TRAMO DE ANTES, por asesor. Un asesor puede
  /// no aparecer allí ---entró después, o no tenía nada en esa
  /// acción---: entonces no hay con qué comparar y no se pinta nada,
  /// en vez de un cero que diría que no hizo nada.
  const vistoAntes = new Map(
    (vivos.datos.antes ?? []).map((f) => [llaveDeAsesor(f), vistoDe(f, accion)]),
  );
  const antesDe = (f: Vista) =>
    comparando ? (vistoAntes.get(llaveDeAsesor(f)) ?? null) : null;

  /// LA TIRA DE CIFRAS SE SUMA DE LAS MISMAS FILAS QUE SE PINTAN
  /// DEBAJO (cliente, 23 sep 2026). Con una consulta aparte, el total
  /// de arriba y la suma de la tabla podrían discrepar, y es lo
  /// primero que alguien comprueba. Ahora además respeta el filtro:
  /// con una acción puesta, arriba sale lo de esa acción.
  const t = filas.reduce(
    (a, f) => ({
      total: a.total + f.visto.total,
      gestionados: a.gestionados + f.visto.gestionados,
      resueltos: a.resueltos + f.visto.resueltos,
      inscritos: a.inscritos + f.visto.inscritos,
      descartados: a.descartados + f.visto.descartados,
      pendientes: a.pendientes + f.visto.pendientes,
    }),
    { total: 0, gestionados: 0, resueltos: 0, inscritos: 0, descartados: 0, pendientes: 0 },
  );

  /// LA MISMA SUMA DEL TRAMO DE ANTES, y de las mismas filas: los
  /// asesores sin carga en la acción elegida quedan fuera aquí igual
  /// que quedan fuera de la tabla.
  const tAntes = comparando
    ? [...vistoAntes.values()]
        .filter((v): v is Vista["visto"] => v !== null)
        .reduce(
          (a, v) => ({
            total: a.total + v.total,
            gestionados: a.gestionados + v.gestionados,
            inscritos: a.inscritos + v.inscritos,
            descartados: a.descartados + v.descartados,
          }),
          { total: 0, gestionados: 0, inscritos: 0, descartados: 0 },
        )
    : null;

  /// LOS DOS SE CUENTAN SOBRE LAS MISMAS FILAS. La fila «Sin asesor
  /// asignado» no es una persona, así que no cuenta como asesor; si el
  /// refuerzo sí la contaba, salía «7 asesores · 8 necesitan
  /// refuerzo», que no se sostiene.
  const deVerdad = filas.filter((f) => f.asesorId !== null);
  const conAsesor = deVerdad.length;
  const aReforzar = deVerdad.filter(
    (f) => f.ritmo.estado === "EN_RIESGO" || f.ritmo.estado === "VENCIDO",
  ).length;

  const columnas: Columna<Vista>[] = [
    {
      clave: "nombre",
      titulo: "Asesor",
      ancho: "230px",
      fija: true,
      valor: (f) => f.nombre,
      filtro: "texto",
      pinta: (f) => (
        <span className={f.asesorId ? "font-medium" : "font-medium text-texto-suave"}>
          {f.nombre}
        </span>
      ),
    },
    /// LAS CUATRO COLUMNAS DE CONTEO LLEVAN LA DEL OTRO PERIODO
    /// DEBAJO. Son las únicas que cuentan HECHOS del periodo; las de
    /// más allá ---meta global, antigüedad media, cierre, meta
    /// diaria--- son plazos, promedios y objetivos, y una flecha
    /// encima diría que subieron o bajaron cuando lo que cambió es
    /// otra cosa.
    {
      clave: "total",
      titulo: "Leads asignados",
      ancho: "130px",
      numerica: true,
      valor: (f) => f.visto.total,
      pinta: (f) => (
        <span className="tabular-nums">
          <Cifra ahora={f.visto.total} antes={antesDe(f)?.total ?? null} />
        </span>
      ),
    },
    /// DOS COLUMNAS Y NO UNA (cliente, 26 sep 2026: «esto es
    /// separado, o sea una columna Inscritos y en otro Descartados»).
    /// Juntas sumaban bien y no decían nada: quince resueltos pueden
    /// ser quince inscritos o quince caídos, y son dos
    /// conversaciones distintas con el asesor.
    {
      clave: "inscritos",
      titulo: "Leads inscritos",
      ancho: "132px",
      numerica: true,
      valor: (f) => f.visto.inscritos,
      pinta: (f) => (
        <span className="font-medium text-exito tabular-nums">
          <Cifra ahora={f.visto.inscritos} antes={antesDe(f)?.inscritos ?? null} />
        </span>
      ),
    },
    {
      clave: "descartados",
      titulo: "Leads descartados",
      ancho: "142px",
      numerica: true,
      valor: (f) => f.visto.descartados,
      pinta: (f) => (
        <span className="tabular-nums text-texto-suave">
          <Cifra ahora={f.visto.descartados} antes={antesDe(f)?.descartados ?? null} />
        </span>
      ),
    },
    /// GESTIONADOS VA AL FINAL DE LAS CUATRO, y no entre asignados e
    /// inscritos como estaba. Es el orden que pidió el cliente y tiene
    /// sentido de lectura: primero lo que le entró, luego en qué acabó
    /// ---inscrito o descartado---, y al final cuántos sigue
    /// trabajando. Gestionados NO es la suma de los otros dos: son los
    /// que tienen seguimiento, resueltos o no.
    {
      clave: "gestionados",
      titulo: "Leads gestionados",
      ancho: "138px",
      numerica: true,
      valor: (f) => f.visto.gestionados,
      pinta: (f) => (
        <span className="tabular-nums">
          <Cifra ahora={f.visto.gestionados} antes={antesDe(f)?.gestionados ?? null} />
        </span>
      ),
    },
    {
      /// EL CIERRE Y LO QUE FALTA, en dos renglones. Era su propio
      /// componente `Plazo`, que pintaba un `<td>`; con `Tabla` la
      /// celda la pone ella, así que aquí va solo el contenido.
      clave: "cierre",
      titulo: "Cierre",
      ancho: "140px",
      valor: (f) => f.limite,
      pinta: (f) => (
        <span className="whitespace-nowrap tabular-nums">
          {dia(f.limite)}
          {f.ritmo.diasHabiles !== null && (
            <span className="block text-[0.6875rem] text-texto-suave">
              {f.ritmo.diasHabiles > 0
                ? `quedan ${n(f.ritmo.diasHabiles)} ${f.ritmo.diasHabiles === 1 ? "día hábil" : "días hábiles"}`
                : f.ritmo.diasHabiles === 0
                  ? "hoy es el último"
                  : `venció hace ${n(-f.ritmo.diasHabiles)} ${f.ritmo.diasHabiles === -1 ? "día hábil" : "días hábiles"}`}
            </span>
          )}
        </span>
      ),
    },
    {
      clave: "exigido",
      /// LOS DOS RÓTULOS DICEN QUÉ SON, y en la misma unidad: así se
      /// leen uno contra otro, que es para lo que están al lado.
      titulo: "Meta diaria",
      ancho: "112px",
      numerica: true,
      valor: (f) => f.ritmo.exigidoPorDia,
      pinta: (f) => (
        <span className="font-semibold tabular-nums">{metaDiaria(f.ritmo.exigidoPorDia)}</span>
      ),
    },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "135px",
      valor: (f) => SEMAFORO[f.ritmo.estado].texto,
      filtro: "opciones",
      pinta: (f) => (
        <span
          className={`whitespace-nowrap text-[0.75rem] font-semibold ${SEMAFORO[f.ritmo.estado].clase}`}
        >
          {SEMAFORO[f.ritmo.estado].texto}
        </span>
      ),
    },
  ];

  return (
    <>
    {/* LAS TARJETAS DE «GESTIÓN DE LEADS»: 46 px de alto. Estuvieron
        con `TarjetaCifra` --32 px de cifra, 110 de alto, dentro de su
        bloque-- y el cliente lo paró: «que no ocupen mucho espacio y le
        da orden» (23 sep 2026). */}
    <div className="flex flex-wrap gap-2">
      <CifraCompacta
        etiqueta="Asesores"
        valor={n(conAsesor)}
        pie={aReforzar > 0 ? `${n(aReforzar)} necesitan refuerzo` : undefined}
      />
      <CifraCompacta
        etiqueta="Leads asignados"
        valor={n(t.total)}
        pie={comparado(t.total, tAntes?.total)}
      />
      {/* LOS MISMOS NOMBRES Y EL MISMO ORDEN QUE LAS COLUMNAS DE
          DEBAJO: asignados, inscritos, descartados, gestionados. Una
          tira que va en otro orden que la tabla que tiene pegada
          debajo se lee como si fueran otras cifras. */}
      <CifraCompacta
        etiqueta="Leads inscritos"
        valor={n(t.inscritos)}
        color="var(--exito)"
        pie={comparado(t.inscritos, tAntes?.inscritos)}
      />
      <CifraCompacta
        etiqueta="Leads descartados"
        valor={n(t.descartados)}
        pie={comparado(t.descartados, tAntes?.descartados)}
      />
      <CifraCompacta
        etiqueta="Leads gestionados"
        valor={n(t.gestionados)}
        detalle={t.total > 0 ? `${Math.round((t.gestionados / t.total) * 100)} %` : undefined}
        pie={comparado(t.gestionados, tAntes?.gestionados)}
      />
    </div>

    {comparando && <ContraQue rotulo={rotuloAnterior} />}

    {/* LA TABLA, SUELTA EN LA PÁGINA. «Que quede como la segunda
        captura» (cliente, 25 sep 2026), que era Gestión de leads:
        allí el buscador, los filtros y la descarga van sobre el fondo
        y la tabla debajo. Aquí estaban metidos dentro de una caja con
        borde, y esa caja es la que hacía que se vieran «metidos feo».

        Es la misma `Tabla` de Gestión de leads --con su buscador, sus
        filtros por columna, el selector de columnas y la descarga--,
        así que montada igual se ve igual. */}
    {comoSeVe === "resumen" && (
    <Tabla
      acciones={<ElegirComoSeVe valor={comoSeVe} alCambiar={alCambiarComoSeVe} />}
      cuadricula
      /// EL NOMBRE CAMBIA PORQUE CAMBIÓ EL ORDEN DE LAS COLUMNAS.
      ///
      /// La tabla graba en el navegador qué columnas se ven Y EN QUÉ
      /// ORDEN, y lo graba en la PRIMERA visita sin que nadie toque
      /// nada. Así que quien hubiera abierto esta pantalla antes de
      /// hoy seguía viendo el orden viejo ---gestionados delante de
      /// inscritos--- por mucho que el código diga otro. El cliente
      /// pidió el orden nuevo el 30 sep 2026 y no le llegaba.
      ///
      /// Es el mismo caso que la tabla de reservas, y la misma cura:
      /// con nombre nuevo todos arrancan del orden declarado. Lo que
      /// cada quien hubiera acomodado se queda bajo el nombre viejo,
      /// sin estorbar.
      ///
      /// REGLA QUE SALE DE AQUÍ: reordenar columnas obliga a renombrar
      /// la tabla. Si no, el cambio solo lo ven los que nunca entraron.
      id="asesores-inscripciones-v2"
      columnas={columnas}
      filas={filas}
      clave={(f) => f.asesorId ?? "sin-asesor"}
      /// Vuelve a pulsar la misma fila y se cierra: es la única
      /// puerta de salida que se prueba sola.
      alClic={(f) => setDesglosado((v) => (v && v.asesorId === f.asesorId ? null : f))}
      porPagina={25}
      vacio={
        accion
          ? "Ningún asesor tiene leads en esa acción de formación."
          : "Todavía no hay leads repartidos."
      }
      /* EL FILTRO DE ACCIÓN, FUSIONADO EN LA FILA DEL BUSCADOR,
         como en Seguimiento del aula: no es un filtro de columna
         ---cambia QUÉ CIFRAS se enseñan, no qué filas quedan--- y
         en su propia tarjeta encima volvería a estirarse a media
         pantalla. */
      filtrosDelServidor={
        <>
          <SelectorBuscable
            clase="min-w-[12rem] flex-1"
            etiqueta="Acción de formación"
            valor={accion}
            alElegir={setAccion}
            vacio="Todas las acciones"
            quitar="Ver todas las acciones"
            marcador="AF1, AF2…"
            opciones={acciones}
          />
          {accion && (
            <button
              type="button"
              onClick={() => setAccion("")}
              className="shrink-0 text-[0.78125rem] text-texto-suave underline hover:text-texto"
            >
              Limpiar
            </button>
          )}
        </>
      }
    />

    )}

    {comoSeVe === "resumen" && desglosado && (
      <DesgloseDelAsesor fila={desglosado} alCerrar={() => setDesglosado(null)} />
    )}

    {/* EL CUADRO DE DIANITA, AQUÍ Y NO EN LA OTRA SUBVISTA.

        Lo puse primero colgado de «Proyección Inscripciones», que es
        de donde salen sus cifras, y el cliente lo pidió AQUÍ (30 sep
        2026). Tiene razón de sobra: esta es la pantalla del equipo, y
        las dos mitades contestan la misma pregunta por los dos lados
        ---arriba lo que cada quien lleva hecho, abajo lo que le toca
        por día para llegar---. Separadas hay que acordarse de mirar
        las dos.

        Se MUEVE, no se copia: dos cuadros iguales en dos pantallas
        acaban discrepando el día que uno se cambie y el otro no. */}
    {comoSeVe === "calendario" && (
    <div className="flex justify-end">
      <ElegirComoSeVe valor={comoSeVe} alCambiar={alCambiarComoSeVe} />
    </div>
    )}
    {comoSeVe === "calendario" && (
    <RepartoDiario
      meta={reparto.meta}
      queEs="cupos por cubrir"
      asesores={reparto.asesores}
      cierre={reparto.cierre}
      alIrALaProyeccion={alIrALaProyeccion}
      vencidas={reparto.vencidas}
      faltaEnVencidas={reparto.faltaEnVencidas}
    />
    )}
    </>
  );
}

function Academicos({ ventana, ventanaAntes, rotuloAnterior }: ConPeriodo) {
  /// LOS DOS PERIODOS EN LA MISMA CONSULTA, por lo mismo que en la
  /// pestaña de al lado: separados se refrescarían cada uno por su
  /// cuenta y por un instante se compararía lo nuevo contra lo viejo.
  const cargar = useCallback(
    async (): Promise<{
      ahora: FilaDeAsesorAcademico[];
      antes: FilaDeAsesorAcademico[] | null;
    }> => {
      const [ahora, antes] = await Promise.all([
        crmApi.asesoresAcademicos(ventana),
        ventanaAntes ? crmApi.asesoresAcademicos(ventanaAntes) : null,
      ]);
      return { ahora, antes };
    },
    [ventana, ventanaAntes],
  );
  const vivos = useDatosVivos<{
    ahora: FilaDeAsesorAcademico[];
    antes: FilaDeAsesorAcademico[] | null;
  }>(cargar, {
    clave: `asesores-academicos-${JSON.stringify(ventana)}-${JSON.stringify(ventanaAntes)}`,
  });

  /// LAS COLUMNAS, CON EL OTRO PERIODO DENTRO. Antes eran una constante
  /// de módulo ---no dependían de nada---; ahora dependen de las filas
  /// del tramo anterior, así que se rehacen solo cuando esas cambian.
  const antesPorAsesor = useMemo(
    () => new Map((vivos.datos?.antes ?? []).map((f) => [llaveDeAsesor(f), f])),
    [vivos.datos],
  );
  const comparando = vivos.datos?.antes != null;
  const columnas = useMemo(
    () =>
      columnasAcademicas((f) =>
        comparando ? (antesPorAsesor.get(llaveDeAsesor(f)) ?? null) : null,
      ),
    [antesPorAsesor, comparando],
  );

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto />;
  const datos = vivos.datos.ahora;
  if (datos.length === 0) {
    return (
      <Vacio titulo="Todavía no hay grupos con participantes">
        Aquí aparece cada asesor en cuanto tenga grupos asignados con participantes.
      </Vacio>
    );
  }

  /// NADIE LLEVA NINGÚN GRUPO.
  /// La pestaña no estaba vacía: enseñaba una fila «Sin asesor
  /// asignado» con los mil y pico participantes dentro, que se lee
  /// como un dato y no como lo que es ---que la asignación nunca se
  /// hizo---. Hasta el 25 sep 2026 no había ni por dónde hacerla.
  const nadieAsignado = datos.every((f) => f.asesorId === null);

  /// La misma tira de arriba, con lo que se mide en académica.
  const t = datos.reduce(
    (a, f) => ({
      grupos: a.grupos + f.grupos,
      pax: a.pax + f.carga.total,
      seguimiento: a.seguimiento + f.conSeguimiento,
      certificados: a.certificados + f.certificados,
      porCertificar: a.porCertificar + f.ritmo.pendientes,
    }),
    { grupos: 0, pax: 0, seguimiento: 0, certificados: 0, porCertificar: 0 },
  );

  /// La misma suma del tramo de antes, para la tira.
  const tAntes = comparando
    ? (vivos.datos.antes ?? []).reduce(
        (a, f) => ({
          grupos: a.grupos + f.grupos,
          pax: a.pax + f.carga.total,
          seguimiento: a.seguimiento + f.conSeguimiento,
          certificados: a.certificados + f.certificados,
        }),
        { grupos: 0, pax: 0, seguimiento: 0, certificados: 0 },
      )
    : null;

  return (
    <>
    <div className="flex flex-wrap gap-2">
      <CifraCompacta
        etiqueta="Grupos"
        valor={n(t.grupos)}
        pie={comparado(t.grupos, tAntes?.grupos)}
      />
      <CifraCompacta etiqueta="PAX" valor={n(t.pax)} pie={comparado(t.pax, tAntes?.pax)} />
      <CifraCompacta
        etiqueta="Con seguimiento"
        valor={n(t.seguimiento)}
        detalle={t.pax > 0 ? `${Math.round((t.seguimiento / t.pax) * 100)} %` : undefined}
        pie={comparado(t.seguimiento, tAntes?.seguimiento)}
      />
      <CifraCompacta
        etiqueta="Certificados"
        valor={n(t.certificados)}
        color="var(--exito)"
        detalle={t.pax > 0 ? `${Math.round((t.certificados / t.pax) * 100)} %` : undefined}
        pie={comparado(t.certificados, tAntes?.certificados)}
      />
      {/* «Por certificar» es lo que FALTA, no lo que se hizo: no
          compara, ni aquí ni en la tabla. */}
      <CifraCompacta
        etiqueta="Por certificar"
        valor={n(t.porCertificar)}
        color={t.porCertificar > 0 ? "var(--error)" : undefined}
      />
    </div>

    {comparando && <ContraQue rotulo={rotuloAnterior} />}

    {nadieAsignado && (
      <div className="rounded-lg border border-aviso/30 bg-aviso-suave p-3.5 text-[0.8125rem] text-texto">
        <p className="font-semibold text-titulo">
          Ningún grupo tiene asesor académico asignado todavía.
        </p>
      </div>
    )}

    {/* LA MISMA `Tabla` QUE LA PESTAÑA DE AL LADO.

        Hasta hoy era un `<table>` escrito a mano dentro de una caja, y
        por eso no tenía buscador, ni filtros por columna, ni selector
        de columnas, ni vistas guardadas, ni ordenación al pulsar una
        cabecera, ni descarga a Excel. No fue una decisión: a la de
        inscripciones le tocó el turno de rehacerse y a esta no.

        Con el componente compartido esas siete cosas vienen de fábrica
        y la caja sobra, que es lo que la dejaba «metida feo» al lado
        de su hermana. Las filas y las columnas son las mismas. */}
    <Tabla
      cuadricula
      id="asesores-academicos"
      columnas={columnas}
      filas={datos}
      clave={(f) => f.asesorId ?? "sin-asesor"}
      porPagina={25}
      vacio="Aquí aparece cada asesor en cuanto tenga grupos asignados con participantes."
    />
    </>
  );
}

/**
 * Las columnas de la pestaña académica.
 *
 * FUERA DEL COMPONENTE y no dentro: así se rehacen solo cuando cambia
 * el tramo con el que se compara, y no en cada pintado. La de
 * inscripciones sí vive dentro porque sus columnas cambian con la
 * acción elegida.
 *
 * `antesDe` devuelve la fila de ese mismo asesor en el otro periodo, o
 * NULO cuando no hay comparación puesta o cuando allí no estaba: un
 * cero diría que no certificó a nadie, y lo cierto es que no había
 * asesor que contar.
 */
const columnasAcademicas = (
  antesDe: (f: FilaDeAsesorAcademico) => FilaDeAsesorAcademico | null,
): Columna<FilaDeAsesorAcademico>[] => [
  {
    clave: "nombre",
    titulo: "Asesor",
    ancho: "230px",
    fija: true,
    valor: (f) => f.nombre,
    filtro: "texto",
    pinta: (f) => (
      <span className={f.asesorId ? "font-medium" : "font-medium text-texto-suave"}>
        {f.nombre}
      </span>
    ),
  },
  /// LAS CUATRO DE CONTEO COMPARAN. Meta global, fin del curso, meta
  /// diaria y estado no: son lo que falta, una fecha, un objetivo y
  /// un semáforo, y una flecha encima de cualquiera de ellos diría
  /// que se hizo más o menos trabajo cuando lo que cambió es otra
  /// cosa.
  {
    clave: "grupos",
    titulo: "Grupos",
    ancho: "90px",
    numerica: true,
    valor: (f) => f.grupos,
    pinta: (f) => (
      <span className="tabular-nums">
        <Cifra ahora={f.grupos} antes={antesDe(f)?.grupos ?? null} />
      </span>
    ),
  },
  {
    /// PAX Y NO «PARTICIPANTES»: es como lo llama el cliente y como
    /// está en la tira de cifras de arriba.
    clave: "pax",
    titulo: "PAX",
    ancho: "90px",
    numerica: true,
    valor: (f) => f.carga.total,
    pinta: (f) => (
      <span className="font-medium tabular-nums">
        <Cifra ahora={f.carga.total} antes={antesDe(f)?.carga.total ?? null} />
      </span>
    ),
  },
  {
    clave: "conSeguimiento",
    titulo: "Con seguimiento",
    ancho: "130px",
    numerica: true,
    valor: (f) => f.conSeguimiento,
    pinta: (f) => (
      <span className="tabular-nums">
        <Cifra ahora={f.conSeguimiento} antes={antesDe(f)?.conSeguimiento ?? null} />
      </span>
    ),
  },
  {
    clave: "certificados",
    titulo: "Certificados",
    ancho: "110px",
    numerica: true,
    valor: (f) => f.certificados,
    pinta: (f) => (
      <span className="font-semibold text-exito tabular-nums">
        <Cifra ahora={f.certificados} antes={antesDe(f)?.certificados ?? null} />
      </span>
    ),
  },
  {
    /// EN ROJO CUANDO QUEDA ALGUNO, que es a lo que se viene a esta
    /// tabla: con nueve columnas de números, el que decide tiene que
    /// saltar a la vista sin leerlas todas.
    clave: "porCertificar",
    /// La meta global de esta pestaña: lo que le falta certificar.
    titulo: "Meta global",
    ancho: "115px",
    numerica: true,
    valor: (f) => f.ritmo.pendientes,
    pinta: (f) => (
      <span
        className={
          "font-semibold tabular-nums " + (f.ritmo.pendientes > 0 ? "text-error" : "")
        }
      >
        {n(f.ritmo.pendientes)}
      </span>
    ),
  },
  {
    clave: "fin",
    titulo: "Fin del curso",
    ancho: "140px",
    valor: (f) => f.limite,
    pinta: (f) => (
      <span className="whitespace-nowrap tabular-nums">
        {dia(f.limite)}
        {f.ritmo.diasHabiles !== null && (
          <span className="block text-[0.6875rem] text-texto-suave">
            {f.ritmo.diasHabiles > 0
              ? `quedan ${n(f.ritmo.diasHabiles)} ${f.ritmo.diasHabiles === 1 ? "día hábil" : "días hábiles"}`
              : f.ritmo.diasHabiles === 0
                ? "hoy es el último"
                : `venció hace ${n(-f.ritmo.diasHabiles)} ${f.ritmo.diasHabiles === -1 ? "día hábil" : "días hábiles"}`}
          </span>
        )}
      </span>
    ),
  },
  {
    clave: "exigido",
    /// AQUÍ NO SE INSCRIBE, SE CERTIFICA. En esta pestaña «resuelto»
    /// es «certificado» ---lo dice `repartirAcademicos`---, así que
    /// «Promedio Cantidad inscripción» estaba nombrando una cosa por
    /// otra desde que existe la pestaña.
    titulo: "Meta diaria",
    ancho: "112px",
    numerica: true,
    valor: (f) => f.ritmo.exigidoPorDia,
    pinta: (f) => <span className="font-semibold tabular-nums">{metaDiaria(f.ritmo.exigidoPorDia)}</span>,
  },
  {
    clave: "estado",
    titulo: "Estado",
    ancho: "130px",
    valor: (f) => SEMAFORO[f.ritmo.estado].texto,
    filtro: "opciones",
    /// `nowrap` TAMBIÉN EN LA CELDA: solo en la cabecera, «Terminado»
    /// se partía en «Termina / do» y esa fila quedaba más alta que sus
    /// vecinas.
    pinta: (f) => (
      <span className={`whitespace-nowrap text-[0.75rem] font-semibold ${SEMAFORO[f.ritmo.estado].clase}`}>
        {SEMAFORO[f.ritmo.estado].texto}
      </span>
    ),
  },
];

/**
 * SUBVISTA 3: la proyección de inscripciones, por acción de formación.
 *
 * «Por AF, aquí el asesor pasa a segundo plano y lo macro viene a ser
 * la Acción de Formación, donde el sistema con base a los leads, ritmo
 * de inscripción y fechas de cierre e inicio me calcula cuántas deben
 * ser las inscripciones, leads necesarios y todo proceso estadístico»
 * (cliente, 26 sep 2026).
 *
 * CADA FILA CONTESTA UNA SOLA PREGUNTA: ¿esta acción llega a sus cupos
 * antes de que cierre? Las demás columnas son los pasos para llegar
 * ahí, y están a la vista a propósito: nadie tiene por qué creerse el
 * veredicto, se puede seguir la cuenta con el dedo.
 *
 * El cálculo vive en el servidor ---`proyeccion.ts`, con sus diez
 * pruebas--- y aquí solo se pinta. Repetirlo en la pantalla daría dos
 * cifras para la misma pregunta, que es el defecto que ya costó una
 * vuelta en Tráfico.
 */
function Proyeccion({ ventana, ventanaAntes, rotuloAnterior }: ConPeriodo) {
  /// Los dos periodos en la misma consulta, como en las otras tres.
  const cargar = useCallback(
    async (): Promise<{
      ahora: FilaDeProyeccion[];
      antes: FilaDeProyeccion[] | null;
      equipo: FilaDeAsesor[];
    }> => {
      /// EL EQUIPO VIENE EN LA MISMA CONSULTA. El cuadro de Dianita va
      /// por NOMBRE ---Julieth, Kathe---, no por un número: una meta
      /// con nombre se le pide a alguien, y una meta «entre dos
      /// asesores» no se le pide a nadie.
      const [ahora, antes, equipo] = await Promise.all([
        crmApi.proyeccionDeInscripciones(ventana),
        ventanaAntes ? crmApi.proyeccionDeInscripciones(ventanaAntes) : null,
        crmApi.asesoresDeInscripciones(ventana),
      ]);
      return { ahora, antes, equipo };
    },
    [ventana, ventanaAntes],
  );
  const vivos = useDatosVivos<{
    ahora: FilaDeProyeccion[];
    antes: FilaDeProyeccion[] | null;
    equipo: FilaDeAsesor[];
  }>(cargar, {
    clave: `proyeccion-${JSON.stringify(ventana)}-${JSON.stringify(ventanaAntes)}`,
  });

  /// EL # DE ASESORES Y LOS DÍAS LOS EDITA EL ADMIN, y nadie más:
  /// mover la meta que se le exige a cada asesor es del administrador.
  /// Quien no puede, ve las cifras y no los controles.
  const { admin } = useAdmin();
  const toast = useToast();
  const puedeEditar = alcanza(admin.permisos?.configuracion, "ESCRIBIR");

  /// EL BORRADOR: lo que se está tecleando en cada fila, SIN guardar.
  /// Josse lo pidió con botón «Guardar», no al instante: así puede
  /// tocar el # de asesores y los días de una acción y guardarlos
  /// juntos. Vive por `accionId` y sobrevive a la recarga automática,
  /// que no lo toca --pisaría lo que se escribe--.
  const [borrador, setBorrador] = useState<
    Record<string, { asesores?: string; dias?: string; cierre?: string }>
  >({});
  const [guardando, setGuardando] = useState<string | null>(null);

  const setCampo = useCallback(
    (accionId: string, campo: "asesores" | "dias" | "cierre", valor: string) => {
      setBorrador((b) => ({ ...b, [accionId]: { ...b[accionId], [campo]: valor } }));
    },
    [],
  );

  const guardarFila = useCallback(
    async (accionId: string) => {
      const cambios = borrador[accionId];
      if (!cambios) return;
      const aNumero = (v?: string) =>
        v === undefined ? undefined : v.trim() === "" ? null : Number(v);
      setGuardando(accionId);
      try {
        await crmApi.configurarProyeccion(accionId, {
          asesores: aNumero(cambios.asesores),
          dias: aNumero(cambios.dias),
          cierre:
            cambios.cierre === undefined
              ? undefined
              : cambios.cierre.trim() === ""
                ? null
                : cambios.cierre,
        });
        /// Guardado: se suelta el borrador y la tabla se refresca con
        /// los valores nuevos.
        setBorrador((b) => {
          const n = { ...b };
          delete n[accionId];
          return n;
        });
        vivos.refrescar();
        toast.exito("Guardado.");
      } catch (e) {
        toast.error((e as { message?: string }).message ?? "No se pudo guardar.");
      } finally {
        setGuardando(null);
      }
    },
    [borrador, vivos, toast],
  );

  const edicion: EdicionProyeccion = useMemo(
    () => ({ puedeEditar, borrador, setCampo, guardarFila, guardando }),
    [puedeEditar, borrador, setCampo, guardarFila, guardando],
  );

  /// La misma acción en el otro periodo, por su id. Una acción puede
  /// no estar allí ---nació después---: entonces no hay con qué
  /// comparar y no se pinta nada.
  const antesPorAccion = useMemo(
    () => new Map((vivos.datos?.antes ?? []).map((f) => [f.accionFormacionId, f])),
    [vivos.datos],
  );
  const comparando = vivos.datos?.antes != null;
  const columnas = useMemo(
    () =>
      columnasDeProyeccion(
        (f) =>
          comparando ? (antesPorAccion.get(f.accionFormacionId) ?? null) : null,
        edicion,
      ),
    [antesPorAccion, comparando, edicion],
  );

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto />;
  const datos = vivos.datos.ahora;
  if (datos.length === 0) {
    return (
      <Vacio titulo="Todavía no hay acciones con leads">
        Aquí aparece cada acción de formación en cuanto tenga gente detrás, con
        cuántos le faltan y si llega a tiempo.
      </Vacio>
    );
  }

  /// LA TIRA SE SUMA DE LAS MISMAS FILAS QUE SE PINTAN DEBAJO, como en
  /// las otras dos subvistas: con una consulta aparte, el total de
  /// arriba y la suma de la tabla podrían discrepar, y es lo primero
  /// que alguien comprueba.
  const t = datos.reduce(
    (a, f) => ({
      cupos: a.cupos + f.cupos,
      inscritos: a.inscritos + f.inscritos,
      faltan: a.faltan + f.faltan,
      porConseguir: a.porConseguir + f.leadsPorConseguir,
      enRiesgo:
        a.enRiesgo +
        (f.veredicto === "NO_LLEGA" || f.veredicto === "APRETADO" ? 1 : 0),
    }),
    { cupos: 0, inscritos: 0, faltan: 0, porConseguir: 0, enRiesgo: 0 },
  );

  /// Del tramo de antes solo se suma lo que se compara: los inscritos
  /// y cuántas acciones había.
  const antes = vivos.datos.antes;
  const inscritosAntes = antes
    ? antes.reduce((a, f) => a + f.inscritos, 0)
    : undefined;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <CifraCompacta
          etiqueta="Acciones"
          valor={n(datos.length)}
          pie={comparado(datos.length, antes?.length)}
        />
        {/* LOS CUPOS NO COMPARAN: es lo comprometido con el SENA y no
            cambia con el periodo. Una flecha ahí diría que subieron o
            bajaron cuando son los mismos. */}
        <CifraCompacta etiqueta="Meta de inscritos" valor={n(t.cupos)} />
        <CifraCompacta
          etiqueta="Inscritos"
          valor={n(t.inscritos)}
          color="var(--exito)"
          detalle={
            t.cupos > 0 ? `${Math.round((t.inscritos / t.cupos) * 100)} %` : undefined
          }
          pie={comparado(t.inscritos, inscritosAntes)}
        />
        <CifraCompacta
          etiqueta="Faltan"
          valor={n(t.faltan)}
          color={t.faltan > 0 ? "var(--error)" : undefined}
        />
        <CifraCompacta
          etiqueta="Leads que faltan"
          valor={n(t.porConseguir)}
          pie={t.enRiesgo > 0 ? `${n(t.enRiesgo)} acciones en riesgo` : undefined}
        />
      </div>

      {comparando && <ContraQue rotulo={rotuloAnterior} />}

      {/* QUÉ QUIERE DECIR CADA COLUMNA, PLEGADA.
          «Una tabla que hay que explicar de viva voz no está
          terminada», pero la explicación tampoco puede comerse media
          pantalla todos los días: «con clic despliegue y con clic
          oculte, ocupa mucho espacio» (cliente, 27 sep 2026). Cerrada
          es un renglón; se abre el día que hace falta. */}

      <Tabla
        cuadricula
        id="proyeccion-metas"
        columnas={columnas}
        filas={datos}
        clave={(f) => f.accionFormacionId}
        porPagina={25}
        vacio="Aquí aparece cada acción de formación en cuanto tenga gente detrás."
      />

      {/* EL CUADRO DE DIANITA YA NO ESTÁ AQUÍ: bajó a «Asesores de
          inscripciones» (cliente, 30 sep 2026). Nació colgado de esta
          tabla ---es de donde salen sus cifras--- pero la pantalla del
          equipo es la otra, y allí las dos mitades contestan la misma
          pregunta por los dos lados. Se movió, no se copió. */}
    </>
  );
}

/**
 * LO QUE ALIMENTA EL CUADRO DE DIANITA.
 *
 * Sale de las MISMAS filas que pinta la tabla de arriba ---no de otra
 * consulta--- y por eso las dos no pueden decir cosas distintas.
 *
 *   - LA META: todo lo que falta por cubrir, sumando las acciones.
 *   - EL CIERRE: el MÁS PRÓXIMO de todas, porque es el primero que
 *     obliga. Repartir hasta el más lejano daría una cifra diaria
 *     cómoda y falsa.
 *   - LOS ASESORES: los de verdad, con nombre.
 *
 * LAS ACCIONES CERRADAS O YA CUBIERTAS NO ENTRAN: ni suman lo que les
 * falta ---no les falta nada que se pueda hacer--- ni adelantan el
 * cierre. Sin esta regla, una acción vencida la semana pasada tiraría
 * el cierre hacia atrás y el cuadro no tendría ni un día donde
 * repartir.
 *
 * Y LA FILA «SIN ASESOR ASIGNADO» NO ES UNA PERSONA: no se le puede
 * pedir una meta. Contarla repartiría el trabajo entre un asesor de
 * más y dejaría a los de verdad por debajo de lo que les toca.
 */
function repartoDeLaProyeccion(
  filas: FilaDeProyeccion[],
  equipo: FilaDeAsesor[],
): {
  meta: number;
  cierre: Date | null;
  asesores: AsesorDelReparto[];
  /// Cuántas acciones entran en el reparto y cuántas se quedan
  /// fuera por tener el cierre vencido. Hacen falta para poder
  /// explicar en pantalla por qué esta cifra no es la de arriba.
  vigentes: number;
  vencidas: number;
  faltaEnVencidas: number;
} {
  /**
   * LA FECHA QUE FIJA EL ADMINISTRADOR MANDA SOBRE LA DEL CRONOGRAMA.
   *
   * Es la que él teclea en esta misma tabla, y existe justo para
   * cuando el cronograma se quedó viejo.
   */
  const cierreDe = (f: FilaDeProyeccion): Date | null => {
    const cuando = f.cierreProyeccion ?? f.cierre;
    if (!cuando) return null;
    const d = new Date(`${cuando}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  /**
   * QUÉ ACCIÓN ENTRA EN EL REPARTO, y por qué no se mira el veredicto.
   *
   * Mirarlo era lo primero que hice y estaba mal: el veredicto lo
   * calcula el servidor con la fecha del CRONOGRAMA, así que una
   * acción cuyo cronograma venció en julio sale «CERRADO» aunque el
   * administrador le haya puesto a mano un cierre en octubre. Con el
   * filtro por veredicto, esa acción se caía ANTES de que nadie
   * mirara su fecha nueva, y el cuadro decía «no hay fecha de cierre»
   * teniéndola a dos columnas de distancia. Lo vi en pruebas.
   *
   * Así que se juzga con la MISMA fecha con la que se va a repartir:
   * entra la que tenga algo que cubrir y un cierre que no haya
   * pasado.
   */
  const hoy = new Date();
  const vivas = filas.filter((f) => {
    if (f.faltan <= 0) return false;
    const d = cierreDe(f);
    return d !== null && d.getTime() >= hoy.getTime();
  });

  const meta = vivas.reduce((a, f) => a + f.faltan, 0);

  let cierre: Date | null = null;
  for (const f of vivas) {
    const d = cierreDe(f);
    if (d && (!cierre || d < cierre)) cierre = d;
  }

  const asesores = equipo
    .filter((a) => a.asesorId !== null)
    .map((a) => ({ id: a.asesorId as string, nombre: a.nombre }));

  /// LO QUE SE QUEDA FUERA, contado para decirlo.
  ///
  /// «Pilas, porque debe estar amarrado a esto» (cliente, 30 sep
  /// 2026). Lo está ---la meta sale de las mismas filas que pinta
  /// Proyección--- pero el cuadro dice 1.332 donde la tabla de
  /// arriba suma 3.965, y sin explicación eso parece un error. No lo
  /// es: trece de las quince acciones tienen el cierre vencido y no
  /// se pueden repartir entre días que ya pasaron. Repartirlas sería
  /// inventar un plazo.
  const fueraDePlazo = filas.filter((f) => f.faltan > 0 && !vivas.includes(f));

  return {
    meta,
    cierre,
    asesores,
    vigentes: vivas.length,
    vencidas: fueraDePlazo.length,
    faltaEnVencidas: fueraDePlazo.reduce((a, f) => a + f.faltan, 0),
  };
}

/**
 * Las columnas de la proyección, en el orden en que se leen.
 *
 * DE IZQUIERDA A DERECHA SE SIGUE EL RAZONAMIENTO: qué se prometió,
 * cuántos van, cuántos faltan, cuánto queda de plazo, a qué ritmo se
 * viene inscribiendo, dónde acaba eso, y solo al final el veredicto.
 * Puesto el veredicto primero, nadie mira el resto.
 *
 * AQUÍ SOLO COMPARA «Inscritos», y no por descuido: los cupos son lo
 * comprometido con el SENA y no se mueven con el periodo; «Faltan» y
 * «Leads que faltan» son lo que QUEDA por hacer, no lo hecho; «Cierra»
 * es una fecha; «Meta diaria» y «Terminará con» son un objetivo y una
 * previsión; «Conversión» es un porcentaje; y «Inscritos en 15 días»
 * es una ventana fija del servidor que no se mueve con este filtro.
 * De todas ellas, la única que cuenta hechos del periodo es la de
 * inscritos.
 */
type EdicionProyeccion = {
  puedeEditar: boolean;
  /// Lo que se está tecleando, sin guardar, por acción.
  borrador: Record<string, { asesores?: string; dias?: string; cierre?: string }>;
  setCampo: (
    accionId: string,
    campo: "asesores" | "dias" | "cierre",
    valor: string,
  ) => void;
  guardarFila: (accionId: string) => void;
  /// La acción que se está guardando ahora, para bloquear su fila.
  guardando: string | null;
};

const CLASE_CELDA_NUMERO =
  "w-16 rounded-lg border border-borde bg-superficie px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-marca disabled:opacity-50";

/**
 * La meta diaria y la meta por asesor, EN VIVO, con lo que se está
 * tecleando.
 *
 * Josse lo pidió así (29 sep 2026): «cuando yo cambie el # de
 * asesores deben cambiar automáticamente los otros datos». Así que la
 * cuenta se hace en el navegador con el BORRADOR ---lo que hay en los
 * campos ahora, guardado o no---, sin esperar al botón Guardar. Al
 * guardar, el servidor la rehace y manda; esto es la vista previa.
 *
 * Es la misma cuenta que `metasDeAccion` en el backend --cupos
 * disponibles / días, / asesores-- y se deja escrito para que si una
 * cambia, se cambie la otra. El backend sigue siendo el que manda: lo
 * guardado sale de él.
 */
function metasEnVivo(
  f: FilaDeProyeccion,
  borrador: { asesores?: string; dias?: string } | undefined,
): { metaDiaria: number | null; metaPorAsesor: number | null } {
  const num = (v: string | undefined, siNo: number | null): number | null =>
    v !== undefined && v.trim() !== "" ? Number(v) : siNo;
  /// Los días del borrador si se están tocando; si no, los efectivos
  /// que ya trae la fila (los guardados o los del cronograma).
  const dias = num(borrador?.dias, f.diasParaCierre);
  const asesores = num(borrador?.asesores, f.asesores);
  const cuposDisponibles = f.faltan;

  const metaDiaria = dias !== null && dias > 0 ? cuposDisponibles / dias : null;
  const metaPorAsesor =
    metaDiaria !== null && asesores !== null && asesores > 0
      ? metaDiaria / asesores
      : null;
  return { metaDiaria, metaPorAsesor };
}

/**
 * Una celda editable de número entero (# asesores o # días).
 *
 * NO guarda sola: escribe en el BORRADOR de su fila y se guarda con el
 * botón «Guardar», como pidió Josse. El valor que enseña es el del
 * borrador si se está tocando, si no el guardado. Así la recarga
 * automática no pisa lo que se escribe.
 */
function CeldaNumero({
  accionId,
  campo,
  guardado,
  edicion,
  etiqueta,
  placeholder,
}: {
  accionId: string;
  campo: "asesores" | "dias";
  guardado: number | null;
  edicion: EdicionProyeccion;
  etiqueta: string;
  placeholder?: string;
}) {
  if (!edicion.puedeEditar) {
    return (
      <span className="tabular-nums">
        {guardado === null ? "—" : n(guardado)}
      </span>
    );
  }
  const enBorrador = edicion.borrador[accionId]?.[campo];
  const valor = enBorrador ?? (guardado === null ? "" : String(guardado));
  return (
    <input
      type="number"
      min={1}
      inputMode="numeric"
      aria-label={etiqueta}
      className={CLASE_CELDA_NUMERO}
      value={valor}
      disabled={edicion.guardando === accionId}
      placeholder={placeholder ?? "—"}
      onChange={(e) => edicion.setCampo(accionId, campo, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") edicion.guardarFila(accionId);
      }}
    />
  );
}

/**
 * Una celda editable de FECHA (fecha de cierre).
 *
 * Como las de número: escribe en el borrador y se guarda con el
 * botón. Vacía = usa la del cronograma, que va de hint debajo.
 */
function CeldaFecha({
  accionId,
  guardado,
  delCronograma,
  edicion,
}: {
  accionId: string;
  guardado: string | null;
  delCronograma: string | null;
  edicion: EdicionProyeccion;
}) {
  if (!edicion.puedeEditar) {
    return guardado ? (
      <span>{dia(guardado)}</span>
    ) : delCronograma ? (
      <span>{dia(delCronograma)}</span>
    ) : (
      <span className="text-aviso">Sin fecha</span>
    );
  }
  const enBorrador = edicion.borrador[accionId]?.cierre;
  const valor = enBorrador ?? guardado ?? "";
  return (
    <span className="block">
      <input
        type="date"
        aria-label="Fecha de cierre"
        className="rounded-lg border border-borde bg-superficie px-2 py-1 text-sm outline-none focus:border-marca disabled:opacity-50"
        value={valor}
        disabled={edicion.guardando === accionId}
        onChange={(e) => edicion.setCampo(accionId, "cierre", e.target.value)}
      />
      {valor === "" && delCronograma && (
        <span className="mt-0.5 block text-xs text-texto-suave">
          cronograma: {dia(delCronograma)}
        </span>
      )}
    </span>
  );
}

/**
 * El botón «Guardar» de la fila.
 *
 * Solo se enciende cuando esa fila tiene algo sin guardar; guarda el #
 * de asesores y los días juntos. Sin cambios pendientes no hay nada
 * que hacer, así que no distrae.
 */
function BotonGuardarFila({
  accionId,
  edicion,
}: {
  accionId: string;
  edicion: EdicionProyeccion;
}) {
  if (!edicion.puedeEditar) return null;
  const hayCambios = edicion.borrador[accionId] !== undefined;
  const guardando = edicion.guardando === accionId;
  return (
    <button
      type="button"
      disabled={!hayCambios || guardando}
      onClick={() => edicion.guardarFila(accionId)}
      className={
        "rounded-lg px-3 py-1 text-sm font-semibold transition " +
        (hayCambios
          ? "bg-marca text-marca-texto hover:bg-marca-fuerte"
          : "cursor-default border border-borde text-texto-suave opacity-60")
      }
    >
      {guardando ? "Guardando…" : "Guardar"}
    </button>
  );
}

const columnasDeProyeccion = (
  antesDe: (f: FilaDeProyeccion) => FilaDeProyeccion | null,
  edicion: EdicionProyeccion,
): Columna<FilaDeProyeccion>[] => [
  {
    clave: "accion",
    titulo: "Acción de formación",
    ancho: "260px",
    valor: (f) => `${f.codigo ?? ""} ${f.nombre ?? ""}`.trim(),
    /// SE AJUSTA A LA CELDA, no se corta. «El texto se ajuste a la
    /// celda porque queda cortado si ajusto el tamaño de la columna»
    /// (cliente, 27 sep 2026). Con `truncate` el nombre desaparecía
    /// detrás de unos puntos suspensivos y estrechar la columna no
    /// servía de nada; ahora reparte en los renglones que haga falta.
    /// El código, sin partirse: «AF» en una línea y «3» en la
    /// siguiente era lo que se veía.
    pinta: (f) => (
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 font-mono text-xs whitespace-nowrap text-texto-suave">
          {f.codigo}
        </span>
        <span className="min-w-0 break-words whitespace-normal">{f.nombre}</span>
      </span>
    ),
  },
  /// EL ORDEN Y LAS COLUMNAS SON LOS DE LA HOJA DE JOSSE (29 sep
  /// 2026). Lo que Andrés traía de más ---Cierra, Inscritos en 15
  /// días, Terminará con, Leads que faltan, ¿Alcanza?--- no se borra:
  /// baja a `aparte`, así que sigue en el selector de columnas para
  /// quien la quiera, pero de entrada se ve la tabla que él pidió.
  {
    clave: "cupos",
    /// LA META DE INSCRITOS es el TOPE, con el 30% ---520, no 400---.
    titulo: "Meta de inscritos",
    ancho: "130px",
    numerica: true,
    valor: (f) => f.cupos,
    pinta: (f) => <span className="tabular-nums">{n(f.cupos)}</span>,
  },
  {
    clave: "inscritos",
    titulo: "Inscritos confirmados",
    ancho: "150px",
    numerica: true,
    valor: (f) => f.inscritos,
    pinta: (f) => (
      <span className="font-medium text-exito tabular-nums">
        <Cifra ahora={f.inscritos} antes={antesDe(f)?.inscritos ?? null} />
      </span>
    ),
  },
  {
    clave: "faltan",
    /// CUPOS DISPONIBLES = meta − confirmados. Es lo que falta.
    titulo: "Cupos disponibles",
    ancho: "130px",
    numerica: true,
    valor: (f) => f.faltan,
    pinta: (f) => (
      <span
        className={"font-semibold tabular-nums " + (f.faltan > 0 ? "text-error" : "")}
      >
        {n(f.faltan)}
      </span>
    ),
  },
  {
    /// EL # DE ASESORES, a mano. La meta por asesor sale de dividir la
    /// meta diaria entre este número.
    clave: "asesores",
    titulo: "# asesores",
    ancho: "108px",
    numerica: true,
    valor: (f) => f.asesores ?? 0,
    pinta: (f) => (
      <CeldaNumero
        accionId={f.accionFormacionId}
        campo="asesores"
        guardado={f.asesores}
        edicion={edicion}
        etiqueta="Número de asesores"
      />
    ),
  },
  {
    /// LOS DÍAS PARA EL CIERRE, un número que él teclea (como en su
    /// hoja), no una fecha. Vacío = usa los que quedan según el
    /// cronograma, que van de hint en el placeholder.
    clave: "dias",
    titulo: "# días para el cierre",
    ancho: "150px",
    numerica: true,
    valor: (f) => f.diasConfigurados ?? f.diasParaCierre ?? 0,
    pinta: (f) => (
      <CeldaNumero
        accionId={f.accionFormacionId}
        campo="dias"
        guardado={f.diasConfigurados}
        edicion={edicion}
        etiqueta="Días para el cierre"
        placeholder={
          f.diasParaCierre !== null && f.diasParaCierre > 0
            ? String(f.diasParaCierre)
            : "—"
        }
      />
    ),
  },
  {
    /// LA META DIARIA: cupos disponibles / días para el cierre.
    /// Se recalcula EN VIVO con lo que se está tecleando, no con lo
    /// guardado, para que cambie sola al tocar los días. Redondeada
    /// de la flotante ---520/7 = 74,3 se ve «74»---. Sin días, «—».
    clave: "metaDiaria",
    titulo: "Meta diaria",
    ancho: "110px",
    numerica: true,
    valor: (f) =>
      metasEnVivo(f, edicion.borrador[f.accionFormacionId]).metaDiaria ?? 0,
    pinta: (f) => {
      const { metaDiaria } = metasEnVivo(f, edicion.borrador[f.accionFormacionId]);
      return (
        <span className="font-semibold tabular-nums">
          {metaDiaria === null ? "—" : n(Math.round(metaDiaria))}
        </span>
      );
    },
  },
  {
    /// LA META DE CADA ASESOR: meta diaria / # asesores. También EN
    /// VIVO: al cambiar el # de asesores, esta cambia sola. Nula sin
    /// asesores ---que NO es cero: es que falta ponerlo---.
    clave: "metaPorAsesor",
    titulo: "Meta por asesor",
    ancho: "130px",
    numerica: true,
    valor: (f) =>
      metasEnVivo(f, edicion.borrador[f.accionFormacionId]).metaPorAsesor ?? 0,
    pinta: (f) => {
      const { metaPorAsesor } = metasEnVivo(
        f,
        edicion.borrador[f.accionFormacionId],
      );
      return (
        <span className="font-semibold text-marca tabular-nums">
          {metaPorAsesor === null ? "—" : n(Math.round(metaPorAsesor))}
        </span>
      );
    },
  },
  {
    clave: "conversion",
    titulo: "% conversión",
    ancho: "118px",
    numerica: true,
    valor: (f) => f.conversion,
    pinta: (f) => (
      <span className="tabular-nums">
        {Math.round(f.conversion * 100)} %
        {/* DE DÓNDE SALE, cuando no sale de ella misma. Con menos de
            veinte leads su propia conversión no significa nada, así
            que se usa el promedio general; decirlo evita que alguien
            la compare con las demás creyendo que es suya. */}
        {!f.conversionPropia && (
          <span className="block text-xs text-texto-suave">del promedio</span>
        )}
      </span>
    ),
  },
  {
    /// LA FECHA DE CIERRE, EDITABLE E INDEPENDIENTE (Josse, 29 sep):
    /// los tres --# asesores, # días y fecha-- se editan. Es de
    /// referencia; los días son los que manejan la meta. Vacía = la
    /// del cronograma.
    clave: "fechaCierre",
    titulo: "Fecha de cierre",
    ancho: "150px",
    valor: (f) => f.cierreProyeccion ?? f.cierre ?? "",
    pinta: (f) => (
      <CeldaFecha
        accionId={f.accionFormacionId}
        guardado={f.cierreProyeccion}
        delCronograma={f.cierre}
        edicion={edicion}
      />
    ),
  },
  {
    /// EL BOTÓN GUARDAR de la fila. Fija: no se puede quitar, porque
    /// sin él no hay cómo guardar lo que se edita.
    clave: "guardar",
    /// CON TÍTULO: «¿acá cuál es el título?» (cliente, 1 oct 2026).
    /// Una columna sin rótulo deja el hueco de la cabecera en blanco
    /// y parece que falta algo, sobre todo con la cuadrícula puesta.
    titulo: "Guardar cambios",
    ancho: "128px",
    fija: true,
    valor: () => "",
    pinta: (f) => (
      <BotonGuardarFila accionId={f.accionFormacionId} edicion={edicion} />
    ),
  },
  /// Y NADA MÁS. Son EXACTAMENTE las columnas de la hoja de Josse:
  /// «solo se necesitan esos datos» (29 sep 2026). Las que traía
  /// Andrés ---Cierra, Inscritos en 15 días, Terminará con, Leads que
  /// faltan, ¿Alcanza?--- se quitaron de esta tabla. El backend las
  /// sigue calculando (viajan en la fila), así que devolver una es
  /// una línea el día que se pida.
];

/**
 * SUBVISTA 4: la proyección académica, por acción de formación.
 *
 * La misma pregunta que su hermana, con OTRO RELOJ. Allí corre el
 * cierre de inscripciones y se pregunta si la acción llena sus cupos;
 * aquí corre el FIN DEL CURSO y se pregunta si certifica a su gente.
 *
 * Y otro denominador: no los cupos comprometidos sino quién está
 * dentro del aula. A quien nunca entró no se le puede certificar, y
 * meterlo en la cuenta daría un porcentaje que no significa nada.
 *
 * COMPARTE EL VEREDICTO con la otra a propósito: «Llega», «Apretado» y
 * «No llega» quieren decir lo mismo en las dos tablas. Dos escalas
 * parecidas pero distintas en la misma pantalla es como se acaba
 * comparando lo que no se puede comparar.
 */
function ProyeccionAcademica({ ventana, ventanaAntes, rotuloAnterior }: ConPeriodo) {
  /// Los dos periodos en la misma consulta, como en las otras tres.
  const cargar = useCallback(
    async (): Promise<{
      ahora: FilaDeProyeccionAcademica[];
      antes: FilaDeProyeccionAcademica[] | null;
    }> => {
      const [ahora, antes] = await Promise.all([
        crmApi.proyeccionAcademica(ventana),
        ventanaAntes ? crmApi.proyeccionAcademica(ventanaAntes) : null,
      ]);
      return { ahora, antes };
    },
    [ventana, ventanaAntes],
  );
  const vivos = useDatosVivos<{
    ahora: FilaDeProyeccionAcademica[];
    antes: FilaDeProyeccionAcademica[] | null;
  }>(cargar, {
    clave: `proyeccion-academica-${JSON.stringify(ventana)}-${JSON.stringify(ventanaAntes)}`,
  });

  const antesPorAccion = useMemo(
    () => new Map((vivos.datos?.antes ?? []).map((f) => [f.accionFormacionId, f])),
    [vivos.datos],
  );
  const comparando = vivos.datos?.antes != null;
  const columnas = useMemo(
    () =>
      columnasDeProyeccionAcademica((f) =>
        comparando ? (antesPorAccion.get(f.accionFormacionId) ?? null) : null,
      ),
    [antesPorAccion, comparando],
  );

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto />;
  const datos = vivos.datos.ahora;
  if (datos.length === 0) {
    return (
      <Vacio titulo="Todavía no hay nadie en el aula">
        Aquí aparece cada acción de formación en cuanto tenga gente dentro, con
        cuántos le faltan por certificar y si llega antes de que acabe el curso.
      </Vacio>
    );
  }

  const t = datos.reduce(
    (a, f) => ({
      enElAula: a.enElAula + f.enElAula,
      certificados: a.certificados + f.certificados,
      porCertificar: a.porCertificar + f.porCertificar,
      salieron: a.salieron + f.salieron,
      enRiesgo:
        a.enRiesgo +
        (f.veredicto === "NO_LLEGA" || f.veredicto === "APRETADO" ? 1 : 0),
    }),
    { enElAula: 0, certificados: 0, porCertificar: 0, salieron: 0, enRiesgo: 0 },
  );

  /// Del tramo de antes, solo lo que se compara.
  const antes = vivos.datos.antes;
  const tAntes = antes
    ? antes.reduce(
        (a, f) => ({
          enElAula: a.enElAula + f.enElAula,
          certificados: a.certificados + f.certificados,
          salieron: a.salieron + f.salieron,
        }),
        { enElAula: 0, certificados: 0, salieron: 0 },
      )
    : null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <CifraCompacta
          etiqueta="Acciones"
          valor={n(datos.length)}
          pie={comparado(datos.length, antes?.length)}
        />
        <CifraCompacta
          etiqueta="En el aula"
          valor={n(t.enElAula)}
          pie={comparado(t.enElAula, tAntes?.enElAula)}
        />
        <CifraCompacta
          etiqueta="Certificados"
          valor={n(t.certificados)}
          color="var(--exito)"
          detalle={
            t.enElAula > 0
              ? `${Math.round((t.certificados / t.enElAula) * 100)} %`
              : undefined
          }
          pie={comparado(t.certificados, tAntes?.certificados)}
        />
        <CifraCompacta
          etiqueta="Por certificar"
          valor={n(t.porCertificar)}
          color={t.porCertificar > 0 ? "var(--error)" : undefined}
          pie={t.enRiesgo > 0 ? `${n(t.enRiesgo)} acciones en riesgo` : undefined}
        />
        {/* SALIERON, aparte y sin color de alarma: no son pendientes
            que se puedan recuperar, y meterlos con los otros haría
            que la meta diaria pidiera un imposible. */}
        <CifraCompacta
          etiqueta="Ya no certifican"
          valor={n(t.salieron)}
          pie={comparado(t.salieron, tAntes?.salieron)}
        />
      </div>

      {comparando && <ContraQue rotulo={rotuloAnterior} />}


      <Tabla
        cuadricula
        id="proyeccion-academica"
        columnas={columnas}
        filas={datos}
        clave={(f) => f.accionFormacionId}
        porPagina={25}
        vacio="Aquí aparece cada acción en cuanto tenga gente en el aula."
      />
    </>
  );
}

/**
 * COMPARAN LAS TRES DE CONTEO: quién entró al aula, quién se certificó
 * y quién ya no va a certificar. «Por certificar» es lo que QUEDA,
 * «Termina el curso» es una fecha, «Meta diaria» un objetivo,
 * «Terminará con» una previsión y «Certificados en 15 días» una
 * ventana fija del servidor que este filtro no mueve: ninguna cuenta
 * hechos del periodo, así que ninguna lleva flecha.
 */
const columnasDeProyeccionAcademica = (
  antesDe: (f: FilaDeProyeccionAcademica) => FilaDeProyeccionAcademica | null,
): Columna<FilaDeProyeccionAcademica>[] => [
  {
    clave: "accion",
    titulo: "Acción de formación",
    ancho: "260px",
    valor: (f) => `${f.codigo ?? ""} ${f.nombre ?? ""}`.trim(),
    pinta: (f) => (
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 font-mono text-xs whitespace-nowrap text-texto-suave">
          {f.codigo}
        </span>
        <span className="min-w-0 break-words whitespace-normal">{f.nombre}</span>
      </span>
    ),
  },
  {
    clave: "enElAula",
    titulo: "En el aula",
    ancho: "100px",
    numerica: true,
    valor: (f) => f.enElAula,
    pinta: (f) => (
      <span className="tabular-nums">
        <Cifra ahora={f.enElAula} antes={antesDe(f)?.enElAula ?? null} />
      </span>
    ),
  },
  {
    clave: "certificados",
    titulo: "Certificados",
    ancho: "112px",
    numerica: true,
    valor: (f) => f.certificados,
    pinta: (f) => (
      <span className="font-medium text-exito tabular-nums">
        <Cifra ahora={f.certificados} antes={antesDe(f)?.certificados ?? null} />
      </span>
    ),
  },
  {
    clave: "porCertificar",
    titulo: "Por certificar",
    ancho: "118px",
    numerica: true,
    valor: (f) => f.porCertificar,
    pinta: (f) => (
      <span
        className={
          "font-semibold tabular-nums " + (f.porCertificar > 0 ? "text-error" : "")
        }
      >
        {n(f.porCertificar)}
      </span>
    ),
  },
  {
    clave: "salieron",
    titulo: "Ya no certifican",
    ancho: "130px",
    numerica: true,
    valor: (f) => f.salieron,
    pinta: (f) => (
      <span className="tabular-nums text-texto-suave">
        <Cifra ahora={f.salieron} antes={antesDe(f)?.salieron ?? null} />
      </span>
    ),
  },
  {
    clave: "finDelCurso",
    titulo: "Termina el curso",
    ancho: "158px",
    valor: (f) => f.finDelCurso ?? "",
    pinta: (f) =>
      f.finDelCurso ? (
        <span>
          {dia(f.finDelCurso)}
          <span className="block text-xs text-texto-suave">
            {f.diasRestantes === null
              ? ""
              : f.diasRestantes > 0
                ? `quedan ${n(f.diasRestantes)} días de trabajo`
                : `terminó hace ${n(-f.diasRestantes)} días`}
          </span>
        </span>
      ) : (
        <span className="text-aviso">Sin fecha de fin</span>
      ),
  },
  {
    clave: "metaDiaria",
    titulo: "Meta diaria",
    ancho: "110px",
    numerica: true,
    valor: (f) => f.metaDiaria,
    pinta: (f) => (
      <span className="font-semibold tabular-nums">
        {f.metaDiaria === null ? "—" : n(f.metaDiaria)}
      </span>
    ),
  },
  {
    clave: "ritmo",
    titulo: "Certificados en 15 días",
    ancho: "165px",
    numerica: true,
    valor: (f) => f.certificadosVentana,
    pinta: (f) => <span className="tabular-nums">{n(f.certificadosVentana)}</span>,
  },
  {
    clave: "proyeccion",
    titulo: "Terminará con",
    ancho: "125px",
    numerica: true,
    valor: (f) => f.proyeccion,
    pinta: (f) => (
      <span
        className={
          "font-semibold tabular-nums " +
          (f.proyeccion >= f.enElAula - f.salieron ? "text-exito" : "text-error")
        }
      >
        {n(f.proyeccion)}
      </span>
    ),
  },
  {
    clave: "veredicto",
    titulo: "¿Alcanza?",
    ancho: "112px",
    valor: (f) => VEREDICTO[f.veredicto].texto,
    filtro: "opciones",
    pinta: (f) => (
      <span className="font-medium" style={{ color: VEREDICTO[f.veredicto].color }}>
        {VEREDICTO[f.veredicto].texto}
      </span>
    ),
  },
];
