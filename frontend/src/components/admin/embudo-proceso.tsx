/** El proceso de inscripción, paso a paso. */

/**
 * Cuántos llegan a cada hito y cuántos se caen entre uno y otro.
 *
 * Sustituye a cinco barras de progreso sueltas que decían el
 * reparto por etapa. El reparto contesta «cuántos hay en cada
 * sitio»; esto contesta «dónde se cae la gente», que es la
 * pregunta que trae a alguien de coordinación a esta pantalla.
 *
 * Los hitos son ACUMULADOS y monótonos: «alcanzó Contactado»
 * incluye a quien ya está inscrito. Contar solo a los que están
 * parados en cada etapa daría un embudo que sube y baja, y un
 * embudo que sube no se puede leer.
 */

import { colorEtapa } from "./etapa";
import { n } from "./graficos";
import type { Etapa } from "@/lib/crm-api";

export type Hito = {
  /**
   * De qué COLOR se pinta. No es la identidad del hito.
   *
   * Dos peldaños distintos pueden compartir etapa con toda la
   * razón: en el panel académico, «Listos para certificar» y
   * «Certificados» son los dos `CERTIFICADO` porque los dos se
   * pintan del verde de esa etapa. Quien lo lea como un
   * identificador se lleva un disgusto —ver la `key` de abajo—.
   */
  etapa: Etapa;
  etiqueta: string;
  /// Cuántos LLEGARON hasta aquí, contando a los que siguieron.
  total: number;
};

export type NotaDelEmbudo = {
  cifra: number;
  etiqueta: string;
  /// El porqué de la cifra, para quien no la vaya a interpretar
  /// igual que quien la puso.
  detalle: string;
  tono?: "marca" | "exito" | "aviso" | "error" | "neutro";
};

const COLOR_TONO: Record<string, string> = {
  marca: "var(--marca)",
  exito: "var(--exito)",
  aviso: "var(--aviso)",
  error: "var(--error)",
  neutro: "var(--texto-suave)",
};

function porcentaje(parte: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((parte / total) * 100)} %`;
}

export function EmbudoProceso({
  hitos,
  notas = [],
  meta = null,
}: {
  hitos: Hito[];
  notas?: NotaDelEmbudo[];
  /// La meta comprometida con el SENA, anclada al último hito.
  ///
  /// Va aquí y no en un tablero aparte: el número solo significa
  /// algo al lado de los que ya entraron.
  meta?: number | null;
}) {
  const primero = hitos[0]?.total ?? 0;
  /// La altura se mide contra el PRIMER hito, no contra el mayor:
  /// así la caída se ve como caída y no como una escalera
  /// renormalizada que siempre llega arriba.
  const alto = (v: number) =>
    primero > 0 ? Math.max(2, Math.round((v / primero) * 100)) : 2;

  return (
    /// A LO ANCHO ENTERO, pero BAJO.
    ///
    /// Un intento anterior lo acotó a `max-w-3xl` y quedó peor:
    /// el embudo se apretaba en la mitad izquierda y la tarjeta
    /// dejaba la otra mitad vacía. Lo que sobraba no era ancho,
    /// era ALTO: barras de 150px, cifras de 26px y las notas
    /// debajo hacían un bloque de media pantalla para cuatro
    /// números. Se recorta el alto y el ancho se respeta.
    <div>
      <div className="flex items-end gap-3">
        {hitos.map((h, i) => {
          const previo = i > 0 ? hitos[i - 1].total : null;
          const caida = previo !== null ? previo - h.total : 0;
          const esUltimo = i === hitos.length - 1;

          return (
            <div
              /// La posición, no la etapa.
              ///
              /// `etapa` es el color y se repite a propósito:
              /// React veía dos hitos `CERTIFICADO` y entendía
              /// que eran el mismo, así que uno de los dos
              /// desaparecía o se duplicaba. Con la etiqueta
              /// delante se lee en las herramientas de React, y
              /// el índice cierra el paso a cualquier repetida
              /// que quede: este embudo es una lista fija, no se
              /// reordena ni se filtra en el navegador.
              key={`${h.etiqueta}#${i}`}
              className="flex min-w-0 flex-1 flex-col items-center"
              title={`${h.etiqueta}: ${n(h.total)} de ${n(primero)} (${porcentaje(h.total, primero)})${
                caida > 0 ? ` · se quedaron ${n(caida)} en el paso anterior` : ""
              }`}
            >
              {/* La caída, encima y en rojo. Es el dato que se
                  viene a buscar, así que va antes que la cifra. */}
              <div className="h-4 text-[0.6875rem] font-bold text-error tabular-nums">
                {caida > 0 ? `▼ −${n(caida)}` : ""}
              </div>

              <div className="text-[1.375rem] leading-none font-bold text-titulo tabular-nums">
                {n(h.total)}
              </div>

              <div className="mt-1.5 flex h-[88px] w-full items-end justify-center">
                <div
                  className="w-2/3 rounded-t-[7px] transition-[height] duration-500"
                  style={{
                    height: `${alto(h.total)}%`,
                    background: colorEtapa(h.etapa),
                  }}
                />
              </div>

              <div className="mt-2 text-center text-[0.75rem] leading-[1.15] font-semibold text-titulo">
                {h.etiqueta}
              </div>
              <div className="mt-0.5 text-[0.6875rem] text-texto-suave tabular-nums">
                {porcentaje(h.total, primero)}
              </div>

              {/* La meta del SENA, colgada del último hito. */}
              {esUltimo && meta !== null && meta > 0 && (
                <div
                  className="mt-1 text-[0.65625rem] font-bold text-marca tabular-nums"
                  title={`Meta comprometida con el SENA: ${n(meta)} beneficiarios`}
                >
                  meta {n(meta)} · {porcentaje(h.total, meta)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {notas.length > 0 && (
        <div className="mt-3 grid gap-2.5 border-t border-hairline pt-3 sm:grid-cols-2 lg:grid-cols-4">
          {notas.map((nt, i) => (
            <div
              key={`${nt.etiqueta}#${i}`}
              className="rounded-[11px] border border-hairline px-3.5 py-2"
              title={nt.detalle}
            >
              <span
                className="block text-[1.375rem] leading-none font-bold tabular-nums"
                style={{ color: COLOR_TONO[nt.tono ?? "neutro"] }}
              >
                {n(nt.cifra)}
              </span>
              <span className="mt-1.5 block text-[0.75rem] leading-snug text-texto-suave">
                {nt.etiqueta}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
