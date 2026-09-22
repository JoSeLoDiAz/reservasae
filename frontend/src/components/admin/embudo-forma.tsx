/** El embudo dibujado CON FORMA DE EMBUDO. */

/**
 * Cuatro trapecios que se angostan, con el nombre de cada paso
 * saliendo a la derecha.
 *
 * Es la figura que el cliente mandó como referencia (Zoho CRM,
 * «Deal Dashboards», 20 sep 2026) y la que reconoce como
 * «embudo»: «esto para quien no sepa pueda entenderlo». Cuatro
 * barras verticales --lo que había-- son un gráfico de barras que
 * casualmente baja; esto tiene silueta, y la silueta se lee sin
 * leyenda.
 *
 * El ancho de abajo de un trapecio ES el de arriba del siguiente,
 * así que la pared del embudo es continua: la caída entre dos
 * pasos se ve como un estrechamiento, que es lo que es. Entre uno
 * y otro queda un cuello recto, y a su derecha --en la misma
 * columna que los nombres-- va escrito quién se quedó ahí.
 *
 * Cada trapecio lleva DOS cifras suyas y no cuatro: la cantidad
 * y el porcentaje, las dos en la columna de rótulos. Las cuatro
 * cifras apiladas por barra fueron lo que se rechazó («no
 * entiendo una mierda», 20 sep 2026).
 */

import { Fragment } from "react";

import type { Hito } from "./embudo-proceso";
import { n } from "./graficos";

/// UNA sola rejilla a cualquier ancho: la figura a la izquierda y
/// la columna de rótulos a la derecha.
///
/// Había DOS maquetas --el rótulo debajo de su banda en celular y
/// al lado en escritorio-- y, para que el cuello no se
/// descentrara, un separador que reponía a mano el ancho del
/// rótulo. Eran dos medidas que había que acordarse de cambiar a
/// la vez, y la del separador llevaba `hidden`, que es
/// `display:none` a cualquier ancho: de 760 px para arriba los
/// cuellos salían 140 px más anchos que sus bandas y 70 px
/// corridos a la derecha, encima de los nombres. No se veía un
/// embudo. Con una sola rejilla el cuello ocupa exactamente la
/// misma columna que las bandas y no hay nada que sincronizar.
///
/// La columna del rótulo va en PORCENTAJE y no en píxeles: sobre
/// los 360 px que medía la figura daba 166 --sobre los 560 de
/// ahora da 258--, y en un celular de 390 px encoge sola en vez de
/// comerse la figura.
///
/// 46 % y no 36: con 130 px las tres caídas --«49 con datos, sin
/// inscribir»-- caían siempre en dos renglones, y entonces el
/// alto del cuello dejaba de ser una decisión de dibujo y pasaba
/// a depender de por dónde partiera el texto (medido: 30 px en
/// vez de los 26 declarados). En un renglón el cuello vuelve a
/// medir lo que dice el código.
const REJILLA = "grid grid-cols-[minmax(0,1fr)_46%] gap-x-3";

/// El ancho de la figura, con tope.
///
/// Sin tope, con «Hoy» --donde no hay serie por día-- las bandas
/// salían de 1.370 x 52 px: una cuña plana con el rótulo a mil
/// píxeles de su cifra. Una figura que cambia de escala según el
/// periodo tampoco se puede comparar de memoria con la del
/// periodo anterior, que es para lo que se mira un tablero.
///
/// 560 Y NO 360 desde que el embudo va en media fila (21 sep 2026):
/// «Dale más espacio al embudo, o sea a lo ancho, Claude; quizás
/// alineado como está: Por acción de formación / Por modalidad».
/// Su caja mide ahora la mitad del ancho --718 px útiles a 1.600,
/// 601 a 1.366-- y con el tope de 360 la figura se quedaba sola a
/// la izquierda con otra figura entera de vacío al lado, que es lo
/// que el cliente no quiere ver. Con 560 los trapecios pasan de 182
/// a 290 px de ancho, el vacío que queda a su derecha es menor que
/// ella en los dos anchos (158 y 41 px) y el embudo sigue midiendo
/// EXACTAMENTE lo mismo en los nueve periodos. Es un tope y no el
/// ancho entero porque, sin él, con «Hoy» las bandas salían de
/// 1.370 × 52 px: una cuña plana.
///
/// SIN `mx-auto`: por debajo del corte la rejilla del bloque
/// colapsa a una columna, y centrada la figura se iba al medio
/// de la tarjeta --hasta 275 px de sangría a 999 px-- mientras
/// la descripción, la meta y la letra pequeña seguían pegadas al
/// margen izquierdo. El dibujo principal quedaba flotando solo en
/// mitad del bloque.
const ANCHO_MAXIMO = "w-full max-w-[560px]";

