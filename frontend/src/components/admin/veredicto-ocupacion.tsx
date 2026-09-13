"use client";

/** La conclusión, arriba del todo: cómo va la ocupación. */

/**
 * TRES FRANJAS, no columnas, según el diseño que pasó Mauricio.
 *
 *   1. El veredicto -- el porcentaje a la izquierda y, a la
 *      derecha, la frase que dice si se llega o no. Sobre fondo
 *      tenue, porque es la conclusión y se lee primero.
 *   2. El termómetro a lo ancho: la meta como marca dentro del
 *      tope, con el porqué del sobrecupo debajo.
 *   3. El movimiento: el ritmo de treinta días y el reparto por
 *      modalidad, a media franja cada uno.
 *
 * Antes eran cuatro columnas iguales, y el párrafo largo de la
 * primera estiraba la fila entera dejando las otras tres
 * flotando con aire debajo. Luego fueron dos mitades, y la
 * derecha crecía más que la izquierda. Las franjas resuelven
 * las dos cosas: cada una manda sobre su propio alto y el ancho
 * se reparte donde hace falta.
 *
 * El termómetro es la pieza que arregla lo de los dos
 * porcentajes: son la MISMA barra. Lo ocupado se mide contra el
 * tope con sobrecupo, y la meta comprometida con el SENA es una
 * marca dentro de esa barra. Puestos así se entiende que
 * 7,2 % y 9,3 % no se contradicen: uno se mide contra el final
 * y el otro contra la marca, y ahora los dos salen juntos y
 * rotulados en la misma línea.
 *
 * Y el texto de abajo dice POR QUE existe ese 30 %. Lo pidio
 * Jose: «contra el tope con sobrecupo (4.797)» no explicaba que
 * el margen es por desercion esperada, y sin eso alguien iba a
 * leer 4.797 como la meta.
 *
 * Se llama «Avance de RESERVAS» y no «de inscripciones» aunque
 * asi se pidio, porque la cifra son reservas: `cuposOcupados`
 * lo mueve `reservas.service`, sube cuando una empresa aparta
 * cupos y baja cuando cancela. Una empresa que aparta veinte
 * suma veinte aunque no haya llegado ni una persona. Titularlo
 * «inscripciones» seria hacer que el tablero diga lo que el
 * dato no dice.
 */

import { AreaDeSerie, n } from "./graficos";
import { Bloque } from "./piezas";
import type {
  Analisis,
  InformeProyeccion,
  Proyeccion,
  PuntoSerie,
  Resumen,
} from "@/lib/tableros-api";

const MODALIDAD: Record<string, string> = {
  PRESENCIAL: "Presencial",
  VIRTUAL: "Virtual",
  HIBRIDA: "Híbrida",
};

const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function fechaLarga(iso: string): string {
  return FECHA_LARGA.format(new Date(`${iso}T00:00:00Z`));
}

/** Un decimal y con coma, que es el separador de aquí. */
function dec(valor: number): string {
  return valor.toLocaleString("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-texto-suave">
      {children}
    </h3>
  );
}

