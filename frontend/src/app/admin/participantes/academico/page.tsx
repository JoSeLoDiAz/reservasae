"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { colorEtapa } from "@/components/admin/etapa";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import { Aviso, CLASE_CONTROL, Tarjeta } from "@/components/admin/marco-admin";
import { Esqueleto } from "@/components/admin/piezas";
import { CajonDelAula } from "@/components/admin/cajon-del-aula";
import { columnasDelAula } from "@/components/admin/columnas-del-aula";
import { Tabla } from "@/components/admin/tabla";
import { Desplegable } from "@/components/admin/desplegable";
import { SelectorBuscable } from "@/components/admin/selector-buscable";
import { useDatosVivos } from "@/lib/datos-vivos";
import {
  type Academico,
  crmApi,
  type EstadoAcademico,
  ETIQUETA_ACADEMICA,
  type Etapa,
  type FilaAcademica,
} from "@/lib/crm-api";

// el color sale del token de la etapa que le corresponde
const COLOR: Record<EstadoAcademico, string> = {
  SIN_INGRESO: colorEtapa("PERDIDO"),
  SIN_EMPEZAR: colorEtapa("CONTACTADO"),
  ATRASADO: colorEtapa("EN_FORMACION"),
  AL_DIA: colorEtapa("CERTIFICADO"),
  COMPLETADO: colorEtapa("INSCRITO"),
  CERTIFICADO: colorEtapa("CERTIFICADO"),
};

/// De lo más urgente a lo que no pide nada.
/// LOS SEIS, EN EL ORDEN QUE ÉL LOS DICTÓ: del que no ha entrado al
/// que ya terminó. «Sin actividades» va segundo porque es el paso
/// siguiente a no haber entrado, y así la fila se lee como un camino.
const ORDEN: EstadoAcademico[] = [
  "SIN_INGRESO",
  "SIN_EMPEZAR",
  "ATRASADO",
  "AL_DIA",
  "COMPLETADO",
  "CERTIFICADO",
];

/**
 * Seguimiento académico: UN solo cuadro.
 *
 * Eran tres pantallas para la misma pregunta: «Avance» persona
 * a persona, «Tablero académico» por acción, grupo y asesor, y
 * un «Proceso» que se añadió después con los gráficos. Tres
 * sitios donde mirar cómo va el aula son tres sitios donde la
 * cifra puede no coincidir, y cada uno enlazaba a los otros en
 * su propio subtítulo --la señal de que nunca debieron ser
 * tres--.
 *
 * Ahora es una sola columna que se lee de arriba abajo: los
 * filtros, en qué estado está cada quien, los gráficos que
 * cuentan cómo va eso, y al final la lista con nombre y
 * apellido.
 *
 * Y UN SOLO juego de filtros manda sobre todo. Es lo que
 * permite juntarlo: con el filtro de una acción puesto, el
 * embudo, las tasas y la lista hablan de la misma gente. Dos
 * juegos de filtros en una pantalla —uno para los gráficos y
 * otro para la tabla— es como se acaba comparando un
 * numerador con un denominador que no le corresponde.
 */
/**
 * Seguimiento: el aula persona a persona.
 *
 * Su hermana --«Tablero académico», que mira por acción, grupo y
 * asesor-- fue una pestaña de aquí y volvió a ser una pantalla,
 * en `academico/tablero`. Las dos se eligen desde el menú de
 * Académica en la cabecera: «estas dos opciones que queden en
 * Académica en lista desplegable» (cliente, 12 sep 2026).
 *
 * Con las pestañas se fue lo que las montaba y desmontaba para no
 * doblar las consultas: ahora son dos rutas, y cada una pide lo
 * suyo cuando se entra.
 */
export default function PaginaAcademica() {
  return (
    <div className="flex flex-col gap-3 px-4 pt-3">
      <Seguimiento />
    </div>
  );
}

