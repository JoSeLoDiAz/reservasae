/** Piezas visuales que repiten todas las pantallas. */

import Link from "next/link";

import type { Icono } from "./iconos";

export type Tono = "marca" | "exito" | "aviso" | "error" | "neutro";

const VARIABLE: Record<Tono, string> = {
  marca: "var(--marca)",
  exito: "var(--exito)",
  aviso: "var(--aviso)",
  error: "var(--error)",
  neutro: "var(--texto-suave)",
};

/**
 * Una cifra suelta dentro de un bloque.
 *
 * Era una tarjeta con borde, radio y sombra al pasar por
 * encima -- la unica cosa del panel que flotaba --. Ahora no
 * es una caja: es un rotulo en versalita con su cifra debajo,
 * separada de la siguiente por aire y nada mas.
 *
 * De las tres «Cifra» que convivian --esta, `TarjetaCifra` y
 * una local en el Resumen-- solo pueden quedar las dos formas
 * de la direccion: la cifra de portada (34) y la cifra de
 * columna (20).
 */
export function Cifra({
  etiqueta,
  valor,
  pie,
  color = "var(--titulo)",
}: {
  etiqueta: string;
  valor: number | string;
  pie?: string | null;
  color?: string;
}) {
  return (
    <div className="min-w-[140px] flex-1">
      <p className="rotulo-bloque truncate" title={etiqueta}>
        {etiqueta}
      </p>
      <p className="cifra-columna mt-1" style={{ color }}>
        {valor}
      </p>
      {pie && <p className="secundario mt-1 truncate">{pie}</p>}
    </div>
  );
}

/**
 * Un bloque de contenido: una BANDA.
 *
 * Convivian tres sistemas de contenedor -- bandas a sangre con
 * regla, cajas con borde y cabecera tenida de `--marca-suave`,
 * y contenido suelto sobre el fondo -- y el marco cambiaba
 * segun en que pantalla se estuviera. Eso solo puede leerse
 * como dos productos pegados.
 *
 * Queda uno. Fondo de superficie, sin borde alrededor, sin
 * radio, y una regla de 1 px abajo que lo separa del
 * siguiente. Las bandas SE TOCAN: el aire se gana quitando
 * alto muerto, no metiendo bloques.
 *
 * Y el titulo va en versalita, no en una franja azul clara. La
 * franja estaba en nueve de las quince pantallas y a veces
 * cinco veces en la misma, y con cinco franjas azules ninguna
 * es la importante. `--marca-suave` vuelve a sus dos unicos
 * sitios: la entrada activa de la barra lateral y la fila de
 * tabla bajo el raton.
 */
