"use client";

/** La cabecera del panel en dos filas: marca arriba, navegación debajo. */

/**
 * EL ARMAZÓN QUE PIDIÓ EL CLIENTE el 12 sep 2026, con su montaje
 * de diseño: «quiero dejarlo de esta manera, se ve mil veces más
 * profesional». Sustituye la barra lateral por dos filas:
 *
 *   Fila 1 — la marca de Convoca a la izquierda y el crédito de
 *            aliados a la derecha: «GESTIONADO POR [AE] PARA
 *            [ADECOPRIA]».
 *   Fila 2 — los módulos en horizontal, con desplegable el que
 *            tiene más de una pantalla, y a la derecha quién está
 *            dentro, con su menú.
 *
 * CABE, y está medido antes de escribir una línea: con nuestros
 * nombres reales de módulo y NUESTRA letra (Raleway), la fila de
 * navegación mide 966 px. Sobran 775 px a 1920, 221 a 1366 y 135
 * a 1280. El mock acortaba los nombres --«Inscripciones» por
 * «Gestión de Inscripciones»-- y así medía 733; con los de verdad
 * son 966 y siguen entrando.
 *
 * DE SU DISEÑO SE CONSERVA LA ESTRUCTURA Y NO LA PIEL, y conviene
 * dejar dicho por qué, porque son cuatro decisiones que ya están
 * escritas en esta casa y que el handoff revoca sin saberlo:
 *
 * - **La letra.** Pide Poppins y Inter. `globals.css` guarda el
 *   acta de que un handoff anterior pidió Sora y Public Sans, se
 *   llegaron a cargar, y la decisión fue que «la tipografía no es
 *   una decisión de pantalla». Se conservan sus tamaños, pesos y
 *   espaciados; la letra es la nuestra.
 * - **El color.** Clava `#0f766e`, `#0b5c53`, `#0a4f47`. Aquí no
 *   hay un hexadecimal: van los tokens del encabezado, que cada
 *   gremio edita en Apariencia y que el backend valida. Un
 *   hexadecimal a mano rompe las dieciséis plantillas.
 * - **El contraste.** Usa blanco al .42, .55, .6 y .62 sobre el
 *   teal, a 9 y 10 px. Cuatro de esas cinco incumplen: medido
 *   sobre el color MEZCLADO, el 55 % da 3,62:1 y el 70 % da
 *   4,85:1. Nada de este fichero baja del 70 %.
 * - **El punto verde de «en línea».** No se porta. `AdminActual`
 *   trae `ultimoAcceso` y `activo`, pero nada de presencia: un
 *   punto verde fijo afirmaría «está conectada» también cuando el
 *   sistema no lo sabe. Dentro del menú se dice el último acceso,
 *   que sí es un dato.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { FirmaConvoca } from "@/components/firma-convoca";
import {
  comoSePresenta,
  MAXIMO_LOGOS,
  urlLogo,
  type AdminActual,
  type Area,
  type Nivel,
} from "@/lib/admin-api";
import { useMarca } from "@/components/marca-publica";

import { IconoMenu, IconoSalir } from "./iconos";
import { enlacesVisibles, estaActivo, MODULOS } from "./navegacion";

type Permisos = Record<Area, Nivel> | undefined;

/**
 * Los rotulitos en versalitas: «Gestionado por», «para»,
 * «Gremio», y los del cajón móvil.
 *
 * VIVE AQUÍ Y NO EN `marco-admin`, y no es capricho de orden: el
 * marco importa esta cabecera, así que si la constante viviera
 * allí tendríamos un ciclo de importación entre los dos ficheros.
 * Un ciclo con una constante de módulo no suele estallar, hace
 * algo peor: según cuál se inicialice primero, uno de los dos lee
 * `undefined` y los rótulos salen sin clase. La dependencia va en
 * un solo sentido.
 *
 * EL 10 px ES EL DEL CRITERIO Y NO SE TOCA: lo que estaba mal era
 * la opacidad. Blanco al 55 % mezclado con el verde del
 * encabezado da 3,62:1 y el mínimo es 4,5; al 70 % da 4,85:1. Sin
 * mezclar la opacidad la cuenta daría 14,3:1 y el fallo pasaría
 * por bueno. El peso y el espaciado suben con ella —600 y .1em—
 * porque a 10 px lo que hace legible una versalita es el trazo.
 *
 * El handoff los especifica al .62 y al .42; no llegan, y se usa
 * esta cuenta y no la del diseño.
 *
 * OJO AL MARGEN: 4,85:1 está medido con el #025a53 de ADECOPRIA,
 * y cada gremio edita `--encabezado-fondo` desde Apariencia. El
 * arreglo de fondo es meter el par en `COMPROBACIONES_CONTRASTE`
 * del backend.
 */
