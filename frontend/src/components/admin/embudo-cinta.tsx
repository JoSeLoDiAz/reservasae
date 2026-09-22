"use client";

/** El embudo dibujado COMO UNA CINTA EN ESPIRAL: la segunda referencia del cliente. */

/**
 * Una cinta ancha que baja dando vueltas y se estrecha: cada vuelta es
 * un paso, de su color, un poco inclinada --sube hacia la derecha--,
 * con el revés más oscuro asomando por la izquierda, donde la cinta da
 * media vuelta. La última se retuerce en una cola que acaba en punta,
 * y de cada vuelta sale una línea fina de su color hasta su rótulo,
 * con el número del paso en dos cifras.
 *
 * «¿Esto por qué como en triángulo así? No fue la imagen de
 * referencia. Te paso otro que me gustó mucho» (cliente, 21 sep 2026,
 * con un embudo de cintas de la escuela de negocios Veigler). El cono
 * de `EmbudoCono` se leía como un triángulo con rayas: piezas rectas,
 * simétricas y quietas. Lo que hace reconocible la referencia es la
 * cinta: curva, inclinada, con su revés, y la cola enroscada.
 *
 * Da lo mismo que daba el cono y con las mismas props, para que
 * cambiar uno por otro sea cambiar el import: la cifra y el nombre de
 * cada paso, el porcentaje sobre los que entraron, lo que se queda
 * entre paso y paso con la mayor en rojo, el «antes N» con su periodo
 * en el `title` y la meta del SENA debajo. Solo cambia la forma.
 */

import { Fragment, useId, useLayoutEffect, useRef, useState } from "react";

import type { Hito } from "./embudo-proceso";
import { CAIDAS, caidaMayor } from "./embudo-forma";
import { colorEtapa } from "./etapa";
import { n } from "./graficos";

/// LA MISMA CAJA QUE EL CONO: «mismos tamaños» (Mauricio, 21 sep 2026).
///
/// Tope de 560 px, figura a la izquierda y 46 % para los rótulos, con
/// 12 px entre las dos: a 1.600 y a 1.366 la figura mide 290 px de ancho
/// y a 390, 150. Son las medidas de `EmbudoCono` y de `EmbudoForma`, así
/// que al cambiar el import el bloque no crece ni encoge y la lista de
/// «Qué atender primero», que va al lado, no se mueve.
const ANCHO_MAXIMO = "@container w-full max-w-[560px]";
/// EN UNA CAJA ANGOSTA, MÁS SITIO PARA LOS RÓTULOS. A 360 px el 46 %
/// son unos 136 px y los textos de caída («40 se quedaron sin
/// contactar») partían en dos renglones: cada fila crecía, las cintas
/// no alcanzaban a cerrar la ranura y quedaban cuatro vasos sueltos con
/// huecos de 5 a 20 px (medido a 360 y 320). Con el 58 % caben en uno,
/// las filas vuelven a su alto y la figura, más estrecha, sigue siendo
/// una espiral. Por encima de 400 px de caja no cambia nada.
const REJILLA = "grid grid-cols-[minmax(0,1fr)_46%] gap-x-3 @max-[400px]:grid-cols-[minmax(0,1fr)_58%] @max-[400px]:gap-x-2";

/// LA FIGURA MIDE 238 PX DE ALTO, como el cono.
///
/// Se reparten entre los pasos lo que dejan las ranuras --8 px, las del
/// cono-- y el sitio de la COLA: la última vuelta lleva debajo la punta
/// retorcida y su sombra, y eso no cabe en el alto de un paso sin
/// aplastar la cinta. Con cuatro pasos cada uno mide 50 px y la última
/// fila, 64. El rótulo de la última va arriba de su fila, a la misma
/// altura de su cinta que los demás (ver el rótulo), y los 14 px de más
/// quedan debajo, donde en la columna de la derecha no hay nada.
/// 14 y no más: con 18 los pasos medían 49, y el texto de caída quedaba
/// a 1,2 px de la cifra de encima (medido a 1.600).
///
/// Las filas crecen si un rótulo no cabe --en el celular, con «antes N»,
/// el renglón de la cifra parte en dos--, y el dibujo las sigue porque
/// sale de medirlas (ver `medir`), así que nunca se monta un texto
/// sobre otro para guardar el alto.
const ALTO_FIGURA = 238;
const RANURA = 8;
const COLA = 14;

function altoPaso(pasos: number): number {
  return (ALTO_FIGURA - (pasos - 1) * RANURA - COLA) / pasos;
}

