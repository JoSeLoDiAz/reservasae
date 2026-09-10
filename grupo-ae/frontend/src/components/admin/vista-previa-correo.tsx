"use client";

/** Cómo va a salir el correo, mientras se escribe. */

/// Sin esto, quien escribe una plantilla no ve lo que hace
/// hasta que ya salió a cien personas. Aquí se ve al lado,
/// mientras teclea, con datos de ejemplo puestos.
///
/// Los datos son de EJEMPLO y se dice: son los del catálogo de
/// variables, no los de nadie. Enseñar aquí a una persona real
/// haría creer que el correo ya está resuelto para ella, y
/// cada quien tiene los suyos -- a unos les va a faltar el
/// grupo y a otros el asesor.

import { useMemo, useState } from "react";

import type { VariableCorreo } from "@/lib/plantillas-correo-api";

/// En qué se está mirando el correo.
///
/// Los anchos no son de pantalla: son los del ÁREA DE LECTURA
/// del cliente de correo, que es lo que de verdad decide dónde
/// parte una línea. En un computador Gmail deja el mensaje en
/// unos 640 px por mucho que el monitor mida 1920 —por eso una
/// plantilla se maqueta a 600— y en un celular el ancho útil
/// ronda los 360.
///
/// Sirve para ver lo único que no se puede arreglar después:
/// un asunto que se corta, una palabra larga que desborda, un
/// cabezote que en el celular queda ilegible.
type Dispositivo = "pc" | "tableta" | "celular";

const ANCHOS: Array<{ clave: Dispositivo; texto: string; px: number }> = [
  { clave: "pc", texto: "Computador", px: 640 },
  { clave: "tableta", texto: "Tableta", px: 480 },
  { clave: "celular", texto: "Celular", px: 360 },
];

export const HUECO = /\{\{\s*([a-zA-ZÀ-ÿ0-9_]+)\s*\}\}/g;

export type Trozo = {
  t: string;
  /// `hueco` es una variable del catálogo, ya resuelta.
  /// `roto` es una que no existe y va a salir tal cual.
  clase: "texto" | "hueco" | "roto";
};

/**
 * El texto con los huecos llenos, partido en trozos.
 *
 * Devuelve los trozos —para poder pintar cada variable
 * distinta— y de paso quiénes se pusieron y quiénes no
 * existen, que es lo que decide si se puede guardar.
 */
export function resolver(
  texto: string,
  ejemplos: Record<string, string>,
): { trozos: Trozo[]; puestas: string[]; rotas: string[] } {
  const trozos: Trozo[] = [];
  const puestas = new Set<string>();
  const rotas = new Set<string>();

  let desde = 0;
  /// `matchAll` y no `replace`: hace falta saber DÓNDE está
  /// cada hueco para partir el texto, no solo cambiarlo.
  for (const m of texto.matchAll(HUECO)) {
    const i = m.index ?? 0;
    if (i > desde) trozos.push({ t: texto.slice(desde, i), clase: "texto" });

    const clave = m[1];
    const valor = ejemplos[clave];
    if (valor === undefined) {
      rotas.add(clave);
      trozos.push({ t: m[0], clase: "roto" });
    } else {
      puestas.add(clave);
      trozos.push({ t: valor, clase: "hueco" });
    }
    desde = i + m[0].length;
  }
  if (desde < texto.length) {
    trozos.push({ t: texto.slice(desde), clase: "texto" });
  }

  return { trozos, puestas: [...puestas], rotas: [...rotas] };
}

/** Lo mismo, cuando solo hace falta el texto. */
export function textoResuelto(
  texto: string,
  ejemplos: Record<string, string>,
): string {
  return resolver(texto, ejemplos)
    .trozos.map((t) => t.t)
    .join("");
}

/** El catálogo, como diccionario de ejemplos. */
export function ejemplosDe(variables: VariableCorreo[]): Record<string, string> {
  return Object.fromEntries(variables.map((v) => [v.clave, v.ejemplo]));
}

/// Cómo se pinta cada trozo. La variable resuelta va en el
/// color de marca para que se distinga del texto escrito a
/// mano; la que no existe, en rojo y con la raya ondulada del
/// corrector, que es como todo el mundo ya sabe leer «esto
/// está mal escrito».
const CLASE_TROZO: Record<Trozo["clase"], string> = {
  texto: "",
  hueco: "font-semibold text-marca",
  roto: "font-semibold text-error decoration-wavy underline underline-offset-2",
};

