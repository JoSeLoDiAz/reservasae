"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { colorEtapa } from "@/components/admin/etapa";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import { Aviso } from "@/components/admin/marco-admin";
import { Esqueleto } from "@/components/admin/piezas";
import { CajonDelAula } from "@/components/admin/cajon-del-aula";
import { columnasDelAula } from "@/components/admin/columnas-del-aula";
import { Tabla } from "@/components/admin/tabla";
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
  /// DOS FILTROS Y NO CUATRO (cliente, 24 sep 2026).
  ///
  /// Se fueron el buscador de arriba y el de asesores. El buscador
  /// pedía al SERVIDOR por nombre o documento; la tabla trae el suyo
  /// --sobre lo ya cargado-- y tener los dos en la misma fila era
  /// pedir que se adivinara cuál de ellos se estaba usando. El de
  /// asesores ya es una columna, con su propio filtro.
  ///
  /// Estos dos SE QUEDAN aunque la acción y el grupo sean también
  /// columnas, y la diferencia importa: estos van al SERVIDOR y
  /// cambian QUÉ FILAS BAJAN; los de columna recortan lo que ya
  /// está cargado, con tope de 300. Hoy, con 35 personas, da igual;
  /// pasadas las 300 el de columna filtraría solo las primeras y
  /// nadie lo sabría. Y son los que él pidió en cascada: se elige la
  /// acción, se despliega el grupo, y queda su gente.
  const [accionFormacionId, setAccion] = useState("");
  const [grupoId, setGrupo] = useState("");

  const cargar = useCallback(
    () =>
      crmApi.academico({
        accionFormacionId: accionFormacionId || undefined,
        grupoId: grupoId || undefined,
      }),
    [accionFormacionId, grupoId],
  );

  // se refresca solo; un fallo conserva lo ultimo bueno.
  // la clave hace que un filtro nuevo se pida al momento
  const vivos = useDatosVivos<Academico>(cargar, {
    clave: `${accionFormacionId}|${grupoId}`,
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

  const hayFiltro = Boolean(filtro || salida || accionFormacionId || grupoId);

  function quitarFiltros() {
    setFiltro("");
    setSalida("");
    setAccion("");
    setGrupo("");
  }

  // 67 grupos: el numero no distingue
  const gruposBuscables = datos.grupos
    .filter((g) => !accionFormacionId || g.accionFormacionId === accionFormacionId)
    .map((g) => {
      /// «GRUPO 4» Y NADA MÁS (cliente, 24 sep 2026: «o sea solo
      /// Grupo, ejemplo Grupo 1; ¿para qué nombre, si lo tengo en
      /// Acción de Formación?»).
      ///
      /// Debajo de cada grupo iba «AF1 · GESTIÓN DE LA ATENCIÓN Y
      /// NEUROEDUCACIÓN EN LA ERA DIGITAL», y con eso cada opción
      /// ocupaba tres renglones: en la lista cabían dos grupos y
      /// medio. Ahora que la lista solo trae los de la formación ya
      /// elegida, ese renglón es el MISMO en todas: no distingue
      /// nada, y lo que sí distingue ---el número--- quedaba
      /// aplastado contra el de arriba.
      ///
      /// Sigue buscándose por el nombre del curso aunque no se pinte.
      const suya = datos.acciones.find((a) => a.id === g.accionFormacionId);
      return {
        id: g.id,
        etiqueta: `Grupo ${g.numero}`,
        busca: suya ? `${suya.codigo} ${suya.nombre}` : undefined,
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

      {/* LA TABLA SE PINTA SIEMPRE, también sin nadie dentro.
          Antes, con cero filas, en su sitio salía una tarjeta de
          «Nadie aquí» y la tabla desaparecía --y con ella su barra--.
          Ahora los filtros VIVEN en esa barra, así que un filtro que
          no devuelve a nadie se llevaba por delante el control con el
          que se deshace: quien filtrara de más quedaba encerrado.
          `Tabla` trae su propio estado vacío; esto le pasa el texto y
          la barra se queda donde está. */}
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
        vacio={
          hayFiltro ? (
            <>
              Nadie cumple lo que está filtrado.{" "}
              <button onClick={quitarFiltros} className="underline">
                Quitar los filtros
              </button>
            </>
          ) : (
            "Solo aparece quien ya entró en formación: el avance llega del aula."
          )
        }
        /* LOS DOS DE SERVIDOR, FUSIONADOS EN LA FILA DEL BUSCADOR
           (cliente, 24 sep 2026: «sí, pero fusionado donde está el
           buscador, no desorden»). Estaban en una tarjeta propia
           encima de la tabla y, al quedarse en dos, se estiraban a
           media pantalla cada uno: dos campos enormes para decir
           dos palabras, y una tarjeta con un solo renglón dentro.

           Aquí se leen con el buscador, que es lo que son: antes de
           mirar la lista se dice de qué acción y de qué grupo se
           está hablando.

           EL ANCHO SE REPARTE, no se fija (cliente, 24 sep 2026:
           «reduce buscador y alarga formación»). El buscador traía
           `flex-1` y se quedaba con todo el sobrante ---693 px de
           1.600---, mientras «Formación» recortaba a la mitad unos
           nombres de noventa letras: se leía «AF8 · Inteligencia
           art…» y había que abrir el desplegable para saber cuál
           era. Ahora los dos llevan `flex-1` y parten el sobrante a
           partes iguales, así que el cambio vale igual en un
           portátil que en el monitor grande. El grupo no crece: es
           un número. */
        filtrosDelServidor={
          <>
            <SelectorBuscable
              clase="min-w-[14rem] flex-1"
              etiqueta="Acción de formación"
              valor={accionFormacionId}
              alElegir={(id) => {
                setAccion(id);
                // el grupo cuelga de la accion: si cambia, sobra
                setGrupo("");
              }}
              /// «ACCIÓN DE FORMACIÓN», con su nombre entero
              /// (cliente, 24 sep 2026). Decía «Formación» a secas
              /// por caber en la tarjeta que ya no existe; en la
              /// fila del buscador hay sitio, y es como se llama en
              /// Oferta y en la columna de la tabla.
              vacio="Acción de Formación"
              marcador="AF1, neuroeducación…"
              opciones={datos.acciones.map((a) => ({
                id: a.id,
                etiqueta: `${a.codigo} · ${a.nombre}`,
              }))}
            />
            {/* EL GRUPO CUELGA DE LA FORMACIÓN, y hasta que no haya
                una elegida este no se puede usar (cliente, 24 sep
                2026: «dice Grupos y esta es sujeta a la AF, y como
                son 2 AF y misma cantidad, pues ya es que AF filtre»).

                Tiene razón y el problema es del dato: el número de
                grupo NO es único ---hay un «Grupo 4» en AF1 y otro
                en AF2---, así que sin formación elegida la lista
                mezclaba dos cosas distintas con el mismo nombre y
                había que leerse el renglón de abajo para saber cuál
                era cuál.

                Apagado y no escondido: el hueco se queda para que se
                vea que existe y de qué depende. */}
            <SelectorBuscable
              clase="w-[11.5rem] shrink-0"
              etiqueta="Grupo"
              valor={grupoId}
              alElegir={setGrupo}
              vacio="Grupos"
              marcador="Número de grupo, nombre…"
              opciones={gruposBuscables}
              desactivado={!accionFormacionId}
              razon="Elija formación"
            />
            {hayFiltro && (
              <button
                type="button"
                onClick={quitarFiltros}
                className="shrink-0 text-[0.78125rem] text-texto-suave underline hover:text-texto"
              >
                Limpiar
              </button>
            )}
          </>
        }
      />

      {enElCajon && (
        <CajonDelAula fila={enElCajon} alCerrar={() => setEnElCajon(null)} />
      )}
    </div>
  );
}

/** Una acción plegada; dentro, sus grupos con su gente. */