/** El embudo, día por día: una barra por día en cada paso. */

/**
 * «Si tengo filtrado el comparativo de una semana, debo tener 7
 * columnas de Entraron con sus cantidades, 7 para Contactados, y
 * así sucesivamente» (Mauricio, 20 sep 2026).
 *
 * El embudo de cuatro barras dice el TOTAL del periodo: sirve para
 * ver dónde se cae la gente, pero no en qué día entró ni qué día se
 * atascó. Esto es lo mismo abierto por día, agrupado POR PASO --que
 * es como se pidió--: cada grupo lleva sus N días en orden.
 *
 * El día es el de ENTRADA de la persona, y el paso es donde va hoy.
 * Por eso las barras de un mismo día bajan de un grupo al
 * siguiente: son la misma gente, más adelante en el proceso.
 */

import { colorEtapa } from "./etapa";
import { n } from "./graficos";
import type { Etapa } from "@/lib/crm-api";

export type DiaDelEmbudo = {
  dia: string;
  entraron: number;
  contactados: number;
  conDatos: number;
  inscritos: number;
};

const PASOS: Array<{
  clave: keyof Omit<DiaDelEmbudo, "dia">;
  etiqueta: string;
  etapa: Etapa;
}> = [
  { clave: "entraron", etiqueta: "Entraron", etapa: "INTERESADO" },
  { clave: "contactados", etiqueta: "Contactados", etapa: "CONTACTADO" },
  { clave: "conDatos", etiqueta: "Con datos", etapa: "DATOS_COMPLETOS" },
  { clave: "inscritos", etiqueta: "Inscritos", etapa: "INSCRITO" },
];

/// Con más de esto, las cifras encima de cada barra se pisan y la
/// fecha debajo también: se dejan solo los extremos.
const CABEN_LAS_CIFRAS = 16;

function diaCorto(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

function soloDia(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric" });
}

export function EmbudoPorDia({ dias }: { dias: DiaDelEmbudo[] }) {
  if (dias.length === 0) {
    return (
      <p className="py-6 text-center text-[0.84375rem] text-texto-suave">
        Sin gente que haya entrado en este periodo.
      </p>
    );
  }

  /// UNA SOLA ESCALA para los cuatro grupos, y es lo que deja
  /// compararlos: con una escala por grupo, «Inscritos: 1» se
  /// pintaría tan alto como «Entraron: 27».
  const tope = Math.max(1, ...dias.map((d) => d.entraron));
  const conCifras = dias.length <= CABEN_LAS_CIFRAS;

  return (
    <div className="space-y-4">
      {PASOS.map((paso) => {
        const total = dias.reduce((t, d) => t + d[paso.clave], 0);
        return (
          <div key={paso.clave}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <h3 className="text-[0.8125rem] font-semibold text-titulo">
                {paso.etiqueta}
              </h3>
              <span className="text-[0.75rem] text-texto-suave tabular-nums">
                {n(total)} en el periodo
              </span>
            </div>

            <div className="flex items-end gap-[3px]">
              {dias.map((d) => {
                const v = d[paso.clave];
                return (
                  <div
                    key={`${paso.clave}-${d.dia}`}
                    className="flex min-w-0 flex-1 flex-col items-center"
                    title={`${diaCorto(d.dia)} · ${paso.etiqueta}: ${n(v)}`}
                  >
                    {conCifras && (
                      <span className="text-[0.6875rem] leading-none font-semibold text-titulo tabular-nums">
                        {n(v)}
                      </span>
                    )}
                    {/* La barra NO ocupa toda la casilla: con siete
                        días eran bloques de 200 px de ancho y 4 de
                        alto, que se leen como una tabla, no como un
                        gráfico. */}
                    <div className="mt-1 flex h-[64px] w-full items-end justify-center">
                      <div
                        className="w-full max-w-[34px] rounded-t-[4px]"
                        style={{
                          height: `${v === 0 ? 2 : Math.max(4, (v / tope) * 100)}%`,
                          background: v === 0 ? "var(--borde)" : colorEtapa(paso.etapa),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Las fechas, UNA vez y debajo de todo: repetidas en los
          cuatro grupos eran cuatro filas de fechas iguales. */}
      <div className="flex gap-[3px] border-t border-hairline pt-1.5">
        {dias.map((d) => (
          <span
            key={`fecha-${d.dia}`}
            className="min-w-0 flex-1 text-center text-[0.625rem] text-texto-suave tabular-nums"
          >
            {conCifras ? diaCorto(d.dia) : soloDia(d.dia)}
          </span>
        ))}
      </div>
    </div>
  );
}