/// Alto de banda y de cuello. Fijos y iguales en todos los
/// periodos: el `holgado` que estiraba las bandas a 56 px cuando
/// no había gráfico al lado hacía que la figura cambiara de
/// tamaño al mover el desplegable. La figura entera mide
/// 4 × 40 + 3 × 26 = 238 px.
///
/// YA NO SE AMARRAN A NADA (21 sep 2026). Se exportaban --con el
/// alto de la figura y el del renglón de la leyenda-- porque el
/// gráfico de columnas iba AL LADO y tenía que empezar y acabar
/// en la misma raya: eso costaba 57 px vacíos encima de la
/// primera banda. «La gráfica arriba, el embudo abajo» (cliente,
/// 21 sep 2026) separó los dos dibujos, así que no queda nada que
/// cuadrar y el gráfico declara su propio alto (ver
/// `ALTO_BARRAS` en `embudo-por-dia`). Quedan exportadas por si
/// otra figura quiere medirse contra esta, no para amarrarla.
export const ALTO_BANDA = 40;
export const ALTO_CUELLO = 26;

/// Por debajo de esto un trapecio CON GENTE no se angosta más: un
/// filo de nada no se vería. Es un SUELO DE VISIBILIDAD, así que
/// puede ser pequeño: con el 30 % de antes, «Con datos 3» y
/// «Inscritos 0» se dibujaban exactamente igual de anchos.
const ANCHO_MINIMO = 8;

/// Y el cero tiene su propio ancho, MENOR que ese suelo: un filo
/// que se ve pero que no se puede confundir con el paso más
/// flaco que sí tiene gente. Antes el cero se dibujaba con ancho
/// 0 --nada-- y la figura se partía: con «Hoy» (4·2·0·0) quedaban
/// 164 px de blanco entre el último trapecio y dos rótulos
/// flotando solos. El gráfico de al lado ya marca así sus días
/// sin gente, con un filete en vez de un hueco.
const ANCHO_CERO = 2.5;

/// Cuánto se cierra el último por debajo, para que la punta se
/// lea como punta y no como una barra cortada.
const PUNTA = 0.82;

/**
 * LA RAMPA DEL EMBUDO: un solo tono, cada vez más intenso.
 *
 * Las dos mitades del bloque usaban los MISMOS cuatro tokens de
 * etapa para decir cosas distintas: a la izquierda el azul era
 * «Contactados» --todos los que llegaron a contactarse o más
 * allá, 89 personas-- y a 250 px, en la leyenda del gráfico, el
 * mismo azul exacto era «Contactados, sin datos» --solo los que
 * se quedaron ahí, 30--. Quien empareja por color, que es lo que
 * hace cualquiera con una leyenda al lado, leía 89 donde ponía
 * 30. Medido con sonda de píxel: rgb(31,78,133) valía las dos
 * cosas, y rgb(76,58,140) otras dos.
 *
 * El empate se rompe, no se explica: el embudo pasa a una rampa
 * de un solo tono --el de la marca-- como el «Deal funnel» de
 * Zoho, y los cuatro colores de etapa quedan RESERVADOS para los
 * tramos excluyentes del gráfico de al lado. Así no hay ningún
 * emparejamiento 1 a 1 que hacer: a la izquierda hay una familia
 * y a la derecha cuatro categorías.
 *
 * La rampa se aleja de la superficie según se avanza --mezclando
 * primero con `--superficie` y después con `--titulo`--, así que
 * funciona igual en claro y en oscuro sin una segunda tabla, y
 * las cuatro bandas pasan de 3:1 contra la tarjeta (medido con
 * píxel, no con `getComputedStyle`: `color-mix` con `var()`
 * dentro de un SVG no lo resuelve el lienzo).
 */
const RAMPA = [
  "color-mix(in oklab, var(--marca) 88%, var(--superficie))",
  "var(--marca)",
  "color-mix(in oklab, var(--marca) 66%, var(--titulo))",
  "color-mix(in oklab, var(--marca) 34%, var(--titulo))",
];

