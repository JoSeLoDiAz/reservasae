"use client";

/** La dirección que se reparte, con su campaña puesta. */

/// Un formulario publicado ya tenía enlace. Lo que no tenía era
/// forma de saber POR CUÁL de los cinco sitios donde se pegó
/// entró cada negocio, y esa es la cuenta que justifica seguir
/// pagando el anuncio.
///
/// Aquí se arma la dirección con la marca de campaña dentro. La
/// convención —qué se escribe y por qué— vive en
/// `lib/enlace-de-campana.ts`, en un solo sitio, porque la lee
/// también la ficha para contar lo que entró.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";

import { Desplegable } from "./desplegable";
import { ETIQUETA_ORIGEN, type Origen } from "@/lib/crm-api";
import {
  cuantoCabeDeAnuncio,
  enlaceConCampana,
  marcaDeCampana,
} from "@/lib/enlace-de-campana";

/// Los canales por los que se reparte un enlace. Del catálogo
/// entero se dejan fuera EMPRESA, ASESOR y AUTOGESTION: esos no
/// son un sitio donde se pegue un enlace, son cómo llegó alguien
/// sin él.
const CANALES: Origen[] = [
  "REDES",
  "INSTAGRAM",
  "FACEBOOK",
  "LINKEDIN",
  "WHATSAPP",
  "CORREO",
  "EVENTO",
  "REFERIDO",
  "OTRO",
];

/**
 * EL DOMINIO DESDE EL QUE SE ESTÁ MIRANDO EL PANEL.
 *
 * Es la única parte de la dirección que no sale de la base, y hay
 * que sacarla del navegador: cada gremio entra por su propio
 * dominio y ahí es donde vive su formulario.
 *
 * `window` no existe en el render del servidor. Leerlo en el
 * cuerpo del componente deja el HTML del servidor distinto del que
 * pinta el navegador —hidratación rota, y en esta pantalla el
 * síntoma sería una dirección a medias que alguien copia—, y
 * resolverlo con `useState` + `useEffect` es un render en cascada
 * por cada tarjeta de la lista.
 *
 * `useSyncExternalStore` es lo que hay para esto: una foto para el
 * servidor —vacía, que es lo único cierto ahí— y otra para el
 * navegador. No hay a qué suscribirse porque el dominio no cambia
 * sin recargar; la función va FUERA del componente para que sea la
 * misma en todos los renders y React no se resuscriba a cada uno.
 */
const sinSuscripcion = () => () => {};
const elOrigen = () => window.location.origin;
const elOrigenEnElServidor = () => "";

/** El QR de una URL, en SVG, para imprimir sin que se pixele. */
export function CodigoQR({ url, titulo }: { url: string; titulo: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    QRCode.toString(url, {
      type: "svg",
      // alta correccion: aguanta un logo encima, una fotocopia
      // mala y un pliegue del papel
      errorCorrectionLevel: "H",
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((s) => {
        if (!vivo) return;
        setSvg(s);
        /// Se limpia AL ACERTAR y no al empezar: la dirección
        /// cambia con cada tecla que se escribe en la campaña, y
        /// apagar el aviso en cada pulsación lo haría parpadear.
        setError(false);
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
      <p className="secundario">
        No se pudo generar el código. Revise que la dirección esté bien.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* fondo blanco siempre: un QR sobre fondo oscuro no lo lee
          ningun telefono */}
      <div
        className="mx-auto w-[190px] rounded-plano bg-white p-3"
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
            "<title>" +
              titulo +
              "</title>" +
              '<div style="font:600 15px system-ui;text-align:center;padding:28px">' +
              "<p>" +
              titulo +
              "</p>" +
              svg +
              '<p style="font:400 11px ui-monospace;word-break:break-all;color:#555">' +
              url +
              "</p></div>",
          );
          v.document.close();
          v.print();
        }}
        disabled={!svg}
        className="mx-auto block rounded-plano border border-borde px-3 py-1.5 dato transition hover:bg-superficie-alterna disabled:opacity-50"
      >
        Imprimir el código
      </button>
    </div>
  );
}

/** La dirección, con su botón de copiar. */
export function Direccion({ url }: { url: string }) {
  /// SE GUARDA QUÉ SE COPIÓ, NO QUE SE COPIÓ ALGO.
  ///
  /// Con un booleano, escribir una letra más en la campaña dejaba
  /// el «Copiado» encendido sobre una dirección que ya no era la
  /// del portapapeles. Apagarlo con un efecto sobre `url` arregla
  /// el síntoma; guardar la dirección copiada lo hace imposible,
  /// porque el rótulo pasa a ser una comparación y no un estado
  /// que haya que mantener a mano.
  const [copiada, setCopiada] = useState<string | null>(null);
  const copiado = copiada !== null && copiada === url;
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (reloj.current) clearTimeout(reloj.current);
    },
    [],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 grow rounded-plano border border-borde bg-superficie px-3 py-2 font-mono micro"
      />
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => {
            setCopiada(url);
            if (reloj.current) clearTimeout(reloj.current);
            reloj.current = setTimeout(() => setCopiada(null), 2000);
          });
        }}
        className="rounded-plano border border-borde px-3 py-2 dato transition hover:bg-superficie-alterna"
      >
        {/* El color va en la letra, sin caja. */}
        <span className={copiado ? " text-exito" : undefined}>
          {copiado ? "Copiado" : "Copiar"}
        </span>
      </button>
    </div>
  );
}