function Trozos({ trozos }: { trozos: Trozo[] }) {
  return (
    <>
      {trozos.map((t, i) => (
        <span key={i} className={CLASE_TROZO[t.clase]}>
          {t.t}
        </span>
      ))}
    </>
  );
}

export function VistaPreviaCorreo({
  asunto,
  cuerpo,
  variables,
  banner,
  bannerUrl,
  remitente,
  paraEjemplo,
  variante = "banda",
}: {
  asunto: string;
  cuerpo: string;
  variables: VariableCorreo[];
  /// El banner elegido, antes de subirlo.
  banner?: File | null;
  /// El que ya está guardado en el servidor.
  bannerUrl?: string | null;
  remitente?: string;
  /// A quién se le enseña como destinatario de ejemplo. Sin
  /// esto la cabecera queda coja y no se parece a un correo.
  paraEjemplo?: string;
  /// `banda`: la de siempre —cabecera propia, avisos y
  /// contador dentro—, que es la que usan las campañas.
  ///
  /// `carta`: solo el correo, centrado sobre fondo gris como
  /// en un cliente de verdad. Los avisos y el contador los
  /// pinta la pantalla, que es donde caen al lado del botón
  /// de guardar. Se abre y se cierra desde fuera.
  variante?: "banda" | "carta";
}) {
  /// El archivo se vuelve una URL temporal del navegador. Se
  /// suelta cuando cambia, o el navegador se queda con la
  /// imagen vieja en memoria.
  const urlBanner = useMemo(() => {
    if (!banner) return null;
    return URL.createObjectURL(banner);
  }, [banner]);

  const [dispositivo, setDispositivo] = useState<Dispositivo>("pc");
  const ancho = ANCHOS.find((a) => a.clave === dispositivo) ?? ANCHOS[0];

  const ejemplos = useMemo(() => ejemplosDe(variables), [variables]);

  const asuntoR = resolver(asunto || "(sin asunto)", ejemplos);
  const cuerpoR = resolver(cuerpo, ejemplos);

  const asuntoLleno = asuntoR.trozos.map((t) => t.t).join("");
  const cuerpoVacio = cuerpoR.trozos.map((t) => t.t).join("").trim() === "";

  const rotas = [...new Set([...asuntoR.rotas, ...cuerpoR.rotas])];
  const puestas = [...new Set([...asuntoR.puestas, ...cuerpoR.puestas])];

  const carta = variante === "carta";
  const imagen = urlBanner ?? bannerUrl ?? null;

  /* Una ventana de correo, no un recuadro de texto: es lo
     que deja ver si el cabezote queda bien y si el asunto se
     corta.

     Con la cabecera completa —de quién, para quién, el
     asunto— porque es lo primero que ve el destinatario y es
     donde se decide si lo abre. Un asunto que se corta a los
     50 caracteres en el celular hay que verlo AQUÍ. */
  const ventana = (
    <div
      /// El ancho va en estilo y no en clase porque lo elige
      /// quien mira: son tres medidas concretas, no un juego
      /// de puntos de corte.
      style={carta ? { width: "100%", maxWidth: ancho.px } : undefined}
      className={`overflow-hidden rounded-xl border bg-superficie ${
        carta ? "mx-auto border-campo-borde" : "border-borde"
      }`}
    >
      <div
        className={`space-y-1 border-b border-borde bg-superficie-alterna ${
          carta ? "px-[18px] py-3.5" : "px-4 py-3"
        }`}
      >
        <div className="flex items-baseline gap-2 text-xs text-texto-suave">
          <span className="w-12 shrink-0">De</span>
          <span className="truncate text-texto">{remitente ?? "Convoca CRM"}</span>
        </div>
        <div className="flex items-baseline gap-2 text-xs text-texto-suave">
          <span className="w-12 shrink-0">Para</span>
          <span className="truncate">{paraEjemplo ?? "camila.gomez@ejemplo.com"}</span>
        </div>
        <div className="flex items-baseline gap-2 pt-1">
          <span className="w-12 shrink-0 text-xs text-texto-suave">Asunto</span>
          <p className="min-w-0 font-medium break-words">
            {carta ? <Trozos trozos={asuntoR.trozos} /> : asuntoLleno}
          </p>
        </div>
        {/* Lo que se ve en la lista del celular antes de
            abrirlo. Si el asunto pasa de ahí, se corta. */}
        {!carta && asuntoLleno.length > 50 && (
          <p className="pt-1 pl-14 text-[11px] text-aviso">
            En el celular se corta cerca del carácter 50. Este tiene{" "}
            {asuntoLleno.length}.
          </p>
        )}
      </div>

      <div className={carta ? "" : "max-h-[32rem] overflow-y-auto"}>
        {imagen && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagen} alt="Cabezote del correo" className="block w-full" />
        )}
        {/* El cuerpo guarda un alto mínimo aunque esté vacío:
            sin él la ventana se encoge a dos renglones y dentro
            de un recuadro ancho no se lee como un correo, se lee
            como una tarjeta apretada. */}
        <div
          className={
            carta ? "min-h-[220px] px-[18px] py-5" : "px-5 py-4"
          }
        >
          {cuerpoVacio ? (
            <p className="text-sm text-texto-suave italic">
              Escriba el mensaje y aquí se va viendo.
            </p>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {carta ? <Trozos trozos={cuerpoR.trozos} /> : cuerpoR.trozos.map((t) => t.t).join("")}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  /// El correo, centrado sobre el gris. Es lo que hace que se
  /// lea como un correo y no como otro bloque del panel: un
  /// mensaje no ocupa mil píxeles de ancho en ninguna bandeja.
  if (carta) {
    return (
      <div className="rounded-xl border border-borde bg-superficie-alterna px-6 pt-4 pb-6">
        {/* El conmutador va DENTRO del gris y encima del
            correo, alineado con él: es el marco de la pantalla
            en la que se está mirando, no un ajuste del panel. */}
        <div
          className="mx-auto mb-3.5 flex flex-wrap items-center gap-2.5"
          /// El ancho MÁS ANCHO de los tres y no el elegido: si
          /// la barra se encogiera con el correo, al pasar a
          /// celular los tres botones se irían a dos renglones y
          /// el conmutador saltaría de sitio justo al usarlo.
          style={{ maxWidth: ANCHOS[0].px }}
        >
          <span className="text-[11px] font-semibold tracking-[0.05em] uppercase text-texto-suave opacity-80">
            Así se ve en
          </span>
          <div className="flex gap-0.5 rounded-sm border border-borde bg-superficie p-[3px]">
            {ANCHOS.map((a) => (
              <button
                key={a.clave}
                type="button"
                onClick={() => setDispositivo(a.clave)}
                className={`rounded-xs px-2.5 py-1 text-[11.5px] font-semibold transition ${
                  a.clave === dispositivo
                    ? "bg-superficie-alterna text-titulo"
                    : "text-texto-suave hover:text-texto"
                }`}
              >
                {a.texto}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[11px] text-texto-suave tabular-nums">
            {ancho.px} px de ancho
          </span>
        </div>

        {ventana}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Así va a salir</p>
        <span className="rounded-full bg-superficie-alterna px-2.5 py-1 text-xs text-texto-suave">
          Con datos de ejemplo
        </span>
      </div>

      {ventana}

      {rotas.length > 0 && (
        <p className="rounded-lg border border-error/30 bg-error-suave p-3 text-xs text-error">
          <strong>Estas variables no existen:</strong>{" "}
          {rotas.map((f) => `{{${f}}}`).join(", ")}. Van a salir tal cual en el
          correo, así que no se puede guardar así.
        </p>
      )}

      {/* Lo que aquí sale lleno puede llegar vacío a alguien:
          el ejemplo tiene todos los datos y un lead real no
          siempre. Decirlo evita la sorpresa de que la campaña
          omita a media lista. */}
      {puestas.length > 0 && (
        <p className="text-xs text-texto-suave">
          Usa {puestas.length} {puestas.length === 1 ? "variable" : "variables"}.
          A quien le falte alguna de esas en su lead, no se le manda: sale en la
          lista de omitidos con el motivo.
        </p>
      )}
    </div>
  );
}