function Seguimiento() {
  const [filtro, setFiltro] = useState<EstadoAcademico | "">("");
  const [salida, setSalida] = useState<Etapa | "">("");
  /// A quién se le está mirando el seguimiento. Se guarda la FILA y
  /// no el id: el cajón pinta lo del aula --estado, avance, último
  /// ingreso-- que ya está aquí, y solo pide al servidor las notas.
  const [enElCajon, setEnElCajon] = useState<FilaAcademica | null>(null);
  const [buscar, setBuscar] = useState("");
  const [accionFormacionId, setAccion] = useState("");
  const [grupoId, setGrupo] = useState("");
  const [asesorId, setAsesor] = useState("");

  const cargar = useCallback(
    () =>
      crmApi.academico({
        buscar: buscar || undefined,
        accionFormacionId: accionFormacionId || undefined,
        grupoId: grupoId || undefined,
        asesorId: asesorId || undefined,
      }),
    [buscar, accionFormacionId, grupoId, asesorId],
  );

  // se refresca solo; un fallo conserva lo ultimo bueno.
  // la clave hace que un filtro nuevo se pida al momento
  const vivos = useDatosVivos<Academico>(cargar, {
    clave: `${buscar}|${accionFormacionId}|${grupoId}|${asesorId}`,
  });
  const datos = vivos.datos;

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!datos) return <Esqueleto conCifras />;

  const { resumen } = datos;
  // los dos filtros son excluyentes: un estado de ritmo es
  // de quien sigue dentro, y una salida de quien ya no
  const visibles = salida
    ? datos.personas.filter((p) => p.etapa === salida)
    : filtro
    ? datos.personas.filter((p) => !p.salio && p.estado === filtro)
    : datos.personas;


  const cuenta: Record<EstadoAcademico, number> = {
    SIN_INGRESO: resumen.sinIngreso,
    SIN_EMPEZAR: resumen.sinEmpezar,
    ATRASADO: resumen.atrasados,
    AL_DIA: resumen.alDia,
    COMPLETADO: resumen.completados,
    CERTIFICADO: resumen.certificados,
  };

  // por acción y dentro por grupo: el acordeón
  const porAccion = new Map<
    string,
    { titulo: string; grupos: Map<number, FilaAcademica[]> }
  >();
  for (const p of visibles) {
    const clave = p.accionFormacionId ?? "sin-accion";
    if (!porAccion.has(clave)) {
      porAccion.set(clave, {
        titulo: p.accion ?? "Sin acción de formación",
        grupos: new Map(),
      });
    }
    const grupos = porAccion.get(clave)!.grupos;
    // -1 para los que no tienen grupo: van al final
    const ng = p.grupo ?? -1;
    if (!grupos.has(ng)) grupos.set(ng, []);
    grupos.get(ng)!.push(p);
  }

  // AF1, AF2… AF10: por el número, no alfabético, que
  // pondría AF10 antes que AF2
  /// LAS COLUMNAS SALEN DE LAS FILAS, porque las de actividad
  /// dependen del curso: hoy son las doce de la siembra y mañana las
  /// seis que mande el LMS, sin tocar una línea.
  ///
  /// SIN `useMemo`, y a propósito. `visibles` se reconstruye en cada
  /// render --es un `filter` sobre las personas--, así que una
  /// memoria con esa dependencia no acierta nunca: solo añade la
  /// comparación y la promesa falsa de que ahorra algo. La pasada es
  /// una por persona y actividad, y con el aula entera son unos
  /// cientos de vueltas.
  const columnas = columnasDelAula();

  const hayFiltro = Boolean(
    filtro || salida || accionFormacionId || grupoId || asesorId || buscar,
  );

  function quitarFiltros() {
    setFiltro("");
    setSalida("");
    setAccion("");
    setGrupo("");
    setAsesor("");
    setBuscar("");
  }

  // 67 grupos: el numero no distingue
  const gruposBuscables = datos.grupos
    .filter((g) => !accionFormacionId || g.accionFormacionId === accionFormacionId)
    .map((g) => {
      const suya = datos.acciones.find((a) => a.id === g.accionFormacionId);
      return {
        id: g.id,
        etiqueta: `Grupo ${g.numero}`,
        detalle: suya ? `${suya.codigo} · ${suya.nombre}` : "Sin acción de formación",
      };
    });

  return (
    /// La misma forma que Control de Inscritos, y a propósito:
    /// son las dos pantallas donde coordinación viene a mirar
    /// cómo va la cosa, y hasta ahora cada una tenía la suya.
    /// Cabecera sin banda, filtros en su tarjeta y una sola
    /// fila, y de ahí para abajo bloques.
    ///
    /// Sin `px-4 pt-3`: los pone la página, que ahora envuelve
    /// las dos hojas. Repetirlos aquí duplicaba el margen.
    <div className="flex flex-col gap-3 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {/* «SEGUIMIENTO DEL AULA» Y NO «SEGUIMIENTO ACADÉMICO».
              Se llamaban igual dos pantallas distintas, y el cliente
              lo paró: «en Académica, Seguimiento académico no, porque
              ya está en Tableros» (23 sep 2026). Aquel es el tablero
              --resúmenes, sin personas--; esta es la lista con la que
              se trabaja, persona por persona. El menú ya la llamaba
              así; solo el título seguía con el nombre del otro. */}
          <h1 className="text-[1.125rem] font-bold tracking-[-0.02em] text-titulo">
            Seguimiento del aula
          </h1>
          {/* Sin bajada (cliente, 12 sep 2026). El título ya dice
              qué es, y la miga de arriba de dónde cuelga. */}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <IndicadorActualizacion
            actualizadoEn={vivos.actualizadoEn}
            refrescando={vivos.refrescando}
            desactualizado={vivos.desactualizado}
            alRefrescar={vivos.refrescar}
          />
          <Link
            href="/admin/participantes"
            className="text-[0.78125rem] text-texto-suave underline hover:text-texto"
          >
            Volver a inscripciones
          </Link>
        </div>
      </header>

      {/* Prosa, y solo cuando pasa: no cabe en la tarjeta de
          filtros porque no es un filtro, es una advertencia
          sobre lo que se está mirando. */}
      {resumen.analizadas < resumen.total && (
        <p className="rounded-xl bg-aviso-suave px-3 py-2 text-xs text-aviso">
          <strong className="font-semibold">
            Se están mirando las {resumen.analizadas.toLocaleString("es-CO")} más
            recientes
          </strong>{" "}
          de {resumen.total.toLocaleString("es-CO")} en el aula. Filtre por acción
          o por grupo para ver el resto.
        </p>
      )}

      {/* ── 1 · Filtros ──
          Los cuatro en UNA fila y dentro de su tarjeta, como en
          Control de Inscritos: mandan todos sobre la misma
          pantalla, y sueltos en una línea parecía que cada uno
          gobernaba otra cosa. */}
      <div className="rounded-xl border border-borde bg-superficie px-4 py-3.5">
        <p className="mb-2.5 text-[0.6875rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
          Filtros
          <span className="ml-2.5 font-normal tracking-normal text-marca normal-case">
            <strong className="font-semibold tabular-nums">
              {resumen.analizadas.toLocaleString("es-CO")}
            </strong>{" "}
            {resumen.analizadas === 1 ? "persona" : "personas"} en el aula
          </span>
          {hayFiltro && (
            <button
              onClick={quitarFiltros}
              className="ml-3 font-normal tracking-normal text-texto-suave underline normal-case hover:text-texto"
            >
              Limpiar
            </button>
          )}
        </p>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className={CLASE_CONTROL}
            placeholder="Buscar por nombre o documento"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />

          <SelectorBuscable
            clase="w-full"
            etiqueta="Acción de formación"
            valor={accionFormacionId}
            alElegir={(id) => {
              setAccion(id);
              // el grupo cuelga de la accion: si cambia, sobra
              setGrupo("");
            }}
            vacio="Formación"
            marcador="AF8, inteligencia artificial…"
            opciones={datos.acciones.map((a) => ({
              id: a.id,
              etiqueta: `${a.codigo} · ${a.nombre}`,
            }))}
          />

          <SelectorBuscable
            clase="w-full"
            etiqueta="Grupo"
            valor={grupoId}
            alElegir={setGrupo}
            vacio="Grupos"
            marcador="Número de grupo, AF8, nombre…"
            opciones={gruposBuscables}
          />

          <Desplegable
            alto={34}
            marcador="Asesores"
            valor={asesorId}
            alElegir={setAsesor}
            opciones={[
              { valor: "", etiqueta: "Asesores" },
              ...datos.asesores.map((a) => ({ valor: a.id, etiqueta: a.nombre })),
            ]}
          />
        </div>



        {/* SIN LA FILA DE SALIDAS. Eran cuatro tarjetas más
            --Desertó, Abandonó, Retirado, No aprobó-- y con las seis
            de arriba hacían diez: «¿cuántas tarjetas te dije?»
            (cliente, 24 sep 2026). Él dictó SEIS estados y esos son
            los que se miden aquí.

            Quien se fue no desaparece: sigue en la tabla con su
            etapa, y el reparto por puerta de salida está en el
            tablero de Seguimiento académico, en Tableros, que es
            donde viven los resúmenes. */}


      </div>

      {/* LAS SEIS, FUERA DE LA TARJETA DE FILTROS (cliente, 24 sep
          2026: «las tarjetas viven afuera»). Estuvieron dentro y
          separadas por una raya, con el argumento de que pulsar un
          estado ES filtrar; él prefiere verlas sueltas, y sueltas se
          leen como lo que también son: el reparto del aula.

          Y sin los dos textos que las acompañaban --«pulse uno para
          quedarse solo con esa gente» y el párrafo de metodología con
          el 80 % y los 14 días--: «estos comentarios se van». */}
        {/* AL ALTO DE LA CASA: 51 px, relleno 8/14 y cifra de 17 px
            (cliente, 24 sep 2026: «esto más reducido por favor»). Es
            la misma medida de `CifraCompacta` --la de Gestión de
            leads, que él aprobó-- y no una talla inventada para esta
            pantalla. Estas no pueden SER `CifraCompacta` porque se
            pulsan: son los filtros. Lo que se copia es la medida. */}
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ORDEN.map((estado) => (
            <button
              key={estado}
              onClick={() => {
                setSalida("");
                setFiltro(filtro === estado ? "" : estado);
              }}
              style={{ ["--etapa"]: COLOR[estado] } as React.CSSProperties}
              className={`rounded-lg border bg-superficie px-3.5 py-2 text-left transition hover:border-campo-borde ${
                filtro === estado ? "border-marca bg-marca-suave" : "border-borde"
              }`}
              aria-pressed={filtro === estado}
            >
              <span className="flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.08em] uppercase">
                <span className="punto-etapa" aria-hidden />
                <span className="truncate text-texto-suave">
                  {ETIQUETA_ACADEMICA[estado]}
                </span>
              </span>
              <span className="mt-1 block text-[1.0625rem] leading-none font-bold tabular-nums">
                {cuenta[estado]}
              </span>
            </button>
          ))}
        </div>

      {visibles.length === 0 ? (
        <Tarjeta
          titulo="Nadie aquí"
          descripcion="Solo aparece quien ya entró en formación."
        >
          <p className="text-sm text-texto-suave">
            El avance llega del aula; mientras nadie esté en formación, esta pantalla
            está vacía a propósito.
          </p>
        </Tarjeta>
      ) : (
        /* LAS PERSONAS EN FILAS, SU ESTADO EN COLUMNAS (cliente, 24
           sep 2026). Estuvo en dos acordeones anidados --acción, y
           dentro grupo, y dentro la tabla-- y para ver a alguien
           había que abrir dos cajones sabiendo de antemano en qué
           grupo estaba. Los filtros de arriba ya hacen ese recorte:
           se elige la acción, se despliega el grupo, y la lista se
           queda con su gente. El acordeón repetía ese trabajo a mano.

           «Estructurar misma visual adaptada de Gestión de leads»: es
           la misma tabla, el mismo buscador y el mismo cajón al pulsar
           una fila, con las columnas del aula en vez de las del
           embudo. */
        <Tabla
          /// LA MISMA TABLA DE GESTIÓN DE LEADS, no una parecida:
          /// «prácticamente es como la tabla de Gestión de leads, su
          /// mismo esquema, toda la misma lógica» (cliente, 24 sep
          /// 2026). Con ella vienen los filtros por columna, el
          /// selector de columnas y que la selección se recuerde.
          ///
          /// SIN `acciones` NI `accionesLote`, y eso es literal:
          /// «solo que acá no van botones como importar, asignar
          /// masivo y demás». No se quitan; es que no se le pasan.
          ///
          /// El `id` es lo que separa las columnas guardadas de esta
          /// pantalla de las de Gestión de leads. Con el mismo, quien
          /// escondiera una allá se la encontraría escondida aquí.
          id="aula"
          columnas={columnas}
          filas={visibles}
          clave={(f) => f.id}
          alClic={(f) => setEnElCajon(f)}
        />
      )}

      {enElCajon && (
        <CajonDelAula fila={enElCajon} alCerrar={() => setEnElCajon(null)} />
      )}
    </div>
  );
}

/** Una acción plegada; dentro, sus grupos con su gente. */