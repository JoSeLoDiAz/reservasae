"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { ConmutadorTema, useMarca } from "@/components/marca-publica";

import { FirmaConvoca } from "@/components/firma-convoca";

import { SignoConvoca } from "./signo-convoca";
import {
  adminApi,
  MAXIMO_LOGOS,
  urlLogo,
  type AdminActual,
  type Area,
  type Nivel,
} from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";

import { PanelAccesibilidad } from "./accesibilidad";
import { CambioDeClaveObligatorio } from "./cambio-clave";
import {
  IconoAccesibilidad,
  IconoCerrar,
  IconoDerecha,
  IconoIzquierda,
  IconoMenu,
  IconoSalir,
} from "./iconos";
import { enlacesVisibles, estaActivo, MODULOS } from "./navegacion";

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
const ROTULO = "text-[10px] tracking-wide uppercase opacity-55";

const LLAVE_PLEGADO = "convoca:menu-plegado";
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
  const [plegado, setPlegadoEstado] = useState(false);
  const [cajon, setCajon] = useState(false);
  const [gremio, setGremioEstado] = useState<string | null>(null);
  /// Qué grupo abrir al desplegar la barra. Lo pide el icono
  /// de un módulo cuando la barra está plegada: uno lo pulsa
  /// porque no se acuerda de qué hay dentro, así que hay que
  /// enseñárselo abierto.
  const [moduloAAbrir, setModuloAAbrir] = useState<string | null>(null);

  useEffect(() => {
    setPlegadoEstado(window.localStorage.getItem(LLAVE_PLEGADO) === "si");
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

  const setPlegado = useCallback((valor: boolean) => {
    setPlegadoEstado(valor);
    try {
      window.localStorage.setItem(LLAVE_PLEGADO, valor ? "si" : "no");
    } catch {
      // en privado localStorage puede fallar
    }
  }, []);

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

  if (cargando) {
    return <p className="p-10 text-texto-suave">Cargando…</p>;
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
      <div
        style={{ height: "calc(100vh - var(--franja-alto, 0px))" }}
        className="flex overflow-hidden"
      >
        <BarraLateral
          ruta={ruta}
          esSuperadmin={esSuperadmin}
          permisos={admin.permisos}
          plegado={plegado}
          alPlegar={() => setPlegado(!plegado)}
          abrirEste={moduloAAbrir}
          alDesplegarModulo={(clave) => {
            setPlegado(false);
            setModuloAAbrir(clave);
          }}
          gremios={gremios}
          gremio={gremioActivo}
          alElegir={elegirGremio}
        />

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

        <div className="flex min-w-0 grow flex-col">
          <Cabecera
            ruta={ruta}
            alAbrirMenu={() => setCajon(true)}
            admin={admin}
            alSalir={salir}
          />
          <main
            id="contenido"
            tabIndex={-1}
            /// `overflow-y-auto` para que las fichas largas —que sí se
            /// leen de arriba abajo— sigan pudiéndose recorrer. Las
            /// pantallas de tabla no lo usan: su contenido cabe porque
            /// la tabla scrollea por dentro.
            className="flex w-full min-h-0 grow flex-col overflow-y-auto overscroll-contain px-4 py-6 lg:px-8"
          >
            {/* Sin tope de ancho: son tablas de trabajo y en un
                monitor ancho `max-w-6xl` las dejaba espichadas.
                Cada pantalla decide que bloques suyos se quedan
                cortos, que es donde de verdad importa. */}
            <div className="flex min-h-0 w-full grow flex-col">{children}</div>
          </main>
        </div>
      </div>
    </ContextoAdmin.Provider>
  );
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
  return ["Panel"];
}

/// La marca. Igual en la barra y en el cajón.
///
/// Dos cosas y en este orden: arriba los logos del cliente,
/// sobre su placa; debajo el signo de Convoca con su nombre y
/// su frase. En el panel de un gremio manda el gremio, y
/// Convoca firma abajo.
function Marca({ plegado }: { plegado?: boolean }) {
  /// Se guarda CUALES fuentes fallaron, no un booleano.
  ///
  /// Con tres logos, uno roto se llevaria a los otros dos por
  /// delante. Solo aplica a los del cliente: el signo de
  /// Convoca va en linea y no puede fallar al cargar.
  const [fallidas, setFallidas] = useState<string[]>([]);
  const { marca } = useMarca();

  /// Hasta tres, los del gremio de la direccion.
  const logos = (marca?.logos ?? [])
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
    logos.length >= 3 ? "4.5rem" : logos.length === 2 ? "6.5rem" : "9.5rem";

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
        <div className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 rounded-xl bg-white px-2.5 py-2 shadow-sm">
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
              className="h-8 w-auto shrink object-contain"
            />
          ))}
        </div>
      )}

      <Link
        href="/admin"
        // plegado no hay texto que lo nombre
        aria-label={plegado ? "Convoca" : undefined}
        className="flex max-w-full items-center justify-center gap-2.5 no-underline"
      >
        {/* La MISMA firma que el login, el pie publico y la
            ficha del perfil, no una copia con los mismos
            estilos: cuatro copias acaban diciendo cuatro
            cosas. Plegada solo cabe el signo. */}
        {plegado ? (
          <SignoConvoca tamano={30} className="shrink-0" />
        ) : (
          <FirmaConvoca tamano={32} />
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
      <select
        value={gremio ?? ""}
        onChange={(e) => alElegir(e.target.value || null)}
        className="w-full rounded-lg border border-encabezado-borde/60 bg-transparent px-2.5 py-1.5 text-sm font-medium outline-none focus:border-marca"
      >
        <option value="">Todos los gremios</option>
        {gremios.map((g) => (
          <option key={g.convenioId} value={g.convenioId}>
            {g.sigla}
          </option>
        ))}
      </select>
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
 * Quien esta dentro.
 *
 * Vive arriba a la derecha, que es donde se busca: es lo
 * primero que uno mira al llegar a un panel prestado, y en el
 * pie de la barra quedaba fuera del recorrido de la vista.
 */
function ChipUsuario({
  admin,
  alSalir,
}: {
  admin: AdminActual;
  alSalir: () => void;
}) {
  return (
    // sin recuadro: en la barra de arriba, un marco alrededor
    // del nombre lo hacia parecer un boton que no es
    <div className="flex shrink-0 items-center gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-marca text-xs font-bold text-marca-texto">
        {(admin.nombre[0] ?? "?").toUpperCase()}
      </span>
      {/* el cargo se esconde en pantallas chicas: en la barra
          de arriba compite con las migas */}
      <span className="hidden min-w-0 flex-col leading-tight sm:flex">
        <span className="truncate text-xs font-semibold">{admin.nombre}</span>
        <span className="truncate text-[10px] opacity-60">
          {admin.cargo ?? admin.rol}
        </span>
      </span>
      <button
        onClick={alSalir}
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
        className="shrink-0 rounded-lg p-1.5 opacity-60 transition hover:bg-error/15 hover:text-error hover:opacity-100"
      >
        <IconoSalir tamano={15} />
      </button>
    </div>
  );
}

/**
 * Apariencia y accesibilidad, juntas al pie de la barra.
 *
 * Son ajustes: se tocan una vez y se dejan. Arriba competian
 * con las migas y con las acciones de cada pantalla, que son
 * lo que uno usa todo el dia.
 */
function Ajustes({
  plegado,
  alDesplegar,
}: {
  plegado?: boolean;
  alDesplegar?: () => void;
}) {
  const [abierto, setAbierto] = useState(false);

  /// Plegada: un solo botón que despliega.
  ///
  /// El conmutador de tema son TRES botones de 36 px en fila:
  /// 108 px que no caben en una barra de 72, así que se salían
  /// por la izquierda -- uno empezaba en x = -18 -- y se veían
  /// montados unos sobre otros. Aquí no se meten a la fuerza:
  /// se pide la barra abierta, que es donde caben.
  if (plegado) {
    return (
      <button
        type="button"
        onClick={alDesplegar}
        title="Ajustes: apariencia y accesibilidad"
        className="mt-3 flex h-10 w-full shrink-0 items-center justify-center rounded-xl border border-current/10 bg-current/5 opacity-70 transition hover:opacity-100"
      >
        <span aria-hidden className="text-base leading-none">
          🎛️
        </span>
        <span className="sr-only">Ajustes</span>
      </button>
    );
  }

  return (
    <div className="mt-3 flex shrink-0 items-center justify-between gap-1 rounded-xl border border-current/10 bg-current/5 p-1.5 pl-2.5">
      <span className={ROTULO}>Ajustes</span>

      <div className="flex items-center gap-1">
        <ConmutadorTema compacto />

        {/* el relative abraza solo al boton: si abraza el
            grupo, el panel nace pegado al borde y se corta */}
        <div className="relative">
          <button
            onClick={() => setAbierto(!abierto)}
            aria-expanded={abierto}
            // lo lee el panel para no tomar este clic por un
            // «pinchó fuera»
            data-abre-panel
            className={`grid h-8 w-8 place-items-center rounded-lg transition hover:bg-current/10 hover:opacity-100 ${
              abierto ? "bg-current/10 opacity-100" : "opacity-70"
            }`}
            title="Accesibilidad"
          >
            <IconoAccesibilidad tamano={17} />
            <span className="sr-only">Accesibilidad</span>
          </button>
          {abierto && <PanelAccesibilidad alCerrar={() => setAbierto(false)} />}
        </div>
      </div>
    </div>
  );
}

/// Los grupos con sus enlaces, compartidos por los dos menús.
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
              title={`${modulo.etiqueta} — ${modulo.descripcion}`}
              aria-expanded={false}
              className={`mb-1 flex h-10 w-full items-center justify-center rounded-xl transition ${
                activo
                  ? "bg-current/12"
                  : "opacity-60 hover:bg-current/8 hover:opacity-100"
              }`}
            >
              <span aria-hidden className="text-lg leading-none">
                {modulo.emoji}
              </span>
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
                title={modulo.descripcion}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                  desplegado
                    ? "font-medium opacity-100"
                    : "opacity-65 hover:bg-current/8 hover:opacity-100"
                }`}
              >
                <span aria-hidden className="shrink-0 text-base leading-none">
                  {modulo.emoji}
                </span>
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
                          ? "bg-current/12 font-medium"
                          : "opacity-65 hover:bg-current/8 hover:opacity-100"
                      }`}
                    >
                      {activo && (
                        <span
                          aria-hidden
                          className="absolute top-1.5 bottom-1.5 -left-1 w-[3px] rounded-full bg-marca"
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

/** Fija: la página hace scroll y esto no se mueve. */
function BarraLateral({
  ruta,
  esSuperadmin,
  permisos,
  plegado,
  alPlegar,
  alDesplegarModulo,
  abrirEste,
  gremios,
  gremio,
  alElegir,
}: {
  ruta: string;
  esSuperadmin: boolean;
  permisos: Permisos;
  plegado: boolean;
  alPlegar: () => void;
  alDesplegarModulo: (clave: string) => void;
  abrirEste: string | null;
  gremios: Array<{ convenioId: string; sigla: string }>;
  gremio: string | null;
  alElegir: (id: string | null) => void;
}) {
  return (
    <nav
      aria-label="Secciones del panel"
      // el alto lo pone el contenedor, que ya resta la franja
      className={`no-imprimir z-20 hidden h-full shrink-0 flex-col border-r border-encabezado-borde bg-encabezado-fondo text-encabezado-texto transition-[width] duration-200 md:flex ${
        plegado ? "w-[72px] px-3 py-4" : "w-[292px] px-4 py-4"
      }`}
    >
      {/* `mb-4` también plegada: sin él, el logo y el primer
          icono se tocan y se leen como uno solo */}
      <div className="mb-4 shrink-0">
        <Marca plegado={plegado} />
        {!plegado && (
          /// Bien separado del logo.
          ///
          /// Arriba está la marca -- qué panel es esto -- y
          /// aquí abajo empieza el trabajo. Pegados, el
          /// desplegable de gremio parecía parte del logo y
          /// todo el menú nacía encaramado en el borde.
          <div className="mt-8">
            <SelectorGremio gremios={gremios} gremio={gremio} alElegir={alElegir} />
            <RotuloDelPanel />
          </div>
        )}
      </div>

      {/* el scroll es de aqui dentro, no de la pagina */}
      <div className="barra-visible min-h-0 grow overflow-y-auto">
        <Grupos
          ruta={ruta}
          esSuperadmin={esSuperadmin}
          permisos={permisos}
          plegado={plegado}
          alDesplegar={alDesplegarModulo}
          abrirEste={abrirEste}
        />
      </div>

      <Ajustes plegado={plegado} alDesplegar={() => alDesplegarModulo("")} />

      <button
        onClick={alPlegar}
        className="absolute top-[76px] -right-3 z-10 grid h-6 w-6 place-items-center rounded-full border border-encabezado-borde bg-encabezado-fondo text-encabezado-texto shadow-sm transition hover:border-marca hover:text-marca"
        aria-label={plegado ? "Desplegar el menú" : "Plegar el menú"}
        title={plegado ? "Desplegar" : "Plegar"}
      >
        {plegado ? <IconoDerecha tamano={13} /> : <IconoIzquierda tamano={13} />}
      </button>
    </nav>
  );
}

/** En móvil no cabe la lateral: un cajón que se desliza. */
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
        className={`no-imprimir fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 md:hidden ${
          abierto ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <nav
        aria-label="Secciones del panel"
        aria-hidden={!abierto}
        className={`no-imprimir fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-encabezado-borde bg-encabezado-fondo px-4 py-4 text-encabezado-texto transition-transform duration-200 md:hidden ${
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

        <Ajustes />
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

function Cabecera({
  ruta,
  alAbrirMenu,
  admin,
  alSalir,
}: {
  ruta: string;
  alAbrirMenu: () => void;
  admin: AdminActual;
  alSalir: () => void;
}) {
  return (
    <header
      /// Ni pegada ni con `top`, y es lo correcto ahora.
      ///
      /// El contenedor del panel tiene altura fija y
      /// `overflow-hidden`, asi que ES el scroll container de
      /// lo pegado. Con `top: var(--franja-alto)` -- pensado
      /// para pegarse a la VENTANA -- sticky la empujaba 36 px
      /// hacia abajo dentro de ese contenedor y tapaba el
      /// arranque del contenido. Aqui es un hermano flex que
      /// no puede irse: no hace falta pegarla.
      ///
      /// La franja se descuenta UNA vez, en el contenedor.
      className="no-imprimir z-30 flex h-14 shrink-0 items-center gap-3 border-b border-encabezado-borde bg-encabezado-fondo px-4 text-encabezado-texto lg:px-8"
    >
      <button
        onClick={alAbrirMenu}
        aria-label="Abrir menú"
        className="-ml-1 rounded-lg p-2 opacity-70 transition hover:bg-current/10 hover:opacity-100 md:hidden"
      >
        <IconoMenu tamano={20} />
      </button>

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

      {/* Donde cada pantalla cuelga sus acciones. Vive aqui y
          no en el cuerpo para que no se muevan al hacer scroll
          ni empujen el titulo hacia abajo. */}
      <div
        id={RANURA_ACCIONES}
        className="ml-auto flex flex-wrap items-center justify-end gap-3"
      />

      {/* Arriba se queda quien esta dentro, y nada mas. Los
          ajustes -- apariencia y accesibilidad -- bajaron al
          pie de la barra: se tocan una vez y se dejan. */}
      <ChipUsuario admin={admin} alSalir={alSalir} />
    </header>
  );
}

// piezas compartidas del panel

export const CLASE_CONTROL =
  "w-full rounded-xl border border-campo-borde bg-campo-fondo px-3 py-2.5 text-texto " +
  "outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25";

export function Tarjeta({
  titulo,
  descripcion,
  centrado,
  children,
}: {
  titulo: string;
  descripcion?: React.ReactNode;
  /// Solo para las graficas: dos tarjetas de la misma fila
  /// miden lo mismo y el contenido se centra en vez de
  /// quedarse pegado arriba. En un formulario o una lista
  /// centrar vertical se ve mal, asi que no es lo de siempre.
  centrado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-borde bg-superficie p-6 shadow-sm ${
        centrado ? "flex h-full flex-col" : ""
      }`}
    >
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {descripcion && <p className="mt-1 text-sm text-texto-suave">{descripcion}</p>}
      <div className={`mt-5 ${centrado ? "flex grow flex-col justify-center" : ""}`}>
        {children}
      </div>
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
      <span className="mb-1.5 block text-sm font-medium">{etiqueta}</span>
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
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-marca px-5 py-2.5 text-sm font-medium text-marca-texto shadow-sm transition hover:bg-marca-fuerte disabled:opacity-50 ${resto.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Aviso({ tipo, children }: { tipo: "error" | "exito"; children: React.ReactNode }) {
  const clases =
    tipo === "error"
      ? "border-error/30 bg-error-suave text-error"
      : "border-exito/30 bg-exito-suave text-exito";
  return <div className={`rounded-xl border p-4 text-sm ${clases}`}>{children}</div>;
}
