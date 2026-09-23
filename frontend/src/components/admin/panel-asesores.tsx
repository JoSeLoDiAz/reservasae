"use client";

/** Seguimiento de asesores: dos subvistas, inscripciones y académicos. */

/**
 * «SEGUIMIENTO DE ASESORES, DOS SUBVISTAS: ASESORES INSCRIPCIONES Y
 * ASESORES ACADÉMICOS» (cliente, 23 sep 2026).
 *
 * Las dos contestan la misma pregunta con datos distintos: ¿va a llegar
 * esta persona a su fecha, o hay que reforzarla? Por eso comparten el
 * mismo dibujo --una fila por asesor, con su carga, su ritmo y su
 * color-- y solo cambian las columnas de en medio.
 *
 * LA CIFRA QUE MANDA ES «CUÁNTOS POR DÍA». Un porcentaje de avance no
 * dice si se llega; «te faltan 40 en 4 días hábiles, o sea 10 diarios,
 * y vienes haciendo 3» sí, y además dice cuánto refuerzo hace falta. Es
 * lo que el cliente llamó «cálculo de seguimiento incremental».
 *
 * EL COLOR NO ES DECORACIÓN: es la alerta predictiva que pidió. Sale de
 * comparar lo exigido con lo que el asesor viene haciendo de verdad, y
 * se calcula en el servidor (`seguimiento-de-asesores.ts`) para que la
 * pantalla y cualquier aviso futuro no puedan discrepar.
 */

import { useCallback, useState } from "react";

import {
  crmApi,
  type FilaDeAsesor,
  type FilaDeAsesorAcademico,
  type RitmoDeAsesor,
} from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

import { n } from "./graficos";
import { Aviso } from "./marco-admin";
import { Bloque, Encabezado, Esqueleto, Vacio } from "./piezas";

type Subvista = "inscripciones" | "academicos";

const SUBVISTAS: Array<{ clave: Subvista; etiqueta: string; pie: string }> = [
  {
    clave: "inscripciones",
    etiqueta: "Asesores de inscripciones",
    pie: "Corren hacia el cierre de inscripciones de sus acciones.",
  },
  {
    clave: "academicos",
    etiqueta: "Asesores académicos",
    pie: "Corren hacia la fecha de fin de sus grupos.",
  },
];

/// Cómo se lee cada estado y de qué color va. `SIN_PLAZO` va en gris y
/// NO en verde: no se sabe si va bien, y un verde ahí es una mentira
/// tranquilizadora.
const SEMAFORO: Record<RitmoDeAsesor["estado"], { texto: string; clase: string }> = {
  TERMINADO: { texto: "Terminado", clase: "text-exito" },
  AL_DIA: { texto: "Al día", clase: "text-exito" },
  AJUSTADO: { texto: "Ajustado", clase: "text-aviso" },
  EN_RIESGO: { texto: "Necesita refuerzo", clase: "text-error" },
  VENCIDO: { texto: "Vencido", clase: "text-error" },
  SIN_PLAZO: { texto: "Sin fecha", clase: "text-texto-suave" },
};

const dec = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("es-CO", { maximumFractionDigits: 1 });

