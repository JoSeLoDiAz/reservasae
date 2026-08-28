"use client";

/** Qué se deja y qué se cambia, campo por campo. */

/// Cuando el asesor ya tocó la ficha y después el interesado
/// manda lo suyo, nada se sobrescribe: queda esperando. Esta
/// es la pantalla donde alguien decide.
///
/// Va en una ventana y no en una tarjeta más de la ficha
/// porque es UNA DECISIÓN, y una decisión merece que uno se
/// detenga. En la ficha quedaba entre otras diez tarjetas, con
/// scroll, y se resolvía sin mirar.
///
/// Y va con dos opciones por campo en vez de una casilla. Una
/// casilla dice qué pasa si la marca y se calla lo otro: quien
/// la deja sin marcar no sabe si está dejando el dato viejo o
/// borrándolo. Aquí las dos salidas están escritas.

import { useEffect, useState } from "react";

import type { PropuestaDelInteresado } from "@/lib/crm-api";

import { Boton } from "./marco-admin";

type Decision = "DEJAR" | "CAMBIAR";

export function RevisarPropuesta({
  propuesta,
  alCerrar,
  alResolver,
}: {
  propuesta: PropuestaDelInteresado;
  alCerrar: () => void;
  /// Los campos que se van a cambiar. Vacío = no entra nada.
  alResolver: (campos: string[]) => Promise<void>;
}) {
  /// Por defecto se CAMBIA: el interesado acaba de escribirlo
  /// mirando sus propios papeles, así que lo suyo suele ser lo
  /// bueno. Pero se puede cambiar campo por campo, que es de
  /// lo que se trata.
  const [decisiones, setDecisiones] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(propuesta.campos.map((c) => [c.campo, "CAMBIAR" as Decision])),
  );
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !ocupado) alCerrar();
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [alCerrar, ocupado]);

  const aCambiar = propuesta.campos
    .filter((c) => decisiones[c.campo] === "CAMBIAR")
    .map((c) => c.campo);
  const aDejar = propuesta.campos.length - aCambiar.length;

  function todos(d: Decision) {
    setDecisiones(Object.fromEntries(propuesta.campos.map((c) => [c.campo, d])));
  }

  async function resolver() {
    setOcupado(true);
    try {
      await alResolver(aCambiar);
      alCerrar();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        onClick={() => !ocupado && alCerrar()}
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Qué se deja y qué se cambia"
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-borde bg-superficie shadow-2xl"
      >
        <header className="border-b border-borde p-6">
          <h2 className="text-lg font-semibold">El interesado completó sus datos</h2>
          <p className="mt-1 text-sm text-texto-suave">
            Usted ya había tocado esta ficha, así que nada se sobrescribió. Decida
            campo por campo.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => todos("CAMBIAR")}
              className="text-marca underline"
            >
              Cambiar todos
            </button>
            <button
              type="button"
              onClick={() => todos("DEJAR")}
              className="text-texto-suave underline hover:text-texto"
            >
              Dejar todos como están
            </button>
          </div>
        </header>

        {/* La lista scrollea; la cabecera y los botones se
            quedan. Con veinte campos, un modal que scrollea
            entero esconde el botón de guardar. */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <ul className="space-y-3">
            {propuesta.campos.map((c) => {
              const decision = decisiones[c.campo];
              return (
                <li
                  key={c.campo}
                  className="rounded-xl border border-borde p-4"
                >
                  <p className="font-medium">{c.etiqueta}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Opcion
                      elegida={decision === "DEJAR"}
                      alElegir={() =>
                        setDecisiones((d) => ({ ...d, [c.campo]: "DEJAR" }))
                      }
                      rotulo="Dejar lo que hay"
                      valor={c.actual}
                    />
                    <Opcion
                      elegida={decision === "CAMBIAR"}
                      alElegir={() =>
                        setDecisiones((d) => ({ ...d, [c.campo]: "CAMBIAR" }))
                      }
                      rotulo="Poner lo que mandó"
                      valor={c.propuesto}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t border-borde p-6">
          <Boton onClick={() => void resolver()} disabled={ocupado}>
            {ocupado
              ? "Guardando…"
              : aCambiar.length === 0
                ? "No cambiar nada"
                : `Cambiar ${aCambiar.length} ${aCambiar.length === 1 ? "dato" : "datos"}`}
          </Boton>
          {aDejar > 0 && aCambiar.length > 0 && (
            <span className="text-sm text-texto-suave">
              y dejar {aDejar} como {aDejar === 1 ? "está" : "están"}
            </span>
          )}
          <button
            type="button"
            onClick={alCerrar}
            disabled={ocupado}
            className="ml-auto text-sm underline disabled:opacity-50"
          >
            Decidir después
          </button>
        </footer>

        <p className="border-t border-borde px-6 py-3 text-xs text-texto-suave">
          Quede lo que quede, se registra quién lo decidió y qué dejó entrar.
        </p>
      </div>
    </div>
  );
}

/// Las dos salidas se ven igual de importantes: el mismo
/// tamaño, el mismo peso. Si una fuera un botón y la otra
/// letra pequeña, no sería una decisión, sería una sugerencia.
function Opcion({
  elegida,
  alElegir,
  rotulo,
  valor,
}: {
  elegida: boolean;
  alElegir: () => void;
  rotulo: string;
  valor: string | null;
}) {
  return (
    <button
      type="button"
      onClick={alElegir}
      aria-pressed={elegida}
      className={`rounded-xl border p-3 text-left transition ${
        elegida
          ? "border-marca bg-marca-suave"
          : "border-borde hover:bg-superficie-alterna"
      }`}
    >
      <span
        className={`block text-xs uppercase tracking-wide ${
          elegida ? "text-marca" : "text-texto-suave"
        }`}
      >
        {rotulo}
      </span>
      <span className="mt-1 block break-words text-sm">
        {valor ?? <em className="text-texto-suave">vacío</em>}
      </span>
    </button>
  );
}
