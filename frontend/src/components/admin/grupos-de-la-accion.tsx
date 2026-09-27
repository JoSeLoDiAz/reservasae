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
  const aPintar = grupoId ? suyos.filter((g) => g.id === grupoId) : suyos;

  return (
    <section className="flex flex-col gap-3">
      {/* LOS DESPLEGABLES, ARRIBA DEL TODO. Mandan sobre las
          tarjetas y sobre la tabla: los dos van al servidor. */}
      <div className="flex flex-wrap items-end gap-2">{controles}</div>

      {grupoId && (
        <button
          type="button"
          onClick={() => alElegirGrupo("")}
          className="self-start text-[0.8125rem] font-medium text-marca underline hover:no-underline"
        >
          ← Ver todos los grupos
        </button>
      )}

      {aPintar.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-borde px-6 py-8 text-center">
          <p className="font-medium">Todavía no hay grupos con gente en el aula</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-texto-suave">
            Aparecen en cuanto alguien de un grupo queda matriculado en una
            acción virtual, que son las únicas que el aula sigue.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      )}

      {/* EL DE ABAJO ABRE LA TABLA ENTERA, y por eso ya no se llama
          igual que el de la tarjeta. Los dos decían «Ver inscritos»
          y hacen cosas distintas --aquel entra a UN grupo, este
          enseña a todos--: dos cosas con el mismo nombre en la misma
          pantalla es lo primero que confunde, que es lo que el
          propio cliente señaló del menú el 24 de septiembre. */}
      <button
        type="button"
        onClick={alAlternarTabla}
        aria-expanded={verInscritos}
        className="self-start rounded-lg border border-borde bg-superficie px-3.5 py-2 text-[0.8125rem] font-medium transition hover:border-marca/40"
      >
        {verInscritos ? "Ocultar la tabla" : "Ver todos los inscritos"}
      </button>
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
      {/* LA FRANJA. De `--marca` a `--acento`, y el segundo NO sale
          del gremio a propósito: el handoff fija los `--acento*` en
          CSS, así que el degradado se ve igual de vivo lleve el
          gremio el verde de ADECOPRIA o el azul de BRITCHAM. Con
          `--exito` los dos extremos eran casi el mismo verde y la
          franja se leía como una raya lisa. */}
      <span
        aria-hidden
        className="block h-[3px] w-full"
        style={{
          background:
            "linear-gradient(90deg, var(--marca) 0%, var(--acento) 100%)",
        }}
      />

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="block text-[0.625rem] font-semibold tracking-[0.08em] text-texto-suave uppercase">
              {codigo ? `${codigo} · Grupo` : "Grupo"}
            </span>
            <span className="mt-0.5 block text-[1.75rem] leading-none font-bold text-titulo tabular-nums">
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

        <div className="mt-3.5">
          <CifraConBarra
            etiqueta="Inscritos"
            valor={cupos > 0 ? `${dentro} de ${cupos}` : String(dentro)}
            porcentaje={cupos > 0 ? Math.min(100, (dentro / cupos) * 100) : null}
            tono="var(--marca)"
            pie={
              cupos > 0 ? `${Math.round((dentro / cupos) * 100)} % del cupo` : null
            }
          />
        </div>

        <div className="mt-3 border-t border-hairline pt-3">
          <CifraConBarra
            etiqueta="Avance"
            valor={avance === null ? "—" : `${avance} %`}
            porcentaje={avance}
            tono="var(--acento)"
            pie={
              avance === null
                ? "El aula todavía no manda actividades de este grupo."
                : `Promedio de unidades temáticas de ${conActividades.length} ${
                    conActividades.length === 1 ? "persona" : "personas"
                  }.`
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
        <div className="mt-3.5 border-t border-hairline pt-3">
          <button
            type="button"
            onClick={alVerInscritos}
            title={`Ver a las ${dentro} personas del grupo ${grupo.numero}`}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-marca/35 px-2 py-2 text-[0.8125rem] font-medium text-marca transition hover:border-marca hover:bg-marca-suave"
          >
            <IconoMatriculados tamano={15} />
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
      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-superficie-alterna">
        <span
          className="block h-full rounded-full"
          style={{ width: `${porcentaje ?? 0}%`, background: tono }}
        />
      </span>
      {pie && (
        <span className="mt-1.5 block text-[0.6875rem] text-texto-suave">
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
