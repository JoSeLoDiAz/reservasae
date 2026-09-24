"use client";

/**
 * EL SEGUIMIENTO DE UNA PERSONA DEL AULA.
 *
 * «Cuando el asesor entre a cada uno de los inscritos debe poder
 * registrar el seguimiento, esto asociado a las notas de cada
 * participante, de manera individual» (cliente, 24 sep 2026).
 *
 * LA REGLA QUE MANDA EN ESTA PANTALLA, y que es la razón de que el
 * panel esté partido en dos mitades con un título cada una:
 *
 *   «Que el estado sea del sistema y no del asesor, que solo quede la
 *   traza de lo realizado por el asesor, ya que la fuente de la
 *   verdad sea lo que se tiene en LMS».
 *
 * Arriba, lo que dice el aula: se LEE y no se toca. No hay ni un
 * control para cambiarlo, y no es un olvido —un desplegable de estado
 * aquí convertiría el tablero en la opinión de quien lo rellenó, que
 * es justo lo que se quiere evitar en un CAU—. Abajo, lo único que
 * pone el asesor: su traza.
 *
 * Las notas son las MISMAS del lead --el mismo `agregarNota`, la
 * misma bitácora-- y no una tabla aparte de «notas académicas». Una
 * persona tiene una sola historia: lo que se le dijo cuando se le
 * estaba inscribiendo y lo que se le dice ahora que va atrasada son
 * el mismo hilo, y partirlo obliga a mirar en dos sitios para saber
 * si alguien ya la llamó. Por ahí entran también las de Lucid.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { fechaDeCalendario } from "@/lib/dia-de-calendario";
import { useDatosVivos } from "@/lib/datos-vivos";

import { colorEtapa } from "@/components/admin/etapa";
import { Aviso, CLASE_CONTROL } from "@/components/admin/marco-admin";
import { Esqueleto } from "@/components/admin/piezas";
import {
  AYUDA_ACADEMICA,
  CANALES,
  crmApi,
  ETIQUETA_ACADEMICA,
  ETIQUETA_CANAL_CONTACTO,
  ETIQUETA_RESULTADO,
  RESULTADOS,
  type CanalContacto,
  type EstadoAcademico,
  type Ficha,
  type FilaAcademica,
  type ResultadoGestion,
} from "@/lib/crm-api";

const COLOR: Record<EstadoAcademico, string> = {
  SIN_INGRESO: colorEtapa("PERDIDO"),
  SIN_EMPEZAR: colorEtapa("CONTACTADO"),
  ATRASADO: colorEtapa("EN_FORMACION"),
  AL_DIA: colorEtapa("CERTIFICADO"),
  COMPLETADO: colorEtapa("INSCRITO"),
  CERTIFICADO: colorEtapa("CERTIFICADO"),
};

function fecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/// LAS DEL CURSO SE TECLEAN: son un día del calendario y no un
/// instante. Con `new Date()` y la zona de Bogotá, un «2026-09-01»
/// se pinta como 31 de agosto, y el asesor llama a alguien diciéndole
/// que su curso empezó un día antes de lo que dice su certificado.
/// La otra pantalla del aula ya lo tenía resuelto así.
const diaDelCurso = (iso: string | null) =>
  fechaDeCalendario(iso, { day: "numeric", month: "short", year: "numeric" });

function cuando(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Un dato del aula: su rótulo y su valor, sin control que lo cambie. */
function Dato({ que, children }: { que: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.6875rem] tracking-[0.06em] text-texto-suave uppercase">{que}</dt>
      <dd className="mt-0.5 text-[0.84375rem] text-texto">{children}</dd>
    </div>
  );
}