export function VeredictoOcupacion({
  resumen,
  serie,
  proyeccion,
  analisis,
}: {
  resumen: Resumen;
  serie: PuntoSerie[];
  proyeccion: InformeProyeccion;
  analisis: Analisis;
}) {
  const total = proyeccion.total;

  /// Dónde cae la meta dentro de la barra del tope. Es lo que
  /// convierte dos cifras que competían en una sola lectura.
  const marca = resumen.cupos > 0 ? (resumen.metaBase / resumen.cupos) * 100 : 0;
  const relleno = resumen.cupos > 0 ? (resumen.ocupados / resumen.cupos) * 100 : 0;

  /// Sillas apartadas sin nadie encima. En negativo quiere
  /// decir que entro gente por su cuenta.
  const brecha = resumen.ocupados - resumen.inscritos;

  /// De mayor a menor oferta: la modalidad que más pesa manda
  /// la lectura.
  const modalidades = [...analisis.modalidad].sort((a, b) => b.cupos - a.cupos);

  return (
    <Bloque sinRelleno partible titulo="Avance de reservas">
      {/* franja 1: el veredicto */}
      {/* Mitad y mitad, IGUAL que la franja del ritmo de abajo:
          con el corte a un tercio, los dos divisores del bloque
          caían en sitios distintos y el conjunto se leía
          desalineado. Que las dos franjas partan por el mismo
          sitio es lo que le da proporción. */}
      <div className="imprimible-franja grid gap-px border-b border-hairline bg-hairline lg:grid-cols-2">
        {/* MÁS BAJO: «redúcele el largo» (cliente, 12 sep 2026).
            El bloque medía 168 px de alto para decir una cifra y
            una frase. La cifra baja de 42 a 34 px --sigue siendo
            lo más grande de la pantalla--, el relleno de 20 a 14,
            y la línea de abajo deja de partirse en dos con un
            `<br>` que no hacía falta: cabe de sobra en media
            pantalla. */}
        <div className="bg-superficie-alterna/45 px-7 py-3.5">
          {/* DOS avances y no uno: una silla apartada por una
              empresa no esta usada. Se usa cuando hay alguien
              inscrito encima (cliente, 13 sep 2026). */}
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <Rotulo>Reservado</Rotulo>
              <p className="mt-1.5 text-[1.75rem] leading-none font-bold tracking-[-0.03em] tabular-nums text-titulo">
                {dec(resumen.avanceMeta)}
                <span className="ml-1 align-top text-base font-semibold text-texto-suave">
                  %
                </span>
              </p>
              <p className="mt-1.5 text-[0.8125rem] leading-snug text-texto-suave">
                <strong className="font-semibold text-texto tabular-nums">
                  {n(resumen.ocupados)}
                </strong>{" "}
                de {n(resumen.metaBase)} sillas apartadas
              </p>
            </div>

            <div>
              <Rotulo>Cupos ya comprometidos</Rotulo>
              <p className="mt-1.5 text-[1.75rem] leading-none font-bold tracking-[-0.03em] tabular-nums text-titulo">
                {dec(resumen.avanceInscritosMeta)}
                <span className="ml-1 align-top text-base font-semibold text-texto-suave">
                  %
                </span>
              </p>
              <p className="mt-1.5 text-[0.8125rem] leading-snug text-texto-suave">
                <strong className="font-semibold text-texto tabular-nums">
                  {n(resumen.inscritos)}
                </strong>{" "}
                de {n(resumen.metaBase)} · inscritos, en formación o
                certificados
              </p>
            </div>
          </div>

          {brecha !== 0 && (
            <p className="mt-3 text-[0.78125rem] leading-snug text-texto-suave">
              {brecha > 0
                ? `Faltan ${n(brecha)} nombres para llenar las sillas apartadas.`
                : `${n(-brecha)} se inscribieron por su cuenta, sin silla apartada detrás.`}
            </p>
          )}
        </div>

        <div className="bg-superficie-alterna/45 px-7 py-3.5">
          <Diagnostico p={total} />
        </div>
      </div>

      {/* franja 2: el termómetro */}
      <div className="imprimible-franja border-b border-hairline px-7 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <Rotulo>La meta dentro del tope</Rotulo>
          <p className="text-[0.78125rem] text-texto-suave tabular-nums">
            <strong className="font-semibold text-texto">
              {dec(resumen.avance)} %
            </strong>{" "}
            del tope ·{" "}
            <strong className="font-semibold text-texto">
              {dec(resumen.avanceMeta)} %
            </strong>{" "}
            de la meta
          </p>
        </div>

        <Termometro
          relleno={relleno}
          marca={marca}
          meta={resumen.metaBase}
          tope={resumen.cupos}
        />

        {/* SIN TOPE DE ANCHO: una sola fila.

            Iba a `max-w-4xl` (896 px) y ahí esta frase ocupa dos
            renglones dejando tres palabras solas en el segundo.
            `text-pretty` no lo arregló --medido: seguía partiendo--
            y el cliente lo volvió a señalar: «te dije esto y no
            quedó, porque dejas un espacio feo acá sabiendo que lo
            puedes dejar en una sola fila» (12 sep 2026).

            Sin tope, en un monitor de 24" cabe entera en un
            renglón. Queda escrito lo que se pierde: en una
            pantalla muy ancha son ~170 caracteres de línea, más de
            lo que se lee cómodo. Es una frase de apoyo de trece
            palabras que se lee una vez, no prosa: el renglón
            suelto molestaba más.

            El comentario de antes decía justo lo contrario --que
            el tope no se quitaba-- y se queda como aviso de que ya
            se probó lo otro. */}
        {/* `text-pretty` Y NO un tope más ancho.

            El cliente preguntó por qué se parte (12 sep 2026), y
            se partía dejando «final de la barra.» sola en el
            segundo renglón. El tope de ancho no es el problema y
            no se quita: sin él, en un monitor de 24" esta frase
            sería una línea de casi 200 caracteres, que es de las
            cosas que más cuesta leer. Lo que estaba mal era DÓNDE
            caía el corte.

            `text-wrap: pretty` reparte los últimos renglones para
            que no quede una palabra o cuatro solas. Es la misma
            familia que el `text-balance` del titular del acceso, y
            aquí es `pretty` y no `balance` porque son varias
            líneas de prosa y no un titular de dos. */}
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-pretty text-texto-suave">
          El tope de {n(resumen.cupos)} son los {n(resumen.metaBase)}{" "}
          comprometidos más el 30 % de sobrecupo que autoriza el SENA para
          cubrir deserción.{" "}
          <strong className="font-semibold text-texto">
            El objetivo es la marca, no el final de la barra.
          </strong>
        </p>
      </div>

      {/* franja 3: el movimiento */}
      <div className="imprimible-franja grid gap-px bg-hairline lg:grid-cols-2">
        <div className="bg-superficie px-7 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <Rotulo>Ritmo de reservas · 30 días</Rotulo>
            <p className="text-[0.78125rem] text-texto-suave tabular-nums">
              <strong className="font-semibold text-texto">
                {n(serie.reduce((a, p) => a + p.cupos, 0))}
              </strong>{" "}
              cupos en el periodo
            </p>
          </div>

          <div className="mt-3">
            <AreaDeSerie
              datos={serie.map((p) => p.cupos)}
              alto={96}
              desde="hace 30 días"
              hasta="hoy"
              etiqueta="Cupos reservados por día en los últimos 30 días"
            />
          </div>
        </div>

        <div className="bg-superficie px-7 py-5">
          <Rotulo>Por modalidad</Rotulo>

          {modalidades.length === 0 ? (
            <p className="mt-4 text-[0.8125rem] text-texto-suave">
              Todavía no hay oferta cargada.
            </p>
          ) : (
            <div className="mt-3.5 flex flex-col gap-3.5">
              {modalidades.map((m) => {
                const pct = m.cupos > 0 ? (m.ocupados / m.cupos) * 100 : 0;
                return (
                  <div key={m.nombre}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="text-[0.875rem]">
                        {MODALIDAD[m.nombre] ?? m.nombre}
                      </span>
                      <span className="text-[0.78125rem] text-texto-suave tabular-nums">
                        <strong className="font-semibold text-texto">
                          {n(m.ocupados)}
                        </strong>{" "}
                        de {n(m.cupos)} · {dec(pct)} %
                      </span>
                    </div>
                    <div
                      role="meter"
                      aria-valuenow={m.ocupados}
                      aria-valuemin={0}
                      aria-valuemax={m.cupos}
                      aria-label={`${MODALIDAD[m.nombre] ?? m.nombre}: ${n(
                        m.ocupados,
                      )} de ${n(m.cupos)}`}
                      className="h-2.5 w-full overflow-hidden rounded-full bg-superficie-alterna"
                    >
                      <div
                        className="h-full rounded-full bg-marca transition-[width] duration-500"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Bloque>
  );
}

/**
 * El veredicto en una frase, no en una etiqueta.
 *
 * Decía «▼ Ritmo a la baja» y Mauricio preguntó qué quería
 * decir, que es la prueba de que la etiqueta no trabajaba: una
 * tendencia no es una conclusión. Ahora el titular contesta la
 * pregunta --si se llega o no-- y el cuerpo pone las cifras que
 * lo sostienen: a qué ritmo, cuánto falta, cuándo cierra y
 * cuántos cupos quedarían fuera.
 */
function Diagnostico({ p }: { p: Proyeccion }) {
  const v = veredicto(p);

  return (
    <div className="flex gap-3.5">
      <span
        aria-hidden
        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${v.fondo}`}
      >
        <Flecha hacia={v.flecha} />
      </span>

      <div className="min-w-0">
        <h3 className={`text-[1.0625rem] font-bold ${v.color}`}>{v.titulo}</h3>
        <p className="mt-1.5 max-w-prose text-[0.8125rem] leading-relaxed text-texto-suave">
          {v.cuerpo}
        </p>
      </div>
    </div>
  );
}

type Veredicto = {
  titulo: string;
  cuerpo: React.ReactNode;
  color: string;
  fondo: string;
  flecha: "sube" | "baja" | "plano";
};

function veredicto(p: Proyeccion): Veredicto {
  const ritmo = (
    <strong className="font-semibold text-texto tabular-nums">
      {dec(p.ritmoDiario)}
    </strong>
  );
  const faltan = (
    <strong className="font-semibold text-texto tabular-nums">{n(p.faltan)}</strong>
  );

  if (p.estado === "CUMPLIDA") {
    return {
      titulo: "Meta cumplida",
      cuerpo: (
        <>
          Los {n(p.meta)} cupos comprometidos ya tienen a alguien inscrito
          encima.
        </>
      ),
      color: "text-exito",
      fondo: "bg-exito-suave",
      flecha: "sube",
    };
  }

  if (p.estado === "SIN_META") {
    return {
      titulo: "Sin meta registrada",
      cuerpo: (
        <>
          No hay cupos comprometidos cargados contra los que medir el avance.
        </>
      ),
      color: "text-titulo",
      fondo: "bg-superficie-alterna",
      flecha: "plano",
    };
  }

  if (p.cronograma === "CERRADA" && p.cierre) {
    return {
      titulo: "La convocatoria ya cerró",
      cuerpo: (
        <>
          Cerró el <strong className="font-semibold text-texto">{fechaLarga(p.cierre)}</strong>{" "}
          y quedaron {faltan} cupos sin llenar.
        </>
      ),
      color: "text-titulo",
      fondo: "bg-superficie-alterna",
      flecha: "plano",
    };
  }

  if (p.cronograma === "ALCANZA" && p.cierre) {
    return {
      titulo: "A este ritmo alcanza",
      cuerpo: (
        <>
          Con {ritmo} cupos al día faltan {faltan} para la meta, y la
          convocatoria no cierra hasta el{" "}
          <strong className="font-semibold text-texto">{fechaLarga(p.cierre)}</strong>.
        </>
      ),
      color: "text-exito",
      fondo: "bg-exito-suave",
      flecha: "sube",
    };
  }

  if (p.cronograma === "NO_ALCANZA" && p.cierre) {
    return {
      titulo: "A este ritmo no alcanza",
      cuerpo: (
        <>
          Con {ritmo} cupos al día faltan {faltan} para la meta. La convocatoria
          cierra el{" "}
          <strong className="font-semibold text-texto">{fechaLarga(p.cierre)}</strong>{" "}
          y quedarían{" "}
          <strong className="font-semibold text-aviso tabular-nums">
            {n(p.faltaranAlCierre ?? p.faltan)} cupos sin llenar
          </strong>
          .
        </>
      ),
      color: "text-aviso",
      fondo: "bg-aviso-suave",
      flecha: "baja",
    };
  }

  /// Sin cronograma no hay plazo contra el que juzgar, así que
  /// no se dice «alcanza» ni «no alcanza»: se dice qué falta
  /// para poder decirlo, que es lo accionable.
  return {
    titulo: "Sin fecha de cierre en el cronograma",
    cuerpo: (
      <>
        Con {ritmo} cupos al día faltan {faltan} para la meta. Hasta que los
        grupos tengan fecha de inicio no se puede decir si alcanza.
      </>
    ),
    color: "text-aviso",
    fondo: "bg-aviso-suave",
    flecha: "plano",
  };
}

function Flecha({ hacia }: { hacia: "sube" | "baja" | "plano" }) {
  const trazo =
    hacia === "sube"
      ? "M3 12l4-5 3 3 5-6"
      : hacia === "baja"
        ? "M3 6l4 5 3-3 5 6"
        : "M3 9h12";

  return (
    <svg
      viewBox="0 0 18 18"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={trazo} />
    </svg>
  );
}

/** La barra del tope, con la meta marcada dentro. */
function Termometro({
  relleno,
  marca,
  meta,
  tope,
}: {
  relleno: number;
  marca: number;
  meta: number;
  tope: number;
}) {
  return (
    <div className="mt-5">
      {/* El rótulo de la meta va ENCIMA de su marca, no en el
          centro de la barra: puesto en el centro parecía el
          título de la barra entera en vez de la etiqueta de una
          posición. */}
      <div className="relative mb-1 h-4">
        <span
          className="absolute -translate-x-1/2 text-[0.6875rem] font-semibold whitespace-nowrap text-titulo tabular-nums"
          style={{ left: `${Math.min(Math.max(marca, 6), 94)}%` }}
        >
          meta {n(meta)}
        </span>
      </div>

      <div className="relative h-3.5 overflow-hidden rounded-full bg-superficie-alterna">
        <div
          className="h-full rounded-full bg-marca"
          style={{ width: `${Math.min(relleno, 100)}%` }}
        />
        <span
          aria-hidden
          className="absolute inset-y-0 w-0.5 bg-titulo"
          style={{ left: `${Math.min(marca, 100)}%` }}
        />
      </div>

      <div className="mt-1.5 flex justify-between text-[0.6875rem] text-texto-suave tabular-nums">
        <span>0</span>
        <span>tope {n(tope)}</span>
      </div>
    </div>
  );
}
