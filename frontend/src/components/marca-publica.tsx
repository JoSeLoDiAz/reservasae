"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { FirmaConvoca, PieDeConvoca } from "@/components/firma-convoca";
import { urlLogo, type Logo, type Marca } from "@/lib/admin-api";
import {
  ambitoDeRuta,
  ID_ESTILO_CACHE,
  recordarPaleta,
  rutaDeMarca,
  type Ambito,
} from "@/lib/marca";
import {
  aplicarEsquema,
  esquemaDelSistema,
  LLAVE_MODO,
  resolverEsquema,
  type Esquema,
  type ModoElegido,
} from "@/lib/tema";

type ValorContexto = {
  marca: Marca | null;
  modo: ModoElegido;
  esquema: Esquema;
  cambiarModo: (modo: ModoElegido) => void;
  /** Vuelve a leer la marca. */
  recargar: () => Promise<void>;
};

const ContextoMarca = createContext<ValorContexto | null>(null);

export function useMarca(): ValorContexto {
  const valor = useContext(ContextoMarca);
  if (!valor) throw new Error("useMarca fuera del proveedor.");
  return valor;
}

/// La marca de un ámbito, o null si no se pudo: que falle la
/// marca no puede tumbar el formulario.
async function leerMarca(ambito: Ambito): Promise<Marca | null> {
  try {
    const respuesta = await fetch(rutaDeMarca(ambito));
    if (!respuesta.ok) return null;
    return (await respuesta.json()) as Marca;
  } catch {
    return null;
  }
}

function leerModoGuardado(): ModoElegido {
  if (typeof window === "undefined") return "sistema";
  const guardado = window.localStorage.getItem(LLAVE_MODO);
  return guardado === "claro" || guardado === "oscuro" ? guardado : "sistema";
}

