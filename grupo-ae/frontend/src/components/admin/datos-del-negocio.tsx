/** Cómo se escribe un dato de un negocio. Igual en todas partes. */

/**
 * El contrato de las piezas de dato, en un solo sitio.
 *
 * La lista, el cajón y —cuando se aplique— el tablero pintan los
 * mismos ocho datos: dinero, porcentaje, fecha, reloj, etapa,
 * cliente, código y la puerta por la que entró. Si una pantalla
 * escribe una fecha distinta que otra, está mal aunque se vea
 * bien: son el mismo dato y quien los lee no está cambiando de
 * producto al cambiar de pestaña.
 *
 * Por eso vive aquí y no dentro de cada pantalla. Tres formatos
 * de fecha en tres pantallas fue exactamente lo que se encontró
 * al revisar las capturas.
 *
 * De `docs/estilo-del-panel.md`: el color va en la LETRA, sin
 * píldoras ni rectángulos; el radio es un token, no una clase; y
 * una sola tipografía, con `tabular-nums` para lo que va en
 * columna.
 */

import type { CSSProperties, ReactNode } from "react";

import { enMomento } from "@/lib/en-fecha";
import type { EtapaOportunidad, TipoEmbudo } from "@/lib/oportunidades-api";

/* ─── Los papeles tipográficos ────────────────────────────────
 *
 * NO se declaran aquí. Los nueve papeles del panel —cifra de
 * portada, cifra de columna, título de pantalla, título de
 * bloque, rótulo, dato, estado, secundario y micro— viven en
 * `globals.css` y se usan por su clase.
 *
 * Escribirlos otra vez en este archivo sería un décimo juego de
 * tamaños que empieza igual al de al lado y termina distinto:
 * es exactamente cómo se llegó a tres «Cifra» y a seis grises
 * conviviendo. Si un caso no encaja en los nueve, el caso está
 * mal resuelto.
 *
 * Solo tres pesos: 400, 600 y 700. Y el 600 está RESERVADO al
 * estado —la etapa, el reloj vencido, el resultado de algo—. Si
 * algo tiene que destacar y no es un estado, destaca por tamaño
 * o por color, nunca por peso.
 */

/* ─── Vacío ───────────────────────────────────────────────── */

/**
 * Lo que no hay se escribe con una raya y se calla.
 *
 * Nunca «Sin valor», nunca «Vacía», nunca «Sin dueño» en rojo,
 * nunca `$ 0`. En el tablero, «Sin valor» en negrita de 20 px
 * hacía que la ficha más pobre fuera la más ruidosa de la
 * pantalla: la ausencia de plata pesaba más que la plata.
 *
 * La única ausencia que sí grita es el reloj sin contestar, y
 * esa la pinta `Reloj`.
 */
export function Vacio() {
  return <span className="text-texto-suave">—</span>;
}

/* ─── Dinero ──────────────────────────────────────────────── */

const MILES = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

/// Espacio fino (U+2009). Separa el signo de los dígitos y el
/// número del `%` sin abrir el hueco de un espacio normal: en una
/// columna de cifras ese hueco se lee como una sangría.
const ESPACIO_FINO = " ";

/**
 * `$ 46.500.000`. Siempre a la derecha, siempre tabular, nunca
 * con decimales.
 *
 * El signo va más pequeño y en gris, separado por un espacio
 * fino: en una columna de doce cifras el peso se repite doce
 * veces y lo que hay que leer son los dígitos. Apagándolo, la
 * columna se lee por la cantidad.
 *
 * `portada` es la cifra que manda en la pantalla —34 px—, y solo
 * puede haber una. Nunca un conteo, nunca un porcentaje: es lo
 * que separa el panel de una empresa que vende del panel de
 * administración de cualquier cosa.
 */
export function Dinero({
  valor,
  portada,
  tamano,
  ganado,
  supuesto,
}: {
  valor: number | null | undefined;
  /** Atajo de `tamano="portada"`. */
  portada?: boolean;
  /**
   * Los tres escalones en que se escribe una plata, y no hay un
   * cuarto: el dato de una fila (13), la cifra que manda en una
   * columna o en una ficha del tablero (20) y la única cifra de
   * portada de la pantalla (34), que siempre es dinero.
   */
  tamano?: "dato" | "columna" | "portada";
  /** El único verde: lo que ya se cobró. */
  ganado?: boolean;
  /**
   * Una plata que sale de un cálculo y no de un compromiso: el
   * esperado del embudo, que es la suma de cada negocio por su
   * probabilidad. Va apagada, con la misma regla que el
   * porcentaje —**el gris significa «esto es un supuesto»**—,
   * para que se sepa qué cifra se puede llevar a una reunión sin
   * leer la nota al pie.
   */
  supuesto?: boolean;
}) {
  if (valor === null || valor === undefined || valor <= 0) return <Vacio />;

  const escalon = portada ? "portada" : (tamano ?? "dato");
  const porTamano = {
    dato: "",
    columna: " cifra-columna",
    portada: " block cifra-portada",
  }[escalon];

  return (
    <span
      className={
        "tabular-nums whitespace-nowrap" +
        porTamano +
        (ganado ? " text-exito" : "") +
        (supuesto ? " text-texto-suave" : "")
      }
    >
      <span className="text-texto-suave" style={{ fontSize: "0.85em" }}>
        $
      </span>
      {ESPACIO_FINO}
      {MILES.format(valor)}
    </span>
  );
}