export const ROTULO =
  "text-[0.625rem] font-semibold tracking-[0.1em] uppercase opacity-70";

/**
 * ¿El encabezado es OSCURO ahora mismo?
 *
 * Hace falta para elegir la variante de cada logo, y no se puede
 * deducir del tema. En el acceso sí: allí el fondo es `--marca` y
 * basta invertir --claro pide la variante de fondo oscuro--. Aquí
 * no, porque `--encabezado-fondo` vale **blanco por defecto** y
 * el backend lo iguala a la superficie cuando el gremio no pide
 * cabecera de color. O sea que en tema CLARO este fondo puede ser
 * blanco o verde oscuro según lo que haya elegido cada gremio, y
 * la variante de letra blanca desaparecería en el primer caso.
 * Eso es justo lo que la placa blanca tapaba.
 *
 * Se mide la luminancia del color resuelto. Se hace en un efecto
 * y no al pintar porque en el servidor no hay `getComputedStyle`;
 * hasta que llega se supone claro, que es el valor por defecto del
 * token y el caso en que equivocarse cuesta menos --sobre blanco,
 * la variante de letra oscura se ve igual--.
 */
function useFondoDelEncabezadoOscuro(): boolean {
  const [oscuro, setOscuro] = useState(false);
  /// El tema entra en las dependencias porque al conmutarlo
  /// cambia el valor del token, no la clase de este nodo.
  const { esquema, marca } = useMarca();

  useEffect(() => {
    const css = getComputedStyle(document.documentElement)
      .getPropertyValue("--encabezado-fondo")
      .trim();
    const n = css.replace("#", "");
    if (n.length < 6) return;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
    const lineal = (c: number) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const luz = 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);
    /// 0,35 y no 0,5: el umbral de «sobre esto se lee mejor en
    /// blanco» cae por debajo del medio, porque el ojo no reparte
    /// el contraste a partes iguales.
    setOscuro(luz < 0.35);
  }, [esquema, marca]);

  return oscuro;
}

/**
 * La variante de cada logo que se ve SOBRE ESTE FONDO.
 *
 * Cada logo dice en qué tema sale (`AMBOS`, `CLARO`, `OSCURO`):
 * son archivos cerrados hechos para papel, y el de ADECOPRIA
 * viene con el nombre en negro y otro con el nombre en blanco. No
 * se pueden recolorear como el signo de Convoca, que va en
 * `currentColor`.
 *
 * `OSCURO` quiere decir «la versión para fondo oscuro», así que
 * sobre un encabezado oscuro va esa, y sobre uno claro la `CLARO`.
 * `AMBOS` sale siempre: es un logo sin texto, o con un texto de un
 * color que aguanta los dos fondos.
 */
/// Genérica a propósito: filtra sin tocar el tipo que le pasan.
/// Declarada como `Array<{esquema: string}>` devolvía un tipo que
/// había perdido `id` y `version`, y justo después hay un
/// `urlLogo(l)` que los necesita.
function variantesParaElFondo<T extends { esquema: string }>(
  logos: T[],
  fondoOscuro: boolean,
): T[] {
  const cual = fondoOscuro ? "OSCURO" : "CLARO";
  return logos.filter((l) => l.esquema === "AMBOS" || l.esquema === cual);
}

/// Qué menú está abierto. NO es `null | 'ins' | 'user'` como en el
/// prototipo: allí solo un módulo tenía desplegable, y aquí cinco
/// de los siete tienen más de una pantalla. Así que es la clave
/// del módulo, o `'usuario'`.
///
/// Y ARRANCA CERRADO. El acordeón de la barra lateral arrancaba
/// abierto en el módulo de la ruta, que allí era correcto --era
/// una columna--; portado aquí abriría un menú flotante encima
/// del contenido en cada carga de página.
type Abierto = string | null;

