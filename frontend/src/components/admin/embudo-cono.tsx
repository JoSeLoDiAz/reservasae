/** El embudo dibujado COMO UN CONO: el de la referencia del cliente. */

/**
 * Cuatro troncos de cono apilados, vistos un poco desde arriba, con
 * el nombre de cada paso a la derecha. El último acaba en punta.
 *
 * «¿Y un embudo no es como la captura que te envío? Es que el que
 * tenemos se ve raro, ¿no?» (cliente, 21 sep 2026, con un «lead
 * generation funnel» de referencia). El de trapecios se veía raro por
 * tres cosas, medidas en su captura: entre paso y paso había un cuello
 * más claro que se leía como un paso más --cuatro pasos y siete
 * franjas--, todo era del mismo verde y terminaba plano.
 *
 * Aquí cada paso es UNA pieza de su color, entre pieza y pieza queda
 * una ranura pequeña por la que se ve la tapa de la de abajo --un tono
 * más oscuro de su color, no una franja clara--, y la última se cierra
 * en punta.
 *
 * Da lo mismo que daba `EmbudoForma` y con las mismas props, para que
 * cambiar uno por otro sea cambiar el import: la cifra y el nombre de
 * cada paso, el porcentaje sobre los que entraron, lo que se queda
 * entre paso y paso con la mayor en rojo, el «antes N» con su periodo
 * en el `title` y la meta del SENA debajo. Solo cambia la forma.
 */

import { Fragment } from "react";

import type { Hito } from "./embudo-proceso";
import { CAIDAS, caidaMayor } from "./embudo-forma";
import { colorEtapa } from "./etapa";
import { n } from "./graficos";


/// LA MISMA CAJA QUE EL EMBUDO DE TRAPECIOS: «mismos tamaños» (Mauricio,
/// 21 sep 2026).
///
/// Tope de 560 px, figura a la izquierda y 46 % para los rótulos, con
/// 12 px entre las dos: a 1.600 y a 1.366 la figura mide 290 px de ancho
/// y a 390, 150; la columna de rótulos, 258 y 138. Son las medidas de
/// `EmbudoForma` (ver su `REJILLA` y su `ANCHO_MAXIMO`, que explican por
/// qué esos números), así que al cambiar el import el bloque no crece ni
/// encoge y nada de lo que está al lado se mueve.
///
/// `@container` porque la colocación de los textos cambia con el ancho
/// de ESTA caja y no con el de la ventana (ver `AIRE_ROTULO`).
const ANCHO_MAXIMO = "@container w-full max-w-[560px]";
const REJILLA = "grid grid-cols-[minmax(0,1fr)_46%] gap-x-3";

/// LA FORMA ES FIJA, NO PROPORCIONAL A LAS CIFRAS. Y ES A PROPÓSITO.
///
/// Las piezas miden de ancho 100 %, 78 %, 56 % y 34 % de la columna, y
/// la última se cierra hasta la punta, valga lo que valga cada paso.
/// Dos razones:
///
///  · La referencia del cliente es un cono clásico, y eso es lo que
///    reconoce como embudo. Con anchos proporcionales la silueta cambia
///    con cada periodo y deja de ser esa figura.
///  · Con anchos proporcionales, un periodo como «Ayer» (4 · 2 · 1 · 0)
///    dejaba el último paso en un hilo de 4,6 px --medido en una
///    revisión anterior--, que no se ve ni se puede señalar.
///
/// El dato va en la cifra escrita al lado de cada pieza, que es exacta;
/// la proporción entre pasos ya la dibuja la gráfica de columnas de la
/// misma pantalla, justo encima.
///
/// Con más o menos de cuatro pasos el reparto es el mismo: del 100 % al
/// 34 % en escalones iguales.
function anchoDe(i: number, pasos: number): number {
  if (pasos <= 1) return 100;
  return 100 - (66 * i) / (pasos - 1);
}

