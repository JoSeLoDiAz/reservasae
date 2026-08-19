"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConmutadorTema } from "@/components/marca-publica";
import { adminApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";

export default function PaginaAcceso() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
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

  const clase =
    "w-full rounded-xl border border-campo-borde bg-campo-fondo px-3.5 py-2.5 text-texto " +
    "outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25";

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* el panel de marca: solo desde lg, o roba la pantalla */}
      <section className="relative hidden flex-col justify-between bg-marca p-10 text-marca-texto lg:flex">
        <Marca />

        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-bold">
            De los cupos apartados a las personas formadas.
          </h2>
          <p className="mt-4 text-sm leading-relaxed opacity-80">
            Aquí se sigue cada organización que reservó, cada persona inscrita y
            cómo avanza su formación.
          </p>
        </div>

        <p className="text-xs opacity-60">Convoca · panel de gestión</p>
      </section>

      <section className="relative flex items-center justify-center p-6 lg:p-10">
        <div className="absolute top-4 right-4">
          <ConmutadorTema compacto />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <MarcaOscura />
          </div>

          <h1 className="text-2xl font-bold">Bienvenido</h1>
          <p className="mt-1 text-sm text-texto-suave">
            Entre con el correo con el que le crearon la cuenta.
          </p>

          <form onSubmit={enviar} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Correo</span>
              <input
                required
                type="email"
                autoComplete="username"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className={clase}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Contraseña</span>
              <input
                required
                type="password"
                autoComplete="current-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                className={clase}
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-error/30 bg-error-suave p-3 text-sm text-error"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={entrando}
              className="w-full rounded-xl bg-marca px-5 py-2.5 font-medium text-marca-texto shadow-sm transition hover:bg-marca-fuerte disabled:opacity-50"
            >
              {entrando ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p className="mt-8 text-xs text-texto-suave">
            ¿No tiene cuenta? Las crea un administrador del sistema.
          </p>
        </div>
      </section>
    </div>
  );
}

/// Sobre el panel de marca: hereda su color de texto.
function Marca() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-marca-texto/15 text-base font-bold">
        C
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-bold">Convoca</span>
        <span className="text-xs opacity-70">panel de gestión</span>
      </span>
    </div>
  );
}

/// La de móvil, sobre el fondo normal.
function MarcaOscura() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-marca text-base font-bold text-marca-texto">
        C
      </span>
      <span className="font-bold">Convoca</span>
    </div>
  );
}
