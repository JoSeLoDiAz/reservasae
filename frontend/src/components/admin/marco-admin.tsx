"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { ConmutadorTema } from "@/components/marca-publica";
import { adminApi, type AdminActual } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";

import { CambioDeClaveObligatorio } from "./cambio-clave";

type Contexto = { admin: AdminActual; refrescar: () => Promise<void> };

const ContextoAdmin = createContext<Contexto | null>(null);

export function useAdmin(): Contexto {
  const valor = useContext(ContextoAdmin);
  if (!valor) throw new Error("useAdmin fuera del marco del panel.");
  return valor;
}

const SECCIONES = [
  { href: "/admin", etiqueta: "Tablero", exacto: true },
  { href: "/admin/reservas", etiqueta: "Reservas" },
  { href: "/admin/participantes", etiqueta: "Inscripciones" },
  { href: "/admin/empresas", etiqueta: "Organizaciones" },
  { href: "/admin/acciones", etiqueta: "Formación" },
  { href: "/admin/formularios", etiqueta: "Formularios" },
  { href: "/admin/politicas", etiqueta: "Políticas" },
  { href: "/admin/marca", etiqueta: "Apariencia" },
  { href: "/admin/usuarios", etiqueta: "Usuarios", soloSuperadmin: true },
  { href: "/admin/perfil", etiqueta: "Mi perfil" },
];

export function MarcoAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();

  const [admin, setAdmin] = useState<AdminActual | null>(null);
  const [cargando, setCargando] = useState(true);

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

  const secciones = SECCIONES.filter(
    (s) => !s.soloSuperadmin || admin.rol === "SUPERADMIN",
  );

  async function salir() {
    await adminApi.cerrarSesion();
    router.replace("/admin/login");
  }

  return (
    <ContextoAdmin.Provider value={{ admin, refrescar: cargar }}>
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-encabezado-borde bg-encabezado-fondo text-encabezado-texto">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
            <Link href="/admin" className="font-semibold">
              Convoca
              <span className="ml-2 rounded bg-marca/10 px-1.5 py-0.5 text-xs font-medium text-marca">
                panel
              </span>
            </Link>

            <nav className="flex flex-wrap gap-1 text-sm">
              {secciones.map((s) => {
                const activa = s.exacto ? ruta === s.href : ruta.startsWith(s.href);
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      activa
                        ? "bg-marca-suave font-medium text-marca"
                        : "text-texto-suave hover:bg-fondo"
                    }`}
                  >
                    {s.etiqueta}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
              <ConmutadorTema compacto />
              <span className="opacity-70">{admin.nombre}</span>
              <button onClick={salir} className="text-marca underline">
                Salir
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl grow px-6 py-8">{children}</main>
      </div>
    </ContextoAdmin.Provider>
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
