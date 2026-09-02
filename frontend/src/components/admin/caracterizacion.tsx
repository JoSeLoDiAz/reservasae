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
 * eso «Ninguna» se puede elegir, pero nunca se marca sola.
 *
 * Las opciones van EN GRUPOS. El SEP entrega sus 54 valores en
 * una lista plana —es un catálogo de cargue, no una pantalla—, y
 * así puestos encontrar «DISCAPACIDAD AUDITIVA» es leerse las
 * 54. Los grupos los decide el backend para que esta pantalla y
 * el formulario de completar ficha enseñen lo mismo.
 */

import { useMemo, useState } from "react";

import { Boton } from "./marco-admin";
import { Tarjeta } from "./marco-admin";

export type ValorCaracterizacion = { id: number; etiqueta: string };
export type GrupoCaracterizacion = {
  clave: string;
  etiqueta: string;
  ids: readonly number[];
};

export function Caracterizacion({
  catalogo,
  grupos,
  ninguna,
  elegidas,
  rechazada,
  preguntadaEn,
  tieneAutorizacion,
  puedeEscribir,
  alGuardar,
}: {
  catalogo: ValorCaracterizacion[];
  /// En qué grupo va cada una. Lo manda el backend.
  grupos: GrupoCaracterizacion[];
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

  /// Todos cerrados al entrar, y con razón: son datos sensibles.
  /// Abiertos de golpe, cualquiera que pase por detrás de la
  /// pantalla ve de un vistazo si a esta persona le aplica
  /// «víctima del conflicto armado». Se abre lo que se necesita.
  const [abiertos, setAbiertos] = useState<string[]>([]);

  const porId = useMemo(() => new Map(catalogo.map((c) => [c.id, c])), [catalogo]);

  /**
   * Los grupos con sus opciones, ya filtradas por la búsqueda.
   *
   * Se cierra con un repaso al catálogo entero: lo que el backend
   * no haya agrupado —un valor nuevo del CSV del SEP que nadie
   * clasificó— cae en el último grupo en vez de desaparecer. Una
   * opción que no se puede marcar es una persona que se queda sin
   * caracterizar, con ella delante diciendo que le aplica.
   */
  const bloques = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    const casa = (c: ValorCaracterizacion) => !q || c.etiqueta.toLowerCase().includes(q);

    const colocados = new Set<number>([ninguna]);
    const salida = grupos.map((g) => {
      const suyas: ValorCaracterizacion[] = [];
      for (const id of g.ids) {
        const c = porId.get(id);
        if (!c) continue;
        colocados.add(id);
        suyas.push(c);
      }
      return { ...g, todas: suyas, opciones: suyas.filter(casa) };
    });

    const huerfanas = catalogo.filter((c) => !colocados.has(c.id));
    if (huerfanas.length > 0 && salida.length > 0) {
      const ultimo = salida[salida.length - 1];
      ultimo.todas = [...ultimo.todas, ...huerfanas];
      ultimo.opciones = [...ultimo.opciones, ...huerfanas.filter(casa)];
    }
    return salida;
  }, [grupos, catalogo, porId, buscar, ninguna]);

  const laNinguna = porId.get(ninguna);
  const buscando = buscar.trim().length > 0;
  const encontradas = bloques.reduce((t, b) => t + b.opciones.length, 0);

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

  function alternarGrupo(clave: string) {
    setAbiertos((a) => (a.includes(clave) ? a.filter((x) => x !== clave) : [...a, clave]));
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

  const bloqueado = !puedeEscribir || !tieneAutorizacion;

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
            {marcadas.length} {marcadas.length === 1 ? "marcada" : "marcadas"}.
          </span>
        ) : preguntadaEn ? (
          <span className="text-texto-suave">Se le preguntó y no marcó ninguna.</span>
        ) : (
          <span className="text-aviso">Todavía no se le ha preguntado.</span>
        )}
      </p>

      {!tieneAutorizacion && (
        /* Se dice ANTES, no al fallar. El servidor lo rechaza
           igual, pero descubrirlo después de marcar cinco cosas
           es hacerle perder el trabajo a quien lo llenó. */
        <p className="mb-3 rounded-lg border border-aviso/30 bg-aviso-suave p-3 text-sm text-aviso">
          Esta persona no tiene autorización de datos vigente. Regístrela más arriba
          antes de marcar nada: sin ella no se puede guardar.
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
          {/* «Ninguna» FUERA de los grupos y arriba.

              No es una población, es la respuesta «no pertenezco
              a ninguna». Escondida entre las otras cincuenta y
              tres había que buscarla, y es la más frecuente. */}
          {laNinguna && (
            <label
              className={`mb-2 flex items-start gap-2 rounded-lg border border-borde bg-superficie-alterna px-3 py-2 text-sm ${
                bloqueado ? "opacity-60" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={marcadas.includes(ninguna)}
                onChange={() => alternar(ninguna)}
                disabled={bloqueado}
                className="mt-0.5"
              />
              <span>
                No pertenece a ninguna
                <span className="block text-xs text-texto-suave">
                  Solo si ella lo dijo. Dejarlo en blanco no es lo mismo.
                </span>
              </span>
            </label>
          )}

          <input
            className="mb-2 w-full rounded-lg border border-borde bg-campo px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-campo-foco"
            placeholder="Buscar en las 54…"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />

          {buscando && encontradas === 0 ? (
            <p className="rounded-lg border border-borde px-3 py-4 text-sm text-texto-suave">
              Nada coincide con «{buscar}».
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-borde">
              {bloques.map((g, i) => {
                const marcadasAqui = g.todas.filter((c) => marcadas.includes(c.id)).length;
                /// Buscando se abren solos los que tienen algo:
                /// obligar a desplegar seis grupos para ver si el
                /// término está dentro no es buscar.
                const abierto = buscando ? g.opciones.length > 0 : abiertos.includes(g.clave);
                if (buscando && g.opciones.length === 0) return null;
                return (
                  <div key={g.clave} className={i > 0 ? "border-t border-borde" : ""}>
                    <button
                      type="button"
                      onClick={() => alternarGrupo(g.clave)}
                      aria-expanded={abierto}
                      className="sin-aro flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-superficie-alterna"
                    >
                      <span
                        className="text-texto-suave transition-transform"
                        style={{ transform: abierto ? "rotate(90deg)" : "none" }}
                        aria-hidden
                      >
                        ›
                      </span>
                      <span className="min-w-0 flex-1">{g.etiqueta}</span>
                      {/* Cuántas hay marcadas DENTRO, para no
                          tener que abrir los seis a ver dónde
                          quedó lo que ya estaba puesto. */}
                      {marcadasAqui > 0 && (
                        <span className="rounded-full bg-marca-suave px-2 py-0.5 text-xs font-semibold text-marca">
                          {marcadasAqui}
                        </span>
                      )}
                      <span className="text-xs font-normal tabular-nums text-texto-suave">
                        {buscando ? `${g.opciones.length} de ${g.todas.length}` : g.todas.length}
                      </span>
                    </button>

                    {abierto && (
                      <div className="caja-scroll max-h-64 overflow-y-auto border-t border-hairline">
                        {g.opciones.map((c) => (
                          <label
                            key={c.id}
                            className={`flex items-start gap-2 border-b border-hairline px-3 py-2 pl-8 text-sm last:border-b-0 ${
                              bloqueado ? "opacity-60" : "hover:bg-superficie-alterna"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={marcadas.includes(c.id)}
                              onChange={() => alternar(c.id)}
                              disabled={bloqueado}
                              className="mt-0.5"
                            />
                            <span>{c.etiqueta}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