/// LA FORMA ES FIJA, NO PROPORCIONAL A LAS CIFRAS, por lo mismo que en
/// el cono: la silueta es lo que se reconoce como embudo, y con anchos
/// proporcionales un periodo como «Ayer» (4 · 2 · 1 · 0) dejaba el
/// último paso en un hilo. El dato va escrito al lado.
///
/// La primera vuelta ocupa el 90 % de la columna y no el 100: el 10 %
/// que sobra es la línea guía de la primera, que sin él se quedaba en
/// los 12 px del hueco entre columnas y no se leía como línea. Las
/// demás se estrechan en escalones iguales hasta el 36 % de la primera
/// --las cintas de la referencia van de 380 a 165 px en sus cuatro
/// primeras--. `MARGEN_IZQUIERDO` es el sitio del pliegue, que se sale
/// un poco por la izquierda de la cinta.
const ANCHO_PRIMERA = 0.9;
const CIERRE = 0.64;
const MARGEN_IZQUIERDO = 8;

/// LAS CURVAS NO SE ESTIRAN NUNCA.
///
/// El cono lo resolvía con un SVG de `viewBox` fijo por cada elipse, que
/// el navegador escalaba igual a lo ancho que a lo alto. Aquí no sirve:
/// la cinta es UNA figura que cruza las filas --la cola, el revés que
/// asoma en la ranura de encima--, y la caja mide 238 de alto con 150 o
/// 290 de ancho según la pantalla. Un `viewBox` fijo para todo tendría
/// que estirarse con `preserveAspectRatio="none"` --el defecto de la
/// gráfica del punto ovalado que el cliente ya vio-- o dejar huecos.
///
/// Así que el dibujo se hace en PÍXELES DE VERDAD: el `viewBox` es
/// siempre el tamaño que mide la caja, una unidad es un píxel y no hay
/// escala que pueda deformar nada. La proporción la fijan estas
/// constantes, todas relativas al ancho de cada cinta: la comba de sus
/// bordes es el 7,5 % de su ancho a cualquier ancho, y la curva es la
/// misma a 1.600 que en el celular. Lo único que no es proporcional es
/// el grueso, que sale del alto de las filas (ver `gruesos`).
///
/// COMBA: cuánto se comban hacia abajo los bordes, el frente de un
/// anillo visto un poco desde arriba. GIRO: la inclinación, en grados;
/// crece vuelta a vuelta porque en una espiral las vueltas estrechas
/// bajan más empinadas, y es lo que abre por la izquierda la ranura por
/// donde se ve el revés. ESTRECHA: cuánto entra cada extremo por abajo,
/// para que los lados sigan la pared del embudo. PLIEGUE, REVES y
/// CURVA_DERECHA van en fracción del grueso: la panza del pliegue, el
/// alto del revés que asoma y la del extremo derecho.
const COMBA = 0.075;
const GIRO_PRIMERA = 4;
const GIRO_POR_PASO = 2.2;
const ESTRECHA = 0.07;
const PLIEGUE = 0.2;
const REVES = 0.26;
const CURVA_DERECHA = 0.12;

/// Por dónde sale la línea guía: al 30 % del alto del extremo derecho,
/// no a la mitad. La línea va al renglón del número del paso, que es el
/// de arriba del rótulo, y a la mitad la primera cinta se salía por
/// arriba de la caja.
const SALIDA = 0.3;

/// Las cintas casi se tocan, como en la referencia: el grueso es el
/// mayor que deja 1,5 px entre una y la de abajo por la derecha. Por la
/// izquierda la ranura es mayor --la de abajo baja más empinada-- y por
/// ahí asoma su revés. Con tope en el 36 % del ancho de la figura: en el
/// celular las filas son más altas --los textos de caída parten en dos
/// renglones-- y sin tope la cinta salía casi tan gruesa como ancha.
const HUECO = 1.5;
/// Cuánto puede subir la primera cinta por encima de la caja: 4 px del
/// aire que el bloque deja sobre la figura, que no mueven nada porque el
/// dibujo va en posición absoluta. Hace falta en el celular: la línea de
/// la primera va al número de su rótulo, que está arriba del todo, y con
/// la cinta entera dentro de la caja su grueso se quedaba en 35 px con
/// huecos de 15 entre vuelta y vuelta --cuatro cubos sueltos, no una
/// espiral (medido a 390)--.
const TECHO = 4;
const GRUESO_MINIMO = 18;
const GRUESO_MAXIMO = 70;
const GRUESO_RELATIVO = 0.36;

