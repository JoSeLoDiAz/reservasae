"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { ConmutadorTema, useMarca } from "@/components/marca-publica";

import { FirmaConvoca, PieDeConvoca } from "@/components/firma-convoca";
import { PantallaDeCarga, useEsperaCompleta } from "@/components/pantalla-de-carga";

import { SignoConvoca } from "./signo-convoca";
import {
  adminApi,
  logosSobrePlaca,
  MAXIMO_LOGOS,
  urlLogo,
  type AdminActual,
  type Area,
  type Nivel,
} from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import {
  cssDelTemaPropio,
  EVENTO_TEMA_PROPIO,
  llaveTemaPropio,
  temaPropioApi,
  type TemaPropio,
} from "@/lib/tema-propio";

import { PanelAccesibilidad } from "./accesibilidad";
import { CambioDeClaveObligatorio } from "./cambio-clave";
import { ICONO_DE_MODULO, IconoResumen,
  IconoAccesibilidad,
  IconoCerrar,
} from "./iconos";
import { enlacesVisibles, estaActivo, MODULOS } from "./navegacion";
import { Desplegable } from "./desplegable";
import { FilaDeMarca, FilaDeModulos, ROTULO } from "./cabecera-topbar";

type Contexto = {
  admin: AdminActual;
  refrescar: () => Promise<void>;
  /// El gremio que se eligió arriba. Acota TODO el panel.
  /// Null quiere decir «todos los que pueda ver esta cuenta».
  gremio: string | null;
  elegirGremio: (convenioId: string | null) => void;
  /// Los gremios a los que esta cuenta tiene acceso.
  gremios: Array<{ convenioId: string; sigla: string }>;
};

const ContextoAdmin = createContext<Contexto | null>(null);

export function useAdmin(): Contexto {
  const valor = useContext(ContextoAdmin);
  if (!valor) throw new Error("useAdmin fuera del marco del panel.");
  return valor;
}

/// Los rotulitos de la barra: «Seleccione Gremio», «Panel de
/// gestion», «Ajustes». Todos son lo mismo -- el nombre de lo
/// que viene debajo -- y se ven igual. Uno de ellos llevaba
/// otro peso y otro espaciado, y por eso no se leian como
/// hermanos.
/// `ROTULO` se fue a `cabecera-topbar.tsx`, con su cuenta de
/// contraste y el por qué. Se mudó para que la dependencia entre
/// los dos ficheros vaya en un solo sentido: este importa la
/// cabecera, así que la constante no puede vivir aquí sin cerrar
/// un ciclo.

/// El gremio elegido sobrevive al refresco: cambiarlo en cada
/// carga obligaria a re-elegirlo diez veces al dia.
const LLAVE_GREMIO = "convoca:gremio";

type Permisos = Record<Area, Nivel> | undefined;

