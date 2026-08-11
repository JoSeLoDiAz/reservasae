"use client";

import { useState } from "react";

import { adminApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";

const LARGO_MINIMO = 10;

/** Tapa el panel mientras la clave siga siendo temporal. */
export function CambioDeClaveObligatorio({ alTerminar }: { alTerminar: () => Promise<void> }) {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold">Cambie su contraseña</h1>
      <p className="mt-2 text-texto-suave">
        Su cuenta se creó con una contraseña temporal que conoce quien se la
        entregó. Elija una nueva para continuar.
      </p>
      <div className="mt-8">
        <FormularioCambioClave alTerminar={alTerminar} textoBoton="Cambiar y entrar" />
      </div>
    </div>
  );
}

export function FormularioCambioClave({
  alTerminar,
  textoBoton = "Cambiar contraseña",
}: {
  alTerminar: () => Promise<void>;
  textoBoton?: string;
}) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    // el servidor solo recibe una de las dos
    if (nueva !== repetida) {
      setError("Las dos contraseñas nuevas no coinciden.");
      return;
    }
    if (nueva.length < LARGO_MINIMO) {
      setError(`La contraseña nueva debe tener al menos ${LARGO_MINIMO} caracteres.`);
      return;
    }

    setEnviando(true);
    try {
      await adminApi.cambiarClave(actual, nueva);
      setListo(true);
      setActual("");
      setNueva("");
      setRepetida("");
      await alTerminar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setEnviando(false);
    }
  }

  const clase =
    "w-full rounded-lg border border-borde bg-superficie px-3 py-2 outline-none " +
    "transition focus:border-marca focus:ring-2 focus:ring-marca/20";

  return (
    <form onSubmit={enviar} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Contraseña actual</span>
        <input
          required
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          className={clase}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Contraseña nueva</span>
        <input
          required
          type="password"
          autoComplete="new-password"
          minLength={LARGO_MINIMO}
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          className={clase}
        />
        <span className="mt-1.5 block text-xs text-texto-suave">
          Mínimo {LARGO_MINIMO} caracteres.
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Repita la contraseña nueva</span>
        <input
          required
          type="password"
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
          className={clase}
        />
      </label>

      {error && (
        <p className="rounded-lg border border-error/30 bg-error-suave p-3 text-sm text-error">
          {error}
        </p>
      )}
      {listo && !error && (
        <p className="rounded-lg border border-exito/30 bg-exito-suave p-3 text-sm text-exito">
          Contraseña actualizada.
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg bg-marca px-5 py-2 font-medium text-marca-texto hover:bg-marca-fuerte disabled:opacity-50"
      >
        {enviando ? "Guardando…" : textoBoton}
      </button>
    </form>
  );
}
