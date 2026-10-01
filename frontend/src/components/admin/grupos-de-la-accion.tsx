"use client";

import {
  IconoCheckCirculo,
  IconoMatriculados,
  IconoReloj,
} from "./iconos";
import type { FilaAcademica } from "@/lib/crm-api";

type Grupo = {
  id: string;
  numero: number;
  accionFormacionId: string | null;
  cupos?: number;
  meta?: number;
};

/**
 * Los grupos de una acción, en tarjetas, sobre la tabla del aula.
 *
 * Lo pidió Josse el 26 sep 2026 mirando el SEP: «yo selecciono una
 * [acción] y me sale el encuadre de los grupos que haya; entonces me
 * llega el total de inscritos y el avance por grupo».
 *
 * RESPONDE «CÓMO VA EL GRUPO», que es la primera pregunta. La tabla
 * responde «quién», y por eso baja detrás de un botón.
 *
 * NO INVENTA NINGUNA CIFRA QUE NO ESTÉ: el numerador sale de las
 * personas que ya viajan --las mismas que pinta la tabla-- y el
 * denominador del servidor. Si el backend no manda el cupo, la
 * tarjeta dice «40» a secas en vez de «40 de 0».
 */
export function GruposDeLaAccion({
  controles,
  accionFormacionId,
  grupoId,
  acciones,
  grupos,
  personas,
  alElegirGrupo,
  alElegirAccion,
  verInscritos,
  alAlternarTabla,
}: {
  /// Los dos desplegables de servidor --acción y grupo--. Viven
  /// AQUÍ y no dentro de la tabla: cuando estaban allá, plegarla se
  /// los llevaba y la pantalla se quedaba pidiendo que se eligiera
  /// una acción sin ningún sitio donde elegirla.
  controles: React.ReactNode;
  accionFormacionId: string;
  grupoId: string;
  acciones: Array<{ id: string; codigo: string; nombre: string }>;
  grupos: Grupo[];
  personas: FilaAcademica[];
  alElegirGrupo: (id: string) => void;
  /// Para que la tarjeta macro pueda entrar en su acción.
  alElegirAccion: (id: string) => void;
  verInscritos: boolean;
  alAlternarTabla: () => void;
}) {
  /**
   * SE PINTAN SIEMPRE, TAMBIÉN EN CERO (Josse, 26 sep 2026: «así
   * estén vacías, si están en 0 pues también mostrar, no importa»).
   *
   * Sin acción elegida salen TODOS los grupos que hay en el aula, no
   * los sesenta y siete del catálogo: esta lista ya viene acotada a
   * quien tiene gente dentro.
   */
  const codigoDe = new Map(acciones.map((a) => [a.id, a.codigo]));

  const suyos = accionFormacionId
    ? grupos.filter((g) => g.accionFormacionId === accionFormacionId)
    : grupos;
  /// Con un grupo puesto, el servidor ya solo manda a SU gente: de
  /// los demás no hay con qué pintar la tarjeta, y una en cero sería
  /// afirmar que ese grupo está vacío. Se enseña el suyo y la puerta
  /// de vuelta.
  /**
   * LAS TARJETAS QUE SE PINTAN.
   *
   * LA REGLA: O EL ESCOGEDOR O LA TABLA, NUNCA LOS DOS.
   *
   * «Cuando le doy limpiar se ven esas dos tarjetas, todo feo»
   * (cliente, 1 oct 2026), y antes «¿por qué esto así?» con las
   * tarjetas de acción encima de una tabla de 167 personas.
   *
   * Las tarjetas ---de acción o de grupo--- son el ESCOGEDOR, y la
   * tabla es el RESULTADO. Juntas, la pantalla pregunta y responde a
   * la vez, y encima con recortes distintos: las tarjetas separan por
   * grupo y la tabla los junta. Con la tabla abierta manda la tabla,
   * que es lo que se pidió ver; para volver al escogedor está
   * «Ocultar la tabla», que queda justo encima.
   *
   * Con un grupo elegido NO SE PINTA NINGUNA: «cuando uno la
   * seleccione que se oculte esto, no porque vea eso cómo se ve de
   * fatal; que quede solo "Ver todos los grupos / Ocultar la tabla" y
   * la tarjeta se oculte» (cliente, 1 oct 2026).
   *
   * Tiene razón: una sola tarjeta suelta a la izquierda, con la
   * pantalla entera vacía a su derecha y la tabla debajo, no informa
   * de nada que no diga ya la miga de arriba ---qué acción, qué grupo,
   * cuántas personas--- y encima empuja la tabla, que es a lo que se
   * entra. Las tarjetas son para ELEGIR grupo; elegido ya, sobran.
   */
  const aPintar = grupoId || verInscritos ? [] : suyos;

  /**
   * SIN ACCIÓN ELEGIDA SE VEN LAS ACCIONES, NO LOS GRUPOS.
   *
   * «Se me ocurre lo siguiente: primero como las 3 tarjetas macro,
   * no? Luego las de sus grupos, no?» (cliente, 1 oct 2026), con
   * cuarenta tarjetas de grupo delante.
   *
   * Tiene razón y es la misma idea de siempre: de lo general a lo
   * particular. Cuarenta tarjetas mezcladas de AF1, AF2 y AF3 no se
   * comparan entre sí ---el «Grupo 4» de AF1 y el de AF2 son dos
   * cosas--- y obligan a leer el código de arriba de cada una para
   * saber de qué formación es. Agrupadas por acción son tres o cuatro
   * tarjetas, se comparan de un vistazo, y se entra a la que interesa.
   *
   * Solo las acciones QUE TIENEN gente en el aula: `grupos` ya viene
   * acotado a eso, así que se deducen de ahí y no del catálogo.
   */
  const conGrupos = acciones.filter((a) =>
    grupos.some((x) => x.accionFormacionId === a.id),
  );
  /**
   * ...Y NO CUANDO LA TABLA YA ESTÁ ABIERTA CON TODO EL MUNDO.
   *
   * «¿Por qué esto así?» (cliente, 1 oct 2026), con las dos tarjetas
   * de acción encima de una tabla de 167 personas de todas las
   * acciones.
   *
   * Tiene razón y la incoherencia es de este componente: las tarjetas
   * son el ESCOGEDOR ---de qué acción quiere ver los grupos--- y la
   * tabla es el RESULTADO. Teniéndolas a la vez, la pantalla pregunta
   * y responde al mismo tiempo, con dos recortes distintos: las
   * tarjetas separan por acción y la tabla las junta todas.
   *
   * Con la tabla abierta manda la tabla: es lo que se pidió ver. Para
   * volver al escogedor está «Ocultar la tabla», que es justo lo que
   * hay encima.
   */
  const porAccion =
    !accionFormacionId && !grupoId && !verInscritos && conGrupos.length > 1;

  return (
    <section className="flex flex-col gap-3">
      {/* LOS DESPLEGABLES, ARRIBA DEL TODO. Mandan sobre las
          tarjetas y sobre la tabla: los dos van al servidor.

          Y LAS DOS PUERTAS ---volver a los grupos, cerrar la tabla---
          EN ESTA MISMA FILA: «cómo se acomoda esto, porque mucha cosa
          arriba y prácticamente la tabla se va a perder» (cliente, 1
          oct 2026). Con un grupo puesto había seis bandas antes de la
          tabla; dos de ellas llevaban un enlace cada una. */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">{controles}</div>
        {/* VOLVER A LOS GRUPOS Y CERRAR LA TABLA, en la misma fila y
            como ENLACES, no como botones: la navegación hacia atrás es
            un enlace y los botones son acciones --regla del handoff--.
            Aquí estaba el segundo «Ver inscritos» y se fue: dos cosas
            con el mismo nombre en la misma pantalla es lo primero que
            confunde (lo señalaron el 27 sep 2026). Ahora la única
            puerta a la tabla es el botón de cada tarjeta, y de ahí se
            sale por «Ver todos los grupos», que la deja abierta con
            todo el mundo dentro. */}
        {(grupoId || verInscritos) && (
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 pb-1.5 text-[0.8125rem]">
            {grupoId && (
              <button
                type="button"
                onClick={() => alElegirGrupo("")}
                className="font-medium text-marca underline hover:no-underline"
              >
                ← Ver todos los grupos
              </button>
            )}
            {verInscritos && (
              <button
                type="button"
                onClick={alAlternarTabla}
                aria-expanded
                className="text-texto-suave underline hover:text-texto"
              >
                Ocultar la tabla
              </button>
            )}
          </div>
        )}
      </div>

      {!grupoId && aPintar.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-borde px-6 py-8 text-center">
          <p className="font-medium">Todavía no hay grupos con gente en el aula</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-texto-suave">
            Aparecen en cuanto alguien de un grupo queda matriculado en una
            acción virtual, que son las únicas que el aula sigue.
          </p>
        </div>
      ) : porAccion ? (
        /// DE LADO A LADO Y NO EN REJILLA FIJA: «no sé cómo hacer para
        /// que queden de lado a lado, es que se ve raro» (cliente, 1
        /// oct 2026). Con cuatro columnas clavadas y solo dos acciones
        /// con gente en el aula, las dos tarjetas quedaban a la
        /// izquierda y media fila en blanco. Repartidas, dos ocupan
        /// media pantalla cada una, tres un tercio, y de cinco en
        /// adelante bajan solas al pasar de los 18 rem ---el mismo
        /// reparto de las tarjetas de cifras de arriba---.
        <div className="flex flex-wrap items-stretch gap-2.5 [&>*]:min-w-[18rem] [&>*]:flex-1">
          {conGrupos.map((a) => (
            <TarjetaDeAccion
              key={a.id}
              accion={a}
              grupos={grupos.filter((x) => x.accionFormacionId === a.id).length}
              cupos={grupos
                .filter((x) => x.accionFormacionId === a.id)
                .reduce((t, x) => t + (x.cupos ?? 0), 0)}
              suya={personas.filter((p) => p.accionFormacionId === a.id)}
              alEntrar={() => alElegirAccion(a.id)}
            />
          ))}
        </div>
      ) : aPintar.length > 0 ? (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {/* CUATRO POR FILA Y NO CINCO: «acomódalo, o sea son 8, cuatro
              y cuatro, no?» (cliente, 1 oct 2026). Con cinco columnas
              los ocho grupos salían 5 y 3: una fila coja y un hueco a
              la derecha. */}
          {aPintar.map((g) => (
            <TarjetaDeGrupo
              key={g.id}
              grupo={g}
              codigo={accionFormacionId ? null : (codigoDe.get(g.accionFormacionId ?? "") ?? null)}
              /// POR ACCIÓN Y POR NÚMERO, no solo por número: hay un
              /// «Grupo 4» en AF1 y otro en AF2, así que sin acción
              /// elegida el numerador mezclaría dos grupos distintos
              /// bajo la misma tarjeta.
              suya={personas.filter(
                (p) =>
                  p.grupo === g.numero &&
                  p.accionFormacionId === g.accionFormacionId,
              )}
              elegido={g.id === grupoId}
              alVerInscritos={() => alElegirGrupo(g.id === grupoId ? "" : g.id)}
            />
          ))}
        </div>
      ) : null}

    </section>
  );
}