export function MarcoAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();

  const [admin, setAdmin] = useState<AdminActual | null>(null);
  const [cargando, setCargando] = useState(true);
  const [bloqueo, setBloqueo] = useState<string | null>(null);
  const [cajon, setCajon] = useState(false);
  /// Si la fila de módulos entra en pantalla. Lo dice ella, que es
  /// quien se mide; aquí solo se usa para saber si hace falta el
  /// cajón. NO es un umbral de ancho: con zoom, o con la letra al
  /// 140 %, una pantalla anchísima puede no tener sitio.
  const [filaCabe, setFilaCabe] = useState(true);
  const [gremio, setGremioEstado] = useState<string | null>(null);

  /// Aquí vivía un «cinturón encima de los tirantes»: un
  /// listener que devolvía a cero el `scrollTop` del marco en
  /// `scroll` y en `focusin`.
  ///
  /// Se quitó porque era CÓDIGO MUERTO, y del peor tipo: el
  /// que parece estar protegiendo algo. El marco lleva
  /// `overflow: clip`, así que no es contenedor de scroll —
  /// nunca emite `scroll`, y su `scrollTop` es 0 por
  /// construcción, de modo que asignárselo no hace nada. El
  /// `focusin` sí le llegaba, pero corregía el único
  /// desplazamiento que no podía existir.
  ///
  /// El que sí puede desplazarse es `.barra-visible`, y ese
  /// DEBE poder hacerlo: es justamente cómo se llega a Ajustes
  /// cuando la ventana es baja. Devolverlo a cero rompería lo
  /// que se arregló al meter Ajustes dentro de esa columna.

  /// Ya no se lee el plegado de la barra: la barra no existe.
  /// `LLAVE_GREMIO` sí se queda, y con su nombre exacto: la leen
  /// por su cuenta seis ficheros de `lib/`, así que es un
  /// contrato, no un detalle de este componente.
  useEffect(() => {
    try {
      setGremioEstado(window.localStorage.getItem(LLAVE_GREMIO));
    } catch {
      // en privado localStorage puede fallar
    }
  }, []);

  /// Con el gremio fijado por la dirección manda el servidor.
  ///
  /// Un `localStorage` de la visita anterior pintaría arriba
  /// el gremio equivocado mientras las tablas muestran el de
  /// la dirección, que es justo la mentira que el selector
  /// existe para evitar.
  const gremioActivo = admin?.gremioFijo
    ? (admin.gremioElegido ?? null)
    : gremio;

  const elegirGremio = useCallback(
    (convenioId: string | null) => {
      setGremioEstado(convenioId);
      try {
        if (convenioId) window.localStorage.setItem(LLAVE_GREMIO, convenioId);
        else window.localStorage.removeItem(LLAVE_GREMIO);
      } catch {
        // igual que arriba
      }

      /// Y se recarga la pantalla entera.
      ///
      /// Sin esto, cambiar de gremio deja a la vista los datos
      /// del anterior hasta que uno navegue a otro sitio: la
      /// cabecera nueva solo viaja en las peticiones que
      /// vengan DESPUÉS. Una tabla que dice ADECOPRIA arriba y
      /// enseña filas de BRITCHAM es peor que no tener el
      /// selector.
      ///
      /// `router.refresh()` no basta: lo que hay que rehacer
      /// son los `fetch` del cliente, no el render del
      /// servidor.
      window.location.reload();
    },
    [],
  );

  const cargar = useCallback(async () => {
    try {
      setAdmin(await adminApi.yo());
      setBloqueo(null);
    } catch (e) {
      // /admin/yo si responde con la clave sin cambiar
      if (e instanceof ErrorApi && e.estado === 401) {
        router.replace("/admin/login");
        return;
      }
      /// Un 403 aquí es la puerta equivocada, no una avería.
      ///
      /// El servidor manda el motivo -- que su cuenta no
      /// trabaja en ese gremio, o que esa dirección es solo
      /// de administración general -- y hasta ahora nadie lo
      /// leía: la pantalla se quedaba en blanco y parecía
      /// que el sistema estaba roto.
      if (e instanceof ErrorApi && e.estado === 403) {
        setBloqueo(e.message);
        return;
      }
      throw e;
    } finally {
      setCargando(false);
    }
  }, [router]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /// La pantalla de carga, hasta que complete su vuelta.
  const esperando = useEsperaCompleta(cargando);

  if (esperando || cargando) {
    /// Esta es la pantalla ENTERA, antes de que exista el
    /// marco: no hay barra, ni miga, ni nada. Un renglón en la
    /// esquina de arriba no se lee como «espere», se lee como
    /// que la aplicación se rompió al abrirla.
    /// Y desde el 11 sep 2026 es la misma que ven las pantallas
    /// públicas: el signo que se llena. El «Entrando…» con el aro
    /// girando era justo el indicador del que la marca se separa.
    return <PantallaDeCarga que="Entrando" />;
  }

  if (bloqueo) {
    return (
      <div className="mx-auto max-w-lg p-10">
        <div className="rounded-xl border border-aviso/30 bg-aviso-suave p-5 text-aviso">
          <p className="font-medium">Por aquí no puede entrar</p>
          <p className="mt-1 text-sm">{bloqueo}</p>
        </div>
        <button
          type="button"
          onClick={() => void salir()}
          className="mt-4 text-sm font-medium text-marca underline"
        >
          Cerrar sesión y entrar por otra dirección
        </button>
      </div>
    );
  }

  if (!admin) return null;

  // el panel queda bloqueado hasta cambiar la clave
  if (admin.debeCambiarClave) {
    return <CambioDeClaveObligatorio alTerminar={cargar} />;
  }

  async function salir() {
    await adminApi.cerrarSesion();
    router.replace("/admin/login");
  }

  const esSuperadmin = admin.rol === "SUPERADMIN";

  /// Los gremios los manda `/admin/yo` ya resueltos: nunca
  /// se ofrece uno al que esta cuenta no tenga acceso, porque
  /// el backend solo pone los suyos.
  const gremios = admin.gremios ?? [];

  return (
    <ContextoAdmin.Provider
      value={{ admin, refrescar: cargar, gremio: gremioActivo, elegirGremio, gremios }}
    >
      <a href="#contenido" className="salto-al-contenido no-imprimir">
        Saltar al contenido
      </a>

      {/* Sus colores, encima de los del sistema. Ver `TemaPropioDelPanel`. */}
      <TemaPropioDelPanel adminId={admin.id} />

      {/* `h-screen`, no `min-h-screen`.

          Con el mínimo, la página crecía con el contenido: la lista de
          leads medía 22.000 píxeles y TODO se iba hacia arriba al bajar
          — los filtros, el buscador y los títulos de las columnas. Para
          filtrar había que devolverse hasta arriba.

          Con la altura fija, la ventana manda: lo que scrollea es la
          tabla por dentro, y su barra de filtros y su cabecera se
          quedan donde uno las puede alcanzar.

          Pero la altura se RESTA la franja de pruebas, igual que la
          barra lateral. Con `h-screen` a secas el contenedor medía
          100vh empezando 2,25rem más abajo, así que el body sobraba
          por la altura de la franja: quedaba una banda que se movía
          sola al bajar y la cabecera pegada tapaba el saludo. En
          producción no se veía porque allí no hay franja. */}
      {/* `overflow-clip`, NO `hidden`. Recortan igual, pero
          `hidden` crea un CONTENEDOR DE SCROLL — uno sin barra
          visible, que es lo peor de los dos mundos.

          El fallo que arregla: al pulsar el conmutador de tema
          —el último control de la barra lateral— el navegador
          le da el foco, y con el foco viene el desplazamiento
          automático para revelarlo. Si esa caja quedaba por
          debajo del borde (ventana baja, zoom, o el texto por
          encima del 100 %), el navegador subía TODO el marco
          dentro de su caja: la cabecera se recortaba por
          arriba, la barra enseñaba solo su parte de abajo
          flotando a media altura, y quedaba una franja en
          blanco al final. Sin barra de scroll no había forma
          de devolverlo: se quedaba así hasta recargar.

          Parecía un fallo del tema y no lo era: `data-tema`
          solo define colores —cero reglas de layout en todo el
          CSS—. Era el botón que estaba en el peor sitio.

          Con `clip` no hay nada que desplazar, así que da igual
          dónde caiga el control. */}
      {/* EN COLUMNA, no en fila, desde el 12 sep 2026.

          Aquí había una fila: [barra lateral][cajón][columna con
          cabecera, main y pie]. Ahora son dos bandas de cabecera
          --66 y 54 px-- y `<main>` debajo, que es el armazón que
          mandó el cliente con su montaje de diseño.

          Lo que cuesta y hay que tener presente: `<main>` pierde
          64 px de alto útil (56 → 120), y en `prueba.` hay además
          36 px de franja. La contabilidad vertical sigue siendo
          solo de aquí, y la franja se resta UNA vez. */}
      <div
        style={{ height: "calc(100vh - var(--franja-alto, 0px))" }}
        /// `marco-panel` es la señal para `globals.css`: mientras
        /// este marco esté montado, el DOCUMENTO no scrollea. Sin
        /// eso, esta columna de altura fija se sube entera y la
        /// cabecera desaparece --ver el comentario largo de la regla
        /// `html:has(.marco-panel)`--.
        className="marco-panel flex flex-col overflow-clip"
      >
        <div className="no-imprimir shrink-0">
          <FilaDeMarca />
          <FilaDeModulos
            ruta={ruta}
            esSuperadmin={esSuperadmin}
            permisos={admin.permisos}
            admin={admin}
            gremios={gremios}
            gremio={gremioActivo}
            alElegirGremio={elegirGremio}
            alSalir={salir}
            alAbrirMenu={() => setCajon(true)}
            alMedir={setFilaCabe}
            migas={<Migas ruta={ruta} />}
            /* LA RANURA TIENE QUE EXISTIR SIEMPRE, con su id.
               `AccionesDePagina` la resuelve UNA vez en un efecto
               de dependencias vacías y devuelve `null` sin avisar
               si no la encuentra; y sus tres consumidores son
               ellos mismos condicionales, así que un fallo aquí se
               vería como «esta pantalla perdió sus botones» en
               Campañas, Plantillas e Inscritos. */
            ranura={
              <div
                id={RANURA_ACCIONES}
                className="flex min-w-0 shrink-0 items-center gap-2"
              />
            }
          />
        </div>

        {/* El cajón existe SOLO cuando la fila no entra, y eso lo
            decide la medida, no un ancho. Montado siempre y
            escondido por CSS volvía a ser el fallo de antes: dos
            cortes distintos que dejaban una franja con la fila
            escondida por estrecha y el cajón escondido por ancho,
            o sea una hamburguesa que no hacía nada. */}
        {!filaCabe && (
          <CajonMovil
            abierto={cajon}
            alCerrar={() => setCajon(false)}
            ruta={ruta}
            esSuperadmin={esSuperadmin}
            permisos={admin.permisos}
            gremios={gremios}
            gremio={gremioActivo}
            alElegir={elegirGremio}
          />
        )}

        <div className="flex min-h-0 min-w-0 grow flex-col">
          <main
            id="contenido"
            tabIndex={-1}
            /// `overflow-y-auto` para que las fichas largas —que sí se
            /// leen de arriba abajo— sigan pudiéndose recorrer. Las
            /// pantallas de tabla no lo usan: su contenido cabe porque
            /// la tabla scrollea por dentro.
            /// Sin relleno lateral: las secciones van A SANGRE.
            ///
            /// El redisenio no apila tarjetas sobre un fondo,
            /// apila bandas que ocupan el ancho entero y se
            /// separan por una raya. El relleno lo pone cada
            /// banda por dentro (28px), no el contenedor: si lo
            /// pusiera el contenedor, las rayas se quedarian
            /// cortas y flotando en vez de cruzar la pantalla.
            className="flex w-full min-h-0 grow flex-col overflow-y-auto overscroll-contain"
          >
            {/* Sin tope de ancho: son tablas de trabajo y en un
                monitor ancho `max-w-6xl` las dejaba espichadas.
                Cada pantalla decide que bloques suyos se quedan
                cortos, que es donde de verdad importa. */}
            {/* `contents`, NO un flex item más.

                Esto era `flex min-h-0 w-full grow flex-col`, y ahí
                estaba el fallo que el cliente vio en Usuarios: la
                cabecera desaparecía y el pie quedaba a media página
                con un blanco debajo (12 sep 2026).

                Medido: este envoltorio quedaba clavado en el alto
                del hueco --688 px-- mientras el contenido de la
                pantalla medía 1.894 en Usuarios y 5.335 en
                Apariencia. El hijo se escapaba de su padre con
                `overflow: visible`, y ese escape estiraba el
                DOCUMENTO (+213 px y +1.279). Con el documento
                scrolleable, se sube la columna de 100vh ENTERA y la
                cabecera se va de la pantalla; y como `overflow-clip`
                no deja barra, no hay forma de devolverla.

                Era un nivel de flex de sobra. Con `contents`, la
                raíz de cada pantalla es hija directa de `<main>`, y
                eso sirve a los DOS casos que hay en el panel:

                  - un formulario o prosa (raíz sin `grow`) crece a
                    lo que mida y lo scrollea `<main>`;
                  - una tabla (raíz con `min-h-0 grow`) resuelve su
                    alto contra `<main>`, que sí tiene altura
                    definida, y scrollea por dentro como siempre.

                El `w-full` se va con él y no hace falta: `<main>` ya
                es `w-full`. */}
            {children}

          </main>

          {/* El pie del panel, HERMANO de `<main>` y no dentro.

              Dentro estaba mal, y se vio: `<main>` es el que
              scrollea y su hijo lleva `min-h-0`, asi que se
              dimensiona al hueco disponible y el contenido, mas
              alto, se pintaba POR ENCIMA del pie. El pie salia
              flotando en mitad de la tabla.

              Aqui es una banda del marco, como la cabecera: una
              arriba y otra abajo, y `<main>` scrollea entre las
              dos. Asi no depende de cuanto mida el contenido, que
              es lo que lo rompia.

              Lleva fondo PROPIO (`bg-superficie`) y no
              transparente: sin el, el contenido se le ve por
              debajo al scrollear. Ese fue el otro sintoma.

              No lleva `.no-imprimir`: en papel es justo donde
              tiene sentido decir de quien es el documento. */}
          {/* MENUDO, para devolverle alto a la tabla.
              De 36 px a ~20: el pie baja a 10 px con interlineado
              apretado y el relleno de 8 a 3. Lo que se gana se lo
              queda `<main>`, que es donde está la tabla.
              Sigue SIN `.no-imprimir` a propósito: en papel es lo
              único que dice de quién es el documento. */}
          {/* LA PÍLDORA VIVE AQUÍ, NO FLOTANDO SOBRE EL CONTENIDO.
              Estaba `fixed` en la esquina y tapaba lo que hubiera
              debajo: medido el 21 sep 2026 a 1.366 px, cubría cinco
              celdas de la tabla de leads --«AF3», «Sin grupo», «Sin
              asignar»…-- y a 1.600 el rótulo «Datos completos». Un
              control del marco no puede esconder un dato.
              Sigue siendo del MARCO y no del contenido --esta banda
              no scrollea, igual que la cabecera-- y se queda en la
              misma esquina de siempre. Cuesta 24 px de alto, que
              sale de `<main>`: es lo que vale no tapar nada.
              `relative` para que la píldora se ancle aquí, y `z-40`
              para que su panel de accesibilidad --que se abre hacia
              arriba-- quede por encima del contenido. */}
          <footer className="relative z-40 flex min-h-[40px] shrink-0 items-center border-t border-borde bg-superficie px-7">
            <PieDeConvoca menudo />
            <Ajustes />
          </footer>
        </div>

      </div>
    </ContextoAdmin.Provider>
  );
}