export function Bloque({
  titulo,
  descripcion,
  acciones,
  sinRelleno,
  estirado,
  partible,
  plano,
  plegable,
  children,
}: {
  titulo?: string;
  descripcion?: React.ReactNode;
  /** Botones a la derecha del título. */
  acciones?: React.ReactNode;
  /** Para tablas, que traen su propio relleno. */
  sinRelleno?: boolean;
  /** Que ocupe todo el alto: dos bloques de una fila miden igual. */
  estirado?: boolean;
  /**
   * Que pueda partirse entre hojas al imprimir.
   *
   * Por omisión un bloque NO se parte: se muda entero a la hoja
   * siguiente. Eso está bien para los cortos y es justo lo que
   * deja media página en blanco cuando el bloque es una tabla de
   * catorce filas. Los largos se marcan aquí, y entonces parten
   * por fila, con su cabecera repetida.
   */
  partible?: boolean;
  /**
   * Sin banda: un corte DENTRO de otra banda.
   *
   * Veinte cortes eran veinte bordes y veinte franjas de color,
   * y eso se lee como veinte pantallas pegadas en vez de como
   * un informe. Los que responden a la misma pregunta van
   * dentro de una sola banda, cada uno con su rótulo.
   */
  plano?: boolean;
  /**
   * Que nazca cerrado, con el título como puerta.
   *
   * Para los cortes de CONSULTA: los que se miran cuando se
   * busca un número concreto y no para decidir nada. Abiertos
   * ocupan media pantalla y son lo primero que se lee como
   * ruido.
   */
  plegable?: boolean;
  children: React.ReactNode;
}) {
  const conCabecera = Boolean(titulo || acciones);

  if (plegable) {
    return (
      <details className="banda bloque-entero group">
        <summary className="sin-aro cabecera-de-bloque flex cursor-pointer list-none items-start justify-between gap-4 select-none">
          <div className="min-w-0">
            {titulo && <h2 className="rotulo-bloque">{titulo}</h2>}
            {descripcion && (
              <p className="secundario prosa mt-1">{descripcion}</p>
            )}
          </div>
          <span className="dato shrink-0 text-marca">
            <span className="group-open:hidden">Ver</span>
            <span className="hidden group-open:inline">Ocultar</span>
          </span>
        </summary>
        <div className="mt-3">{children}</div>
      </details>
    );
  }

  if (plano) {
    return (
      <section className={estirado ? "flex h-full flex-col" : undefined}>
        {titulo && <h3 className="rotulo-bloque">{titulo}</h3>}
        {descripcion && <p className="secundario prosa mt-1">{descripcion}</p>}
        <div className={estirado ? "mt-3 min-h-0 grow" : "mt-3"}>{children}</div>
      </section>
    );
  }

  return (
    <section
      className={
        (sinRelleno ? "banda banda-sin-relleno " : "banda ") +
        (partible ? "bloque-partible " : "bloque-entero ") +
        (estirado ? "bloque-estirado flex h-full flex-col" : "")
      }
    >
      {conCabecera && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            {titulo && <h2 className="rotulo-bloque">{titulo}</h2>}
            {descripcion && (
              <p className="secundario prosa mt-1">{descripcion}</p>
            )}
          </div>
          {acciones}
        </div>
      )}
      <div className={(conCabecera ? "mt-3" : "") + (estirado ? " min-h-0 grow" : "")}>
        {children}
      </div>
    </section>
  );
}

export function TarjetaCifra({
  etiqueta,
  valor,
  pie,
  tono = "marca",
  href,
  compacta,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  pie?: React.ReactNode;
  /// Se acepta y NO se pinta: con ocho indicadores en fila,
  /// ocho cuadros de color pesaban mas que las propias cifras.
  icono?: Icono;
  tono?: Tono;
  href?: string;
  /// Menos alta, para pantallas donde la cifra acompaña y lo
  /// que se viene a mirar es la lista de abajo.
  compacta?: boolean;
}) {
  const cuerpo = (
    <>
      <p className="rotulo-bloque">{etiqueta}</p>
      <p
        className={compacta ? "cifra-columna mt-1" : "cifra-portada mt-2"}
        style={tono === "marca" ? undefined : { color: VARIABLE[tono] }}
      >
        {valor}
      </p>
      {pie && <p className="secundario mt-1">{pie}</p>}
    </>
  );

  const clase =
    (compacta ? "bg-superficie px-6 pt-3 pb-4" : "bg-superficie px-6 pt-4 pb-6") +
    (href ? " block no-underline transition hover:bg-tabla-fila-resaltada" : "");

  return href ? (
    <Link href={href} className={clase}>
      {cuerpo}
    </Link>
  ) : (
    <div className={clase}>{cuerpo}</div>
  );
}

/**
 * Estado: el color va en la LETRA y el peso es 600.
 *
 * Era una pildora con fondo tenido y radio completo. En una
 * tabla de cuarenta filas, cuarenta rectangulos de color
 * compiten con los datos en vez de ordenarlos.
 *
 * El 600 esta RESERVADO para esto y para nada mas: ver un 600
 * en cualquier pantalla significa «esto es la etapa o el
 * resultado de algo». Y lleva SIEMPRE texto: el color
 * acompana, nunca es lo unico que distingue -- en papel y en
 * daltonismo el color no llega.
 */
export function Pildora({
  tono = "neutro",
  children,
}: {
  tono?: Tono;
  children: React.ReactNode;
}) {
  const clases: Record<Tono, string> = {
    marca: "text-marca",
    exito: "text-exito",
    aviso: "text-aviso",
    error: "text-error",
    neutro: "text-texto-suave",
  };

  return (
    <span
      className={`estado inline-flex items-center gap-1.5 whitespace-nowrap ${clases[tono]}`}
    >
      {children}
    </span>
  );
}

