"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SignoConvoca } from "@/components/admin/signo-convoca";
import { FirmaConvoca, PieDeConvoca } from "@/components/firma-convoca";
import { SenasDeEstudio } from "@/components/fondo-publico";
import { ConmutadorTema, useMarca } from "@/components/marca-publica";
import { PantallaDeCarga, useEsperaCompleta } from "@/components/pantalla-de-carga";
import { adminApi, urlLogo, type Logo } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";

export default function PaginaAcceso() {
  const router = useRouter();
  /// LA MISMA ESPERA QUE LOS FORMULARIOS PÚBLICOS.
  ///
  /// «Recuerda la visual: si así, yo no me logueé, el efecto que
  /// se tiene para el formulario» (cliente, 12 sep 2026). Y hace
  /// falta por una razón y no por adorno: la paleta y los logos
  /// del gremio llegan de `GET /marca`, así que sin esto el
  /// acceso se pinta un instante con los colores por defecto y
  /// sin logos, y luego salta al verde con las marcas. Se tapa
  /// con el signo llenándose, que es lo que ya hacen los dos
  /// formularios y la entrada al panel.
  ///
  /// `useEsperaCompleta` garantiza la vuelta entera: si el dato
  /// llega en 200 ms no se ve un logo a medio llenar que
  /// desaparece.
  const { marca } = useMarca();
  const esperando = useEsperaCompleta(!marca);

  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  /// Si el Bloq Mayus esta puesto. `null` mientras no se ha
  /// tocado el campo: no se avisa de algo que no se sabe.
  const [mayusculas, setMayusculas] = useState(false);

  /// `getModifierState` es lo unico que lo dice, y solo dentro
  /// de un evento de teclado: no se puede consultar al cargar.
  /// Por eso el aviso aparece al escribir y no antes.
  const mirarMayusculas = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setMayusculas(e.getModifierState("CapsLock"));
  };
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setEntrando(true);
    try {
      await adminApi.iniciarSesion(correo, clave);
      // replace: no dejar el acceso en el historial
      router.replace("/admin");
    } catch (e) {
      setError((e as ErrorApi).message);
      setEntrando(false);
    }
  }

  /// LOS CAMPOS, A LA ESCALA DEL PANEL DE AL LADO.
  ///
  /// Estaban a 14 px con 10 de relleno, que es el tamaño de un
  /// campo DENTRO del panel --en un formulario de una tabla, con
  /// veinte campos--. Aquí solo hay dos, la columna mide 960 px
  /// en un monitor de 1920 y enfrente hay un titular de 2,5rem:
  /// «¿super pequeña la letra no?» (cliente, 12 sep 2026).
  /// A 16 px con 12 de relleno. Y 16 no es un número cualquiera:
  /// por debajo de eso Safari en iPhone hace zoom él solo al
  /// enfocar un campo, y esta pantalla se abre desde el móvil.
  const clase =
    "w-full rounded-xl border border-campo-borde bg-campo-fondo px-4 py-3 text-[1rem] text-texto " +
    "outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25";

  return (
    /// La altura RESTA la franja de pruebas.
    ///
    /// Con `min-h-dvh` a secas la pantalla medía toda la
    /// ventana empezando 2,25rem más abajo, así que al body le
    /// sobraba justo la altura de la franja: un scroll de 36 px
    /// que no lleva a ninguna parte. En producción no se veía
    /// porque allí no hay franja.
    <div
      style={{ minHeight: "calc(100dvh - var(--franja-alto, 0px))" }}
      className="grid lg:grid-cols-2"
    >
      {/* La espera va DENTRO y no en lugar de la pantalla: así el
          acceso se monta por detrás --la firma arranca su
          animación, los logos se descargan-- y cuando el signo
          termina de llenarse ya está todo pintado. Poniéndola en
          vez del formulario, al quitarse se veía el montaje. */}
      {esperando && <PantallaDeCarga que="Abriendo Convoca" />}

      {/* EL PANEL DE MARCA. Solo desde lg, o roba la pantalla.

          DOS FILAS Y NO `justify-between` CON DOS HIJOS.

          Así estaba, y eso deja TODA la holgura junta en el
          medio: 496 px de nada, medidos en una ventana de 900.
          No faltaba contenido; el reparto amontonaba el sobrante
          en un solo agujero. Con `grid-rows-[1fr_auto]` la marca
          se centra en lo que hay y la relación institucional se
          ancla al pie, así que la holgura se reparte arriba y
          abajo en vez de abrirse un hueco.

          Es la composición que mandó el cliente el 12 sep 2026:
          todo centrado, la firma apilada con su filete, y los
          logos al pie diciendo la relación. */}
      <section className="relative hidden grid-rows-[1fr_auto] gap-8 overflow-hidden bg-marca p-10 text-marca-texto lg:grid">
        {/* LAS SEÑAS DE ESTUDIO, las mismas de las pantallas
            públicas. Las dibujó el cliente en su montaje del 12
            sep 2026: birrete, libro, lápiz, diploma, bombilla y
            portátil, de trazo y al 5-7 %.

            Van en `currentColor`, que aquí es el texto del panel
            —blanco sobre el verde—, y no en `text-marca`, que
            sobre el propio color de la marca no se vería.

            La clase `fondo-publico` no es decorativa: es donde
            `globals.css` declara `--px` y `--py` en cero, y sin
            ellas el `calc()` de las capas de deriva queda inválido
            y el navegador tira el `transform`. Aquí no hay
            desplazamiento con el ratón —ese lo escribe
            `FondoPublico` sobre su propio nodo—, así que las
            figuras solo derivan despacio con sus fotogramas, que
            es lo que quiere una pantalla donde alguien teclea una
            contraseña. */}
        <div
          aria-hidden
          className="fondo-publico no-imprimir pointer-events-none absolute inset-0 overflow-hidden"
        >
          <SenasDeEstudio />
        </div>

        {/* LA MARCA Y LA PROMESA, centradas en lo que sobra.

            TODO A ESCALA DE PORTADA, y no es capricho: este panel
            mide media pantalla --960 px en un monitor de 1920-- y
            con los tamaños de una cabecera normal se veía
            perdido. «Se ve la letra pequeña en un panel con tanto
            espacio, ¿no?» (cliente, 12 sep 2026). El signo va a
            72, el nombre a 2,375rem, el titular a 2,5rem y la
            frase a 1rem. */}
        {/* UN POCO POR ENCIMA DEL CENTRO, no centrado a secas.
            `pb-[7%]` le quita ese 7 % a la mitad de abajo, así que
            el bloque sube y la fila de los logos respira: «esto
            como más arriba para que abajo quede limpio» (cliente,
            12 sep 2026). Es un empujón, no una mudanza: alinear el
            bloque arriba devolvería el agujero de 496 px que este
            rediseño vino a quitar. */}
        <div className="relative flex min-h-0 flex-col items-center justify-center pb-[7%] text-center">
          {/* UN RESPLANDOR, NO EL SIGNO DIBUJADO.

              Aquí hubo tres intentos y los tres se veían mal, así
              que conviene dejar escrito por qué:

              1. El signo a 620 px, centrado en el panel: «¿para
                 qué saturarlo?».
              2. Más ancho y centrado en el texto: el disco quedaba
                 suelto entre el párrafo y los logos, «ese círculo
                 hace perder la fluidez».
              3. El signo entero, atado al alto para que no
                 solapara --medido, no solapaba en ninguna
                 ventana--: «siento que se ve raro».

              Y era verdad. EL PROBLEMA NO ERA EL TAMAÑO NI LA
              POSICIÓN: era que a esa escala el trazo del signo es
              una banda de 70 px y el corro está abierto abajo, así
              que la forma se lee como una herradura o un imán.
              Reconocible en pequeño, absurda en grande. Una marca
              de agua funciona difusa, no reconocible.

              EL SIGNO NO SE VA --«pero no es borrarlo» (cliente,
              12 sep 2026)--: se suaviza. Son DOS capas, y hacen
              falta las dos:

              - EL RESPLANDOR, un degradado redondo sin forma
                reconocible. Es lo que el cliente había dibujado en
                su montaje: da la sensación de contenedor, las
                letras dentro de algo.
              - EL SIGNO ENCIMA, entero y al 3 %. A esa opacidad
                deja de leerse como una herradura dibujada y pasa a
                ser el borde del propio resplandor: se reconoce si
                uno lo busca y no se impone si no.

              Los dos van en `currentColor` y no en blanco: en el
              tema claro el panel es verde oscuro con texto blanco
              y aclaran; en oscuro la paleta aclara la marca y
              oscurece el texto, así que el mismo `currentColor`
              oscurece. Una regla para las dos paletas y para las
              dieciséis plantillas. */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-[46.5%] left-1/2 aspect-square w-[118%] -translate-x-1/2 -translate-y-1/2 opacity-[0.09]"
            style={{
              background:
                "radial-gradient(circle at center, currentColor 0%, transparent 62%)",
            }}
          />

          {/* El signo, atado al ALTO de la fila --92 % con
              `aspect-square`-- para que no pueda alcanzar la fila
              de los logos en ninguna ventana; con el ancho como
              medida el solape volvía en cuanto la pantalla era
              ancha y baja. Y desplazado al 35,5 %, que es donde
              está el centro del corro dentro del lienzo --no en el
              medio, porque abajo va el disco--, para que el texto
              caiga DENTRO del corro. Medido: 50-61 px de aire
              entre el disco y los logos de 1280x720 a 1920x1080. */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-[46.5%] left-1/2 aspect-square h-[92%] -translate-x-1/2 -translate-y-[35.5%] opacity-[0.03]"
          >
            <SignoConvoca className="h-full w-full" />
          </div>

          {/* EL FILETE lo dibuja la firma y no esta pantalla, y
              por eso `filete`: dentro de la firma puede medir
              exactamente lo que mide el lema --«la línea a la par
              de: relaciones que generan resultados» (cliente, 12
              sep 2026)--, y aquí fuera solo se podía poner un
              ancho a ojo que no lo seguía al cambiar de ventana. */}
          <FirmaConvoca tamano={72} apilado animado filete />

          <div
            className="login-entra"
            style={{ "--retraso": "980ms" } as React.CSSProperties}
          >
            {/* EL ANCHO EN CARACTERES Y EL CORTE EQUILIBRADO.
                `max-w-[24ch]` en vez de un ancho en rem para que
                el titular parta siempre en dos renglones sea cual
                sea el cuerpo de letra; y `text-balance`, que es
                lo que evita el corte feo: a 20ch partía en «De
                los cupos apartados a / las personas formadas» y
                dejaba la preposición huérfana al final del
                renglón. Equilibrado parte por donde se lee.
                A 2rem hasta xl: en un portátil de 1280 el panel
                mide 640 y a 2,5rem el titular se iba a tres
                renglones. */}
            <h2 className="mt-9 max-w-[24ch] text-[2rem] leading-[1.15] font-bold text-balance xl:text-[2.5rem]">
              De los cupos apartados a las personas formadas.
            </h2>
            {/* El 85 % no es decorativo: es el mínimo medido.
                Blanco al 85 % MEZCLADO con el verde del gremio da
                4,6:1 y pasa el 4,5 que pide este tamaño; al 80 %
                da 4,4:1 y al 70 % se queda en 3,8:1. La cuenta va
                con el color compuesto: `getComputedStyle` sigue
                devolviendo blanco puro y engaña. */}
            <p className="mx-auto mt-5 max-w-[46ch] text-[1rem] leading-relaxed opacity-85">
              Aquí se sigue cada organización que reservó, cada persona inscrita
              y cómo avanza su formación.
            </p>
          </div>
        </div>

        {/* LA RELACIÓN INSTITUCIONAL, al pie. */}
        <RelacionDeMarca />
      </section>

      {/* `bg-superficie` y no el fondo de la página: en el montaje
          del cliente este lado es BLANCO, no el verde muy claro
          que usa el resto del sitio, y así el corte entre las dos
          mitades es limpio. Va por token, no en blanco fijo: en
          tema oscuro tiene que ser oscuro.
          De paso mejora el contraste del pie y de los textos
          suaves, que sobre `--fondo` iban al filo (4,51:1) y sobre
          la superficie dan 4,79:1. */}
      {/* DOS FILAS, IGUAL QUE EL PANEL DE AL LADO, para que el pie
          caiga a la altura de los logos: «más abajo, como a la par
          de donde están los logos, o sea a esa línea» (cliente, 12
          sep 2026).

          Las dos mitades comparten ahora la misma retícula
          --`grid-rows-[1fr_auto]`-- y el mismo relleno de 40 px,
          así que la fila de abajo de cada lado apoya en la misma
          línea: los logos a la izquierda y la nota legal a la
          derecha. Antes el pie iba dentro del bloque del
          formulario, o sea pegado a él y con 290 px de nada
          debajo. */}
      <section className="relative grid grid-rows-[1fr_auto] justify-items-center gap-8 bg-superficie p-6 lg:p-10">
        <div className="absolute top-4 right-4">
          <ConmutadorTema compacto />
        </div>

        {/* CENTRADO, como el panel de al lado: los dos lados de
            la pantalla comparten eje y la puerta se lee como una
            sola pieza y no como dos columnas pegadas. */}
        {/* `max-w-md` y no `max-w-sm`: parte de que la letra se
            viera pequeña era el CONTENEDOR. Una columna de 960 px
            con el contenido metido en 384 deja el formulario como
            una tarjeta perdida en el medio; a 448 el conjunto
            guarda proporción con el panel de al lado. */}
        <div className="flex w-full max-w-md flex-col justify-center text-center">
          {/* En movil el panel de marca no existe, asi que
              esta es la unica cabecera. */}
          <div className="mb-9 flex flex-col items-center gap-6 lg:hidden">
            <FirmaConvoca tamano={44} apilado animado />
            <LogosDelGremio alto="h-8" />
          </div>

          {/* El lado derecho entra escalonado, DETRAS de la
              firma: el saludo, los campos y el boton.

              Empieza a los 700 ms, que es cuando la firma ya ha
              dicho lo suyo. Antes se leerian como dos cosas
              pasando a la vez. */}
          <div
            className="login-entra"
            style={{ "--retraso": "700ms" } as React.CSSProperties}
          >
            {/* 2rem, un escalón por debajo del nombre del panel
                (2,375rem): las dos mitades tienen que leerse como
                una sola pantalla, y quien manda es la marca. */}
            <h1 className="text-[2rem] leading-tight font-bold">Bienvenido</h1>
            <p className="mt-2 text-[1rem] text-texto-suave">
              Entre con el correo con el que le crearon la cuenta.
            </p>
          </div>

          <form
            onSubmit={enviar}
            className="login-entra mt-8 space-y-4 text-left"
            style={{ "--retraso": "840ms" } as React.CSSProperties}
          >
            <label className="block">
              <span className="mb-2 block text-[0.9375rem] font-medium">Correo</span>
              <input
                required
                type="email"
                autoComplete="username"
                /// El ejemplo, no una instrucción: quien entra ya
                /// sabe que es un correo, y el rótulo lo dice. El
                /// ejemplo sirve para otra cosa —deja claro que va
                /// el correo entero y no el usuario a secas—.
                placeholder="nombre@correo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className={clase}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[0.9375rem] font-medium">Contraseña</span>
              <div className="relative">
                <input
                  required
                  type={verClave ? "text" : "password"}
                  autoComplete="current-password"
                  /// Se mira al PULSAR y al SOLTAR. Solo con `keyup` no se
                  /// entera hasta la segunda letra; solo con `keydown`, la
                  /// propia tecla Bloq Mayus no se refleja hasta la
                  /// siguiente.
                  onKeyDown={mirarMayusculas}
                  onKeyUp={mirarMayusculas}
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  className={clase + " pr-11"}
                />
                {/* El ojito, y no es comodidad.

                    Una contraseña que no se puede leer se teclea a
                    ciegas, y en un teclado ajeno o con el movil en la
                    mano eso es la mitad de los «correo o contraseña
                    incorrectos».

                    `tabIndex={-1}`: el tabulador va del campo al boton
                    de entrar, que es lo que espera quien escribe. */}
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setVerClave((v) => !v)}
                  aria-label={verClave ? "Ocultar la contraseña" : "Ver la contraseña"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-texto-suave transition hover:text-texto"
                >
                  <Ojo abierto={verClave} />
                </button>
              </div>

              {/* Bloq Mayus, que es la otra mitad del problema.

                  Con la contraseña en puntos no hay forma de verlo, y el
                  mensaje que sale despues dice «incorrectos» sin decir
                  por que. Se avisa MIENTRAS escribe, no al fallar. */}
              {mayusculas && (
                <p className="mt-2 text-[0.875rem] text-aviso" role="status">
                  Tiene el Bloq Mayus activado.
                </p>
              )}
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-error/30 bg-error-suave p-3.5 text-left text-[0.9375rem] text-error"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={entrando}
              className="w-full rounded-xl bg-marca px-5 py-3.5 text-[1.0625rem] font-semibold text-marca-texto transition hover:bg-marca-fuerte disabled:opacity-50"
            >
              {entrando ? "Entrando…" : "Entrar"}
            </button>
          </form>

          {/* DOS RENGLONES Y NO UNO.
              «¿No tiene cuenta?» es la pregunta y «Las crea un
              administrador del sistema» es la respuesta: en un
              solo renglón se leían como una frase de relleno.
              Partidas, la respuesta se ve. */}
          <p className="mt-7 text-[0.875rem] leading-relaxed text-texto-suave">
            ¿No tiene cuenta?
            <br />
            <strong className="font-semibold text-texto">
              Las crea un administrador del sistema.
            </strong>
          </p>

        </div>

        {/* EL PIE LEGAL, EN LA SEGUNDA FILA DE LA RETÍCULA y no
            dentro del bloque del formulario.

            Dentro iba pegado al formulario --un `mt-10` y a
            seguir-- con casi 300 px de nada por debajo. Como fila
            propia apoya en el relleno de abajo de la sección, que
            es el mismo que el del panel de la izquierda, así que
            queda a la altura de los logos.

            Sigue en el lado del formulario porque es el único que
            se ve en el teléfono. Sin `mt`: ahora la separación la
            pone el `gap` de la retícula. */}
        <PieDeConvoca apilado className="text-center" />
      </section>
    </div>
  );
}

/**
 * LOS LOGOS DEL GREMIO, sin placa.
 *
 * Los del panel de marca van DIRECTOS sobre el color de la
 * marca, sin la tarjeta blanca que tenían: la placa era un
 * parche para un archivo con el nombre en negro, y desde que el
 * gremio subió sus dos variantes ya no hace falta. Un ladrillo
 * blanco en medio de un panel de color se ve como lo que era, un
 * parche.
 *
 * `alto` lo pone quien monta: al pie del panel van a 32 y en
 * móvil a 32 también, pero el rótulo manda sobre el renglón y
 * conviene poder cambiarlo en un sitio.
 */
function LogosDelGremio({
  alto,
  sobreLaMarca = false,
}: {
  alto: string;
  /// Si el fondo es el COLOR DE LA MARCA en vez de la superficie
  /// de la página. Cambia qué variante toca, y no es un detalle:
  /// con la variante equivocada el nombre del gremio desaparece.
  sobreLaMarca?: boolean;
}) {
  const logos = variantesVisibles(useMarca(), sobreLaMarca);

  if (!logos.length) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
      {logos.map((l) => (
        <PiezaDeLogo key={l.id} logo={l} alto={alto} />
      ))}
    </div>
  );
}

