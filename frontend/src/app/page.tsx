"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Convenio = { slug: string; nombre: string; sigla: string | null };

export default function Inicio() {
  const [convenios, setConvenios] = useState<Convenio[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ruta relativa a proposito: la peticion sale del navegador y recorre toda
    // la cadena real (Cloudflare -> nginx -> backend).
    fetch("/api/catalogo")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setConvenios)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <header className="mb-10">
        <p className="text-sm font-medium uppercase tracking-widest text-texto-suave">
          Convoca
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Reserva de cupos de formación
        </h1>
        <p className="mt-3 text-texto-suave">
          Formación gratuita para las organizaciones vinculadas. Elija el programa
          que le corresponde.
        </p>
      </header>

      {error && (
        <p className="rounded-xl border border-error/30 bg-error-suave p-6 text-error">
          No se pudo cargar la oferta ({error}).
        </p>
      )}

      {!convenios && !error && <p className="text-texto-suave">Cargando…</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {convenios?.map((convenio) => (
          <Link
            key={convenio.slug}
            href={`/${convenio.slug}`}
            className="rounded-xl border border-borde bg-superficie p-6 transition hover:border-marca hover:shadow-sm"
          >
            <p className="text-lg font-medium">{convenio.sigla ?? convenio.nombre}</p>
            <p className="mt-1 text-sm text-texto-suave">{convenio.nombre}</p>
            <p className="mt-4 text-sm font-medium text-marca">Reservar cupos →</p>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-sm text-texto-suave">
        ¿Ya reservó?{" "}
        <Link href="/consulta" className="text-marca underline">
          Consulte o modifique su reserva con el NIT
        </Link>
        .
      </p>
    </main>
  );
}