/// LAS ELIPSES NO SE ESTIRAN NUNCA.
///
/// Cada tapa y cada borde curvo es su propio SVG con un `viewBox` FIJO
/// de 200 × 16 --alto = 8 % del ancho-- y sin `preserveAspectRatio`, así
/// que el navegador lo escala igual a lo ancho que a lo alto. Una elipse
/// estirada es exactamente el defecto que el cliente ya vio en otra
/// gráfica: un punto que salía ovalado. Medido: la primera tapa mide
/// 290 × 23,2 px a 1.600 y 150 × 12 a 390, la misma razón.
///
/// 8 % y no más porque la tapa es PLANA en la referencia: con un 16 % la
/// primera pieza era casi toda tapa oscura con una tira de color debajo.
const ELIPSE_ANCHO = 200;
const ELIPSE_ALTO = 16;
const RAZON = ELIPSE_ALTO / ELIPSE_ANCHO;

/// El medio alto de una elipse de `ancho` % de la columna, en `cqw`.
///
/// `cqw` es el 1 % del ancho de la pieza --cada pieza es un contenedor--,
/// así que la pared arranca justo en el eje de su tapa a cualquier
/// ancho, sin medir nada con JavaScript.
function medioAlto(ancho: number): number {
  return (RAZON * ancho) / 2;
}

/// LA FIGURA MIDE LO QUE LA DE TRAPECIOS: 238 PX DE ALTO, A CUALQUIER
/// ANCHO.
///
/// «Mismos tamaños» (Mauricio, 21 sep 2026). `EmbudoForma` mide
/// 4 × 40 + 3 × 26 = 238 px valga lo que valga el ancho, y el cono tiene
/// que medir eso mismo para que al cambiar el import no se mueva nada de
/// lo que va debajo, tampoco en el celular.
///
/// Lo que complica la cuenta es la tapa de arriba: es la única que se ve
/// entera y mide el 8 % del ancho de la figura (ver `RAZON`), así que
/// crece y encoge con la columna --23,2 px a 1.600, 12 a 390--. Por eso
/// las piezas NO miden un número fijo de píxeles: se reparten a partes
/// iguales lo que dejan las tres ranuras y esa tapa,
///
///   pieza = (238 − 3 × 8 − tapa) / 4,
///
/// y la primera lleva su tapa entera encima, así que las cuatro miden
/// lo mismo de pared y no parece que la de arriba sea más baja. Da
/// 47,7 px a 1.600 y 50,5 a 390, y la figura, 238 en los dos. Va en
/// `cqw` --el 1 % del ancho de la pieza, que es su propio contenedor--
/// para que la cuenta la haga el navegador a cualquier ancho.
///
/// Hubo una versión con la pieza a 58 px en el celular, para que los
/// textos cupieran holgados: la figura medía 268 en vez de 240 y las
/// piezas se veían más altas que anchas, como vasos apilados (revisión
/// del 21 sep 2026). Los textos caben en los 238 si se colocan bien:
/// ver `AIRE_ROTULO`.
///
/// La RANURA NO crece nunca con el texto: si fuera del alto del texto
/// volvería a ser una franja que se lee como un paso más, que es lo que
/// el cliente vio raro. El texto de caída la desborda por arriba y por
/// abajo hacia el aire que dejan los rótulos.
const ALTO_FIGURA = 238;
const RANURA = 8;

function altoPieza(indice: number, pasos: number): string {
  const tapa = 2 * medioAlto(100);
  const fijo = (ALTO_FIGURA - (pasos - 1) * RANURA) / pasos;
  const parte = tapa / pasos;
  return indice === 0
    ? `calc(${fijo}px + ${tapa - parte}cqw)`
    : `calc(${fijo}px - ${parte}cqw)`;
}