/* ─── Porcentaje ──────────────────────────────────────────── */

/**
 * `30 %`, con espacio fino, tabular y a la derecha.
 *
 * Y una regla que es de este producto: **el gris significa
 * «esto es un supuesto»**. Una probabilidad que sale de la forma
 * del embudo va apagada; una que alguien puso mirando el negocio
 * va en el color del texto. Así se sabe qué número se puede
 * llevar a una reunión sin tener que leer la nota al pie.
 */
export function Porcentaje({
  valor,
  supuesto,
  tamano = "dato",
}: {
  valor: number | null | undefined;
  supuesto?: boolean;
  /** `micro` para el pie de una columna del tablero. */
  tamano?: "dato" | "micro" | "columna";
}) {
  if (valor === null || valor === undefined) return <Vacio />;

  const porTamano = { dato: "", micro: " micro", columna: " cifra-columna" }[
    tamano
  ];

  return (
    <span
      className={
        "tabular-nums whitespace-nowrap" +
        porTamano +
        (supuesto ? " text-texto-suave" : "")
      }
    >
      {valor}
      {ESPACIO_FINO}%
    </span>
  );
}

/* ─── Fecha ───────────────────────────────────────────────── */

/**
 * `9 sep 2026`, y `hoy 21:55` / `ayer 21:55` cuando el dato es
 * de las últimas horas.
 *
 * El formato no se escribe aquí: está en `lib/en-fecha`, porque
 * lo necesitan también los sitios donde la fecha va DENTRO de
 * una frase —«Creada el …», «lanzada el …»—, y con una copia en
 * cada sitio la frase y la columna acabarían diciéndolo
 * distinto. Aquí solo se le pone la caja: tabular, para que la
 * columna cuadre, y sin partirse en dos renglones.
 */
export function Fecha({ iso }: { iso: string | null | undefined }) {
  if (!iso) return <Vacio />;
  const texto = enMomento(iso);
  if (texto === "—") return <Vacio />;
  return <span className="tabular-nums whitespace-nowrap">{texto}</span>;
}

/* ─── Reloj ───────────────────────────────────────────────── */

/**
 * Lo que alguien lleva esperando, y el único sitio del panel
 * donde se permite un color caliente.
 *
 * `--aviso` y `--error` están prohibidos en todo lo demás: ni una
 * etapa, ni un botón, ni un borde, ni un icono. La consecuencia
 * es la que importa — un asesor abre el panel y, sin leer una
 * palabra, sabe si alguien está esperando. Pantalla fría: nadie
 * espera. Una mancha cálida: hay que ir ahí.
 *
 * El umbral no es el mismo en los dos embudos y no puede serlo:
 * quien pregunta por WhatsApp por un curso de 780 mil y no tiene
 * respuesta en cinco minutos ya se matriculó en otro instituto;
 * una propuesta de 46 millones aguanta el día.
 */
const UMBRAL_EN_MINUTOS: Record<TipoEmbudo, number> = {
  PERSONA: 5,
  EMPRESA: 24 * 60,
};

/**
 * Si esta espera ya se pasó de su umbral.
 *
 * Para decidir si el reloj SE ENSEÑA. En una ficha, un reloj que
 * dice «4 min» sobre algo que se contestó a tiempo es un dato que
 * nadie va a mirar; el hueco vacío ya dice que ahí no pasa nada.
 */
export function esperaVencida(
  minutos: number | null | undefined,
  embudo: TipoEmbudo,
): boolean {
  if (minutos === null || minutos === undefined) return true;
  return minutos > UMBRAL_EN_MINUTOS[embudo];
}

/** `4 min`, `13 h`, `11 d`. Una sola unidad, siempre la mayor. */
export function relojEnTexto(minutos: number): string {
  if (minutos < 60) return `${Math.max(0, Math.round(minutos))} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h`;
  return `${Math.floor(horas / 24)} d`;
}

