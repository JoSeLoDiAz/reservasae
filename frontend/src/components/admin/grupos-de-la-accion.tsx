"use client";

import type { FilaAcademica } from "@/lib/crm-api";

type Grupo = {
  id: string;
  numero: number;
  accionFormacionId: string | null;
  cupos?: number;
  meta?: number;
};

/**
 * Los grupos de una acción, en tarjetas, sobre la tabla del aula.
 *
 * Lo pidió Josse el 26 sep 2026 mirando el SEP: «yo selecciono una
 * [acción] y me sale el encuadre de los grupos que haya; entonces me
 * llega el total de inscritos y el avance por grupo».
 *
 * RESPONDE «CÓMO VA EL GRUPO», que es la primera pregunta. La tabla
 * responde «quién», y por eso baja detrás de un botón.
 *
 * NO INVENTA NINGUNA CIFRA QUE NO ESTÉ: el numerador sale de las
 * personas que ya viajan --las mismas que pinta la tabla-- y el
 * denominador del servidor. Si el backend no manda el cupo, la
 * tarjeta dice «40» a secas en vez de «40 de 0».
 */
export function GruposDeLaAccion({
  accionFormacionId,
  grupoId,
  acciones,
  grupos,
  personas,
  alElegirGrupo,
  verInscritos,
  alAlternarTabla,
}: {
  accionFormacionId: string;
  grupoId: string;
  acciones: Array<{ id: string; codigo: string; nombre: string }>;
  grupos: Grupo[];
  personas: FilaAcademica[];
  alElegirGrupo: (id: string) => void;
  verInscritos: boolean;
  alAlternarTabla: () => void;
}) {
  /// SIN ACCIÓN ELEGIDA NO HAY TARJETAS, y el hueco lo dice.
  ///
  /// Pintar los grupos de las quince acciones a la vez serían
  /// sesenta y siete tarjetas: la página de cinco mil píxeles que
  /// las pestañas del Resumen vinieron a evitar.
  if (!accionFormacionId) {
    return (
      <div className="rounded-2xl border border-dashed border-borde px-6 py-8 text-center">
        <p className="font-medium">Elija una acción de formación</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-texto-suave">
          {acciones.length > 0
            ? `Arriba, en «Acción de Formación». Hay ${acciones.length} con gente en el aula; todas son virtuales, que son las únicas que el aula sigue.`
            : "Todavía no hay nadie en el aula, así que no hay grupos que mirar."}
        </p>
      </div>
    );
  }

  const suyos = grupos.filter((g) => g.accionFormacionId === accionFormacionId);
  /// Con un grupo puesto, el servidor ya solo manda a SU gente: de
  /// los demás no hay con qué pintar la tarjeta, y una en cero sería
  /// afirmar que ese grupo está vacío. Se enseña el suyo y la puerta
  /// de vuelta.
  const aPintar = grupoId ? suyos.filter((g) => g.id === grupoId) : suyos;

  return (
    <section className="flex flex-col gap-3">
      {grupoId && (
        <button
          type="button"
          onClick={() => alElegirGrupo("")}
          className="self-start text-[0.8125rem] font-medium text-marca underline hover:no-underline"
        >
          ← Ver todos los grupos
        </button>
      )}

      {aPintar.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-borde px-6 py-8 text-center">
          <p className="font-medium">Esta acción no tiene grupos con gente dentro</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-texto-suave">
            Aparecen en cuanto alguien de un grupo entra al aula.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {aPintar.map((g) => (
            <TarjetaDeGrupo
              key={g.id}
              grupo={g}
              suya={personas.filter((p) => p.grupo === g.numero)}
              elegido={g.id === grupoId}
              alPulsar={() => alElegirGrupo(g.id === grupoId ? "" : g.id)}
            />
          ))}
        </div>
      )}

      {/* EL ÚNICO BOTÓN, y abajo. */}
      <button
        type="button"
        onClick={alAlternarTabla}
        aria-expanded={verInscritos}
        className="self-start rounded-lg border border-borde bg-superficie px-3.5 py-2 text-[0.8125rem] font-medium transition hover:border-marca/40"
      >
        {verInscritos ? "Ocultar inscritos" : "Ver inscritos"}
      </button>
    </section>
  );
}

function TarjetaDeGrupo({
  grupo,
  suya,
  elegido,
  alPulsar,
}: {
  grupo: Grupo;
  suya: FilaAcademica[];
  elegido: boolean;
  alPulsar: () => void;
}) {
  const dentro = suya.length;
  const cupos = grupo.cupos ?? 0;

  /**
   * EL AVANCE ES EL PROMEDIO DE LAS PERSONAS, no el de las
   * actividades sumadas.
   *
   * Josse lo pidió así: «el avance general de las unidades temáticas
   * cumplidas, o sea el promedio de todos los participantes de ese
   * grupo». Sumar hechas contra totales daría otra cifra --pesa más
   * quien tiene más actividades-- y las dos son ciertas, así que se
   * calcula la que se pidió y se nombra por lo que es.
   *
   * Solo cuenta a quien TIENE actividades cargadas: con el LMS sin
   * conectar hay gente con `total` en cero, y meterla como un cero
   * hundiría el promedio de un grupo que va bien.
   */
  const conActividades = suya.filter((p) => p.total > 0);
  const avance =
    conActividades.length > 0
      ? Math.round(
          conActividades.reduce((a, p) => a + p.porcentaje, 0) /
            conActividades.length,
        )
      : null;

  return (
    <button
      type="button"
      onClick={alPulsar}
      aria-pressed={elegido}
      className={`rounded-xl border bg-superficie p-3.5 text-left transition hover:border-marca/40 ${
        elegido ? "border-marca" : "border-borde"
      }`}
    >
      <span className="text-[0.625rem] font-semibold tracking-[0.08em] text-texto-suave uppercase">
        Grupo
      </span>
      <span className="mt-0.5 block text-[1.5rem] leading-none font-bold tabular-nums">
        {grupo.numero}
      </span>

      <span className="mt-3 flex items-baseline justify-between gap-2 text-[0.8125rem]">
        <span className="text-texto-suave">Inscritos</span>
        <span className="font-semibold tabular-nums">
          {/* Sin cupo del servidor se dice la cifra sola: «de 0» sería
              falso y «de —» no se lee. */}
          {cupos > 0 ? `${dentro} de ${cupos}` : dentro}
        </span>
      </span>
      {cupos > 0 && (
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-superficie-alterna">
          <span
            className="block h-full rounded-full bg-marca"
            style={{ width: `${Math.min(100, (dentro / cupos) * 100)}%` }}
          />
        </span>
      )}

      <span className="mt-3 flex items-baseline justify-between gap-2 text-[0.8125rem]">
        <span className="text-texto-suave">Avance</span>
        <span className="font-semibold tabular-nums">
          {avance === null ? "—" : `${avance} %`}
        </span>
      </span>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-superficie-alterna">
        <span
          className="block h-full rounded-full bg-exito"
          style={{ width: `${avance ?? 0}%` }}
        />
      </span>
      <span className="mt-1.5 block text-[0.6875rem] text-texto-suave">
        {avance === null
          ? "El aula todavía no manda actividades de este grupo."
          : `Promedio de unidades temáticas de ${conActividades.length} ${
              conActividades.length === 1 ? "persona" : "personas"
            }.`}
      </span>
    </button>
  );
}