/// LA COLA: la última vuelta no se cierra por abajo, se retuerce en
/// punta. Mide de grueso por la derecha la mitad de las otras --el
/// resto de su alto es cola-- y va menos inclinada, para que la punta
/// caiga bajo el centro y no se salga por la izquierda. Una franja del
/// revés la cruza en diagonal: es el giro de la cinta, lo que hace que
/// se lea como cinta retorcida y no como un cucurucho.
const GRUESO_COLA = 0.5;
const GIRO_COLA = 7;
const PUNTA_X = 0.1;
const PUNTA_SUELO = 5;

/// La sombra, una elipse difuminada bajo la punta, sobre el «suelo».
const SOMBRA_ANCHO = 0.2;
const SOMBRA_ALTO = 4;
const SOMBRA_SUELO = 4;

/// LOS DOS TONOS OSCUROS DE CADA CINTA, sacados de su propio color.
///
/// El revés, bastante más oscuro que el frente: la variable de la etapa
/// mezclada con negro, como la tapa del cono. Negro y no `--titulo`,
/// que en el tema oscuro es casi blanco y aclaraba en vez de oscurecer:
/// el negro no es un color de la paleta sino la sombra, y en los dos
/// temas el revés queda más oscuro que su frente --en oscuro las etapas
/// son pastel y el revés sale de tono medio, que se sigue viendo contra
/// el fondo--. El pliegue, un tono menos: el frente se oscurece hacia
/// la izquierda, donde la cinta dobla, y eso es lo que le da volumen.
function colorReves(cuerpo: string): string {
  return `color-mix(in oklab, ${cuerpo} 60%, black)`;
}

function colorPliegue(cuerpo: string): string {
  return `color-mix(in oklab, ${cuerpo} 78%, black)`;
}

function colorMedio(cuerpo: string): string {
  return `color-mix(in oklab, ${cuerpo} 91%, black)`;
}

/// La sombra sale de la superficie y no de un gris fijo: en claro da un
/// gris medio y en oscuro un pozo más oscuro que la tarjeta. Un negro
/// transparente se perdía contra el fondo oscuro, y un color claro ahí
/// se leería como un brillo, no como una sombra.
const COLOR_SOMBRA = "color-mix(in oklab, var(--superficie) 45%, black)";