const dia = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("es-CO", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : "—";

export function PanelAsesores() {
  const [subvista, setSubvista] = useState<Subvista>("inscripciones");

  return (
    <div className="space-y-4">
      <Encabezado
        compacto
        titulo="Seguimiento de asesores"
        descripcion="Cuánto lleva cada uno, cuánto le falta y si llega a su fecha."
      />

      {/* LAS DOS SUBVISTAS, como pestañas y no como desplegable: son
          dos y se alterna entre ellas todo el tiempo. */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-borde bg-superficie p-1">
        {SUBVISTAS.map((s) => (
          <button
            key={s.clave}
            type="button"
            onClick={() => setSubvista(s.clave)}
            className={
              "rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition " +
              (subvista === s.clave
                ? "bg-marca text-marca-texto"
                : "text-texto-suave hover:bg-superficie-alterna hover:text-texto")
            }
          >
            {s.etiqueta}
          </button>
        ))}
        <p className="w-full px-2 pt-1.5 text-[0.6875rem] text-texto-suave">
          {SUBVISTAS.find((s) => s.clave === subvista)?.pie}
        </p>
      </div>

      {subvista === "inscripciones" ? <DeInscripciones /> : <Academicos />}
    </div>
  );
}

function DeInscripciones() {
  const cargar = useCallback(() => crmApi.asesoresDeInscripciones(), []);
  const vivos = useDatosVivos<FilaDeAsesor[]>(cargar, { clave: "asesores-inscripciones" });

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto />;
  if (vivos.datos.length === 0) {
    return (
      <Vacio titulo="Todavía no hay leads repartidos">
        Aquí aparece cada asesor en cuanto tenga personas asignadas.
      </Vacio>
    );
  }

  return (
    <Bloque
      sinRelleno
      titulo="Carga y ritmo de cada asesor"
      descripcion="Los que más pendientes tienen, arriba: la pantalla es para decidir a quién reforzar."
    >
      <div className="caja-scroll overflow-x-auto">
        <table className="tabla-datos w-full">
          <thead>
            <tr>
              <th>Asesor</th>
              <th className="text-right">Leads asignados</th>
              <th className="text-right">Gestionados</th>
              <th className="text-right">Inscritos o descartados</th>
              <th className="text-right">Pendientes</th>
              <th className="text-right">Antigüedad media</th>
              <th className="text-right">Cierre</th>
              <th className="text-right">Debe hacer al día</th>
              <th className="text-right">Viene haciendo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {vivos.datos.map((f) => (
              <tr key={f.asesorId ?? "sin"}>
                <td className={f.asesorId ? "font-medium" : "font-medium text-texto-suave"}>
                  {f.nombre}
                </td>
                <td className="text-right tabular-nums">{n(f.carga.total)}</td>
                <td className="text-right tabular-nums">{n(f.carga.gestionados)}</td>
                <td className="text-right font-medium text-exito tabular-nums">
                  {n(f.carga.resueltos)}
                </td>
                <td
                  className={
                    "text-right font-semibold tabular-nums " +
                    (f.ritmo.pendientes > 0 ? "text-error" : "")
                  }
                >
                  {n(f.ritmo.pendientes)}
                </td>
                <td className="text-right tabular-nums">
                  {f.antiguedadMedia === null ? "—" : `${dec(f.antiguedadMedia)} d`}
                </td>
                <Plazo fila={f} />
                <td className="text-right font-semibold tabular-nums">
                  {dec(f.ritmo.exigidoPorDia)}
                </td>
                <td className="text-right tabular-nums">{dec(f.ritmo.realPorDia)}</td>
                <td>
                  <span
                    className={`text-[0.75rem] font-semibold ${SEMAFORO[f.ritmo.estado].clase}`}
                  >
                    {SEMAFORO[f.ritmo.estado].texto}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PieDeTabla>
        «Gestionado» es que alguien del equipo ya lo tocó: le dejó una nota, le llenó datos o lo
        movió de etapa a mano. «Debe hacer al día» reparte los pendientes entre los días{" "}
        <strong className="font-semibold">hábiles</strong> que quedan hasta el cierre: nadie llama
        a un colegio el domingo. El cierre de cada acción es el de su grupo más próximo — dos
        semanas antes en los virtuales, cinco días hábiles en los presenciales.
      </PieDeTabla>
    </Bloque>
  );
}

function Academicos() {
  const cargar = useCallback(() => crmApi.asesoresAcademicos(), []);
  const vivos = useDatosVivos<FilaDeAsesorAcademico[]>(cargar, { clave: "asesores-academicos" });

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto />;
  if (vivos.datos.length === 0) {
    return (
      <Vacio titulo="Todavía no hay grupos con gente dentro">
        Aquí aparece cada asesor en cuanto tenga grupos asignados con participantes.
      </Vacio>
    );
  }

  return (
    <Bloque
      sinRelleno
      titulo="Carga y cumplimiento de cada asesor académico"
      descripcion="Sus grupos, su gente y cuánto le falta para certificarlos antes de que acabe el curso."
    >
      <div className="caja-scroll overflow-x-auto">
        <table className="tabla-datos w-full">
          <thead>
            <tr>
              <th>Asesor</th>
              <th className="text-right">Grupos</th>
              <th className="text-right">PAX</th>
              <th className="text-right">Con seguimiento</th>
              <th className="text-right">Certificados</th>
              <th className="text-right">Por certificar</th>
              <th className="text-right">Fin del curso</th>
              <th className="text-right">Debe hacer al día</th>
              <th className="text-right">Viene haciendo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {vivos.datos.map((f) => (
              <tr key={f.asesorId ?? "sin"}>
                <td className={f.asesorId ? "font-medium" : "font-medium text-texto-suave"}>
                  {f.nombre}
                </td>
                <td className="text-right tabular-nums">{n(f.grupos)}</td>
                <td className="text-right font-medium tabular-nums">{n(f.carga.total)}</td>
                <td className="text-right tabular-nums">{n(f.conSeguimiento)}</td>
                <td className="text-right font-semibold text-exito tabular-nums">
                  {n(f.certificados)}
                </td>
                <td
                  className={
                    "text-right font-semibold tabular-nums " +
                    (f.ritmo.pendientes > 0 ? "text-error" : "")
                  }
                >
                  {n(f.ritmo.pendientes)}
                </td>
                <Plazo fila={f} />
                <td className="text-right font-semibold tabular-nums">
                  {dec(f.ritmo.exigidoPorDia)}
                </td>
                <td className="text-right tabular-nums">{dec(f.ritmo.realPorDia)}</td>
                <td>
                  <span
                    className={`text-[0.75rem] font-semibold ${SEMAFORO[f.ritmo.estado].clase}`}
                  >
                    {SEMAFORO[f.ritmo.estado].texto}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PieDeTabla>
        El PAX sale de los grupos: un asesor académico lleva grupos enteros, no personas sueltas.
        «Con seguimiento» son los participantes que ya tienen al menos una nota suya. El estado
        del aula lo manda el LMS y el asesor no lo toca: lo suyo es el acompañamiento, y de eso
        queda la traza en las notas.
      </PieDeTabla>
    </Bloque>
  );
}

/**
 * La fecha contra la que corre, con lo que le queda debajo.
 *
 * EN DOS RENGLONES Y NO EN UNO. Iban pegados --«5 de julhace 58 h.»--
 * porque dos cifras seguidas sin separador se leen como una sola, y
 * «h.» no dice si son horas o hábiles. Aquí la fecha manda y los días
 * van debajo en gris, dichos enteros.
 */
function Plazo({ fila }: { fila: FilaDeAsesor }) {
  const dias = fila.ritmo.diasHabiles;
  return (
    <td className="text-right whitespace-nowrap tabular-nums">
      {dia(fila.limite)}
      {dias !== null && (
        <span className="block text-[0.6875rem] text-texto-suave">
          {dias > 0
            ? `quedan ${n(dias)} ${dias === 1 ? "día hábil" : "días hábiles"}`
            : dias === 0
              ? "hoy es el último"
              : `venció hace ${n(-dias)} ${dias === -1 ? "día hábil" : "días hábiles"}`}
        </span>
      )}
    </td>
  );
}

function PieDeTabla({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-t border-borde px-7 py-3 text-[0.6875rem] leading-relaxed text-texto-suave">
      {children}
    </p>
  );
}
