/** Cuántas columnas caben, y qué periodo es cada una. */

/**
 * La pieza que decide la DENSIDAD del gráfico por día.
 *
 * Suelta y sin React a propósito: es la única parte del embudo
 * por día que tiene reglas que se pueden equivocar --sumar mal,
 * partir la semana por el día que no es, perder un día-- y así
 * se puede recorrer de 1 a 800 días con un script de node sin
 * levantar el navegador (el frontend no tiene corredor de
 * pruebas, y meter uno es decisión de José).
 *
 * Las cuatro cifras son COHORTES DE ENTRADA: el día es el día en
 * que la persona entró, y los cuatro números dicen en qué paso va
 * hoy esa misma gente. Por eso se pueden sumar entre días sin
 * mentir: cada persona entró UNA vez, así que sumar los siete
 * días de una semana da la gente que entró esa semana y el paso
 * en el que va hoy. Con un dato «en esta fecha había N» esto
 * sería falso; con cohortes, no.
 */

export type DiaDelEmbudo = {
  /** yyyy-mm-dd, ya en el huso de Bogotá desde el servidor. */
  dia: string;
  entraron: number;
  contactados: number;
  conDatos: number;
  inscritos: number;
};

export type Grano = "dia" | "semana" | "mes" | "trimestre";

export type Cubeta = {
  /** Estable entre repintados: sirve de `key` en React. */
  clave: string;
  /** Lo que se escribe bajo el eje: «14 sep», «8–14 sep», «sep». */
  etiqueta: string;
  /** Dicho entero, para el lector de pantalla y el detalle. */
  etiquetaLarga: string;
  /** Cuántos días de calendario trae de verdad. */
  dias: number;
  /**
   * Si cubre menos días de los que le tocan.
   *
   * La primera y la última pueden quedar a medias --el periodo
   * empieza un miércoles, o el mes va por el día 20--, y una
   * columna corta se lee como una caída que no existe. Quien
   * pinta lo avisa; aquí solo se marca.
   */
  parcial: boolean;
  entraron: number;
  contactados: number;
  conDatos: number;
  inscritos: number;
};

/// Red de seguridad: tres años de relleno y se corta.
const TOPE_DE_DIAS = 1100;

const VACIO = { entraron: 0, contactados: 0, conDatos: 0, inscritos: 0 };

/**
 * El día ISO como fecha local A MEDIODÍA.
 *
 * `new Date("2026-09-14")` se lee como UTC y en Bogotá (−05) cae
 * el 13 a las 19:00: un día entero corrido. El mediodía aguanta
 * cualquier huso y cualquier horario de verano.
 */
