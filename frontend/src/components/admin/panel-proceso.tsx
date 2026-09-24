/** Todo el proceso de inscripción, de interesado a inscrito. */

/**
 * La pestaña «Proceso», rediseñada.
 *
 * Se llamaba «Metas y avance» y era una lista de bloques
 * anidados: siete tarjetas de cifra, cuatro títulos con franja
 * de color y las metas plegadas al pie. Contaba las mismas
 * cosas y no contaba ninguna historia.
 *
 * El orden de aquí SÍ es una historia, y es la que trae a
 * coordinación: cuántos se inscriben de los que entran (la tira
 * de cuatro cifras), cuándo fue entrando la gente (las columnas
 * por semana), dónde se cae y qué hacer hoy (el embudo al lado de
 * «Qué atender primero»), de qué está hecha esa gente (convenio y
 * modalidad), dónde está hoy y si sus datos sirven, a qué ritmo
 * entra y por dónde, dónde vive y quién la atiende, y por último
 * el detalle por acción.
 *
 * Se renombra a «Proceso» porque la columna vertebral ya no es
 * la comparación meta-contra-real: es el embudo. Pero la meta
 * NO se pierde —es dato real y el equipo la usa—: va anclada al
 * hito «Inscritos», que es el único sitio donde significa algo.
 */

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Desplegable } from "./desplegable";
import { EmbudoCinta } from "./embudo-cinta";
import { caidaMayor } from "./embudo-forma";
import { EmbudoPorDia } from "./embudo-por-dia";
/// `EmbudoProceso` --las cuatro barras verticales-- ya no se
/// llama desde aquí, pero NO se borra: lo siguen usando el panel
/// académico y Tráfico del formulario, donde no hay dimensión de
/// día y cuatro barras están bien. Sus tres casillas
/// (`TarjetasDelEmbudo`) tampoco: aquí las sustituye la tira del
/// periodo. Se traía de allí la línea de comparación
/// (`lineaContraAntes`), y desde que las celdas del reparto comparan
/// en porcentaje (21 sep 2026) solo queda el tipo.
import type { Hito } from "./embudo-proceso";
import { MapaColombia } from "./mapa-colombia";
import { Aviso, useAdmin } from "./marco-admin";
/// SIN `Medidor`: la fila de los cuatro anillos se fue (21 sep
/// 2026). Escribía 38,8 % y 80,6 % a 24 px medio metro por debajo
/// del 39 % y el 81 % del embudo: la misma cifra con dos
/// redondeos. El componente se queda en `graficos`.
import { ResumenGeneral } from './resumen-general';
import { TablaPorAccion } from './tabla-por-accion';
import { TablaPorGrupo } from './tabla-por-grupo';
import { Donut, ListaBarras, n, SERIE, type PorcionDonut } from "./graficos";
import { Bloque } from "./piezas";
import { colorEtapa } from "./etapa";
import { ErrorApi } from "@/lib/api";
import {
  crmApi,
  ETIQUETA_ETAPA,
  ETIQUETA_ORIGEN,
  ETIQUETA_RANGO,
  type Control,
  type Etapa,
  type Filtros,
  type MetricasInscripciones,
  type Origen,
  type Rango,
  type Resumen,
} from "@/lib/crm-api";

/// Las cinco etapas, en el orden del embudo.
///
/// SIN AGRUPAR POR FASE. Estaban repartidas en tres bloques con su
/// rótulo --«Captación», «Inscritos», «Salida»--: «se elimina las
/// palabras: Captación, Inscritos» (cliente, 23 sep 2026), que las
/// quiere en crudo. Quitados los rótulos no queda nada que agrupar,
/// así que se queda UNA lista y el orden hace el trabajo que hacían
/// ellos: arriba quien acaba de entrar, abajo quien se perdió.
const ETAPAS_EN_ORDEN: Etapa[] = [
  "INTERESADO",
  "CONTACTADO",
  "DATOS_COMPLETOS",
  "INSCRITO",
  "PERDIDO",
];

/// La paleta de los canales, fijada: el punto de la lista tiene
/// que ser del color de su porción en la dona, y con el ciclo por
/// defecto de `Donut` los dos se elegían por separado.
const PALETA_CANAL = [
  "var(--serie-1)",
  "var(--serie-2)",
  "var(--exito)",
  "var(--aviso)",
  "var(--marca-fuerte)",
];

/**
 * El nombre de una acción, en minúscula con la primera en alta.
 *
 * En la base están en MAYÚSCULA SOSTENIDA, y once renglones
 * seguidos así se leen a trompicones: la mayúscula quita a las
 * letras la forma por la que se reconocen de un vistazo. Solo
 * cambia cómo se ve; el dato no se toca, y en los formatos SEP
 * —que sí son el contrato con el SENA— sale como está guardado.
 */
function frase(s: string): string {
  return s ? s.charAt(0) + s.slice(1).toLowerCase() : s;
}

function pct(parte: number, total: number): string {
  if (total <= 0) return "0 %";
  return `${Math.round((parte / total) * 100)} %`;
}

/**
 * EN CUÁNTAS COLUMNAS SE REPARTEN N TROZOS DE TEXTO.
 *
 * Hoy la usan las notas del embudo cuando alguien abre «Cómo se
 * leen estos dos dibujos». Apiladas y alineadas a la izquierda,
 * notas de 11 px en una tarjeta de 1.760 px dejaban más de 1.300
 * px de blanco al lado --medido a 1.850--, que es el «veo
 * desordenado los textos» del cliente (21 sep 2026). Repartidas
 * en columnas, las mismas palabras ocupan el ancho de verdad SIN
 * que ninguna línea pase de unos 75 caracteres, que es lo que se
 * lee sin perder el renglón.
 *
 * Los cortes están donde cada columna sigue midiendo más de
 * ~280 px, y las cuentas salen exactas para que la última fila
 * no se quede con una celda sola y su hueco al lado: cuatro
 * trozos van a 1, 2 y 4 columnas; tres, a 1, 2 y 3.
 *
 * Cadenas completas y no interpoladas: Tailwind las busca tal
 * cual en el código y una clase armada a trozos no existiría.
 */
function rejillaDeCeldas(cuantas: number): string {
  if (cuantas <= 1) return "grid-cols-1";
  if (cuantas === 2) return "grid-cols-1 min-[560px]:grid-cols-2";
  if (cuantas === 3) return "grid-cols-1 min-[560px]:grid-cols-2 min-[1040px]:grid-cols-3";
  if (cuantas === 4) return "grid-cols-1 min-[560px]:grid-cols-2 min-[1240px]:grid-cols-4";
  if (cuantas === 5) return "grid-cols-1 min-[560px]:grid-cols-2 min-[1040px]:grid-cols-3";
  return "grid-cols-1 min-[560px]:grid-cols-2 min-[1040px]:grid-cols-3";
}

/**
 * La lista del CATÁLOGO con la cuenta DEL PERIODO pegada.
 *
 * Los desplegables tienen dos preguntas distintas que contestar
 * y hasta ahora salían de la misma respuesta, que no podía con
 * las dos. Qué se puede elegir es todo lo que existe en el
 * ámbito --si sale de una respuesta recortada, al elegir
 * ANTIOQUIA la lista se queda en «Departamentos» y «ANTIOQUIA» y
 * no hay forma de saltar a Cundinamarca--. Y cuántos leads tiene
 * cada opción es del periodo de la cabecera --si no, con «Hoy»
 * puesto se ofrecía «ANTIOQUIA · 104 leads» y al elegirlo el
 * bloque contestaba «No entró nadie hoy»--.
 *
 * Así que la lista viene de una y la cifra de la otra, y lo que
 * el periodo no trae se enseña en cero, que es la verdad y
 * además se ve antes de pulsar.
 */
function conCuentaDelPeriodo<T extends { total: number }>(
  delAmbito: T[],
  delPeriodo: T[],
  clave: (x: T) => string | number | null,
): T[] {
  const cuenta = new Map(delPeriodo.map((x) => [clave(x), x.total]));
  return delAmbito.map((x) => ({ ...x, total: cuenta.get(clave(x)) ?? 0 }));
}

/**
 * El embudo, ACUMULADO: quién llegó a cada hito.
 *
 * Desde `resumen.etapas` y no desde `control.embudo`: aquel va
 * recortado a las cinco de inscripción —con razón, ver
 * `control.ts:46`— y quien pasó al aula desaparecería, así que
 * los veintitrés en formación contarían como «no inscritos».
 *
 * Función suelta y no `useMemo` en línea: ahora se calcula dos
 * veces, para el periodo y para el de comparación, y tienen que
 * salir por la MISMA regla.
 */
function hitosDe(res: Resumen | null): Hito[] {
  if (!res) return [];
  const en = new Map(res.etapas.map((e) => [e.etapa, e.total]));
  const g = (...es: Etapa[]) => es.reduce((t, e) => t + (en.get(e) ?? 0), 0);
  const trasInscribir = g(
    "EN_FORMACION",
    "CERTIFICADO",
    "RETIRADO",
    "NO_APROBO",
    "DESERTO",
    "ABANDONO",
  );
  const inscritos = g("INSCRITO") + trasInscribir;
  const conDatos = inscritos + g("DATOS_COMPLETOS");
  /// SUPUESTO: a quien se marcó PERDIDO se le cuenta como
  /// contactado. No sabemos en qué punto se perdió, y darlo
  /// por no contactado inflaría la caída del primer paso.
  const contactados = conDatos + g("CONTACTADO") + g("PERDIDO");
  const entraron = contactados + g("INTERESADO");
  return [
    { etapa: "INTERESADO", etiqueta: "Entraron", total: entraron },
    { etapa: "CONTACTADO", etiqueta: "Contactados", total: contactados },
    { etapa: "DATOS_COMPLETOS", etiqueta: "Con datos", total: conDatos },
    { etapa: "INSCRITO", etiqueta: "Inscritos", total: inscritos },
  ];
}

/**
 * El hueco del embudo mientras no ha llegado su dato.
 *
 * Las dos mitades del bloque vienen de dos consultas y no llegan
 * a la vez: hubo pruebas en las que, ocho segundos después de
 * cambiar de periodo, se veían la leyenda y las columnas enteras
 * y a la izquierda NADA --ni figura ni frase--, con pinta de
 * resultado y no de espera. Media tarjeta pintada es una tarjeta
 * que miente; un hueco con forma de embudo no.
 */
function HuecoDelEmbudo() {
  return (
    /// Del mismo ancho y en el mismo sitio que la figura (560 px,
    /// pegada a la izquierda, ver `ANCHO_MAXIMO` en `embudo-forma`):
    /// si el hueco fuera de otro tamaño, al llegar el dato el
    /// embudo daría un salto.
    <div className="w-full max-w-[560px] py-1" aria-hidden>
      {[100, 74, 52, 34].map((ancho) => (
        <div
          key={ancho}
          className="mx-auto mb-2 animate-pulse rounded-[4px] bg-superficie-alterna"
          style={{ width: `${ancho}%`, height: 40 }}
        />
      ))}
    </div>
  );
}

/**
 * El hueco de la gráfica mientras no ha llegado su dato.
 *
 * Mide lo mismo que la gráfica pintada --15 px de cifra, 238 de
 * barras, 6 de aire y 14 de fechas: 273-- para que la pantalla no
 * dé un salto de un cuarto de metro al llegar la respuesta. Y con
 * forma de columnas por la misma razón que `HuecoDelEmbudo`: un
 * rectángulo gris se lee como un gráfico roto; siete columnas
 * pálidas, como uno que está llegando.
 */
function HuecoDeLaGrafica() {
  return (
    <div className="flex h-[273px] items-end justify-center gap-6 pb-5 pl-[34px]" aria-hidden>
      {[46, 72, 58, 88, 64, 78, 50].map((alto, i) => (
        <div
          key={i}
          className="w-full max-w-[148px] animate-pulse rounded-[4px] bg-superficie-alterna"
          style={{ height: `${alto}%` }}
        />
      ))}
    </div>
  );
}

/**
 * La frase de cuando no hay días que repartir, EN UNA LÍNEA bajo
 * la figura del embudo.
 *
 * Con «Hoy» o «Ayer» la serie es una sola columna, que no es un
 * gráfico: repetiría los mismos cuatro números del embudo, en
 * grande. Fue primero un hueco sin explicar --1.100 px de blanco,
 * el 84 % de la tarjeta-- y después una caja punteada de 180 px a
 * la derecha del embudo. Con la gráfica en su propia caja arriba,
 * esa caja habría sido «una línea con media tarjeta vacía», que el
 * cliente ya rechazó: la caja de la gráfica sencillamente no se
 * pinta y la frase entera, con sus dos variantes, baja aquí. En la
 * descripción del bloque no va: la cabecera, que lleva la base de
 * los porcentajes en un renglón, pasaría a tres o cuatro.
 */
function SinColumnas({
  cuando,
  hayFiltro,
  cuantos,
  dia,
}: {
  cuando: string | null;
  /// Si hay algún filtro puesto. `porDia.length <= 1` significa
  /// DOS cosas distintas --que el periodo es de un día («Hoy»,
  /// «Ayer») y que el filtro dejó a toda la gente en un día-- y
  /// aquí se escribía siempre la primera: con «Desde el
  /// principio» + Departamento «PUTUMAYO · 1 persona» la pantalla
  /// afirmaba que «Desde el principio» cabe en un solo día y
  /// mandaba elegir un periodo más largo, que además no existe.
  hayFiltro: boolean;
  /// Cuánta gente entró, y qué día. Es la información útil que la
  /// frase del periodo tapaba.
  cuantos: number;
  dia: string | null;
}) {
  return (
    /// `text-pretty`: sin él, la última palabra de esta frase
    /// --«gente.»-- se quedaba sola en su renglón. Es la misma
    /// familia que el `text-balance` de los titulares de la casa.
    <p className="mt-2 max-w-[58ch] text-left text-[0.6875rem] leading-snug text-pretty text-texto-suave">
      {hayFiltro ? (
        <>
          <strong className="font-semibold text-titulo">
            Con estos filtros{" "}
            {cuantos === 1
              ? `entró una sola persona${dia ? `, el ${dia}` : ""}`
              : `entraron ${n(cuantos)} personas${dia ? `, todas el ${dia}` : ""}`}
          </strong>
          , así que no hay nada que repartir por fechas: este embudo ya lo cuenta todo.
        </>
      ) : (
        <>
          <strong className="font-semibold text-titulo">
            {cuando ? `«${cuando}» cabe en un solo día` : "El periodo cabe en un solo día"}
          </strong>
          , así que no hay nada que repartir por fechas: este embudo ya lo cuenta todo. Elija
          un periodo más largo para ver por qué día fue entrando la gente.
        </>
      )}
    </p>
  );
}

/**
 * Cuando en el periodo no entró nadie: UNA línea, en el sitio de
 * la tira de cifras.
 *
 * Fue una caja punteada de 140 px dentro del bloque del embudo, y
 * antes de eso 302 px de blanco con ocho rótulos a cero flotando al
 * lado, que parece una pantalla rota. Ahora no hay bloque del
 * embudo ni caja de la gráfica --no hay nada que dibujar--, así que
 * la frase ocupa el sitio de la tira y «Qué atender primero» sube
 * justo debajo, a todo el ancho: con «Hoy» a las ocho de la mañana
 * es lo único de la pantalla que sirve, porque no depende del
 * periodo.
 */
function SinGente({ hayFiltro, aviso = null }: { hayFiltro: boolean; aviso?: string | null }) {
  return (
    <p className="rounded-lg border border-dashed border-borde px-7 py-3 text-left text-[0.8125rem] leading-relaxed text-pretty text-texto-suave">
      {aviso && <strong className="font-semibold text-titulo">{aviso} </strong>}
      No hay embudo que dibujar todavía.{" "}
      {hayFiltro
        ? "Pruebe con un periodo más largo, o quite alguno de los filtros de arriba."
        : "Pruebe con un periodo más largo."}
    </p>
  );
}

/**
 * EL REPARTO DE LA TIRA, EN PORCENTAJES QUE SUMAN 100.
 *
 * «Se inscribe», «Siguen en proceso» y «Dijeron que no» reparten a
 * TODA la gente que entró, sin solaparse, así que sus tres
 * porcentajes tienen que sumar 100. Redondeados cada uno por su
 * lado no siempre lo hacen --con tres personas, una en cada sitio,
 * salía 33 + 33 + 33 = 99--, y desde que el porcentaje es la cifra
 * grande de las tres celdas (21 sep 2026) un reparto que no cuadra
 * se lee de un vistazo como un error de cuenta.
 *
 * EL PUNTO QUE FALTA O SOBRA LO ABSORBE «SIGUEN EN PROCESO», y no
 * el de más decimales. Se hizo primero por MAYOR RESIDUO, y con
 * «Desde el principio» --la vista con la que abre la pantalla--
 * salía 39 + 58 + 3: el punto se lo llevaba «Dijeron que no»
 * (2,43 %), mientras «Dónde está cada persona hoy», cuatro bloques
 * más abajo, dice «No interesado · 2 %». Dos de las tres cifras
 * tienen gemela en la misma pantalla y cada una tiene que leerse
 * igual en los dos sitios: «Se inscribe» es el apunte de
 * «Inscritos» del embudo y el «era el N %» de la comparación (ver
 * `tasa`), y «Dijeron que no» es esa fila. Así que esas dos se
 * redondean normal, y «Siguen en proceso», que no sale como
 * porcentaje en ningún otro sitio, es la que cuadra la cuenta. Se
 * aleja de su valor exacto un punto como mucho --medio por cada
 * una de las otras dos, y casi nunca tanto--, y su cuenta exacta
 * va escrita en el pie.
 *
 * Null sin nadie que repartir: la tira escribe «—».
 */
