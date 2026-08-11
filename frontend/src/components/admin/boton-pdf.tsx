"use client";

/** Botón de exportar a PDF. */
export function BotonPdf({ etiqueta = "Exportar a PDF" }: { etiqueta?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-imprimir inline-flex items-center gap-2 rounded-lg border border-borde px-4 py-2 text-sm font-medium transition hover:bg-superficie-alterna"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v7H6z" />
      </svg>
      {etiqueta}
    </button>
  );
}

/** Encabezado que solo existe en el papel. */
export function EncabezadoImpresion({
  titulo,
  subtitulo,
}: {
  titulo: string;
  subtitulo?: string;
}) {
  return (
    <div className="solo-impresion mb-6 border-b border-borde pb-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-texto-suave">
        Convoca · Reserva de cupos de formación
      </p>
      <h1 className="mt-1 text-xl font-semibold">{titulo}</h1>
      <p className="mt-0.5 text-xs text-texto-suave">
        {subtitulo ? `${subtitulo} · ` : ""}
        Generado el{" "}
        {new Date().toLocaleString("es-CO", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}