/**
 * LOS COLORES DE QUIEN ENTRA, y de nadie más.
 *
 * La paleta general la pinta el proveedor de la marca; esta hoja va
 * DESPUÉS en el documento y con el mismo selector, así que gana solo
 * en las claves que esta persona eligió. Antes había una sola paleta y
 * el que la tocaba se la cambiaba a todos: «que sea individual, porque
 * si alguien modifica queda para todos» (cliente, 21 sep 2026).
 *
 * Primero pinta la copia local --sin ella cada recarga enseñaba medio
 * segundo la paleta general-- y luego la del servidor, que manda. Y
 * escucha el aviso de Apariencia para repintar al guardar, sin
 * recargar la página.
 */
function TemaPropioDelPanel({ adminId }: { adminId: string }) {
  const { marca } = useMarca();
  const [tema, setTema] = useState<TemaPropio | null>(null);

  useEffect(() => {
    let vivo = true;
    const llave = llaveTemaPropio(adminId);
    const recordar = (t: TemaPropio) => {
      try {
        window.localStorage.setItem(llave, JSON.stringify(t));
      } catch {
        // en privado localStorage puede fallar
      }
    };
    try {
      const copia = window.localStorage.getItem(llave);
      /// A propósito dentro del efecto: leer `localStorage` al crear
      /// el estado correría también en el servidor, donde no existe,
      /// y el cliente pintaría otra cosa que la entregada.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (copia) setTema(JSON.parse(copia) as TemaPropio);
    } catch {
      // una copia rota se ignora: manda la del servidor
    }
    void temaPropioApi
      .leer()
      .then((t) => {
        if (!vivo) return;
        setTema(t);
        recordar(t);
      })
      .catch(() => {
        // sin respuesta se queda la copia o la paleta general
      });
    const alCambiar = (e: Event) => {
      const t = (e as CustomEvent<TemaPropio>).detail;
      setTema(t);
      recordar(t);
    };
    window.addEventListener(EVENTO_TEMA_PROPIO, alCambiar);
    return () => {
      vivo = false;
      window.removeEventListener(EVENTO_TEMA_PROPIO, alCambiar);
    };
  }, [adminId]);

  const css = cssDelTemaPropio(tema, marca?.catalogoColores?.tokens);
  return css ? <style id="tema-propio" dangerouslySetInnerHTML={{ __html: css }} /> : null;
}

/** Dónde está uno: módulo y pantalla. */
function migas(ruta: string): string[] {
  for (const modulo of MODULOS) {
    for (const enlace of modulo.enlaces) {
      if (estaActivo(enlace, ruta)) {
        return [modulo.etiqueta, enlace.etiqueta];
      }
    }
  }

  /// SEGUNDA PASADA, POR PARENTESCO.
  ///
  /// La miga no se pierde nunca --es regla escrita del panel--, y
  /// sin esto se perdía en las pantallas que cuelgan de una
  /// entrada marcada como `exacto`: la ficha de una acción
  /// (`/admin/acciones/abc`) se quedaba en «Panel» desde que
  /// «Catálogo» pasó a ser exacto para no quedarse encendido
  /// estando en el cronograma.
  ///
  /// `exacto` es cosa de QUÉ SE ENCIENDE en el menú --ahí no
  /// puede haber dos-- y no de dónde está uno. Aquí manda el
  /// parentesco de la ruta, que es lo que contesta la miga.
  for (const modulo of MODULOS) {
    for (const enlace of modulo.enlaces) {
      if (ruta.startsWith(`${enlace.href}/`)) {
        return [modulo.etiqueta, enlace.etiqueta];
      }
    }
  }

  return ["Panel"];
}

