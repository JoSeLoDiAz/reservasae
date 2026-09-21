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
  /// La misma cifra en el periodo con el que se compara. Null =
  /// no se compara. «¿No deberían decir la diferencia?» (cliente,
  /// 20 sep 2026): una cifra sola no dice si va mejor o peor.
  antes?: number | null;
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

/// «frente a el mismo tramo…» no se dice: es «frente al».
function contraQue(etiqueta: string | null): string {
  const e = (etiqueta ?? "antes").toLowerCase();
  return e.startsWith("el ") ? `al ${e.slice(3)}` : `a ${e}`;
}

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
  etiquetaAhora = null,
  resumen = null,
  sobrio = false,
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
  /// El nombre del periodo que se está mirando, para la leyenda.
  etiquetaAhora?: string | null;
  /**
   * La misma historia EN UNA FRASE, encima de las barras.
   *
   * «No lo entiendo de ninguna manera... necesito que ese reporte
   * se entienda» (Mauricio, 20 sep 2026). Cuatro barras con
   * porcentajes son un dibujo; la frase dice qué preguntan.
   */
  resumen?: React.ReactNode;
  /**
   * Sin los adornos: solo la cifra y el nombre de cada paso.
   *
   * «No entiendo una mierda» (cliente, 20 sep 2026). Cada barra
   * llevaba CUATRO cifras --los que no pasaron, el total, el
   * porcentaje y el periodo anterior-- y debajo una tabla con las
   * mismas cifras otra vez. Lo que se quita de la barra no se
   * pierde: la caída se lee restando dos cifras seguidas, y la
   * comparación está en la tabla, que es donde se lee de corrido.
   * Tráfico del formulario sigue con todo: allí son nueve pasos y
   * el porcentaje es lo que se viene a mirar.
   */
  sobrio?: boolean;
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
        <p className="mb-3 text-[0.8125rem] leading-relaxed text-texto">{resumen}</p>
      )}

      {/* LA LEYENDA, y sin ella las dos barras no dicen nada. */}
      {antes && (
        <p className="mb-3 flex flex-wrap items-center gap-4 text-[0.75rem] text-texto-suave">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-marca-fuerte" aria-hidden />
            {etiquetaAhora ?? "El periodo elegido"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-[3px] border border-borde bg-superficie-alterna"
              aria-hidden
            />
            {etiquetaAntes ?? "El periodo anterior"}
          </span>
        </p>
      )}

      {/* COLUMNAS ESTIRADAS Y NO ALINEADAS POR ABAJO.
          Con `items-end`, la columna que lleva la meta debajo
          empujaba sus barras hacia arriba y el embudo quedaba
          escalonado: «sigue siendo inconcluso» (cliente, 20 sep
          2026). Ahora el área de las barras mide lo mismo en
          todas y el pie también, así que todas comparten línea. */}
      <div className="flex items-stretch gap-3">
        {hitos.map((h, i) => {
          const antesDe = antes?.[i];
          const hayAntes = antesDe !== undefined;
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
              className="flex min-w-0 flex-1 flex-col items-center justify-end"
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
              {!sobrio && (
                <div className="h-4 text-[0.6875rem] font-semibold text-error tabular-nums">
                  {caida > 0 ? `${n(caida)} no pasaron` : ""}
                </div>
              )}

              {!hayAntes && (
                <div className="text-[1.375rem] leading-none font-bold text-titulo tabular-nums">
                  {n(h.total)}
                </div>
              )}

              {/* DOS BARRAS, UNA POR PERIODO.

                  Estuvo la del periodo anterior DETRÁS, en gris, y
                  no se entendía: «cuando compara no deben ser 2
                  filas, o sea el de x día y el otro de x día»
                  (cliente, 20 sep 2026). Ahora son dos barras una
                  al lado de la otra, cada una con su cifra encima y
                  su color en la leyenda de arriba. Sin comparación
                  queda una sola, como siempre. */}
              <div className="mt-1.5 flex h-[112px] w-full items-end justify-center gap-1.5">
                <div className="flex h-full w-1/2 flex-col justify-end">
                  <span className="mb-1 text-center text-[0.8125rem] font-bold text-titulo tabular-nums">
                    {hayAntes ? n(h.total) : ""}
                  </span>
                  <div
                    className="w-full rounded-t-[7px] transition-[height] duration-500"
                    style={{
                      height: `${alto(h.total)}%`,
                      background: colorEtapa(h.etapa),
                    }}
                  />
                </div>

                {hayAntes && (
                  <div className="flex h-full w-1/2 flex-col justify-end">
                    <span className="mb-1 text-center text-[0.8125rem] font-semibold text-texto-suave tabular-nums">
                      {n(antesDe)}
                    </span>
                    <div
                      className="w-full rounded-t-[7px] border border-borde bg-superficie-alterna"
                      style={{ height: `${alto(antesDe)}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="mt-2 flex h-[38px] flex-col items-center justify-start">
                <div className="text-center text-[0.75rem] leading-[1.15] font-semibold text-titulo">
                  {h.etiqueta}
                </div>
              {!sobrio && (
                <div className="mt-0.5 text-[0.6875rem] text-texto-suave tabular-nums">
                  {porcentaje(h.total, primero)}
                </div>
              )}

              {!sobrio && antes && antes[i] !== undefined && (
                <ContraAntes ahora={h.total} antes={antes[i]} etiqueta={etiquetaAntes} />
              )}

                {/* La meta del SENA, colgada del último hito, y
                    dentro del pie: fuera de él descuadraba la fila. */}
                {esUltimo && meta !== null && meta > 0 && (
                  <div
                    className="mt-1 text-[0.65625rem] font-bold text-marca tabular-nums"
                    title={`Meta comprometida con el SENA: ${n(meta)} beneficiarios`}
                  >
                    meta {n(meta)} · {porcentaje(h.total, meta)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {antes && (
        <p className="mt-2 text-center text-[0.6875rem] text-texto-suave">
          Las barras grises son {etiquetaAntes ?? "el periodo con el que se compara"}.
          Van sin color porque esa gente tuvo más tiempo para avanzar.
        </p>
      )}

      {notas.length > 0 && (
        <TarjetasDelEmbudo notas={notas} etiquetaAntes={etiquetaAntes} />
      )}
    </div>
  );
}


/**
 * Las tres casillas de «en qué acabó la gente del periodo».
 *
 * SUELTO y exportado: lo usan el embudo del periodo y el de día
 * por día, y estaba metido dentro del primero --así que al
 * cambiar de vista desaparecía--.
 */
export function TarjetasDelEmbudo({
  notas,
  etiquetaAntes = null,
}: {
  notas: NotaDelEmbudo[];
  etiquetaAntes?: string | null;
}) {
  if (notas.length === 0) return null;
  /**
   * EL REPARTO LO MANDAN LAS CLASES, NO UN ESTILO EN LÍNEA.
   *
   * `style={{gridTemplateColumns: 'repeat(3, …)'}}` gana SIEMPRE
   * a `sm:grid-cols-2`, que estaba en el mismo elemento, así que
   * las tres casillas se quedaban en tres columnas a cualquier
   * ancho, celular incluido: medido a 390 px, 93 px por casilla,
   * «siguen en / proceso, / sin / inscribirse» en cuatro
   * renglones y la fila entera de 350 px de alto contra los 120
   * que mide a 1.600. Ninguna de las tres referencias del
   * cliente deja una casilla de dato por debajo de ~150 px.
   *
   * Cadenas completas y no interpoladas: Tailwind las busca tal
   * cual en el código y una clase armada a trozos no existiría.
   */
  const reparto =
    notas.length === 1
      ? "grid-cols-1"
      : notas.length === 2
        ? "grid-cols-1 min-[520px]:grid-cols-2"
        : notas.length === 3
          ? "grid-cols-1 min-[520px]:grid-cols-2 min-[900px]:grid-cols-3"
          : "grid-cols-1 min-[520px]:grid-cols-2";
  return (
    <div className={`mt-3 grid gap-2.5 border-t border-hairline pt-3 ${reparto}`}>
      {notas.map((nt, i) => (
        <div
          key={`${nt.etiqueta}#${i}`}
          className="rounded-[11px] border border-hairline px-3.5 py-2"
          title={nt.detalle}
        >
          {/* LOS MISMOS CUATRO ESCALONES QUE EL RESTO DEL BLOQUE.
              Había nueve tamaños de letra en una sola tarjeta,
              tres de ellos dentro de un margen de 1 px: no se
              distinguen entre sí y solo impiden que nada case.
              Cifra grande 20 px --la misma del embudo--, cuerpo
              13,5 --el de la casa-- y apunte 11. */}
          <span
            className="block text-[1.25rem] leading-none font-bold tabular-nums"
            style={{ color: COLOR_TONO[nt.tono ?? "neutro"] }}
          >
            {n(nt.cifra)}
          </span>
          <span className="mt-1.5 block text-[0.84375rem] leading-snug font-medium text-texto">
            {nt.etiqueta}
          </span>
          {nt.antes !== null && nt.antes !== undefined && (
            <span className="mt-1 block text-[0.6875rem] text-texto-suave tabular-nums">
              {/* «igual que el mes de antes» y no «igual que mes
                  de antes»: recortar la preposición de
                  `contraQue` se comía también el artículo. */}
              {nt.antes === nt.cifra
                ? `igual que ${(etiquetaAntes ?? "antes").toLowerCase()}`
                : `${nt.cifra > nt.antes ? "+" : "−"}${n(
                    Math.abs(nt.cifra - nt.antes),
                  )} frente ${contraQue(etiquetaAntes)} (${n(nt.antes)})`}
            </span>
          )}
          <span className="mt-1 block text-[0.6875rem] leading-snug text-texto-suave">
            {nt.detalle}
          </span>
        </div>
      ))}
    </div>
  );
}
