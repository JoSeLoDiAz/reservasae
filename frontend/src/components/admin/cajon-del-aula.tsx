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
 *
 * CON EL `Cajon` DE LA CASA, el mismo que abre un lead en Gestión de
 * leads: «y Abrir es como si se abriera un lead de Gestión de leads»
 * (cliente, 24 sep 2026). Estuvo con un armazón propio --velo, alto y
 * cierre escritos a mano-- que se parecía pero no era: 34 rem contra
 * 42, sin bloquear el desplazamiento de detrás y sin devolver el
 * foco. Se probó también desplegándolo bajo la fila y él lo prefirió
 * lateral, que es además lo que el comentario del `Cajon` ya contaba:
 * con columnas que se quitan y se ponen, un `colSpan` fijo se
 * descuadra solo.
 */

import { useCallback, useMemo, useState } from "react";

import { Cajon, Dato } from "@/components/admin/cajon";
import { colorEtapa } from "@/components/admin/etapa";
import { Aviso, CLASE_CONTROL } from "@/components/admin/marco-admin";
import { Esqueleto } from "@/components/admin/piezas";
import { useDatosVivos } from "@/lib/datos-vivos";
import { fechaDeCalendario } from "@/lib/dia-de-calendario";
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

/// LAS DEL CURSO SE TECLEAN: son un día del calendario y no un
/// instante. Con `new Date()` y la zona de Bogotá, un «2026-09-01» se
/// pinta como 31 de agosto, y el asesor llamaría a alguien diciéndole
/// que su curso empezó un día antes de lo que dice su certificado.
const diaDelCurso = (iso: string | null) =>
  fechaDeCalendario(iso, { day: "numeric", month: "short", year: "numeric" });

/// El último ingreso SÍ es un instante: viene del aula con su hora.
function fecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function cuando(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  /// La `clave` es el id: al abrir otra persona sin cerrar la
  /// anterior, lo que se pinta tiene que cambiar con ella.
  const vivos = useDatosVivos(
    useCallback(() => crmApi.obtener(fila.id), [fila.id]),
    { clave: fila.id },
  );
  const ficha: Ficha | null = vivos.datos;

  const [texto, setTexto] = useState("");
  const [canales, setCanales] = useState<CanalContacto[]>([]);
  const [resultado, setResultado] = useState<ResultadoGestion>("CONTACTO");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <Cajon
      titulo={fila.nombre}
      subtitulo={
        <>
          <span className="font-mono">{fila.documento}</span>
          {fila.accion && ` · ${fila.accion}`}
          {fila.grupo !== null && ` · Grupo ${fila.grupo}`}
        </>
      }
      alCerrar={alCerrar}
    >
      {(error ?? vivos.error) && <Aviso tipo="error">{error ?? vivos.error}</Aviso>}

      {/* ── 1 · LO QUE DICE EL AULA. Se lee, no se toca. ── */}
      <section>
        <h3 className="text-xs font-semibold tracking-[0.08em] text-texto-suave uppercase">
          Lo que dice el aula
        </h3>
        {/* DICE DE DÓNDE SALE, y por qué no hay nada que tocar. Sin
            esta línea, un asesor que ve el estado «Atrasado» y no
            encuentra cómo cambiarlo piensa que la pantalla está rota,
            no que es a propósito. */}
        <p className="mt-1 text-[0.75rem] leading-snug text-texto-suave">
          Viene del LMS y es la fuente de la verdad: aquí no se edita. Si algo no cuadra,
          se corrige en el aula y llega solo.
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Dato
            titulo="Estado"
            valor={
              <span
                style={{ ["--etapa"]: COLOR[fila.estado] } as React.CSSProperties}
                className="pildora-etapa"
                title={AYUDA_ACADEMICA[fila.estado]}
              >
                {ETIQUETA_ACADEMICA[fila.estado]}
              </span>
            }
          />
          <Dato
            titulo="Avance"
            valor={
              <>
                <span className="tabular-nums">
                  {fila.hechas} de {fila.total}
                </span>
                {fila.esperadas !== null && (
                  <span className="ml-2 text-[0.75rem] text-texto-suave tabular-nums">
                    tocaría {fila.esperadas}
                  </span>
                )}
              </>
            }
          />
          <Dato
            titulo="Último ingreso"
            valor={
              <>
                {fila.ultimoAcceso ? fecha(fila.ultimoAcceso) : "nunca ha entrado"}
                {fila.diasSinEntrar !== null && fila.diasSinEntrar >= 14 && (
                  <span className="ml-2 text-[0.75rem] text-error tabular-nums">
                    hace {fila.diasSinEntrar} días
                  </span>
                )}
              </>
            }
          />
          <Dato titulo="Nota final" valor={fila.notaFinal ?? "todavía no tiene"} />
          <Dato
            titulo="Curso"
            valor={
              <>
                {fila.fechaInicio ? diaDelCurso(fila.fechaInicio) : "—"}
                {fila.fechaFin ? ` → ${diaDelCurso(fila.fechaFin)}` : ""}
              </>
            }
          />
          <Dato titulo="Asesor" valor={fila.asesor?.nombre ?? "sin asignar"} />
        </dl>
      </section>

      {/* ── 2 · LO QUE PONE EL ASESOR: su traza. ── */}
      <section className="mt-6 border-t border-borde pt-5">
        <h3 className="text-xs font-semibold tracking-[0.08em] text-texto-suave uppercase">
          Seguimiento del asesor
        </h3>
        <p className="mt-1 text-[0.75rem] leading-snug text-texto-suave">
          Lo que usted hizo con esta persona. Es la misma bitácora del lead, así que aquí
          también salen las conversaciones que entran por Lucid.
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
                      setCanales(puesto ? canales.filter((x) => x !== c) : [...canales, c])
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
          {vivos.cargando ? (
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
    </Cajon>
  );
}
