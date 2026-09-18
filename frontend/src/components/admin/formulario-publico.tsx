"use client";

/** Un formulario público: qué pide, dónde vive y su QR. */

/// Los dos momentos del formulario son distintos por
/// naturaleza, y la pantalla tiene que decirlo:
///
///   El CORTO es público. Vive en una URL por gremio, la
///   misma para todo el mundo, y se puede repartir en un QR.
///
///   El LARGO es personal. Cada enlace se emite desde la
///   lead de un lead, es de un solo uso y caduca. NO tiene
///   QR, y ofrecerlo seria mentir: un QR pegado en una pared
///   solo puede llevar a un sitio, y este cambia por persona.

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

import { palabraCorta } from "@/lib/enlace-corto";

import { Tarjeta } from "./marco-admin";

/**
 * Los canales que la pantalla de tráfico SABE reconocer.
 *
 * Los valores NO son inventados: son los que `procedenciaSql()`
 * clasifica en el servidor (`DICE_CORREO`, `DICE_WHATSAPP`, y el
 * `qr` a secas). Ofrecer aquí uno que allá no exista dejaría el
 * envío en «Otro declarado», que es no haberlo marcado.
 *
 * NO se ofrecen Facebook ni Instagram, y es deliberado: esas las
 * pone Ads Manager en su propio enlace, y un desplegable que las
 * ofreciera dejaría marcar a mano como pauta un tráfico que no lo
 * es — justo lo que la atribución a pauta se paró para evitar.
 */
export const CANALES_DEL_ENLACE = [
  { utm: "", etiqueta: "Sin marcar" },
  { utm: "correo", etiqueta: "Correo" },
  { utm: "whatsapp", etiqueta: "WhatsApp" },
  { utm: "qr", etiqueta: "QR impreso" },
  /// El enlace que reparte una empresa con cupos apartados. En
  /// el nombre va la EMPRESA, no una fecha (18 sep 2026).
  { utm: "reserva", etiqueta: "Reserva de empresa" },
] as const;

/**
 * El nombre del envío, como sobrevive al viaje.
 *
 * La baliza QUITA todo lo que no sea `[A-Za-z0-9._-]` en vez de
 * traducirlo, así que «envío de prueba» llegaría como
 * «enviodeprueba» y «campaña» como «campaa»: lo que alguien
 * teclea y lo que después lee en la pantalla no serían lo mismo,
 * y nadie lo sabría. Aquí se traduce antes, a la vista.
 */
export function comoViaja(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/// La dirección ya marcada. Sin canal ni nombre, la de siempre.
///
/// Con canal sale CORTA --`?mailing18092026`--, que es lo que se
/// le puede mandar a un ciudadano sin que parezca un rastreador.
/// Solo sin canal quedan los `utm_`, porque el corto no existe sin
/// prefijo: ver `enlace-corto.ts`.
export function urlMarcada(base: string, utm: string, envio: string): string {
  const corta = palabraCorta(utm, comoViaja(envio));
  if (corta) return `${base}?${corta}`;

  const p = new URLSearchParams();
  if (utm) p.set("utm_source", utm);
  const nombre = comoViaja(envio);
  if (nombre) p.set("utm_campaign", nombre);
  const cola = p.toString();
  return cola ? `${base}?${cola}` : base;
}

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
  /// El canal y el nombre del envío arman la dirección. Se
  /// quedan aquí y no en la URL del panel: es una herramienta
  /// para copiar algo, no un estado que haya que compartir.
  const [canal, setCanal] = useState("");
  const [envio, setEnvio] = useState("");

  const marcada = urlMarcada(url, canal, envio);
  const nombre = comoViaja(envio);
  /// Se avisa solo cuando lo tecleado y lo que viaja DIFIEREN.
  const seTransformo = envio.trim() !== "" && nombre !== envio.trim();

  return (
    <Tarjeta titulo={sigla}>
      <div className="grid sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="space-y-3">
          <p className="text-sm text-texto-suave">
            Esta es la dirección que se reparte. La misma para todo el mundo.
          </p>
          <Direccion url={marcada} />
          <a
            href={marcada}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm underline underline-offset-2"
          >
            Abrirlo como lo ve la persona
          </a>

          {/* MARCAR EL ENLACE, y por que vive aqui.
              El tráfico se separa por lo que nosotros escribamos
              en el enlace --un correo abierto en Outlook y un QR
              no dejan ninguna señal--, así que la etiqueta tiene
              que ponerse donde se copia la dirección. Armada a
              mano, un día sale mal escrita y ese envío se cuenta
              en otro sitio sin que nada falle. */}
          <div className="border-t border-borde pt-3">
            <h3 className="mb-2 text-xs tracking-wide text-texto-suave uppercase">
              Marcar de dónde va a llegar
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-texto-suave">Se reparte por</span>
                <select
                  value={canal}
                  onChange={(e) => setCanal(e.target.value)}
                  className="rounded-lg border border-borde bg-superficie px-3 py-2 text-sm"
                >
                  {CANALES_DEL_ENLACE.map((c) => (
                    <option key={c.utm} value={c.utm}>
                      {c.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 grow text-sm">
                <span className="mb-1 block text-texto-suave">
                  {canal === "reserva" ? "Empresa que reservó" : "Nombre de este envío"}
                </span>
                <input
                  value={envio}
                  onChange={(e) => setEnvio(e.target.value)}
                  placeholder={canal === "reserva" ? "Transportes El Cóndor" : "18092026"}
                  className="w-full rounded-lg border border-borde bg-superficie px-3 py-2 text-sm"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-texto-suave">
              {canal === "" && nombre === ""
                ? "Sin marcar, este tráfico se mezcla con el de todos los demás en Tráfico del formulario."
                : "Así este envío sale con su propio nombre en Tráfico del formulario, separado del resto."}
            </p>
            {seTransformo && (
              <p className="mt-1 text-xs text-aviso">
                Viaja como «{nombre}»: la medición solo guarda letras sin tilde,
                números y guiones.
              </p>
            )}
          </div>
        </div>
        <CodigoQR url={marcada} titulo={sigla} />
      </div>
    </Tarjeta>
  );
}
