"use client";

/** La conclusión, arriba del todo: cómo va la ocupación. */

/**
 * El bloque que contesta la pregunta de la pantalla antes de
 * que haya que bajar a buscarla.
 *
 * Reemplaza a tres cosas que estaban sueltas y se pisaban:
 *
 *   - los dos medidores «Avance sobre la meta» y «Ocupación del
 *     tope», que salían uno al lado del otro con dos
 *     porcentajes distintos y sin decir cuál mirar;
 *   - el bloque «Ritmo de reservas», que vivía al final de la
 *     pantalla, lejos de la cifra que explica.
 *
 * El termómetro es la pieza que arregla lo de los dos
 * porcentajes: son la MISMA barra. Lo ocupado se mide contra el
 * tope con sobrecupo, y la meta comprometida con el SENA es una
 * marca dentro de esa barra. Puestos así se entiende que
 * 14,6 % y 11,2 % no se contradicen: uno se mide contra la
 * marca y el otro contra el final.
 */

import { Chispa, n } from "./graficos";
import { Bloque } from "./piezas";
import { Tendencia, textoDeEstado } from "./ritmo";
import type { InformeProyeccion, PuntoSerie, Resumen } from "@/lib/tableros-api";

export function VeredictoOcupacion({
  resumen,
  serie,
  proyeccion,
}: {
  resumen: Resumen;
  serie: PuntoSerie[];
  proyeccion: InformeProyeccion;
}) {
  const total = proyeccion.total;

  /// Dónde cae la meta dentro de la barra del tope. Es lo que
  /// convierte dos cifras que competían en una sola lectura.
  const marca = resumen.cupos > 0 ? (resumen.metaBase / resumen.cupos) * 100 : 0;
  const relleno = resumen.cupos > 0 ? (resumen.ocupados / resumen.cupos) * 100 : 0;

  return (
    <Bloque
      titulo="Cómo va la ocupación"
      descripcion="La pregunta de esta pantalla, contestada arriba del todo."
    >
      {/* Cuatro columnas en pantalla ancha y dos en media: el
          veredicto, el porqué, el ritmo y el termómetro. */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Bloque plano titulo="Avance sobre la meta">
          <p className="text-[2.5rem] leading-none font-bold tabular-nums text-titulo">
            {resumen.avanceMeta.toFixed(1)}
            <span className="ml-1 text-2xl font-semibold text-texto-suave">%</span>
          </p>
          <p className="mt-2 text-[0.78125rem] leading-relaxed text-texto-suave">
            <strong className="font-semibold text-texto tabular-nums">
              {n(resumen.ocupados)}
            </strong>{" "}
            de {n(resumen.metaBase)} cupos comprometidos. Contra el tope con
            sobrecupo ({n(resumen.cupos)}) va el{" "}
            <span className="tabular-nums">{resumen.avance.toFixed(1)} %</span>.
          </p>
        </Bloque>

        <Bloque plano titulo="Diagnóstico">
          <p className="text-[0.9375rem] font-semibold">
            <Tendencia p={total} />
          </p>
          <p className="mt-2 text-[0.78125rem] leading-relaxed text-texto-suave">
            A{" "}
            <strong className="font-semibold text-texto tabular-nums">
              {total.ritmoDiario.toFixed(1)}
            </strong>{" "}
            cupos al día faltan{" "}
            <strong className="font-semibold text-texto tabular-nums">
              {n(total.faltan)}
            </strong>{" "}
            para la meta. {textoDeEstado(total)}
          </p>
        </Bloque>

        <Bloque plano titulo="Ritmo de reservas" descripcion="Cupos por día, 30 días">
          <Chispa
            datos={serie.map((p) => p.cupos)}
            ancho={220}
            alto={56}
            etiqueta="Cupos reservados por día en los últimos 30 días"
          />
          <p className="mt-2 text-[0.78125rem] text-texto-suave">
            {n(serie.reduce((a, p) => a + p.cupos, 0))} cupos en el periodo.
          </p>
        </Bloque>

        <Bloque plano titulo="La meta dentro del tope">
          {/* La barra es el tope; la marca es la meta. */}
          <div className="relative mt-1 h-3 overflow-hidden rounded-full bg-superficie-alterna">
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

          <div className="mt-2 flex justify-between text-[0.6875rem] text-texto-suave tabular-nums">
            <span>0</span>
            <span className="font-semibold text-titulo">
              meta {n(resumen.metaBase)}
            </span>
            <span>tope {n(resumen.cupos)}</span>
          </div>

          {/* Lo que hay que dejar dicho, porque es de donde sale
              la confusión: el sobrecupo existe para cubrir la
              deserción, no para superar el compromiso. */}
          <p className="mt-2.5 text-[0.78125rem] leading-relaxed text-texto-suave">
            El tope lleva sobrecupo para cubrir deserción.{" "}
            <strong className="font-semibold text-texto">
              El objetivo es la marca, no el final de la barra.
            </strong>
          </p>
        </Bloque>
      </div>
    </Bloque>
  );
}
