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
  type RitmoDeAsesor,
} from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

import { DesgloseDelAsesor } from "./desglose-del-asesor";
import { n } from "./graficos";
import { Aviso } from "./marco-admin";
import { SelectorBuscable } from "./selector-buscable";
import { CifraCompacta, Encabezado, Esqueleto, Vacio } from "./piezas";
import { type Columna, Tabla } from "./tabla";

type Subvista = "inscripciones" | "academicos";

/// SIN FRASE AL LADO (cliente, 23 sep 2026). Cada tabla ya dice contra
/// qué fecha corre en su propia descripción y en su pie; repetirlo
/// arriba costaba un renglón y no añadía nada.
const SUBVISTAS: Array<{ clave: Subvista; etiqueta: string }> = [
  { clave: "inscripciones", etiqueta: "Asesores de inscripciones" },
  { clave: "academicos", etiqueta: "Asesores académicos" },
];

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
      <div className="flex flex-wrap gap-1 rounded-xl border border-borde bg-superficie px-2 py-1.5">
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

      {subvista === "inscripciones" ? <DeInscripciones /> : <Academicos />}
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
  visto: { total: number; gestionados: number; resueltos: number; pendientes: number };
};

function DeInscripciones() {
  const cargar = useCallback(() => crmApi.asesoresDeInscripciones(), []);
  const vivos = useDatosVivos<FilaDeAsesor[]>(cargar, { clave: "asesores-inscripciones" });

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
      pendientes: a.pendientes + f.visto.pendientes,
    }),
    { total: 0, gestionados: 0, resueltos: 0, pendientes: 0 },
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
    {
      clave: "resueltos",
      titulo: "Inscritos y descartados",
      ancho: "160px",
      numerica: true,
      valor: (f) => f.visto.resueltos,
      pinta: (f) => (
        <span className="font-medium text-exito tabular-nums">{n(f.visto.resueltos)}</span>
      ),
    },
    {
      clave: "pendientes",
      titulo: "Pendientes",
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
          {f.antiguedadMedia === null ? "—" : `${dec(f.antiguedadMedia)} d`}
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
      titulo: "Debe hacer al día",
      ancho: "130px",
      numerica: true,
      valor: (f) => f.ritmo.exigidoPorDia,
      pinta: (f) => (
        <span className="font-semibold tabular-nums">{dec(f.ritmo.exigidoPorDia)}</span>
      ),
    },
    {
      clave: "real",
      titulo: "Promedio Cantidad inscripción",
      ancho: "175px",
      numerica: true,
      valor: (f) => f.ritmo.realPorDia,
      pinta: (f) => <span className="tabular-nums">{dec(f.ritmo.realPorDia)}</span>,
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
      <CifraCompacta
        etiqueta="Inscritos y descartados"
        valor={n(t.resueltos)}
        color="var(--exito)"
      />
      <CifraCompacta
        etiqueta="Pendientes"
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

function Academicos() {
  const cargar = useCallback(() => crmApi.asesoresAcademicos(), []);
  const vivos = useDatosVivos<FilaDeAsesorAcademico[]>(cargar, { clave: "asesores-academicos" });

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
    titulo: "Por certificar",
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
    titulo: "Debe hacer al día",
    ancho: "130px",
    numerica: true,
    valor: (f) => f.ritmo.exigidoPorDia,
    pinta: (f) => <span className="font-semibold tabular-nums">{dec(f.ritmo.exigidoPorDia)}</span>,
  },
  {
    clave: "real",
    titulo: "Promedio Cantidad inscripción",
    ancho: "150px",
    numerica: true,
    valor: (f) => f.ritmo.realPorDia,
    pinta: (f) => <span className="tabular-nums">{dec(f.ritmo.realPorDia)}</span>,
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