/**
 * El generador: se elige el anuncio y sale la dirección.
 *
 * `ruta` entera y no el slug porque las dos puertas no viven en
 * el mismo sitio —`/<slug>` el formulario del constructor,
 * `/<gremio>/preinscripcion` el corto—, y `slug` aparte porque es
 * lo que se escribe DENTRO de la campaña.
 */
export function EnlaceConCampana({
  slug,
  ruta,
  titulo,
  campanas = [],
  conQR = true,
}: {
  slug: string;
  ruta: string;
  /** Cómo se llama el papel que se imprime con el QR. */
  titulo: string;
  /** Campañas de correo que ya existen, como sugerencia. */
  campanas?: string[];
  conQR?: boolean;
}) {
  const [anuncio, setAnuncio] = useState("");
  const [canal, setCanal] = useState("");

  const base = useSyncExternalStore(sinSuscripcion, elOrigen, elOrigenEnElServidor);

  const marca = marcaDeCampana(slug, anuncio);
  const url = enlaceConCampana(base, ruta, marca, canal);
  const listaId = `campanas-${slug}`;

  return (
    /// `flex-wrap` y no una rejilla con `sm:`: esto se usa en una
    /// tarjeta de media pantalla y en una franja entera, y una
    /// consulta de medios mide la VENTANA, no el hueco. Con
    /// envoltura, el QR se pone al lado donde cabe y debajo
    /// donde no, sin saber en qué pantalla está.
    <div className="flex flex-wrap items-start gap-x-7 gap-y-4">
      {/* UN CAMPO MIDE LO QUE MIDE SU DATO.

          Sin tope, `grow` estiraba esta columna hasta donde
          llegara la banda: a 1920 el campo del anuncio medía
          1190 px para escribir «meta-octubre», la dirección
          otros 1150 y el QR quedaba a 1400 px de la etiqueta que
          lo genera. 540 px es lo que miden de verdad los dos
          campos —320 el anuncio y 190 el canal, con sus 12 de
          separación— y también la dirección más larga que sale
          de aquí. Con el tope, el QR se pone al LADO de lo que
          lo produce en vez de al otro extremo de la pantalla. */}
      <div className="min-w-0 max-w-[540px] grow basis-[320px] space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_190px]">
          <label className="block">
            <span className="mb-1.5 block rotulo-bloque">
              De qué anuncio o correo viene
            </span>
            {/* Escribible Y con lista: las campañas de correo son
                sugerencia, no encierro. Un enlace se pega también
                donde no hay campaña —el pie de una firma, un
                volante— y eso no está en ninguna lista. */}
            <input
              value={anuncio}
              list={campanas.length ? listaId : undefined}
              maxLength={cuantoCabeDeAnuncio(slug)}
              onChange={(e) => setAnuncio(e.target.value)}
              placeholder="meta-octubre"
              className="w-full rounded-plano border border-campo-borde bg-campo-fondo px-3 py-2 dato outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25"
            />
            {campanas.length > 0 && (
              <datalist id={listaId}>
                {campanas.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            )}
          </label>

          <label className="block">
            <span className="mb-1.5 block rotulo-bloque">Canal</span>
            <Desplegable
              valor={canal}
              alElegir={setCanal}
              marcador="Sin especificar"
              alto={38}
              opciones={[
                { valor: "", etiqueta: "Sin especificar" },
                ...CANALES.map((o) => ({ valor: o, etiqueta: ETIQUETA_ORIGEN[o] })),
              ]}
            />
          </label>
        </div>

        <p className="micro">
          Queda marcada como <span className="font-mono text-texto">{marca}</span>
          , que es lo que sale en el embudo y lo que esta ficha cuenta.
        </p>

        <Direccion url={url} />

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a
            href={url || ruta}
            target="_blank"
            rel="noreferrer"
            className="dato underline underline-offset-2"
          >
            Abrirlo como lo ve la persona
          </a>
          {(anuncio.trim() || canal) && (
            <button
              type="button"
              onClick={() => {
                setAnuncio("");
                setCanal("");
              }}
              className="secundario underline underline-offset-2"
            >
              Quitar la campaña
            </button>
          )}
        </div>

        {/* La condición, y no una fecha ni un «próximamente»: la
            dirección lleva la campaña, y llega al embudo cuando la
            pantalla pública la manda al captar. Escrito así sigue
            siendo cierto el día que empiece a mandarla. */}
        <p className="micro">
          Llega al embudo si el formulario público la manda al captar. Mientras no
          lo haga, la escribe el asesor al abrir la oportunidad.
        </p>
      </div>

      {conQR && base && (
        <div className="w-[190px] shrink-0">
          <CodigoQR url={url} titulo={titulo} />
        </div>
      )}
    </div>
  );
}
