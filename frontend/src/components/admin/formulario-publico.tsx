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
/// El valor del desplegable que dice «lo escribo yo». Empieza por
/// dos guiones bajos para que no se pueda confundir nunca con un
/// `utm_source` de verdad, y no sale del panel.
export const CANAL_PROPIO = "__propio";

export const CANALES_DEL_ENLACE = [
  { utm: "", etiqueta: "Sin marcar" },
  { utm: "correo", etiqueta: "Correo" },
  { utm: "whatsapp", etiqueta: "WhatsApp" },
  { utm: "qr", etiqueta: "QR impreso" },
  /// El enlace que reparte una empresa con cupos apartados. En
  /// el nombre va la EMPRESA, no una fecha (18 sep 2026).
  { utm: "reserva", etiqueta: "Reserva de empresa" },
  /// Para pegar como «URL del sitio web» del anuncio. Trae el
  /// nombre de la campaña; el servidor solo la da por pagada si la
  /// visita lo prueba (`fbclid` o la app de Meta).
  { utm: "pauta", etiqueta: "Pauta (anuncio de Meta)" },
  /// EL CANAL QUE NO ESTÁ EN LA LISTA, escrito a mano (cliente, 24
  /// sep 2026: «que exista uno que pueda ser personalizable, ya que
  /// este no se tiene»).
  ///
  /// `__propio` NO viaja: es un marcador de la pantalla. Lo que
  /// viaja es la palabra que se teclee, y cae en «Otro canal
  /// etiquetado», que aquí NO es un fallo --como sí lo sería en una
  /// opción fija-- porque quien la escribe eligió inventarse el
  /// canal. La medición lo separa igual por el nombre del envío.
  { utm: CANAL_PROPIO, etiqueta: "Otro (lo escribo yo)" },
] as const;

/**
 * LO QUE NO SE PUEDE ESCRIBIR COMO CANAL PROPIO, y por qué es lo
 * único que se prohíbe.
 *
 * El desplegable no ofrece Facebook, Instagram ni Meta a propósito:
 * esas las pone Ads Manager, y dejar marcarlas a mano sería marcar
 * como pauta un tráfico que nadie pagó. Un campo de texto libre
 * reabre esa puerta por detrás --se teclea «meta» y ya está--, así
 * que la cierra aquí.
 *
 * Son, palabra por palabra, las que el servidor mapea a Meta o a
 * pauta (`DICE_FACEBOOK`, `DICE_INSTAGRAM`, `DICE_META`,
 * `DICE_PAUTA` en `procedencia.ts`). Que esta lista las cubra TODAS
 * lo ata `lo-que-el-panel-ofrece-se-clasifica.spec.ts`: si alguien
 * añade una palabra allá y no aquí, la prueba se cae.
 *
 * Lo demás sí se puede: escribir «correo» a mano acaba en el mismo
 * sitio que elegir Correo en la lista, y eso no rompe nada.
 */
export const PALABRAS_DE_PAUTA = [
  "fb",
  "facebook",
  "messenger",
  "ig",
  "instagram",
  "meta",
  "redes",
  "pauta",
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
  /// `&` cuando la base ya trae algo, que es el caso de los
  /// formularios personalizados: su dirección YA lleva la palabra
  /// que los identifica (`?TallerBootcamp`) y pegarle otro `?`
  /// detrás dejaba un enlace roto que ni marcaba ni abría el
  /// formulario. Las dos palabras conviven: una dice qué
  /// formulario es y la otra por dónde llegó.
  const une = base.includes("?") ? "&" : "?";

  const corta = palabraCorta(utm, comoViaja(envio));
  if (corta) return `${base}${une}${corta}`;

  const p = new URLSearchParams();
  if (utm) p.set("utm_source", utm);
  const nombre = comoViaja(envio);
  if (nombre) p.set("utm_campaign", nombre);
  const cola = p.toString();
  return cola ? `${base}${une}${cola}` : base;
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
  const [canalPropio, setCanalPropio] = useState("");
  const [envio, setEnvio] = useState("");

  /// La palabra que de verdad viaja. Con la lista, la del
  /// desplegable; con «lo escribo yo», la tecleada y ya limpia.
  const suyo = comoViaja(canalPropio);
  const prohibida = PALABRAS_DE_PAUTA.includes(suyo as (typeof PALABRAS_DE_PAUTA)[number]);
  /// Una palabra prohibida NO marca el enlace: se queda sin canal y
  /// el aviso dice por qué. Marcarlo igual sería contar como pauta
  /// un tráfico que nadie pagó, que es lo que esta pantalla lleva
  /// meses cuidando.
  const utmQueViaja = canal === CANAL_PROPIO ? (prohibida ? "" : suyo) : canal;

  const marcada = urlMarcada(url, utmQueViaja, envio);
  const nombre = comoViaja(envio);
  /// Lo mismo que con el envío: se avisa solo si difieren.
  const canalSeTransformo = canalPropio.trim() !== "" && suyo !== canalPropio.trim();
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
              {canal === CANAL_PROPIO && (
                <label className="text-sm">
                  <span className="mb-1 block text-texto-suave">Cómo se llama el canal</span>
                  <input
                    value={canalPropio}
                    onChange={(e) => setCanalPropio(e.target.value)}
                    placeholder="volante"
                    className="rounded-lg border border-borde bg-superficie px-3 py-2 text-sm"
                  />
                </label>
              )}
              <label className="min-w-0 grow text-sm">
                <span className="mb-1 block text-texto-suave">
                  {canal === "reserva"
                    ? "Empresa que reservó"
                    : canal === "pauta"
                      ? "Nombre o número de la campaña"
                      : "Nombre de este envío"}
                </span>
                <input
                  value={envio}
                  onChange={(e) => setEnvio(e.target.value)}
                  placeholder={
                    canal === "reserva"
                      ? "Transportes El Cóndor"
                      : canal === "pauta"
                        ? "0305202255"
                        : "18092026"
                  }
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
            {canal === CANAL_PROPIO && canalSeTransformo && !prohibida && (
              <p className="mt-1 text-xs text-aviso">
                El canal viaja como «{suyo}», por lo mismo.
              </p>
            )}
            {prohibida && (
              <p className="mt-1 text-xs text-error" role="alert">
                «{suyo}» no se puede usar: es una de las palabras con las que el
                sistema reconoce la pauta de Meta, y marcarla a mano contaría como
                pagado un tráfico que no lo es. El enlace se queda sin marcar
                mientras esté puesta. Escriba otra, por ejemplo «volante» o
                «emisora».
              </p>
            )}
            {canal === CANAL_PROPIO && suyo !== "" && !prohibida && (
              <p className="mt-1 text-xs text-texto-suave">
                Un canal propio no tiene enlace corto, así que la dirección sale
                con sus <code>utm_</code> a la vista. En Tráfico del formulario
                aparece con su nombre.
              </p>
            )}
          </div>
        </div>
        <CodigoQR url={marcada} titulo={sigla} />
      </div>
    </Tarjeta>
  );
}