/// La marca. Igual en la barra y en el cajón.
///
/// Dos cosas y en este orden: arriba los logos del cliente,
/// sobre su placa; debajo el signo de Convoca con su nombre y
/// su frase. En el panel de un gremio manda el gremio, y
/// Convoca firma abajo.
function Marca({ plegado }: { plegado?: boolean }) {
  /// La ruta, solo para remontar el signo al navegar.
  const ruta = usePathname();
  /// Se guarda CUALES fuentes fallaron, no un booleano.
  ///
  /// Con tres logos, uno roto se llevaria a los otros dos por
  /// delante. Solo aplica a los del cliente: el signo de
  /// Convoca va en linea y no puede fallar al cargar.
  const [fallidas, setFallidas] = useState<string[]>([]);
  const { marca } = useMarca();

  /// Los del gremio de la direccion, los que valen sobre placa
  /// blanca: la variante de texto blanco no se ve ahi.
  const logos = logosSobrePlaca(marca?.logos ?? [])
    .slice(0, MAXIMO_LOGOS)
    .map((l) => ({ ...l, url: urlLogo(l) }))
    .filter((l) => !fallidas.includes(l.url));

  /// El ancho que le toca a cada uno.
  ///
  /// La barra abierta da 260 px y el cajon 238, menos los
  /// huecos. Se reparte para que TRES quepan en una fila y uno
  /// solo pueda lucirse; y con `flex-wrap`, si aun asi no
  /// caben, bajan a otra fila en vez de espicharse.
  const anchoMaximo =
    logos.length >= 3 ? "5rem" : logos.length === 2 ? "7rem" : "10.5rem";

  return (
    <div className="flex flex-col items-center gap-3">
      {!plegado && logos.length > 0 && (
        /// Placa BLANCA fija, la misma excepción a los tokens
        /// que ya hace el login y que hace la franja.
        ///
        /// Un logo institucional se diseña para papel: tinta
        /// oscura sobre transparente. El fondo de esta barra lo
        /// elige el administrador, así que sin la placa el logo
        /// desaparece en modo oscuro — y también en claro si
        /// alguien pone el encabezado en un color fuerte.
        /// Con aro y sombra tenue, no un rectángulo pegado.
        ///
        /// La placa se ve sobre el color que elige el
        /// administrador —puede ser un verde fuerte— y sin nada
        /// que la remate parecía un parche de papel. El aro de
        /// negro al 5 % y la sombra suave la vuelven una tarjeta:
        /// la misma pieza que en las pantallas públicas
        /// (cliente, 11 sep 2026: «adapta el CRM para que no se
        /// vea feo sino profesional»).
        /// EN UNA FILA, no apilados.
        ///
        /// Con `flex-wrap` y el alto de antes (44 px) los dos
        /// logos no cabían en los 204 px útiles de la placa y
        /// ADECOPRIA bajaba a un segundo renglón: la barra
        /// arrancaba con un bloque blanco de 160 px de alto. A 36
        /// de alto miden 141 juntos y entran de sobra.
        <div className="mx-auto flex w-fit max-w-full flex-nowrap items-center justify-center gap-3 rounded-2xl bg-white px-3 py-2.5 ring-1 shadow-sm ring-black/5">
          {logos.map((l) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={l.id}
              src={l.url}
              alt={l.etiqueta}
              onError={() =>
                setFallidas((antes) =>
                  antes.includes(l.url) ? antes : [...antes, l.url],
                )
              }
              style={{ maxWidth: anchoMaximo }}
              className="h-9 w-auto shrink object-contain"
            />
          ))}
        </div>
      )}

      <Link
        href="/admin"
        // plegado no hay texto que lo nombre
        aria-label={plegado ? "Convoca CRM" : undefined}
        className="flex max-w-full items-center justify-center gap-2.5 no-underline"
      >
        {/* La MISMA firma que el login, el pie publico y la
            ficha del perfil, no una copia con los mismos
            estilos: cuatro copias acaban diciendo cuatro
            cosas. Plegada solo cabe el signo. */}
        {/* `key` con la ruta: al navegar el nodo se remonta y la
            animacion vuelve a correr. Sin la key, React reusa el
            mismo elemento y solo se dibujaria una vez, al entrar
            al panel. */}
        {plegado ? (
          <SignoConvoca
            key={ruta}
            tamano={34}
            animado
            className="shrink-0"
          />
        ) : (
          <FirmaConvoca key={ruta} tamano={42} animado />
        )}
      </Link>
    </div>
  );
}

/**
 * De qué gremio se está hablando.
 *
 * Va arriba del todo y no dentro de cada pantalla porque
 * acota el panel entero: mirar leads de un gremio y cupos de
 * otro es exactamente lo que hacía que los números no
 * cuadraran.
 *
 * Con un solo gremio no se ofrece desplegable: elegir entre
 * una cosa no es elegir, y un control muerto solo estorba.
 */
function SelectorGremio({
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
      <div className="rounded-lg border border-encabezado-borde/60 px-2.5 py-1.5">
        <span className={ROTULO + " block"}>
          Gremio
        </span>
        <span className="block truncate text-sm font-medium">{gremios[0].sigla}</span>
      </div>
    );
  }

  return (
    <label className="block">
      <span className={ROTULO + " mb-1.5 block"}>Seleccione Gremio</span>
      <Desplegable
        enBarra
        alto={34}
        marcador="Todos los gremios"
        valor={gremio ?? ""}
        opciones={[
          { valor: "", etiqueta: "Todos los gremios" },
          ...gremios.map((g) => ({
            valor: g.convenioId,
            etiqueta: g.sigla ?? g.convenioId,
          })),
        ]}
        alElegir={(v) => alElegir(v || null)}
      />
    </label>
  );
}

/**
 * El rótulo de lo que viene abajo.
 *
 * Arriba de él está la identidad -- qué panel es y de qué
 * gremio se está hablando --; debajo, por dónde se anda. Son
 * dos cosas distintas y conviene que se vea.
 *
 * Por eso la raya y el aire: pegado al desplegable, el
 * rótulo parecía su etiqueta y el menú arrancaba encaramado
 * en el borde de arriba.
 */
function RotuloDelPanel() {
  return <p className={ROTULO + " mt-7 mb-3"}>Panel de gestión</p>;
}

/**
 * La entrada al tablero, con nombre.
 *
 * Antes al tablero solo se llegaba por el logotipo. Eso no es
 * descubrible: nadie pulsa un logotipo esperando navegar, y no
 * habia forma de saber que se podia. El logotipo sigue
 * llevando -- quien ya lo sabia no pierde el atajo -- pero
 * ahora hay una fila que lo dice.
 *
 * Va fuera de «Panel de gestion» y encima del rotulo porque no
 * es un modulo: no agrupa pantallas, es una sola.
 */
function FilaResumen({
  ruta,
  plegado,
  alNavegar,
  alDesplegar,
}: {
  ruta: string;
  plegado?: boolean;
  alNavegar?: () => void;
  alDesplegar?: () => void;
}) {
  const activo = ruta === "/admin";

  if (plegado) {
    return (
      <Link
        href="/admin"
        title="Resumen — el tablero"
        onClick={() => {
          alNavegar?.();
          alDesplegar?.();
        }}
        className={`mb-2 flex h-[34px] w-[34px] items-center justify-center self-center rounded-full border transition ${
          activo
            ? "border-encabezado-texto bg-encabezado-texto text-encabezado-fondo"
            : "border-current/35 opacity-85 hover:border-current/70 hover:opacity-100"
        }`}
      >
        <IconoResumen tamano={17} />
      </Link>
    );
  }

  return (
    <Link
      href="/admin"
      onClick={alNavegar}
      className={`mt-3 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
        activo
          ? "bg-marca-suave text-marca"
          : "opacity-85 hover:bg-current/10 hover:opacity-100"
      }`}
    >
      <span className="shrink-0 leading-none">
        <IconoResumen tamano={17} />
      </span>
      Resumen
    </Link>
  );
}

/// `ChipUsuario` se fue el 12 sep 2026: quién está dentro lo
/// dice ahora `MenuDeUsuario`, en la fila 2 de la cabecera nueva,
/// con su avatar de iniciales y su menú. Lo que NO se perdió por
/// el camino es la medición que lo justificaba: el cargo y la
/// salida van al 78 % del texto del encabezado --5,62:1-- porque
/// en `--texto-suave` daban 1,69:1 sobre el verde, en las 38
/// pantallas. Está anotado en `cabecera-topbar.tsx`.