// ---------------------------------------------------------------
// fila 1: la marca y los aliados

/**
 * Fila 1: quién es el producto y para quién se gestiona.
 *
 * Es lo único que el rediseño AÑADE de verdad --antes el crédito
 * de aliados vivía dentro de la barra lateral, donde competía con
 * los módulos-- y por eso es la fila que el cliente señaló.
 */
export function FilaDeMarca() {
  return (
    /// EL ALTO ESCALA CON LA PANTALLA, no salta por escalones.
    ///
    /// Lo pidió el cliente el 12 sep 2026: «que se adapte al tipo
    /// de pantalla, que se mantenga la proporción». En su monitor
    /// de 24" la fila de 66 px está bien; en un portátil de 1366
    /// se comía un alto que ahí es escaso.
    ///
    /// `clamp(52px, 3.4vw, 66px)`: 52 hasta 1530, y de ahí sube
    /// hasta los 66 de su monitor. El relleno lateral acompaña.
    ///
    /// EN PÍXELES Y NO EN REM, a propósito: una medida de CAJA no
    /// debe crecer con el ajuste de texto del 90-140 % de
    /// Accesibilidad. Si creciera, subir el texto separaría las
    /// filas el doble y la cabecera se comería el contenido. El
    /// texto crece; la caja se queda.
    <div
      style={{
        height: "clamp(52px, 3.4vw, 66px)",
        paddingInline: "clamp(1rem, 1.4vw, 1.75rem)",
      }}
      className="flex shrink-0 items-center justify-between gap-4 border-b border-encabezado-borde bg-encabezado-fondo text-encabezado-texto"
    >
      {/* La MISMA firma que el acceso, el pie público y la ficha
          del perfil, no una copia con los mismos estilos: cuatro
          copias acaban diciendo cuatro cosas.

          A 34 y no a 42 como en la barra: en una fila de 66 px, la
          firma a 42 pide 64 px de alto y no deja aire. El umbral
          `grande` de `FirmaConvoca` son 44, así que a 34 el nombre
          baja a 1,05rem, que es justo lo que quiere una cabecera. */}
      <Link
        href="/admin"
        className="flex min-w-0 items-center gap-2.5 no-underline"
      >
        <FirmaConvoca tamano={34} />
      </Link>

      <CreditoDeAliados />
    </div>
  );
}

/**
 * «GESTIONADO POR [AE] PARA [ADECOPRIA]».
 *
 * La misma frase que la tarjeta de los formularios públicos, y por
 * la misma razón: tres logos en fila obligan a adivinar qué pinta
 * cada uno, y con dos rótulos de ocho letras se lee la relación
 * completa. El ORDEN lo manda el administrador desde Apariencia;
 * el primero es el gestor.
 */
function CreditoDeAliados() {
  /// Se guarda CUÁLES fuentes fallaron, no un booleano: con tres
  /// logos, uno roto se llevaría a los otros dos por delante.
  const [fallidas, setFallidas] = useState<string[]>([]);
  const { marca } = useMarca();

  const fondoOscuro = useFondoDelEncabezadoOscuro();

  const logos = variantesParaElFondo(marca?.logos ?? [], fondoOscuro)
    .slice(0, MAXIMO_LOGOS)
    .map((l) => ({ ...l, url: urlLogo(l) }))
    .filter((l) => !fallidas.includes(l.url));

  if (logos.length === 0) return null;

  const [gestor, ...para] = logos;

  return (
    /// SIN PLACA BLANCA: los logos van directos sobre la fila.
    /// Lo pidió el cliente el 12 sep 2026 --«esto sin fondo
    /// blanco»-- y tiene razón: un ladrillo blanco en medio de una
    /// cabecera de color se ve como lo que era, un parche.
    ///
    /// Lo que la placa resolvía sigue existiendo, y se resuelve de
    /// otra forma: eligiendo la VARIANTE del logo que se ve sobre
    /// este fondo. Ver `variantesParaElFondo`.
    /// Los logos escalan con la fila: si el alto de la banda baja
    /// de 66 a 52 en un portátil, un logo fijo de 32 px se queda
    /// desproporcionado dentro de ella. El `gap` también.
    <div
      style={{ gap: "clamp(0.75rem, 1vw, 1.25rem)" }}
      className="hidden shrink-0 items-center md:flex"
    >
      <Rotulo>Gestionado por</Rotulo>
      <PiezaDeLogo
        logo={gestor}
        alFallar={setFallidas}
        alto="clamp(24px, 1.7vw, 32px)"
      />
      {para.length > 0 && <Rotulo>para</Rotulo>}
      {para.map((l) => (
        <PiezaDeLogo
          key={l.id}
          logo={l}
          alFallar={setFallidas}
          alto="clamp(21px, 1.5vw, 28px)"
        />
      ))}
    </div>
  );
}