export function Reloj({
  minutos,
  embudo,
  umbral,
  vencido,
}: {
  minutos: number | null | undefined;
  /** El umbral sale del embudo: cinco minutos o veinticuatro horas. */
  embudo?: TipoEmbudo;
  /**
   * Un umbral propio, en minutos, cuando lo que se mide no es la
   * primera respuesta: un negocio que lleva días quieto tiene su
   * propia paciencia y no la del embudo.
   */
  umbral?: number;
  /** Sin primera respuesta: eso no es «tarde», es una alarma. */
  vencido?: boolean;
}) {
  /// La única ausencia del panel que sí es una alarma.
  if (minutos === null || minutos === undefined) {
    return (
      <span className="estado text-error whitespace-nowrap">Sin contestar</span>
    );
  }

  const tope = umbral ?? (embudo ? UMBRAL_EN_MINUTOS[embudo] : Infinity);
  const pasado = minutos > tope;

  /// Sin peso extra: el 600 es el peso del estado y un reloj no
  /// es un estado. La señal la lleva entera el color, que además
  /// es lo único caliente que existe en el panel.
  return (
    <span
      className={
        "tabular-nums whitespace-nowrap" +
        (pasado ? (vencido ? " text-error" : " text-aviso") : "")
      }
    >
      {relojEnTexto(minutos)}
    </span>
  );
}

/* ─── Etapa ───────────────────────────────────────────────── */

/**
 * El token de color que se edita desde Apariencia.
 *
 * Las siete etapas del CRM se apoyan en los tokens que ya existen
 * en el catálogo: no se inventa un color en el componente, y quien
 * quiera cambiar la rampa la cambia desde el panel.
 *
 * La rampa que toca es de gris a azul profundo —cuanto más
 * oscuro, más cerca del dinero—, con el verde reservado a Ganado y
 * Perdido apagándose en vez de encendiéndose: en un embudo sano se
 * pierden dos de cada tres negocios, y cuarenta filas rojas dicen
 * que todo está mal cuando todo está normal.
 */
const VARIABLE_DE_ETAPA: Record<EtapaOportunidad, string> = {
  CAPTADO: "--etapa-interesado",
  CONTACTADO: "--etapa-contactado",
  CALIFICADO: "--etapa-datos-completos",
  PROPUESTA_ENVIADA: "--etapa-inscrito",
  EN_NEGOCIACION: "--etapa-en-formacion",
  GANADO: "--etapa-certificado",
  PERDIDO: "--etapa-perdido",
};

export function colorDeEtapa(etapa: EtapaOportunidad): string {
  return `var(${VARIABLE_DE_ETAPA[etapa]})`;
}

/**
 * Punto del color de la etapa, un espacio, y el rótulo del mismo
 * color a peso 600. Sin caja, sin fondo, sin borde.
 *
 * Usa `.pildora-etapa` y `.punto-etapa`, que ya son del panel: la
 * forma la manda el CSS y el color lo manda el token. Ya no es una
 * píldora pese al nombre de la clase.
 */
export function Etapa({
  etapa,
  rotulo,
}: {
  etapa: EtapaOportunidad;
  rotulo: string;
}) {
  return (
    <span
      className="pildora-etapa"
      style={{ ["--etapa"]: colorDeEtapa(etapa) } as CSSProperties}
    >
      <span className="punto-etapa" aria-hidden />
      {rotulo}
    </span>
  );
}

/* ─── Cliente ─────────────────────────────────────────────── */

/**
 * El sufijo societario, apagado.
 *
 * S.A., S.A.S. y Ltda. son obligación legal colombiana, no
 * identidad, y en una columna de cuarenta razones sociales es lo
 * único que se repite en todas. Apagándolo, la columna pasa a
 * leerse por el nombre, que es lo que se busca.
 */
const SUFIJO_SOCIETARIO =
  /\s+(S\.A\.S\.?|S\.A\.?|S\.?\s?en\s?C\.?(\s?S\.?)?|Ltda\.?|E\.U\.?|S\.C\.A\.?|BIC)$/i;

export function Cliente({ nombre }: { nombre: string | null | undefined }) {
  if (!nombre) return <Vacio />;

  const sufijo = SUFIJO_SOCIETARIO.exec(nombre);
  if (!sufijo) return <>{nombre}</>;

  return (
    <>
      {nombre.slice(0, sufijo.index)}
      <span className="text-texto-suave">{sufijo[0]}</span>
    </>
  );
}

/* ─── Código ──────────────────────────────────────────────── */

/** `OP-DEMO-003`: una llave para buscar y para pegar, no un dato. */
export function Codigo({
  codigo,
  children,
}: {
  codigo?: string;
  children?: ReactNode;
}) {
  return (
    <span className="micro tabular-nums whitespace-nowrap">
      {codigo ?? children}
    </span>
  );
}

/* ─── Persona ─────────────────────────────────────────────── */

