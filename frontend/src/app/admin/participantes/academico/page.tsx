"use client";

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
    /// `min-h-0 grow`, LA CADENA DE ALTURA, igual que Gestión de
    /// leads (cliente, 25 sep 2026: «en Control de inscritos no es
    /// que el scroll quede afuera, queda es en la tabla»).
    ///
    /// `Tabla` acota su cuerpo con `flex-1 overflow-auto`, y eso
    /// solo funciona si TODOS sus padres tienen altura acotada: basta
    /// que uno crezca con su contenido para que la tabla se estire
    /// entera y quien se desplace sea la página. Aquí se rompía en
    /// dos sitios ---este y el de `Seguimiento`---, y el síntoma era
    /// una barra de desplazamiento a lo ancho de toda la ventana en
    /// vez de dentro del recuadro de la tabla.
    ///
    /// `min-h-0` hace falta además de `grow`: por defecto un hijo
    /// de flex no encoge por debajo de su contenido, así que sin él
    /// `grow` no acota nada.
    <div className="flex min-h-0 grow flex-col gap-3 px-4 pt-3">
      <Seguimiento />
    </div>
  );
}

function Seguimiento() {
  /// LAS SEIS TARJETAS NO FILTRAN, Y ESO ERA LA INSTRUCCIÓN.
  ///
  /// «Las tarjetas no filtran», «las tarjetas siguen filtrando»,
  /// «sigue filtrando con las tarjetas de los estados que he
  /// insistido» (cliente, 24 sep 2026, tres veces). Yo leí la
  /// primera como un fallo ---«no filtran» = están rotas---, fui a
  /// comprobarlo, vi que sí filtraban y se lo dije. Era una orden,
  /// no un síntoma.
  ///
  /// Y ya estaba escrito aquí mismo sin que yo lo viera: él las sacó
  /// de la tarjeta de filtros ---«las tarjetas viven afuera»--- y
  /// eso era exactamente decir que no son filtros. Son el reparto
  /// del aula: cuánta gente hay en cada estado.
  ///
  /// No se pierde nada. Quien quiera quedarse con los atrasados usa
  /// el filtro de la columna «Estado», que ya existe y es donde se
  /// filtra en esta tabla; así hay UN solo sitio donde se filtra en
  /// vez de dos que se pisan.
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
  /// TODAS. El recorte lo hacen los dos desplegables ---que van al
  /// servidor--- y los filtros de columna de la tabla.
  const visibles = datos.personas;


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

  const hayFiltro = Boolean(accionFormacionId || grupoId);

  /// QUÉ HAY PUESTO, EN PALABRAS.
  ///
  /// «Las tarjetas siguen filtrando, ¿qué pasó?» (cliente, 24 sep
  /// 2026), viendo cinco personas de treinta y cinco. No era un
  /// fallo: tenía una acción de formación elegida y el recorte lo
  /// hacía ella. El problema es que eso solo se veía abriendo el
  /// desplegable, y las tarjetas ---que es donde él estaba mirando---
  /// enseñaban los números ya recortados sin decir de qué.
  ///
  /// Un filtro que no se ve es un filtro que parece un fallo. Esto
  /// lo pone en el sitio donde estaba el ojo, y con la salida al
  /// lado.
  const puesto: string[] = [];
  if (accionFormacionId) {
    const a = datos.acciones.find((x) => x.id === accionFormacionId);
    if (a) puesto.push(`${a.codigo} · ${a.nombre}`);
  }
  if (grupoId) {
    const g = datos.grupos.find((x) => x.id === grupoId);
    if (g) puesto.push(`Grupo ${g.numero}`);
  }


  function quitarFiltros() {
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
    /// Sin `pb-6`: con la tabla acotada, ese relleno de abajo era
    /// aire muerto entre el borde de la tabla y el pie ---«mucho
    /// espacio en la línea de respeto»---. El hueco hasta el pie lo
    /// pone ya el marco.
    <div className="flex min-h-0 grow flex-col gap-3">
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
          {/* SIN «VOLVER A INSCRIPCIONES» (cliente, 24 sep 2026:
              «esto se va, son módulos independientes, nunca lo
              pedí»).

              Venía de cuando el aula colgaba de Inscripciones y esa
              miga tenía sentido. Ya no: Académica es su propio
              módulo en la cabecera, con su desplegable, y desde ahí
              se va a cualquier sitio en un clic. Un enlace que
              devuelve a otro módulo insinúa una jerarquía que no
              existe. */}
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


      {/* LO QUE ESTÁ PUESTO, ENCIMA DE LAS TARJETAS y no debajo:
          es lo que explica sus números. Sin esto, con una acción
          elegida las seis tarjetas suman cinco y la pantalla no dice
          por qué ---parece que se hubieran perdido treinta personas---. */}
      {puesto.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-marca-suave px-3 py-2 text-[0.78125rem]">
          <span className="font-semibold text-marca">Viendo solo:</span>
          {puesto.map((q) => (
            <span
              key={q}
              className="rounded-full bg-superficie px-2.5 py-0.5 text-texto"
            >
              {q}
            </span>
          ))}
          {/* LO QUE HAY EN PANTALLA, no el total del servidor.
              Estuvo con `resumen.analizadas` y se contradecía con
              las tarjetas: con «Atrasado» pulsado el aviso decía «6
              personas» y la tarjeta de Atrasado decía 0. Es que
              `analizadas` lo cuenta el SERVIDOR, que sabe de la
              acción y del grupo pero no de la tarjeta ---esa filtra
              aquí---. Dos cifras de lo mismo en la misma franja y
              distintas. */}
          <span className="text-texto-suave">
            {visibles.length.toLocaleString("es-CO")}{" "}
            {visibles.length === 1 ? "persona" : "personas"}
          </span>
          <button
            type="button"
            onClick={quitarFiltros}
            className="ml-auto font-semibold text-marca underline hover:no-underline"
          >
            Ver a todos
          </button>
        </div>
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
            pantalla.

            YA NO SE PULSAN: son cifras, no botones. Eran `<button>`
            con `aria-pressed` y al pulsarlas recortaban la lista;
            el cliente lo paró tres veces. Se quedan en `<div>` para
            que ni el teclado ni el lector de pantalla las anuncien
            como algo que hacer. */}
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ORDEN.map((estado) => (
            <div
              key={estado}
              style={{ ["--etapa"]: COLOR[estado] } as React.CSSProperties}
              /// EL MISMO `hover` QUE `CifraCompacta` ---la tarjeta
              /// de Gestión de leads--- letra por letra (cliente, 24
              /// sep 2026: «¿por qué cuando paso por la tarjeta ya no
              /// genera ese borde o sombra como Gestión de leads?»).
              ///
              /// Se perdió al dejar de ser `<button>`: el realce
              /// venía del `hover:border-campo-borde` que llevaban
              /// como botones, y al pasarlas a `<div>` se fue con
              /// ellos. Que no se pulsen no quiere decir que estén
              /// muertas ---la fila de tarjetas de Gestión de leads
              /// tampoco se pulsa y realza igual---: el realce dice
              /// «esto es una pieza», no «esto se puede pulsar».
              ///
              /// Copiado y no heredado porque estas llevan el punto
              /// de color del estado, que `CifraCompacta` no tiene.
              /// Si algún día se le añade, estas pasan a SER aquella.
              className="rounded-lg border border-borde bg-superficie px-3.5 py-2 text-left transition hover:border-marca/40 hover:shadow-[0_2px_14px_-6px_rgba(15,23,42,0.28)]"
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
            </div>
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
        /// EL ORDEN ES EL CONTRATO, no una preferencia: «el orden
        /// de las columnas es innegociable, y por ejemplo las 6
        /// actividades van fijas y en orden» (cliente, 25 sep 2026).
        /// Con esto no se arrastran los encabezados y el orden es el
        /// de `columnasDelAula()`, aunque alguien tuviera otro
        /// guardado de antes.
        ordenFijo
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
                Ver a todos
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
              quitar="Ver todas las acciones"
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
              quitar="Ver todos los grupos"
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