"use client";

/** Un formulario público: qué pide, dónde vive y su QR. */

/// Los dos momentos del formulario son distintos por
/// naturaleza, y la pantalla tiene que decirlo:
///
///   El CORTO es público. Vive en una URL por gremio, la
///   misma para todo el mundo, y se puede repartir en un QR.
///
///   El LARGO es personal. Cada enlace se emite desde la
///   ficha de un lead, es de un solo uso y caduca. NO tiene
///   QR, y ofrecerlo seria mentir: un QR pegado en una pared
///   solo puede llevar a un sitio, y este cambia por persona.

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

import { Tarjeta } from "./marco-admin";

export type Campo = { etiqueta: string; obligatorio?: boolean };
export type Bloque = { titulo: string; campos: Campo[] };

/** El QR de una URL, en SVG, para imprimir sin que se pixele. */
function CodigoQR({ url, titulo }: { url: string; titulo: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    QRCode.toString(url, {
      type: "svg",
      // alta correccion: aguanta un logo encima, una
      // fotocopia mala y un pliegue del papel
      errorCorrectionLevel: "H",
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((s) => {
        if (vivo) setSvg(s);
      })
      .catch(() => {
        if (vivo) setError(true);
      });
    return () => {
      vivo = false;
    };
  }, [url]);

  if (error) {
    return (
      <p className="text-sm text-texto-suave">
        No se pudo generar el código. Revise que la dirección esté bien.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* fondo blanco siempre: un QR sobre fondo oscuro no
          lo lee ningun telefono */}
      <div
        className="mx-auto w-[190px] rounded-xl bg-white p-3"
        // el SVG viene de la libreria, no de nadie de fuera
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      >
        {!svg ? <div className="h-[164px]" /> : null}
      </div>
      <button
        type="button"
        onClick={() => {
          if (!svg) return;
          const v = window.open("", "_blank", "width=520,height=640");
          if (!v) return;
          v.document.write(
            `<title>${titulo}</title>` +
              `<div style="font:600 15px system-ui;text-align:center;padding:28px">` +
              `<p>${titulo}</p>${svg}` +
              `<p style="font:400 11px ui-monospace;word-break:break-all;color:#555">${url}</p>` +
              `</div>`,
          );
          v.document.close();
          v.print();
        }}
        disabled={!svg}
        className="mx-auto block rounded-lg border border-borde px-3 py-1.5 text-sm transition hover:bg-superficie-alterna disabled:opacity-50"
      >
        Imprimir el código
      </button>
    </div>
  );
}

/** La dirección, con su botón de copiar. */
function Direccion({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (reloj.current) clearTimeout(reloj.current);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 grow rounded-lg border border-borde bg-superficie px-3 py-2 font-mono text-xs"
      />
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => {
            setCopiado(true);
            if (reloj.current) clearTimeout(reloj.current);
            reloj.current = setTimeout(() => setCopiado(false), 2000);
          });
        }}
        className="rounded-lg border border-borde px-3 py-2 text-sm transition hover:bg-superficie-alterna"
      >
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

/** Lo que el formulario le pregunta a la persona. */
export function LoQuePregunta({ bloques }: { bloques: Bloque[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {bloques.map((b) => (
        <div key={b.titulo}>
          <h3 className="mb-2 text-xs tracking-wide text-texto-suave uppercase">
            {b.titulo}
          </h3>
          <ul className="space-y-1 text-sm">
            {b.campos.map((c) => (
              <li key={c.etiqueta} className="flex items-baseline gap-1.5">
                <span>{c.etiqueta}</span>
                {c.obligatorio && (
                  <span className="text-xs text-aviso" title="Obligatorio">
                    *
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Una dirección pública con su QR, por gremio. */
export function EnlacePublico({
  sigla,
  url,
}: {
  sigla: string;
  url: string;
}) {
  return (
    <Tarjeta titulo={sigla}>
      <div className="grid sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="space-y-3">
          <p className="text-sm text-texto-suave">
            Esta es la dirección que se reparte. La misma para todo el mundo.
          </p>
          <Direccion url={url} />
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm underline underline-offset-2"
          >
            Abrirlo como lo ve la persona
          </a>
        </div>
        <CodigoQR url={url} titulo={sigla} />
      </div>
    </Tarjeta>
  );
}
