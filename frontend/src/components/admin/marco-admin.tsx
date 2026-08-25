"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { ConmutadorTema } from "@/components/marca-publica";
import { adminApi, type AdminActual, type Area, type Nivel } from "@/lib/admin-api";
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

type Contexto = { admin: AdminActual; refrescar: () => Promise<void> };

const ContextoAdmin = createContext<Contexto | null>(null);

export function useAdmin(): Contexto {
  const valor = useContext(ContextoAdmin);
  if (!valor) throw new Error("useAdmin fuera del marco del panel.");
  return valor;
}

const LLAVE_PLEGADO = "convoca:menu-plegado";

type Permisos = Record<Area, Nivel> | undefined;

export function MarcoAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();

  const [admin, setAdmin] = useState<AdminActual | null>(null);
  const [cargando, setCargando] = useState(true);
  const [plegado, setPlegadoEstado] = useState(false);
  const [cajon, setCajon] = useState(false);

  useEffect(() => {
    setPlegadoEstado(window.localStorage.getItem(LLAVE_PLEGADO) === "si");
  }, []);

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
    } catch (e) {
      // /admin/yo si responde con la clave sin cambiar
      if (e instanceof ErrorApi && e.estado === 401) {
        router.replace("/admin/login");
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

  return (
    <ContextoAdmin.Provider value={{ admin, refrescar: cargar }}>
      <a href="#contenido" className="salto-al-contenido no-imprimir">
        Saltar al contenido
      </a>

      <div className="flex min-h-screen">
        <BarraLateral
          ruta={ruta}
          esSuperadmin={esSuperadmin}
          permisos={admin.permisos}
          plegado={plegado}
          alPlegar={() => setPlegado(!plegado)}
          admin={admin}
          alSalir={salir}
        />

        <CajonMovil
          abierto={cajon}
          alCerrar={() => setCajon(false)}
          ruta={ruta}
          esSuperadmin={esSuperadmin}
          permisos={admin.permisos}
          admin={admin}
          alSalir={salir}
        />

        <div className="flex min-w-0 grow flex-col">
          <Cabecera ruta={ruta} alAbrirMenu={() => setCajon(true)} />
          <main
            id="contenido"
            tabIndex={-1}
            className="flex w-full min-h-0 grow flex-col px-4 py-6 lg:px-8"
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

/// El archivo del logo. Si no esta, se pinta la letra: un
/// icono roto en la esquina superior izquierda se ve peor
/// que una C, y el panel no puede depender de un PNG.
const LOGO = "/logo-convoca.png";

/// La marca. Igual en la barra y en el cajón.
function Marca({ plegado }: { plegado?: boolean }) {
  const [sinLogo, setSinLogo] = useState(false);

  return (
    <Link
      href="/admin"
      className={`flex items-center gap-2.5 no-underline ${plegado ? "justify-center" : ""}`}
    >
      {sinLogo ? (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-marca text-sm font-bold text-marca-texto">
          C
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={LOGO}
          alt=""
          width={36}
          height={36}
          onError={() => setSinLogo(true)}
          className="h-9 w-9 shrink-0 object-contain"
        />
      )}
      {!plegado && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-bold">Convoca CRM</span>
          <span className="truncate text-[10px] opacity-60">panel de gestión</span>
        </span>
      )}
    </Link>
  );
}

function ChipUsuario({
  admin,
  alSalir,
  plegado,
}: {
  admin: AdminActual;
  alSalir: () => void;
  plegado?: boolean;
}) {
  return (
    <div
      className={`mt-3 flex shrink-0 items-center gap-2.5 rounded-xl border border-current/10 bg-current/5 p-2.5 ${
        plegado ? "flex-col gap-2" : ""
      }`}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-marca text-xs font-bold text-marca-texto">
        {(admin.nombre[0] ?? "?").toUpperCase()}
      </span>
      {!plegado && (
        <span className="flex min-w-0 grow flex-col leading-tight">
          <span className="truncate text-xs font-semibold">{admin.nombre}</span>
          <span className="truncate text-[10px] opacity-60">
            {admin.cargo ?? admin.rol}
          </span>
        </span>
      )}
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

/// Los grupos con sus enlaces, compartidos por los dos menús.
function Grupos({
  ruta,
  esSuperadmin,
  permisos,
  plegado,
  alNavegar,
}: {
  ruta: string;
  esSuperadmin: boolean;
  permisos: Permisos;
  plegado?: boolean;
  /// El cajón se cierra al pulsar, no tras navegar.
  alNavegar?: () => void;
}) {
  /// Arranca abierto el grupo donde esta la pantalla actual:
  /// entrar y no ver donde estas parado es peor que verlo todo.
  const delaRuta =
    MODULOS.find((m) =>
      enlacesVisibles(m, permisos, esSuperadmin).some((e) => estaActivo(e, ruta)),
    )?.clave ?? null;

  const [abierto, setAbierto] = useState<string | null>(delaRuta);

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
            <Link
              key={modulo.clave}
              href={enlaces[0].href}
              onClick={alNavegar}
              title={`${modulo.etiqueta} — ${modulo.descripcion}`}
              aria-current={activo ? "page" : undefined}
              className={`mb-1 flex h-10 items-center justify-center rounded-xl transition ${
                activo
                  ? "bg-current/12"
                  : "opacity-60 hover:bg-current/8 hover:opacity-100"
              }`}
            >
              <span aria-hidden className="text-lg leading-none">
                {modulo.emoji}
              </span>
            </Link>
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
  admin,
  alSalir,
}: {
  ruta: string;
  esSuperadmin: boolean;
  permisos: Permisos;
  plegado: boolean;
  alPlegar: () => void;
  admin: AdminActual;
  alSalir: () => void;
}) {
  return (
    <nav
      aria-label="Secciones del panel"
      // debajo de la franja, no tapada por ella
      style={{
        top: "var(--franja-alto, 0px)",
        height: "calc(100vh - var(--franja-alto, 0px))",
      }}
      className={`no-imprimir sticky z-20 hidden shrink-0 flex-col border-r border-encabezado-borde bg-encabezado-fondo text-encabezado-texto transition-[width] duration-200 md:flex ${
        plegado ? "w-[72px] px-3 py-4" : "w-[260px] px-4 py-4"
      }`}
    >
      <div className="mb-5 shrink-0">
        <Marca plegado={plegado} />
      </div>

      {/* el scroll es de aqui dentro, no de la pagina */}
      <div className="barra-visible min-h-0 grow overflow-y-auto">
        <Grupos
          ruta={ruta}
          esSuperadmin={esSuperadmin}
          permisos={permisos}
          plegado={plegado}
        />
      </div>

      <ChipUsuario admin={admin} alSalir={alSalir} plegado={plegado} />

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
  admin,
  alSalir,
}: {
  abierto: boolean;
  alCerrar: () => void;
  ruta: string;
  esSuperadmin: boolean;
  permisos: Permisos;
  admin: AdminActual;
  alSalir: () => void;
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
        <div className="mb-5 flex shrink-0 items-center">
          <Marca />
          <button
            onClick={alCerrar}
            aria-label="Cerrar menú"
            className="ml-auto rounded-lg p-1.5 opacity-60 transition hover:bg-current/10 hover:opacity-100"
          >
            <IconoCerrar tamano={18} />
          </button>
        </div>

        <div className="barra-visible min-h-0 grow overflow-y-auto">
          <Grupos
            ruta={ruta}
            esSuperadmin={esSuperadmin}
            permisos={permisos}
            alNavegar={alCerrar}
          />
        </div>

        <ChipUsuario admin={admin} alSalir={alSalir} />
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

function Cabecera({ ruta, alAbrirMenu }: { ruta: string; alAbrirMenu: () => void }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <header
      style={{ top: "var(--franja-alto, 0px)" }}
      className="no-imprimir sticky z-30 flex h-14 shrink-0 items-center gap-3 border-b border-encabezado-borde bg-encabezado-fondo px-4 text-encabezado-texto lg:px-8"
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

      <div className="flex items-center gap-1.5">
        <ConmutadorTema compacto />

        {/* el relative va aqui: si abraza todo el grupo,
            el panel nace arriba y la cabecera lo corta */}
        <div className="relative">
          <button
            onClick={() => setAbierto(!abierto)}
            aria-expanded={abierto}
            className="grid h-9 w-9 place-items-center rounded-lg opacity-70 transition hover:bg-current/10 hover:opacity-100"
            title="Accesibilidad"
          >
            <IconoAccesibilidad tamano={18} />
            <span className="sr-only">Accesibilidad</span>
          </button>
          {abierto && <PanelAccesibilidad alCerrar={() => setAbierto(false)} />}
        </div>
      </div>
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
