"use client";

/** Caracterización de población: datos sensibles, con su aviso. */

/**
 * Etnia, discapacidad, condición de víctima, diversidad sexual.
 * Son datos SENSIBLES del art. 5 de la Ley 1581, y la pantalla
 * tiene que decirlo — quien la usa no tiene por qué saber que
 * este bloque no es como los demás.
 *
 * Tres cosas que NO son iguales y que aquí se distinguen:
 *
 *   sin marcar        no se le preguntó
 *   «prefiere no…»    se le preguntó y no quiso responder
 *   «Ninguna»         dijo que no pertenece a ninguna
 *
 * Solo la persona puede pasar de la primera a las otras dos. Por
 * eso «Ninguna» está en la lista y se puede elegir, pero nunca se
 * marca sola.
 */

import { useMemo, useState } from "react";

import { Boton } from "./marco-admin";
import { Tarjeta } from "./marco-admin";

export type ValorCaracterizacion = { id: number; etiqueta: string };

export function Caracterizacion({
  catalogo,
  ninguna,
  elegidas,
  rechazada,
  preguntadaEn,
  tieneAutorizacion,
  puedeEscribir,
  alGuardar,
}: {
  catalogo: ValorCaracterizacion[];
  /// El id de «Ninguna», para poder avisar de lo que significa.
  ninguna: number;
  elegidas: number[];
  rechazada: boolean;
  /// Cuándo se le preguntó. Null: nunca.
  preguntadaEn: string | null;
  /// Sin autorización viva el servidor lo rechaza, así que se
  /// dice ANTES en vez de dejar que lo descubra al guardar.
  tieneAutorizacion: boolean;
  puedeEscribir: boolean;
  alGuardar: (v: {
    caracterizaciones: number[];
    caracterizacionRechazada: boolean;
  }) => Promise<void>;
}) {
  const [marcadas, setMarcadas] = useState<number[]>(elegidas);
  const [noQuiso, setNoQuiso] = useState(rechazada);
  const [buscar, setBuscar] = useState("");
  const [guardando, setGuardando] = useState(false);

  const filtrado = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return catalogo;
    return catalogo.filter((c) => c.etiqueta.toLowerCase().includes(q));
  }, [catalogo, buscar]);

  const cambio =
    noQuiso !== rechazada ||
    marcadas.length !== elegidas.length ||
    marcadas.some((m) => !elegidas.includes(m));

  function alternar(id: number) {
    setNoQuiso(false);
    setMarcadas((antes) =>
      antes.includes(id) ? antes.filter((x) => x !== id) : [...antes, id],
    );
  }

  async function guardar() {
    setGuardando(true);
    try {
      await alGuardar({
        caracterizaciones: noQuiso ? [] : marcadas,
        caracterizacionRechazada: noQuiso,
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Caracterización de población"
      descripcion="Etnia, discapacidad, condición de víctima y diversidad sexual. Son datos sensibles: solo se registran si la persona los dio, y quedan colgados de su autorización."
    >
      {/* El estado actual EN PALABRAS, antes de la lista.

          «Sin marcar» y «prefiere no responder» se ven igual en
          una lista de casillas vacías, y no son lo mismo: uno es
          que no se preguntó y el otro que se preguntó. */}
      <p className="mb-3 text-sm">
        {noQuiso ? (
          <span className="text-texto">
            Prefirió <strong>no responder</strong>.
          </span>
        ) : marcadas.length > 0 ? (
          <span className="text-texto">
            {marcadas.length}{" "}
            {marcadas.length === 1 ? "marcada" : "marcadas"}.
          </span>
        ) : preguntadaEn ? (
          <span className="text-texto-suave">
            Se le preguntó y no marcó ninguna.
          </span>
        ) : (
          <span className="text-aviso">Todavía no se le ha preguntado.</span>
        )}
      </p>

      {!tieneAutorizacion && (
        /* Se dice ANTES, no al fallar. El servidor lo rechaza
           igual, pero descubrirlo después de marcar cinco cosas
           es hacerle perder el trabajo a quien lo llenó. */
        <p className="mb-3 rounded-lg border border-aviso/30 bg-aviso-suave p-3 text-sm text-aviso">
          Esta persona no tiene autorización de datos vigente. Regístrela más
          arriba antes de marcar nada: sin ella no se puede guardar.
        </p>
      )}

      {puedeEscribir && (
        <label className="mb-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={noQuiso}
            onChange={(e) => {
              setNoQuiso(e.target.checked);
              if (e.target.checked) setMarcadas([]);
            }}
            className="mt-0.5"
          />
          <span>
            Prefiere no responder
            <span className="block text-xs text-texto-suave">
              No es lo mismo que dejarlo en blanco: deja constancia de que se le
              preguntó.
            </span>
          </span>
        </label>
      )}

      {!noQuiso && (
        <>
          <input
            className="mb-2 w-full rounded-lg border border-borde bg-campo px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-campo-foco"
            placeholder="Buscar en la lista…"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            disabled={!puedeEscribir}
          />

          <div className="caja-scroll max-h-64 overflow-y-auto rounded-lg border border-borde">
            {filtrado.map((c) => (
              <label
                key={c.id}
                className="flex items-start gap-2 border-b border-borde px-3 py-2 text-sm last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={marcadas.includes(c.id)}
                  onChange={() => alternar(c.id)}
                  disabled={!puedeEscribir || !tieneAutorizacion}
                  className="mt-0.5"
                />
                <span>
                  {c.etiqueta}
                  {/* «Ninguna» se puede elegir, pero se dice qué
                      significa: es una afirmación sobre ella, no
                      la ausencia de respuesta. */}
                  {c.id === ninguna && (
                    <span className="block text-xs text-texto-suave">
                      Solo si ella dijo que no pertenece a ninguna. Dejarlo en
                      blanco no es lo mismo.
                    </span>
                  )}
                </span>
              </label>
            ))}
            {filtrado.length === 0 && (
              <p className="px-3 py-4 text-sm text-texto-suave">
                Nada coincide con «{buscar}».
              </p>
            )}
          </div>
        </>
      )}

      {puedeEscribir && (
        <div className="mt-3 flex items-center gap-3">
          <Boton onClick={guardar} disabled={!cambio || guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </Boton>
          {cambio && (
            <span className="text-xs text-texto-suave">Hay cambios sin guardar.</span>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