/**
 * Apariencia y accesibilidad, en una píldora flotante.
 *
 * Son ajustes: se tocan una vez y se dejan. Estuvieron arriba,
 * donde competían con las migas y con las acciones de cada
 * pantalla; luego al pie de la barra lateral; y desde el 12 sep
 * 2026 abajo a la DERECHA, flotando y pequeña. La razón de fondo
 * no ha cambiado en las cuatro mudanzas: no tienen que estar en el
 * camino.
 */
function Ajustes() {
  const [abierto, setAbierto] = useState(false);

  return (
    /// UNA PÍLDORA FLOTANTE ABAJO A LA DERECHA. El montaje del
    /// cliente la dibujaba a la izquierda y él la movió al verla
    /// en su sitio: en desarrollo, el distintivo de Next se planta
    /// en esa misma esquina y se le monta encima. Antes de todo
    /// esto era una caja al pie de la barra lateral, y la barra ya
    /// no existe.
    ///
    /// Se murió con ella la variante plegada, y con la variante el
    /// 🎛️: era el ÚNICO emoji que quedaba en el marco, y el
    /// criterio de la casa dice que no hay emoji. No se echa de
    /// menos.
    ///
    /// `.no-imprimir` NO es opcional: en papel los botones se van
    /// por la hoja de impresión pero el div se queda, y como esa
    /// hoja fuerza que los fondos se pinten, quedaría una cápsula
    /// vacía de color en mitad del PDF.
    ///
    /// `z-40`: por encima del contenido y de los desplegables de
    /// la cabecera (z-40 también, pero nunca coinciden en
    /// pantalla), y por debajo del cajón móvil (z-50), que tiene
    /// que poder taparla.
    ///
    /// A LA DERECHA Y NO A LA IZQUIERDA, aunque el montaje la
    /// dibujaba a la izquierda: lo pidió el cliente el 12 sep
    /// 2026 al verla en su sitio. Y tenía un motivo que el diseño
    /// no podía prever: en desarrollo, el distintivo de Next se
    /// planta en esa misma esquina y se le monta encima.
    ///
    /// `p-2` y no `p-1.5`: con más relleno la cápsula se lee
    /// redonda de verdad --«más redondito como el demo»-- en vez
    /// de como un rectángulo con las esquinas limadas.
    /// EL COLOR DEL ENCABEZADO VA EN LOS BOTONES, no aquí.
    ///
    /// Puesto en este contenedor lo heredaba también el panel de
    /// accesibilidad, que cuelga de dentro y es una tarjeta
    /// clara: sus rótulos salían en blanco sobre blanco. Lo que
    /// necesita el color de encabezado es lo que se pinta SOBRE
    /// este fondo, y eso son los dos botones.
    /// MÁS PEQUEÑA, Y PROPORCIONAL A LA PANTALLA.
    ///
    /// Estuvo con relleno y distancia fijos, y en un portátil se
    /// comía la esquina: «el campo donde está modo oscuro claro y
    /// accesibilidad más pequeño», «las proporciones de acuerdo al
    /// tamaño de pantalla» (cliente, 12 sep 2026).
    ///
    /// El relleno, el hueco y la distancia al borde salen de la
    /// ventana, igual que las dos filas de la cabecera. Y el cuerpo
    /// de letra baja a 13 px: es lo que encoge los dos botones del
    /// conmutador SIN tocar el componente, que es compartido y vive
    /// también en las seis pantallas públicas.
    <div
      /// ANCLADA A LA BANDA DEL PIE, NO A LA VENTANA.
      ///
      /// Se mudó al `<footer>` para no tapar datos, pero seguía con
      /// `fixed` y su `bottom`, así que en la práctica flotaba igual
      /// que antes: medido el 21 sep 2026, ocupaba de 898 a 934 px y
      /// `<main>` acababa en 910, o sea 12 px encima del contenido.
      /// `absolute` y centrada en el alto de la banda --que es
      /// `relative` y mide lo que la píldora-- la deja dentro del pie.
      style={{
        padding: "clamp(3px, 0.25vw, 6px)",
        gap: "clamp(2px, 0.2vw, 6px)",
        right: "clamp(0.75rem, 1vw, 1.25rem)",
      }}
      className="no-imprimir absolute top-1/2 z-40 flex -translate-y-1/2 items-center rounded-full border border-encabezado-borde bg-encabezado-fondo text-[0.8125rem] shadow-lg shadow-black/20"
    >
      <ConmutadorTema compacto menudo />

      {/* el relative abraza solo al boton: si abraza el
          grupo, el panel nace pegado al borde y se corta */}
      {/* Y sigue abriendo HACIA ARRIBA sin tocar una línea: el
          panel es `absolute bottom-full`, que se escribió cuando
          este botón estaba al pie de la barra. En una píldora
          abajo a la izquierda las dos razones siguen valiendo. */}
      <div className="relative">
        <button
          onClick={() => setAbierto(!abierto)}
          aria-expanded={abierto}
          // lo lee el panel para no tomar este clic por un
          // «pinchó fuera»
          data-abre-panel
          /// 26 px y icono de 14, no 32 y 17: es la tercera vez
          /// que el cliente pide esta píldora más pequeña, y las
          /// dos anteriores encogí el contenedor sin tocar los
          /// controles de dentro, que son los que mandan el alto.
          className={`grid h-[26px] w-[26px] place-items-center rounded-full text-encabezado-texto transition hover:bg-current/10 hover:opacity-100 ${
            abierto ? "bg-current/10 opacity-100" : "opacity-70"
          }`}
          title="Accesibilidad"
        >
          <IconoAccesibilidad tamano={14} />
          <span className="sr-only">Accesibilidad</span>
        </button>
        {abierto && <PanelAccesibilidad alCerrar={() => setAbierto(false)} />}
      </div>
    </div>
  );
}