/**
 * Una tarjeta de grupo, con la forma que pidió Josse (26 sep 2026).
 *
 * Sale del SEP —otro proyecto, del que se copia SOLO LA FORMA—:
 * franja de color arriba, el número grande, dos píldoras de
 * porcentaje en la esquina, y cada cifra con su barra y su pie.
 *
 * LO QUE NO SE COPIA, y conviene decirlo: allá la tarjeta lleva tres
 * botones dentro —Beneficiarios, Cobertura, Certificar—. Aquí la
 * acción es UNA y vive abajo, fuera de las tarjetas, porque así se
 * pidió: «solo un botón abajo que diga ver inscritos».
 *
 * Y NINGUNA CIFRA ES INVENTADA. Las dos píldoras salen de estados
 * que el aula ya calcula por persona; si un grupo no tiene a nadie
 * en ese estado, la píldora NO se pinta en vez de decir 0 %.
 */
/**
 * UNA ACCIÓN DE FORMACIÓN ENTERA, para elegir en cuál entrar.
 *
 * Enseña lo mismo que la de grupo ---cuántos dentro, cuánto avance---
 * porque es la misma pregunta una talla más arriba, y añade de cuántos
 * grupos se compone, que es lo que dice si vale la pena entrar.
 */
function TarjetaDeAccion({
  accion,
  grupos,
  cupos,
  suya,
  alEntrar,
}: {
  accion: { id: string; codigo: string; nombre: string };
  grupos: number;
  /// Los cupos de sus grupos sumados: el mismo «de cuántos» de la
  /// tarjeta de grupo, una talla más arriba.
  cupos: number;
  suya: FilaAcademica[];
  alEntrar: () => void;
}) {
  /// EL MISMO PROMEDIO QUE LA TARJETA DE GRUPO, y por lo mismo: solo
  /// cuenta a quien tiene actividades cargadas. Ver el porqué allá.
  const conActividades = suya.filter((p) => p.total > 0);
  const avance =
    conActividades.length > 0
      ? Math.round(
          conActividades.reduce((a, p) => a + p.porcentaje, 0) /
            conActividades.length,
        )
      : null;
  const certificados = suya.filter((p) => p.estado === "CERTIFICADO").length;
  const atrasados = suya.filter((p) => p.estado === "ATRASADO").length;
  const pct = (n: number) => (suya.length > 0 ? Math.round((n / suya.length) * 100) : 0);

  return (
    <div className="overflow-hidden rounded-xl border border-borde bg-superficie text-left">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="block text-[0.625rem] font-semibold tracking-[0.08em] text-texto-suave uppercase">
              Acción de formación
            </span>
            <span className="mt-0.5 block text-[1.375rem] leading-none font-bold text-titulo">
              {accion.codigo}
            </span>
          </div>

          {/* LAS MISMAS DOS PÍLDORAS QUE LA TARJETA DE GRUPO, y por lo
              mismo: aquí un cero no es un vacío, es la respuesta. */}
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <Pildora
              tono="var(--exito)"
              icono={<IconoCheckCirculo tamano={12} />}
              titulo={`${certificados} de ${suya.length} ya certificados`}
            >
              {pct(certificados)} %
            </Pildora>
            <Pildora
              tono="var(--aviso)"
              icono={<IconoReloj tamano={12} />}
              titulo={`${atrasados} de ${suya.length} atrasados frente a su calendario`}
            >
              {pct(atrasados)} %
            </Pildora>
          </div>
        </div>

        {/* EL NOMBRE, A DOS RENGLONES. Los de ADECOPRIA miden hasta
            noventa caracteres y a renglón corrido una tarjeta medía el
            doble que su vecina. */}
        <p className="mt-1 line-clamp-2 text-[0.75rem] leading-snug text-texto-suave">
          {accion.nombre}
        </p>

        <div className="mt-2">
          <CifraConBarra
            etiqueta="En el aula"
            valor={cupos > 0 ? `${suya.length} de ${cupos}` : String(suya.length)}
            porcentaje={cupos > 0 ? Math.min(100, (suya.length / cupos) * 100) : null}
            tono="var(--marca)"
            pie={null}
          />
        </div>

        <div className="mt-2">
          <CifraConBarra
            etiqueta="Avance"
            valor={avance === null ? "—" : `${avance} %`}
            porcentaje={avance}
            tono="var(--exito)"
            pie={
              conActividades.length > 0
                ? `Promedio de ${conActividades.length} ${conActividades.length === 1 ? "persona" : "personas"} con actividades.`
                : "Todavía nadie tiene actividades cargadas."
            }
          />
        </div>

        <button
          type="button"
          onClick={alEntrar}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-borde px-3 py-1.5 text-[0.8125rem] font-medium text-marca transition hover:border-marca"
        >
          Ver sus {grupos === 1 ? "grupo" : `${grupos} grupos`}
        </button>
      </div>
    </div>
  );
}

