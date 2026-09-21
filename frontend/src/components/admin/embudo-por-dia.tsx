"use client";

/** Qué día entró cada uno, y hasta dónde ha llegado hoy. */

/**
 * UNA columna por periodo, partida en cuatro colores.
 *
 * Lo que había eran cuatro grupos apilados --uno por paso-- con
 * una barra por día en cada uno: con 44 días eran 176 barras
 * diminutas, sin cifras, en cuatro filas casi idénticas. «Esto se
 * ve fatal» (Mauricio, 20 sep 2026), y con razón: cuatro veces el
 * mismo eje para contar una sola historia.
 *
 * Ahora es un gráfico de columnas de toda la vida, como los
 * tableros de CRM que mandó de referencia: eje rotulado, cifra
 * encima, leyenda arriba. Cada columna vale lo que ENTRÓ ese día,
 * y el color dice hasta dónde ha llegado hoy esa gente. Los
 * cuatro tramos son excluyentes, así que suman la columna, y los
 * totales de la leyenda suman lo que el embudo de al lado llama
 * «Entraron»: esa suma es la prueba de que todo cuadra, y se
 * puede comprobar a mano.
 *
 * Los cuatro números por día NO se pintan encima de la columna
 * --cuatro cifras por barra es justo lo que se rechazó--: viven
 * en el renglón de detalle al pasar el puntero, y en el
 * `aria-label` de cada columna para quien no tiene puntero.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import {
  agruparPor,
  bordesDeVentana,
  granoInicial,
  granoQueCabe,
  rellenarDias,
  QUE_ES_UNA_COLUMNA,
  type Cubeta,
  type DiaDelEmbudo,
  type Grano,
} from "./agrupar-dias";
import { ALTO_FIGURA } from "./embudo-forma";
import { colorEtapa } from "./etapa";
import { dec, n } from "./graficos";

export type { DiaDelEmbudo };

/// Cajas en px, que es la regla de la casa; la tipografía en rem.
///
/// EL MISMO ALTO QUE LA FIGURA DE AL LADO. Las dos mitades del
/// bloque son dos retratos de la misma gente puestos uno al lado
/// del otro, y sus áreas de dato no empezaban ni acababan en la
/// misma raya: el embudo medía 250 px y el trazado 154, o sea
/// 57 px de desfase abajo. Amarrado a `ALTO_FIGURA`, la raya del
/// cero cae exactamente donde acaba la punta del embudo.
const ALTO_BARRAS = ALTO_FIGURA;
/// El renglón de la cifra de encima. Mide igual en todas las
/// columnas --lleven cifra o no-- para que todas arranquen del
/// mismo sitio y la rejilla siga siendo cierta.
///
/// Se EXPORTA porque es lo que hay que bajar la figura de al
/// lado para que su primera banda arranque en la misma raya que
/// el tope de este eje.
export const ALTO_CIFRA = 15;
/// El canal del eje Y, donde caben «120» y su aire.
const ANCHO_EJE = 34;
const SEPARACION = 3;
/// Por debajo de esto la columna es un hilo y la fecha no cabe:
/// se sube un peldaño de grano --de día a semana, de semana a
/// mes-- en vez de empujar la página a lo ancho.
const MINIMO_POR_COLUMNA = 22;
/// Y por encima de esto, aunque quepan, son demasiadas para
/// leerlas: 31 es un mes de días.
const MAXIMO_COLUMNAS = 31;
/// EL TOPE DE ANCHO DE UNA COLUMNA.
///
/// Solo muerde con muy pocas cubetas: entonces el grupo se centra
/// y queda aire a los lados. Sin tope, tres columnas en una
/// pantalla ancha salían de 300 px cada una, que ya no es una
/// columna sino un panel de color.
const MAXIMO_POR_COLUMNA = 120;
/// LA SEPARACIÓN CRECE CON LA COLUMNA.
///
/// Con siete cubetas en una pantalla ancha salían barras de
/// 153 px separadas por 3: sobre una barra así, tres píxeles son
/// cero visual y el conjunto se lee como una banda de color
/// continua, no como siete columnas. Se reparte el 15 % del paso
/// --lo que hacen Sheets y Zoho-- con suelo y techo.
///
/// Va REDONDEADA A CUATRO y guardada en el estado de la medida:
/// un valor continuo cambiaría con cada píxel de arrastre y,
/// repintando, el `ResizeObserver` se mordería la cola.
const SEPARACION_MAXIMA = 24;
/// El suelo de un tramo dibujado. Con 3 px --lo que había-- dos
/// tramos seguidos se veían como un solo filete sucio y no se
/// sabía ni cuántos eran ni de qué color. Lo que un tramo se
/// lleva de más se le descuenta al más alto de su columna, así
/// que la columna sigue midiendo lo que vale.
const MINIMO_TRAMO = 6;
/// Cuántas fechas se escriben como mucho bajo el eje: más de
/// siete no se leen de un vistazo.
const MAXIMO_ROTULOS = 7;
/// EL AIRE ENTRE DOS FECHAS ESCRITAS.
///
/// Eran 6 px, y para un cuerpo de 10 px eso es menos de un
/// cuadratín: a 390 px con «Desde el principio» --la vista con
/// la que abre la pantalla-- «31 ago – 6 sept» y «14–20 sept»
/// quedaban a 7 px y se leían como un solo bloque. Un cuadratín
/// entero es lo mínimo para que dos rótulos de eje se vean como
/// dos.
const AIRE_ENTRE_FECHAS = 10;

/// Los peldaños con los que se redondea el tope del eje. El
/// tope es SIEMPRE el doble de uno de ellos, así que la raya de
/// la mitad cae en un número entero y el eje no miente: antes se
/// dibujaba a media altura y se rotulaba con el redondeo --tope
/// 7, raya de la mitad rotulada «4» valiendo 3,5-- y una columna
/// de 4 personas rebasaba la raya que decía «4».
const PASOS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/**
 * El tope del eje, redondeado hacia arriba a una cifra redonda.
 *
 * Es lo que hacen los tableros que mandó el cliente (Sheets,
 * Zoho): el eje dice 0 / 6 / 12 y no 0 / 6 / 11.
 */