/**
 * El nombre de una persona: tal cual se escribió.
 *
 * Ni versalita, ni mayúsculas forzadas, ni el color de nadie —un
 * nombre no es un estado—. Y entero: el dueño de un negocio se
 * escribe con nombre y primer apellido, «Lucía Parra» y nunca
 * solo «Lucía», que es lo que pasa cuando cada pantalla decide
 * por su cuenta cuánto enseñar.
 *
 * En una línea y recortado por el final si no cabe. Un nombre que
 * se parte en dos renglones multiplica el alto de la fila para
 * ganar un apellido que se lee igual en el cajón.
 */
export function Persona({
  nombre,
  micro,
}: {
  nombre: string | null | undefined;
  /** Para el dueño al pie de una ficha del tablero. */
  micro?: boolean;
}) {
  if (!nombre?.trim()) return <Vacio />;

  return (
    <span
      className={"block truncate" + (micro ? " micro" : "")}
      title={nombre}
    >
      {nombre}
    </span>
  );
}

/* ─── Estado ──────────────────────────────────────────────── */

/**
 * El estado de lo que no es un negocio del embudo.
 *
 * Publicado, Vigente, Borrador, Pausada, Terminada. Misma forma
 * que `Etapa` —punto de 6 px, 6 px de aire y el rótulo del mismo
 * color a peso 600— porque son la misma clase de dato: si el
 * estado de una campaña se pintara distinto que la etapa de un
 * negocio, las quince pantallas volverían a leerse como dos
 * productos.
 *
 * Estaba escrito a mano en Formularios, en Campañas y en Habeas
 * Data, con el tamaño y el peso puestos en un `style` en cada
 * sitio: tres copias de una decisión que es una sola.
 */
const COLOR_DE_TONO = {
  /** Publicado, vigente, terminado: el único verde. */
  exito: "var(--exito)",
  /** Esperando a alguien. Lo único cálido que existe en el panel. */
  espera: "var(--aviso)",
  /** En marcha, sin nada que reclamar. */
  activo: "var(--texto)",
  /** Todavía no es nada: borrador, sin publicar, apagado. */
  apagado: "var(--texto-suave)",
} as const;

export type TonoDeEstado = keyof typeof COLOR_DE_TONO;

export function Estado({
  tono,
  children,
}: {
  tono: TonoDeEstado;
  children: ReactNode;
}) {
  return (
    <span
      className="pildora-etapa"
      style={{ ["--etapa"]: COLOR_DE_TONO[tono] } as CSSProperties}
    >
      <span className="punto-etapa" aria-hidden />
      {children}
    </span>
  );
}

/* ─── La puerta ───────────────────────────────────────────── */

/**
 * Por dónde entró el negocio.
 *
 * Un formulario publicado ES una campaña, y que la puerta se vea
 * en la tabla, en la ficha y en el cajón es lo que hace que «de
 * dónde vienen» no parezca un informe aparte.
 *
 * Se apaga todo lo que va delante del último separador y se deja
 * en el color del texto lo que viene detrás. «empresas/Meta ·
 * Seguridad industrial» se lee por «Seguridad industrial»;
 * «empresas/Referido», por «Referido».
 *
 * Es el mismo criterio del sufijo societario: en una columna de
 * cuarenta puertas, el embudo y el canal se repiten en todas y lo
 * que distingue una fila de otra es la cola. Apagando lo que se
 * repite, la columna se lee por lo que la diferencia. No se
 * reordena nada ni se quita una palabra: el texto sale tal cual
 * llegó.
 *
 * Los dos separadores porque los dos existen en el dato: el `/`
 * separa el embudo del canal y el `·` el canal del tema. Buscar
 * solo uno dejaba media columna sin apagar.
 */
export function Puerta({ campana }: { campana: string | null | undefined }) {
  if (!campana) return <Vacio />;

  const corte = Math.max(campana.lastIndexOf("·"), campana.lastIndexOf("/"));
  if (corte < 0) return <>{campana}</>;

  return (
    <>
      <span className="text-texto-suave">{campana.slice(0, corte + 1)}</span>
      {campana.slice(corte + 1)}
    </>
  );
}

/* ─── Rótulo ──────────────────────────────────────────────── */

/** Lo que nombra un dato o un bloque. Versalita de 10 px. */
export function Rotulo({
  children,
  titulo,
}: {
  children: ReactNode;
  /**
   * Cuando el rótulo ABRE un bloque, y no solo nombra un dato.
   *
   * Entonces es un encabezado de verdad y sale como `h2`. Sin
   * esto es un `span`, que es lo correcto para el rótulo de una
   * cifra: cuatro cifras en fila no son cuatro secciones, y con
   * cuatro encabezados quien navega con lector de pantalla se
   * encuentra un índice de cuatro apartados donde solo hay una
   * franja de indicadores.
   */
  titulo?: boolean;
}) {
  return titulo ? (
    <h2 className="rotulo-bloque">{children}</h2>
  ) : (
    <span className="rotulo-bloque block">{children}</span>
  );
}