export function CajonDelAula({
  fila,
  alCerrar,
}: {
  fila: FilaAcademica;
  alCerrar: () => void;
}) {
  /// CON `useDatosVivos` Y NO CON UN `useEffect` A MANO. Pedir en el
  /// efecto y poner el estado ahí mismo es lo que el linter de React
  /// para en seco --cascada de renders-- y además este hook trae
  /// gratis lo que haría falta escribir dos veces: no pisar una
  /// petición en vuelo, y el refresco.
  ///
  /// La `clave` es el id: al abrir otra persona sin cerrar el cajón,
  /// lo que se pinta tiene que cambiar con ella.
  const vivos = useDatosVivos(
    useCallback(() => crmApi.obtener(fila.id), [fila.id]),
    { clave: fila.id },
  );
  const ficha: Ficha | null = vivos.datos;
  const cargando = vivos.cargando;
  const [error, setError] = useState<string | null>(null);

  const [texto, setTexto] = useState("");
  const [canales, setCanales] = useState<CanalContacto[]>([]);
  const [resultado, setResultado] = useState<ResultadoGestion>("CONTACTO");
  const [guardando, setGuardando] = useState(false);

  /// Escape cierra: el cajón tapa la tabla entera y quien lo abrió
  /// sin querer no tiene por qué buscar la equis.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [alCerrar]);

  const notas = useMemo(() => ficha?.notas ?? [], [ficha]);

  async function guardar() {
    const limpio = texto.trim();
    if (!limpio || guardando) return;
    setGuardando(true);
    try {
      await crmApi.agregarNota(fila.id, limpio, canales, resultado);
      setTexto("");
      setCanales([]);
      setError(null);
      vivos.refrescar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el seguimiento.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* El velo cierra al pulsarlo, como en el cajón de un lead. */}
      <button
        aria-label="Cerrar el seguimiento"
        onClick={alCerrar}
        className="absolute inset-0 bg-[rgba(15,23,42,0.35)]"
      />
      <aside
        role="dialog"
        aria-label={`Seguimiento de ${fila.nombre}`}
        className="relative flex h-full w-full max-w-[34rem] flex-col overflow-y-auto border-l border-borde bg-superficie shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-borde px-5 py-4">
          <div className="min-w-0 grow">
            <h2 className="truncate text-[1rem] font-bold text-titulo">{fila.nombre}</h2>
            <p className="mt-0.5 font-mono text-xs text-texto-suave">{fila.documento}</p>
            <p className="mt-1 text-[0.78125rem] text-texto-suave">
              {fila.accion ?? "Sin acción"}
              {fila.grupo !== null && ` · Grupo ${fila.grupo}`}
            </p>
          </div>
          <button
            onClick={alCerrar}
            className="shrink-0 rounded-lg border border-borde px-2.5 py-1 text-sm text-texto-suave hover:text-texto"
          >
            Cerrar
          </button>
        </header>

        {(error ?? vivos.error) && (
          <div className="px-5 pt-4">
            <Aviso tipo="error">{error ?? vivos.error}</Aviso>
          </div>
        )}

        {/* ── 1 · LO QUE DICE EL AULA. Se lee, no se toca. ── */}
        <section className="border-b border-borde px-5 py-4">
          <h3 className="text-xs font-semibold tracking-[0.08em] text-texto-suave uppercase">
            Lo que dice el aula
          </h3>
          {/* DICE DE DÓNDE SALE, y por qué no hay nada que tocar.
              Sin esta línea, un asesor que ve el estado «Atrasado» y
              no encuentra cómo cambiarlo piensa que la pantalla está
              rota, no que es a propósito. */}
          <p className="mt-1 text-[0.75rem] leading-snug text-texto-suave">
            Viene del LMS y es la fuente de la verdad: aquí no se edita. Si algo no
            cuadra, se corrige en el aula y llega solo.
          </p>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            <Dato que="Estado">
              <span
                style={{ ["--etapa"]: COLOR[fila.estado] } as React.CSSProperties}
                className="pildora-etapa"
                title={AYUDA_ACADEMICA[fila.estado]}
              >
                {ETIQUETA_ACADEMICA[fila.estado]}
              </span>
            </Dato>
            <Dato que="Avance">
              <span className="tabular-nums">
                {fila.hechas} de {fila.total}
              </span>
              {fila.esperadas !== null && (
                <span className="ml-2 text-[0.75rem] text-texto-suave tabular-nums">
                  tocaría {fila.esperadas}
                </span>
              )}
            </Dato>
            <Dato que="Último ingreso">
              {fila.ultimoAcceso ? fecha(fila.ultimoAcceso) : "nunca ha entrado"}
              {fila.diasSinEntrar !== null && fila.diasSinEntrar >= 14 && (
                <span className="ml-2 text-[0.75rem] text-error tabular-nums">
                  hace {fila.diasSinEntrar} días
                </span>
              )}
            </Dato>
            <Dato que="Nota final">{fila.notaFinal ?? "todavía no tiene"}</Dato>
            <Dato que="Curso">
              {fila.fechaInicio ? diaDelCurso(fila.fechaInicio) : "—"}
              {fila.fechaFin ? ` → ${diaDelCurso(fila.fechaFin)}` : ""}
            </Dato>
            <Dato que="Asesor">{fila.asesor?.nombre ?? "sin asignar"}</Dato>
          </dl>
        </section>

        {/* ── 2 · LO QUE PONE EL ASESOR: su traza. ── */}
        <section className="px-5 py-4">
          <h3 className="text-xs font-semibold tracking-[0.08em] text-texto-suave uppercase">
            Seguimiento del asesor
          </h3>
          <p className="mt-1 text-[0.75rem] leading-snug text-texto-suave">
            Lo que usted hizo con esta persona. Es la misma bitácora del lead, así que
            aquí también salen las conversaciones que entran por Lucid.
          </p>

          <div className="mt-3 space-y-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              placeholder="La llamé y dice que se le venció la clave del aula; le reenvié el acceso."
              className={`${CLASE_CONTROL} h-auto w-full resize-y py-2`}
            />
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-1.5">
                {CANALES.map((c) => {
                  const puesto = canales.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        setCanales(
                          puesto ? canales.filter((x) => x !== c) : [...canales, c],
                        )
                      }
                      aria-pressed={puesto}
                      className={`rounded-lg border px-2.5 py-1 text-[0.75rem] transition ${
                        puesto
                          ? "border-marca bg-marca text-marca-texto"
                          : "border-borde text-texto-suave hover:text-texto"
                      }`}
                    >
                      {ETIQUETA_CANAL_CONTACTO[c]}
                    </button>
                  );
                })}
              </div>
              <select
                value={resultado}
                onChange={(e) => setResultado(e.target.value as ResultadoGestion)}
                className="rounded-lg border border-borde bg-superficie px-2.5 py-1 text-[0.75rem]"
              >
                {RESULTADOS.map((r) => (
                  <option key={r} value={r}>
                    {ETIQUETA_RESULTADO[r]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void guardar()}
                disabled={!texto.trim() || guardando}
                className="ml-auto rounded-lg border border-marca bg-marca px-3 py-1.5 text-[0.78125rem] font-semibold text-marca-texto transition hover:bg-marca-fuerte disabled:opacity-50"
              >
                {guardando ? "Guardando…" : "Registrar seguimiento"}
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {cargando ? (
              <Esqueleto />
            ) : notas.length === 0 ? (
              <p className="text-[0.84375rem] text-texto-suave">
                Todavía no hay seguimiento de esta persona.
              </p>
            ) : (
              notas.map((nota) => (
                <article key={nota.id} className="rounded-lg border border-borde px-3 py-2">
                  <p className="text-[0.84375rem] leading-snug text-texto">{nota.texto}</p>
                  <p className="mt-1 text-[0.6875rem] text-texto-suave">
                    {nota.autorNombre} · {cuando(nota.creadoEn)}
                    {nota.resultado && ` · ${ETIQUETA_RESULTADO[nota.resultado]}`}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
