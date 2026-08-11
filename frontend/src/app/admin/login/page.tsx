"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    "w-full rounded-lg border border-borde bg-superficie px-3 py-2 outline-none " +
    "transition focus:border-marca focus:ring-2 focus:ring-marca/20";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold">Convoca</h1>
      <p className="mt-1 text-texto-suave">Panel de administración</p>

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
          <p className="rounded-lg border border-error/30 bg-error-suave p-3 text-sm text-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={entrando}
          className="w-full rounded-lg bg-marca px-5 py-2.5 font-medium text-marca-texto hover:bg-marca-fuerte disabled:opacity-50"
        >
          {entrando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