/// DÓNDE VA CADA TEXTO DE LA COLUMNA DE LA DERECHA.
///
/// Con márgenes dentro de su fila de la rejilla, y no con `transform` ni
/// `top`: así el sitio que se guarda cada texto cuenta al repartir las
/// filas, y si un rótulo o un texto de caída creciera --cifras de cinco
/// dígitos en el celular-- su fila crece con él en vez de montarse sobre
/// el de al lado. Tres reglas:
///
///  1. EL NOMBRE, EN EL MEDIO DE LO QUE SE VE DE SU PIEZA. En la primera
///     eso es la celda entera, de lo alto de la tapa al borde de abajo.
///     En las demás, lo que se ve empieza EN LA RANURA DE ENCIMA --por
///     ahí asoma su tapa--, así que el medio queda media ranura por
///     encima del de la celda. Centrados en la celda quedaban entre 5 y
///     8 px bajos (medido en la silueta, revisión del 21 sep 2026). Y lo
///     que se centra es la letra del NOMBRE, no la caja del rótulo: en el
///     celular el porcentaje cuelga en un renglón debajo y no cuenta.
///  2. CADA TEXTO DE CAÍDA, A LA MISMA DISTANCIA DE LOS DOS PASOS DE LOS
///     QUE HABLA. Centrado en su ranura, el primero quedaba a 26 px de
///     «Entraron» y a 14 de «Contactados», y se leía como subtítulo del
///     paso de abajo. El primero sube más que los otros porque la
///     primera pieza lleva su tapa entera y su rótulo queda más arriba:
///     un cuarto de la tapa, que en escritorio va en `cqw` de la caja
///     porque la tapa crece con ella. Quedan un poco por encima del eje
///     de la ranura, que es donde se ve el hueco desde la derecha: el
///     borde de abajo de cada pieza se levanta hacia los lados.
///  3. LO QUE DESBORDA UN TEXTO DE CAÍDA, EL RÓTULO VECINO LO TIENE
///     GUARDADO EN SU MARGEN. El texto de caída lleva márgenes negativos,
///     así que en su ranura de 8 px cuenta menos de lo que mide; lo que
///     sobresale cae sobre la fila de al lado, y el margen del rótulo de
///     ese lado es al menos eso más un poco de aire.
///
/// Dos juegos de medidas: en la caja estrecha --por debajo de 380 px, el
/// celular-- el rótulo va en dos renglones y el texto de caída puede ir
/// en dos. Todas se midieron en la tinta, no en la caja de la línea.
const AIRE_ROTULO = [
  "mt-[10.5px] mb-[14.5px] @max-[380px]:mt-[15px] @max-[380px]:mb-[8px]",
  "mt-0 mb-[12px] @max-[380px]:mt-[9.5px] @max-[380px]:mb-[10.5px]",
];
const CAIDA = [
  "-mt-[calc(1.08cqw_+_7.06px)] mb-[calc(1.08cqw_+_1.06px)] @max-[380px]:-mt-[9px] @max-[380px]:-mb-[9px]",
  "-mt-[9.3px] mb-[3.3px] @max-[380px]:-mt-[9px] @max-[380px]:-mb-[9px]",
];

/// UN COLOR POR PASO, EL DE SU ETAPA.
///
/// Todo del mismo verde fue la segunda razón por la que el de trapecios
/// «se veía raro»: los pasos no se distinguían. Aquí cada pieza lleva el
/// color de su etapa --INTERESADO para «Entraron», CONTACTADO,
/// DATOS_COMPLETOS, INSCRITO--, los mismos de todo el CRM y los mismos
/// de la gráfica de columnas de esta pantalla, así que las dos hablan el
/// mismo idioma. Los cuatro tienen su versión oscura en el tema oscuro.
///
/// LA TAPA, UN TONO MÁS OSCURO DEL MISMO COLOR: la variable de la etapa
/// mezclada con negro. Negro y no `--titulo`, que en el tema oscuro es
/// casi blanco y aclaraba la tapa en vez de oscurecerla. El negro no es
/// un color de la paleta sino la sombra: el tono sigue saliendo de la
/// variable, y en los dos temas la tapa queda más oscura que su pieza.
function colorCara(cuerpo: string): string {
  return `color-mix(in oklab, ${cuerpo} 74%, black)`;
}

