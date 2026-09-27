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

import Link from "next/link";
import { useCallback, useState } from "react";

import {
  crmApi,
  type FilaDeAsesor,
  type FilaDeAsesorAcademico,
  type FilaDeProyeccion,
  type VentanaDeLlegada,
  type Veredicto,
  type RitmoDeAsesor,
} from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

import { DesgloseDelAsesor } from "./desglose-del-asesor";
import {
  FiltroDePeriodo,
  PERIODO_INICIAL,
  ventanaDe,
  type Periodo,
} from "./filtro-de-periodo";
import { n } from "./graficos";
import { Aviso } from "./marco-admin";
import { SelectorBuscable } from "./selector-buscable";
import { CifraCompacta, Encabezado, Esqueleto, Vacio } from "./piezas";
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

type Subvista = "inscripciones" | "academicos" | "proyeccion";

/// SIN FRASE AL LADO (cliente, 23 sep 2026). Cada tabla ya dice contra
/// qué fecha corre en su propia descripción y en su pie; repetirlo
/// arriba costaba un renglón y no añadía nada.
const SUBVISTAS: Array<{ clave: Subvista; etiqueta: string }> = [
  { clave: "inscripciones", etiqueta: "Asesores de inscripciones" },
  { clave: "academicos", etiqueta: "Asesores académicos" },
  /// LA TERCERA, y aquí el asesor pasa a segundo plano: lo macro es
  /// la acción de formación. Las dos de arriba contestan «¿quién va
  /// mal?»; esta, «¿esta acción llega a sus cupos antes de cerrar?».
  { clave: "proyeccion", etiqueta: "Proyección Inscripciones" },
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

export function PanelAsesores() {
  const [subvista, setSubvista] = useState<Subvista>("inscripciones");

  /// EL PERIODO VIVE AQUÍ, NO DENTRO DE CADA SUBVISTA: «en todos los
  /// tableros debo tener filtros» (cliente, 27 sep 2026), y un filtro
  /// que se reinicia al cambiar de pestaña obliga a elegirlo tres
  /// veces para comparar las tres caras del mismo mes.
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_INICIAL);

  /// SE DICE LA VERDAD: NINGUNA DE LAS TRES SE RECORTA TODAVÍA.
  ///
  /// «Deben funcionar porque lo probé y no es así» (cliente, 27 sep
  /// 2026) fue precisamente esta queja, y recortar en la pantalla no
  /// la arregla: los tres endpoints ---`asesores/inscripciones`,
  /// `asesores/academicos` y `asesores/proyeccion`--- no aceptan
  /// filtros, y sus filas NO traen ninguna fecha de llegada por la que
  /// cortar. `limite` y `cierre` son plazos, no cuándo entró la gente;
  /// filtrar por ellos daría un número que nadie pidió con el rótulo
  /// de otro, que es peor que no filtrar.
  ///
  /// Así que el control se pinta ---ya queda puesto para cuando el
  /// servidor acepte `llegoDesde`/`llegoHasta`--- y debajo se avisa.
  /// Decirlo cuesta un renglón; que el usuario crea que filtró cuesta
  /// una decisión tomada sobre cifras equivocadas.
  const ventana = ventanaDe(periodo);
  const sinRecortar = ventana.llegoDesde !== undefined;

  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-6 [&>header]:mx-0 [&>header]:mb-0">
      {/* SIN FRASE DEBAJO DEL TÍTULO (cliente, 23 sep 2026). Cada
          bloque ya dice lo suyo, y una segunda explicación arriba
          costaba veinte píxeles de alto en todas las pantallas. */}
      <Encabezado compacto titulo="Seguimiento de asesores" />

      {/* LAS DOS SUBVISTAS, EN UNA SOLA FILA con su frase al lado.
          Iba debajo, a todo el ancho, y eso partía la caja en dos
          renglones para decir siete palabras: espacio vertical que se
          gana sin perder nada. */}
      {/* EL PERIODO, EN LA MISMA CAJA QUE LAS SUBVISTAS y no en una
          tarjeta propia: es un solo control para las tres, y en su
          propio bloque se leería como si fuera de la pestaña abierta.
          Con `justify-between` el selector queda a la izquierda y el
          periodo a la derecha; en pantalla estrecha el `wrap` lo baja
          a su propio renglón. */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-borde bg-superficie px-2 py-1.5">
        <div className="flex flex-wrap gap-1">
          {SUBVISTAS.map((s) => (
            <button
              key={s.clave}
              type="button"
              onClick={() => setSubvista(s.clave)}
              className={
                "rounded-lg px-3 py-1 text-[0.8125rem] font-medium transition " +
                (subvista === s.clave
                  ? "bg-marca text-marca-texto"
                  : "text-texto-suave hover:bg-superficie-alterna hover:text-texto")
              }
            >
              {s.etiqueta}
            </button>
          ))}
        </div>

        <FiltroDePeriodo periodo={periodo} alCambiar={setPeriodo} />
      </div>

      {/* LA VENTANA BAJA A LAS TRES. Se pasa el objeto ya resuelto y
          no el periodo: así la subvista no tiene que saber qué es
          «el mes pasado», solo pedir lo que le digan. */}
      {subvista === "inscripciones" && <DeInscripciones ventana={ventana} />}
      {subvista === "academicos" && <Academicos ventana={ventana} />}
      {subvista === "proyeccion" && <Proyeccion ventana={ventana} />}
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

function DeInscripciones({ ventana }: { ventana: VentanaDeLlegada }) {
  /// La clave lleva el periodo dentro: sin eso, cambiarlo no vuelve
  /// a pedir y la tabla se queda enseñando el periodo de antes.
  const cargar = useCallback(() => crmApi.asesoresDeInscripciones(ventana), [ventana]);
  const vivos = useDatosVivos<FilaDeAsesor[]>(cargar, {
    clave: `asesores-inscripciones-${JSON.stringify(ventana)}`,
  });

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
  if (vivos.datos.length === 0) {
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
      vivos.datos
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

  const filas: Vista[] = vivos.datos
    .map((f) => {
      if (!accion) {
        return {
          ...f,
          visto: {
            total: f.carga.total,
            gestionados: f.carga.gestionados,
            resueltos: f.carga.resueltos,
            inscritos: f.inscritos ?? 0,
            descartados: f.descartados ?? 0,
            pendientes: f.ritmo.pendientes,
          },
        };
      }
      const suya = (f.porAccion ?? []).find((a) => a.accionFormacionId === accion);
      /// Sin carga en esa acción, el asesor no sale: la pregunta es
      /// «quién lleva esto», y una fila de ceros la contesta mal.
      if (!suya) return null;
      return {
        ...f,
        visto: {
          total: suya.total,
          gestionados: suya.gestionados,
          resueltos: suya.resueltos,
          inscritos: suya.inscritos,
          descartados: suya.descartados,
          pendientes: suya.pendientes,
        },
      };
    })
    .filter((f): f is Vista => f !== null);

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
    {
      clave: "total",
      titulo: "Leads asignados",
      ancho: "130px",
      numerica: true,
      valor: (f) => f.visto.total,
    },
    {
      clave: "gestionados",
      titulo: "Gestionados",
      ancho: "118px",
      numerica: true,
      valor: (f) => f.visto.gestionados,
    },
    /// DOS COLUMNAS Y NO UNA (cliente, 26 sep 2026: «esto es
    /// separado, o sea una columna Inscritos y en otro Descartados»).
    /// Juntas sumaban bien y no decían nada: quince resueltos pueden
    /// ser quince inscritos o quince caídos, y son dos
    /// conversaciones distintas con el asesor.
    {
      clave: "inscritos",
      titulo: "Inscritos",
      ancho: "110px",
      numerica: true,
      valor: (f) => f.visto.inscritos,
      pinta: (f) => (
        <span className="font-medium text-exito tabular-nums">{n(f.visto.inscritos)}</span>
      ),
    },
    {
      clave: "descartados",
      titulo: "Descartados",
      ancho: "118px",
      numerica: true,
      valor: (f) => f.visto.descartados,
      pinta: (f) => (
        <span className="tabular-nums text-texto-suave">{n(f.visto.descartados)}</span>
      ),
    },
    {
      clave: "pendientes",
      /// LA META GLOBAL. Es la que se llamaba «Pendientes»: lo que
      /// le falta por resolver antes de su fecha, que es exactamente
      /// «el total que debe lograr». No se añade otra columna al lado
      /// porque sería el mismo número dos veces, y dos columnas con
      /// la misma cifra y distinto nombre se acaban comparando.
      titulo: "Meta global",
      ancho: "112px",
      numerica: true,
      valor: (f) => f.visto.pendientes,
      pinta: (f) => (
        <span
          className={
            "font-semibold tabular-nums " + (f.visto.pendientes > 0 ? "text-error" : "")
          }
        >
          {n(f.visto.pendientes)}
        </span>
      ),
    },
    {
      clave: "antiguedad",
      titulo: "Antigüedad media",
      ancho: "135px",
      numerica: true,
      valor: (f) => f.antiguedadMedia,
      pinta: (f) => (
        <span className="tabular-nums">
          {f.antiguedadMedia === null ? "—" : `${n(Math.round(f.antiguedadMedia))} d`}
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
      <CifraCompacta etiqueta="Leads asignados" valor={n(t.total)} />
      <CifraCompacta
        etiqueta="Gestionados"
        valor={n(t.gestionados)}
        detalle={t.total > 0 ? `${Math.round((t.gestionados / t.total) * 100)} %` : undefined}
      />
      {/* LOS MISMOS NOMBRES QUE LAS COLUMNAS DE DEBAJO. Se habían
          quedado con los de antes de partir la columna y de renombrar
          las metas: la tira decía «Inscritos y descartados» y la
          tabla, justo debajo, los daba por separado. */}
      <CifraCompacta etiqueta="Inscritos" valor={n(t.inscritos)} color="var(--exito)" />
      <CifraCompacta etiqueta="Descartados" valor={n(t.descartados)} />
      <CifraCompacta
        etiqueta="Meta global"
        valor={n(t.pendientes)}
        color={t.pendientes > 0 ? "var(--error)" : undefined}
      />
    </div>

    {/* LA TABLA, SUELTA EN LA PÁGINA. «Que quede como la segunda
        captura» (cliente, 25 sep 2026), que era Gestión de leads:
        allí el buscador, los filtros y la descarga van sobre el fondo
        y la tabla debajo. Aquí estaban metidos dentro de una caja con
        borde, y esa caja es la que hacía que se vieran «metidos feo».

        Es la misma `Tabla` de Gestión de leads --con su buscador, sus
        filtros por columna, el selector de columnas y la descarga--,
        así que montada igual se ve igual. */}
    <Tabla
      id="asesores-inscripciones"
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

    {desglosado && (
      <DesgloseDelAsesor fila={desglosado} alCerrar={() => setDesglosado(null)} />
    )}
    </>
  );
}

function Academicos({ ventana }: { ventana: VentanaDeLlegada }) {
  const cargar = useCallback(() => crmApi.asesoresAcademicos(ventana), [ventana]);
  const vivos = useDatosVivos<FilaDeAsesorAcademico[]>(cargar, {
    clave: `asesores-academicos-${JSON.stringify(ventana)}`,
  });

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto />;
  if (vivos.datos.length === 0) {
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
  const nadieAsignado = vivos.datos.every((f) => f.asesorId === null);

  /// La misma tira de arriba, con lo que se mide en académica.
  const t = vivos.datos.reduce(
    (a, f) => ({
      grupos: a.grupos + f.grupos,
      pax: a.pax + f.carga.total,
      seguimiento: a.seguimiento + f.conSeguimiento,
      certificados: a.certificados + f.certificados,
      porCertificar: a.porCertificar + f.ritmo.pendientes,
    }),
    { grupos: 0, pax: 0, seguimiento: 0, certificados: 0, porCertificar: 0 },
  );

  return (
    <>
    <div className="flex flex-wrap gap-2">
      <CifraCompacta etiqueta="Grupos" valor={n(t.grupos)} />
      <CifraCompacta etiqueta="PAX" valor={n(t.pax)} />
      <CifraCompacta
        etiqueta="Con seguimiento"
        valor={n(t.seguimiento)}
        detalle={t.pax > 0 ? `${Math.round((t.seguimiento / t.pax) * 100)} %` : undefined}
      />
      <CifraCompacta
        etiqueta="Certificados"
        valor={n(t.certificados)}
        color="var(--exito)"
        detalle={t.pax > 0 ? `${Math.round((t.certificados / t.pax) * 100)} %` : undefined}
      />
      <CifraCompacta
        etiqueta="Por certificar"
        valor={n(t.porCertificar)}
        color={t.porCertificar > 0 ? "var(--error)" : undefined}
      />
    </div>

    {nadieAsignado && (
      <div className="rounded-lg border border-aviso/30 bg-aviso-suave p-3.5 text-[0.8125rem] text-texto">
        <p className="font-semibold text-titulo">
          Ningún grupo tiene asesor académico asignado todavía.
        </p>
        <p className="mt-1 text-texto-suave">
          Por eso toda la gente sale en una sola fila. Se asigna en{" "}
          <Link href="/admin/acciones/cronograma" className="font-medium underline">
            Acciones de formación · Cronograma
          </Link>
          : se abre la acción, se entra a «Editar grupo» y ahí está «Asesor
          académico». En cuanto un grupo tenga el suyo, aparece aquí con su
          carga.
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
      id="asesores-academicos"
      columnas={columnasAcademicas}
      filas={vivos.datos}
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
 * FUERA DEL COMPONENTE y no dentro: no dependen de nada que cambie
 * entre pintados, y ahí arriba se rehacían en cada uno. La de
 * inscripciones sí vive dentro porque sus columnas cambian con la
 * acción elegida.
 */
const columnasAcademicas: Columna<FilaDeAsesorAcademico>[] = [
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
  {
    clave: "grupos",
    titulo: "Grupos",
    ancho: "90px",
    numerica: true,
    valor: (f) => f.grupos,
  },
  {
    /// PAX Y NO «PARTICIPANTES»: es como lo llama el cliente y como
    /// está en la tira de cifras de arriba.
    clave: "pax",
    titulo: "PAX",
    ancho: "90px",
    numerica: true,
    valor: (f) => f.carga.total,
    pinta: (f) => <span className="font-medium tabular-nums">{n(f.carga.total)}</span>,
  },
  {
    clave: "conSeguimiento",
    titulo: "Con seguimiento",
    ancho: "130px",
    numerica: true,
    valor: (f) => f.conSeguimiento,
  },
  {
    clave: "certificados",
    titulo: "Certificados",
    ancho: "110px",
    numerica: true,
    valor: (f) => f.certificados,
    pinta: (f) => (
      <span className="font-semibold text-exito tabular-nums">{n(f.certificados)}</span>
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
function Proyeccion({ ventana }: { ventana: VentanaDeLlegada }) {
  const cargar = useCallback(() => crmApi.proyeccionDeInscripciones(ventana), [ventana]);
  const vivos = useDatosVivos<FilaDeProyeccion[]>(cargar, {
    clave: `proyeccion-${JSON.stringify(ventana)}`,
  });

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto />;
  if (vivos.datos.length === 0) {
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
  const t = vivos.datos.reduce(
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

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <CifraCompacta etiqueta="Acciones" valor={n(vivos.datos.length)} />
        <CifraCompacta etiqueta="Cupos comprometidos" valor={n(t.cupos)} />
        <CifraCompacta
          etiqueta="Inscritos"
          valor={n(t.inscritos)}
          color="var(--exito)"
          detalle={
            t.cupos > 0 ? `${Math.round((t.inscritos / t.cupos) * 100)} %` : undefined
          }
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

      {/* QUÉ QUIERE DECIR CADA COLUMNA.
          «¿Acabará en? ¿Leads por conseguir? ¿Llega? ¿Qué son esos
          términos?» (cliente, 27 sep 2026). Una tabla que hay que
          explicar de viva voz no está terminada, y la explicación va
          AQUÍ y no en un manual que nadie abre. */}
      <div className="rounded-lg border border-borde bg-superficie px-4 py-3 text-[0.8125rem] text-texto-suave">
        <p className="mb-1.5 font-semibold text-titulo">Cómo se lee esta tabla</p>
        <ul className="space-y-1">
          <li>
            <strong className="font-medium text-titulo">Meta diaria</strong> — cuántos
            hay que inscribir cada día, de lunes a sábado, para cubrir lo que falta
            antes de que cierre. Sube sola si un día no se cumple.
          </li>
          <li>
            <strong className="font-medium text-titulo">Terminará con</strong> — con
            cuántos inscritos acaba esta acción si sigue al ritmo de las dos últimas
            semanas. Es una previsión, no una promesa: si el ritmo cambia, cambia.
          </li>
          <li>
            <strong className="font-medium text-titulo">Conversión</strong> — de cada
            cien personas interesadas, cuántas acaban inscritas. Cuando una acción
            tiene pocos interesados se usa el promedio de todas, y la columna lo dice.
          </li>
          <li>
            <strong className="font-medium text-titulo">Leads que faltan</strong> —
            cuántos interesados NUEVOS hay que conseguir. Ya están descontados los que
            hay sin atender, porque esos no hay que volver a buscarlos.
          </li>
          <li>
            <strong className="font-medium text-titulo">¿Alcanza?</strong> — si con esa
            previsión se llega a los cupos comprometidos. «Apretado» es que llega por
            menos de un diez por ciento, que cualquier semana floja se come.
          </li>
        </ul>
      </div>

      <Tabla
        id="proyeccion-inscripciones"
        columnas={columnasDeProyeccion}
        filas={vivos.datos}
        clave={(f) => f.accionFormacionId}
        porPagina={25}
        vacio="Aquí aparece cada acción de formación en cuanto tenga gente detrás."
      />
    </>
  );
}

/**
 * Las columnas de la proyección, en el orden en que se leen.
 *
 * DE IZQUIERDA A DERECHA SE SIGUE EL RAZONAMIENTO: qué se prometió,
 * cuántos van, cuántos faltan, cuánto queda de plazo, a qué ritmo se
 * viene inscribiendo, dónde acaba eso, y solo al final el veredicto.
 * Puesto el veredicto primero, nadie mira el resto.
 */
const columnasDeProyeccion: Columna<FilaDeProyeccion>[] = [
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
  {
    clave: "cupos",
    titulo: "Cupos",
    ancho: "92px",
    numerica: true,
    valor: (f) => f.cupos,
    pinta: (f) => <span className="tabular-nums">{n(f.cupos)}</span>,
  },
  {
    clave: "inscritos",
    titulo: "Inscritos",
    ancho: "98px",
    numerica: true,
    valor: (f) => f.inscritos,
    pinta: (f) => (
      <span className="font-medium text-exito tabular-nums">{n(f.inscritos)}</span>
    ),
  },
  {
    clave: "faltan",
    titulo: "Faltan",
    ancho: "92px",
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
    clave: "cierre",
    titulo: "Cierra",
    ancho: "158px",
    valor: (f) => f.cierre ?? "",
    pinta: (f) =>
      f.cierre ? (
        <span>
          {dia(f.cierre)}
          <span className="block text-xs text-texto-suave">
            {f.diasRestantes === null
              ? ""
              : f.diasRestantes > 0
                ? `quedan ${n(f.diasRestantes)} días de trabajo`
                : `cerró hace ${n(-f.diasRestantes)} días`}
          </span>
        </span>
      ) : (
        /// Sin fecha de inicio no hay cierre que calcular, y eso no se
        /// arregla inscribiendo: se arregla poniéndole fecha al grupo.
        <span className="text-aviso">Sin fecha de inicio</span>
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
    /**
     * EL CONTEO CRUDO, no la tasa.
     *
     * Enseñaba «0,8 al día», y el cliente no quiere decimales en
     * ninguna columna (27 sep 2026). Redondear una tasa por debajo de
     * uno la convierte en cero, que es mentira. Así que se enseña el
     * dato del que sale ---cuántos se inscribieron en los últimos
     * quince días de trabajo---: es entero, es verdad, y es la cifra
     * que alguien puede contrastar. La tasa sigue por dentro, que es
     * donde hace falta para proyectar.
     */
    titulo: "Inscritos en 15 días",
    ancho: "150px",
    numerica: true,
    valor: (f) => f.inscritosVentana,
    pinta: (f) => <span className="tabular-nums">{n(f.inscritosVentana)}</span>,
  },
  {
    clave: "proyeccion",
    titulo: "Terminará con",
    ancho: "112px",
    numerica: true,
    valor: (f) => f.proyeccion,
    pinta: (f) => (
      <span
        className={
          "font-semibold tabular-nums " +
          (f.proyeccion >= f.cupos ? "text-exito" : "text-error")
        }
      >
        {n(f.proyeccion)}
      </span>
    ),
  },
  {
    clave: "conversion",
    titulo: "Conversión",
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
    clave: "porConseguir",
    titulo: "Leads que faltan",
    ancho: "152px",
    numerica: true,
    valor: (f) => f.leadsPorConseguir,
    pinta: (f) => (
      <span className="tabular-nums">
        <span className={f.leadsPorConseguir > 0 ? "font-semibold" : ""}>
          {n(f.leadsPorConseguir)}
        </span>
        {/* Los que ya están abiertos son materia prima que YA se
            tiene: salir a buscar los que hacen falta enteros, con
            ocho en la mano, manda a la calle por ocho de más. */}
        {f.abiertos > 0 && (
          <span className="block text-xs text-texto-suave">
            {n(f.abiertos)} abiertos
          </span>
        )}
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