/// El rótulo, en el color del texto del encabezado: ahora está
/// sobre la fila y no sobre una placa.
function Rotulo({ children }: { children: React.ReactNode }) {
  return <span className={`${ROTULO} whitespace-nowrap`}>{children}</span>;
}

function PiezaDeLogo({
  logo,
  alto,
  alFallar,
}: {
  logo: { id: string; etiqueta: string; url: string };
  /// El alto como VALOR CSS, no como clase de Tailwind: es un
  /// `clamp()` que escala con la ventana, y eso no se puede
  /// escribir como utilidad. Pasado como clase, el navegador la
  /// ignora y el logo se queda sin alto.
  alto: string;
  alFallar: (f: (antes: string[]) => string[]) => void;
}) {
  return (
    // <img>: tamaño desconocido y ya viene cacheado
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo.url}
      alt={logo.etiqueta}
      onError={() =>
        alFallar((antes) =>
          antes.includes(logo.url) ? antes : [...antes, logo.url],
        )
      }
      style={{ height: alto }}
      className="w-auto max-w-[9rem] shrink object-contain"
    />
  );
}

// ---------------------------------------------------------------
// fila 2: los módulos y quién está dentro

/**
 * Fila 2: los módulos en horizontal y el bloque de usuario.
 *
 * `ranura` es el hueco donde cada pantalla cuelga sus botones. Lo
 * recibe como nodo y no lo pinta ella para que el marco siga
 * siendo el dueño de `RANURA_ACCIONES`: `AccionesDePagina` la
 * resuelve UNA vez en un efecto de dependencias vacías y devuelve
 * `null` sin avisar si no la encuentra, así que ese div tiene que
 * existir siempre y con su id.
 */
