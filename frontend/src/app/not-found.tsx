import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página no encontrada",
  // sin descripción a propósito
};

/** 404 mudo: ni logo ni enlaces. */
export default function NoEncontrado() {
  return (
    <main
      // la altura resta la franja, como el resto
      style={{ minHeight: "calc(100vh - var(--franja-alto, 0px))" }}
      className="flex flex-col items-center justify-center gap-2 px-6 text-center"
    >
      <p className="text-5xl font-semibold tracking-tight text-texto-suave">404</p>
      <p className="text-texto-suave">Esta página no existe.</p>
    </main>
  );
}
