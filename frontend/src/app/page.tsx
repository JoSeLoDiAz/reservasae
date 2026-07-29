"use client";

import { useEffect, useState } from "react";

type Estado = {
  servicio: string;
  estado: string;
  version: string;
  hora: string;
};

export default function Home() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ruta relativa a proposito: la peticion sale del navegador y recorre
    // toda la cadena real (Cloudflare -> nginx -> backend). Si esto responde,
    // el despliegue completo funciona.
    fetch("/api/estado")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setEstado)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 font-sans dark:bg-black">
      <main className="w-full max-w-xl space-y-8">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            Convoca
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Reserva de cupos
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Despliegue base funcionando. El modelo de datos y el formulario
            llegan en la siguiente etapa.
          </p>
        </header>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-sm font-medium text-zinc-500">
            Conexion con el backend
          </h2>

          {!estado && !error && (
            <p className="text-zinc-500">Consultando /api/estado…</p>
          )}

          {error && (
            <div className="space-y-1">
              <p className="font-medium text-red-600">Sin conexion</p>
              <p className="font-mono text-sm text-zinc-500">{error}</p>
            </div>
          )}

          {estado && (
            <dl className="space-y-2 font-mono text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">estado</dt>
                <dd className="font-medium text-green-600">{estado.estado}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">servicio</dt>
                <dd className="text-zinc-800 dark:text-zinc-200">
                  {estado.servicio}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">version</dt>
                <dd className="text-zinc-800 dark:text-zinc-200">
                  {estado.version}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">hora</dt>
                <dd className="text-zinc-800 dark:text-zinc-200">
                  {estado.hora}
                </dd>
              </div>
            </dl>
          )}
        </section>
      </main>
    </div>
  );
}