export function FilaDeModulos({
  ruta,
  esSuperadmin,
  permisos,
  admin,
  gremios,
  gremio,
  alElegirGremio,
  alSalir,
  alAbrirMenu,
  migas,
  ranura,
}: {
  ruta: string;
  esSuperadmin: boolean;
  permisos: Permisos;
  admin: AdminActual;
  gremios: Array<{ convenioId: string; sigla: string }>;
  gremio: string | null;
  alElegirGremio: (id: string | null) => void;
  alSalir: () => void;
  /// Abre el cajón. Solo por debajo de `xl`, que es donde la
  /// navegación horizontal no se pinta.
  alAbrirMenu: () => void;
  /// Dónde está uno. Se pinta SOLO por debajo de `xl`, ver abajo.
  migas?: React.ReactNode;
  ranura?: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState<Abierto>(null);
  const caja = useRef<HTMLDivElement>(null);

  /// SE CIERRA AL NAVEGAR. Sin esto, pulsar un enlace del
  /// desplegable deja el menú abierto sobre la pantalla nueva.
  const [ultimaRuta, setUltimaRuta] = useState(ruta);
  if (ultimaRuta !== ruta) {
    setUltimaRuta(ruta);
    if (abierto) setAbierto(null);
  }

  /// Clic fuera, Escape, cambio de tamaño Y DESPLAZAMIENTO.
  ///
  /// Lo del scroll es la pieza que le falta a nuestro
  /// `Desplegable`: su comentario promete que «en scroll y en
  /// cambio de tamaño se cierra» pero solo escucha `mousedown` y
  /// `resize`. Colgando de esta fila, con el contenido
  /// desplazándose por debajo, un menú abierto se quedaría
  /// flotando en el aire.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(null);
    };
    const conTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(null);
    };
    const cerrar = () => setAbierto(null);
    document.addEventListener("mousedown", fuera);
    window.addEventListener("keydown", conTecla);
    window.addEventListener("resize", cerrar);
    /// En captura: el que se desplaza es `<main>`, no la ventana,
    /// y un `scroll` de un hijo no burbujea.
    window.addEventListener("scroll", cerrar, true);
    return () => {
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("keydown", conTecla);
      window.removeEventListener("resize", cerrar);
      window.removeEventListener("scroll", cerrar, true);
    };
  }, [abierto]);

  return (
    <div
      ref={caja}
      /// EL MISMO COLOR, MÁS CLARO, y sin token nuevo.
      ///
      /// Lo pidió el cliente el 12 sep 2026: «el mismo color pero
      /// más claro». El montaje de diseño la quería en un segundo
      /// teal FIJO, y eso aquí costaría un cuarto token de
      /// encabezado --dieciséis plantillas por dos esquemas, con
      /// el catálogo cerrado--, así que no se hace así.
      ///
      /// Se mezcla un 12 % del color del TEXTO dentro del fondo.
      /// En ADECOPRIA --verde oscuro con texto blanco-- eso
      /// aclara, que es lo que se pide; y en un gremio con
      /// encabezado blanco y texto oscuro, oscurece un punto. Las
      /// dos direcciones son la correcta: la fila se separa de la
      /// de arriba sin inventar un color que nadie eligió.
      ///
      /// Va en `style` y no como token: `color-mix` no puede ser
      /// el VALOR de un token --el backend filtra por
      /// `/^#[0-9a-fA-F]{6}$/` y lo descartaría en silencio--,
      /// pero como fondo de un elemento es CSS normal. La clase
      /// se queda debajo como respaldo.
      /// El alto y el relleno escalan igual que la fila de arriba,
      /// y por lo mismo: 40 px en un portátil, 46 en el monitor
      /// de 24". En píxeles, que es una medida de caja.
      style={{
        backgroundColor:
          "color-mix(in oklab, var(--encabezado-fondo) 88%, var(--encabezado-texto))",
        height: "clamp(40px, 2.4vw, 46px)",
        paddingInline: "clamp(0.75rem, 1.2vw, 1.5rem)",
      }}
      className="relative z-30 flex shrink-0 items-center justify-between gap-3 border-b border-encabezado-borde bg-encabezado-fondo text-encabezado-texto"
    >
      {/* LA HAMBURGUESA Y LAS MIGAS, solo por debajo de xl.

          Por debajo de xl no hay navegación horizontal --no cabe,
          ver el cálculo de abajo--, así que manda el cajón y hace
          falta el botón que lo abre. Y ahí las migas siguen
          siendo lo único que dice en qué pantalla está uno.

          A partir de xl se esconden: el módulo lo dice la píldora
          activa de la fila, y el nombre de la pantalla lo dice su
          propio `h1`. Queda una decisión abierta del cliente --si
          quiere la ruta completa también a pantalla ancha-- y
          hasta que la conteste esto no pierde nada, porque hoy
          tampoco se lee la miga en el sitio donde se trabaja. */}
      <div className="flex min-w-0 items-center gap-2 xl:hidden">
        <button
          onClick={alAbrirMenu}
          aria-label="Abrir el menú"
          className="grid size-9 shrink-0 place-items-center rounded-lg transition hover:bg-current/10"
        >
          <IconoMenu tamano={20} />
        </button>
        {migas}
      </div>

      {/* LA NAVEGACIÓN DESDE xl, APRETANDO EL RELLENO ANTES DE
          RENDIRSE. Y esto es una corrección de un error mío.

          La fila de los siete módulos mide **1.050 px** montada
          --más que los 966 del prototipo, porque los carets y el
          relleno de la píldora activa engordan cada ítem-- y el
          bloque de usuario 220. Medido: cabía de sobra a 1440
          (caja de 1.172) y a 1366 (1.098), y solo fallaba a 1280,
          donde la caja da 988 y se quedaba corta por 62 px.

          Yo corregí de más: subí el corte a `2xl` y con eso mandé
          al cajón a 1440 y 1366, o sea justo los portátiles, donde
          la fila entraba perfectamente. El cliente lo vio
          enseguida --«las de portátil se ve eso apeñuzcado, que se
          mantenga la proporción»-- y tenía razón: en esos anchos
          no estaba viendo una versión más apretada del panel, sino
          otro panel peor.

          Así que el corte vuelve a `xl` (1280) y lo que se ajusta
          es el RELLENO: por debajo de `2xl` cada ítem va a `px-2`
          y el hueco a 2 px, que ahorra los ~78 px que faltaban;
          desde `2xl` se respira. La proporción se mantiene porque
          lo que cambia es el aire, no lo que se ve.

          El `overflow-x-auto` se queda como cinturón: el panel
          escala la letra hasta el 140 % desde Accesibilidad, y a
          ese tamaño no hay corte que salve la cuenta. Antes que
          pisar al usuario, la nav se desplaza por dentro. */}
      <nav
        aria-label="Módulos del panel"
        className="caja-scroll hidden min-w-0 items-center gap-0.5 overflow-x-auto xl:flex 2xl:gap-1"
      >
        <EnlaceDeFila href="/admin" activo={ruta === "/admin"}>
          Resumen
        </EnlaceDeFila>

        {MODULOS.map((modulo) => {
          const enlaces = enlacesVisibles(modulo, permisos, esSuperadmin);
          if (enlaces.length === 0) return null;

          const activo = enlaces.some((e) => estaActivo(e, ruta));

          /// CARET SOLO SI HAY ALGO QUE ELEGIR.
          ///
          /// El mock pone desplegable en uno. Aquí cinco módulos
          /// tienen varias pantallas y dos tienen una sola
          /// --Calendario y Gestión Académica--, y esos NAVEGAN
          /// DIRECTO: un desplegable de un solo elemento repite el
          /// error que el propio panel ya razonó para el selector
          /// de gremio, «elegir entre una cosa no es elegir, y un
          /// control muerto solo estorba».
          if (enlaces.length === 1) {
            return (
              <EnlaceDeFila
                key={modulo.clave}
                href={enlaces[0].href}
                activo={activo}
              >
                {modulo.etiqueta}
              </EnlaceDeFila>
            );
          }

          return (
            <MenuDeModulo
              key={modulo.clave}
              etiqueta={modulo.etiqueta}
              enlaces={enlaces}
              ruta={ruta}
              activo={activo}
              desplegado={abierto === modulo.clave}
              alAlternar={() =>
                setAbierto((a) => (a === modulo.clave ? null : modulo.clave))
              }
            />
          );
        })}
      </nav>

      {/* el hueco de los botones de cada pantalla */}
      {ranura}

      <MenuDeUsuario
        admin={admin}
        gremios={gremios}
        gremio={gremio}
        alElegirGremio={alElegirGremio}
        alSalir={alSalir}
        desplegado={abierto === "usuario"}
        alAlternar={() => setAbierto((a) => (a === "usuario" ? null : "usuario"))}
      />
    </div>
  );
}