/** Aplica colores y textos de la marca del ambito. */
export function ProveedorMarca({ children }: { children: React.ReactNode }) {
  const [marca, setMarca] = useState<Marca | null>(null);
  const [modo, setModo] = useState<ModoElegido>("sistema");
  const [esquema, setEsquema] = useState<Esquema>("CLARO");

  // el modo guardado solo existe en el navegador
  useEffect(() => {
    const guardado = leerModoGuardado();
    setModo(guardado);
    setEsquema(resolverEsquema(guardado));
  }, []);

  // el primer segmento es el slug
  const ruta = usePathname();
  const ambito = useMemo(() => ambitoDeRuta(ruta ?? "/"), [ruta]);

  const recargar = useCallback(async () => {
    const datos = await leerMarca(ambito);
    if (!datos) return;
    setMarca(datos);
    recordarPaleta(ambito, datos);
  }, [ambito]);

  /// GANA LA ÚLTIMA QUE SE PIDIÓ, NO LA QUE LLEGA ÚLTIMA.
  ///
  /// Al cambiar de ámbito —del panel al formulario de un gremio,
  /// o entre dos gremios— se pide otra marca sin que la anterior
  /// haya contestado. Sin este corte, la respuesta vieja llegando
  /// de segunda pisa a la nueva y la pantalla se queda con los
  /// colores y los logos del ámbito del que ya se salió.
  ///
  /// No es un fallo observado: es que una petición por ámbito sin
  /// cancelar lo permite, y el defecto solo se vería el día que
  /// las dos marcas se diferencien de verdad.
  useEffect(() => {
    let vigente = true;
    void (async () => {
      const datos = await leerMarca(ambito);
      if (!vigente || !datos) return;
      setMarca(datos);
      recordarPaleta(ambito, datos);
    })();
    return () => {
      vigente = false;
    };
  }, [ambito]);

  // el defecto del admin solo manda si nadie eligio
  useEffect(() => {
    if (!marca || leerModoGuardado() !== "sistema") return;
    if (marca.modoPorDefecto === "SISTEMA") return;
    const forzado = marca.modoPorDefecto === "OSCURO" ? "OSCURO" : "CLARO";
    setEsquema(forzado);
  }, [marca]);

  // seguir al sistema en vivo
  useEffect(() => {
    if (modo !== "sistema") return;
    const consulta = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => setEsquema(esquemaDelSistema());
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, [modo]);

  useEffect(() => {
    aplicarEsquema(esquema);
  }, [esquema]);

  // hoja con los dos esquemas: conmutar no pide nada
  const estilos = useMemo(() => {
    if (!marca?.temas || !marca.catalogoColores) return "";

    // segunda barrera: esto acaba en un <style>
    const hexadecimal = /^#[0-9a-fA-F]{3,8}$/;

    return (["CLARO", "OSCURO"] as const)
      .map((nombre) => {
        const colores = marca.temas[nombre];
        if (!colores) return "";
        const lineas = marca.catalogoColores.tokens
          .filter((token) => hexadecimal.test(colores[token.clave] ?? ""))
          .map((token) => `${token.variableCss}:${colores[token.clave]};`)
          .join("");
        return lineas ? `:root[data-tema="${nombre.toLowerCase()}"]{${lineas}}` : "";
      })
      .join("");
  }, [marca]);

  useEffect(() => {
    if (marca?.nombreApp) document.title = marca.nombreApp;
  }, [marca]);

  // ya hay hoja real: sobra la cacheada del <head>
  useEffect(() => {
    if (estilos) document.getElementById(ID_ESTILO_CACHE)?.remove();
  }, [estilos]);

  const cambiarModo = useCallback((nuevo: ModoElegido) => {
    setModo(nuevo);
    setEsquema(resolverEsquema(nuevo));
    try {
      window.localStorage.setItem(LLAVE_MODO, nuevo);
    } catch {
      // en privado localStorage puede fallar
    }
  }, []);

  return (
    <ContextoMarca.Provider value={{ marca, modo, esquema, cambiarModo, recargar }}>
      {estilos && <style dangerouslySetInnerHTML={{ __html: estilos }} />}
      {children}
    </ContextoMarca.Provider>
  );
}

// conmutador de tema

/// DOS BOTONES, NO TRES.
///
/// El tercero era «Automático», que sigue al sistema, y el
/// cliente lo quitó el 11 sep 2026: «no hace nada, o sea sobra».
/// Y desde su silla era verdad —su Windows está en claro, así que
/// pulsarlo se veía igual que pulsar «Claro»—.
///
/// **Lo automático no se fue: se volvió el punto de partida.** El
/// modo guardado sigue empezando en `sistema`, así que quien abre
/// el formulario lo ve como tenga su equipo o su celular, en claro
/// o en oscuro, sin tocar nada. Los dos botones solo sirven para
/// cambiarlo a mano.
///
/// Lo que se pierde, dicho para que no sorprenda: después de
/// elegir uno, ya no hay botón para volver a «que siga a mi
/// sistema». Se vuelve borrando los datos del sitio.
const OPCIONES: Array<{ valor: ModoElegido; etiqueta: string; icono: React.ReactNode }> = [
  { valor: "claro", etiqueta: "Claro", icono: <IconoSol /> },
  { valor: "oscuro", etiqueta: "Oscuro", icono: <IconoLuna /> },
];

export function ConmutadorTema({ compacto = false }: { compacto?: boolean }) {
  const { marca, esquema, cambiarModo } = useMarca();

  // el admin puede apagar el conmutador
  if (marca && !marca.permitirCambioDeModo) return null;

  return (
    <div
      role="group"
      aria-label="Tema de la interfaz"
      /// EN PASTILLA, no en caja de esquinas suaves. Lo pidió el
      /// cliente el 12 sep 2026 con su montaje del acceso: «en
      /// donde están los modos, más redondito». Va en el
      /// componente y no en la pantalla porque el conmutador es el
      /// mismo en el acceso y en las seis públicas, y dos formas
      /// distintas del mismo control es justo lo que hace que una
      /// interfaz se vea cosida a mano.
      className="inline-flex rounded-full border border-borde bg-superficie p-0.5"
    >
      {OPCIONES.map((opcion) => {
        /// Se marca el que SE ESTÁ VIENDO, no el que se eligió.
        ///
        /// Antes se comparaba con el modo guardado, y al entrar
        /// —modo `sistema`— no salía ninguno marcado: dos botones
        /// apagados sin decir en qué tema está la pantalla. Con el
        /// esquema resuelto, quien abre en oscuro ve la luna
        /// marcada aunque no haya elegido nunca.
        const activa =
          esquema === (opcion.valor === "oscuro" ? "OSCURO" : "CLARO");
        return (
          <button
            key={opcion.valor}
            type="button"
            onClick={() => cambiarModo(opcion.valor)}
            /// Pulsar con el ratón NO da el foco. Y esa es la
            /// única línea que de verdad importa aquí.
            ///
            /// Cuando un botón recibe el foco, el navegador lo
            /// desplaza a la vista — y recorre TODOS sus
            /// contenedores desplazables, no solo el primero.
            /// En el panel este botón es el último control de
            /// la barra lateral, o sea el que más abajo cae, y
            /// desde ahí ese desplazamiento descuadraba la
            /// pantalla entera: cabecera recortada, barra a
            /// media altura, franja en blanco al final. Sin
            /// forma de devolverla salvo recargando.
            ///
            /// Se intentó atajar dos veces por el lado del
            /// contenedor —`overflow-clip` en el marco, y meter
            /// Ajustes dentro de la columna que sí scrollea— y
            /// las dos son correctas, pero las dos suponen
            /// saber CUÁL contenedor se mueve. Esto no lo
            /// supone: sin foco no hay desplazamiento, venga de
            /// donde venga.
            ///
            /// Con el teclado sigue funcionando igual, y allí
            /// el desplazamiento sí se quiere: quien llega con
            /// Tab necesita ver a dónde llegó. `preventDefault`
            /// en `mousedown` no toca esa ruta.
            onMouseDown={(e) => e.preventDefault()}
            aria-pressed={activa}
            title={opcion.etiqueta}
            /// Redondos del todo, como la pastilla que los
            /// contiene: con las esquinas a medio redondear, el
            /// botón marcado dibujaba un rectángulo dentro de una
            /// pastilla y se veían las dos formas peleando.
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm transition ${
              activa
                ? "bg-marca-suave font-medium text-marca"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            {opcion.icono}
            {!compacto && <span>{opcion.etiqueta}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** La firma de Convoca y, debajo, los logos de las entidades. */
/// Las dos cosas van JUNTAS aqui y no en `EncabezadoPublico`
/// porque `completar-ficha` y la pantalla de «Registrada» pintan
/// este banner suelto, sin encabezado. Con la firma arriba y el
/// banner aqui, la firma salia en 2 de las 6 pantallas publicas
/// -- y se perdia justo en /completar, que es donde la persona
/// entrega mas datos. Metida dentro, sale en las seis y nadie
/// puede olvidarla al escribir la septima.
/** Los logos del gremio, centrados. */
///
/// Es para las pantallas centradas y estrechas --«Registrada», el
/// enlace vencido, el cierre de /completar--. Con `centrado` el
/// bloque va al eje de la pantalla; sin él se alineaba a la
/// izquierda dentro de una columna centrada, y la marca quedaba
/// torcida respecto del título de debajo (visto en producción el
/// 11 sep 2026).
///
/// LA FIRMA DE CONVOCA YA NO VA AQUÍ.
///
/// Iba encima de los logos, y el cliente la quitó el 11 sep 2026:
/// «siento que es sobrante si está abajo». Y es cierto —sale en el
/// pie de las seis pantallas públicas, con su lema y la versión—,
/// así que arriba se leía dos veces la misma firma en la misma
/// pantalla. La cara de arriba es la del gremio, que es quien
/// reparte el enlace; la casa firma abajo.
export function BannerLogos({ centrado = false }: { centrado?: boolean }) {
  return (
    /// La firma ARRIBA y los logos debajo, las dos centradas.
    ///
    /// En las pantallas anchas Convoca va a un extremo y el gremio
    /// al otro (`FilaDeMarca`), pero aquí la columna mide 32rem:
    /// partir la marca en dos extremos de algo tan estrecho la
    /// deja descuadrada. Y desde que la firma se fue del pie —11
    /// sep 2026— esta es la única marca de la casa que queda en
    /// estas pantallas, así que no puede faltar.
    <div
      className={`flex flex-col gap-5 ${centrado ? "items-center" : "items-start"}`}
    >
      <FirmaConvoca tamano={40} animado />
      <LogosDelGremio className={centrado ? "justify-center" : ""} />
    </div>
  );
}

/** Convoca a la izquierda, los logos del gremio a la derecha. */
///
/// Es el encabezado de las pantallas ANCHAS: el formulario de
/// preinscripción, el de reserva y /completar.
///
/// Cuatro formas en un día, y esta es la que pidió el cliente el
/// 11 sep 2026: «el logo del CRM a la izquierda y los otros dos a
/// la derecha». Antes estuvieron los tres juntos en el centro y se
/// veían montados —tres marcas pegadas compiten en vez de
/// acompañarse—. Separados a los dos extremos cada bloque respira
/// y se lee quién atiende y de quién es la convocatoria.
///
/// El conmutador de tema NO está aquí: se fue al pie. En el
/// encabezado no hacía más que estorbarle a la marca.
/// LOS DOS BLOQUES PESAN LO MISMO, Y ESO ES LA ARMONÍA.
///
/// «Busca la forma que exista armonía» (cliente, 11 sep 2026), y
/// lo que rompía el equilibrio era medible: el bloque del gremio
/// medía 80 px de alto y el de Convoca 56, así que uno mandaba
/// sobre el otro y la fila se leía descuadrada.
///
/// Ahora los dos miden 64: los logos bajan de 80 a 64 y la firma
/// sube a 44, que es su umbral grande —el nombre a 1,75rem y el
/// lema a 13 px—, y con el signo da 64 justos. Los dos bloques
/// comparten el eje vertical y el mismo margen contra su borde.
/// Y el encabezado entero es 16 px más corto, que era la otra
/// mitad de la queja: el título sube.
/// El rótulo que une las tres marcas. Pequeño, en versalitas y
/// con aire entre letras: es una preposición, no un titular.
function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold tracking-[0.14em] whitespace-nowrap text-texto-suave uppercase">
      {children}
    </span>
  );
}

export function FilaDeMarca() {
  const logos = useLogosVisibles();
  const [gestor, ...para] = logos;

  return (
    /// UNA TARJETA QUE DICE LA RELACIÓN, no tres logos sueltos.
    ///
    /// Es el montaje que mandó el cliente el 11 sep 2026: «mira
    /// los logos así tal cual». Y es mejor que lo que había
    /// —tres marcas repartidas por tercios— por una razón que no
    /// es de gusto: tres logos en fila obligan a adivinar qué
    /// pinta cada uno. Con dos rótulos de ocho letras se lee la
    /// frase completa: Convoca CRM, gestionado por Grupo AE,
    /// para ADECOPRIA. Quien llega al formulario entiende de
    /// quién es la convocatoria y quién responde por el sistema.
    ///
    /// El ORDEN de los logos es el que manda: el primero es el
    /// gestor y los demás van tras el «para». Se cambia en
    /// Apariencia con las flechas de cada logo, sin tocar código.
    ///
    /// La tarjeta usa `bg-superficie`, no blanco fijo: en el tema
    /// oscuro tiene que ser oscura, o la pantalla acaba con un
    /// ladrillo blanco arriba.
    ///
    /// Los logos van a 40 y no a 64: dentro de una tarjeta con
    /// rótulos, lo que manda es el renglón, y a 64 los logos la
    /// reventaban.
    <div className="rounded-2xl border border-borde bg-superficie px-5 py-4 sm:px-7">
      {/* CENTRADA Y JUNTA, no un bloque a cada extremo.

          Con `justify-between` la firma se iba a la izquierda, el
          grupo a la derecha y toda la holgura —163 px medidos a
          1280— se juntaba en un agujero en el medio: "mira todo
          ese espacio" (cliente, 11 sep 2026). Centrada, esa
          holgura se reparte a los lados y las cinco piezas se
          leen como una frase: Convoca CRM · gestionado por Grupo
          AE · para ADECOPRIA. */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 sm:justify-between">
        <FirmaConvoca tamano={38} animado className="shrink-0" />

        {gestor && (
          /// CADA RÓTULO, PEGADO A SU LOGO.
          ///
          /// Antes las cinco piezas iban separadas lo mismo —16 px
          /// cada hueco— y el resultado era que «PARA» flotaba
          /// entre dos logos sin pertenecer a ninguno: «se sigue
          /// viendo el espacio» (cliente, 11 sep 2026). Ahora son
          /// dos PAREJAS: 8 px entre el rótulo y su logo, 20 entre
          /// una pareja y la siguiente. El ojo agrupa lo que está
          /// más junto, así que se lee «gestionado por AE» y
          /// «para ADECOPRIA», no cinco cosas en fila.
          /// EL MISMO AIRE A LOS DOS LADOS DE CADA RÓTULO.
          ///
          /// Estuvo por parejas —8 px entre el rótulo y su logo, 20
          /// entre parejas— y así «PARA» tenía 20 px por delante y
          /// 8 por detrás: «¿proporción de espacio en ambos lados?»
          /// (cliente, 11 sep 2026). Tenía razón: una preposición
          /// va centrada entre las dos cosas que une, o se lee
          /// pegada a una de ellas. Un solo `gap` para las cinco
          /// piezas y el problema no puede volver.
          <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-3">
            {/* el separador solo cuando hay sitio: en el teléfono
                las piezas se apilan y una raya vertical entre
                renglones no separa nada */}
            <span
              aria-hidden="true"
              className="mr-1 hidden h-10 w-px bg-borde sm:block"
            />
            <Rotulo>Gestionado por</Rotulo>
            <PiezaDeLogo logo={gestor} />
            {para.length > 0 && <Rotulo>para</Rotulo>}
            {para.map((l) => (
              <PiezaDeLogo key={l.id} logo={l} />
            ))}

          </div>
        )}
      </div>
    </div>
  );
}

/// Los logos del gremio, del mismo alto. Salen de `GET /marca`,
/// que varía por Host: son la cara pública del gremio.
///
/// Si el gremio no tiene logos cargados sale la firma de Convoca,
/// y no un hueco: desde que la firma se fue al pie, una marca sin
/// logos dejaría la pantalla empezando por el título, sin nada que
/// diga de quién es el formulario. Pasa en una base recién
/// sembrada y pasaría en un convenio nuevo.
/// Los logos que le toca ver a quien está mirando.
///
/// CADA LOGO DICE EN QUÉ TEMA SALE.
///
/// Los del gremio son archivos cerrados, hechos para papel: el de
/// ADECOPRIA llevaba el nombre en negro y sobre el fondo oscuro no
/// se leía. No se pueden recolorear como el signo de Convoca, que
/// va en `currentColor`. Así que la entidad sube sus dos versiones
/// —texto oscuro y texto blanco— y aquí sale la que toca. Lo pidió
/// el cliente el 11 sep 2026.
///
/// `AMBOS` es lo normal y no obliga a nadie a subir dos archivos:
/// un logo sin texto, o con texto de un color que aguanta los dos
/// fondos, sale siempre.
export function useLogosVisibles(): Logo[] {
  const { marca, esquema } = useMarca();
  return (marca?.logos ?? []).filter(
    (l) => l.esquema === "AMBOS" || l.esquema === esquema,
  );
}

/// Un logo, a la altura de la casa.
function PiezaDeLogo({ logo }: { logo: Logo }) {
  return (
    // <img>: tamano desconocido y ya viene cacheado
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={urlLogo(logo)}
      alt={logo.etiqueta}
      /// 40 de alto para todos, sea cual sea su proporción: la
      /// uniformidad es lo que hace que dos marcas de dos dueños
      /// se lean como un encabezado y no como dos pegatinas. Y 40
      /// y no 64 porque van dentro de una tarjeta con rótulos: lo
      /// que manda ahí es la altura del renglón.
      /// `max-w` para que no desborden en móvil.
      className="h-10 w-auto max-w-[42vw] object-contain sm:max-w-[11rem]"
    />
  );
}

function LogosDelGremio({ className = "" }: { className?: string }) {
  const { marca, esquema } = useMarca();

  /// CADA LOGO DICE EN QUÉ TEMA SALE.
  ///
  /// Los del gremio son archivos cerrados, hechos para papel: el
  /// de ADECOPRIA lleva el nombre en negro y sobre el fondo oscuro
  /// no se lee. No se pueden recolorear como el signo de Convoca,
  /// que va en `currentColor`. Así que la entidad sube sus dos
  /// versiones —texto oscuro y texto blanco— y aquí sale la que
  /// toca. Lo pidió el cliente el 11 sep 2026 con las variantes
  /// SVG de ADECOPRIA.
  ///
  /// `AMBOS` es lo normal y no obliga a nadie a subir dos
  /// archivos: un logo sin texto sale en los dos temas.
  const todos = marca?.logos ?? [];
  const logos = todos.filter(
    (l) => l.esquema === "AMBOS" || l.esquema === esquema,
  );

  /// PLACA BLANCA CUANDO NO HAY VERSIÓN PARA OSCURO.
  ///
  /// Un logo institucional es un archivo cerrado y casi siempre
  /// viene con el nombre en negro, hecho para papel: sobre el
  /// fondo oscuro desaparece. Si el gremio subió su versión de
  /// texto blanco, sale esa y aquí no hay nada que hacer. Si no
  /// la subió, se le pone debajo lo que le falta —el papel— en
  /// vez de enseñarlo ilegible.
  ///
  /// Es la misma solución que ya usaban la barra del panel y el
  /// login. Y se decide sola: nadie tiene que acordarse.
  ///
  /// El 11 sep 2026 ADECOPRIA mandó una versión de texto blanco
  /// en SVG y por un rato se usó esa. No sirve: el archivo no es
  /// un vector, es un calco de una imagen —cuatro trazos para
  /// todo el logo—, así que el nombre sale comido y el renglón de
  /// la razón social es una mancha. Con la placa se usa el
  /// original, que sí está bien dibujado.
  const conPlaca = esquema === "OSCURO" && !todos.some((l) => l.esquema === "OSCURO");

  /// Sin logos del gremio no se pinta nada: la firma de Convoca ya
  /// va al otro extremo de la fila, así que un hueco vacío aquí no
  /// deja la pantalla sin marca. Pasa en una base recién sembrada.
  if (logos.length === 0) return null;

  return (
    /// Los del gremio, juntos y del mismo alto. La firma de la casa
    /// NO está aquí: va al otro extremo, y la pone `FilaDeMarca`.
    <div
      className={`flex flex-wrap items-center gap-x-5 gap-y-3 ${
        conPlaca ? "rounded-2xl bg-white px-4 py-2.5" : ""
      } ${className}`}
    >
      {logos.map((logo) => (
        <PiezaDeLogo key={logo.id} logo={logo} />
      ))}
    </div>
  );
}

export function EncabezadoPublico({
  titulo,
  subtitulo,
}: {
  titulo?: string;
  subtitulo?: string;
}) {
  const { marca } = useMarca();

  return (
    <header className="mb-8">
      <FilaDeMarca />

      {/* CENTRADO, como los logos (cliente, 11 sep 2026). El
          título y el subtítulo son la presentación de la
          pantalla y comparten eje con la marca; los campos del
          formulario siguen alineados a la izquierda, que es como
          se lee y como se teclea. */}
      <h1 className="mt-7 text-center text-3xl font-semibold tracking-tight text-balance">
        {titulo ?? marca?.tituloPublico ?? "Reserve sus cupos de formación"}
      </h1>
      {/* `text-pretty`: el de la preinscripción ocupa dos
          renglones desde el 11 sep 2026 y sin esto el segundo
          acababa en una palabra suelta */}
      <p className="mx-auto mt-3 max-w-3xl text-center text-texto-suave text-pretty">
        {subtitulo ??
          marca?.subtituloPublico ??
          "La formación es gratuita y los cupos son limitados."}
      </p>

      {marca?.mensajeEncabezado && (
        <p className="mx-auto mt-4 max-w-3xl rounded-xl border border-marca/25 bg-marca-suave px-4 py-3 text-center text-sm">
          {marca.mensajeEncabezado}
        </p>
      )}
    </header>
  );
}

export function PiePublico() {
  const { marca } = useMarca();

  /// El pie sale SIEMPRE, aunque el admin no haya escrito
  /// texto: la firma y la version son de la casa, no del
  /// cliente, y antes toda la pieza desaparecia con el texto.
  return (
    /// Separado de lo que hay encima, pero no desterrado.
    ///
    /// Las tres piezas —el texto del cliente, la firma y la
    /// línea legal— van una debajo de otra y centradas. Antes
    /// iban en dos extremos, y en el teléfono se amontonaban
    /// en el mismo renglón.
    ///
    /// SIN margen propio encima, y ese es el punto.
    ///
    /// Esto ya se apretó una vez —de `mt-16` a `mt-8`— y el
    /// cliente volvió a decir, el 11 sep 2026, que sigue siendo
    /// «mucho espacio para la línea y el pie». Tenía razón: el
    /// contenido ya deja 40px con su `py-10`, así que cualquier
    /// margen aquí se SUMA a ese, y con 32 más la línea caía a
    /// más de 70px de lo último que se lee.
    ///
    /// Quien manda la separación es el relleno del contenido,
    /// que es el que sabe cuánto aire tiene la pantalla. Aquí
    /// solo queda el del propio pie, que es el que hay que ver.
    <footer className="mx-auto w-full max-w-3xl px-6 pb-8 text-sm text-texto-suave">
      {marca?.piePagina && <p className="mb-5">{marca.piePagina}</p>}
      {/* SOLO LA LÍNEA LEGAL, Y EL CONMUTADOR DE TEMA.

          La firma —el signo con «Convoca CRM» y su lema— salía
          aquí y arriba, y el cliente la dejó solo arriba el 11 sep
          2026: «vuela esto, que solo quede arriba». Lo que se
          queda es la letra pequeña, que no está repetida en
          ninguna parte: quién gestiona, el año y la versión que
          está corriendo.

          Y aquí abajo llegaron los botones de claro/oscuro, que
          venían estorbándole a la marca en el encabezado («eso de
          modo oscuro o claro toca reubicarlo»). Es un control que
          se toca una vez y se olvida: el pie es su sitio.

          Sin línea separadora encima: el pie se separa por el aire
          que deja el contenido, no por una raya. */}
      <div className="flex flex-col items-center gap-4 pt-2 text-center">
        <PieDeConvoca />
      </div>

      {/* LOS BOTONES DE TEMA, FLOTANDO EN LA ESQUINA.

          Tres sitios en un día: el encabezado («toca reubicarlo»),
          el pie («esto fatal abajo») y ninguno —los quité— hasta
          que el cliente dijo «que no se pierdan» (11 sep 2026).
          Flotando es el único sitio que cumple las dos cosas: se
          ve siempre, y no le quita el turno a nada. Es el mismo
          patrón del botón de accesibilidad del panel.

          `fixed` y no `absolute`: acompaña al desplazamiento, así
          que quien llega al final del formulario lo sigue
          teniendo a mano. Y va DENTRO del pie porque el pie está
          en las seis pantallas públicas; sacándolo habría que
          acordarse de ponerlo en cada una.

          Hubo un intento de meterlo en la tarjeta de marca, arriba
          con los logos, y el cliente lo devolvió aquí: «vuélvela a
          como estaba antes, no arriba en los logos». Aquí se
          queda. La sombra es lo que lo hace encontrable: sin ella
          se confundía con el fondo. */}
      <div className="fixed right-5 bottom-5 z-40 rounded-xl shadow-lg shadow-black/10 print:hidden">
        <ConmutadorTema compacto />
      </div>
    </footer>
  );
}

// iconos en línea
const TRAZO = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function IconoSol() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden {...TRAZO}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function IconoLuna() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden {...TRAZO}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

/// El icono de pantalla, el del modo «Automático», se fue con su
/// botón el 11 sep 2026. Si vuelve, era un `rect` de 20×13 con
/// `M8 21h8M12 17v4` de pie.