function porcentaje(parte: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((parte / total) * 100)} %`;
}

/* ---- Geometría ---------------------------------------------------- */

type Punto = [number, number];
type Cubica = [Punto, Punto, Punto, Punto];

/// Gira un punto alrededor del origen. Con `th` positivo lo que está a
/// la derecha SUBE (en pantalla la y crece hacia abajo).
function girar([x, y]: Punto, th: number): Punto {
  const co = Math.cos(th);
  const si = Math.sin(th);
  return [x * co + y * si, -x * si + y * co];
}

function enCubica([p0, p1, p2, p3]: Cubica, t: number): Punto {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/// Parte una curva en `t` en dos curvas que la dibujan igual.
function partir([p0, p1, p2, p3]: Cubica, t: number): [Cubica, Cubica] {
  const entre = (a: Punto, b: Punto): Punto => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const a = entre(p0, p1);
  const b = entre(p1, p2);
  const c = entre(p2, p3);
  const d = entre(a, b);
  const e = entre(b, c);
  const f = entre(d, e);
  return [
    [p0, a, d, f],
    [f, e, c, p3],
  ];
}

function alReves([p0, p1, p2, p3]: Cubica): Cubica {
  return [p3, p2, p1, p0];
}

const cifra = (v: number) => Math.round(v * 10) / 10;

/// Lo que se mide de la caja para dibujar: su tamaño, la altura de cada
/// línea guía --la del número de su rótulo-- y dónde empieza ese número.
type Medida = {
  ancho: number;
  alto: number;
  anclas: number[];
  hasta: number[];
};

type Dibujo = {
  cintas: Array<{ frente: string; reves: string; giro: string | null }>;
  lineas: Array<{ x1: number; x2: number; y: number }>;
  sombra: { cx: number; cy: number; rx: number; ry: number };
};

/**
 * Las cintas, en píxeles de la caja.
 *
 * Cada cinta se dibuja primero en su marco --el centro de su borde de
 * arriba en el origen, sin inclinar-- y después se gira y se coloca.
 * Girar es un movimiento rígido: no estira nada. Se coloca de modo que
 * la línea guía, que va a la altura del número de su rótulo, salga de
 * su extremo derecho (ver `SALIDA`): el dibujo sigue a los rótulos, y
 * no al revés, porque son los rótulos los que pueden crecer.
 */
function dibujar({ ancho: W, alto: H, anclas, hasta }: Medida, pasos: number): Dibujo {
  const util = W * ANCHO_PRIMERA - MARGEN_IZQUIERDO;
  const cx = MARGEN_IZQUIERDO + util / 2;
  const d = ESTRECHA * util;

  function cinta(i: number, T0: number) {
    const ultima = pasos > 1 && i === pasos - 1;
    const T = ultima ? T0 * GRUESO_COLA : T0;
    const w = util * (pasos <= 1 ? 1 : 1 - CIERRE * (i / (pasos - 1)));
    const hw = w / 2;
    const th = ((ultima ? GIRO_COLA : GIRO_PRIMERA + GIRO_POR_PASO * i) * Math.PI) / 180;
    const s = COMBA * w;
    const w2 = w - 2 * d;
    const s2 = COMBA * w2;
    const b = PLIEGUE * T0;
    const h = REVES * T0;
    const bd = CURVA_DERECHA * T0;
    const TL: Punto = [-hw, 0];
    const TR: Punto = [hw, 0];
    const BR: Punto = [hw - d, T];
    const BL: Punto = [-hw + d, T];
    /// Cúbicas con los tiradores al 22 % del ancho y 4/3 de la comba:
    /// así el punto más bajo cae justo a `s` bajo la cuerda.
    const arriba: Cubica = [TL, [-hw + 0.22 * w, (4 / 3) * s], [hw - 0.22 * w, (4 / 3) * s], TR];
    const derecha: Cubica = [TR, [hw + bd * 1.35, T * 0.26], [hw - d + bd * 1.35, T * 0.74], BR];
    const abajo: Cubica = [
      BR,
      [hw - d - 0.22 * w2, T + (4 / 3) * s2],
      [-hw + d + 0.22 * w2, T + (4 / 3) * s2],
      BL,
    ];
    const pliegue: Cubica = [BL, [-hw + d - b * 1.35, T * 0.74], [-hw - b * 1.35, T * 0.26], TL];
    /// El revés sube desde la esquina del pliegue y vuelve a bajar
    /// hasta tocar el borde de arriba hacia el 60 % del ancho.
    const toca = enCubica(arriba, 0.6);
    const reves1: Cubica = [TL, [-hw - b * 0.9, -h * 0.45], [-hw - b * 0.1, -h], [-hw + 0.13 * w, -h]];
    const reves2: Cubica = [
      [-hw + 0.13 * w, -h],
      [-hw + 0.36 * w, -h],
      [toca[0] - 0.12 * w, toca[1] - 0.02 * w],
      toca,
    ];
    const salida = enCubica(derecha, SALIDA);
    const g = girar(salida, th);
    const origen: Punto = [cx, anclas[i] - g[1]];
    const colocar = (p: Punto): Punto => {
      const q = girar(p, th);
      return [origen[0] + q[0], origen[1] + q[1]];
    };
    return { ultima, w, hw, th, T, d, b, TL, BR, arriba, derecha, abajo, pliegue, toca, reves1, reves2, origen, colocar };
  }

  /// La altura del borde de abajo de una cinta en una `x` de pantalla.
  function alturaEn(linea: Punto[], x: number): number | null {
    for (let j = 0; j < linea.length - 1; j += 1) {
      const [a, b] = [linea[j], linea[j + 1]];
      if (x >= Math.min(a[0], b[0]) && x <= Math.max(a[0], b[0])) {
        const u = (x - a[0]) / (b[0] - a[0] || 1);
        return a[1] + u * (b[1] - a[1]);
      }
    }
    return null;
  }

  /// El hueco más estrecho entre la cinta `i` --de grueso `Ti`-- y la de
  /// abajo --de grueso `Tj`--, medido en la mitad derecha de la de
  /// abajo, que es donde casi se tocan.
  function hueco(i: number, Ti: number, Tj: number): number {
    const a = cinta(i, Ti);
    const b = cinta(i + 1, Tj);
    const borde: Punto[] = [];
    for (let k = 0; k <= 40; k += 1) borde.push(a.colocar(enCubica(a.abajo, k / 40)));
    let minimo = Infinity;
    for (let k = 0; k <= 30; k += 1) {
      const q = b.colocar(enCubica(b.arriba, 0.6 + (0.4 * k) / 30));
      const y = alturaEn(borde, q[0]);
      if (y !== null) minimo = Math.min(minimo, q[1] - y);
    }
    return minimo;
  }

  /// Lo más alto de la primera cinta: su esquina de arriba a la derecha
  /// o la cresta del revés, que asoma por la izquierda.
  function techo(T: number): number {
    const c = cinta(0, T);
    let y = Infinity;
    for (const curva of [c.arriba, c.derecha, c.reves1, c.reves2]) {
      for (let k = 0; k <= 12; k += 1) y = Math.min(y, c.colocar(enCubica(curva, k / 12))[1]);
    }
    return y;
  }

  /// EL GRUESO, en dos pasadas y siempre con el tope de
  /// `GRUESO_RELATIVO`.
  ///
  /// Primero uno para todas: el mayor que deja `HUECO` en todos los
  /// pares. Es el de la cola, y con filas iguales --en escritorio-- es
  /// el de todas. Después, de abajo arriba, cada cinta crece hasta
  /// casi tocar la de abajo: si un texto de caída parte en dos renglones
  /// su ranura crece, y en vez de abrirse un hueco entre esas dos vueltas
  /// --una pausa en el embudo que no existe-- la de encima sale un poco
  /// más gruesa. Y la primera, sin subir más de `TECHO` sobre la caja.
  const tope = Math.min(GRUESO_MAXIMO, GRUESO_RELATIVO * W);
  let base = GRUESO_MINIMO;
  for (let t = GRUESO_MINIMO; t <= tope; t += 0.5) {
    let cabe = true;
    for (let i = 0; i < pasos - 1 && cabe; i += 1) cabe = hueco(i, t, t) >= HUECO;
    if (!cabe) break;
    base = t;
  }
  const gruesos = Array.from({ length: pasos }, () => base);
  for (let i = pasos - 2; i >= 0; i -= 1) {
    let t = tope;
    while (t > GRUESO_MINIMO && (hueco(i, t, gruesos[i + 1]) < HUECO || (i === 0 && techo(t) < -TECHO))) {
      t -= 0.5;
    }
    gruesos[i] = t;
  }
  while (pasos === 1 && gruesos[0] > GRUESO_MINIMO && techo(gruesos[0]) < -TECHO) gruesos[0] -= 0.5;

  const cintas: Dibujo["cintas"] = [];
  const lineas: Dibujo["lineas"] = [];
  let punta: Punto = [cx, H - PUNTA_SUELO];

  for (let i = 0; i < pasos; i += 1) {
    const c = cinta(i, gruesos[i]);
    const p = (q: Punto) => {
      const [x, y] = c.colocar(q);
      return `${cifra(x)} ${cifra(y)}`;
    };
    const C = ([, a, b, z]: Cubica) => `C${p(a)} ${p(b)} ${p(z)}`;

    /// El revés se cierra por DENTRO del frente --que se pinta
    /// encima-- para que no quede ningún filo suelto entre los dos.
    const reves = `M${p(c.TL)} ${C(c.reves1)} ${C(c.reves2)} L${p([c.toca[0], c.toca[1] + c.T * 0.3])} L${p([-c.hw + c.d, c.T * 0.5])} Z`;

    let frente: string;
    let giro: string | null = null;
    if (!c.ultima) {
      frente = `M${p(c.TL)} ${C(c.arriba)} ${C(c.derecha)} ${C(c.abajo)} ${C(c.pliegue)} Z`;
    } else {
      /// LA COLA. La punta se pide en pantalla --a 5 px del suelo, bajo
      /// el centro-- y se pasa al marco de la cinta deshaciendo el giro.
      punta = [cx + PUNTA_X * c.w, H - PUNTA_SUELO];
      const tip = girar([punta[0] - c.origen[0], punta[1] - c.origen[1]], -c.th);
      const largo = tip[1];
      const izquierda: Cubica = [
        c.TL,
        [c.TL[0] - c.b * 1.2, largo * 0.38],
        [tip[0] - c.w * 0.2, tip[1] - largo * 0.3],
        tip,
      ];
      const caida = largo - c.BR[1];
      const lado: Cubica = [
        c.BR,
        [c.BR[0] - c.w * 0.1, c.BR[1] + caida * 0.4],
        [tip[0] + c.w * 0.04, tip[1] - caida * 0.3],
        tip,
      ];
      frente = `M${p(c.TL)} ${C(c.arriba)} ${C(c.derecha)} ${C(lado)} ${C(alReves(izquierda))} Z`;

      /// EL GIRO: la franja del revés entre el 30 y el 64 % del lado
      /// izquierdo y el 22 y el 70 % del derecho, con los cortes combados
      /// como el borde de una cinta.
      const [izqTramo] = partir(partir(izquierda, 0.3)[1], (0.64 - 0.3) / 0.7);
      const [derTramo] = partir(partir(lado, 0.22)[1], (0.7 - 0.22) / 0.78);
      const [A1, , , A2] = izqTramo;
      const [B1, , , B2] = derTramo;
      const comba = 0.04 * c.w;
      const corte = (A: Punto, B: Punto): [Punto, Punto] => [
        [A[0] + (B[0] - A[0]) * 0.4, A[1] + (B[1] - A[1]) * 0.2 + comba],
        [B[0] - (B[0] - A[0]) * 0.3, B[1] - (B[1] - A[1]) * 0.1 + comba * 0.5],
      ];
      const [k1, k2] = corte(A2, B2);
      const [k3, k4] = corte(A1, B1);
      giro = `M${p(A1)} ${C(izqTramo)} C${p(k1)} ${p(k2)} ${p(B2)} ${C(alReves(derTramo))} C${p(k4)} ${p(k3)} ${p(A1)} Z`;
    }
    cintas.push({ frente, reves, giro });

    /// La línea, en medio píxel para que salga nítida de 1 px, desde el
    /// extremo derecho hasta 4 px antes del número.
    const sale = c.colocar(enCubica(c.derecha, SALIDA));
    const y = Math.round(anclas[i]) + 0.5;
    lineas.push({ x1: cifra(sale[0] + 1.5), x2: cifra(hasta[i] - 4), y });
  }

  return {
    cintas,
    lineas,
    sombra: { cx: cifra(punta[0]), cy: cifra(H - SOMBRA_SUELO), rx: cifra(W * SOMBRA_ANCHO), ry: SOMBRA_ALTO },
  };
}

/// Medio píxel basta: medir con más detalle solo repintaría el dibujo
/// por diferencias que no se ven.
const medio = (v: number) => Math.round(v * 2) / 2;

function igual(a: Medida, b: Medida): boolean {
  return (
    a.ancho === b.ancho &&
    a.alto === b.alto &&
    a.anclas.length === b.anclas.length &&
    a.anclas.every((v, i) => v === b.anclas[i]) &&
    a.hasta.every((v, i) => v === b.hasta[i])
  );
}

export function EmbudoCinta({
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
  const pasos = hitos.length;
  const primero = pasos > 0 ? hitos[0].total : 0;
  const ultimo = pasos > 0 ? hitos[pasos - 1].total : 0;

  /// Los ids de los degradados, únicos por embudo y sin caracteres que
  /// un `url(#…)` pudiera leer mal.
  const id = `cinta${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const figura = useRef<HTMLDivElement>(null);
  const rotulos = useRef<Array<HTMLDivElement | null>>([]);
  const [medida, setMedida] = useState<Medida | null>(null);

  /// Se vuelve a medir cuando cambian las cifras: un rótulo puede pasar
  /// de uno a dos renglones sin que la caja cambie de tamaño.
  const firma = `${hitos.map((h) => `${h.etiqueta}:${h.total}`).join("|")}/${antes?.join(",") ?? ""}`;

  /// MEDIR ANTES DE PINTAR, con `useLayoutEffect`: la figura sale ya
  /// dibujada en el primer cuadro, sin un parpadeo vacío.
  /// El `ResizeObserver` vigila la caja y cada rótulo --si un rótulo
  /// parte en dos renglones, su número baja y la cinta tiene que bajar
  /// con él--. No se realimenta: el dibujo va en posición absoluta y no
  /// cambia el tamaño de nada de lo que se mide.
  useLayoutEffect(() => {
    const caja = figura.current;
    if (!caja) return;
    const medir = () => {
      const f = caja.getBoundingClientRect();
      if (f.width <= 0 || f.height <= 0) return;
      const anclas: number[] = [];
      const hasta: number[] = [];
      for (let i = 0; i < pasos; i += 1) {
        const numero = rotulos.current[i]?.querySelector<HTMLElement>('[data-pieza="numero"]');
        if (!numero) return;
        const r = numero.getBoundingClientRect();
        anclas.push(medio(r.top + r.height / 2 - f.top));
        hasta.push(medio(r.left - f.left));
      }
      const nueva: Medida = { ancho: medio(f.width), alto: medio(f.height), anclas, hasta };
      setMedida((antes) => (antes && igual(antes, nueva) ? antes : nueva));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(caja);
    for (const r of rotulos.current.slice(0, pasos)) if (r) observador.observe(r);
    return () => observador.disconnect();
  }, [pasos, firma]);

  if (pasos === 0) return null;

  /// SIN NADIE NO HAY FIGURA, igual que en el cono: cuatro cintas con
  /// ocho rótulos a cero parecen una pantalla rota. Quien llama lo
  /// resuelve antes (`SinGente` en `panel-proceso`).
  if (primero <= 0) return null;

  const filas = pasos * 2 - 1;
  const alto = altoPaso(pasos);

  /// En cuál se queda más gente: la misma cuenta que la frase de la
  /// descripción del bloque, importada y no repetida.
  const mayor = caidaMayor(hitos);

  const leida = `Embudo de ${pasos} ${pasos === 1 ? "paso" : "pasos"}: ${hitos
    .map((h) => `${h.etiqueta} ${n(h.total)}`)
    .join(", ")}.`;

  const dibujo = medida && medida.anclas.length === pasos ? dibujar(medida, pasos) : null;
  const colores = hitos.map((h) => colorEtapa(h.etapa));

  return (
    <div className={ANCHO_MAXIMO}>
      {/* UNA REJILLA, DOS COLUMNAS Y 2N − 1 FILAS: paso, ranura, paso…
          como la del cono. En la primera columna, un separador por paso
          da el alto a su fila y la figura ocupa la columna entera por
          encima; en la segunda, rótulo y texto de caída.
          Las ranuras en `minmax(8px, auto)`, cada una a lo suyo, y no en
          `1fr` como en el cono: allí una ranura más gruesa se veía como
          una pausa en el embudo y por eso crecían las tres a la vez. Aquí
          esa pausa no se dibuja --la cinta de encima sale más gruesa
          (ver `gruesos`)--, y crecer las tres por un solo texto de caída
          en dos renglones subía la figura a 269 px en el celular. */}
      <div
        className={REJILLA}
        style={{
          gridTemplateRows: Array.from({ length: filas }, (_, j) =>
            j % 2 === 0 ? "auto" : `minmax(${RANURA}px, auto)`,
          ).join(" "),
        }}
      >
        {hitos.map((h, i) => (
          <div
            key={`alto-${h.etiqueta}#${i}`}
            aria-hidden
            className="col-start-1"
            style={{ gridRow: i * 2 + 1, height: i === pasos - 1 ? alto + COLA : alto }}
          />
        ))}

        {/* EL DIBUJO, con su nombre para quien no lo ve.
            Un solo SVG en píxeles de la caja (ver `COMBA`), en posición
            absoluta: no da alto a nada, lo toma de las filas. Se pinta
            de abajo arriba --cada cinta tapa la parte de arriba de la
            siguiente, y por la ranura solo asoma su revés-- y las líneas
            al final, encima de todo. `overflow-visible` porque las líneas
            cruzan el hueco entre columnas hasta el número. */}
        <div
          ref={figura}
          role="img"
          aria-label={leida}
          data-pieza="figura"
          className="relative col-start-1"
          style={{ gridRow: "1 / -1" }}
        >
          {dibujo && medida && (
            <svg
              aria-hidden
              width={medida.ancho}
              height={medida.alto}
              viewBox={`0 0 ${medida.ancho} ${medida.alto}`}
              className="pointer-events-none absolute top-0 left-0 overflow-visible"
            >
              <defs>
                <radialGradient id={`${id}-sombra`}>
                  <stop offset="0" style={{ stopColor: COLOR_SOMBRA, stopOpacity: 0.7 }} />
                  <stop offset="1" style={{ stopColor: COLOR_SOMBRA, stopOpacity: 0 }} />
                </radialGradient>
                {colores.map((color, i) => (
                  /* Con una parada intermedia: de golpe, del tono del
                     pliegue al del frente, en el tema oscuro quedaba una
                     raya vertical más clara donde acababa el degradado. */
                  <linearGradient key={i} id={`${id}-cara-${i}`} x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" style={{ stopColor: colorPliegue(color) }} />
                    <stop offset="0.12" style={{ stopColor: colorMedio(color) }} />
                    <stop offset="0.34" style={{ stopColor: color }} />
                    <stop offset="1" style={{ stopColor: color }} />
                  </linearGradient>
                ))}
              </defs>

              <ellipse
                data-pieza="sombra"
                cx={dibujo.sombra.cx}
                cy={dibujo.sombra.cy}
                rx={dibujo.sombra.rx}
                ry={dibujo.sombra.ry}
                fill={`url(#${id}-sombra)`}
              />

              {dibujo.cintas
                .map((c, i) => (
                  <g key={`${hitos[i].etiqueta}#${i}`} data-pieza="cinta">
                    <path data-pieza="reves" d={c.reves} style={{ fill: colorReves(colores[i]) }} />
                    <path data-pieza="frente" d={c.frente} fill={`url(#${id}-cara-${i})`} />
                    {c.giro && (
                      <path data-pieza="giro" d={c.giro} style={{ fill: colorReves(colores[i]) }} />
                    )}
                  </g>
                ))
                .reverse()}

              {dibujo.lineas.map((l, i) =>
                l.x2 > l.x1 ? (
                  <line
                    key={`linea-${i}`}
                    data-pieza="linea"
                    x1={l.x1}
                    x2={l.x2}
                    y1={l.y}
                    y2={l.y}
                    strokeWidth={1}
                    style={{ stroke: colores[i] }}
                  />
                ) : null,
              )}
            </svg>
          )}
        </div>

        {hitos.map((h, i) => {
          /// LA CAÍDA ES LA DE ESTE PASO AL SIGUIENTE, como en el cono:
          /// `hitos[i] - hitos[i+1]`, que es lo que dice `caidas[i]`.
          const caida = i < pasos - 1 ? h.total - hitos[i + 1].total : 0;
          const antesDe = antes?.[i];
          /// Los dos apuntes pequeños, con su explicación larga en el
          /// `title`: los mismos que en el cono.
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
              {/* EL RÓTULO, como en la referencia: el número del paso en
                  dos cifras, grande y del color de su cinta, y el nombre
                  al lado; la línea guía llega a ese renglón. Debajo, la
                  cifra --en tinta firme y siempre en la misma columna,
                  para leer las cuatro de un tirón-- y los apuntes.
                  El número y la cifra van en renglones distintos: en uno
                  solo, «01 206» se leía como un número de cinco cifras.
                  `min-h` del alto de un paso con el contenido centrado:
                  en las filas de arriba es lo mismo que centrarlo en la
                  fila, y en la última lo deja arriba, a la misma altura
                  de su cinta que los demás, con la cola debajo (ver
                  `COLA`). Si el renglón de la cifra no cabe --en el
                  celular, con «antes N»--, `flex-wrap` lo parte y la
                  fila crece; el dibujo la sigue. */}
              <div
                ref={(el) => {
                  rotulos.current[i] = el;
                }}
                data-pieza="rotulo"
                className="col-start-2 flex flex-col justify-center self-start text-left"
                style={{ gridRow: i * 2 + 1, minHeight: alto }}
              >
                {/* El número, con cifras de caja alta (`lining-nums`): la
                    letra del panel dibuja las cifras antiguas, y en ellas
                    el cero es del alto de una «o» --«01» se leía «o1»--. */}
                <span className="flex items-baseline gap-x-1.5" style={{ color: colores[i] }}>
                  <span
                    data-pieza="numero"
                    className="text-[1.125rem] leading-none font-bold tabular-nums lining-nums"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span data-pieza="nombre" className="text-[0.84375rem] leading-none font-semibold">
                    {h.etiqueta}
                  </span>
                </span>
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <span data-pieza="cifra" className="text-[1.25rem] leading-none font-bold text-titulo tabular-nums">
                    {n(h.total)}
                  </span>
                  <span
                    className="text-[0.6875rem] leading-tight text-texto-suave tabular-nums"
                    title={apuntes.map((a) => a.pista).join(" · ") || undefined}
                  >
                    {apuntes.map((a) => a.texto).join(" · ")}
                  </span>
                </span>
              </div>

              {/* LO QUE SE QUEDA ENTRE LOS DOS PASOS, en la columna de los
                  rótulos y a la altura de la ranura que los separa.
                  SOLO LA MAYOR EN ROJO: es la que contesta la pregunta que
                  trae a alguien aquí, en qué paso se queda la gente.
                  Con márgenes negativos: en su ranura de 8 px cuenta menos
                  de lo que mide, y lo que sobresale cae en el aire que los
                  rótulos dejan arriba y abajo dentro de su fila. */}
              {i < pasos - 1 && (
                <div
                  className="col-start-2 -my-[3.5px] flex items-center self-center"
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
          del cono. */}
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
