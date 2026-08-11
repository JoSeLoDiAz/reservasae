import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página no encontrada",
  // Sin descripción a propósito: esta página no debe decir de qué va el sitio.
};

/** 404 mudo: ni logo, ni enlaces, ni de qué va el sitio. */
export default function NoEncontrado() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-5xl font-semibold tracking-tight text-texto-suave">404</p>
      <p className="text-texto-suave">Esta página no existe.</p>
    </main>
  );
}