/**
 * «Gestionado por [AE] para [ADECOPRIA]», al pie del panel.
 *
 * Es la misma frase que la tarjeta de los formularios públicos,
 * y por la misma razón: tres logos en fila obligan a adivinar
 * qué pinta cada uno, y con dos rótulos de ocho letras se lee la
 * relación completa. El ORDEN de los logos es el que manda —el
 * primero es el gestor—, y se cambia en Apariencia sin tocar
 * código.
 */
function RelacionDeMarca() {
  const [gestor, ...para] = variantesVisibles(useMarca(), true);

  if (!gestor) return null;

  return (
    /// LOS LOGOS, CON PRESENCIA.
    ///
    /// Estuvieron a 32 y 28 px de alto y al pie de un panel de
    /// 960: «los logos de abajo casi que perdidos» (cliente, 12
    /// sep 2026). Tenía razón, y el arreglo no es solo hacerlos
    /// más grandes: la fila entera sube de rango --logos a 56 y
    /// 48, rótulos a 12 px, y un filete corto encima que la
    /// separa de la promesa--. Así se lee como el pie de firma de
    /// un documento y no como dos pegatinas olvidadas.
    <div
      className="login-entra relative flex flex-col items-center"
      style={{ "--retraso": "1120ms" } as React.CSSProperties}
    >
      {/* SIN RAYA ENCIMA. La puso este mismo cambio para separar
          la fila de la promesa y el cliente la quitó a la vuelta:
          «la línea que está abajo en el círculo se elimina» (12
          sep 2026). Caía justo sobre el disco del signo del fondo,
          así que en vez de separar dos bloques parecía tachar el
          dibujo. El aire hace el trabajo. */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
        <Rotulo>Gestionado por</Rotulo>
        <PiezaDeLogo logo={gestor} alto="h-14" />
        {para.length > 0 && <Rotulo>para</Rotulo>}
        {para.map((l) => (
          <PiezaDeLogo key={l.id} logo={l} alto="h-12" />
        ))}
      </div>
    </div>
  );
}

/// El rótulo que une las marcas: pequeño, en versalitas y con
/// aire entre letras. Es una preposición, no un titular.
///
/// Al 85 % y no al 70 %: sobre el color de la marca, 10 px al
/// 70 % dan 3,8:1 y no llegan al 4,5 que pide ese tamaño.
function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.75rem] font-semibold tracking-[0.16em] whitespace-nowrap uppercase opacity-85">
      {children}
    </span>
  );
}