function aFecha(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function isoDe(f: Date): string {
  const mes = `${f.getMonth() + 1}`.padStart(2, "0");
  const dia = `${f.getDate()}`.padStart(2, "0");
  return `${f.getFullYear()}-${mes}-${dia}`;
}

function sumarDias(iso: string, cuantos: number): string {
  const f = aFecha(iso);
  f.setDate(f.getDate() + cuantos);
  return isoDe(f);
}

function mesCorto(f: Date): string {
  return f.toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
}

/**
 * El día de Bogotá al que pertenece un instante ISO.
 *
 * Los días de la serie vienen ya en el huso de Bogotá desde el
 * servidor, y los bordes de la ventana vienen en UTC con hora.
 * Compararlos sin traducir corría el borde un día: «el mes
 * pasado» empezaba el 31 de julio a las 19:00.
 */
export function diaEnBogota(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  /// `en-CA` da yyyy-mm-dd, que es el mismo formato que el
  /// servidor manda en `dia` y se puede comparar con `<=`.
  return new Date(t).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

/**
 * Los bordes de la ventana, en días de Bogotá.
 *
 * `hasta` viene FUERA --es el primer instante que ya no cuenta--,
 * así que el último día de verdad es el milisegundo anterior.
 */
export function bordesDeVentana(
  ventana: { desde: string; hasta: string } | null | undefined,
): { primero: string; ultimo: string } | null {
  if (!ventana) return null;
  const primero = diaEnBogota(ventana.desde);
  const fin = Date.parse(ventana.hasta);
  if (!primero || Number.isNaN(fin)) return null;
  const ultimo = diaEnBogota(new Date(fin - 1).toISOString());
  if (!ultimo || ultimo < primero) return null;
  return { primero, ultimo };
}

/**
 * Rellena con ceros los días que el servidor no manda.
 *
 * El backend agrupa con `GROUP BY 1` (crm/control.ts): un día en
 * el que no entró nadie NO viene en el arreglo. Sin este relleno
 * el eje pone el 16 al lado del 18 como si fueran seguidos --y
 * miente sobre el ritmo--, y una semana entera sin gente
 * desaparece del gráfico en vez de dibujarse en cero. Un cero es
 * un dato, no un hueco.
 *
 * Con `bordes` el relleno llega hasta los extremos del periodo
 * ELEGIDO y no solo hasta el primer y el último día con gente:
 * con «El mes pasado» el eje empezaba el 7 de agosto --los seis
 * primeros días de agosto no existían ni como cero-- y quien lo
 * leía creía que el mes empezó ahí.
 */
export function rellenarDias(
  dias: DiaDelEmbudo[],
  bordes?: { primero: string; ultimo: string } | null,
): DiaDelEmbudo[] {
  if (dias.length === 0) return [];
  const orden = [...dias].sort((a, b) => a.dia.localeCompare(b.dia));
  const porDia = new Map(orden.map((d) => [d.dia, d]));
  /// Los bordes ENSANCHAN y nunca recortan: si el servidor manda
  /// un día de fuera de la ventana --por un desfase de huso o
  /// por la serie recortada a 60 días--, antes de esconder un
  /// dato se enseña de más.
  const desde =
    bordes && bordes.primero < orden[0].dia ? bordes.primero : orden[0].dia;
  const hastaDato = orden[orden.length - 1].dia;
  const hasta = bordes && bordes.ultimo > hastaDato ? bordes.ultimo : hastaDato;
  const salida: DiaDelEmbudo[] = [];
  let dia = desde;
  while (dia <= hasta && salida.length < TOPE_DE_DIAS) {
    salida.push(porDia.get(dia) ?? { dia, ...VACIO });
    dia = sumarDias(dia, 1);
  }
  return salida;
}

/**
 * A qué cubeta va un día.
 *
 * La semana empieza en LUNES, que es como se cuenta aquí y como
 * lo dice el rótulo del eje. `getDay()` da 0 el domingo, así que
 * el corrimiento es `(getDay() + 6) % 7`.
 */
function claveDeCubeta(iso: string, grano: Grano): string {
  const f = aFecha(iso);
  if (grano === "dia") return iso;
  if (grano === "semana") {
    const lunes = aFecha(iso);
    lunes.setDate(f.getDate() - ((f.getDay() + 6) % 7));
    return isoDe(lunes);
  }
  const mes = grano === "mes" ? f.getMonth() : Math.floor(f.getMonth() / 3) * 3;
  return `${f.getFullYear()}-${`${mes + 1}`.padStart(2, "0")}`;
}

/** Cuántos días trae el periodo entero al que pertenece ese día. */
function diasDelPeriodo(iso: string, grano: Grano): number {
  const f = aFecha(iso);
  if (grano === "dia") return 1;
  if (grano === "semana") return 7;
  const desde = grano === "mes" ? f.getMonth() : Math.floor(f.getMonth() / 3) * 3;
  const meses = grano === "mes" ? 1 : 3;
  /// El día 0 del mes siguiente es el último del anterior.
  const fin = new Date(f.getFullYear(), desde + meses, 0);
  const inicio = new Date(f.getFullYear(), desde, 1);
  return Math.round((fin.getTime() - inicio.getTime()) / 86400000) + 1;
}

function rangoCorto(desde: string, hasta: string): string {
  const a = aFecha(desde);
  const b = aFecha(hasta);
  if (desde === hasta) return `${a.getDate()} ${mesCorto(a)}`;
  return mesCorto(a) === mesCorto(b)
    ? `${a.getDate()}–${b.getDate()} ${mesCorto(b)}`
    : `${a.getDate()} ${mesCorto(a)} – ${b.getDate()} ${mesCorto(b)}`;
}

function rangoLargo(desde: string, hasta: string): string {
  const largo = (iso: string) =>
    aFecha(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long" });
  return desde === hasta ? largo(desde) : `del ${largo(desde)} al ${largo(hasta)}`;
}

/** Agrupa los días --ya rellenos-- al grano que se le pida. */
export function agruparPor(dias: DiaDelEmbudo[], grano: Grano): Cubeta[] {
  const cubetas: Cubeta[] = [];
  let clave: string | null = null;
  let primero = "";
  let ultimo = "";

  for (const d of dias) {
    const suya = claveDeCubeta(d.dia, grano);
    if (suya !== clave) {
      clave = suya;
      primero = d.dia;
      cubetas.push({
        clave: suya,
        etiqueta: "",
        etiquetaLarga: "",
        dias: 0,
        parcial: false,
        ...VACIO,
      });
    }
    ultimo = d.dia;
    const c = cubetas[cubetas.length - 1];
    c.dias += 1;
    c.entraron += d.entraron;
    c.contactados += d.contactados;
    c.conDatos += d.conDatos;
    c.inscritos += d.inscritos;
    /// Se rehacen en cada vuelta porque el último día de la
    /// cubeta solo se conoce cuando ya pasó.
    c.parcial = c.dias < diasDelPeriodo(primero, grano);
    if (grano === "dia") {
      const f = aFecha(d.dia);
      c.etiqueta = `${f.getDate()} ${mesCorto(f)}`;
      c.etiquetaLarga = f.toLocaleDateString("es-CO", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    } else if (grano === "semana") {
      c.etiqueta = rangoCorto(primero, ultimo);
      c.etiquetaLarga = `Semana ${rangoLargo(primero, ultimo)}`;
    } else {
      const f = aFecha(primero);
      const fin = aFecha(ultimo);
      const nombre =
        grano === "mes" ? mesCorto(f) : `${mesCorto(f)}–${mesCorto(fin)}`;
      c.etiqueta = nombre;
      c.etiquetaLarga =
        grano === "mes"
          ? `${f.toLocaleDateString("es-CO", { month: "long", year: "numeric" })}`
          : `Trimestre ${nombre} de ${f.getFullYear()}`;
    }
  }

  /// EL AÑO, solo cuando cambia. Repetido en las doce columnas es
  /// ruido; puesto nunca, «ene» al lado de «dic» no dice si son
  /// el mismo año o el siguiente.
  if (grano === "mes" || grano === "trimestre") {
    let anio: string | null = null;
    for (const c of cubetas) {
      const suyo = c.clave.slice(0, 4);
      if (suyo !== anio) c.etiqueta = `${c.etiqueta} ${suyo}`;
      anio = suyo;
    }
  }

  return cubetas;
}

/// De más fino a más grueso. Se sube un peldaño cada vez que no
/// caben las columnas, nunca al revés.
const ESCALERA: Grano[] = ["dia", "semana", "mes", "trimestre"];

/** El grano más fino que quepa en `maximoColumnas`. */
export function granoQueCabe(dias: DiaDelEmbudo[], maximoColumnas: number): Grano {
  for (const grano of ESCALERA) {
    if (agruparPor(dias, grano).length <= maximoColumnas) return grano;
  }
  return "trimestre";
}

/**
 * El grano del PRIMER pintado, solo con la cantidad de días.
 *
 * Antes de que el `ResizeObserver` mida, no hay ancho. Pintar con
 * un ancho supuesto --el de un celular, por ejemplo-- hace que en
 * un monitor la maquetación salte de semanas a días en cuanto
 * llega la medida. Esto acierta el caso normal y el salto no se
 * ve.
 */
export function granoInicial(cuantosDias: number): Grano {
  if (cuantosDias <= 14) return "dia";
  if (cuantosDias <= 91) return "semana";
  if (cuantosDias <= 800) return "mes";
  return "trimestre";
}

/** Rellenar, elegir grano y agrupar, de una vez. */
export function agruparDias(
  dias: DiaDelEmbudo[],
  maximoColumnas: number,
): { cubetas: Cubeta[]; grano: Grano } {
  const llenos = rellenarDias(dias);
  const grano = granoQueCabe(llenos, maximoColumnas);
  return { cubetas: agruparPor(llenos, grano), grano };
}

/** Qué es una columna, dicho con todas las letras bajo el eje. */
export const QUE_ES_UNA_COLUMNA: Record<Grano, string> = {
  dia: "Una columna por día.",
  semana: "Una columna por semana, de lunes a domingo.",
  mes: "Una columna por mes.",
  trimestre: "Una columna por trimestre.",
};