/// Los grupos con sus enlaces, en acordeón vertical.
///
/// Era la lista de la barra lateral Y del cajón; desde que la
/// barra se volvió una cabecera de dos filas, el acordeón vive
/// SOLO en el cajón, o sea por debajo de `xl`. Arriba, los mismos
/// módulos se pintan en horizontal y con desplegable, en
/// `cabecera-topbar.tsx`.
function Grupos({
  ruta,
  esSuperadmin,
  permisos,
  plegado,
  alNavegar,
  alDesplegar,
  abrirEste,
}: {
  ruta: string;
  esSuperadmin: boolean;
  permisos: Permisos;
  plegado?: boolean;
  /// El cajón se cierra al pulsar, no tras navegar.
  alNavegar?: () => void;
  /// Con la barra plegada, pulsar un módulo la despliega y
  /// abre ese grupo.
  alDesplegar?: (clave: string) => void;
  /// El que se pidió abrir al desplegar.
  abrirEste?: string | null;
}) {
  /// Arranca abierto el grupo donde esta la pantalla actual:
  /// entrar y no ver donde estas parado es peor que verlo todo.
  const delaRuta =
    MODULOS.find((m) =>
      enlacesVisibles(m, permisos, esSuperadmin).some((e) => estaActivo(e, ruta)),
    )?.clave ?? null;

  const [abierto, setAbierto] = useState<string | null>(delaRuta);

  /// Al desplegar por el icono, se abre ESE grupo.
  /// Ajustar el estado durante el render y no en un efecto:
  /// así no hay un pintado intermedio con el grupo viejo.
  const [ultimoPedido, setUltimoPedido] = useState<string | null>(null);
  if (abrirEste && abrirEste !== ultimoPedido) {
    setUltimoPedido(abrirEste);
    setAbierto(abrirEste);
  }

  /// Navegar a otra seccion abre la suya. Sin esto, pulsar un
  /// enlace desde otro grupo deja el menu mostrando un grupo
  /// que ya no es donde estas.
  const [ultimaRuta, setUltimaRuta] = useState(ruta);
  if (ultimaRuta !== ruta) {
    setUltimaRuta(ruta);
    if (delaRuta) setAbierto(delaRuta);
  }

  /// Uno solo abierto: dos columnas de enlaces desplegadas a
  /// la vez son la lista completa otra vez, que es de lo que
  /// se trataba salir.
  function alternar(clave: string) {
    setAbierto((actual) => (actual === clave ? null : clave));
  }

  return (
    <>
      {plegado && (
        <FilaResumen
          ruta={ruta}
          plegado
          alNavegar={alNavegar}
          alDesplegar={() => alDesplegar?.("")}
        />
      )}
      {MODULOS.map((modulo) => {
        const enlaces = enlacesVisibles(modulo, permisos, esSuperadmin);
        if (enlaces.length === 0) return null;

        // plegada: una entrada por modulo, no una por
        // enlace. Quince iconos en fila no distinguen nada
        if (plegado) {
          const activo = enlaces.some((e) => estaActivo(e, ruta));
          return (
            /// Pulsar el icono ABRE el menú, no navega.
            ///
            /// Antes llevaba derecho a la primera vista del
            /// módulo, y eso es adivinar: uno pulsa el icono
            /// justamente porque no se acuerda de qué hay
            /// dentro ni en cuál está parado. Se despliega, se
            /// ve, y entonces se elige.
            <button
              key={modulo.clave}
              type="button"
              onClick={() => alDesplegar?.(modulo.clave)}
              title={modulo.etiqueta}
              aria-expanded={false}
              /// Circulo de 34 con borde de 1px, no un cuadro
              /// relleno: el rail sin etiquetas ya es bastante
              /// acertijo, y un circulo con borde se lee como
              /// boton mientras que un bloque de color se lee
              /// como estado.
              /// El activo va INVERTIDO -- circulo relleno con
              /// `--titulo` y el icono en `--superficie` --, que
              /// es lo que pide el redisenio. Con el relleno
              /// suave apenas se distinguia del fondo de la
              /// barra a 34px, y en un rail sin etiquetas saber
              /// donde esta uno es lo unico que se tiene.
              className={`mb-2 flex h-[34px] w-[34px] items-center justify-center self-center rounded-full border transition ${
                activo
                  ? "border-encabezado-texto bg-encabezado-texto text-encabezado-fondo"
                  : "border-current/35 opacity-85 hover:border-current/70 hover:opacity-100"
              }`}
            >
              {(() => {
                const Icono = ICONO_DE_MODULO[modulo.clave];
                return Icono ? <Icono tamano={17} /> : null;
              })()}
            </button>
          );
        }

        const desplegado = abierto === modulo.clave;

        return (
          <section key={modulo.clave} className="mb-1.5">
            <h2>
              <button
                type="button"
                onClick={() => alternar(modulo.clave)}
                aria-expanded={desplegado}
                title={modulo.etiqueta}
                /// 13px y peso 600, que es la medida del
                /// redisenio para el modulo. De paso cabe:
                /// a 14px «Gestion de Inscripciones» y
                /// «Sistemas de Informacion» se cortaban con
                /// puntos suspensivos en la barra de 250.
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold transition ${
                  desplegado
                    ? "opacity-100"
                    : "opacity-80 hover:bg-current/10 hover:opacity-100"
                }`}
              >
                {(() => {
                  const Icono = ICONO_DE_MODULO[modulo.clave];
                  return Icono ? (
                    <span className="shrink-0 leading-none">
                      <Icono tamano={17} />
                    </span>
                  ) : null;
                })()}
                <span className="truncate">
                  {modulo.etiqueta}
                </span>
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  width={14}
                  height={14}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`ml-auto shrink-0 opacity-70 transition-transform ${
                    desplegado ? "rotate-90" : ""
                  }`}
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </h2>

            {desplegado && (
            <ul className="mt-0.5 mb-2 ml-4 space-y-0.5 border-l border-current/15 pl-2">
              {enlaces.map((enlace) => {
                const activo = estaActivo(enlace, ruta);
                return (
                  <li key={enlace.href}>
                    <Link
                      href={enlace.href}
                      onClick={alNavegar}
                      aria-current={activo ? "page" : undefined}
                      className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                        activo
                          ? "bg-current/15 font-semibold"
                          : "opacity-80 hover:bg-current/10 hover:opacity-100"
                      }`}
                    >
                      {activo && (
                        <span
                          aria-hidden
                          className="absolute top-1.5 bottom-1.5 -left-1 w-[3px] rounded-full bg-current"
                        />
                      )}
                      <span className="truncate">{enlace.etiqueta}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            )}
          </section>
        );
      })}
    </>
  );
}

/*
 * LA BARRA LATERAL SE FUE el 12 sep 2026.
 *
 * Los módulos viven ahora en la fila 2 de la cabecera, en
 * horizontal y con desplegable, y su acordeón vertical solo
 * sobrevive dentro de `CajonMovil` --por debajo de `2xl`, donde la
 * fila no cabe--. Con ella se fueron el plegado y su llave de
 * `localStorage`, el estado de «abre este módulo al desplegar», y
 * el rail de 62 px con sus círculos.
 *
 * Queda escrito lo que costó, porque no está en el diseño: la
 * barra era la única contabilidad horizontal del panel, así que
 * ninguna de las 38 pantallas dependía de su ancho --el único
 * `w-[250px]` estaba aquí dentro--. Lo que sí cambió para todas
 * es el ALTO: `<main>` pasó de empezar en 56 px a empezar en 112.
 */