export function topeBonito(cima: number): number {
  const medio = Math.max(0.5, cima / 2);
  const escala = Math.pow(10, Math.floor(Math.log10(medio)));
  for (const p of PASOS) {
    const paso = p * escala;
    /// Solo peldaños enteros: la raya de la mitad se rotula con
    /// su valor, y «2,5 personas» no es una cifra de personas.
    if (paso >= medio && Number.isInteger(paso)) return paso * 2;
  }
  return Math.ceil(medio) * 2;
}

/**
 * Los cuatro tramos de una columna, ya en píxeles.
 *
 * Se reparte el alto de la columna ENTERA entre los tramos --con
 * el resto mayor, para que sumen exactamente lo que mide la
 * columna-- y después se le sube el suelo a los tramos
 * diminutos a costa del más alto. Así la rejilla sigue siendo
 * cierta: el techo de la columna cae donde dice el eje.
 */
export function alturasDeTramos(valores: number[], altoColumna: number): number[] {
  const suma = valores.reduce((a, b) => a + b, 0);
  if (suma <= 0 || altoColumna <= 0) return valores.map(() => 0);

  const crudas = valores.map((v) => (v / suma) * altoColumna);
  const px = crudas.map((v) => Math.floor(v));
  let resto = altoColumna - px.reduce((a, b) => a + b, 0);
  const porResto = crudas
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const o of porResto) {
    if (resto <= 0) break;
    px[o.i] += 1;
    resto -= 1;
  }

  /// EL SUELO, PERO EL QUE LA COLUMNA PUEDA PAGAR.
  ///
  /// Pedir siempre 6 px dejaba fuera el caso que importa: una
  /// columna de dos personas contra un eje alto mide 6 px en
  /// total, así que ninguno de sus dos tramos podía subir a 6 y
  /// el bucle se rendía. Y rendirse aquí no es inocuo: un tramo
  /// que el reparto dejó en 0 px NO SE DIBUJA, o sea que
  /// desaparece una persona del gráfico. Con el suelo repartido
  /// --lo que toca a cada tramo si la columna se divide entre los
  /// que tienen gente-- siempre hay algo que pintar.
  const cuantos = valores.filter((v) => v > 0).length;
  const suelo = Math.max(1, Math.min(MINIMO_TRAMO, Math.floor(altoColumna / Math.max(1, cuantos))));
  for (let i = 0; i < px.length; i += 1) {
    if (valores[i] <= 0 || px[i] >= suelo) continue;
    const falta = suelo - px[i];
    /// El más alto de los OTROS: quitárselo a sí mismo no
    /// arreglaría nada.
    let mayor = -1;
    for (let j = 0; j < px.length; j += 1) {
      if (j !== i && (mayor === -1 || px[j] > px[mayor])) mayor = j;
    }
    if (mayor >= 0 && px[mayor] - falta >= suelo) {
      px[mayor] -= falta;
      px[i] = suelo;
    }
  }
  return px;
}

