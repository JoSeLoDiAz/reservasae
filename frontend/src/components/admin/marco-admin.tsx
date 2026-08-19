"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

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

  // al navegar, el cajon se cierra solo
  useEffect(() => setCajon(false), [ruta]);

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
          <main className="w-full grow px-4 py-6 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </ContextoAdmin.Provider>
  );
}

/** El título de la pantalla, sacado del propio menú. */
function tituloDeRuta(ruta: string): string {
  for (const modulo of MODULOS) {
    for (const enlace of modulo.enlaces) {
      if (estaActivo(enlace, ruta)) return enlace.etiqueta;
    }
  }
  return "Panel";
}

/// La marca. Igual en la barra y en el cajón.
function Marca({ plegado }: { plegado?: boolean }) {
  return (
    <Link
      href="/admin"
      className={`flex items-center gap-2.5 no-underline ${plegado ? "justify-center" : ""}`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-marca text-sm font-bold text-marca-texto">
        C
      </span>
      {!plegado && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-bold">Convoca</span>
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
}: {
  ruta: string;
  esSuperadmin: boolean;
  permisos: Permisos;
  plegado?: boolean;
}) {
  return (
    <>
      {MODULOS.map((modulo) => {
        const enlaces = enlacesVisibles(modulo, permisos, esSuperadmin);
        if (enlaces.length === 0) return null;

        // plegada: una entrada por modulo, no una por
        // enlace. Quince iconos en fila no distinguen nada
        if (plegado) {
          const activo = enlaces.some((e) => estaActivo(e, ruta));
          const Icono = modulo.icono;
          return (
            <Link
              key={modulo.clave}
              href={enlaces[0].href}
              title={`${modulo.etiqueta} — ${modulo.descripcion}`}
              aria-current={activo ? "page" : undefined}
              className={`mb-1 flex h-10 items-center justify-center rounded-xl transition ${
                activo
                  ? "bg-current/12"
                  : "opacity-60 hover:bg-current/8 hover:opacity-100"
              }`}
            >
              {Icono ? <Icono tamano={18} /> : <span>{modulo.paso ?? "·"}</span>}
            </Link>
          );
        }

        return (
          <section key={modulo.clave} className="mb-5">
            <h2
              className="px-3 pb-1.5 text-[10px] font-bold tracking-[0.08em] uppercase opacity-45"
              title={modulo.descripcion}
            >
              {modulo.paso ? `${modulo.paso}. ` : ""}
              {modulo.etiqueta}
            </h2>

            <ul className="space-y-0.5">
              {enlaces.map((enlace) => {
                const activo = estaActivo(enlace, ruta);
                const Icono = enlace.icono;
                return (
                  <li key={enlace.href}>
                    <Link
                      href={enlace.href}
                      aria-current={activo ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                        activo
                          ? "bg-current/12 font-medium"
                          : "opacity-65 hover:bg-current/8 hover:opacity-100"
                      }`}
                    >
                      {Icono && <Icono tamano={17} className="shrink-0" />}
                      <span className="truncate">{enlace.etiqueta}</span>
                      {activo && (
                        <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-marca" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
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
          <Grupos ruta={ruta} esSuperadmin={esSuperadmin} permisos={permisos} />
        </div>

        <ChipUsuario admin={admin} alSalir={alSalir} />
      </nav>
    </>
  );
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

      <h1 className="truncate text-[15px] font-semibold">{tituloDeRuta(ruta)}</h1>

      <div className="ml-auto flex items-center gap-1.5">
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
  "w-full rounded-lg border border-campo-borde bg-campo-fondo px-3 py-2 text-texto " +
  "outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25";

export function Tarjeta({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {descripcion && <p className="mt-1 text-sm text-texto-suave">{descripcion}</p>}
      <div className="mt-5">{children}</div>
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