/// LA PARED DEL CUELLO.
///
/// Es lo que hace que cuatro trapecios se lean como UNA figura.
/// Iba al 16 % sobre la superficie y medía 1,26:1 en claro y
/// 1,30 en oscuro --ni la mitad del mínimo de 3:1 que se le pide
/// a un elemento gráfico con significado--: en oscuro la figura
/// se leía como cuatro bloques flotando con tres huecos negros
/// entre ellos. Ahora es del mismo tono de la rampa, más claro
/// que cualquiera de las cuatro bandas, y pasa de 3:1.
const PARED = "color-mix(in oklab, var(--marca) 70%, var(--superficie))";

/// Lo que pasa ENTRE dos pasos, en las mismas palabras que la
/// leyenda del gráfico de días: quien lee empareja solo.
///
/// Exportada porque `EmbudoCono` --el embudo que hoy pinta
/// Control-- dice las mismas frases, y una copia en cada archivo se
/// separa el día que alguien cambie solo una.
export const CAIDAS = [
  "se quedaron sin contactar",
  "contactados, sin datos",
  "con datos, sin inscribir",
];

function porcentaje(parte: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((parte / total) * 100)} %`;
}

/**
 * En qué paso se queda MÁS gente, y cuánta.
 *
 * Suelto y exportado porque la frase que lo dice --en la
 * descripción del bloque y en su letra pequeña-- tiene que salir
 * de la misma cuenta que el renglón en rojo de la figura: si se
 * calculara dos veces podrían no coincidir.
 */
export function caidaMayor(hitos: Hito[]): { paso: number; cuantos: number } | null {
  let paso = -1;
  let cuantos = 0;
  for (let i = 0; i < hitos.length - 1; i += 1) {
    const c = hitos[i].total - hitos[i + 1].total;
    if (c > cuantos) {
      cuantos = c;
      paso = i;
    }
  }
  return paso < 0 ? null : { paso, cuantos };
}

/** Un trapecio: `arriba` y `abajo` son anchos en % del ancho. */
function Trapecio({
  arriba,
  abajo,
  color,
}: {
  arriba: number;
  abajo: number;
  color: string;
}) {
  return (
    /// `preserveAspectRatio="none"` deforma el dibujo para llenar
    /// la caja, que es justo lo que se quiere: el polígono no
    /// tiene trazo ni texto dentro, así que no hay nada que se
    /// deforme mal.
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <polygon
        points={`${(100 - arriba) / 2},0 ${(100 + arriba) / 2},0 ${
          (100 + abajo) / 2
        },100 ${(100 - abajo) / 2},100`}
        fill={color}
      />
    </svg>
  );
}

export function EmbudoForma({
  hitos,
  antes = null,
  etiquetaAntes = null,
  meta = null,
  caidas = CAIDAS,
}: {
  hitos: Hito[];
  /// La misma cifra en el periodo con el que se compara, en el
  /// mismo orden. Null = no se compara y no se deja hueco.
  ///
  /// Quien lo manda tiene que callarlo cuando el periodo anterior
  /// no trajo a nadie: «antes 0» cuatro veces se lee como que se
  /// pasó de cero a ciento treinta y seis, y lo que pasa es que
  /// no hay con qué comparar (ver `panel-proceso`).
  antes?: number[] | null;
  /// Cómo se llama ese periodo. Va en el `title` y no escrito:
  /// «el mismo tramo del periodo anterior» repetido cuatro veces
  /// tapaba el embudo. Dicho con todas las letras está arriba, en
  /// el pie de la cifra «Se inscribe» de la tira del periodo.
  etiquetaAntes?: string | null;
  /// La meta comprometida con el SENA. Va DEBAJO de la figura,
  /// pegada al paso del que habla, y en letra pequeña. Quien la
  /// manda decide cuándo se puede enseñar (ver `panel-proceso`).
  meta?: number | null;
  caidas?: string[];
}) {
  if (hitos.length === 0) return null;

  const primero = hitos[0].total;
  const ultimo = hitos[hitos.length - 1].total;

  /// SIN NADIE NO HAY FIGURA.
  ///
  /// Con el corte en cero --«Hoy» temprano, o un asesor sin leads
  /// este mes-- se dibujaban cuatro bandas de ancho 0 y tres
  /// cuellos igual: 302 px de blanco con ocho rótulos a cero
  /// flotando al lado, que parece una pantalla rota a medio
  /// cargar. Quien llama a esto lo resuelve antes --ver `SinGente`
  /// en `panel-proceso`--, pero la figura no puede dibujar la
  /// nada aunque se lo pidan.
  if (primero <= 0) return null;

  /// El ancho de cada trapecio, en % del ancho de la columna.
  /// Se fuerza a que no crezca hacia abajo: el dato promete ser
  /// monótono, pero un desfase de caché no puede pintar un
  /// embudo que se ensancha --eso no se puede leer--.
  const anchos: number[] = [];
  for (const [i, h] of hitos.entries()) {
    const suyo =
      h.total <= 0
        ? ANCHO_CERO
        : Math.max(ANCHO_MINIMO, Math.round((h.total / primero) * 100));
    anchos.push(i === 0 ? suyo : Math.min(suyo, anchos[i - 1]));
  }

  /// En cuál se queda más gente. Es el único renglón de la figura
  /// que va en rojo: los otros dos, en gris.
  const mayor = caidaMayor(hitos);

  return (
    <div className={ANCHO_MAXIMO}>
      {/* LA FIGURA ARRANCA EN LA PRIMERA RAYA DE SU CAJA.
          Aquí había un renglón vacío de 34 px, 8 de aire y una
          sangría de 15: 57 px de nada que solo servían para que
          la primera banda empezara a la altura del tope del eje
          del gráfico de columnas, cuando iba al lado. Separados
          los dos dibujos (cliente, 21 sep 2026), ese aire era un
          hueco encima del embudo sin nada con qué cuadrar.
          La frase de los porcentajes que vivió aquí sigue a la
          vista, en la descripción del bloque («Porcentajes sobre
          las 206 que entraron»). */}
      <div className={REJILLA}>
        {hitos.map((h, i) => {
          const arriba = anchos[i];
          const abajo = i === hitos.length - 1 ? arriba * PUNTA : anchos[i + 1];
          /// LA CAÍDA ES LA DE ESTE PASO AL SIGUIENTE.
          ///
          /// Este cuello va DEBAJO del hito `i`, así que lo que
          /// se queda aquí es `hitos[i] - hitos[i+1]`, que es lo
          /// que dice `caidas[i]`. Restando hacia arriba, la
          /// cifra salía corrida un paso: el primer cuello --la
          /// gente sin contactar, que es lo que trae a alguien a
          /// esta pantalla-- no se dibujaba nunca, y las otras
          /// dos llevaban el nombre del paso siguiente y
          /// desmentían a la leyenda del gráfico de al lado.
          const caida = i < hitos.length - 1 ? h.total - hitos[i + 1].total : 0;
          const antesDe = antes?.[i];
          /// Los dos apuntes pequeños, en UNA línea: en dos, el
          /// bloque del rótulo crecía más que su banda y el
          /// nombre del paso quedaba descentrado respecto de la
          /// figura --medido, hasta 11,7 px sobre bandas de 40--.
          const apuntes: Array<{ texto: string; pista: string }> = [];
          if (i > 0) {
            apuntes.push({
              texto: porcentaje(h.total, primero),
              pista: `${n(h.total)} de los ${n(primero)} que entraron`,
            });
          }
          if (antesDe !== undefined) {
            /// SIN flecha, SIN color y SIN la resta hecha: los
            /// del periodo anterior tuvieron más tiempo para
            /// avanzar, así que un «menos» aquí abajo no
            /// significa que vaya peor (José, 18 sep 2026). El
            /// número cuenta; no afirma.
            apuntes.push({
              texto: `antes ${n(antesDe)}`,
              pista: `${h.etiqueta} en ${etiquetaAntes ?? "el periodo anterior"}: ${n(antesDe)}`,
            });
          }

          return (
            <Fragment key={`${h.etiqueta}#${i}`}>
              {/* EL TRAPECIO, solo color.
                  `minHeight` y no `height`: así la banda se
                  estira con la fila si el rótulo de al lado
                  fuera más alto, y la pared del embudo no se
                  parte con un hueco entre banda y cuello. */}
              <div className="relative" style={{ minHeight: ALTO_BANDA }}>
                <Trapecio arriba={arriba} abajo={abajo} color={RAMPA[i] ?? RAMPA[RAMPA.length - 1]} />
              </div>

              {/* EL RÓTULO, a la derecha de su banda y centrado
                  con ella. LA CIFRA VA SIEMPRE AQUÍ.
                  Estaba dentro del trapecio cuando cabía y al
                  lado del rótulo cuando no, así que con «Últimos
                  7 días» (23·10·3·0) dos cifras salían en blanco
                  sobre el color y las otras dos en tinta oscura
                  126 px más a la derecha: para leer «23, 10, 3,
                  0» --lo primero que se hace al abrir-- había que
                  bajar la vista en zigzag. Siempre en la misma
                  columna, las cuatro se leen de un tirón valga lo
                  que valga cada paso, que es lo que hace legible
                  el embudo de Zoho. */}
              <div className="flex flex-col justify-center gap-0.5 self-center text-left">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[1.25rem] leading-none font-bold text-titulo tabular-nums">
                    {n(h.total)}
                  </span>
                  <span className="text-[0.84375rem] leading-tight font-semibold text-titulo">
                    {h.etiqueta}
                  </span>
                </span>
                {/* EL RENGLÓN DE LOS APUNTES OCUPA SITIO SIEMPRE,
                    lleve algo escrito o no.
                    «Entraron» no tiene porcentaje --es el 100 %--
                    y los otros tres sí, así que el bloque del
                    rótulo medía distinto en cada paso y cada uno
                    quedaba a una altura distinta respecto de su
                    banda; y el desnivel cambiaba al mover el
                    periodo, según hubiera o no «antes N». Con el
                    renglón reservado los cuatro miden igual y la
                    figura deja de bailar. */}
                <span
                  className="block min-h-[14px] text-[0.6875rem] leading-tight text-texto-suave tabular-nums"
                  title={apuntes.map((a) => a.pista).join(" · ") || undefined}
                >
                  {apuntes.map((a) => a.texto).join(" · ")}
                </span>
              </div>

              {/* EL CUELLO --solo la pared-- Y SU CAÍDA, que va en
                  la columna de los rótulos.
                  El texto estaba centrado sobre el ancho entero
                  de la fila mientras la pared mide lo que mide el
                  paso siguiente: en «Últimos 7 días» el tercer
                  cuello tenía pared de 0 px y un texto de 125,
                  flotando sobre la tarjeta lisa. Puesto en la
                  columna del rótulo, el texto ya no depende del
                  ancho del paso y se lee contra la tarjeta. */}
              {i < hitos.length - 1 && (
                <>
                  <div className="relative" style={{ minHeight: ALTO_CUELLO }} data-pieza="cuello">
                    <Trapecio arriba={abajo} abajo={abajo} color={PARED} />
                  </div>
                  <div className="flex items-center self-stretch">
                    {caida > 0 && (
                      /// SOLO LA MAYOR EN ROJO.
                      ///
                      /// Las tres iban en rojo, en negrita y al
                      /// mismo tamaño, así que lo primero que se
                      /// leía del embudo no eran sus cuatro
                      /// cifras sino tres avisos iguales, y la
                      /// pregunta que trae a alguien aquí --en
                      /// qué paso se queda la gente-- había que
                      /// contestarla restando a ojo. Con «Desde
                      /// el principio» la mayor iba escrita la
                      /// ÚLTIMA, debajo de dos más pequeñas.
                      /// Ahora salta la que contesta y las otras
                      /// dos acompañan.
                      /// `text-balance` en las dos: en la columna
                      /// del rótulo a 390 px, «40 se quedaron sin
                      /// contactar» partía dejando «contactar»
                      /// sola. Se probó `text-pretty` y no lo
                      /// arregló --medido en los cinco periodos
                      /// con gente--: `pretty` es para párrafos, y
                      /// esto es un rótulo de dos renglones, que es
                      /// lo que reparte `balance`. No evita el
                      /// segundo renglón --eso lo hace el 46 % de
                      /// la rejilla-- pero lo deja en dos mitades.
                      <p
                        className={
                          mayor?.paso === i
                            ? "text-[0.6875rem] leading-tight text-balance font-semibold text-error"
                            : "text-[0.6875rem] leading-tight text-balance text-texto-suave"
                        }
                      >
                        {n(caida)} {caidas[i] ?? "se quedaron en este paso"}
                      </p>
                    )}
                  </div>
                </>
              )}
            </Fragment>
          );
        })}
      </div>

      {/* LA META, DICHA ENTERA Y DEBAJO DE LA FIGURA.
          Estuvo pegada al último rótulo --«meta 3.690 · 1 %», sin
          decir de qué y descentrando ese rótulo-- y después subió
          a una columna de texto propia arriba del bloque, al mismo
          nivel que las otras respuestas. Ahí sobraba: «no
          exageres», «lo veo cargado» (cliente, 21 sep 2026). La
          meta habla del ÚLTIMO PASO del embudo --los inscritos--
          así que su sitio es debajo de la figura, pegada a lo que
          cuenta, y en letra pequeña. Quien la manda decide cuándo
          se puede enseñar (ver `panel-proceso`). */}
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
