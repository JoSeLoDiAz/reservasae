"use client";

/**
 * Botón de exportar a PDF.
 *
 * ROJO Y SIN ICONO, desde el 12 sep 2026: «quita el emoji, deja
 * solo el texto, y todos los botones que son para dar PDF color
 * rojo como el color del logo del PDF para que quede más chusco»
 * (cliente).
 *
 * El icono era una impresora dibujada, y al lado de un texto que
 * ya dice «PDF» no añadía nada: en una barra con tres botones,
 * el único con dibujo se lee como si fuera de otra familia.
 *
 * El rojo es un token --`--pdf`, en `globals.css`-- y no un hex
 * escrito aquí: este botón sale en cinco pantallas y el color de
 * una acción no se decide en un componente.
 *
 * Es el ÚNICO sitio del panel donde el rojo no significa
 * «peligro». Se lo puede permitir porque no compite con nada: los
 * avisos de error son texto y fondo tenue, nunca un botón
 * relleno.
 */
export function BotonPdf({ etiqueta = "Exportar a PDF" }: { etiqueta?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-imprimir sin-aro inline-flex h-[30px] items-center rounded-lg bg-pdf px-4 text-[0.8125rem] font-semibold whitespace-nowrap text-pdf-texto transition hover:bg-pdf-fuerte"
    >
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
        Convoca CRM · Reserva de cupos de formación
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