/// De arriba abajo, tal como se apilan. La leyenda va en este
/// mismo orden, y es el mismo orden en el que se lee el embudo de
/// al lado: entraron, se quedaron sin contactar, contactados…
const TRAMOS = [
  {
    clave: "sinContactar" as const,
    etiqueta: "Sin contactar",
    /// Rebajado contra la superficie, pero CON CUERPO: en pálido
    /// del todo se leía como «lo que falta para llegar arriba» y
    /// no como gente a la que nadie ha llamado todavía. Sale de
    /// la variable de la etapa INTERESADO, que es lo que son.
    ///
    /// El 45 % de antes no llegaba a 3:1 contra la tarjeta en
    /// ninguno de los dos temas --2,04 en claro y 2,40 en
    /// oscuro, medidos con lienzo-- y es JUSTO el tramo que más
    /// importa: la gente a la que nadie ha llamado. En oscuro la
    /// columna del 18 de septiembre, entera sin contactar,
    /// parecía un agujero en el gráfico.
    color: `color-mix(in oklab, ${colorEtapa("INTERESADO")} 70%, var(--superficie))`,
    borde: `color-mix(in oklab, ${colorEtapa("INTERESADO")} 88%, var(--superficie))`,
  },
  {
    clave: "contactadosSinDatos" as const,
    etiqueta: "Contactados, sin datos",
    color: colorEtapa("CONTACTADO"),
    borde: null,
  },
  {
    clave: "conDatosSinInscribir" as const,
    etiqueta: "Con datos, sin inscribir",
    color: colorEtapa("DATOS_COMPLETOS"),
    borde: null,
  },
  {
    clave: "inscritos" as const,
    etiqueta: "Inscritos",
    color: colorEtapa("INSCRITO"),
    borde: null,
  },
];

type Tramos = Record<(typeof TRAMOS)[number]["clave"], number>;

/**
 * Los cuatro tramos EXCLUYENTES de una columna.
 *
 * El dato llega acumulado --entraron ≥ contactados ≥ conDatos ≥
 * inscritos-- y aquí se resta para que cada persona caiga en un
 * solo tramo y los cuatro sumen la columna. El `max(0, …)` es por
 * si un desfase de caché rompe la monotonía: antes de pintar un
 * tramo negativo, ninguno.
 */
function tramosDe(c: Cubeta): Tramos {
  return {
    sinContactar: Math.max(0, c.entraron - c.contactados),
    contactadosSinDatos: Math.max(0, c.contactados - c.conDatos),
    conDatosSinInscribir: Math.max(0, c.conDatos - c.inscritos),
    inscritos: Math.max(0, c.inscritos),
  };
}