function PiezaDeLogo({ logo, alto }: { logo: Logo; alto: string }) {
  return (
    // <img>: tamano desconocido y ya viene cacheado
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={urlLogo(logo)}
      alt={logo.etiqueta}
      className={`w-auto max-w-[13rem] object-contain ${alto}`}
    />
  );
}

/**
 * QUÉ VARIANTE DE CADA LOGO TOCA.
 *
 * Cada logo dice en qué tema sale (`AMBOS`, `CLARO`, `OSCURO`):
 * son archivos cerrados, hechos para papel, y el de ADECOPRIA
 * viene con el nombre en negro y otro con el nombre en blanco.
 * No se pueden recolorear como el signo de Convoca, que va en
 * `currentColor`.
 *
 * SOBRE EL COLOR DE LA MARCA LA CUENTA SE INVIERTE, y esto es lo
 * que no es obvio: en el tema CLARO la marca es el verde oscuro
 * del gremio, así que ahí va la variante de fondo OSCURO —la del
 * nombre en blanco—; y en el tema oscuro la paleta aclara la
 * marca, así que toca la variante CLARA. Filtrar por el tema de
 * la página, como hace el resto del sistema, deja el nombre del
 * gremio invisible justo en el tema normal.
 */
function variantesVisibles(
  { marca, esquema }: ReturnType<typeof useMarca>,
  sobreLaMarca: boolean,
): Logo[] {
  const fondo = sobreLaMarca
    ? esquema === "CLARO"
      ? "OSCURO"
      : "CLARO"
    : esquema;

  return (marca?.logos ?? []).filter(
    (l) => l.esquema === "AMBOS" || l.esquema === fondo,
  );
}

/**
 * El ojo, dibujado y no importado.
 *
 * Mismo criterio que `iconos.tsx`: traerse un paquete de mil
 * iconos por uno engorda el bundle y añade algo que mantener.
 * Toma el color del texto, así que sirve en las dos paletas.
 */
function Ojo({ abierto }: { abierto: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {/* Tachado cuando la contraseña está A LA VISTA: el icono
          dice lo que pasa AHORA, no lo que hace el botón. Al
          revés, quien lo mira cree que está oculta. */}
      {abierto && <path d="m4 4 16 16" />}
    </svg>
  );
}