/**
 * Un módulo de una sola pantalla, o el Resumen.
 *
 * EL ACTIVO VA CON EL PAR INVERTIDO DEL ENCABEZADO --fondo de
 * texto, texto de fondo--, que es el truco que el panel ya usa en
 * el rail plegado y en `BotonDeCabecera`: «esos dos tienen que
 * contrastar por definición, porque si no la cabecera no se
 * leería». El `bg-marca-suave` del mock NO sirve aquí: sobre un
 * encabezado oscuro se vuelve invisible, y ADECOPRIA tiene la
 * marca verde y el encabezado verde.
 */
function EnlaceDeFila({
  href,
  activo,
  children,
}: {
  href: string;
  activo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`rounded-lg px-2 py-[5px] text-[0.78125rem] whitespace-nowrap no-underline transition 2xl:px-2.5 ${
        activo
          ? "bg-encabezado-texto font-semibold text-encabezado-fondo"
          : "font-medium opacity-80 hover:bg-current/10 hover:opacity-100"
      }`}
    >
      {children}
    </Link>
  );
}

/**
 * Un módulo con sus pantallas colgando.
 *
 * NO se usa nuestro `Desplegable` aunque tenga la mecánica
 * resuelta: declara `role="combobox"`, `role="listbox"` y
 * `role="option"`, y eso le anuncia a un lector de pantalla que
 * son las opciones de un CAMPO. Aquí son enlaces. Se copia su
 * posicionamiento y se descartan sus roles.
 */