function repartoEnCien(
  entraron: number,
  inscritos: number,
  enProceso: number,
  perdidos: number,
): { inscribe: number; enProceso: number; perdidos: number } | null {
  if (entraron <= 0) return null;
  const inscribe = Math.round((inscritos / entraron) * 100);
  /// Sin nadie en proceso no hay quien absorba: si las otras dos
  /// terminan las dos en ,5 --101 inscritos y 99 perdidos de 200--
  /// redondeadas suman 101 y «Siguen en proceso» saldría «−1 %».
  /// Ahí cede «Dijeron que no», medio punto como mucho.
  if (enProceso <= 0) return { inscribe, enProceso: 0, perdidos: 100 - inscribe };
  const perdidosRedondo = Math.round((perdidos / entraron) * 100);
  return { inscribe, enProceso: 100 - inscribe - perdidosRedondo, perdidos: perdidosRedondo };
}

/**
 * «En los 30 días anteriores era», «Ayer era»: cómo arranca la
 * frase que compara con el periodo anterior.
 *
 * Suelta porque la escriben las tres celdas del reparto y tienen
 * que decirlo IGUAL: armada en dos sitios, uno acabaría diciendo
 * «En ayer era» y el otro no.
 */
function dichoDeAntes(etiquetaAnterior: string | null | undefined): string {
  /// Del sello, igual que la etiqueta del periodo: esta frase
  /// compara DOS cifras y las dos tienen que venir de la misma
  /// respuesta que su nombre. Con el rótulo sacado del estado
  /// de la cabecera se leyó «el 28 %… en los 7 días anteriores
  /// era el 57 %» cuando las dos cifras eran de otros periodos.
  const cuando = (etiquetaAnterior ?? "el periodo anterior").toLowerCase();
  /// «En ayer era…» no se dice: «ayer» ya es un complemento.
  /// Con `\b` y no `$` porque el anterior de «Hoy» ya no se
  /// llama «ayer» a secas: ver `anteriorDe` en la cabecera.
  return /^(hoy|ayer|anteayer)\b/.test(cuando)
    ? `${cuando.charAt(0).toUpperCase()}${cuando.slice(1)} era`
    : `En ${cuando} era`;
}

/** Lo que lleva una celda de la tira del periodo. Ver `TiraDelPeriodo`. */
type Celda = {
  rotulo: string;
  /// La cifra ya escrita: «39 %», «7 días» o «—». Sin cuentas
  /// sueltas: la cuenta va en el pie, con su base.
  cifra: string;
  colorCifra: string;
  /// Los renglones del pie. Vacío mientras no hay datos.
  pies: string[];
  /// La explicación larga, en el `title`.
  explicacion: string;
  /// La que manda: 32 px y no 22.
  manda?: boolean;
  /// A todo lo ancho por debajo de 1.100 px (la 1 y la 4).
  ancha?: boolean;
  /// El atenuado de su mitad: las tres primeras salen de
  /// `/resumen` y la cuarta de `/control`, y puede fallar una sola.
  clase?: string;
};

/**
 * LA TIRA DE CUATRO CIFRAS DEL PERIODO.
 *
 * «Los porcentajes en otra posición que impacte más» (cliente, 21
 * sep 2026). Estaban escritos TRES veces con dos redondeos --39 %
 * en el embudo, «el 39 %» en la frase de la tasa y 38,8 % en un
 * anillo de 24 px medio metro más abajo; lo mismo 81 contra 80,6--
 * y ninguno mandaba. Aquí la tasa de inscripción es la cifra más
 * grande de la pantalla (32 px, el tamaño de `TarjetaCifra`; los
 * centros de dona se quedan en 26,5) y lleva su base escrita
 * debajo.
 *
 * LAS TRES DEL REPARTO, CON UNA SOLA FORMA: el porcentaje en grande
 * y la cuenta escrita debajo con su base --«70 %» y «92 de las 131
 * que entraron siguen en proceso…»--. Las celdas 2 y 3 llevaban la
 * cuenta grande con el porcentaje pequeño pegado («92 70 %»), para
 * no competir con la que manda, y la fila leía dos formas a la vez:
 * «estás metiendo cantidad y porcentaje; si haces eso, como la
 * tarjeta de Se inscribe» (cliente, 21 sep 2026). Las tres suman
 * 100 siempre --ver `repartoEnCien`-- y las cuentas de los pies,
 * lo que entró. La cuarta son días, y así se queda.
 *
 * SUELTA, NUNCA DENTRO DE UN `Bloque` Y NUNCA `plegable`: un
 * porcentaje con la base dentro de un acordeón cerrado es un
 * porcentaje sin base.
 *
 * CUATRO CELDAS Y NO CINCO. Una quinta vuelve a apelotonar y la
 * tira se convierte en la fila de tarjetas iguales que se anulan
 * entre sí. Y ninguna cifra de «ahora mismo» (cupos, gente sin
 * asesor) entra aquí: esta tira es solo del periodo, y mezclarla
 * trae de vuelta el «¿esas 206 a qué hacen referencia?».
 *
 * LAS CUATRO DEL MISMO TAMAÑO, de ancho y de cifra.
 *
 * Se construyó con la primera al doble de ancho (2fr 1fr 1fr 1fr) y
 * su cifra a 32 px contra 22 de las otras, para que «Se inscribe»
 * mandara. Al verla, el cliente lo paró: «mismos tamaños, pilas con
 * esto» (21 sep 2026). Una celda de 750 px con «28 %» a la izquierda
 * y el resto vacío no se lee como la que manda, se lee como un
 * descuadre. Lo que la hace mandar ahora es el SITIO --va primera,
 * donde empieza la lectura-- y que es la única con su base escrita
 * entera; no el tamaño.
 *
 * Un solo corte, en 1.100 px, como la gráfica de debajo: por encima,
 * cuatro columnas iguales --«Tardan en inscribirse» mide 141 px y
 * cabe en un renglón--; por debajo, un 2 × 2, también parejo.
 */
function TiraDelPeriodo({ celdas }: { celdas: Celda[] }) {
  return (
    <dl
      data-pieza="tira"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-borde bg-hairline min-[1100px]:grid-cols-4"
    >
      {celdas.map((c) => (
        <CeldaDeLaTira key={c.rotulo} {...c} />
      ))}
    </dl>
  );
}

/** Una celda de la tira: rótulo en versalita, cifra y su pie. */
function CeldaDeLaTira({
  rotulo,
  cifra,
  colorCifra,
  pies,
  explicacion,
  clase = "",
}: Celda) {
  return (
    <div
      title={explicacion}
      /// 14 px de relleno lateral por debajo de 620 y no 28: en el
      /// 2 × 2 del celular cada celda mide unos 170 px, y con 28 a
      /// cada lado el pie de «Siguen en proceso» se partía en
      /// cuatro renglones. Eran 16, y desde que ese pie dice «120 de
      /// las 206 que entraron siguen en proceso.» (21 sep 2026) esos
      /// dos píxeles de cada lado son los que lo dejan en dos
      /// renglones y no en tres: a 390 px la tira vuelve a medir 230
      /// y no 245, lo mismo que antes del cambio.
      /// Sin `col-span`: en el 2 × 2 del celular las cuatro miden lo
      /// mismo, igual que en la fila de escritorio. `ancha` queda en
      /// el tipo por si otra tira la necesita, pero aquí no se usa.
      className={`bg-superficie px-[14px] pt-3 pb-[13px] min-[620px]:px-7 ${clase}`}
    >
      {/* EL ALTO DE LA TIRA, AJUSTADO RENGLÓN A RENGLÓN.
          Con el interlineado por defecto medía 114 px a 1.600 sin
          comparación --el pie de «Tardan en inscribirse» parte en
          dos renglones en sus 257 px-- y 390 a 390 px con ella: la
          tira empujaba la gráfica bajo el pliegue. El rótulo, que es
          de un renglón y en versalita, va a 13 px de interlínea, y
          los pies a 1,3 y pegados a su cifra: 108 y 371. */}
      <dt className="text-[0.625rem] leading-[13px] font-semibold tracking-[0.1em] text-texto-suave uppercase">
        {rotulo}
      </dt>
      {/* LA CIFRA, DEL MISMO TAMAÑO EN LAS CUATRO: 1,75 rem, el
          cuerpo de cifra que ya usa el veredicto de ocupación. Va en
          un renglón de 32 px apoyada abajo, para que los pies de las
          cuatro arranquen en la misma raya.
          SOLA: ya no lleva el porcentaje pequeño al lado (ver
          `TiraDelPeriodo`). */}
      {/* A LA MEDIDA DE «GESTIÓN DE LEADS» (cliente, 23 sep 2026).
          La cifra iba a 28 px dentro de una caja de 32 de alto; allí
          son 17 y sin caja. La tira baja de unos 90 px a 60 sin perder
          nada: el pie se sigue leyendo y la cifra sigue mandando. */}
      <dd className="mt-1 flex items-end">
        <span
          className="text-[1.0625rem] leading-none font-bold tracking-[-0.02em] whitespace-nowrap tabular-nums"
          style={{ color: colorCifra }}
        >
          {cifra}
        </span>
      </dd>
      {pies.map((p) => (
        <dd
          key={p}
          className="mt-0.5 text-[0.71875rem] leading-[1.3] text-pretty text-texto-suave tabular-nums"
        >
          {p}
        </dd>
      ))}
    </div>
  );
}

/**
 * La letra pequeña de un bloque, en una revelación CERRADA.
 *
 * Son cosas que se leen UNA vez, cuando uno no entiende el dibujo;
 * abiertas eran una pared de letra debajo de los dibujos («todo
 * como cargado, como saturado», cliente, 21 sep 2026). Ocultar,
 * nunca eliminar: no se recorta ni una palabra, pero sin ocupar
 * pantalla sin que nadie la pida.
 *
 * Es la misma pinta que el `Bloque` con `plegable` de `piezas.tsx`:
 * un `details` de la casa, con «Ver» y «Ocultar» en el color de la
 * marca a la derecha. No lleva `sin-aro` --que apaga el foco--
 * porque esto es un mando de media línea y con el teclado hay que
 * poder verlo.
 *
 * UNA POR BLOQUE, al pie de cada uno. Había una sola para los dos
 * dibujos, y con la gráfica arriba y el embudo abajo quedaría a
 * medio metro de uno de los dos.
 */
