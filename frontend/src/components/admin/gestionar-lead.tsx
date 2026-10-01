"use client";

/** Llamar a un lead desde la mesa y registrar cómo salió. */

/**
 * Es la otra mitad de «se reciben todos los leads». Un lead de
 * pauta no trae cédula, así que no puede ser ficha — y hasta ahora
 * tampoco se podía trabajar, porque llamar y dejar nota solo
 * existía sobre la ficha. Quedaba en un callejón sin salida.
 *
 * Aquí el asesor llama, apunta cómo salió, y cuando consigue la
 * cédula por teléfono la escribe en «Arreglar» y convierte. Es
 * literalmente el proceso que pidió el cliente.
 *
 * MISMA FORMA QUE LA FICHA, y no por parecido: es la misma tabla y
 * el mismo DTO del servidor. Si esto pidiera otras cosas serían
 * dos ideas de qué es una gestión.
 *
 * El botón de llamar hace DOS cosas —abre el marcador y deja la
 * nota armada en «Llamada»—, que es lo único que un asesor hace de
 * verdad entre llamada y llamada.
 */

import { useState } from "react";

import { ErrorApi } from "@/lib/api";
import {
  CANALES,
  ETIQUETA_CANAL_CONTACTO,
  type CanalContacto,
} from "@/lib/crm-api";
import { mesaApi, type LeadDeLaMesa } from "@/lib/mesa-api";

import {
  ClasificacionDeLaNota,
  useClasificacionDeNota,
} from "./clasificacion-de-la-nota";

import { Aviso, Boton } from "./marco-admin";

/// ¿Pinto el botón de llamar?
///
/// La regla de qué celular SIRVE vive en `comun/celular.ts` del
/// servidor y ahí se queda. Esta responde otra pregunta y por eso
/// puede ser más laxa: un fijo con indicativo se marca igual
/// aunque no valga para el reporte. Es la misma función que la
/// ficha, con el mismo comentario, a propósito.
function marcable(celular: string | null): boolean {
  return (celular ?? "").replace(/\D/g, "").length >= 7;
}

