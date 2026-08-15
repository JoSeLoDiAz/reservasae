"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { ConmutadorTema } from "@/components/marca-publica";
import { adminApi, type AdminActual } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";

import { PanelAccesibilidad } from "./accesibilidad";
import { CambioDeClaveObligatorio } from "./cambio-clave";
import { estaActivo, MODULOS } from "./navegacion";

type Contexto = { admin: AdminActual; refrescar: () => Promise<void> };

const ContextoAdmin = createContext<Contexto | null>(null);

export function useAdmin(): Contexto {
  const valor = useContext(ContextoAdmin);
  if (!valor) throw new Error("useAdmin fuera del marco del panel.");
  return valor;
}

const LLAVE_PLEGADO = "convoca:menu-plegado";

export function MarcoAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();

  const [admin, setAdmin] = useState<AdminActual | null>(null);
  const [cargando, setCargando] = useState(true);
  const [plegado, setPlegadoEstado] = useState(false);

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

  return (
    <ContextoAdmin.Provider value={{ admin, refrescar: cargar }}>
      <div className="flex min-h-screen">
        <BarraLateral
          ruta={ruta}
          esSuperadmin={admin.rol === "SUPERADMIN"}
          plegado={plegado}
          alPlegar={() => setPlegado(!plegado)}
        />

        <div className="flex min-w-0 grow flex-col">
          <Cabecera nombre={admin.nombre} alSalir={salir} />
          <NavegacionMovil ruta={ruta} esSuperadmin={admin.rol === "SUPERADMIN"} />
          <main className="w-full grow px-6 py-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </ContextoAdmin.Provider>
  );
}

/** Fija: la página hace scroll y esto no se mueve. */
function BarraLateral({
  ruta,
  esSuperadmin,
  plegado,
  alPlegar,
}: {
  ruta: string;
  esSuperadmin: boolean;
  plegado: boolean;
  alPlegar: () => void;
}) {
  return (
    <nav
      aria-label="Secciones del panel"
      // debajo de la franja, no tapada por ella
      style={{
        top: "var(--franja-alto, 0px)",
        height: "calc(100vh - var(--franja-alto, 0px))",
      }}
      className={`no-imprimir sticky hidden shrink-0 flex-col border-r border-borde bg-superficie transition-[width] md:flex ${
        plegado ? "w-16" : "w-64"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-borde px-3 py-4">
        {!plegado && (
          <Link href="/admin" className="min-w-0 grow truncate font-semibold">
            Convoca
          </Link>
        )}
        <button
          onClick={alPlegar}
          className="ml-auto rounded-lg border border-borde px-2 py-1 text-texto-suave"
          aria-label={plegado ? "Desplegar el menú" : "Plegar el menú"}
          title={plegado ? "Desplegar" : "Plegar"}
        >
          {plegado ? "»" : "«"}
        </button>
      </div>

      {/* el scroll es de aqui dentro, no de la pagina */}
      <div className="barra-visible min-h-0 grow overflow-y-auto px-2 py-3">
        {MODULOS.map((modulo) => {
          const enlaces = modulo.enlaces.filter((e) => !e.soloSuperadmin || esSuperadmin);
          if (enlaces.length === 0) return null;

          // plegado: una entrada por modulo, no una por
          // enlace. Cuatro numeros iguales no distinguen nada
          if (plegado) {
            const activo = enlaces.some((e) => estaActivo(e, ruta));
            return (
              <Link
                key={modulo.clave}
                href={enlaces[0].href}
                title={`${modulo.etiqueta} — ${modulo.descripcion}`}
                aria-current={activo ? "page" : undefined}
                className={`mb-1 flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition ${
                  activo
                    ? "bg-marca-suave text-marca"
                    : "text-texto-suave hover:bg-superficie-alterna hover:text-texto"
                }`}
              >
                {modulo.paso ?? "⚙"}
              </Link>
            );
          }

          return (
            <section key={modulo.clave} className="mb-4">
              <h2
                className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-texto-suave uppercase"
                title={modulo.descripcion}
              >
                {modulo.paso ? `${modulo.paso}. ` : ""}
                {modulo.etiqueta}
              </h2>

              <ul className="space-y-0.5">
                {enlaces.map((enlace) => {
                  const activo = estaActivo(enlace, ruta);
                  return (
                    <li key={enlace.href}>
                      <Link
                        href={enlace.href}
                        aria-current={activo ? "page" : undefined}
                        className={`block truncate rounded-lg px-3 py-2 text-sm transition ${
                          activo
                            ? "bg-marca-suave font-medium text-marca"
                            : "text-texto-suave hover:bg-superficie-alterna hover:text-texto"
                        }`}
                      >
                        {enlace.etiqueta}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </nav>
  );
}

/** En móvil no cabe la lateral: una tira que se desliza. */
function NavegacionMovil({ ruta, esSuperadmin }: { ruta: string; esSuperadmin: boolean }) {
  return (
    <nav
      aria-label="Secciones del panel"
      className="barra-visible no-imprimir overflow-x-auto border-b border-borde bg-superficie px-4 py-2 md:hidden"
    >
      <ul className="flex gap-1" style={{ width: "max-content" }}>
        {MODULOS.flatMap((modulo) =>
          modulo.enlaces
            .filter((e) => !e.soloSuperadmin || esSuperadmin)
            .map((enlace) => {
              const activo = estaActivo(enlace, ruta);
              return (
                <li key={enlace.href}>
                  <Link
                    href={enlace.href}
                    aria-current={activo ? "page" : undefined}
                    className={`block rounded-lg px-3 py-1.5 text-sm whitespace-nowrap ${
                      activo
                        ? "bg-marca-suave font-medium text-marca"
                        : "text-texto-suave"
                    }`}
                  >
                    {enlace.etiqueta}
                  </Link>
                </li>
              );
            }),
        )}
      </ul>
    </nav>
  );
}

function Cabecera({ nombre, alSalir }: { nombre: string; alSalir: () => void }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <header
      style={{ top: "var(--franja-alto, 0px)" }}
      className="no-imprimir sticky z-30 border-b border-encabezado-borde bg-encabezado-fondo text-encabezado-texto"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
        <span className="font-semibold">
          Convoca
          <span className="ml-2 rounded bg-marca/10 px-1.5 py-0.5 text-xs font-medium text-marca">
            panel
          </span>
        </span>

        <div className="relative ml-auto flex items-center gap-3 text-sm">
          <ConmutadorTema compacto />

          <button
            onClick={() => setAbierto(!abierto)}
            aria-expanded={abierto}
            className="rounded-lg border border-borde px-2 py-1.5 text-texto-suave"
            title="Accesibilidad"
          >
            <span aria-hidden>♿</span>
            <span className="sr-only">Accesibilidad</span>
          </button>
          {abierto && <PanelAccesibilidad alCerrar={() => setAbierto(false)} />}

          <span className="opacity-70">{nombre}</span>
          <button onClick={alSalir} className="text-marca underline">
            Salir
          </button>
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
    <section className="rounded-xl border border-borde bg-superficie p-6">
      <h2 className="text-lg font-medium">{titulo}</h2>
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
      className={`rounded-lg bg-marca px-5 py-2 font-medium text-marca-texto transition hover:bg-marca-fuerte disabled:opacity-50 ${resto.className ?? ""}`}
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
  return <div className={`rounded-lg border p-4 text-sm ${clases}`}>{children}</div>;
}