function Revelacion({
  titulo,
  notas,
  rejilla,
}: {
  titulo: string;
  notas: string[];
  /// Las clases de columnas de la lista abierta. Van por fuera
  /// porque dependen de lo ancho que sea el bloque, y eso lo sabe
  /// quien lo monta.
  rejilla: string;
}) {
  return (
    <details className="group border-t border-hairline pt-2">
      {/* «Ver» PEGADO AL TÍTULO, no en la otra punta. Con
          `justify-between` el rótulo quedaba a la izquierda y su «Ver»
          1.490 px más allá, a 1.600 (medido el 21 sep 2026): el
          rótulo parecía un título suelto y el mando que lo abre, otra
          cosa. Juntos se leen como una sola puerta. */}
      <summary className="flex cursor-pointer list-none items-center gap-3 select-none">
        <span className="text-[0.6875rem] leading-snug font-semibold text-titulo">{titulo}</span>
        {/* «Ver» / «Ocultar», y no un triángulo: es lo que usa el
            bloque plegable de la casa, y una palabra se entiende sin
            haber aprendido el icono. */}
        <span className="shrink-0 text-[0.6875rem] font-medium text-marca underline underline-offset-2">
          <span className="group-open:hidden">Ver</span>
          <span className="hidden group-open:inline">Ocultar</span>
        </span>
      </summary>
      <ul className={`mt-2 grid gap-x-6 gap-y-1 ${rejilla}`}>
        {notas.map((nota) => (
          /// `max-w-[58ch]` ADEMÁS de la rejilla: con una sola
          /// columna ancha la frase se quedaba sola con 1.416 px de
          /// blanco al lado (medido). El tope la deja del ancho de un
          /// párrafo; cuando hay varias, es la rejilla la que reparte
          /// y el tope no muerde.
          <li
            key={nota}
            className="min-w-0 max-w-[58ch] text-[0.6875rem] leading-snug text-pretty text-texto-suave"
          >
            {nota}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Cuánto tiene que pasar para volver a pedir LO MISMO.
 *
 * El fin de la ventana es «ahora» y `control` se repone solo
 * cada treinta segundos, así que cada vuelta traía un
 * `llegoHasta` nuevo y volvía a disparar estas consultas aunque
 * nadie hubiera elegido nada. En un cambio de filtro eso salía
 * DOS veces --la del gesto y la del borde que se movió al
 * llegar el `control` nuevo-- y eran cuatro peticiones tiradas
 * por gesto. Con el techo del servidor en sesenta por minuto,
 * al quinto o sexto cambio la pantalla se quedaba en 429, vacía
 * y congelada más de un minuto.
 *
 * Si lo único que se movió es ese borde y la respuesta todavía
 * es reciente, no se vuelve a pedir. Pasados estos segundos sí,
 * para que las cifras sigan vivas: por eso es MENOR que los
 * treinta del refresco, y no mayor.
 */
const REFRESCO_MINIMO = 20_000;

/**
 * Lo que se pintó, CON EL SELLO de a qué corte pertenece.
 *
 * Junto en un solo estado y no en tres sueltos, y con su
 * etiqueta dentro, porque el bloque tiene que poder decir
 * siempre de qué periodo son las cifras que enseña. Cuando una
 * petición fallaba --un 429 del limitador basta-- las cifras se
 * quedaban en las del periodo anterior y el rótulo saltaba al
 * nuevo: el desplegable decía «Últimos 7 días» y al lado se
 * leía «De las 131 personas que entraron en los últimos 30
 * días», con la frase de la tasa comparando dos periodos que no
 * eran esos. Pasaba porque el rótulo salía del estado de la
 * cabecera --que cambia al instante-- y las cifras de la
 * respuesta que no llegó. Viajando juntos no se puede volver a
 * escribir.
 */
type Cargado = {
  /// Qué se pidió: los cinco cortes, el inicio de las dos
  /// ventanas y el nombre del periodo. El FIN no entra: se mueve
  /// solo. Es `claveActual`, y ahí está el porqué de cada pieza.
  clave: string;
  /// Cómo se llamaba el periodo cuando se pidieron estas cifras.
  etiqueta: string;
  /// Y aquel con el que se comparan. Null = no se compara.
  etiquetaAnterior: string | null;
  metricas: MetricasInscripciones | null;
  delPeriodo: Resumen | null;
  delAnterior: Resumen | null;
};

export function PanelProceso({
  control,
  comparar = true,
  etiquetaAnterior = null,
  etiquetaPeriodo = null,
  controlAlDia = true,
  alCambiarFiltros,
}: {
  /// El periodo ya no entra aquí: vive en la cabecera de la
  /// página, al frente del título. Enmarca la pantalla entera
  /// --las dos pestañas--, y estos filtros solo recortan esta.
  /**
   * El control del periodo, YA PEDIDO por la página.
   *
   * No se pide aquí a propósito. La página ya lo trae con el
   * periodo elegido y su comparación; pidiéndolo el panel por su
   * cuenta salían dos consultas iguales salvo en las fechas —las
   * suyas, ninguna— y el «ritmo de inscripción» contaba todo el
   * histórico mientras la cabecera decía «este mes».
   */
  control?: Control | null;
  /// Falso = no se compara con nada: ni barra gris ni leyenda.
  comparar?: boolean;
  /// Cómo se llama el periodo anterior: «ayer», «los 7 días
  /// anteriores»… Lo decide la cabecera y el embudo lo repite.
  /// Sin esto, arriba decía «los 7 días anteriores» y el gráfico
  /// «el mismo tramo del periodo anterior» (cliente, 20 sep 2026).
  etiquetaAnterior?: string | null;
  /// Cómo se llama el periodo ELEGIDO en el desplegable de la
  /// cabecera, al instante. No se usa para rotular ninguna cifra
  /// --para eso está el sello de `Cargado`-- sino para poder
  /// decir, cuando una consulta falla, qué periodo se pidió y no
  /// se pudo traer.
  etiquetaPeriodo?: string | null;
  /// Si el `control` que llega es del periodo elegido. Falso =
  /// su consulta no volvió y lo que trae es del periodo de
  /// antes; entonces las columnas de la derecha tampoco son las
  /// que se pidieron, y hay que decirlo.
  controlAlDia?: boolean;
  alCambiarFiltros?: (f: Filtros) => void;
}) {
  /**
   * LOS CINCO FILTROS VIVEN EN LA DIRECCIÓN, no en la memoria del
   * panel.
   *
   * Vivían en `useState("")`, y como Control solo monta este panel en
   * «Proceso de inscripción», al abrir otro informe se desmontaba y
   * al volver renacía vacío. Fue la mitad del «149 contra 539» del
   * cliente (21 sep 2026): con ADECOPRIA elegido el bloque de cupos
   * decía 149, «Ver reservas» llevaba al informe de ADECOPRIA con
   * 149, y al volver con «Atrás» el gremio se había borrado y el
   * bloque decía 539 sin que nadie tocara nada.
   *
   * Se leen de la dirección al montar y se escriben en ella al
   * cambiar, con los mismos nombres que ya usa el informe de Reservas
   * (`convenioId`, `accionFormacionId`): así «Atrás», recargar y el
   * desplegable «Informes» conservan el recorte, y el informe y este
   * panel leen el mismo gremio de la misma fuente.
   */
  const direccion = useSearchParams();
  const deLaDireccion = (llave: string) => direccion.get(llave) ?? "";
  const [convenioId, setConvenioId] = useState(() => deLaDireccion("convenioId"));
  const [accionFormacionId, setAccionFormacionId] = useState(() =>
    deLaDireccion("accionFormacionId"),
  );
  const [grupoId, setGrupoId] = useState(() => deLaDireccion("grupoId"));
  /// SIN filtro de etapa, y es una decisión: ver el comentario de
  /// la fila de filtros, más abajo.
  const [asesorId, setAsesorId] = useState(() => deLaDireccion("asesorId"));
  const [departamentoSepId, setDepartamentoSepId] = useState(() =>
    deLaDireccion("departamentoSepId"),
  );

  /// Y se escriben con `replaceState`, sin entrada nueva en el
  /// historial: cambiar de gremio no es navegar, y con `pushState`
  /// «Atrás» desharía los filtros uno a uno en vez de volver a la
  /// pantalla anterior. Se pasa `history.state` tal cual porque ahí
  /// guarda Next su propio estado de navegación.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const poner = (llave: string, valor: string) => {
      if (valor) p.set(llave, valor);
      else p.delete(llave);
    };
    poner("convenioId", convenioId);
    poner("accionFormacionId", accionFormacionId);
    poner("grupoId", grupoId);
    poner("asesorId", asesorId);
    poner("departamentoSepId", departamentoSepId);
    const nueva = `${window.location.pathname}?${p.toString()}`;
    if (nueva !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, "", nueva);
    }
  }, [convenioId, accionFormacionId, grupoId, asesorId, departamentoSepId]);

  /// Lo cargado, con el sello de a qué corte pertenece. Ver `Cargado`.
  const [datos, setDatos] = useState<Cargado | null>(null);
  /**
   * QUÉ SE PUEDE ELEGIR: el catálogo del ámbito.
   *
   * Un `/resumen` sin periodo y sin ninguno de los cinco cortes.
   * Es lo que existe, no lo que hay ahora en pantalla, y por eso
   * no cambia en toda la sesión: se pide una vez.
   *
   * De aquí sale la LISTA de los cuatro desplegables. Salía de
   * la respuesta ya recortada por el propio filtro, así que al
   * elegir se quedaba con una sola opción --Departamentos 29 → 2,
   * Grupo 25 → 2, Acción de formación 13 → 2, Asesores 8 → 2-- y
   * para saltar de ANTIOQUIA a CUNDINAMARCA había que pulsar
   * «Limpiar», que borra los cinco filtros de golpe. «Que
   * funcionen los filtros» (cliente, 20 sep 2026).
   */
  const [catalogo, setCatalogo] = useState<Resumen | null>(null);
  /**
   * CUÁNTOS LEADS tiene cada opción en el periodo de la cabecera.
   *
   * El mismo `/resumen`, recortado solo por el periodo. Va
   * aparte del catálogo porque contesta otra pregunta, y sin los
   * cinco cortes porque un desplegable no puede contar con su
   * propio filtro puesto: diría que Cundinamarca tiene cero.
   *
   * Sin esto, la segunda línea en gris --«115 leads»-- decía lo
   * mismo con «Hoy» que con «Desde el principio», y se elegía
   * «ANTIOQUIA · 104 leads» para que el bloque contestara «No
   * entró nadie hoy». Solo se pide cuando cambia el PERIODO: un
   * cambio de filtro no la mueve.
   */
  const [opciones, setOpciones] = useState<Resumen | null>(null);
  /// Solo manda la ultima respuesta: cambiar de periodo dos
  /// veces seguidas no puede dejar pintada la primera.
  const turno = useRef(0);
  /// Qué se pidió la última vez, SIN el fin de la ventana.
  const ultimaClave = useRef<string | null>(null);
  /// Lo mismo, pero visible para el dibujo: hace falta para no
  /// enseñar el aviso de «esto es viejo» durante el medio
  /// segundo que va entre elegir y tener la respuesta.
  const [clavePedida, setClavePedida] = useState<string | null>(null);
  /// Cuándo contestó bien la última vez. Ver `REFRESCO_MINIMO`.
  const ultimaRespuesta = useRef(0);
  /// De qué periodo son las cuentas que ya están cargadas.
  /// `undefined` es «todavía ninguna».
  const periodoDeOpciones = useRef<string | undefined>(undefined);
  /// Si el catálogo ya llegó. No cambia en toda la sesión.
  const hayCatalogo = useRef(false);
  /// Sube uno cada vez que se pulsa «Volver a intentarlo».
  const [intento, setIntento] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /// Qué acción tiene abierto su detalle por grupos, con su rótulo:
  /// el bloque de abajo dice de cuál son esos grupos sin obligar a
  /// mirar cuál fila quedó resaltada.
  const [accionAbierta, setAccionAbierta] = useState<{ id: string; titulo: string } | null>(
    null,
  );

  const filtros = useMemo<Filtros>(
    () => ({
      convenioId: convenioId || undefined,
      accionFormacionId: accionFormacionId || undefined,
      grupoId: grupoId || undefined,
      asesorId: asesorId || undefined,
      departamentoSepId: departamentoSepId ? Number(departamentoSepId) : undefined,
    }),
    [convenioId, accionFormacionId, grupoId, asesorId, departamentoSepId],
  );

  /**
   * EL RECORTE DE LA PANTALLA, UNO SOLO: los cinco filtros y la
   * ventana del periodo.
   *
   * «Los filtros deben ser funcionales, hasta el momento no los
   * entiendo para nada» (cliente, 23 sep 2026). Y con razón: en esta
   * pantalla convivían TRES alcances. La tira y las gráficas
   * obedecían al periodo y a los filtros; el Resumen General solo a
   * los filtros; y las dos tablas de cupos, a nada. Con «Hoy» elegido,
   * arriba decía una persona y abajo doscientas siete.
   *
   * Ahora hay UN recorte y lo reciben todos. Lo que NO se recorta es
   * la meta de cupos: los comprometidos son los mismos hoy que ayer.
   */
  /// La ventana que la cabecera YA resolvió. Se usa tal cual:
  /// recalcular «hoy» aquí sería una segunda idea de dónde
  /// empieza el día en Bogotá.
  const actual = control?.ventana.instantes?.actual ?? null;
  const anterior = comparar ? (control?.ventana.instantes?.anterior ?? null) : null;
  const [aDesde, aHasta] = [actual?.desde, actual?.hasta];
  const [bDesde, bHasta] = [anterior?.desde, anterior?.hasta];

  const recorte = {
    ...filtros,
    desde: aDesde ?? undefined,
    hasta: aHasta ?? undefined,
  };

  /// Los dos rótulos, de la MISMA respuesta que trae la ventana.
  /// Se sellan con las cifras (ver `Cargado`) y entran en la
  /// clave: si el periodo cambia de nombre, lo que hay pintado
  /// deja de valer aunque las fechas se parezcan.
  const rotuloPeriodo = control?.ventana.etiqueta ?? null;
  const rotuloAnterior = comparar
    ? (etiquetaAnterior?.toLowerCase() ?? control?.ventana.etiquetaAnterior ?? null)
    : null;

  /**
   * QUÉ SE ESTÁ PIDIENDO ahora mismo, en una cadena.
   *
   * Los cinco cortes, el inicio de las dos ventanas y el nombre
   * del periodo. El FIN no entra a propósito: es «ahora» y se
   * mueve solo (ver `REFRESCO_MINIMO`).
   *
   * TODO lo que entra aquí sale de `control`, nunca del estado
   * de la cabecera. El estado de la cabecera cambia al instante y
   * `control` tarda su medio segundo: metiendo aquí el nombre que
   * la cabecera le da al periodo anterior, un cambio de periodo
   * disparaba las consultas DOS veces, una con la ventana vieja
   * y otra con la nueva, que es justo lo que se quiere evitar.
   *
   * Sirve para dos cosas: para no repetir una consulta que ya se
   * hizo, y para saber si lo que hay pintado es de este corte o
   * de otro.
   */
  const claveActual = useMemo(
    () => JSON.stringify([filtros, aDesde ?? null, bDesde ?? null, rotuloPeriodo]),
    [filtros, aDesde, bDesde, rotuloPeriodo],
  );

  /**
   * EL EMBUDO NO OBEDECÍA AL PERIODO (18 sep 2026).
   *
   * Pedía `resumen` solo con los cinco filtros de abajo: con
   * «Hoy» y «vs. ayer» arriba seguía pintando todo el histórico,
   * mientras los bloques de al lado sí se vaciaban. «Seleccioné y
   * no sirvió», con razón. Ahora corta por `creadoEn` --cuándo
   * llegó el lead--, que es la fecha con la que `control` corta
   * su propio embudo.
   */
  /**
   * EN SILENCIO cuando solo avanzó el reloj (18 sep 2026).
   *
   * Con «Hoy», «7 días» o «30 días» el fin de la ventana es AHORA,
   * y la página refresca cada 30 s: el fin cambiaba en cada vuelta,
   * esto recargaba con `cargando` y el panel se atenuaba y dejaba
   * de responder cada medio minuto. Lo vio José. Solo se atenúa
   * cuando cambia lo que la persona ELIGIÓ --filtros o el inicio de
   * un periodo--; lo demás es el mismo periodo, más reciente.
   */
  const cargar = useCallback(async () => {
    /// SIN `control` no se pide nada. La ventana la resuelve él,
    /// y pedir antes de que llegue es pedir con la ventana
    /// equivocada y tener que repetirlo entero un instante
    /// después: era la mitad de las peticiones de la carga en
    /// frío y de cada cambio de periodo.
    if (rotuloPeriodo === null) return;

    const clave = claveActual;
    const mismaEleccion = clave === ultimaClave.current;
    /// Lo único que se movió es el borde «ahora» y la respuesta
    /// es de hace nada: no hay nada nuevo que traer.
    if (mismaEleccion && Date.now() - ultimaRespuesta.current < REFRESCO_MINIMO) return;

    const mio = ++turno.current;
    ultimaClave.current = clave;
    setClavePedida(clave);
    if (!mismaEleccion) setCargando(true);
    /// Sin ningún corte puesto, la consulta del periodo y la de
    /// las cuentas son LA MISMA URL, así que se pide una y sirve
    /// para las dos.
    const sinRecorte =
      !filtros.convenioId &&
      !filtros.accionFormacionId &&
      !filtros.grupoId &&
      !filtros.asesorId &&
      !filtros.departamentoSepId;
    /// Las cuentas de los desplegables solo dependen del PERIODO
    /// --no llevan los cinco cortes--, así que cambiar un filtro
    /// no las mueve y no hace falta volver a pedirlas. Y sin
    /// periodo no se piden nunca: entonces son el catálogo.
    const pedirOpciones =
      Boolean(aDesde) && !sinRecorte && periodoDeOpciones.current !== aDesde;
    /// El catálogo, una sola vez en toda la sesión.
    const pedirCatalogo = !hayCatalogo.current;
    try {
      const [met, per, ant, ops, cat] = await Promise.all([
        /// `metricas` también lleva el periodo, para que «Estado
        /// de los datos» hable del periodo de la cabecera como
        /// todo lo demás. Ya NO alimenta el desplegable de
        /// gremios: aquella cuenta recorta por etapa y el bloque
        /// no, así que ofrecía 98 y al pulsarla contestaba 103.
        crmApi.metricas({ ...filtros, llegoDesde: aDesde, llegoHasta: aHasta }),
        /// TODAS las cifras del bloque salen de aquí. Con «Desde
        /// el principio» las dos fechas van vacías y es el
        /// resumen de siempre; con cualquier otro periodo, el
        /// recorte por `creadoEn`, que es la fecha con la que
        /// `control` corta su propio embudo.
        crmApi.resumen({ ...filtros, llegoDesde: aDesde, llegoHasta: aHasta }),
        bDesde && bHasta
          ? crmApi.resumen({ ...filtros, llegoDesde: bDesde, llegoHasta: bHasta })
          : Promise.resolve(null),
        pedirOpciones
          ? crmApi.resumen({ llegoDesde: aDesde, llegoHasta: aHasta })
          : Promise.resolve(null),
        pedirCatalogo ? crmApi.resumen({}) : Promise.resolve(null),
      ]);
      if (mio !== turno.current) return;
      /// Con periodo y sin cortes, `per` YA es la consulta de las
      /// cuentas: misma URL, una sola petición.
      const cuentasNuevas = ops ?? (aDesde && sinRecorte ? per : null);
      if (cuentasNuevas) {
        setOpciones(cuentasNuevas);
        periodoDeOpciones.current = aDesde;
      }
      if (cat) {
        setCatalogo(cat);
        hayCatalogo.current = true;
      }
      setDatos({
        clave,
        etiqueta: rotuloPeriodo,
        etiquetaAnterior: rotuloAnterior,
        metricas: met,
        delPeriodo: per,
        delAnterior: ant,
      });
      /// Solo al salir bien: si falló, la próxima vuelta tiene
      /// que poder reintentar sin esperar a `REFRESCO_MINIMO`.
      ultimaRespuesta.current = Date.now();
      setError(null);
    } finally {
      if (mio === turno.current) setCargando(false);
    }
  }, [filtros, aDesde, aHasta, bDesde, bHasta, claveActual, rotuloPeriodo, rotuloAnterior]);

  /**
   * REINTENTA cuando el servidor pide esperar (429).
   *
   * Cambiar cinco o seis filtros seguidos a ritmo normal agota el
   * tope de peticiones por minuto, y entonces `Promise.all` no
   * guarda nada: la tarjeta se quedaba con lo viejo --o vacía en
   * la primera carga-- y sin nada que dijera que hay que esperar.
   * Se reintenta dos veces con ocho segundos de aire, que es lo
   * que tarda la ventana del servidor en abrirse otra vez, y
   * mientras tanto el aviso lo dice en español (ver `pedir.ts`).
   */
  useEffect(() => {
    let vivo = true;
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const intentar = (quedan: number) => {
      void cargar().catch((e) => {
        if (!vivo) return;
        setError((e as ErrorApi).message);
        if (quedan > 0 && e instanceof ErrorApi && e.estado === 429) {
          reloj = setTimeout(() => intentar(quedan - 1), 8000);
        }
      });
    };
    intentar(2);
    return () => {
      vivo = false;
      if (reloj) clearTimeout(reloj);
    };
    /// `intento` está a propósito: es el botón «Volver a
    /// intentarlo» del aviso, y sin él pulsarlo no dispararía
    /// nada porque nada más de la lista habría cambiado.
  }, [cargar, intento]);

  useEffect(() => {
    alCambiarFiltros?.(filtros);
  }, [filtros, alCambiarFiltros]);

  /// Las tres respuestas que se están pintando, desempaquetadas.
  /// Todas del MISMO sello: ver `Cargado`.
  const metricas = datos?.metricas ?? null;
  const delPeriodo = datos?.delPeriodo ?? null;
  const delAnterior = datos?.delAnterior ?? null;

  /**
   * Lo pintado NO es de lo que está elegido.
   *
   * Es decir: la consulta falló --429, o sin conexión-- y lo que
   * se ve es lo de antes. Puede fallar cualquiera de las dos
   * mitades, y las dos cuentan: si falla `/resumen` se queda
   * atrás el embudo, y si falla `/control` se quedan atrás las
   * columnas Y la ventana con la que se pide todo lo demás.
   *
   * Para el embudo hacen falta tres cosas: que haya algo
   * pintado, que su sello no sea el de ahora, y que la consulta
   * de ahora YA se haya lanzado y terminado. Sin las dos
   * últimas, el aviso asomaría medio segundo en cada cambio de
   * periodo, que es una espera normal y no un fallo.
   */
  /// Y SE MIRA MITAD POR MITAD.
  ///
  /// Al morder el limitador, `/resumen` se va en 429 y el embudo,
  /// las caídas y las tres casillas se quedan con el corte
  /// anterior, mientras `/control` sí vuelve y la leyenda y las
  /// columnas ya son del corte nuevo. El aviso decía «son las de
  /// antes de cambiar los filtros» de todo el bloque, y eso solo
  /// era cierto de la mitad izquierda: la derecha SÍ es la
  /// pedida, y es la que quien acaba de elegir el filtro va a
  /// leer como respuesta. Se atenúa solo la mitad vieja, para
  /// que se vea de un golpe cuál es cuál.
  ///
  /// `|| !controlAlDia`: CUANDO LA CONSULTA DE LA PÁGINA FALLA, LA
  /// DEL EMBUDO NO LLEGA A SALIR. `/resumen` espera la ventana que
  /// trae `/control`; si `/control` vuelve en 429 o 500 al cambiar de
  /// periodo, `/resumen` nunca se pide, `clavePedida` sigue siendo la
  /// vieja y esta condición salía falsa. La tira pintaba entonces
  /// las cifras del periodo ANTERIOR a plena tinta y sin aviso
  /// --medido el 21 sep 2026 al pasar de «Desde el principio» a
  /// «Últimos 30 días»: «39 % | 121 · 59 % | 5 · 2 %» con opacidad
  /// 1--. `controlAlDia` falso quiere decir justo eso: el último
  /// intento falló y lo que hay es de otro periodo. El
  /// `clavePedida === claveActual` se queda para el caso normal, en
  /// el que la espera es solo una espera y no un fallo.
  const embudoDesfasado =
    Boolean(datos) &&
    datos?.clave !== claveActual &&
    (clavePedida === claveActual || !controlAlDia) &&
    !cargando;
  const columnasDesfasadas = Boolean(datos) && !controlAlDia;
  const desfasado = embudoDesfasado || columnasDesfasadas;
  const mitadDesfasada =
    embudoDesfasado && columnasDesfasadas
      ? "ambas"
      : embudoDesfasado
        ? "izquierda"
        : columnasDesfasadas
          ? "derecha"
          : null;

  const enEtapa = useMemo(
    () => new Map((delPeriodo?.etapas ?? []).map((e) => [e.etapa, e.total])),
    [delPeriodo],
  );
  const g = useCallback((...es: Etapa[]) => es.reduce((s, e) => s + (enEtapa.get(e) ?? 0), 0), [enEtapa]);

  const hitos = useMemo(() => hitosDe(delPeriodo), [delPeriodo]);
  /// Null cuando no hay con qué comparar: «Desde el principio»
  /// no tiene periodo anterior.
  /// LOS CUATRO PASOS se comparan, pero SIN color.
  ///
  /// Estuvo solo la entrada, porque los del periodo anterior
  /// tuvieron más tiempo para avanzar y un «menos» en los pasos de
  /// abajo se leía como que iba peor (José, 18 sep 2026). Pero
  /// entonces al comparar «no se veía nada» (Mauricio, 20 sep):
  /// tres de las cuatro barras no decían nada del otro periodo.
  /// Ahora se enseñan las cuatro --barra gris detrás y tabla
  /// debajo-- y lo que se quita es el COLOR: el número cuenta, no
  /// afirma que vaya mejor o peor. La nota del pie lo dice.
  const hitosAntes = useMemo(
    () => (delAnterior ? hitosDe(delAnterior).map((h) => h.total) : null),
    [delAnterior],
  );

  /**
   * CUÁNTOS DÍAS ABARCA EL PERIODO, según la propia respuesta.
   *
   * Null = no hay corte («Desde el principio»). Sirve para dos
   * cosas: explicar por qué la tasa del periodo anterior siempre
   * sale más alta, y decidir si tiene sentido repartir la gente
   * por fechas --que es cosa del PERIODO y no de cuántas filas
   * devolvió el servidor--.
   */
  const diasDelPeriodo = useMemo(() => {
    const v = control?.ventana.instantes?.actual;
    if (!v) return null;
    /// Hacia ARRIBA: el periodo en curso se recorta en «ahora»,
    /// así que «Últimos 30 días» a las tres de la mañana mide
    /// 29,1 días, y decir 29 al lado de un rótulo que dice 30
    /// parece un error de cuenta.
    const dias = (Date.parse(v.hasta) - Date.parse(v.desde)) / 86_400_000;
    return dias > 0 ? Math.ceil(dias) : null;
  }, [control]);

  /// «en los últimos 30 días», «entre dos fechas»: el periodo
  /// dicho como se lee dentro de una frase.
  ///
  /// Del SELLO de las cifras y NO del desplegable de la cabecera:
  /// aquel cambia al instante y estas cifras pueden ser de la
  /// respuesta anterior. Así no se puede volver a leer «De las
  /// 131 personas que entraron en los últimos 30 días» con
  /// «Últimos 7 días» elegido arriba.
  const cuandoEnFrase = useMemo(() => {
    const cuando = (datos?.etiqueta ?? "el periodo").toLowerCase();
    if (/^(hoy|ayer)$/.test(cuando)) return cuando;
    if (/^(entre|desde|hasta|del)/.test(cuando)) return cuando;
    if (/^últimos?/.test(cuando)) return `en los ${cuando}`;
    return `en ${cuando}`;
  }, [datos]);

  /// La misma historia en una frase. Va encima de las barras.
  const resumenDelEmbudo = useMemo(() => {
    if (hitos.length === 0) return null;
    const [entro, cont, conDatos, insc] = hitos.map((h) => h.total);
    const en = cuandoEnFrase;
    if (entro === 0) return `No entró nadie ${en}.`;
    const gente = entro === 1 ? "la persona que entró" : `las ${n(entro)} personas que entraron`;
    /// Con UNA persona el verbo va en singular: salía «1 ya
    /// fueron contactadas» (cliente, 20 sep 2026).
    const trozo = (v: number, plural: string, singular: string, ninguna: string) =>
      v === 0 ? ninguna : v === 1 ? `1 ${singular}` : `${n(v)} ${plural}`;
    return (
      `De ${gente} ${en}: ` +
      `${trozo(cont, "ya fueron contactadas", "ya fue contactada", "ninguna ha sido contactada")}, ` +
      `${trozo(
        conDatos,
        "tienen sus datos completos",
        "tiene sus datos completos",
        "ninguna tiene sus datos completos",
      )} y ` +
      `${trozo(insc, "quedaron inscritas", "quedó inscrita", "ninguna se ha inscrito todavía")}.`
    );
  }, [hitos, cuandoEnFrase]);

  /**
   * LA TASA, que es la única comparación honesta.
   *
   * «26 inscritos antes contra 15 ahora» parece un desplome y no
   * lo es: la gente del periodo anterior tuvo más tiempo para
   * avanzar (José, 18 sep 2026). Lo que sí se puede comparar es
   * qué proporción de los que entran acaba inscrita. Va en
   * palabras, sin flecha y sin color: cuenta, no afirma.
   *
   * Vuelve PARTIDA: el porcentaje, que es la cifra grande de la
   * tira, y la comparación, que va en su pie. La primera frase de
   * antes --«Se inscribe el 39 % de quien entra.»-- ya no se
   * escribe: la dice la propia celda. Lo que NO se pierde es el
   * «pero esa gente ha tenido N días más»: sin él, la cifra más
   * grande de la pantalla engaña hacia abajo en todo periodo corto
   * (con «Últimos 7 días» dice 0 %).
   *
   * El porcentaje se redondea IGUAL que el apunte de «Inscritos»
   * en el embudo: son la misma cifra y tienen que leerse igual.
   */
  const tasa = useMemo(() => {
    const entro = hitos[0]?.total ?? 0;
    const insc = hitos[3]?.total ?? 0;
    if (entro <= 0) return null;
    const porcentaje = Math.round((insc / entro) * 100);
    if (!hitosAntes || (hitosAntes[0] ?? 0) <= 0) return { porcentaje, comparacion: null };
    const antes = n(Math.round((hitosAntes[3] / hitosAntes[0]) * 100));
    /// El mismo arranque que la comparación de las otras dos celdas
    /// del reparto; el porqué de cada palabra está en `dichoDeAntes`.
    const dicho = dichoDeAntes(datos?.etiquetaAnterior);
    /**
     * Y POR QUÉ ESA RESTA NO ES UNA CAÍDA.
     *
     * El escalón sigue la EDAD de la ventana --medido: 0 % con
     * 7 días, 26 % con 30, 39 % desde el principio-- porque la
     * gente del periodo anterior lleva un periodo entero más
     * para inscribirse. Sin decirlo, la frase engaña y siempre
     * hacia abajo, y es justo la cifra que se repite en una
     * reunión. El propio código ya se lo calla en los «antes N»
     * de los cuatro pasos por esta misma razón (José, 18 sep
     * 2026); aquí faltaba.
     */
    const dias = diasDelPeriodo;
    const antesNumero = Math.round((hitosAntes[3] / hitosAntes[0]) * 100);
    /// LA ADVERTENCIA SOLO CUANDO HAY UNA BAJADA QUE EXPLICAR.
    /// Con «Ayer» salía «Anteayer era el 0 %, pero esa gente ha
    /// tenido 1 día más…» junto a un 0 % de ahora: el «pero» avisaba
    /// de una diferencia que no existe. Si antes era igual, se dice
    /// «también»; si antes era menos, no hay nada que matizar.
    /// El espacio de antes del «%» es DURO (` `): a 390 px el
    /// «%» se iba solo al renglón siguiente, «era el 37 / %, con…».
    if (antesNumero === porcentaje) {
      return { porcentaje, comparacion: `${dicho} también el ${antes} %.` };
    }
    const porque =
      dias && antesNumero > porcentaje
        ? `, con ${n(dias)} ${dias === 1 ? "día" : "días"} más para inscribirse`
        : "";
    /// SIN la nota de los días de media («Desde que entra una
    /// persona hasta que se inscribe pasan N días»), que solo salía
    /// con comparación y guardada en la revelación: esa cifra es
    /// ahora la cuarta celda de la tira y se ve SIEMPRE, diciendo
    /// además de qué gente sale.
    ///
    /// «, con N días más» y no «, pero esa gente ha tenido N días
    /// más»: dice lo mismo en la mitad, y con cuatro celdas iguales
    /// cada palabra de este pie era un renglón más (ver `base`).
    return { porcentaje, comparacion: `${dicho} el ${antes} %${porque}.` };
  }, [hitos, hitosAntes, datos, diasDelPeriodo]);

  /**
   * CUANDO NO HAY CON QUÉ COMPARAR, DECIRLO.
   *
   * «Desde el principio» es el periodo con el que ABRE la
   * pantalla, y ahí la tercera pregunta --¿voy mejor o peor?--
   * no tiene respuesta de ninguna clase: desaparecen a la vez
   * los cuatro «antes N», los tres renglones de las casillas, la
   * segunda frase de la tasa y el control «Comparando con…» de
   * la cabecera, y nada dice por qué. Es coherente que no haya
   * comparación --no hay nada antes del primer dato-- pero eso
   * hay que escribirlo: una pregunta contestada con «no se puede
   * contestar» no es lo mismo que una pregunta sin contestar.
   */
  const sinConQueComparar = etiquetaAnterior === "";

  /**
   * EN QUÉ PASO SE QUEDA MÁS GENTE, dicho y no calculado.
   *
   * La figura pinta las tres caídas y, hasta ahora, las tres
   * iguales: tres cifras del mismo tamaño y el mismo rojo, y la
   * comparación a cargo de quien mira. Con «Desde el principio»
   * --la vista de entrada-- la mayor iba escrita LA ÚLTIMA,
   * debajo de dos más pequeñas, así que leyendo de arriba abajo
   * y quedándose con la primera uno se lleva la respuesta
   * equivocada. Es el dato por el que se abre esta pantalla.
   *
   * Fue un rótulo en la marca y un titular de 16 px encima del
   * embudo. Con el embudo en su propia caja sobraba: el 49 ya está
   * en rojo en su cuello, dos dedos más abajo, y prosa que repite
   * el dibujo es lo que se leía como saturación. Así que se parte
   * sin perder una palabra: «En rojo, el paso donde más gente se
   * queda» pasa a la descripción del bloque, y la frase entera a
   * su letra pequeña.
   */
  const cuelloMayor = useMemo(() => {
    const may = caidaMayor(hitos);
    if (!may || may.cuantos <= 0) return null;
    const donde = [
      "no han sido contactadas todavía",
      "ya fueron contactadas y no tienen sus datos completos",
      "tienen sus datos completos y no se han inscrito",
    ][may.paso];
    if (!donde) return null;
    return `${n(may.cuantos)} ${may.cuantos === 1 ? "persona" : "personas"} ${donde}.`;
  }, [hitos]);

  /**
   * Cuánta gente entraba AL DÍA en el periodo anterior.
   *
   * `delAnterior` no trae serie por día, así que sale del total
   * repartido entre los días de la ventana anterior. Es el número
   * de la raya horizontal del gráfico de días, y por eso es un
   * PROMEDIO DIARIO: comparar el total de un periodo contra una
   * columna de un día sería mezclar peras con manzanas.
   */
  const promedioAnterior = useMemo(() => {
    const v = control?.ventana.instantes?.anterior;
    if (!v || !hitosAntes) return null;
    const cuantos = (Date.parse(v.hasta) - Date.parse(v.desde)) / 86400000;
    if (!(cuantos > 0)) return null;
    return hitosAntes[0] / cuantos;
  }, [control, hitosAntes]);

  /// Sin ventana, el servidor recorta la serie por día a 60 días
  /// —y solo esa serie—, así que con «Desde el principio» el
  /// embudo abarca más tiempo que las columnas. Se dice en el pie
  /// del gráfico en vez de callarlo.
  const serieRecortada = !control?.ventana.desde;

  const entraron = hitos[0]?.total ?? 0;
  const inscritos = hitos[3]?.total ?? 0;
  const perdidos = g("PERDIDO");
  /// Los que se pueden trabajar hoy: ni inscritos ni perdidos.
  /// Con los inscritos y los perdidos reparte a TODOS los que
  /// entraron, sin solaparse: 80 + 121 + 5 = 206.
  const enProceso = entraron - inscritos - perdidos;

  /**
   * Lo que se pinta en «Dónde está cada persona hoy».
   *
   * En «Inscrito» va TODO el que llegó a inscribirse, no solo
   * quien sigue parado en esa etapa: los que ya pasaron al aula
   * se inscribieron igual, y contando solo a los parados las
   * cinco barras sumaban 60 de 107 —cuarenta y siete personas
   * desaparecidas de una tarjeta que promete decir dónde está
   * cada una—. El alcance sigue siendo inscripción: el aula es
   * Gestión Académica, y por eso se suma a «Inscrito» en vez de
   * abrir etapas nuevas.
   */
  const valorDeFase = useCallback(
    (e: Etapa) => (e === "INSCRITO" ? inscritos : enEtapa.get(e) ?? 0),
    [inscritos, enEtapa],
  );

  /// El ancho de las barras va contra la etapa más alta, no
  /// contra el total: contra el total, cuatro de las cinco
  /// quedaban en un hilo de dos píxeles.
  const cimaDeFase = useMemo(
    () => Math.max(1, ...ETAPAS_EN_ORDEN.map(valorDeFase)),
    [valorDeFase],
  );

  /// Los días del periodo, tal como los devuelve el servidor.
  const porDia = useMemo(() => control?.embudoPorDia ?? [], [control]);

  /// Las cifras de las celdas 2 y 3 de la tira en el periodo con
  /// el que se compara. La de inscritos ya no hace falta: su
  /// comparación es la de la tasa, en el pie de la celda 1, y el
  /// «antes N» de «Inscritos» en el embudo.
  const deAntes = useMemo(() => {
    if (!delAnterior) return null;
    const h = hitosDe(delAnterior);
    const en = new Map(delAnterior.etapas.map((e) => [e.etapa, e.total]));
    const perdidosAntes = en.get("PERDIDO") ?? 0;
    return {
      enProceso: (h[0]?.total ?? 0) - (h[3]?.total ?? 0) - perdidosAntes,
      perdidos: perdidosAntes,
    };
  }, [delAnterior]);

  /**
   * LA MISMA GUARDA QUE YA TIENE EL EMBUDO.
   *
   * Cuando el periodo anterior no trae a nadie --la base arranca
   * el 7 de agosto de 2026, así que julio, los 90 días anteriores
   * y los 12 meses anteriores están vacíos-- el embudo se calla
   * los «antes N», la frase de la tasa se calla la comparación y
   * la raya del promedio no se dibuja. Las casillas no tenían la
   * guarda y escribían «+74 frente al mes de antes (0)»: se lee
   * como que se pasó de cero a setenta y cuatro, y lo que pasa es
   * que no hay con qué comparar. Pasaba en 3 de los 9 periodos.
   */
  const hayAntes = (hitosAntes?.[0] ?? 0) > 0;

  /// Mientras llega el dato nuevo, lo viejo se atenúa y no se
  /// vacía: un esqueleto hace perder la referencia de lo que se
  /// estaba mirando, y aquí se mira para comparar.
  ///
  const claseCargando = cargando && control ? "opacity-45 pointer-events-none" : "";

  /// Y si la consulta FALLÓ, lo viejo se queda atenuado: hasta
  /// ahora `setCargando(false)` iba en el `finally`, así que en
  /// cuanto se rendía el intento las cifras del corte anterior
  /// volvían a plena opacidad y se leían como el resultado del
  /// filtro nuevo. El aviso de encima de la tira va aparte, sin
  /// atenuar: es lo único que hay que leer en ese momento.
  ///
  /// Una por mitad: ver `embudoDesfasado` / `columnasDesfasadas`.
  /// Ya no hay una tercera para «las dos»: la letra pequeña que la
  /// usaba se partió y cada revelación va dentro de su caja, con el
  /// atenuado de su dibujo. La nota del cuadre no afirma nada
  /// mientras haya desfase (`cuadran` ya es falso).
  const claseEmbudo = embudoDesfasado ? "opacity-55" : "";
  const claseColumnas = columnasDesfasadas ? "opacity-55" : "";

  /**
   * LAS CIFRAS DE LA TIRA TODAVÍA NO SON DE LO ELEGIDO.
   *
   * Tres casos, y en los tres la tira escribe «—» y nunca «0» ni
   * «0 %»: (1) no ha llegado nada --primera carga, o el panel se
   * montó de nuevo--; (2) lo pintado es de otro corte y su
   * respuesta está en camino; (3) el desplegable de la cabecera ya
   * dice otro periodo y la página todavía no trajo su `control`,
   * así que ni siquiera se ha podido pedir.
   *
   * Sin el (1), mientras cargaba, las casillas pintaban «0» y los
   * anillos «0 %» a 24 px (medido a los 2,5 s de elegir el
   * periodo). Sin el (2) y el (3), al pasar de «Últimos 7 días» a
   * «Desde el principio» la cifra más grande de la pantalla seguía
   * diciendo «0 %» a plena tinta durante el medio segundo --o los
   * treinta, si la página tenía otra consulta en vuelo-- que tarda
   * en llegar lo nuevo, y se leía como la respuesta.
   *
   * Si la consulta FALLÓ no se esconde nada: se enseña lo viejo
   * atenuado, con el aviso encima que dice de qué periodo es.
   */
  /// Todavía no ha llegado NINGUNA respuesta del embudo: primera
  /// carga, o el panel se volvió a montar. La tira escribe «—», el
  /// embudo pinta su hueco y la gráfica el suyo.
  const sinDatosTodavia = hitos.length === 0;
  /// El caso (3) se mira por el RANGO que trae `control` --el que
  /// la página pidió--, traducido con la misma tabla que rotula el
  /// desplegable. Se probó a sellar las cifras con el nombre del
  /// desplegable al pedirlas, y de «Desde el principio» a «Un rango
  /// de fechas» sin fechas todavía la tira se quedaba en «—» para
  /// siempre: los dos cortes son el mismo, así que no se vuelve a
  /// pedir nada y el sello no se renovaba nunca (medido en el
  /// barrido de los nueve periodos).
  ///
  /// «Un rango de fechas» sin sus dos fechas lo resuelve el servidor
  /// como «Desde el principio» y devuelve `rango: "TODO"`
  /// (crm/ventana.ts): sin esta excepción la tira se quedaba en «—»
  /// mientras el desplegable dijera «Un rango de fechas» y no se
  /// hubieran elegido las fechas (medido: 40 s sin salir de ahí).
  const rangoDelControl = control?.ventana.rango as Rango | undefined;
  const controlDeLoElegido =
    !etiquetaPeriodo ||
    !rangoDelControl ||
    ETIQUETA_RANGO[rangoDelControl] === etiquetaPeriodo ||
    (etiquetaPeriodo === ETIQUETA_RANGO.PERSONALIZADO && rangoDelControl === "TODO");
  const cifrasPendientes =
    sinDatosTodavia ||
    (!desfasado && (datos?.clave !== claveActual || !controlDeLoElegido));

  /**
   * Las cuatro celdas de la tira, en el orden en que se leen.
   *
   * Cada una con su explicación larga en el `title` --son los
   * `detalle` de las tres casillas que había-- y repetida en la
   * letra pequeña del embudo, para quien no tiene puntero.
   */
  const celdas = useMemo<Celda[]>(() => {
    const raya = "—";
    /// Los tres porcentajes del reparto, que suman 100 (ver
    /// `repartoEnCien`), y los del periodo con el que se compara,
    /// sacados por la MISMA regla para que las dos cifras de cada
    /// frase «era el N %» se puedan poner una al lado de la otra.
    const reparto = repartoEnCien(entraron, inscritos, enProceso, perdidos);
    const repartoAntes =
      hayAntes && hitosAntes && deAntes
        ? repartoEnCien(hitosAntes[0], hitosAntes[3], deAntes.enProceso, deAntes.perdidos)
        : null;
    const porcentajePerdidos = entraron > 0 ? perdidos / entraron : 0;
    /**
     * LA COMPARACIÓN DE LAS CELDAS 2 Y 3, EN PORCENTAJE Y CON LA
     * FRASE DE LA 1.
     *
     * Era «+58 frente a los 30 días anteriores (eran 31)», la línea
     * de las casillas: una resta de personas debajo de lo que ahora
     * es un porcentaje, que es otra vez mezclar cantidad y
     * porcentaje. Va como en «Se inscribe» --«En los 30 días
     * anteriores era el 38 %.»-- y en el mismo párrafo que la base.
     *
     * Con el mismo aviso de José que la tasa, y por la misma razón:
     * la gente del periodo anterior ha tenido más días para
     * decidirse, así que su «siguen en proceso» sale siempre más
     * bajo y su «dijeron que no» más alto. Solo se dice cuando la
     * diferencia va en ESA dirección --si no, no hay nada que
     * matizar--, y «también» cuando no hay diferencia.
     */
    const contra = (
      ahora: number | undefined,
      antes: number | undefined,
      /// Hacia dónde empuja el tiempo de más: «siguen en proceso»
      /// sale más bajo en el periodo anterior, «dijeron que no» más
      /// alto.
      antesSaleMasBajo: boolean,
    ) => {
      if (ahora === undefined || antes === undefined) return null;
      const dicho = dichoDeAntes(datos?.etiquetaAnterior);
      /// Espacio duro antes del «%», como en `tasa`: si no, el «%»
      /// puede caer solo en el renglón siguiente.
      if (antes === ahora) return `${dicho} también el ${n(antes)} %.`;
      const porque =
        diasDelPeriodo && (antesSaleMasBajo ? antes < ahora : antes > ahora)
          ? `, con ${n(diasDelPeriodo)} ${diasDelPeriodo === 1 ? "día" : "días"} más para decidirse`
          : "";
      return `${dicho} el ${n(antes)} %${porque}.`;
    };
    /// La base y su comparación en UN párrafo, como el pie de la 1.
    const conComparacion = (base: string, comparacion: string | null) =>
      comparacion ? `${base} ${comparacion}` : base;
    /**
     * «39 % de los 206 leads que entraron», EL PIE DE LAS TRES DEL
     * REPARTO.
     *
     * PRIMERO EL NÚMERO Y DESPUÉS EL PORCENTAJE (cliente, 24 sep
     * 2026, textual). Hasta hoy era al revés --la cifra grande era el
     * porcentaje y la cuenta iba dentro de la frase-- y era al revés
     * porque el 21 de septiembre él pidió justo eso: «estás metiendo
     * cantidad y porcentaje; si haces eso, como la tarjeta de Se
     * inscribe». Cambió de opinión, y queda escrito para que nadie lo
     * «arregle» de vuelta pensando que es un descuido.
     *
     * Y DICE «LEADS», que era la otra mitad del encargo: «colocar que
     * es leads porque no da contexto». «206 que entraron» no dice
     * entraron a qué.
     */
    const delTotalDeLeads = (porcentaje: number | null | undefined) =>
      porcentaje === null || porcentaje === undefined
        ? ""
        : `${n(porcentaje)} % ${
            entraron === 1
              ? "del único lead que entró"
              : `de los ${n(entraron)} leads que entraron`
          }.`;
    const media = control?.diasHastaInscribir ?? null;
    const dias = media === null ? null : Math.round(media);

    /// EL PIE DE LA QUE MANDA: su base, y la advertencia de José
    /// en el MISMO párrafo. Partidos en dos renglones propios, a
    /// 1.366 px la advertencia bajaba a dos líneas y la tira pasaba
    /// de 130 px; seguidos, las dos frases llenan dos renglones y
    /// se leen como lo que son: la cifra y por qué no es una caída.
    ///
    /// MÁS CORTO DESDE QUE LAS CUATRO CELDAS MIDEN LO MISMO (21 sep
    /// 2026). Con un cuarto de ancho, «80 de las 206 personas que
    /// entraron llegaron a inscribirse. En los 7 días anteriores era
    /// el 14 %, pero esa gente ha tenido 7 días más…» ocupaba cuatro
    /// renglones a 1.366 px --la tira medía 138 px contra 130-- y seis
    /// en el celular, y empujaba «Dijeron que no» bajo el pliegue. Se
    /// quitan las palabras que no dicen nada nuevo («personas»,
    /// «llegaron a»); el dato y la advertencia se quedan enteros.
    const pieDeLaTasa = conComparacion(
      delTotalDeLeads(tasa?.porcentaje),
      tasa?.comparacion ?? null,
    );

    return [
      {
        rotulo: "Inscritos",
        /// En `--titulo` y SIN color: la cifra cuenta, no afirma
        /// que vaya bien o mal (José, 18 sep 2026).
        cifra: cifrasPendientes || !tasa ? raya : n(inscritos),
        colorCifra: cifrasPendientes ? "var(--texto-suave)" : "var(--titulo)",
        pies: cifrasPendientes ? [] : [pieDeLaTasa],
        explicacion:
          "Llegaron a inscribirse, estén hoy estudiando el curso o no. Quien entró antes del periodo y se inscribió en estos días no cuenta aquí: eso lo dice «Ritmo de inscripción».",
        manda: true,
        ancha: true,
        clase: claseEmbudo,
      },
      {
        /// LA MISMA FORMA QUE «SE INSCRIBE»: el porcentaje es la
        /// cifra y la cuenta va en la frase, con su base. Era «92»
        /// grande con «70 %» pequeño al lado, y la fila mezclaba dos
        /// formas: «estás metiendo cantidad y porcentaje; si haces
        /// eso, como la tarjeta de Se inscribe» (cliente, 21 sep
        /// 2026). Así los tres primeros se leen como lo que son, un
        /// reparto de la misma gente que suma 100.
        rotulo: "En proceso",
        cifra: cifrasPendientes || !reparto ? raya : n(enProceso),
        /// En `--titulo`, como las otras. Iba en ámbar, y con las
        /// cuatro cifras del mismo tamaño --orden del cliente-- el
        /// único color de la fila era el suyo: «121» mandaba sobre
        /// «39 %», que es la que tiene que mandar por el sitio.
        colorCifra: cifrasPendientes ? "var(--texto-suave)" : "var(--titulo)",
        /// CORTO, COMO EL DE LA 1. Se probó «…siguen en proceso: ni
        /// se han inscrito ni han dicho que no. En los 30 días
        /// anteriores…» y a 1.366 px con comparación ocupaba cuatro
        /// renglones: la tira pasaba de 123 a 138 px, y en el celular
        /// de 230 a 275 sin comparar. Lo de «ni se han inscrito ni han
        /// dicho que no» no se pierde: es el `title` de la celda.
        pies: cifrasPendientes
          ? []
          : [
              conComparacion(
                delTotalDeLeads(reparto?.enProceso),
                contra(reparto?.enProceso, repartoAntes?.enProceso, true),
              ),
            ],
        explicacion:
          "De los que entraron en el periodo: no se han inscrito y tampoco han dicho que no. Son los que se pueden trabajar hoy.",
        clase: claseEmbudo,
      },
      {
        rotulo: "Descartados",
        cifra: cifrasPendientes || !reparto ? raya : n(perdidos),
        /// La regla del anillo de pérdida que había: hasta el 15 %
        /// es normal, hasta el 30 % en ámbar y por encima en rojo.
        /// En rojo fijo, un 2 % --que es bueno-- se leería como una
        /// alarma. Iba en el porcentaje pequeño y se viene con él a
        /// la cifra; lo normal, en `--titulo` como las otras tres.
        colorCifra: cifrasPendientes
          ? "var(--texto-suave)"
          : porcentajePerdidos <= 0.15
            ? "var(--titulo)"
            : porcentajePerdidos <= 0.3
              ? "var(--aviso)"
              : "var(--error)",
        /// Sin el «Se marcaron como no interesados» que llevaba de pie:
        /// por la misma razón de alto que la 2, y porque sigue en el
        /// `title`.
        pies: cifrasPendientes
          ? []
          : [
              conComparacion(
                delTotalDeLeads(reparto?.perdidos),
                contra(reparto?.perdidos, repartoAntes?.perdidos, false),
              ),
            ],
        explicacion: "Marcados como no interesados. Salen del embudo.",
        clase: claseEmbudo,
      },
      {
        /// DICE DE QUIÉN HABLA. Es la única cifra de la tira cuya
        /// gente no son los que entraron: sale de quienes SE
        /// INSCRIBIERON en el periodo, entraran cuando entraran.
        /// Sin decirlo repite el «¿esas 131 a qué hacen
        /// referencia?».
        rotulo: "Conversión en días",
        cifra:
          cifrasPendientes || dias === null ? raya : `${n(dias)} ${dias === 1 ? "día" : "días"}`,
        colorCifra: cifrasPendientes || dias === null ? "var(--texto-suave)" : "var(--titulo)",
        pies: cifrasPendientes
          ? []
          : [
              dias === null
                ? "Nadie se inscribió en el periodo, así que no hay media."
                : "de media desde que entran, entre quienes se inscribieron en el periodo.",
            ],
        explicacion:
          "La media sale de quienes se inscribieron en el periodo, entraran cuando entraran; no es la misma gente de las otras tres cifras.",
        ancha: true,
        /// De `/control` y no de `/resumen`: se atenúa con las
        /// columnas.
        clase: claseColumnas,
      },
    ];
  }, [
    cifrasPendientes,
    tasa,
    entraron,
    inscritos,
    perdidos,
    enProceso,
    hayAntes,
    hitosAntes,
    deAntes,
    diasDelPeriodo,
    datos,
    control,
    claseEmbudo,
    claseColumnas,
  ]);

  /**
   * Cuándo la meta del SENA se puede dividir entre lo de arriba.
   *
   * El backend acota la meta por gremio y por acción, que es como
   * se compromete. NO se reparte por grupo, ni por asesor, ni por
   * departamento: con uno de esos puesto, arriba habría un
   * numerador recortado y abajo una meta entera.
   *
   * Y el PERIODO es un filtro más del numerador --el que más
   * recorta--: con «Hoy» salía «meta 3.690 · 0 %» y con «Desde el
   * principio» «meta 3.690 · 2 %», la misma meta y tres cifras
   * distintas solo por mover un desplegable. La meta es de toda
   * la convocatoria, así que solo se enseña cuando el numerador
   * también lo es.
   */
  const periodoCompleto = !control?.ventana.desde;
  const metaComparable =
    !asesorId && !departamentoSepId && !grupoId && periodoCompleto;
  const meta = metaComparable ? (control?.metaComprometida ?? null) : null;

  /**
   * Si las dos mitades del bloque cuentan a la MISMA gente.
   *
   * El embudo sale de `/resumen` y las columnas de `/control`:
   * son dos consultas distintas, así que el pie no puede AFIRMAR
   * que una es la suma de la otra sin haberlo comprobado. Se
   * comprueba aquí, sumando la serie por día contra lo que entró,
   * y solo entonces se dice.
   */
  const sumaPorDia = useMemo(
    () => porDia.reduce((s, d) => s + d.entraron, 0),
    [porDia],
  );

  /**
   * SI HAY ALGO QUE REPARTIR POR FECHAS.
   *
   * Lo decide EL PERIODO, no cuántas filas devolvió el servidor.
   * Con `porDia.length > 1` bastaba un filtro flaco para perder
   * el gráfico: con «Últimos 30 días» + Departamento
   * CUNDINAMARCA el servidor devuelve UNA fila --2 personas, el
   * 29 de agosto-- y la pantalla afirmaba que «Últimos 30 días»
   * cabe en un solo día. Con la ventana en la mano se pintan las
   * 30 columnas con una sola barra, que además enseña de un
   * vistazo que llevamos veintitantos días sin nadie de ese
   * departamento. `rellenarDias` ya sabe rellenar los huecos
   * hasta los bordes del periodo.
   *
   * Sin ventana --«Desde el principio»-- no hay más remedio que
   * mirar las filas: ahí el periodo no tiene bordes.
   */
  const hayColumnas =
    porDia.length > 1 || (porDia.length === 1 && (diasDelPeriodo ?? 1) > 1);

  /**
   * CUÁNDO SE PUEDE AFIRMAR EL CUADRE.
   *
   * Dos condiciones y las dos hacen falta. Que las cifras que se
   * están pintando sean del corte elegido --si no, la izquierda
   * es de un filtro y la derecha de otro, que es como el pie
   * llegó a decir «suman las 5 personas» sobre unas columnas que
   * sumaban 131--; y que la suma DÉ, contada aquí mismo.
   *
   * `serieRecortada` YA NO entra. Estaba para el recorte de 60
   * días del servidor, pero lo tapaba de más: con «Desde el
   * principio» --la vista con la que se abre la pantalla-- las
   * columnas sumaban 206 y el embudo decía 206, y aun así el pie
   * se callaba el cuadre y encima avisaba de un desajuste que no
   * existía. Si de verdad falta serie, la suma no da y la
   * condición de abajo lo caza sola.
   */
  const cuadran = !desfasado && hayColumnas && entraron > 0 && sumaPorDia === entraron;

  /**
   * LA LETRA PEQUEÑA DEL GRÁFICO DE COLUMNAS, RECOGIDA DE ABAJO.
   *
   * Tiene que subir hasta aquí porque la revelación va al pie de
   * la caja, a todo el ancho --debajo del trazado Y del panel de la
   * leyenda--, junto a la nota del cuadre, que solo se puede
   * comprobar aquí. Y no se puede escribir aquí: si una columna es un día, una semana o un mes
   * lo decide el ancho MEDIDO del gráfico, que aquí no se conoce.
   *
   * El arreglo se guarda comparando frase por frase y se devuelve
   * el MISMO cuando no cambió ninguna: así, aunque el aviso llegue
   * en cada pintado, no hay estado nuevo y el par de componentes
   * no puede morderse la cola.
   */
  const [notasColumnas, setNotasColumnas] = useState<string[]>([]);
  const recibirNotas = useCallback((nuevas: string[]) => {
    setNotasColumnas((viejas) =>
      viejas.length === nuevas.length && viejas.every((v, i) => v === nuevas[i])
        ? viejas
        : nuevas,
    );
  }, []);

  /**
   * CUANDO LA COMPARACIÓN NO SE PUEDE HACER, PEGADO A ELLA.
   *
   * Eran dos frases más, sueltas y del mismo tamaño que las otras
   * tres, debajo de todo: la cuarta de las ocho de las que se
   * quejó el cliente. Dicen por qué falta la comparación --no la
   * hacen-- así que su sitio es la nota del pie, con las demás
   * advertencias. No se pierde ninguna: la nota se abre desde el
   * propio bloque y las dos siguen escritas con todas sus
   * palabras.
   *
   * Son excluyentes: o no hay periodo anterior, o lo hay y está
   * vacío.
   */
  const apunteDeLaComparacion =
    entraron <= 0
      ? null
      : sinConQueComparar
        ? `«${datos?.etiqueta ?? "Desde el principio"}» no se compara con nada: es todo lo que hay. Elija arriba un periodo más corto para ver si va mejor o peor.`
        : comparar && hitosAntes && !hayAntes
          ? `En ${datos?.etiquetaAnterior ?? "el periodo anterior"} no hay nadie con quien comparar, así que esta vez no se compara: los datos empiezan después.`
          : null;

  /**
   * LA LETRA PEQUEÑA, PARTIDA EN DOS: UNA POR DIBUJO.
   *
   * Estuvo en cuatro sitios, después junta en una sola revelación
   * cerrada --«Cómo se leen estos dos dibujos»-- al pie del bloque
   * que tenía el embudo y las columnas lado a lado. Con la gráfica
   * arriba y el embudo abajo (cliente, 21 sep 2026) esa revelación
   * habría quedado a medio metro de uno de los dos, así que cada
   * dibujo se lleva la suya al pie de su caja. Ocultar, nunca
   * eliminar: no se pierde ninguna frase.
   *
   * La de «Los porcentajes del embudo son sobre las N personas que
   * entraron» sale de aquí y pasa a la vista, en la descripción del
   * embudo: un porcentaje con la base guardada en algo cerrado es
   * un porcentaje sin base. Y la de los días de media, a la cuarta
   * celda de la tira, que la enseña siempre.
   */
  const notasDeLaGrafica = useMemo(() => {
    if (!hayColumnas || entraron <= 0) return [];
    return [
      cuadran
        ? `Las cifras de encima de las columnas suman ${
            entraron === 1 ? "la persona que entró" : `las ${n(entraron)} personas que entraron`
          }: es la misma gente del embudo de abajo, repartida por el día en que entró.`
        : "Arriba, qué día entró cada persona; abajo, en el embudo, dónde se queda. Cada persona está contada una sola vez y en un solo color.",
      ...notasColumnas,
    ];
  }, [hayColumnas, entraron, cuadran, notasColumnas]);

  /**
   * Y la del embudo, en el orden de quien abre: primero lo que le
   * falta a lo que SÍ se ve --por qué no hay comparación, en qué
   * paso se queda la gente-- y después qué es cada paso y cada
   * cifra de la tira. Las tres explicaciones de las casillas que
   * había («Siguen en proceso», «Se inscribe», «Dijeron que no»)
   * viven aquí, además de en el `title` de su celda, porque en un
   * celular no hay puntero que lo enseñe.
   */
  const notasDelEmbudo = useMemo(() => {
    if (entraron <= 0 || hitos.length === 0) return [];
    const lista: string[] = [];
    if (apunteDeLaComparacion) lista.push(apunteDeLaComparacion);
    if (cuelloMayor) lista.push(`Donde más gente se queda: ${cuelloMayor}`);
    lista.push(
      "Los cuatro pasos del embudo: entraron, fueron contactadas, tienen sus datos completos («Con datos») y se inscribieron. Cada porcentaje es cuánta gente de la que entró llegó a ese paso.",
      "En proceso: de los leads que entraron en el periodo, no se han inscrito y tampoco han dicho que no. Son los que se pueden trabajar hoy.",
      "Inscritos: llegaron a inscribirse, estén hoy estudiando el curso o no. Quien entró antes del periodo y se inscribió en estos días no cuenta aquí: eso lo dice «Ritmo de inscripción».",
      "Descartados: marcados como no interesados. Salen del embudo. Cuentan como contactados, así que están dentro de «contactados, sin datos».",
      "Conversión en días: la media sale de quienes se inscribieron en el periodo, entraran cuando entraran; no es la misma gente de las otras tres cifras.",
    );
    return lista;
  }, [entraron, hitos, apunteDeLaComparacion, cuelloMayor]);

  const hayFiltro = Boolean(
    convenioId || accionFormacionId || grupoId || asesorId || departamentoSepId,
  );

  function quitarFiltros() {
    setConvenioId("");
    setAccionFormacionId("");
    setGrupoId("");
    setAsesorId("");
    setDepartamentoSepId("");
  }

  const donutConvenio: PorcionDonut[] = (control?.porConvenio ?? []).map((c) => ({
    etiqueta: c.etiqueta,
    valor: c.total,
  }));
  const donutModalidad: PorcionDonut[] = (control?.porModalidad ?? []).map((c) => ({
    etiqueta: c.etiqueta,
    valor: c.total,
  }));
  /**
   * Los canales, UNA sola vez: la dona y la lista salen de aquí.
   *
   * De `conversionPorOrigen` y no de `porOrigen` porque la lista
   * necesita además cuántos inscribe cada canal, que va en el
   * `title`. Ordenados por volumen y con la paleta fijada a mano,
   * para que el color del punto de la lista sea el de su porción.
   */
  const canales = useMemo(() => {
    const filas = [...(control?.conversionPorOrigen ?? [])].sort((a, b) => b.leads - a.leads);
    const cima = Math.max(1, ...filas.map((f) => f.leads));
    /// EL REPARTO, que no es el ancho de la barra: la barra va
    /// contra el canal más grande --así se comparan entre ellos-- y
    /// el porcentaje va contra el total, que es lo que se pidió
    /// («donde das el número y al lado su porcentaje»).
    const todos = filas.reduce((t, f) => t + f.leads, 0);
    return filas.map((f, i) => {
      const etiqueta = ETIQUETA_ORIGEN[f.etiqueta as Origen] ?? f.etiqueta;
      return {
        etiqueta,
        leads: f.leads,
        color: PALETA_CANAL[i % PALETA_CANAL.length],
        ancho: (f.leads / cima) * 100,
        porcion: pct(f.leads, todos),
        pista: `${etiqueta}: ${n(f.leads)} personas, ${n(f.inscritos)} inscritos (${Math.round(
          f.conversion * 100,
        )} %)`,
      };
    });
  }, [control]);

  const donutOrigen: PorcionDonut[] = canales.map((c) => ({
    etiqueta: c.etiqueta,
    valor: c.leads,
    color: c.color,
  }));

  /// Verde lo completo y ámbar lo que falta: son un estado bueno
  /// y uno por resolver, no dos categorías cualesquiera, y con
  /// los colores de serie no se distinguía cuál era cuál.
  ///
  /// SIN NINGÚN LEAD, NINGUNA PORCIÓN. Con «Hoy» y nadie dentro
  /// llegaban las dos etapas a cero y la leyenda escribía «0,0 %»
  /// dos veces: un porcentaje sobre cero personas, justo lo que la
  /// tira de arriba se cuida de no pintar nunca. Vacío, la dona
  /// dice «Sin leads todavía.».
  const porEstado = metricas?.porEstado ?? [];
  const donutDatos: PorcionDonut[] = porEstado.some((e) => e.valor > 0)
    ? [...porEstado]
        .sort((a, b) => b.valor - a.valor)
        .map((e) => ({
          etiqueta: e.etiqueta,
          valor: e.valor,
          color: /completo/i.test(e.etiqueta) ? "var(--exito)" : "var(--aviso)",
        }))
    : [];

  /// Los grupos de la acción abierta, para el desglose.
  /**
   * El gremio que se está mirando, si es uno solo.
   *
   * Puede serlo por filtro o porque en el corte no hay más que
   * uno. En los dos casos la dona de convenio sobra —una sola
   * porción no reparte nada— y hace falta su nombre para el
   * subtítulo.
   */
  const gremioUnico = useMemo(() => {
    if (convenioId) {
      return (catalogo?.convenios ?? []).find((c) => c.id === convenioId)?.nombre ?? null;
    }
    const cs = control?.porConvenio ?? [];
    return cs.length === 1 ? cs[0].etiqueta : null;
  }, [convenioId, catalogo, control]);

  /**
   * Las acciones del gremio, para la dona que ocupa el hueco.
   *
   * Con un solo gremio la tarjeta «Por convenio» no dice nada, y
   * dejar «Por modalidad» sola a lo ancho desperdicia media
   * fila. Lo que sí interesa entonces es en qué acciones se
   * reparte ESE gremio.
   *
   * Cinco y «Otras acciones»: con once porciones la dona es un
   * arcoíris ilegible y la leyenda tapa la tarjeta. Las que se
   * agrupan siguen contando —la suma cuadra con el total—, solo
   * dejan de tener porción propia.
   */
  const CIMA_ACCIONES = 5;
  const donutAcciones: PorcionDonut[] = useMemo(() => {
    const filas = [...(control?.porAccion ?? [])].sort((a, b) => b.total - a.total);
    if (filas.length === 0) return [];
    const cabeza = filas.slice(0, CIMA_ACCIONES).map((f, i) => {
      /// «AF1 · NOMBRE» → «AF1 · Nombre». El código en alta, que
      /// es como se nombra, y el resto en frase: igual que en el
      /// desglose de abajo, que habla de las mismas acciones.
      const codigo = f.etiqueta.split(" ")[0] ?? "";
      const resto = f.etiqueta.slice(codigo.length);
      return {
        etiqueta: `${codigo}${frase(resto)}`,
        valor: f.total,
        color: PALETA_CANAL[i % PALETA_CANAL.length],
      };
    });
    const cola = filas.slice(CIMA_ACCIONES).reduce((t, f) => t + f.total, 0);
    return cola > 0
      ? [...cabeza, { etiqueta: "Otras acciones", valor: cola, color: "var(--superficie-alterna)" }]
      : cabeza;
  }, [control]);

  /// Los grupos de la acción abierta, también de más a menos.
  const gruposDe = (codigo: string) =>
    (control?.porGrupo ?? [])
      .filter((x) => x.clave?.startsWith(codigo))
      .sort((a, b) => b.total - a.total);

  /**
   * Las CINCO listas de los desplegables.
   *
   * Qué se puede elegir sale del catálogo del ámbito y cuánta
   * gente tiene cada uno del periodo de la cabecera. Ver
   * `conCuentaDelPeriodo`.
   *
   * Sin periodo --«Desde el principio»-- las dos respuestas son
   * la misma consulta, así que el catálogo hace de las dos y no
   * se pide nada de más.
   *
   * LOS GREMIOS ENTRARON AQUÍ (21 sep 2026). Salían de
   * `/metricas`, que recorta por etapa a las cinco del embudo,
   * mientras el bloque sale de `/resumen`, que descarta la etapa
   * a propósito: la lista ofrecía «ADECOPRIA · 98 personas» y al
   * elegirlo el bloque contestaba 103 --la diferencia era la
   * gente que ya pasó al aula: EN_FORMACION, CERTIFICADO,
   * RETIRADO, ABANDONO--. Los otros cuatro salían de `/resumen` y
   * cuadraban al dígito. Ahora los cinco cuentan lo mismo.
   */
  const cuentas = aDesde ? opciones : catalogo;

  /**
   * LOS GREMIOS ENTRE LOS QUE SE PUEDE ELEGIR, que son los del
   * ÁMBITO y no los que tienen gente.
   *
   * Con un gremio puesto en el menú del avatar, el guard ya
   * recortó el ámbito a ese: aquí queda uno solo y el desplegable
   * no se pinta --y hace bien--. Si se pintara, elegir el otro
   * cruzaría `convenioId IN (ámbito)` con `convenioId = pedido`,
   * la intersección sería vacía, y saldrían cero filas con 200 y
   * sin un solo error. Un filtro que contesta «no hay nada»
   * cuando lo que pasa es que no se puede preguntar.
   *
   * En la puerta general con «Todos los gremios» salen los dos,
   * que es el caso que estaba roto.
   */
  const { admin } = useAdmin();
  const gremiosQueSeEligen = useMemo(() => {
    const suyos = admin.gremios ?? [];
    return admin.gremioElegido
      ? suyos.filter((g) => g.convenioId === admin.gremioElegido)
      : suyos;
  }, [admin.gremios, admin.gremioElegido]);

  const listas = useMemo(
    () => ({
      convenios: conCuentaDelPeriodo(
        catalogo?.convenios ?? [],
        cuentas?.convenios ?? [],
        (c) => c.id,
      ),
      acciones: conCuentaDelPeriodo(
        catalogo?.acciones ?? [],
        cuentas?.acciones ?? [],
        (a) => a.id,
      ),
      grupos: conCuentaDelPeriodo(catalogo?.grupos ?? [], cuentas?.grupos ?? [], (g) => g.id),
      asesores: conCuentaDelPeriodo(
        catalogo?.asesores ?? [],
        cuentas?.asesores ?? [],
        (a) => a.id,
      ),
      departamentos: conCuentaDelPeriodo(
        catalogo?.departamentos ?? [],
        cuentas?.departamentos ?? [],
        (d) => d.id,
      ),
    }),
    [catalogo, cuentas],
  );

  /**
   * EL GRUPO VA COLGADO DE LA ACCIÓN (cliente, 23 sep 2026).
   *
   * «Grupo (atado a la AF)»: elegida una acción, el desplegable de
   * grupos solo ofrece los suyos. Sin esto la lista traía los de las
   * quince acciones --setenta y pico entradas-- y era la única manera
   * de armar un filtro imposible: la acción AF3 con un grupo de AF7,
   * que no devuelve a nadie y parece que el panel se rompió.
   */
  const codigoDeLaAccion = accionFormacionId
    ? (listas.acciones.find((a) => a.id === accionFormacionId)?.codigo ?? null)
    : null;
  const gruposDeLaAccion = codigoDeLaAccion
    ? listas.grupos.filter((g) => g.accion === codigoDeLaAccion)
    : listas.grupos;

  /// Y si el grupo que estaba puesto no es de la acción recién
  /// elegida, se cae solo: dejarlo puesto --invisible en su
  /// desplegable pero vivo en la consulta-- deja la pantalla en cero
  /// sin nada que lo explique.
  /// SE DERIVA, NO SE GUARDA. Estuvo en un efecto que llamaba a
  /// `setGrupoId`, y cambiar estado dentro de un efecto es un render
  /// dentro de otro: el linter lo rechaza y en el peor caso es un
  /// bucle. Aquí el valor efectivo se calcula y punto; el estado se
  /// queda como esté y nadie lo ve.
  const grupoEfectivo =
    grupoId && gruposDeLaAccion.some((g) => g.id === grupoId) ? grupoId : "";

  /// El nombre del curso detrás de su código, para que el
  /// desplegable de grupos no ofrezca «AF1 · Grupo 1» a secas.
  const nombreDeAccion = useMemo(
    () => new Map((catalogo?.acciones ?? []).map((a) => [a.codigo, frase(a.nombre)])),
    [catalogo],
  );

  return (
    <div className="space-y-4">
      {error && <Aviso tipo="error">{error}</Aviso>}

      {/* ── 1 · Filtros, y cuánta gente hay dentro ── */}
      <div className="rounded-xl border border-borde bg-superficie px-4 py-3.5">
        <p className="mb-2.5 text-[0.6875rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
          Filtros
          {/* SIN LA CUENTA AL LADO. «Eliminar: 132 personas entraron
              desde el principio» (cliente, 23 sep 2026). La cifra ya
              está en la tira de abajo y en el Resumen General, y aquí
              arriba competía con el rótulo del filtro. */}
          {hayFiltro && (
            <button
              onClick={quitarFiltros}
              className="ml-3 font-normal tracking-normal text-texto-suave underline normal-case hover:text-texto"
            >
              Limpiar
            </button>
          )}
        </p>

        {/* Los CINCO que recortan qué se mira. El periodo y su
            comparación se subieron a la cabecera: enmarcan la
            pantalla entera, y aquí abajo el «vs. anterior»
            parecía un recorte más.

            `auto-fit` con mínimo de 150px: caben los cinco en
            una fila ancha y bajan solos al estrechar, sin
            «breakpoint» que mantener. */}
        {/* LA ACCIÓN, EL DOBLE DE ANCHA QUE EL GRUPO (cliente, 23 sep
            2026). Antes las cinco columnas medían igual y el nombre de
            un curso no cabe en lo mismo que «Grupo 1». Con `flex` y
            bases distintas cada control pide lo que necesita, y al
            estrechar bajan solos sin un corte fijo que mantener. */}
        <div className="flex flex-wrap gap-2 [&>*]:min-w-0">
            {/* SUS OPCIONES SALEN DEL ÁMBITO, NO DE QUIÉN TIENE
                GENTE, y esa es la diferencia entre verlo y no
                verlo. Salían de `listas.convenios`, que es un
                `groupBy` sobre PARTICIPANTES: con BRITCHAM ADEE en
                stand-by y cero leads, la lista traía una sola
                entrada y el desplegable se escondía solo --en la
                puerta general, donde es justo el que hace falta--.
                Es la misma fuente que ya usa la pestaña
                «Reservas», que por eso sí lo enseña.

                Y al elegir uno se cerraba sobre sí mismo: la
                respuesta volvía con un convenio, la compuerta caía
                y el control DESAPARECÍA, sin forma de volver sin
                editar la dirección. Saliendo del ámbito, se queda.

                La cuenta de personas sigue saliendo del informe,
                como segunda línea: un gremio sin nadie tiene que
                poder elegirse y contestar cero, que es un dato. */}
            {gremiosQueSeEligen.length > 1 && (
              <div className="min-w-0 flex-[1_1_140px]">
              <Desplegable
                alto={34}
                marcador="Gremios"
                etiquetaAria="Gremio"
                valor={convenioId}
                opciones={[
                  { valor: "", etiqueta: "Gremios" },
                  ...gremiosQueSeEligen.map((g) => {
                    const c = listas.convenios.find((x) => x.id === g.convenioId);
                    return {
                      valor: g.convenioId,
                      etiqueta: g.sigla,
                      /// «SIN PERSONAS» SOLO SI EL INFORME LLEGÓ.
                      /// Mientras `catalogo` es null --la primera
                      /// carga, o un 429 del limitador, que deja el
                      /// catálogo en null el resto de la sesión--
                      /// no saberlo no es saber que no hay nadie:
                      /// ADECOPRIA tiene más de 80 fichas y diría
                      /// cero. Es la misma regla que `pendientes`
                      /// en el módulo 5: sin el dato no se afirma.
                      detalle: c
                        ? `${n(c.total)} ${c.total === 1 ? "persona" : "personas"}`
                        : catalogo
                          ? "sin personas todavía"
                          : undefined,
                    };
                  }),
                ]}
                alElegir={setConvenioId}
              />
              </div>
            )}

            {/* Desplegable y no buscador: los cinco filtros se
                abren igual, con su segunda línea en gris. Un
                control que se comporta distinto que sus vecinos
                obliga a aprenderlo aparte.

                LAS OPCIONES SALEN DE `opciones`, NO DE LAS CIFRAS
                DEL BLOQUE. Es la misma consulta recortada solo por
                el periodo: así la lista no se queda con una sola
                entrada al elegir --se podía entrar en ANTIOQUIA y
                no salir sin borrar los cinco filtros-- y la
                segunda línea cuenta la gente del periodo de
                arriba, no la de todo el histórico. */}
            <div className="min-w-0 flex-[3_1_320px]">
            <Desplegable
              alto={34}
              marcador="Acción de formación"
              etiquetaAria="Acción de formación"
              valor={accionFormacionId}
              opciones={[
                { valor: "", etiqueta: "Acción de formación" },
                ...listas.acciones.map((a) => ({
                  valor: a.id,
                  etiqueta: `${a.codigo} · ${frase(a.nombre)}`,
                  /// «personas» y no «leads»: la cabecera de la
                  /// pantalla, el bloque y el pie cuentan
                  /// personas, y dos palabras para lo mismo --una
                  /// de ellas en inglés-- en la misma pantalla es
                  /// lo primero que se preguntó (cliente, 21 sep
                  /// 2026).
                })),
              ]}
              alElegir={(v) => {
                setAccionFormacionId(v);
                /// El grupo de otra acción no tiene sentido con esta
                /// elegida, y dejarlo puesto deja la pantalla en cero.
                setGrupoId("");
              }}
            />
            </div>

            <div className="min-w-0 flex-[1_1_150px]">
            <Desplegable
              alto={34}
              marcador="Grupo"
              etiquetaAria="Grupo"
              valor={grupoEfectivo}
              opciones={[
                { valor: "", etiqueta: "Grupo" },
                ...gruposDeLaAccion.map((g) => ({
                  valor: g.id,
                  /// Con el código de su acción delante: «Grupo 1»
                  /// existe en las quince acciones.
                  etiqueta: `${g.accion} · Grupo ${g.numero}`,
                  /// SIN SEGUNDA LÍNEA. Llevaba el nombre del curso
                  /// y la cantidad, y el cliente los quitó los dos:
                  /// «solo la AF y grupo, ejemplo: AF1 Grupo 1; ¿para
                  /// qué el nombre si lo tengo al lado?» (23 sep
                  /// 2026). El nombre está en el desplegable de
                  /// acción, justo a la izquierda.
                })),
              ]}
              alElegir={setGrupoId}
            />
            </div>

            {/* AQUÍ VIVÍA «Etapas», Y SE QUITA (20 sep 2026).
                No recortaba nada de esta pantalla: `/resumen`
                descarta la etapa a propósito --es la respuesta de
                la que sale el reparto POR etapa que dibuja el
                embudo-- y `/control` ni la recibe. Se elegía
                «Interesado · 40 leads», se encendía «Limpiar» y
                no se movía una sola cifra: ni el embudo, ni la
                leyenda, ni las tres casillas, ni los medidores.

                Y aunque se aplicara, no querría decir nada aquí:
                este embudo es ACUMULADO --quién llegó a cada
                paso-- y recortarlo a una etapa lo deja en una
                sola barra. «Que funcionen los filtros» (cliente,
                20 sep 2026): un control que se marca como puesto
                y no recorta nada es peor que no tenerlo. Para
                mirar una etapa está la pantalla de leads, que sí
                filtra por ella. */}

            <div className="min-w-0 flex-[1_1_170px]">
            <Desplegable
              alto={34}
              marcador="Asesores"
              etiquetaAria="Asesor"
              valor={asesorId}
              opciones={[
                { valor: "", etiqueta: "Asesores" },
                ...listas.asesores.map((a) => ({
                  valor: a.id,
                  etiqueta: a.nombre,
                })),
              ]}
              alElegir={setAsesorId}
            />
            </div>

            <div className="min-w-0 flex-[1_1_170px]">
            <Desplegable
              alto={34}
              marcador="Departamentos"
              etiquetaAria="Departamento"
              valor={departamentoSepId}
              opciones={[
                { valor: "", etiqueta: "Departamentos" },
                /* «Sin departamento» NO se ofrece, y no es capricho.
                   Esa fila llega con id nulo, así que el valor
                   viajaba como la palabra «null», se convertía en
                   NaN y el servidor contestaba 400 a dos de las
                   tres consultas. Peor: el NaN se quedaba pegado al
                   filtro y TODO lo que se tocara después fallaba
                   igual --medido: 52 respuestas 400 seguidas y el
                   bloque 115 s enseñando las cifras de otro
                   filtro--. Filtrar «a quien le falta el
                   departamento» es una consulta que el backend hoy
                   no acepta; mientras no exista, no se ofrece.
                   Esas personas siguen contadas en el total. */
                ...listas.departamentos
                  .filter((d) => d.id !== null && d.id !== undefined && Number.isFinite(Number(d.id)))
                  .map((d) => ({
                    valor: String(d.id),
                    etiqueta: d.nombre,
                  })),
              ]}
              alElegir={setDepartamentoSepId}
            />
            </div>
        </div>

        {/* SIN LA LÍNEA DE VOCABULARIO. La explicaba aquí --«gremio
            es la agremiación que trae a las personas», «AF1 es el
            código del curso»-- y el cliente la mandó quitar el 23 sep
            2026: quien usa el panel ocho horas al día no necesita que
            se lo expliquen cada vez, y ocupaba un renglón encima de
            los filtros. */}
      </div>

      {/* La barra fina de arriba mientras llega el dato nuevo.
          El encargo la pide junto al atenuado, y hace falta: la
          opacidad sola, en una pantalla que ya es clara, casi no
          se nota, y quien cambia un filtro no sabe si pasó algo.
          `aria-hidden` porque el aviso de verdad para un lector
          de pantalla es el `aria-busy` de abajo. */}
      {cargando && control && (
        <div className="h-0.5 overflow-hidden rounded-full bg-superficie-alterna" aria-hidden>
          <div className="h-full w-1/3 animate-[recorrer_1.1s_ease-in-out_infinite] rounded-full bg-marca" />
        </div>
      )}

      <div
        className={`space-y-4 transition-opacity ${claseCargando}`}
        aria-busy={cargando && Boolean(control)}
      >
        {/* ── El aviso de cifras viejas, SIN ATENUAR ──
            Cuando una consulta no vuelve --el 429 del limitador, o
            sin conexión-- lo que se ve es del corte anterior. Se
            dice de qué son las cifras, qué es lo que no se pudo
            traer, y se ofrece reintentar.
            ENCIMA DE LA TIRA y no dentro del embudo: ahora habla de
            tres piezas. La tira (celdas 1 a 3) y el embudo salen de
            `/resumen`; la cuarta celda y las columnas, de
            `/control`. */}
        {desfasado && (
          <p className="rounded-xl border border-aviso/30 bg-aviso-suave px-3 py-2 text-[0.78125rem] leading-snug text-aviso">
            <strong className="font-semibold">
              {/* QUÉ MITAD ESTÁ VIEJA, y no «todo». Cuando lo que
                  falla es `/resumen` y `/control` sí vuelve, las
                  columnas SÍ son las pedidas --son las que quien
                  acaba de elegir el filtro va a leer como
                  respuesta-- y el aviso hablaba de las dos por
                  igual. */}
              {mitadDesfasada === "izquierda"
                ? "Las cifras de arriba y el embudo no son lo que pidió."
                : mitadDesfasada === "derecha"
                  ? "Las columnas por día no son lo que pidió."
                  : "Estas cifras no son las que pidió."}
            </strong>{" "}
            {/* Con el nombre del periodo tal como lo dice el
                desplegable, entre comillas: «son de los últimos 30
                días» se tuerce con «Desde el principio» y con «Un
                rango de fechas». */}
            {etiquetaPeriodo && datos?.etiqueta && datos.etiqueta !== etiquetaPeriodo
              ? `Son las de «${datos.etiqueta}»; no se pudieron traer las de «${etiquetaPeriodo}».`
              : "Son las de antes de cambiar los filtros; no se pudieron traer las nuevas."}{" "}
            <button
              type="button"
              onClick={() => setIntento((i) => i + 1)}
              className="font-semibold underline underline-offset-2"
            >
              Volver a intentarlo
            </button>
          </p>
        )}

        {/* ── 2 · Cuatro cifras del periodo ──
            Sin nadie en el periodo, en su sitio va UNA línea: no
            hay embudo ni columnas que dibujar, y cuatro ceros
            grandes --o «0 %» sobre «0 de 0», que es lo que pintaban
            los anillos con «Hoy»-- no son un dato. Ver `SinGente`.
            Solo con las cifras AL DÍA: al pasar de «Hoy» a «Ayer», el
            «No entró nadie hoy» se quedaba a plena tinta mientras
            llegaba lo nuevo, contestando por un periodo que ya no
            está elegido. Mientras tanto va la tira con sus «—», como
            en cualquier otro cambio. */}
        {hitos.length > 0 && entraron === 0 && !cifrasPendientes ? (
          <SinGente hayFiltro={hayFiltro} aviso={resumenDelEmbudo} />
        ) : (
          <TiraDelPeriodo celdas={celdas} />
        )}

        {/* ── BLOQUE 1 · RESUMEN GENERAL ──
            Lo primero de la pantalla, por encargo del cliente (23 sep
            2026): las siete cifras macro, una barra por acción de
            formación. Va con los mismos filtros de arriba: un bloque
            que los ignora enseña una cifra distinta a la de su vecino
            para la misma pregunta. */}
        <ResumenGeneral filtros={recorte} />

        {/* ── 5 · De qué está hecha esa gente ── */}
        {/* SOLO «Por convenio», y solo con los dos gremios a la vista.
            Esta fila tenía además «Por acción de formación» y «Por
            modalidad», y las dos salieron por encargo del cliente (23
            sep 2026): la primera la reemplaza la tabla de cupos e
            inscritos de abajo, que dice lo mismo con cifras y no con
            porciones; la segunda no se usa para decidir nada. */}
        {donutConvenio.length > 1 && !gremioUnico && (
          <Bloque titulo="Por convenio" descripcion="Cómo se reparten entre los dos gremios.">
            <Donut datos={donutConvenio} detalleCentro="personas" />
          </Bloque>
        )}

        {/* ── LA TABLA DEL COMITÉ ──
            Es el Excel que el cliente llevaba a mano, y va aquí --antes
            de los cortes de siempre-- porque es lo que se mira primero
            en el comité: cuántos cupos hay comprometidos y cuánto falta
            para cerrar cada acción (cliente, 23 sep 2026). */}
        {/* CON UNA ABIERTA, SOLO ESA FILA (cliente, 23 sep 2026: «no
            veo que cuando le doy clic a uno me oculte las demás AF y me
            dé el listado de los grupos»). Pulsar otra vez la fila
            suelta el corte y vuelven las siete. */}
        <TablaPorAccion
          recorte={
            accionAbierta
              ? { ...recorte, accionFormacionId: accionAbierta.id }
              : recorte
          }
          /// Pulsar la fila abre sus grupos; pulsarla otra vez los
          /// cierra. Es el Bloque 3 que pidió el cliente, y nace
          /// cerrado: siete acciones abiertas son setenta filas.
          alElegir={(fila) =>
            setAccionAbierta((a) =>
              a?.id === fila.accionFormacionId
                ? null
                : { id: fila.accionFormacionId, titulo: `${fila.codigo} · ${fila.nombre}` },
            )
          }
          elegida={accionAbierta?.id ?? null}
        />

        {/* ── BLOQUE 3 · EL DETALLE POR GRUPOS ── */}
        {accionAbierta && (
          <TablaPorGrupo
            accionFormacionId={accionAbierta.id}
            titulo={accionAbierta.titulo}
          />
        )}

        {/* ── 6 · Dónde está cada quien y si sus datos sirven ── */}
        <div className="grid gap-4 min-[1000px]:grid-cols-2">
          <Bloque
            titulo="Estado del lead"
            descripcion="En qué paso está parada cada persona hoy."
          >
            <ul className="space-y-2.5">
              {ETAPAS_EN_ORDEN.filter((e) => valorDeFase(e) > 0).map((e) => {
                        const v = valorDeFase(e);
                        return (
                          <li key={e}>
                            <div className="flex items-baseline justify-between gap-3 text-[0.84375rem]">
                              <span className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                                  style={{ background: colorEtapa(e) }}
                                  aria-hidden
                                />
                                {ETIQUETA_ETAPA[e]}
                              </span>
                              <span className="shrink-0 font-semibold tabular-nums">
                                {n(v)}
                                <span className="ml-2 text-[0.71875rem] font-normal text-texto-suave">
                                  {pct(v, entraron)}
                                </span>
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-superficie-alterna">
                              <div
                                className="h-full rounded-full transition-[width] duration-500"
                                style={{
                                  width: `${cimaDeFase > 0 ? (v / cimaDeFase) * 100 : 0}%`,
                                  background: colorEtapa(e),
                                }}
                              />
                            </div>
                          </li>
                        );
              })}
            </ul>
          </Bloque>

          <Bloque
            titulo="Estado de los datos"
            descripcion="Cuántos leads están completos y cuántos a medias."
          >
            {/* MÁS GRANDE, Y A LA MEDIDA DE SU VECINA. «La dona de
                Estado de los datos más grande simétricamente»
                (cliente, 23 sep 2026): comparte fila con «Estado del
                lead», que es una lista de cinco barras, y a 188 px
                dejaba media tarjeta en blanco al lado de ella. */}
            <Donut
              datos={donutDatos}
              tamano={224}
              detalleCentro="personas"
              vacio="Sin leads todavía."
            />
          </Bloque>
        </div>

        {/* ── 7 · A qué ritmo entra y por dónde ── */}
        <div className="grid gap-4 min-[1000px]:grid-cols-2">
          {/* LAS DOS TARJETAS DE LA FILA MIDEN IGUAL, y el dibujo
              de dentro NO crece con ellas.
              Son las dos cosas a la vez, y hubo que separarlas
              porque venían pegadas. El defecto viejo era que la
              rejilla estiraba esta tarjeta hasta los 908 px del
              vecino --dona de 188 px más la lista de canales-- y
              el dibujo se comía los 718 px que le sobraban: la
              curva salía exagerada. Se arregló fijando el alto
              del dibujo (`ALTO_SERIE`), y de paso se dejó la
              tarjeta suelta con `self-start`, que dejaba las dos
              de la fila desparejas: 332 contra 366 px, medido.
              «Estos dos al mismo tamaño, veo con menos altura
              Ritmo de inscripción» (cliente, 21 sep 2026).
              Así que la tarjeta SÍ se estira --`estirado`-- y lo
              que sobra queda como aire debajo del dibujo, que es
              lo que pidió. El dibujo sigue midiendo 160 px en
              cualquier fila, que es lo que permite comparar la
              misma curva de una pantalla a otra. */}
          <div className="min-w-0">
          <Bloque
            estirado
            titulo="Ritmo de inscripción"
            /// A QUIÉN CUENTA, y en qué se diferencia del embudo.
            ///
            /// Decía «Inscritos por el día en que se inscribieron»
            /// --«lo leí tres veces antes de caer en que es
            /// distinto de la otra cifra de inscritos» (cliente,
            /// 21 sep 2026)--. El embudo cuenta a los que
            /// ENTRARON en el periodo y acabaron inscritos; esto
            /// cuenta a los que SE INSCRIBIERON en el periodo,
            /// entraran cuando entraran. Por eso las dos cifras
            /// son distintas y las dos están bien.
          >
            <Serie datos={control?.serie ?? []} />
          </Bloque>
          </div>

          <Bloque
            titulo="Origen del Lead"
            /// DICE DE QUÉ HABLA, porque no obedece al periodo.
            ///
            /// Sale de `conversionPorOrigen`, que el backend
            /// calcula a propósito sin ventana --si no, con «Hoy»
            /// todas las conversiones caen a cero y la tabla se
            /// ordena por quién tuvo suerte esta mañana
            /// (crm/control.ts)--. El problema no era el dato
            /// sino el rótulo: con «Hoy» la pantalla decía arriba
            /// «No entró nadie hoy» y dos dedos más abajo listaba
            /// 101 personas, pegado a un vecino que sí dice
            /// «la gente del periodo». Si un bloque no hace caso
            /// al periodo, tiene que decirlo él.
          >
            {/* Dona a la izquierda y UNA lista a la derecha:
                punto de color, canal, cuántos, y la barra debajo.
                Tenía la leyenda de la dona MÁS un bloque aparte de
                barras, y las dos decían lo mismo dos veces. Lo que
                no dice la dona —cuántos inscribe cada canal— va en
                el `title`, que es donde el encargo lo pide. */}
            <div className="flex flex-wrap items-center gap-4">
              <Donut datos={donutOrigen} tamano={168} detalleCentro="personas" soloDibujo />
              <ul className="min-w-[170px] flex-1 space-y-2.5">
                {canales.map((c) => (
                  <li key={c.etiqueta} title={c.pista}>
                    <div className="flex items-baseline gap-2 text-[0.78125rem]">
                      <span
                        className="inline-block h-2 w-2 shrink-0 self-center rounded-full"
                        style={{ background: c.color }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{c.etiqueta}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {n(c.leads)}
                        <span className="ml-2 text-[0.71875rem] font-normal text-texto-suave">
                          {c.porcion}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-superficie-alterna">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${c.ancho}%`, background: c.color }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Bloque>
        </div>

        {/* ── 8 · Dónde vive y quién la atiende ── */}
        {/* Tres bloques y no dos: «prefiero eso como campo aparte
            al lado del mapa... y reducirle al mapa» (cliente, 20
            sep 2026). El mapa dice DÓNDE se concentra, la lista
            CUÁNTOS, y el tercero quién los atiende. */}
        <div className="grid gap-4 min-[1000px]:grid-cols-[0.75fr_0.85fr_1.1fr]">
          <Bloque titulo="Por departamento" descripcion="Dónde vive la gente del periodo.">
            <MapaColombia
              datos={(delPeriodo?.departamentos ?? []).map((d) => ({
                nombre: d.nombre,
                total: d.total,
              }))}
            />
          </Bloque>

          <Bloque
            titulo="Cantidad por departamento"
            descripcion="De más a menos, con lo que pesa cada uno."
          >
            <ListaBarras
              datos={[...(delPeriodo?.departamentos ?? [])]
                .sort((a, b) => b.total - a.total)
                .map((d) => ({
                  clave: String(d.id ?? d.nombre),
                  etiqueta: d.nombre,
                  valor: d.total,
                }))}
              sufijo=" personas"
              sufijoUno=" persona"
              maximoFilas={8}
              vacio="Sin personas en el periodo."
            />
          </Bloque>

          <Bloque
            titulo="Rendimiento por asesor"
            descripcion="Cuántos lleva y cuántos convierte a inscrito cada uno."
          >
            <TablaAsesores filas={control?.porAsesor ?? []} />
          </Bloque>
        </div>

        {/* ── 9 · El detalle, con sus grupos dentro ── */}
        

      </div>
    </div>
  );
}

/**
 * El ritmo de inscripción, con sus cifras.
 *
 * Era una curva sin un solo número: no decía cuántos, ni cuándo
 * fue el mejor día, ni qué altura tenía el pico --«¿los putos
 * datos en cada punta?»-- y encima dejaba media tarjeta en blanco
 * porque el alto estaba clavado en 140 px mientras el bloque de
 * al lado la estiraba (cliente, 20 sep 2026).
 *
 * Y después se pasó al otro lado: con `min-h-[150px] grow` el
 * dibujo se comía TODO el alto que le dejaba su vecino de fila
 * --medido a 1.600 px: 718 px de alto para nueve puntos-- y con
 * `preserveAspectRatio="none"` sobre un `viewBox` de 100 unidades
 * eso estira la curva en vertical: tres días parecidos daban un
 * techo plano de trapecio y el punto del mejor día salía ovalado.
 * «No exageres con esa gráfica, debe ser al mismo tamaño de De
 * dónde vienen. En las puntas, que supongo que debe haber datos,
 * es donde te dije que colocaras los datos» (cliente, 21 sep
 * 2026).
 */

/// EL ALTO DEL DIBUJO: FIJO, EN PÍXELES Y HONESTO.
///
/// 160 px es lo que miden los dibujos de esta pantalla --la dona
/// del vecino son 188, la figura del embudo 238-- y sobre todo es
/// un alto que NO depende de lo que mida el bloque de al lado. La
/// misma curva no puede verse de una manera en una fila y de otra
/// en otra: eso no se puede comparar de memoria, que es para lo
/// que se mira un tablero.
const ALTO_SERIE = 160;
/// Aire arriba, para que el punto del mejor día no se corte contra
/// el canto: la cima caía en y=0 y el círculo se pintaba medio
/// fuera del dibujo.
const AIRE_SERIE = 12;
/// Los puntos, en píxeles y en HTML --no dentro del `svg`--
/// porque el dibujo sigue estirándose a lo ancho (el eje de x es
/// tiempo y ocupa lo que haya) y ahí dentro un círculo se
/// convertiría en un óvalo, que es lo que pasaba.
const PUNTO_PUNTA = 7;
const PUNTO_MEJOR = 9;

/**
 * UNA PUNTA DE LA CURVA: su punto, su fecha y su cifra.
 *
 * La escala eran dos cifras sueltas pegadas al canto derecho --la
 * cima arriba y un «0» abajo-- que no decían de qué día hablaba
 * ninguna. Lo que hacía falta es lo que se pidió dos veces: el
 * dato EN la punta. A la izquierda el primer día, a la derecha el
 * último, cada uno con su fecha.
 *
 * El rótulo va ENCIMA de su punto cuando hay sitio y debajo
 * cuando el punto está pegado al canto de arriba. Encima es donde
 * no hay tinta: el relleno del área queda siempre por debajo de
 * la curva.
 */
function PuntaDeSerie({
  lado,
  x,
  y,
  dia,
  valor,
}: {
  lado: "izquierda" | "derecha" | "centro";
  /// En % del ancho: el eje de x es tiempo y se estira con la
  /// tarjeta.
  x: number;
  /// En píxeles desde arriba, que es como se dibuja la curva.
  y: number;
  dia: string;
  valor: number;
}) {
  const arriba = y > 26;
  /// El rótulo se ancla al canto de su lado --que es justo donde
  /// cae su punto, en x=0 y en x=100-- así que nunca se sale de la
  /// tarjeta. Con un solo día el punto va centrado y el rótulo
  /// también.
  const anclaje =
    lado === "centro" ? { left: "50%" } : lado === "izquierda" ? { left: 0 } : { right: 0 };
  const corrimientos = [
    lado === "centro" ? "translateX(-50%)" : "",
    arriba ? "translateY(-100%)" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <span
        className="pointer-events-none absolute block rounded-full"
        style={{
          left: `${x}%`,
          top: y,
          width: PUNTO_PUNTA,
          height: PUNTO_PUNTA,
          /// Centrado en su punto, y con un halo del color de la
          /// tarjeta para que se lea sobre el relleno del área.
          transform: "translate(-50%, -50%)",
          background: SERIE.uno,
          boxShadow: "0 0 0 2px var(--superficie)",
        }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute text-[0.625rem] leading-tight whitespace-nowrap tabular-nums"
        style={{
          ...anclaje,
          top: arriba ? y - 8 : y + 8,
          transform: corrimientos || undefined,
        }}
      >
        <span className="text-texto-suave">{dia} · </span>
        <span className="font-semibold text-titulo">{n(valor)}</span>
      </span>
    </>
  );
}

function Serie({ datos }: { datos: Array<{ dia: string; total: number }> }) {
  if (datos.length === 0) {
    return (
      <p className="py-8 text-center text-[0.84375rem] text-texto-suave">
        Sin inscritos en el periodo.
      </p>
    );
  }

  const cima = Math.max(1, ...datos.map((d) => d.total));
  const mejor = datos.reduce((a, b) => (b.total > a.total ? b : a));
  /// Con un solo día no hay curva que trazar: el punto va al medio
  /// y lleva UN rótulo, no dos iguales encimados.
  const unSoloDia = datos.length === 1;
  const paso = unSoloDia ? 0 : 100 / (datos.length - 1);
  const en = (i: number, v: number) => ({
    x: unSoloDia ? 50 : i * paso,
    y: AIRE_SERIE + (1 - v / cima) * (ALTO_SERIE - AIRE_SERIE),
  });
  const puntos = datos.map((d, i) => {
    const p = en(i, d.total);
    return `${p.x},${p.y}`;
  });
  const area = `${en(0, 0).x},${ALTO_SERIE} ${puntos.join(" ")} ${
    en(datos.length - 1, 0).x
  },${ALTO_SERIE}`;
  const iMejor = datos.indexOf(mejor);
  const pMejor = en(iMejor, mejor.total);
  /// Si el pico ES una de las puntas, su punto ya lleva rótulo con
  /// la cifra: dos encimados no se leen ninguno de los dos.
  const picoEnLaPunta = unSoloDia || iMejor === 0 || iMejor === datos.length - 1;
  const primero = datos[0];
  const ultimo = datos[datos.length - 1];
  const pPrimero = en(0, primero.total);
  const pUltimo = en(datos.length - 1, ultimo.total);

  return (
    <div className="flex flex-col">
      {/* EL DIBUJO, CON ALTO PROPIO.
          Sin `grow` y sin `h-full`: lo que sobre de alto en la
          fila, que sobre. Ver `ALTO_SERIE`. */}
      <div className="relative mt-3" style={{ height: ALTO_SERIE }}>
        {/* `viewBox` de 100 x ALTO_SERIE: el eje de y queda 1 a 1
            en píxeles --así el relleno y el trazo son los que se
            dibujaron-- y el de x se estira, que es lo que tiene
            que hacer un eje de tiempo. */}
        <svg
          viewBox={`0 0 100 ${ALTO_SERIE}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          aria-hidden
        >
          <polygon points={area} fill={SERIE.uno} opacity={0.14} />
          <polyline
            points={puntos.join(" ")}
            fill="none"
            stroke={SERIE.uno}
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* EL MEJOR DÍA, MARCADO Y CON SU CANTIDAD. «Ritmo de
            inscripción: los picos del gráfico, que tengan la
            cantidad» (cliente, 23 sep 2026). Iba mudo porque su
            cifra estaba en la frase de arriba --la misma que él
            mandó quitar-- así que el dato se muda al punto donde
            ocurre, que es donde se busca.

            El rótulo va DEBAJO del punto, no encima: el pico cae
            siempre en y = AIRE_SERIE (12 px) y encima no hay sitio.
            Es la misma regla de `PuntaDeSerie`. */}
        <span
          className="pointer-events-none absolute block rounded-full"
          style={{
            left: `${pMejor.x}%`,
            top: pMejor.y,
            width: PUNTO_MEJOR,
            height: PUNTO_MEJOR,
            transform: "translate(-50%, -50%)",
            background: SERIE.uno,
            boxShadow: "0 0 0 2px var(--superficie)",
          }}
          aria-hidden
        />
        {!picoEnLaPunta && (
          <span
            className="pointer-events-none absolute text-[0.625rem] leading-tight font-semibold whitespace-nowrap text-titulo tabular-nums"
            style={{
              /// Clavado a su punto, y sin salirse por los cantos
              /// cuando el pico cae en el primer o el último tramo.
              left: `${Math.min(94, Math.max(6, pMejor.x))}%`,
              top: pMejor.y + PUNTO_MEJOR,
              transform: "translateX(-50%)",
            }}
          >
            {n(mejor.total)}
          </span>
        )}

        {/* LAS DOS PUNTAS, CON SU DATO. Con un solo día se queda
            la del medio; si hubiera que sacrificar una sería la
            izquierda, porque la derecha es «cómo vamos hoy». */}
        {unSoloDia ? (
          <PuntaDeSerie
            lado="centro"
            x={pUltimo.x}
            y={pUltimo.y}
            dia={fecha(ultimo.dia)}
            valor={ultimo.total}
          />
        ) : (
          <>
            <PuntaDeSerie
              lado="izquierda"
              x={pPrimero.x}
              y={pPrimero.y}
              dia={fecha(primero.dia)}
              valor={primero.total}
            />
            <PuntaDeSerie
              lado="derecha"
              x={pUltimo.x}
              y={pUltimo.y}
              dia={fecha(ultimo.dia)}
              valor={ultimo.total}
            />
          </>
        )}
      </div>

      {/* La serie entera en texto, que es la costumbre de los
          gráficos de esta casa: el svg va `aria-hidden` y los
          rótulos de las puntas solo dan dos de los nueve días. */}
      <p className="sr-only">
        {datos.map((d) => `${fecha(d.dia)}: ${d.total}`).join(". ")}
      </p>
    </div>
  );
}

function fecha(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

/** Quién lleva cuántos y cuántos convierte. */
function TablaAsesores({
  filas,
}: {
  filas: Array<{
    asesorId: string | null;
    etiqueta: string;
    asignados: number;
    inscritosSiempre: number;
    conversion: number;
  }>;
}) {
  if (filas.length === 0) {
    return <p className="py-8 text-center text-[0.84375rem] text-texto-suave">Sin asesores con leads.</p>;
  }
  /// Por conversión y con «Sin asignar» al final: no es un
  /// asesor, y colado entre ellos por su tasa parecía el mejor
  /// del equipo. Es la regla del prototipo.
  const orden = [...filas].sort((a, b) => {
    const sa = a.asesorId === null;
    const sb = b.asesorId === null;
    if (sa !== sb) return sa ? 1 : -1;
    return b.conversion - a.conversion;
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[0.84375rem]">
        <thead>
          <tr className="border-b border-hairline text-[0.625rem] font-bold tracking-[0.08em] text-texto-suave uppercase">
            <th className="pb-2 text-left font-bold">Asesor</th>
            {/* DICE DE QUÉ ES EL TOTAL (cliente, 24 sep 2026). Un
                «Total» a secas en una tabla de asesores se lee como
                el total de cualquier cosa: es de leads asignados. */}
            <th className="pb-2 text-right font-bold">Total (Lead Asignado)</th>
            <th className="pb-2 text-right font-bold">Inscr.</th>
            <th className="pb-2 pl-4 text-left font-bold">Conversión</th>
          </tr>
        </thead>
        <tbody>
          {orden.map((f) => (
            <tr
              key={f.asesorId ?? "sin"}
              className="border-b border-hairline last:border-0 transition hover:bg-tabla-fila-resaltada"
            >
              <td className="py-2 text-marca">{f.etiqueta}</td>
              <td className="py-2 text-right tabular-nums">{n(f.asignados)}</td>
              <td className="py-2 text-right font-semibold tabular-nums">{n(f.inscritosSiempre)}</td>
              <td className="py-2 pl-4">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 min-w-[60px] flex-1 overflow-hidden rounded-full bg-superficie-alterna">
                    <div
                      className="h-full rounded-full bg-marca"
                      style={{ width: `${Math.round(f.conversion * 100)}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[0.71875rem] tabular-nums">
                    {Math.round(f.conversion * 100)} %
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** El ranking por acción, y sus grupos al desplegar. */
function DesgloseAcciones({
  filas,
  total,
  abierta,
  alAbrir,
  grupos,
}: {
  filas: Array<{ etiqueta: string; total: number }>;
  total: number;
  abierta: string | null;
  alAbrir: (v: string | null) => void;
  grupos: (codigo: string) => Array<{ etiqueta: string; total: number; inicio: string | null }>;
}) {
  if (filas.length === 0) {
    return <p className="py-8 text-center text-[0.84375rem] text-texto-suave">Sin acciones con inscritos.</p>;
  }
  const cima = Math.max(1, ...filas.map((f) => f.total));
  /// De más a menos, no por código: es un ranking, y quien mira
  /// esto quiere ver primero la acción que más gente mueve.
  const orden = [...filas].sort((a, b) => b.total - a.total);

  return (
    <ul className="divide-y divide-hairline">
      {orden.map((f) => {
        /// El código va delante de la etiqueta: «AF1 · nombre».
        const codigo = f.etiqueta.split(" ")[0] ?? f.etiqueta;
        const nombre = frase(f.etiqueta.slice(codigo.length).replace(/^\s*·\s*/, ""));
        const abierto = abierta === f.etiqueta;
        const sus = abierto ? grupos(codigo) : [];

        return (
          <li key={f.etiqueta}>
            <button
              type="button"
              onClick={() => alAbrir(abierto ? null : f.etiqueta)}
              className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-tabla-fila-resaltada"
            >
              <span
                className={`shrink-0 text-texto-suave transition-transform ${abierto ? "rotate-90" : ""}`}
                aria-hidden
              >
                ›
              </span>
              <span className="w-10 shrink-0 text-[0.84375rem] font-semibold text-marca">
                {codigo}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.84375rem] text-titulo">
                {nombre || f.etiqueta}
              </span>
              <span className="hidden h-1.5 w-40 shrink-0 overflow-hidden rounded-full bg-superficie-alterna sm:block">
                <span
                  className="block h-full rounded-full bg-marca"
                  style={{ width: `${(f.total / cima) * 100}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-[0.84375rem] font-semibold tabular-nums">
                {n(f.total)}
              </span>
              <span className="w-10 shrink-0 text-right text-[0.71875rem] text-texto-suave tabular-nums">
                {pct(f.total, total)}
              </span>
            </button>

            {abierto && (
              <div className="pb-3 pl-[4.25rem]">
                {sus.length === 0 ? (
                  <p className="text-[0.78125rem] text-texto-suave">Sin grupos registrados.</p>
                ) : (
                  <ul className="space-y-2">
                    {sus.map((gr) => (
                      <li key={gr.etiqueta} className="flex items-center gap-3 text-[0.78125rem]">
                        <span className="min-w-0 flex-1 truncate text-texto-suave">
                          {gr.etiqueta}
                          {gr.inicio && (
                            <span className="ml-2 opacity-70">arranca {fecha(gr.inicio)}</span>
                          )}
                        </span>
                        <span className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-superficie-alterna">
                          <span
                            className="block h-full rounded-full bg-marca opacity-70"
                            style={{ width: `${(gr.total / Math.max(1, f.total)) * 100}%` }}
                          />
                        </span>
                        <span className="w-6 shrink-0 text-right font-semibold tabular-nums">
                          {n(gr.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