export function GestionarLead({
  lead,
  alCerrar,
  alGuardado,
}: {
  lead: LeadDeLaMesa;
  alCerrar: () => void;
  alGuardado: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [canales, setCanales] = useState<CanalContacto[]>([]);
  const clasificacion = useClasificacionDeNota();
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const puede = lead.puedoContactar === "SI";
  /// LA CATEGORÍA OCUPA EL SITIO QUE TENÍA «CÓMO SALIÓ».
  ///
  /// Hasta el 30 sep 2026 aquí había `resultado !== null`: no se
  /// podía registrar la gestión sin marcar cómo salió. Esos tres
  /// botones eran la misma pregunta que la clasificación --el cliente
  /// lo señaló-- y se quitaron, pero la exigencia NO se puede perder:
  /// de ella salía el `resultado` de la nota, y de él los informes y
  /// la cuenta de intentos sin respuesta. Así que la hereda la
  /// categoría, que es quien declara el resultado ahora. La
  /// subcategoría sigue siendo opcional.
  ///
  /// `completa` es la MISMA condición que usa la ficha, y vive en
  /// `clasificacion-de-la-nota.tsx` para que no haya dos ideas de
  /// cuándo está lista una nota.
  const listo =
    puede &&
    texto.trim().length > 0 &&
    canales.length > 0 &&
    clasificacion.completa;

  async function guardar() {
    if (!listo) return;
    setGuardando(true);
    try {
      await mesaApi.agregarNota(lead.id, {
        texto: texto.trim(),
        canales,
        /// SIN `resultado`: lo deriva el servidor de la categoría.
        /// Sin la llave cuando no hay nada elegido: el DTO la
        /// declara opcional, y un `null` explícito no es «no vino».
        ...(clasificacion.categoriaId
          ? { categoriaId: clasificacion.categoriaId }
          : {}),
        ...(clasificacion.subcategoriaId
          ? { subcategoriaId: clasificacion.subcategoriaId }
          : {}),
      });
      setError(null);
      alGuardado();
      alCerrar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Cerrar"
        className="flex-1 bg-black/30"
        onClick={alCerrar}
      />

      <aside className="flex w-full max-w-md flex-col overflow-y-auto border-l border-borde bg-superficie shadow-xl">
        <header className="border-b border-borde px-6 py-4">
          <h2 className="font-semibold">Gestionar este lead</h2>
          <p className="mt-0.5 text-sm text-texto-suave">{lead.nombre}</p>
          {lead.gestiones > 0 && (
            /* Cuántas veces se ha intentado. Es el número que dice
               si hay que insistir o cambiar de vía. */
            <p className="mt-2 text-sm text-texto-suave">
              {lead.gestiones} {lead.gestiones === 1 ? "gestión" : "gestiones"}
              {lead.ultimaGestionEn
                ? ` · la última el ${new Date(lead.ultimaGestionEn).toLocaleDateString("es-CO")}`
                : ""}
            </p>
          )}
        </header>

        <div className="space-y-4 px-6 py-5">
          {error && <Aviso tipo="error">{error}</Aviso>}

          {!puede && (
            /* Se dice ANTES y con el motivo, no al fallar. Un botón
               apagado que no explica por qué es un lead que alguien
               va a dar por perdido. */
            <Aviso tipo="error">
              {lead.puedoContactar === "REVOCO"
                ? "Esta persona revocó la autorización de tratamiento de sus datos. No se le puede contactar por esta vía."
                : "Este lead ya se atendió: su gestión sigue en Gestión de leads."}
            </Aviso>
          )}

          {puede && marcable(lead.celular) && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-borde bg-superficie-alterna px-3 py-2">
              <a
                href={`tel:${lead.celular}`}
                onClick={() =>
                  setCanales((antes) =>
                    antes.includes("LLAMADA") ? antes : [...antes, "LLAMADA"],
                  )
                }
                className="rounded-lg border border-marca bg-marca-suave px-3 py-1.5 text-sm font-medium text-marca"
              >
                Llamar al {lead.celular}
              </a>
              <span className="text-xs text-texto-suave">
                Marca y deja la nota lista en «Llamada».
              </span>
            </div>
          )}

          {puede && !lead.documento && (
            /* Lo que hay que conseguir en esta llamada, dicho en la
               propia pantalla donde se llama. */
            <p className="rounded-lg border border-borde bg-superficie-alterna px-3 py-2 text-sm text-texto-suave">
              Este lead no trae documento. Pídaselo en la llamada y escríbalo en
              «Arreglar»: es lo único que falta para poder pasarlo a Gestión de
              leads.
            </p>
          )}

          {/* AQUÍ ESTABAN LOS TRES BOTONES DE «CÓMO SALIÓ», y se
              fueron el 30 sep 2026: eran la misma pregunta que la
              clasificación de más abajo --Contactado, No contactado,
              El dato no sirve, Seguimiento--. «Ese "Cómo salió" es la
              "Clasificación"», dijo el cliente. El `resultado` de la
              nota lo deriva ahora el servidor de la categoría
              elegida. */}

          <div>
            {/* EN PASADO, porque es un REGISTRO y no un envío: estos
                botones no mandan nada, anotan por dónde contactó el
                asesor. «Por dónde» a secas se leía como «por dónde lo
                mando». */}
            <span className="mb-1 block text-sm font-medium">
              ¿Por dónde lo contactó?
            </span>
            <div className="flex flex-wrap gap-2">
              {CANALES.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={!puede}
                  onClick={() =>
                    setCanales((antes) =>
                      antes.includes(c)
                        ? antes.filter((x) => x !== c)
                        : [...antes, c],
                    )
                  }
                  className={`rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 ${
                    canales.includes(c)
                      ? "border-marca bg-marca-suave font-medium text-marca"
                      : "border-campo-borde bg-campo text-texto"
                  }`}
                >
                  {ETIQUETA_CANAL_CONTACTO[c]}
                </button>
              ))}
            </div>
          </div>

          {/* ANTES DE «qué pasó», que es el orden en que se piensa:
              primero se clasifica y al final se escribe. Debajo del
              texto quedaría después de haberlo contado con palabras, y
              entonces nadie lo toca. */}
          <div>
            <span className="mb-1 block text-sm font-medium">
              Clasificación
            </span>
            <ClasificacionDeLaNota estado={clasificacion} />
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Qué pasó</span>
            <textarea
              rows={4}
              maxLength={2000}
              disabled={!puede}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Un renglón basta: qué dijo, qué quedó pendiente."
              className="w-full rounded-lg border border-borde bg-campo px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-campo-foco disabled:opacity-50"
            />
          </label>
        </div>

        <footer className="mt-auto flex items-center gap-3 border-t border-borde px-6 py-4">
          <Boton onClick={guardar} disabled={!listo || guardando}>
            {guardando ? "Guardando…" : "Registrar la gestión"}
          </Boton>
          <button
            className="text-sm font-medium text-texto-suave hover:underline"
            onClick={alCerrar}
          >
            Cancelar
          </button>
        </footer>
      </aside>
    </div>
  );
}