/**
 * Encabezado de pantalla: título, apoyo y acciones.
 *
 * Es la primera banda de la pantalla y la unica que lleva
 * regla de 2 px: 2 px significa «aqui empieza algo» y 1 px
 * «aqui se separan dos cosas». No hay un tercer grosor, y esa
 * es la regla que sale del signo de la casa -- un arco que
 * empieza y termina.
 */
export function Encabezado({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="banda banda-titulo flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="titulo-pantalla">{titulo}</h1>
        {descripcion && <p className="secundario prosa mt-1.5">{descripcion}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </header>
  );
}

/**
 * Cuando no hay nada que mostrar, decir por qué.
 *
 * Sin caja de rayas, sin circulo de icono y sin 500 px de alto
 * reservados para escribir «Vacia». El vacio se escribe con
 * una raya y una linea de apoyo, y no pesa mas que los datos
 * que si estan.
 */
export function Vacio({
  titulo,
  children,
  icono,
}: {
  titulo: string;
  children?: React.ReactNode;
  /// Se acepta y NO se pinta: un icono existe solo si es el
  /// unico contenido de un boton.
  icono?: Icono;
}) {
  void icono;
  return (
    <div className="py-8">
      <p className="dato">
        <span aria-hidden className="mr-2 text-texto-suave">
          —
        </span>
        {titulo}
      </p>
      {children && <p className="secundario prosa mt-1">{children}</p>}
    </div>
  );
}

/** El botón que no es la acción principal. */
export function BotonSuave({
  children,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...resto}
      /// Apagado se dice con los tokens, no con `opacity`: el
      /// gris no se improvisa con opacidad, que es literalmente
      /// la causa de que todo se viera lavado.
      className={`dato rounded-plano border-borde bg-superficie hover:bg-superficie-alterna disabled:border-hairline disabled:text-texto-suave inline-flex h-[32px] items-center justify-center gap-2 border px-[13px] transition disabled:cursor-not-allowed disabled:hover:bg-superficie ${resto.className ?? ""}`}
    >
      {children}
    </button>
  );
}

/**
 * La pantalla entera mientras llegan los datos.
 *
 * Un «Cargando…» suelto y pegado al canto de arriba a la
 * izquierda no se lee como «espere»: se lee como que la
 * pantalla se rompió y eso es lo único que quedó. Centrado en
 * el hueco que va a ocupar el contenido dice lo que pasa, y de
 * paso el ojo ya está donde va a aparecer la cosa.
 *
 * El círculo que gira es de las poquísimas cosas que llevan
 * `rounded-full` con permiso: es de verdad redondo. Y es una
 * de las dos animaciones del producto.
 */
export function Cargando({ que = "Cargando…" }: { que?: string }) {
  return (
    <div className="flex min-h-0 grow flex-col items-center justify-center gap-3 px-4 py-20">
      <span
        aria-hidden
        className="border-borde border-t-texto-suave h-6 w-6 animate-spin rounded-full border-2"
      />
      <p role="status" className="secundario">
        {que}
      </p>
    </div>
  );
}

/**
 * La forma de lo que va a venir, en gris.
 *
 * El gris es `--superficie-alterna` y no `bg-current/10`: el
 * gris no se improvisa con opacidad, que es literalmente la
 * causa de que todo se viera lavado.
 */
export function Esqueleto({
  filas = 3,
  conCifras = false,
}: {
  filas?: number;
  conCifras?: boolean;
}) {
  return (
    <div aria-hidden>
      <span className="sr-only" aria-live="polite">
        Cargando la información
      </span>

      {conCifras && (
        <div className="banda grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <div className="bg-superficie-alterna h-3 w-24 animate-pulse" />
              <div className="bg-superficie-alterna mt-3 h-8 w-28 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      <div className="banda">
        <div className="bg-superficie-alterna h-3 w-40 animate-pulse" />
        <div className="mt-4">
          {Array.from({ length: filas }, (_, i) => (
            <div
              key={i}
              className="border-hairline flex items-center gap-3 border-b py-[var(--pad-fila)]"
            >
              <div className="bg-superficie-alterna h-3 grow animate-pulse" />
              <div className="bg-superficie-alterna h-3 w-16 shrink-0 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