function TarjetaDeGrupo({
  grupo,
  codigo,
  suya,
  elegido,
  alVerInscritos,
}: {
  grupo: Grupo;
  /// Solo cuando se ven las de varias acciones a la vez.
  codigo: string | null;
  suya: FilaAcademica[];
  elegido: boolean;
  alVerInscritos: () => void;
}) {
  const dentro = suya.length;
  const cupos = grupo.cupos ?? 0;

  /**
   * EL AVANCE ES EL PROMEDIO DE LAS PERSONAS, no el de las
   * actividades sumadas.
   *
   * Josse lo pidió así: «el avance general de las unidades temáticas
   * cumplidas, o sea el promedio de todos los participantes de ese
   * grupo». Sumar hechas contra totales daría otra cifra —pesa más
   * quien tiene más actividades— y las dos son ciertas, así que se
   * calcula la que se pidió y se nombra por lo que es.
   *
   * Solo cuenta a quien TIENE actividades cargadas: con el LMS sin
   * conectar hay gente con `total` en cero, y meterla como un cero
   * hundiría el promedio de un grupo que va bien.
   */
  const conActividades = suya.filter((p) => p.total > 0);
  const avance =
    conActividades.length > 0
      ? Math.round(
          conActividades.reduce((a, p) => a + p.porcentaje, 0) /
            conActividades.length,
        )
      : null;

  /// Las dos de la esquina, del reparto que el aula ya calcula por
  /// persona. No es una cuenta nueva: son dos de los seis estados
  /// que ya se pintan arriba en las tarjetas grandes.
  const certificados = suya.filter((p) => p.estado === "CERTIFICADO").length;
  const atrasados = suya.filter((p) => p.estado === "ATRASADO").length;
  const pct = (n: number) => (dentro > 0 ? Math.round((n / dentro) * 100) : 0);

  return (
    /**
     * LA TARJETA ES UN `div`, Y ESO ES OBLIGATORIO.
     *
     * Era un `<button>` entero, y en cuanto entran los botoncitos de
     * abajo eso se vuelve un botón dentro de otro: HTML inválido, y
     * el navegador lo repara sacándolos fuera —con lo que dejan de
     * estar donde se ven—. La acción baja a los botones, que es
     * además donde se lee qué hace cada una.
     */
    <div
      className={`overflow-hidden rounded-xl border bg-superficie text-left transition ${
        elegido ? "border-marca" : "border-borde hover:border-marca/40"
      }`}
    >
      {/* SIN LA FRANJA DE COLORES ARRIBA: «sin este reborde» (cliente,
          1 oct 2026). Con ocho tarjetas eran ocho degradados compitiendo
          con las cifras, que es lo que se viene a leer. */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="block text-[0.625rem] font-semibold tracking-[0.08em] text-texto-suave uppercase">
              {codigo ? `${codigo} · Grupo` : "Grupo"}
            </span>
            <span className="mt-0.5 block text-[1.375rem] leading-none font-bold text-titulo tabular-nums">
              {grupo.numero}
            </span>
          </div>

          {/* LAS DOS PÍLDORAS, SIEMPRE, también en cero.
              Estuvieron escondidas cuando no había nadie detrás, con
              el argumento de que un «0 %» repetido es ruido; Josse
              las quiere puestas --«eso deberías dejarlo»--, y tiene
              razón para esta pantalla: aquí un cero NO es un vacío,
              es la respuesta. Que un grupo lleve 0 % certificado es
              justo lo que se viene a mirar. */}
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <Pildora
              tono="var(--exito)"
              icono={<IconoCheckCirculo tamano={12} />}
              titulo={`${certificados} de ${dentro} ya certificados`}
            >
              {pct(certificados)} %
            </Pildora>
            <Pildora
              tono="var(--aviso)"
              icono={<IconoReloj tamano={12} />}
              titulo={`${atrasados} de ${dentro} atrasados frente a su calendario`}
            >
              {pct(atrasados)} %
            </Pildora>
          </div>
        </div>

        <div className="mt-2">
          <CifraConBarra
            etiqueta="Inscritos"
            valor={cupos > 0 ? `${dentro} de ${cupos}` : String(dentro)}
            porcentaje={cupos > 0 ? Math.min(100, (dentro / cupos) * 100) : null}
            tono="var(--marca)"
            /// sin pie: lo decian ya el valor y la barra
            pie={null}
          />
        </div>

        <div className="mt-2">
          <CifraConBarra
            etiqueta="Avance"
            valor={avance === null ? "—" : `${avance} %`}
            porcentaje={avance}
            tono="var(--acento)"
            pie={
              avance === null
                ? "El aula todavía no manda actividades."
                : `Promedio de ${conActividades.length} ${
                    conActividades.length === 1 ? "persona" : "personas"
                  } con actividades.`
            }
          />
        </div>

        {/* EL BOTÓN, UNO SOLO Y CON COLOR. Es el «Beneficiarios» de
            aquella pantalla: mismo sitio, misma forma, y lleva a lo
            mismo --a la gente del grupo--.
            «Cronograma» se fue: Josse lo pidió fuera. Y «Certificar»
            nunca entró, porque se certifica PERSONA a persona contra
            el 80 % de lo obligatorio: un botón así en la tarjeta de
            un grupo sería un control en pie y vacío de efecto.
            El color sale de `--marca`, o sea del gremio: escrito a
            fuego, este botón se quedaría verde en el gremio azul. */}
        <div className="mt-2 border-t border-hairline pt-2">
          <button
            type="button"
            onClick={alVerInscritos}
            title={`Ver a las ${dentro} personas del grupo ${grupo.numero}`}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-marca/35 px-2 py-1 text-[0.75rem] font-medium text-marca transition hover:border-marca hover:bg-marca-suave"
          >
            <IconoMatriculados tamano={14} />
            Ver inscritos
          </button>
        </div>
      </div>
    </div>
  );
}

/** Una cifra con su barra y su pie: el bloque que se repite. */
function CifraConBarra({
  etiqueta,
  valor,
  porcentaje,
  tono,
  pie,
}: {
  etiqueta: string;
  valor: string;
  /// Null cuando no hay de dónde sacarla: la barra sale vacía y el
  /// pie dice por qué, en vez de pintar un cero que parece un dato.
  porcentaje: number | null;
  tono: string;
  pie: string | null;
}) {
  return (
    <>
      <span className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
        <span className="text-texto-suave">{etiqueta}</span>
        <span className="font-semibold tabular-nums">{valor}</span>
      </span>
      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-superficie-alterna">
        <span
          className="block h-full rounded-full"
          style={{ width: `${porcentaje ?? 0}%`, background: tono }}
        />
      </span>
      {pie && (
        <span className="mt-1 block text-[0.6875rem] leading-snug text-texto-suave">
          {pie}
        </span>
      )}
    </>
  );
}

/**
 * La píldora teñida de la esquina.
 *
 * Tiñe la superficie con su PROPIO color (`color-mix`), que es el
 * mecanismo que ya usa `.pildora-etapa`: así el par que se mide es el
 * color contra `superficie`, y el tono vale en claro y en oscuro sin
 * escribir dos hex. El icono acompaña y el número se lee solo: el
 * color nunca es lo único que distingue.
 */
function Pildora({
  tono,
  icono,
  titulo,
  children,
}: {
  tono: string;
  icono: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={titulo}
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums"
      style={{
        color: tono,
        background: `color-mix(in srgb, ${tono} 12%, transparent)`,
      }}
    >
      {icono}
      {children}
    </span>
  );
}