/** Por debajo de 2xl no cabe la fila: un cajón que se desliza. */
function CajonMovil({
  abierto,
  alCerrar,
  ruta,
  esSuperadmin,
  permisos,
  gremios,
  gremio,
  alElegir,
}: {
  abierto: boolean;
  alCerrar: () => void;
  ruta: string;
  esSuperadmin: boolean;
  permisos: Permisos;
  gremios: Array<{ convenioId: string; sigla: string }>;
  gremio: string | null;
  alElegir: (id: string | null) => void;
}) {
  // abierto, Escape lo cierra
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto, alCerrar]);

  return (
    <>
      <div
        onClick={alCerrar}
        aria-hidden
        className={`no-imprimir fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${
          abierto ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <nav
        aria-label="Secciones del panel"
        aria-hidden={!abierto}
        /// `xl:hidden` Y NO `md:hidden`, y esto era un boton
        /// muerto.
        ///
        /// El cajon nacio cuando la barra lateral se ocultaba en
        /// `md`: por debajo de 768 no habia barra, y el cajon la
        /// sustituia. El 12 sep 2026 la barra se volvio una fila
        /// horizontal que se oculta en `xl`, y yo movi ese corte
        /// sin mover este: entre 768 y 1280 quedaba una franja sin
        /// NADA -- la fila escondida por estrecha y el cajon
        /// escondido por ancho --, asi que la hamburguesa se
        /// pulsaba y no pasaba nada. El cliente lo vio enseguida,
        /// trabajando con zoom en el portatil: ahi el ancho CSS
        /// cae justo dentro de esa franja.
        ///
        /// Los dos cortes tienen que ser EL MISMO: donde no hay
        /// fila, hay cajon.
        /// SIN corte de ancho, y esta vez a propósito.
        ///
        /// Aquí hubo dos fallos encadenados. Primero `md:hidden`,
        /// heredado de cuando existía una barra lateral que se
        /// ocultaba en 768: al volverse la barra una fila que se
        /// escondía en 1280, quedó una franja de 768 a 1280 sin
        /// fila y sin cajón, con una hamburguesa que se pulsaba y
        /// no hacía nada. Lo vio el cliente trabajando con zoom,
        /// que es lo que mete el ancho CSS en esa franja. Después
        /// lo cambié a `xl:hidden`, que era el mismo error movido
        /// de sitio.
        ///
        /// Ahora quien decide es la MEDIDA: el marco monta este
        /// cajón solo cuando la fila no entra ni encogida al
        /// suelo. Un corte de ancho aquí volvería a contradecirla,
        /// porque con zoom o con la letra al 140 % una pantalla
        /// anchísima puede no tener sitio.
        className={`no-imprimir fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-encabezado-borde bg-encabezado-fondo px-4 py-4 text-encabezado-texto transition-transform duration-200 ${
          abierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="shrink-0">
          <div className="flex items-center">
            <Marca />
            <button
              onClick={alCerrar}
              aria-label="Cerrar menú"
              className="ml-auto rounded-lg p-1.5 opacity-60 transition hover:bg-current/10 hover:opacity-100"
            >
              <IconoCerrar tamano={18} />
            </button>
          </div>
          <div className="mt-8">
            <SelectorGremio gremios={gremios} gremio={gremio} alElegir={alElegir} />
            <RotuloDelPanel />
          </div>
        </div>

        <div className="barra-visible min-h-0 grow overflow-y-auto">
          <Grupos
            ruta={ruta}
            esSuperadmin={esSuperadmin}
            permisos={permisos}
            alNavegar={alCerrar}
          />
        </div>

        {/* SIN `Ajustes` aquí. Antes el cajón llevaba su propia
            copia porque la píldora vivía al pie de la barra y en
            móvil no había barra. Desde el 12 sep 2026 la píldora
            es `fixed` y del marco, así que ya está en pantalla:
            pintarla otra vez aquí daría DOS, y la de dentro
            flotaría sobre todo en vez de quedarse en el cajón.
            El cajón la tapa con su `z-50`, que es lo correcto
            mientras está abierto. */}
      </nav>
    </>
  );
}

/// El hueco de la barra superior donde cada pantalla pone sus
/// acciones, con `AccionesDePagina`.
export const RANURA_ACCIONES = "acciones-de-pagina";

/**
 * Manda unos botones a la barra superior.
 *
 * Por portal y no por props: el marco no tiene por que saber
 * que botones lleva cada pantalla, y pasarlos de padre en
 * padre obligaria a tocar el layout por cada pantalla nueva.
 */
export function AccionesDePagina({ children }: { children: React.ReactNode }) {
  const [ranura, setRanura] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRanura(document.getElementById(RANURA_ACCIONES));
  }, []);

  if (!ranura) return null;
  return createPortal(children, ranura);
}

/**
 * Dónde está uno, para la fila 2.
 *
 * Era el `<nav>` de la cabecera vieja y se levanta TAL CUAL: el
 * marcado es el mismo, solo cambia de casa. La cabecera de una
 * fila con hamburguesa, migas, ranura y `ChipUsuario` se fue
 * entera el 12 sep 2026; su navegación, su ranura y su bloque de
 * usuario viven ahora en `cabecera-topbar.tsx`.
 *
 * Se pinta solo por debajo de `xl` --lo decide quien la monta--
 * porque a partir de ahí el módulo lo dice la píldora activa de
 * la fila. Que la RUTA COMPLETA vuelva o no a pantalla ancha es
 * una decisión del cliente todavía abierta: dos documentos de la
 * casa dicen que la ruta de navegación nunca se pierde, y el
 * montaje que él mandó simplemente no la dibuja. Hasta que
 * conteste, esto no se borra.
 */
function Migas({ ruta }: { ruta: string }) {
  return (
    <nav aria-label="Dónde está" className="flex min-w-0 items-center gap-1.5 text-sm">
      {migas(ruta).map((paso, i, todas) => (
        <span key={paso} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && (
            <span aria-hidden className="opacity-30">
              /
            </span>
          )}
          <span
            className={`truncate ${
              i === todas.length - 1 ? "font-semibold" : "opacity-55"
            }`}
          >
            {paso}
          </span>
        </span>
      ))}
    </nav>
  );
}

// piezas compartidas del panel

/**
 * La medida de un campo: alto 34, radio 10, letra 12,5.
 *
 * Son las del redisenio, y se ponen aqui porque esta clase la
 * usan 174 controles en treinta archivos: cambiarla una vez es
 * lo que deja TODOS los campos del panel a la misma medida.
 *
 * El alto se consigue con el relleno y no con `h-[34px]`
 * a proposito: cuatro `textarea` usan esta misma clase, y con
 * una altura fija se quedarian en un renglon. Con relleno, un
 * campo de una linea mide 34 y el textarea crece.
 *
 * 7px arriba y abajo + 18 de linea + 2 de borde = 34.
 */
export const CLASE_CONTROL =
  "w-full rounded-lg border border-campo-borde bg-campo-fondo px-3 py-[7px] text-[0.78125rem] text-texto " +
  "outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25";

export function Tarjeta({
  titulo,
  encabezado,
  descripcion,
  centrado,
  plegable,
  abiertaPorDefecto = false,
  insignia,
  children,
}: {
  titulo: string;
  /// Un encabezado propio, con su circulo de icono. Cuando va,
  /// sustituye al titulo y la descripcion de siempre.
  encabezado?: React.ReactNode;
  descripcion?: React.ReactNode;
  /// Solo para las graficas: dos tarjetas de la misma fila
  /// miden lo mismo y el contenido se centra en vez de
  /// quedarse pegado arriba. En un formulario o una lista
  /// centrar vertical se ve mal, asi que no es lo de siempre.
  centrado?: boolean;
  /// Se abre y se cierra con un clic en el titulo.
  ///
  /// La ficha de un lead tiene once tarjetas y muchas se
  /// miran una vez al mes: los datos del interesado, el
  /// historial, la autorizacion. Todas abiertas obligan a
  /// recorrer dos pantallas para llegar a lo que uno usa
  /// todos los dias, que son la etapa y el grupo.
  plegable?: boolean;
  abiertaPorDefecto?: boolean;
  /// Un dato que se ve SIN abrirla. Es lo que hace que
  /// plegar no esconda: «3 notas», «5 movimientos».
  insignia?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(abiertaPorDefecto);
  const mostrar = !plegable || abierta;

  return (
    /// Una BANDA, no una tarjeta.
    ///
    /// Antes era `rounded-2xl border ... p-6`: una caja
    /// flotando sobre el fondo. Una pantalla con seis bloques
    /// eran seis cajas compitiendo entre ellas, y ese es
    /// justamente el lenguaje que este redisenio elimina.
    ///
    /// Ahora ocupa el ancho, no tiene radio y solo lleva raya
    /// abajo. Se cambia aqui y no en las 150 llamadas
    /// repartidas por el codigo.
    <section
      className={`mx-4 mb-3 rounded-2xl border border-borde bg-superficie ${
        centrado ? "flex h-full flex-col" : ""
      } ${plegable && !abierta ? "px-7 py-4" : "px-7 py-5"}`}
    >
      {encabezado ? (
        <>
          {encabezado}
          <div className="mt-4">{children}</div>
        </>
      ) : plegable ? (
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={abierta}
          className="flex w-full items-center gap-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold">{titulo}</span>
            {descripcion && !abierta && (
              <span className="mt-0.5 block truncate text-sm text-texto-suave">
                {descripcion}
              </span>
            )}
          </span>
          {/* La insignia se ve cerrada: plegar no puede
              esconder que hay algo dentro. */}
          {insignia && (
            <span className="shrink-0 rounded-full bg-superficie-alterna px-2.5 py-1 text-xs text-texto-suave">
              {insignia}
            </span>
          )}
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`shrink-0 opacity-50 transition-transform ${
              abierta ? "rotate-180" : ""
            }`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      ) : (
        <>
          <h2 className="text-lg font-semibold">{titulo}</h2>
          {descripcion && (
            <p className="mt-1 text-sm text-texto-suave">{descripcion}</p>
          )}
        </>
      )}

      {/* `!encabezado`: con encabezado propio los hijos ya se
          pintaron arriba, y sin esto salian DOS VECES — la
          tarjeta de Notas aparecia duplicada entera. */}
      {!encabezado && mostrar && (
        <>
          {plegable && descripcion && (
            <p className="mt-1 text-sm text-texto-suave">{descripcion}</p>
          )}
          <div
            className={`mt-5 ${centrado ? "flex grow flex-col justify-center" : ""}`}
          >
            {children}
          </div>
        </>
      )}
    </section>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1.5 block text-xs text-texto-suave">{ayuda}</span>}
    </label>
  );
}

export function Boton({
  children,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...resto}
      /// El azul de marca, no el verde.
      ///
      /// Estuvo en `--acento` una temporada, y eso pintaba de
      /// verde el boton principal de TODO el panel. `--marca`
      /// es el color del producto -- y el que cada gremio edita
      /// desde Apariencia --, asi que fijar aqui otro le quita
      /// esa palanca sin que nadie se entere.
      ///
      /// Alto 34, radio 10 y sin sombra: la separacion de este
      /// redisenio es por borde de 1px, nunca por sombra.
      className={`inline-flex h-[32px] items-center justify-center gap-2 rounded-[9px] bg-marca px-[13px] text-[12.5px] font-semibold text-marca-texto transition hover:bg-marca-fuerte disabled:cursor-not-allowed disabled:bg-campo-borde disabled:text-texto-suave sin-aro ${resto.className ?? ""}`}
    >
      {children}
    </button>
  );
}

