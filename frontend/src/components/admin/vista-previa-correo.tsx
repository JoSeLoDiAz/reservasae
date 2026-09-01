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

import { useMemo } from "react";

import type { VariableCorreo } from "@/lib/plantillas-correo-api";

const HUECO = /\{\{\s*([a-zA-ZÀ-ÿ0-9_]+)\s*\}\}/g;

export function VistaPreviaCorreo({
  asunto,
  cuerpo,
  variables,
  banner,
  remitente,
  paraEjemplo,
}: {
  asunto: string;
  cuerpo: string;
  variables: VariableCorreo[];
  /// El banner elegido, antes de subirlo.
  banner?: File | null;
  remitente?: string;
  /// A quién se le enseña como destinatario de ejemplo. Sin
  /// esto la cabecera queda coja y no se parece a un correo.
  paraEjemplo?: string;
}) {
  /// El archivo se vuelve una URL temporal del navegador. Se
  /// suelta cuando cambia, o el navegador se queda con la
  /// imagen vieja en memoria.
  const urlBanner = useMemo(() => {
    if (!banner) return null;
    return URL.createObjectURL(banner);
  }, [banner]);

  const ejemplos = useMemo(
    () => Object.fromEntries(variables.map((v) => [v.clave, v.ejemplo])),
    [variables],
  );

  const puestos = new Set<string>();
  const faltantes = new Set<string>();

  const llenar = (t: string) =>
    t.replace(HUECO, (entero, clave: string) => {
      const v = ejemplos[clave];
      if (v === undefined) {
        faltantes.add(clave);
        return entero;
      }
      puestos.add(clave);
      return v;
    });

  const asuntoLleno = llenar(asunto || "(sin asunto)");
  const cuerpoLleno = llenar(cuerpo);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Así va a salir</p>
        <span className="rounded-full bg-superficie-alterna px-2.5 py-1 text-xs text-texto-suave">
          Con datos de ejemplo
        </span>
      </div>

      {/* Una ventana de correo, no un recuadro de texto: es lo
          que deja ver si el banner queda bien y si el asunto
          se corta.

          Con la cabecera completa —de quién, para quién, el
          asunto— porque es lo primero que ve el destinatario y
          es donde se decide si lo abre. Un asunto que se corta
          a los 50 caracteres en el celular hay que verlo
          AQUÍ. */}
      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        <div className="space-y-1 border-b border-borde bg-superficie-alterna px-4 py-3">
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
            <p className="min-w-0 font-medium break-words">{asuntoLleno}</p>
          </div>
          {/* Lo que se ve en la lista del celular antes de
              abrirlo. Si el asunto pasa de ahí, se corta. */}
          {asuntoLleno.length > 50 && (
            <p className="pt-1 pl-14 text-[11px] text-aviso">
              En el celular se corta cerca del carácter 50. Este tiene{" "}
              {asuntoLleno.length}.
            </p>
          )}
        </div>

        <div className="max-h-[32rem] overflow-y-auto">
          {urlBanner && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urlBanner}
              alt="Banner del correo"
              className="block w-full"
            />
          )}
          <div className="px-5 py-4">
            {cuerpoLleno.trim() === "" ? (
              <p className="text-sm text-texto-suave italic">
                Escriba el mensaje y aquí se va viendo.
              </p>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {cuerpoLleno}
              </p>
            )}
          </div>
        </div>
      </div>

      {faltantes.size > 0 && (
        <p className="rounded-lg border border-error/30 bg-error-suave p-3 text-xs text-error">
          <strong>Estas variables no existen:</strong>{" "}
          {[...faltantes].map((f) => `{{${f}}}`).join(", ")}. Van a salir tal
          cual en el correo, así que no se puede guardar así.
        </p>
      )}

      {/* Lo que aquí sale lleno puede llegar vacío a alguien:
          el ejemplo tiene todos los datos y un lead real no
          siempre. Decirlo evita la sorpresa de que la campaña
          omita a media lista. */}
      {puestos.size > 0 && (
        <p className="text-xs text-texto-suave">
          Usa {puestos.size} {puestos.size === 1 ? "variable" : "variables"}. A
          quien le falte alguna de esas en su lead, no se le manda: sale en la
          lista de omitidos con el motivo.
        </p>
      )}
    </div>
  );
}
