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

/// «antes: 58 · +4», en gris.
///
/// SIN verde ni rojo: los del periodo anterior tuvieron más tiempo
/// para avanzar, así que un «menos» en los pasos de abajo no es
/// que vaya peor (José, 18 sep 2026). El color afirmaría eso; el
/// número solo lo cuenta. Dice «antes» y no el nombre del periodo
/// porque ese nombre puede ser largo --«el mismo tramo del periodo
/// anterior»-- y repetido cuatro veces tapaba las barras; va UNA
/// vez, al pie.
function ContraAntes({
  ahora,
  antes,
  etiqueta,
}: {
  ahora: number;
  antes: number;
  etiqueta: string | null;
}) {
  const d = ahora - antes;
  return (
    <div
      className="mt-1 text-center text-[0.6875rem] leading-tight text-texto-suave tabular-nums"
      title={`${etiqueta ?? "Antes"}: ${n(antes)}`}
    >
      antes: {n(antes)}
      {d !== 0 && (
        <span className="ml-1 font-semibold">
          {d > 0 ? "+" : "−"}
          {n(Math.abs(d))}
        </span>
      )}
    </div>
  );
}

export function EmbudoProceso({
  hitos,
  notas = [],
  meta = null,
  antes = null,
  etiquetaAntes = null,
  resumen = null,
}: {
  hitos: Hito[];
  notas?: NotaDelEmbudo[];
  /// La meta comprometida con el SENA, anclada al último hito.
  ///
  /// Va aquí y no en un tablero aparte: el número solo significa
  /// algo al lado de los que ya entraron.
  meta?: number | null;
  /// La cifra de cada hito en el periodo con el que se compara,
  /// en el mismo orden. Null = no se compara.
  ///
  /// Va DEBAJO y en palabras --«ayer: 58»-- y no con otra flecha:
  /// arriba ya hay una, la de la caída entre pasos, y dos flechas
  /// rojas que miden cosas distintas fue justo lo que no se
  /// entendía (18 sep 2026).
  antes?: number[] | null;
  etiquetaAntes?: string | null;
  /**
   * La misma historia EN UNA FRASE, encima de las barras.
   *
   * «No lo entiendo de ninguna manera... necesito que ese reporte
   * se entienda» (Mauricio, 20 sep 2026). Cuatro barras con
   * porcentajes son un dibujo; la frase dice qué preguntan.
   */
  resumen?: React.ReactNode;
}) {
  const primero = hitos[0]?.total ?? 0;
  /**
   * La altura se mide contra el PRIMER hito, no contra el mayor:
   * así la caída se ve como caída y no como una escalera
   * renormalizada que siempre llega arriba.
   *
   * CON COMPARACIÓN, la escala la manda el mayor de los dos
   * primeros: si antes entraron 75 y ahora 41, la barra gris
   * medía 183 % y se salía del recuadro tapando la cifra de
   * arriba. Las dos comparten escala, que es lo que deja
   * compararlas de un vistazo.
   */
  const tope = Math.max(primero, antes?.[0] ?? 0);
  const alto = (v: number) =>
    tope > 0 ? Math.min(100, Math.max(2, Math.round((v / tope) * 100))) : 2;

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
      {resumen && (
        <p className="mb-4 text-[0.8125rem] leading-relaxed text-texto">{resumen}</p>
      )}

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
                caida > 0 ? ` · ${n(caida)} no pasaron del paso anterior` : ""
              }`}
            >
              {/* La caída, encima y en rojo. Es el dato que se
                  viene a buscar, así que va antes que la cifra.

                  EN PALABRAS y no «▼ −30»: una flecha con un
                  menos se lee como «bajó frente a ayer», y con el
                  selector de comparación al lado eso es lo que
                  se leía. Esto es otra cosa: gente que no pasó al
                  paso siguiente dentro del MISMO periodo. */}
              <div className="h-4 text-[0.6875rem] font-semibold text-error tabular-nums">
                {caida > 0 ? `${n(caida)} no pasaron` : ""}
              </div>

              <div className="text-[1.375rem] leading-none font-bold text-titulo tabular-nums">
                {n(h.total)}
              </div>

              {/* LA BARRA DEL PERIODO ANTERIOR, DETRAS Y EN GRIS.
                  Se ve de un vistazo si hay más o menos que antes,
                  sin una segunda cifra de colores compitiendo con
                  la de arriba. La escala es la MISMA --el primer
                  hito de ahora--, que es lo que deja compararlas;
                  si antes hubo más, la gris asoma por encima. */}
              <div className="relative mt-1.5 flex h-[112px] w-full items-end justify-center">
                {antes && antes[i] !== undefined && (
                  <div
                    className="absolute bottom-0 w-2/3 rounded-t-[7px] border border-borde bg-superficie-alterna"
                    style={{ height: `${alto(antes[i])}%` }}
                    aria-hidden
                  />
                )}
                {/* La de AHORA va delante y del mismo ancho: si
                    antes hubo más, la gris asoma por encima como
                    una marca de agua; si hay más ahora, la tapa. */}
                <div
                  className="relative w-2/3 rounded-t-[7px] transition-[height] duration-500"
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

              {antes && antes[i] !== undefined && (
                <ContraAntes ahora={h.total} antes={antes[i]} etiqueta={etiquetaAntes} />
              )}

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

      {antes && (
        <div className="mt-4 overflow-x-auto border-t border-hairline pt-3">
          {/* Angosta y a la izquierda: estirada a 1.600 px quedaban
              cuatro cifras con medio metro de vacío en medio. */}
          <table className="w-full max-w-[520px] text-[0.75rem] tabular-nums">
            <thead>
              <tr className="text-texto-suave">
                <th className="py-1 text-left font-medium">Paso</th>
                <th className="py-1 text-right font-medium">Ahora</th>
                <th className="py-1 text-right font-medium" title={etiquetaAntes ?? "Antes"}>
                  Antes
                </th>
                <th className="py-1 text-right font-medium">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {hitos.map((h, i) => {
                const b = antes[i];
                const d = b === undefined ? null : h.total - b;
                return (
                  <tr key={`fila-${h.etiqueta}#${i}`} className="border-t border-hairline">
                    <td className="py-1 text-left text-titulo">{h.etiqueta}</td>
                    <td className="py-1 text-right font-semibold text-titulo">
                      {n(h.total)}
                    </td>
                    <td className="py-1 text-right text-texto-suave">
                      {b === undefined ? "—" : n(b)}
                    </td>
                    <td className="py-1 text-right text-texto-suave">
                      {d === null ? "—" : d === 0 ? "igual" : `${d > 0 ? "+" : "−"}${n(Math.abs(d))}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {antes && (
        <p className="mt-2 text-center text-[0.6875rem] text-texto-suave">
          «Antes» es {etiquetaAntes ?? "el periodo con el que se compara"}, y
          va sin color a propósito: los de antes tuvieron más tiempo para
          avanzar, así que menos contactados hoy no quiere decir que se esté
          trabajando peor. «No pasaron» es otra cosa: la gente que se quedó
          entre un paso y el siguiente dentro del periodo elegido.
        </p>
      )}

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