/**
 * El botón principal de una pantalla, DENTRO de la cabecera.
 *
 * `Boton` va de `--marca` sobre `--marca-texto`, y eso está
 * pensado para el fondo claro del cuerpo. En la cabecera el
 * fondo es `--encabezado-fondo`, que cada gremio edita desde
 * Apariencia: ADECOPRIA lo tiene verde oscuro y su `--marca`
 * también es verde, así que «Nueva campaña» salía verde sobre
 * verde y no se leía.
 *
 * Y no se arregla eligiendo otro color fijo: el siguiente gremio
 * elegirá otro par y volvería a pasar.
 *
 * Se invierte el par de la propia cabecera —el texto pasa a ser
 * el fondo del botón y al revés—. Esos dos tienen que
 * contrastar por definición, porque si no la cabecera no se
 * leería; invertirlos da un botón legible con CUALQUIER tema, sin
 * saber de qué color es ninguno.
 *
 * Misma geometría que `Boton`: alto 32, radio 9, 12,5px en
 * semibold. Es el mismo botón, en otro fondo.
 */
export function BotonDeCabecera({
  children,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...resto}
      className={`sin-aro inline-flex h-[32px] items-center justify-center gap-1.5 rounded-[9px] bg-encabezado-texto px-[13px] text-[12.5px] font-semibold text-encabezado-fondo transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45 ${
        resto.className ?? ""
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Escoger un archivo, con un botón de verdad.
 *
 * El `<input type="file">` a pelo lo pinta el navegador, y en
 * Chrome sale como «Seleccionar archivo · Ningún archivo
 * seleccionado» en gris: no parece un control del panel, no se
 * puede alinear con nada y encima cambia de aspecto y de idioma
 * según el navegador de cada quien.
 *
 * El input SIGUE ahí, con `sr-only` y no `hidden`: escondido
 * con `display:none` deja de recibir el foco y el campo se
 * vuelve inalcanzable con el teclado. Así conserva su
 * comportamiento —incluido arrastrar y soltar sobre la
 * etiqueta— y solo se le cambia la cara.
 */
/**
 * El encabezado de una seccion, con su circulo de icono.
 *
 * Es el patron que repite el handoff en todos los paneles:
 * circulo verde palido de 38px con el icono dentro, y al lado
 * el titulo y una linea que dice de que va la seccion.
 */
export function EncabezadoSeccion({
  titulo,
  descripcion,
  accion,
}: {
  /// Se acepta y NO se pinta: ver el comentario de abajo.
  icono?: React.ReactNode;
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
}) {
  /// Sin el circulo verde del icono.
  ///
  /// Cada seccion de la ficha llevaba su icono metido en un
  /// circulo de `--acento-suave`, y bajando por la pestania
  /// salian cinco circulos verdes que no distinguian nada: el
  /// titulo ya dice de que es la seccion. Ademas el verde no es
  /// color de marca -- entro con el handoff anterior -- y en el
  /// redisenio las secciones se separan por una raya, no por
  /// una insignia.
  ///
  /// La prop `icono` se sigue aceptando para no tocar las cinco
  /// llamadas, pero no se pinta. Igual que en `TarjetaCifra`.
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="truncate text-[0.90625rem] font-semibold text-titulo">
          {titulo}
        </p>
        {descripcion && (
          <p className="mt-1 text-[0.78125rem] leading-relaxed text-texto-suave">
            {descripcion}
          </p>
        )}
      </div>
      {accion}
    </div>
  );
}

/**
 * El rotulo de un grupo de campos. Es lo que parte los veinte
 * campos de «Datos» en seis bloques legibles.
 *
 * Sin el cuadrito verde y en el azul de marca.
 *
 * Llevaba un punto de `--acento` delante, y con seis grupos
 * eran seis puntos verdes bajando por la ficha que no decian
 * nada: el rotulo ya se distingue por la versalita y el peso.
 * El verde ademas no es color de marca -- es el que entro con
 * el handoff anterior --, y aqui manda `--marca`, que es el que
 * cada gremio edita.
 */
export function RotuloDeGrupo({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.625rem] font-semibold tracking-[0.1em] text-marca uppercase">
      {children}
    </p>
  );
}

export function EscogerArchivo({
  id,
  acepta,
  archivo,
  alElegir,
  etiqueta = "Elegir archivo",
  vacio = "Ningún archivo elegido",
}: {
  id: string;
  acepta: string;
  archivo: File | null;
  alElegir: (f: File | null) => void;
  etiqueta?: string;
  vacio?: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={entrada}
        id={id}
        type="file"
        accept={acepta}
        className="sr-only"
        onChange={(e) => alElegir(e.target.files?.[0] ?? null)}
      />

      {/* `<label>` y no `<button>`: pulsando la etiqueta de un
          input de archivo el navegador abre el diálogo solo, sin
          que haya que llamar a `.click()`. Y con `htmlFor` el
          lector de pantalla los sigue leyendo como una cosa. */}
      <label
        htmlFor={id}
        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-borde bg-superficie px-4 py-2 text-sm font-medium transition hover:border-marca hover:bg-superficie-alterna"
      >
        {etiqueta}
      </label>

      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          archivo ? "" : "text-texto-suave"
        }`}
        title={archivo?.name}
      >
        {archivo ? archivo.name : vacio}
      </span>

      {archivo && (
        <button
          type="button"
          className="shrink-0 text-sm text-texto-suave underline"
          onClick={() => {
            alElegir(null);
            /// Vaciar el input además del estado. Sin esto,
            /// volver a escoger EL MISMO archivo no dispara
            /// `change` —el valor no cambió— y parece que el
            /// botón dejó de funcionar.
            if (entrada.current) entrada.current.value = "";
          }}
        >
          Quitar
        </button>
      )}
    </div>
  );
}

export function Aviso({ tipo, children }: { tipo: "error" | "exito"; children: React.ReactNode }) {
  const clases =
    tipo === "error"
      ? "border-error/30 bg-error-suave text-error"
      : "border-exito/30 bg-exito-suave text-exito";
  return <div className={`rounded-xl border p-4 text-sm ${clases}`}>{children}</div>;
}