function MenuDeModulo({
  etiqueta,
  enlaces,
  ruta,
  activo,
  desplegado,
  alAlternar,
}: {
  etiqueta: string;
  enlaces: Array<{ href: string; etiqueta: string }>;
  ruta: string;
  activo: boolean;
  desplegado: boolean;
  alAlternar: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={alAlternar}
        aria-expanded={desplegado}
        className={`flex items-center gap-1 rounded-lg px-2 py-[5px] text-[0.78125rem] whitespace-nowrap transition 2xl:gap-1.5 2xl:px-2.5 ${
          activo
            ? "bg-encabezado-texto font-semibold text-encabezado-fondo"
            : "font-medium opacity-80 hover:bg-current/10 hover:opacity-100"
        }`}
      >
        {etiqueta}
        <Caret abierto={desplegado} />
      </button>

      {desplegado && (
        /// Monta y desmonta, no se desvanece: con «Quitar
        /// animaciones» puesto las transiciones se quedan en su
        /// último fotograma, así que un menú que se oculta con
        /// opacidad se quedaría visible y comiéndose los clics.
        <div className="absolute top-[calc(100%+6px)] left-0 z-40 w-max max-w-[22rem] min-w-[13rem] rounded-xl border border-encabezado-borde bg-encabezado-fondo p-1.5 shadow-lg shadow-black/25">
          <ul>
            {enlaces.map((enlace) => {
              const suyo = estaActivo(enlace, ruta);
              return (
                <li key={enlace.href}>
                  <Link
                    href={enlace.href}
                    aria-current={suyo ? "page" : undefined}
                    className={`block rounded-lg px-3.5 py-2.5 text-[0.8125rem] no-underline transition ${
                      suyo
                        ? "bg-current/15 font-semibold"
                        : "opacity-85 hover:bg-current/10 hover:opacity-100"
                    }`}
                  >
                    {enlace.etiqueta}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Caret({ abierto }: { abierto: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Quién está dentro, y su menú.
 *
 * El avatar con iniciales lo pide el handoff, y aquí hay que
 * reconocer que contradice algo que este panel había quitado a
 * propósito: «esa placa de una letra no identificaba a nadie
 * —quien está adentro sabe quién es— y le quitaba sitio al
 * nombre». La diferencia es que ahora el avatar ES EL DISPARADOR
 * del menú, o sea que hace un trabajo: antes solo decoraba. Y el
 * nombre no pierde sitio, sigue a su izquierda.
 *
 * El cargo va al 78 % del texto del encabezado: son 5,62:1
 * medidos. Estuvo en `--texto-suave` y daba **1,69:1** en las 38
 * pantallas, que es texto invisible.
 */
function MenuDeUsuario({
  admin,
  gremios,
  gremio,
  alElegirGremio,
  alSalir,
  desplegado,
  alAlternar,
}: {
  admin: AdminActual;
  gremios: Array<{ convenioId: string; sigla: string }>;
  gremio: string | null;
  alElegirGremio: (id: string | null) => void;
  alSalir: () => void;
  desplegado: boolean;
  alAlternar: () => void;
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={alAlternar}
        aria-expanded={desplegado}
        aria-label={`Cuenta de ${admin.nombre}`}
        style={{ gap: "clamp(0.5rem, 0.6vw, 0.625rem)" }}
        className="flex items-center rounded-xl px-1.5 py-1 transition hover:bg-current/10"
      >
        <span className="hidden min-w-0 flex-col items-end text-right leading-tight sm:flex">
          <span className="truncate text-[0.75rem] font-semibold">
            {admin.nombre}
          </span>
          <span className="truncate text-[0.6875rem] text-encabezado-texto/78">
            {comoSePresenta(admin)}
          </span>
        </span>
        <Avatar nombre={admin.nombre} />
      </button>

      {desplegado && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-40 w-[15rem] rounded-xl border border-encabezado-borde bg-encabezado-fondo p-1.5 shadow-lg shadow-black/25">
          <div className="px-3 pt-2 pb-2.5">
            <p className="truncate text-[0.8125rem] font-semibold">
              {admin.nombre}
            </p>
            <p className="mt-0.5 truncate text-[0.6875rem] text-encabezado-texto/78">
              {admin.correo}
            </p>
          </div>

          <Raya />

          <SeccionGremio
            gremios={gremios}
            gremio={gremio}
            alElegir={alElegirGremio}
          />

          <Raya />

          {/* «Esta es la ÚNICA salida de sesión del panel», dice
              el comentario que la puso arriba. Baja un clic dentro
              del menú porque el diseño lo pide, y por eso lleva su
              icono y el rojo al pasar por encima: dentro de una
              lista de tres filas, la que cierra sesión tiene que
              distinguirse de las otras dos. */}
          <button
            type="button"
            onClick={alSalir}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[0.8125rem] font-semibold transition hover:bg-error-suave hover:text-error"
          >
            <IconoSalir tamano={16} />
            Salir
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Las iniciales, sobre la inversa del encabezado.
 *
 * SIN el punto verde de «en línea» del handoff: no tenemos dato de
 * presencia, y un punto fijo afirmaría que está conectada también
 * cuando el sistema no lo sabe. De paso evita un parecido que el
 * propio signo de Convoca esquiva a propósito --«abajo a la
 * derecha es el punto de presencia de un avatar»--.
 *
 * Y sin sombra: el criterio de la casa es «sin sombras, la
 * separación es siempre por borde de 1px», y la excepción escrita
 * es solo para lo que FLOTA. Un avatar no flota.
 */
function Avatar({ nombre }: { nombre: string }) {
  const iniciales = nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    /// El diámetro escala con la fila --26 px en un portátil, 34
    /// en el monitor de 24"-- porque un círculo de tamaño fijo
    /// dentro de una banda que se encoge acaba tocando los dos
    /// bordes. El CUERPO de las iniciales no: se queda en rem,
    /// para que el ajuste de texto de Accesibilidad lo siga
    /// escalando.
    <span
      aria-hidden
      style={{ width: "clamp(26px, 1.8vw, 34px)", height: "clamp(26px, 1.8vw, 34px)" }}
      className="flex shrink-0 items-center justify-center rounded-full bg-encabezado-texto text-[0.75rem] font-bold tracking-[0.03em] text-encabezado-fondo"
    >
      {iniciales}
    </span>
  );
}

function Raya() {
  return <div aria-hidden className="my-1.5 h-px bg-current/15" />;
}

/**
 * De qué gremio se está hablando, dentro del menú.
 *
 * Se REHACE y no se mete aquí nuestro `Desplegable`: su lista es
 * una tarjeta con tokens de CUERPO que se abriría dentro de una
 * tarjeta con tokens de ENCABEZADO, se cierra sola al cambiar el
 * tamaño y llega a 24rem frente a los 15 de este menú.
 *
 * Los tres casos del selector viejo se conservan tal cual: con
 * cero gremios no se pinta nada, con uno es una línea de lectura
 * --«elegir entre una cosa no es elegir»-- y con varios se elige.
 */
function SeccionGremio({
  gremios,
  gremio,
  alElegir,
}: {
  gremios: Array<{ convenioId: string; sigla: string }>;
  gremio: string | null;
  alElegir: (id: string | null) => void;
}) {
  if (gremios.length === 0) return null;

  if (gremios.length === 1) {
    return (
      <div className="px-3 py-2">
        <span className={`${ROTULO} block`}>Gremio</span>
        <span className="mt-0.5 block truncate text-[0.8125rem] font-medium">
          {gremios[0].sigla}
        </span>
      </div>
    );
  }

  const opciones = [
    { valor: "", etiqueta: "Todos los gremios" },
    ...gremios.map((g) => ({
      valor: g.convenioId,
      etiqueta: g.sigla ?? g.convenioId,
    })),
  ];

  return (
    <div className="px-1.5 pt-1.5 pb-1">
      <span className={`${ROTULO} mb-1 block px-1.5`}>Gremio</span>
      {/* Con muchos gremios la lista se desplaza por dentro en vez
          de estirar el menú hasta salirse de la pantalla. */}
      <ul className="caja-scroll max-h-[11rem] overflow-y-auto">
        {opciones.map((o) => {
          const elegido = (gremio ?? "") === o.valor;
          return (
            <li key={o.valor || "todos"}>
              <button
                type="button"
                onClick={() => alElegir(o.valor || null)}
                aria-current={elegido ? "true" : undefined}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[0.8125rem] transition ${
                  elegido
                    ? "bg-current/15 font-semibold"
                    : "opacity-85 hover:bg-current/10 hover:opacity-100"
                }`}
              >
                <span className="truncate">{o.etiqueta}</span>
                {elegido && <Visto />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Visto() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}