export function EmbudoPorDia({
  dias,
  promedioAnterior = null,
  serieRecortada = false,
  ventana = null,
}: {
  dias: DiaDelEmbudo[];
  /// Los bordes del periodo elegido, para que el eje lo cubra
  /// entero. Sin esto, con «El mes pasado» el gráfico empezaba
  /// el 7 de agosto --el primer día con gente-- y los seis
  /// primeros días del mes no salían ni como cero.
  ventana?: { desde: string; hasta: string } | null;
  /// Cuánta gente entraba AL DÍA en el periodo anterior. Se pinta
  /// como una raya horizontal --la «línea de meta» de la
  /// referencia de Slabstack-- y contesta qué días fueron mejores
  /// que antes sin duplicar ni una barra.
  promedioAnterior?: number | null;
  /// El servidor recorta esta serie a 60 días cuando no hay
  /// ventana (crm/control.ts). Hay que decirlo: si no, el embudo
  /// de al lado y estas columnas hablarían de periodos distintos
  /// sin avisar.
  serieRecortada?: boolean;
}) {
  const [encima, setEncima] = useState<number | null>(null);
  /**
   * El GRANO en estado y el ANCHO en una referencia.
   *
   * Guardar el ancho en estado es repintar en cada píxel que se
   * mueve, y con un `ResizeObserver` encima eso se realimenta. Lo
   * que de verdad cambia el dibujo son cuatro valores DISCRETOS:
   * de qué tamaño es una columna --día, semana, mes--, si caben
   * las cifras encima, cuánto aire va entre columnas y cada
   * cuántas se escribe una fecha. Los cuatro cambian dos o tres
   * veces en toda una vida de la página, así que el objeto se
   * devuelve igual cuando ninguno se movió.
   */
  const caja = useRef<HTMLDivElement>(null);
  const ancho = useRef(0);
  const [medida, setMedida] = useState<{
    grano: Grano;
    cabenCifras: boolean;
    /// El aire entre columnas, ya redondeado. Ver `SEPARACION_MAXIMA`.
    separacion: number;
    /// Cada cuántas columnas se escribe una fecha. Se decide aquí
    /// --y no al dibujar-- porque hace falta MEDIR el rótulo más
    /// largo contra el paso que hay entre columnas. Es un entero
    /// que cambia dos o tres veces en toda la vida de la página.
    cada: number;
    /// Cuánto hay que correr la PRIMERA y la ÚLTIMA fecha para
    /// que, yendo centradas bajo su columna, no se salgan del
    /// área de trazado. Ver `alineado` más abajo.
    sangraInicio: number;
    sangraFin: number;
  } | null>(null);

  const bordes = useMemo(() => bordesDeVentana(ventana), [ventana]);
  const llenos = useMemo(() => rellenarDias(dias, bordes), [dias, bordes]);

  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;

    /// Un lienzo suelto para medir texto: `measureText` da el
    /// ancho de verdad del rótulo con la letra de la casa. A ojo
    /// --tantos píxeles por carácter-- se elegía mal justo en el
    /// caso límite, que es cuando se rotulan todas.
    const medidor = document.createElement("canvas").getContext("2d");

    const medir = (w: number) => {
      ancho.current = w;
      const maximo = Math.min(
        MAXIMO_COLUMNAS,
        Math.max(7, Math.floor((w - ANCHO_EJE) / MINIMO_POR_COLUMNA)),
      );
      const grano = granoQueCabe(llenos, maximo);
      const cubetas = agruparPor(llenos, grano);
      const cuantas = Math.max(1, cubetas.length);
      /// El paso es lo que le toca a cada columna CON su aire.
      const bruto = Math.max(1, (w - ANCHO_EJE) / cuantas);
      const separacion = Math.min(
        SEPARACION_MAXIMA,
        Math.max(SEPARACION, Math.round((bruto * 0.15) / 4) * 4),
      );
      const porColumna = Math.min(MAXIMO_POR_COLUMNA, bruto - separacion);
      const paso = porColumna + separacion;
      let anchoRotulo = 0;
      const anchoDe = (t: string) => (medidor ? medidor.measureText(t).width : 0);
      if (medidor) {
        const letra = getComputedStyle(nodo).fontFamily;
        medidor.font = `10px ${letra}`;
        for (const c of cubetas) {
          anchoRotulo = Math.max(anchoRotulo, anchoDe(c.etiqueta));
        }
      }
      /// Ni dos fechas más juntas de un cuadratín, ni más de
      /// siete en total. Antes se cortaban con puntos suspensivos
      /// --«31 ago – …»-- que es un rótulo de eje mutilado.
      const cada = Math.max(
        1,
        Math.ceil(cuantas / MAXIMO_ROTULOS),
        Math.ceil((anchoRotulo + AIRE_ENTRE_FECHAS) / Math.max(1, paso)),
      );
      /**
       * LO QUE SE SALE DE LOS EXTREMOS, EN PÍXELES.
       *
       * Las fechas van TODAS centradas bajo su columna --un eje
       * con la primera pegada a la izquierda y la última a la
       * derecha parece de paso irregular: medido, huecos de
       * 155 / 111 / 112 / 112 / 111 / 155 px cuando el paso es
       * constante--. Lo que sí hay que resolver es el caso real
       * que aquella regla tapaba: que el rótulo de un extremo se
       * salga del área de trazado. Se corre EXACTAMENTE lo que
       * sobra y no la mitad del rótulo entero.
       */
      /// El ancho DE VERDAD de una columna: las casillas del eje
      /// son `flex-1`, así que se reparten el hueco entero y no
      /// los `porColumna` redondeados. Con el redondeado salía
      /// una holgura de 2 px que no existe, y el rótulo del
      /// extremo se quedaba 1,2 px fuera del trazado.
      const columnaReal = Math.min(
        MAXIMO_POR_COLUMNA,
        (w - ANCHO_EJE - (cuantas - 1) * separacion) / cuantas,
      );
      const holgura = Math.max(
        0,
        (w - ANCHO_EJE - (cuantas * columnaReal + (cuantas - 1) * separacion)) / 2,
      );
      const ultimoRotulado = Math.floor((cuantas - 1) / cada) * cada;
      const sobraPrimera = (anchoDe(cubetas[0]?.etiqueta ?? "") - columnaReal) / 2;
      const sobraUltima =
        ultimoRotulado === cuantas - 1
          ? (anchoDe(cubetas[cuantas - 1]?.etiqueta ?? "") - columnaReal) / 2
          : 0;
      /// A la izquierda hay el canal del eje para invadir; a la
      /// derecha, solo la holgura del centrado.
      const nueva = {
        grano,
        cabenCifras: porColumna >= MINIMO_POR_COLUMNA,
        separacion,
        cada,
        /// `Math.ceil` y no `round`: quedarse a un píxel corto
        /// deja el rótulo fuera del trazado, que es el defecto.
        sangraInicio: Math.ceil(Math.max(0, sobraPrimera - holgura - ANCHO_EJE)),
        sangraFin: Math.ceil(Math.max(0, sobraUltima - holgura)),
      };
      /// Se devuelve el MISMO objeto cuando nada cambió: así React
      /// no repinta y el observador no se muerde la cola.
      setMedida((v) =>
        v &&
        v.grano === nueva.grano &&
        v.cabenCifras === nueva.cabenCifras &&
        v.separacion === nueva.separacion &&
        v.cada === nueva.cada &&
        v.sangraInicio === nueva.sangraInicio &&
        v.sangraFin === nueva.sangraFin
          ? v
          : nueva,
      );
    };

    medir(nodo.getBoundingClientRect().width);
    const observador = new ResizeObserver((entradas) => {
      const w = entradas[0]?.contentRect.width ?? 0;
      if (Math.abs(w - ancho.current) < 1) return;
      medir(w);
    });
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [llenos]);

  /// Mientras no hay medida, el grano sale de CUÁNTOS días hay.
  /// Suponer un ancho --el de un celular, por ejemplo-- hacía
  /// saltar la maquetación en escritorio en cuanto llegaba la
  /// medida de verdad.
  const grano = medida?.grano ?? granoInicial(llenos.length);
  const cabenCifras = medida?.cabenCifras ?? llenos.length <= 14;
  const separacion = medida?.separacion ?? SEPARACION;
  const cubetas = useMemo(() => agruparPor(llenos, grano), [llenos, grano]);

  const totales = useMemo(() => {
    const t: Tramos = {
      sinContactar: 0,
      contactadosSinDatos: 0,
      conDatosSinInscribir: 0,
      inscritos: 0,
    };
    for (const c of cubetas) {
      const suyos = tramosDe(c);
      t.sinContactar += suyos.sinContactar;
      t.contactadosSinDatos += suyos.contactadosSinDatos;
      t.conDatosSinInscribir += suyos.conDatosSinInscribir;
      t.inscritos += suyos.inscritos;
    }
    return t;
  }, [cubetas]);

  const entraron = cubetas.reduce((s, c) => s + c.entraron, 0);

  if (cubetas.length === 0) {
    return (
      <p className="py-6 text-center text-[0.84375rem] text-texto-suave">
        Sin gente que haya entrado en este periodo.
      </p>
    );
  }
  if (llenos.length <= 1) {
    /// Una columna sola no es un gráfico: repetiría los mismos
    /// cuatro números que el embudo de al lado, en grande.
    return (
      <p className="py-6 text-center text-[0.84375rem] text-texto-suave">
        Todo el periodo es un solo día: {cubetas[0].etiquetaLarga}.
      </p>
    );
  }
  if (entraron === 0) {
    return (
      <p className="py-6 text-center text-[0.84375rem] text-texto-suave">
        No entró nadie en este periodo.
      </p>
    );
  }

  /// La raya del periodo anterior entra en la escala: si queda
  /// por encima de todas las columnas, esconderla sería callar la
  /// única mala noticia del gráfico.
  const raya =
    grano === "dia" && promedioAnterior !== null && promedioAnterior > 0
      ? promedioAnterior
      : null;
  /// El tope, redondeado a una cifra con la que las tres rayas
  /// del eje caen donde dicen.
  const tope = topeBonito(Math.max(1, ...cubetas.map((c) => c.entraron), raya ?? 0));
  /// El suelo es el mismo que el de un tramo: por debajo de eso
  /// una columna de una persona se confunde con el filete de
  /// 2 px con el que se marca el día en que no entró nadie, que
  /// es justo lo contrario de lo que hay que ver. La rejilla
  /// pierde un pelo de exactitud en las columnas más bajas, y es
  /// un precio menor que no poder distinguir «uno» de «ninguno».
  const alto = (v: number) =>
    v <= 0 ? 0 : Math.max(MINIMO_TRAMO, Math.round((v / tope) * ALTO_BARRAS));

  /// QUÉ COLUMNAS LLEVAN FECHA.
  ///
  /// ANCLADAS A LA PRIMERA: 0, cada, 2·cada… Se repartían hacia
  /// atrás desde la última y después se metía la primera a la
  /// fuerza, así que el primer tramo del eje casi nunca medía lo
  /// mismo que los demás --con «Últimos 30 días» salían pasos de
  /// 9, 5, 5, 5 y 5 días, o sea 228 px de hueco y después 116--.
  /// Quien mira un eje de tiempo da por hecho que el paso es
  /// constante y lee mal la pendiente del primer tramo. La
  /// última puede quedarse sin rótulo: esa fecha ya la dice la
  /// cabecera del periodo.
  const cada = medida?.cada ?? Math.max(1, Math.ceil(cubetas.length / MAXIMO_ROTULOS));
  const conFecha = new Set<number>();
  for (let i = 0; i < cubetas.length; i += cada) conFecha.add(i);
  const rotulada = (i: number) => conFecha.has(i);
  const hayParciales = cubetas.some((c) => c.parcial);
  /// Con `?? null` porque al cambiar de grano --o de periodo--
  /// mientras el puntero está encima, el índice puede quedar
  /// fuera del arreglo nuevo.
  const detalle = encima !== null ? (cubetas[encima] ?? null) : null;

  return (
    /// `min-w-0`: sin él, este gráfico le pedía a su columna de
    /// la rejilla el ancho de su contenido más ancho y arrastraba
    /// al embudo de al lado. A 390 px con «Desde el principio» el
    /// bloque entero se salía 61 px de la tarjeta, sin barra de
    /// desplazamiento con la que alcanzarlo.
    <div ref={caja} className="min-w-0">
      {/* LA LEYENDA, con la condición entera y su total del
          periodo. Nunca «Contactados» a secas: son los
          contactados a los que todavía les faltan datos, y quien
          lea «Contactados 10» al lado de un embudo que dice 29 se
          queda pensando cuál de las dos es. */}
      {/* `min-h-[34px]` con `content-end`: la leyenda hace pareja
          con el pie que la figura de al lado lleva arriba, y las
          dos cajas miden lo mismo lleven uno o dos renglones. Así
          los dos dibujos arrancan en la misma raya en cualquier
          ancho, que es la mitad de lo que hace que un tablero
          parezca compuesto y no montado. */}
      <ul className="mb-2 flex min-h-[34px] flex-wrap content-end items-center gap-x-4 gap-y-1 text-[0.6875rem] text-texto">
        {TRAMOS.map((t) => (
          <li key={t.clave} className="inline-flex items-center gap-1.5">
            <span
              className="block h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{
                background: t.color,
                boxShadow: t.borde ? `inset 0 0 0 1px ${t.borde}` : undefined,
              }}
              aria-hidden
            />
            {t.etiqueta}{" "}
            <span className="font-semibold text-titulo tabular-nums">
              {n(totales[t.clave])}
            </span>
          </li>
        ))}
        {/* LA RAYA DEL PROMEDIO SE EXPLICA AQUÍ, no encima de las
            columnas. Su rótulo era un recuadro opaco clavado a la
            punta derecha de la raya, o sea justo sobre las
            columnas más recientes: tapaba seis de ellas y se
            comía tres de las cifras de encima --una al 83 %, sin
            poder leerla-- y en un celular medía 201 px sobre un
            gráfico de 266, el 76 % del ancho. En la leyenda no
            hay nada debajo que tapar, y es donde lo ponen los
            tableros de referencia. */}
        {raya !== null && (
          <li className="inline-flex items-center gap-1.5">
            <span
              className="block w-4 shrink-0 border-t border-dashed border-texto-suave"
              aria-hidden
            />
            {/* PARA QUÉ SIRVE, en el pie y no aquí: «Promedio
                diario del periodo anterior 2,6» se entiende
                palabra por palabra y no dice qué hacer con él
                (cliente, 21 sep 2026), pero explicarlo en la
                propia leyenda la hacía saltar a dos renglones en
                pantallas de 1.366 px y entonces el trazado bajaba
                y dejaba de empezar en la misma raya que la figura
                de al lado. */}
            Promedio diario del periodo anterior{" "}
            <span className="font-semibold text-titulo tabular-nums">{dec(raya)}</span>
          </li>
        )}
      </ul>

      <div className="relative" style={{ height: ALTO_CIFRA + ALTO_BARRAS }}>
        {/* La rejilla: cero, la mitad y el tope, con su cifra en
            el canal de la izquierda. */}
        {[1, 0.5, 0].map((f) => (
          <div
            key={f}
            className="pointer-events-none absolute right-0 border-t"
            style={{
              left: ANCHO_EJE,
              top: ALTO_CIFRA + (1 - f) * ALTO_BARRAS,
              /// LA RAYA DEL CERO NO ES UNA RAYA DE REJILLA.
              ///
              /// Es la línea de base sobre la que se apoyan las
              /// columnas, y se pintaba igual que las otras dos,
              /// a 1,19:1 en claro y 1,20 en oscuro: el gráfico
              /// parecía flotar. En Sheets y en Zoho la del cero
              /// es siempre más oscura que la rejilla, y es lo
              /// que ancla las columnas.
              borderTopColor:
                f === 0
                  ? "color-mix(in oklab, var(--texto-suave) 80%, var(--superficie))"
                  : "var(--hairline)",
            }}
          >
            <span className="absolute -top-[7px] right-full pr-1.5 text-[0.625rem] whitespace-nowrap text-texto-suave tabular-nums">
              {n(Math.round(tope * f))}
            </span>
          </div>
        ))}

        {/* `justify-center` con tope de ancho por columna: la
            rejilla y la raya siguen cruzando el gráfico entero y
            el grupo de columnas se centra en él. Ver
            `MAXIMO_POR_COLUMNA`. */}
        <div
          className="absolute inset-y-0 right-0 flex items-end justify-center"
          style={{ left: ANCHO_EJE, gap: separacion }}
        >
          {cubetas.map((c, i) => {
            const t = tramosDe(c);
            const apagada = encima !== null && encima !== i;
            /// El de más abajo de los que SÍ se dibujan: es el
            /// único que no lleva separación por debajo. Con el
            /// último de la lista a secas, una columna sin
            /// inscritos quedaba con una raya de fondo al pie y
            /// parecía flotar.
            const ultimo = [...TRAMOS].reverse().find((tr) => t[tr.clave] > 0)?.clave;
            /// Los cuatro altos salen de UN reparto del alto de
            /// la columna entera: así suman exactamente lo que
            /// mide la columna y ningún tramo se queda en un
            /// filete de 3 px.
            const px = alturasDeTramos(
              TRAMOS.map((tr) => t[tr.clave]),
              alto(c.entraron),
            );
            return (
              <button
                key={c.clave}
                type="button"
                /// Botón y no `div`: en celular no hay puntero, y
                /// tocar la columna es lo que enseña sus cuatro
                /// cifras. De paso llega por teclado.
                className="flex h-full min-w-0 flex-1 cursor-default flex-col justify-end transition-opacity"
                style={{ opacity: apagada ? 0.45 : 1, maxWidth: MAXIMO_POR_COLUMNA }}
                aria-label={`${c.etiquetaLarga}: entraron ${n(c.entraron)}, contactados ${n(
                  c.contactados,
                )}, con datos ${n(c.conDatos)}, inscritos ${n(c.inscritos)}`}
                onMouseEnter={() => setEncima(i)}
                onMouseLeave={() => setEncima(null)}
                onFocus={() => setEncima(i)}
                onBlur={() => setEncima(null)}
                onClick={() => setEncima((v) => (v === i ? null : i))}
              >
                <span
                  /// `relative z-20`: por encima de la raya del
                  /// promedio, que va en `z-10`. Sin esto la raya
                  /// discontinua cruzaba por la mitad las cifras
                  /// de seis columnas y los guiones se leían como
                  /// parte del número.
                  /// Con fondo propio: la raya del promedio va en
                  /// `z-10` y la cifra en `z-20`, pero el orden de
                  /// pintado no impide que la raya CRUCE la caja
                  /// del glifo --medido: 2,9 px dentro, y los
                  /// guiones se leen como un número tachado--. El
                  /// fondo de la tarjeta detrás de la cifra la
                  /// corta limpia.
                  className="relative z-20 block bg-superficie text-[0.6875rem] leading-[15px] font-semibold text-titulo tabular-nums"
                  style={{ height: ALTO_CIFRA }}
                >
                  {cabenCifras ? n(c.entraron) : ""}
                </span>

                {c.entraron === 0 ? (
                  /// UN CERO ES UN DATO, no un hueco: se dibuja
                  /// como un tope de 2 px. Sin esto, un día sin
                  /// gente y un día que no vino en la respuesta se
                  /// verían igual.
                  <span className="block w-full rounded-[2px] bg-borde" style={{ height: 2 }} />
                ) : (
                  TRAMOS.map((tramo, j) => {
                    const v = t[tramo.clave];
                    if (v === 0) return null;
                    const h = px[j];
                    return (
                      <span
                        key={tramo.clave}
                        className="block w-full"
                        style={{
                          height: h,
                          background: tramo.color,
                          /// La separación va HACIA DENTRO, como
                          /// sombra: un margen de 2 px estiraría
                          /// la columna y la rejilla dejaría de
                          /// ser cierta. En los tramos de menos de
                          /// 7 px no se pone: se comería el color.
                          boxShadow: [
                            tramo.borde ? `inset 0 0 0 1px ${tramo.borde}` : "",
                            tramo.clave !== ultimo && h >= 7
                              ? "inset 0 -2px 0 var(--superficie)"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(", "),
                        }}
                      />
                    );
                  })
                )}
              </button>
            );
          })}
        </div>

        {raya !== null && (
          /// La «línea de meta» de la referencia que mandó el
          /// cliente. Se compara contra el PROMEDIO DIARIO y solo
          /// cuando cada columna es un día: contra una columna que
          /// vale una semana sería mezclar peras con manzanas.
          ///
          /// SIN RÓTULO: su valor se dice en la leyenda, arriba,
          /// donde no hay nada que tapar. Y en `z-10`, o sea
          /// encima de las barras --antes quedaba debajo y solo
          /// asomaba por los huecos-- pero debajo de las cifras,
          /// que van en `z-20`. Discontinua, para que no se
          /// confunda con la raya de la rejilla cuando caen a
          /// pocos píxeles una de otra.
          <div
            className="pointer-events-none absolute right-0 z-10 border-t border-dashed border-texto-suave"
            style={{ left: ANCHO_EJE, top: ALTO_CIFRA + (1 - raya / tope) * ALTO_BARRAS }}
            aria-hidden
          />
        )}
      </div>

      {/* El eje X. Las fechas van UNA vez, debajo de todo, y con
          el mismo tope y la misma separación que las columnas
          para que cada una caiga bajo la suya. */}
      <div
        className="mt-1.5 flex justify-center"
        style={{ marginLeft: ANCHO_EJE, gap: separacion }}
      >
        {cubetas.map((c, i) => {
          /// TODAS CENTRADAS bajo su columna. La primera y la
          /// última se alineaban a su borde para que una fecha
          /// larga no se saliera de la tarjeta, y esa regla se
          /// aplicaba siempre, también cuando el rótulo medía la
          /// cuarta parte de su casilla: medido, «15 sept» caía
          /// 43,8 px a la izquierda de su columna y «21 sept»
          /// 43,9 a la derecha, así que el eje parecía de paso
          /// irregular cuando no lo es. Lo que se corrige ahora
          /// es SOLO lo que de verdad se sale, y en píxeles
          /// medidos (ver `sangraInicio` / `sangraFin`).
          const corrimiento =
            i === 0
              ? (medida?.sangraInicio ?? 0)
              : i === cubetas.length - 1
                ? -(medida?.sangraFin ?? 0)
                : 0;
          return (
            <span
              key={c.clave}
              /// CENTRADA DE VERDAD sobre su columna.
              ///
              /// Con `flex-1 text-center` y un rótulo más ancho
              /// que su casilla, Chrome no desborda hacia el borde
              /// de inicio: corre la fecha a la derecha la mitad
              /// de lo que le sobra, y cuánto sobra depende del
              /// largo del rótulo. Medido: desvíos de hasta 15,8 px
              /// a 390 px y huecos entre fechas que variaban 3,1
              /// veces con paso constante. Con la casilla de ancho
              /// cero y el texto centrado por `translateX(-50%)`,
              /// la fecha siempre cae en el eje de su columna y se
              /// sale por los dos lados por igual.
              /// NUNCA se recorta. La fecha se sale de su casilla
              /// hacia las de al lado, que están vacías a
              /// propósito: `cada` se calcula midiendo el rótulo
              /// más largo contra el paso entre columnas, así que
              /// no hay dos fechas escritas lo bastante juntas
              /// como para pisarse. Antes, cuando se rotulaban
              /// todas, la clase era `truncate` y en un celular el
              /// eje decía «31 ago – …», «7–13 …»: un rótulo de
              /// eje con puntos suspensivos no dice de qué mes es.
              className="relative min-w-0 flex-1 text-[0.625rem] whitespace-nowrap text-texto-suave tabular-nums"
              style={{ maxWidth: MAXIMO_POR_COLUMNA }}
            >
              <span
                className="absolute top-0 left-1/2 whitespace-nowrap"
                style={{
                  transform: `translateX(calc(-50% + ${corrimiento}px))`,
                }}
            >
                {rotulada(i) ? c.etiqueta : ""}
              </span>
            </span>
          );
        })}
      </div>

      {/* El renglón de detalle: aquí viven los cuatro números por
          día, que es donde no estorban. El hueco se reserva
          siempre para que el bloque no dé un salto al pasar el
          puntero. */}
      {/* El renglón de detalle: aquí viven los cuatro números por
          día, que es donde no estorban. El hueco se reserva
          siempre para que el bloque no dé un salto al pasar el
          puntero, y mientras nadie señala nada DICE QUE ESTÁ AHÍ:
          32 px en blanco al lado de un gráfico se leen como una
          franja que no cargó. */}
      <div className="mt-2 min-h-[32px]">
        {detalle ? (
          <p className="rounded-[9px] bg-superficie-alterna px-3 py-1.5 text-[0.6875rem] leading-snug">
            <span className="font-semibold text-titulo">{detalle.etiquetaLarga}</span>
            <span className="text-texto-suave">
              {" "}
              · entraron {n(detalle.entraron)} · contactados {n(detalle.contactados)} · con
              datos {n(detalle.conDatos)} · inscritos {n(detalle.inscritos)}
            </span>
          </p>
        ) : (
          <p className="px-3 py-1.5 text-[0.6875rem] leading-snug text-texto-suave">
            Señale una columna —con el puntero o tocándola— para ver sus cuatro cifras.
          </p>
        )}
      </div>

      <p className="mt-1 text-[0.6875rem] leading-snug text-texto-suave">
        {QUE_ES_UNA_COLUMNA[grano]} Cada columna es la gente que ENTRÓ en ese periodo; el
        color dice hasta dónde ha llegado hoy.
        {raya !== null &&
          " La raya punteada es el promedio diario del periodo anterior: las columnas que la pasan van mejor que antes."}
        {hayParciales &&
          " La primera y la última pueden cubrir menos días que las demás, así que salen más bajas."}
        {serieRecortada &&
          " El servidor solo manda los últimos 60 días de esta serie, así que el embudo de la izquierda puede abarcar más tiempo que estas columnas."}
      </p>

      {/* La serie entera en texto, que es la costumbre de los
          gráficos de esta casa. */}
      <p className="sr-only">
        {cubetas
          .map(
            (c) =>
              `${c.etiquetaLarga}: entraron ${c.entraron}, contactados ${c.contactados}, con datos ${c.conDatos}, inscritos ${c.inscritos}`,
          )
          .join(". ")}
      </p>
    </div>
  );
}