function porcentaje(parte: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((parte / total) * 100)} %`;
}

/**
 * Una pieza del cono: la pared, su borde curvo de abajo y su tapa.
 *
 * Todo va posicionado dentro de la celda de su fila. En la primera la
 * celda va de lo alto de su tapa a lo más bajo de su borde; en las
 * demás, del borde de abajo de su tapa hasta lo más bajo de su borde, o
 * hasta la punta en la última: la media luna de la tapa que asoma por
 * la ranura queda ENCIMA de la celda (ver `AIRE_ROTULO`, regla 1).
 */
function Pieza({
  indice,
  pasos,
  arriba,
  abajo,
  color,
}: {
  indice: number;
  pasos: number;
  /// Ancho de la tapa, en % de la columna.
  arriba: number;
  /// Ancho de abajo, en %; 0 en la última: la punta.
  abajo: number;
  color: string;
}) {
  const primera = indice === 0;
  const ryArriba = medioAlto(arriba);
  const ryAbajo = medioAlto(abajo);

  return (
    <>
      {/* EL ALTO DE LA PIEZA, en el flujo: es lo que da alto a la fila
          (ver `ALTO_FIGURA`). */}
      <div
        aria-hidden
        style={{ height: altoPieza(indice, pasos) }}
      />

      {/* LA PARED, solo color.
          Es un polígono de CSS y no un SVG: tiene que medir de alto lo
          que diga la fila --fija en px, porque la fila la comparte con el
          rótulo-- y de ancho lo que mida la columna, dos medidas que no
          guardan proporción entre sí. Un SVG haría falta estirarlo con
          `preserveAspectRatio="none"`, que es lo que ovala las elipses.
          Una pared de líneas rectas no tiene proporción que perder; lo
          redondo --tapa y borde-- sí, y eso va en SVG de viewBox fijo.
          Arranca en el eje de su tapa y acaba en el eje de su borde, así
          que tapa y borde le calzan a cualquier ancho. */}
      <div
        data-pieza="pared"
        className="absolute inset-x-0"
        style={{
          top: primera ? `${ryArriba}cqw` : `-${ryArriba}cqw`,
          bottom: abajo > 0 ? `${ryAbajo}cqw` : 0,
          clipPath:
            abajo > 0
              ? `polygon(${50 - arriba / 2}% 0, ${50 + arriba / 2}% 0, ${50 + abajo / 2}% 100%, ${50 - abajo / 2}% 100%)`
              : `polygon(${50 - arriba / 2}% 0, ${50 + arriba / 2}% 0, 50% 100%)`,
          background: color,
        }}
      />

      {/* EL BORDE DE ABAJO, levemente curvo: la mitad de delante de una
          elipse del ancho de abajo, del mismo color de la pared.
          El filete del color de la tarjeta sobre esa curva es la ranura:
          separa la pieza de la tapa de la siguiente aunque las dos sean
          oscuras --en claro, entre el azul de CONTACTADO y la tapa morada
          de DATOS_COMPLETOS hay 1,5:1 de contraste de luz, calculado--.
          Va con `non-scaling-stroke` para que mida 1,25 px a cualquier
          ancho. */}
      {abajo > 0 && (
        <svg
          data-pieza="borde"
          viewBox={`0 0 ${ELIPSE_ANCHO} ${ELIPSE_ALTO}`}
          aria-hidden
          className="absolute bottom-0 h-auto overflow-visible"
          style={{
            left: `${50 - abajo / 2}%`,
            width: `${abajo}%`,
            aspectRatio: `${ELIPSE_ANCHO} / ${ELIPSE_ALTO}`,
          }}
        >
          <ellipse
            cx={ELIPSE_ANCHO / 2}
            cy={ELIPSE_ALTO / 2}
            rx={ELIPSE_ANCHO / 2}
            ry={ELIPSE_ALTO / 2}
            style={{ fill: color }}
          />
          <path
            d={`M0 ${ELIPSE_ALTO / 2} A${ELIPSE_ANCHO / 2} ${ELIPSE_ALTO / 2} 0 0 0 ${ELIPSE_ANCHO} ${ELIPSE_ALTO / 2}`}
            fill="none"
            strokeWidth={1.25}
            vectorEffect="non-scaling-stroke"
            style={{ stroke: "var(--superficie)" }}
          />
        </svg>
      )}

      {/* LA TAPA, la elipse plana de arriba, un tono más oscura.
          La de la primera pieza se ve entera y empieza en lo alto de la
          celda. Las demás van ENCIMA de su celda --`bottom: 100%`--, por
          detrás de la pieza de arriba: de ellas solo asoma por la ranura
          la media luna de delante, que es lo que se ve en la
          referencia. */}
      <svg
        data-pieza="tapa"
        viewBox={`0 0 ${ELIPSE_ANCHO} ${ELIPSE_ALTO}`}
        aria-hidden
        className="absolute h-auto overflow-visible"
        style={{
          left: `${50 - arriba / 2}%`,
          width: `${arriba}%`,
          aspectRatio: `${ELIPSE_ANCHO} / ${ELIPSE_ALTO}`,
          ...(primera ? { top: 0 } : { bottom: "100%" }),
        }}
      >
        <ellipse
          cx={ELIPSE_ANCHO / 2}
          cy={ELIPSE_ALTO / 2}
          rx={ELIPSE_ANCHO / 2}
          ry={ELIPSE_ALTO / 2}
          style={{ fill: colorCara(color) }}
        />
      </svg>
    </>
  );
}

export function EmbudoCono({
  hitos,
  antes = null,
  etiquetaAntes = null,
  meta = null,
  caidas = CAIDAS,
}: {
  hitos: Hito[];
  /// La misma cifra en el periodo con el que se compara, en el mismo
  /// orden. Null = no se compara y no se deja hueco. Quien lo manda lo
  /// calla cuando el periodo anterior no trajo a nadie (ver
  /// `panel-proceso` y `EmbudoForma`).
  antes?: number[] | null;
  /// Cómo se llama ese periodo. Va en el `title`, no escrito: dicho
  /// cuatro veces tapaba el embudo.
  etiquetaAntes?: string | null;
  /// La meta comprometida con el SENA. Va debajo de la figura, en letra
  /// pequeña; quien la manda decide cuándo se puede enseñar.
  meta?: number | null;
  caidas?: string[];
}) {
  if (hitos.length === 0) return null;

  const primero = hitos[0].total;
  const ultimo = hitos[hitos.length - 1].total;

  /// SIN NADIE NO HAY FIGURA, igual que en `EmbudoForma`: cuatro piezas
  /// con ocho rótulos a cero parecen una pantalla rota. Quien llama lo
  /// resuelve antes (`SinGente` en `panel-proceso`).
  if (primero <= 0) return null;

  const pasos = hitos.length;
  const filas = pasos * 2 - 1;

  /// En cuál se queda más gente: la misma cuenta que la frase de la
  /// descripción del bloque, importada y no repetida.
  const mayor = caidaMayor(hitos);

  const leida = `Embudo de ${pasos} ${pasos === 1 ? "paso" : "pasos"}: ${hitos
    .map((h) => `${h.etiqueta} ${n(h.total)}`)
    .join(", ")}.`;

  return (
    <div className={ANCHO_MAXIMO}>
      {/* UNA REJILLA, DOS COLUMNAS Y 2N − 1 FILAS: pieza, ranura, pieza…
          La figura ocupa la primera columna entera y reparte sus piezas
          en las filas de la rejilla con `subgrid`, así que cada pieza y
          su rótulo comparten fila y no hay nada que cuadrar a mano. Las
          piezas en `auto` --las mide su alto (ver `ALTO_FIGURA`), o el
          rótulo si creciera-- y las ranuras en `minmax(8px, 1fr)`: si un
          texto de caída no cupiera ni desbordando, crecerían las tres a
          la vez --en una rejilla de alto libre todas las filas `fr` miden
          lo que la más alta--, porque una ranura más gruesa que las otras
          se leería como una pausa en el embudo que no existe. */}
      <div
        className={REJILLA}
        style={{
          gridTemplateRows: Array.from({ length: filas }, (_, j) =>
            j % 2 === 0 ? "auto" : `minmax(${RANURA}px, 1fr)`,
          ).join(" "),
        }}
      >
        {/* EL DIBUJO, con su nombre para quien no lo ve.
            Los rótulos de al lado se leen igual; esto dice la figura
            entera de un tirón. `isolate` para que el orden de las piezas
            --la de arriba tapa la tapa de la de abajo-- no se mezcle con
            nada de fuera. */}
        <div
          role="img"
          aria-label={leida}
          className="isolate col-start-1 grid"
          style={{ gridRow: "1 / -1", gridTemplateRows: "subgrid" }}
        >
          {/* CADA PIEZA ES SU PROPIO `@container`, y no la figura entera:
              un contenedor de consultas lleva contención de maquetación,
              y un elemento así deja de ser `subgrid` --comprobado en
              Chrome: sus filas pasan de `subgrid` a `none` y las piezas
              dejan de compartir fila con sus rótulos--. En la pieza no
              estorba, y
              su ancho es el de la columna, que es lo que mide `cqw`.
              La de arriba va por encima (`zIndex`) para tapar la tapa de
              la de abajo, que asoma hacia arriba. */}
          {hitos.map((h, i) => (
            <div
              key={`${h.etiqueta}#${i}`}
              data-pieza="paso"
              className="@container relative"
              style={{ gridRow: i * 2 + 1, zIndex: pasos - i }}
            >
              <Pieza
                indice={i}
                pasos={pasos}
                arriba={anchoDe(i, pasos)}
                abajo={i < pasos - 1 ? anchoDe(i + 1, pasos) : 0}
                color={colorEtapa(h.etapa)}
              />
            </div>
          ))}
        </div>

        {hitos.map((h, i) => {
          /// LA CAÍDA ES LA DE ESTE PASO AL SIGUIENTE, como en
          /// `EmbudoForma`: `hitos[i] - hitos[i+1]`, que es lo que dice
          /// `caidas[i]`.
          const caida = i < pasos - 1 ? h.total - hitos[i + 1].total : 0;
          const antesDe = antes?.[i];
          /// Los dos apuntes pequeños, en UNA línea y con su explicación
          /// larga en el `title`: los mismos que en `EmbudoForma`.
          const apuntes: Array<{ texto: string; pista: string }> = [];
          if (i > 0) {
            apuntes.push({
              texto: porcentaje(h.total, primero),
              pista: `${n(h.total)} de los ${n(primero)} que entraron`,
            });
          }
          if (antesDe !== undefined) {
            /// SIN flecha, SIN color y SIN la resta hecha: los del
            /// periodo anterior tuvieron más tiempo para avanzar (José,
            /// 18 sep 2026). El número cuenta; no afirma.
            apuntes.push({
              texto: `antes ${n(antesDe)}`,
              pista: `${h.etiqueta} en ${etiquetaAntes ?? "el periodo anterior"}: ${n(antesDe)}`,
            });
          }

          return (
            <Fragment key={`${h.etiqueta}#${i}`}>
              {/* EL RÓTULO, a la derecha de su pieza y centrado en su
                  alto: letra oscura y firme, la cifra siempre en la misma
                  columna para leer las cuatro de un tirón. Los mismos
                  tamaños de letra que en `EmbudoForma`.
                  EN UN RENGLÓN: cifra, nombre y apuntes. En `EmbudoForma`
                  los apuntes iban en un segundo renglón reservado, y el
                  nombre quedaba unos 8 px por ENCIMA del centro de su
                  banda --un rótulo de 37 px arriba en una banda de 40--:
                  lo centrado era el bloque, no el nombre. La referencia
                  pone el nombre en medio de la pieza, y en los 258 px de
                  la columna de escritorio cabe todo en una línea --lo más
                  largo que puede salir, «12.480 Contactados 75 % · antes
                  10.101», mide 245--. De paso la columna se airea: un
                  renglón de 21 px en una pieza de 48 deja 10 px entre el
                  rótulo y el texto de caída, donde con dos quedaban unos 3.
                  En la caja estrecha (138 px) no cabe, y los apuntes
                  vuelven a su renglón de abajo, reservado lleven algo o
                  no, como en `EmbudoForma`: así los cuatro rótulos miden
                  igual y la figura no baila entre periodos. Ahí lo
                  centrado vuelve a ser el bloque, y el nombre queda 6 px
                  por encima del centro de su pieza (medido a 390): para
                  centrar el nombre con el apunte colgando debajo, cada
                  pieza tendría que medir 72 px y la figura, 325 en vez de
                  268. Si en una caja intermedia el renglón no cupiera,
                  `flex-wrap` lo parte en dos y la fila crece, en vez de
                  salirse. */}
              <div
                data-pieza="rotulo"
                className={`col-start-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 self-center text-left @max-[380px]:gap-y-0 ${AIRE_ROTULO[i === 0 ? 0 : 1]}`}
                style={{ gridRow: i * 2 + 1 }}
              >
                <span className="text-[1.25rem] leading-none font-bold text-titulo tabular-nums">
                  {n(h.total)}
                </span>
                <span
                  data-pieza="nombre"
                  className="text-[0.84375rem] leading-tight font-semibold text-titulo"
                >
                  {h.etiqueta}
                </span>
                <span
                  className="text-[0.6875rem] leading-tight text-texto-suave tabular-nums @max-[380px]:block @max-[380px]:min-h-[11px] @max-[380px]:basis-full @max-[380px]:leading-none"
                  title={apuntes.map((a) => a.pista).join(" · ") || undefined}
                >
                  {apuntes.map((a) => a.texto).join(" · ")}
                </span>
              </div>

              {/* LO QUE SE QUEDA ENTRE LOS DOS PASOS, en la columna de los
                  rótulos y a la altura de la ranura que los separa.
                  SOLO LA MAYOR EN ROJO: es la que contesta la pregunta que
                  trae a alguien aquí, en qué paso se queda la gente.
                  `leading-[1.15]` y no `tight`: en dos renglones son 25 px
                  en vez de 27,5, y eso es lo que deja caber el texto en la
                  pieza estrecha sin pisar los rótulos. `text-balance` para
                  que no deje «contactar» sola en el segundo renglón. */}
              {i < pasos - 1 && (
                <div
                  className={`col-start-2 flex items-center self-center ${CAIDA[i === 0 ? 0 : 1]}`}
                  style={{ gridRow: i * 2 + 2 }}
                >
                  {caida > 0 && (
                    <p
                      data-pieza="caida"
                      data-mayor={mayor?.paso === i ? "si" : undefined}
                      className={
                        mayor?.paso === i
                          ? "text-[0.6875rem] leading-[1.15] font-semibold text-balance text-error"
                          : "text-[0.6875rem] leading-[1.15] text-balance text-texto-suave"
                      }
                    >
                      {n(caida)} {caidas[i] ?? "se quedaron en este paso"}
                    </p>
                  )}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {/* LA META, DICHA ENTERA Y DEBAJO DE LA FIGURA, pegada al paso del
          que habla --los inscritos-- y en letra pequeña: la misma frase
          de `EmbudoForma`. */}
      {meta !== null && meta > 0 && (
        <p className="mt-2 max-w-[58ch] text-[0.6875rem] leading-snug text-pretty text-texto-suave">
          Meta comprometida con el SENA: {n(meta)} inscritos en toda la convocatoria. Van{" "}
          <strong className="font-semibold text-titulo tabular-nums">{n(ultimo)}</strong>,
          el {porcentaje(ultimo, meta)}.
        </p>
      )}
    </div>
  );
}
