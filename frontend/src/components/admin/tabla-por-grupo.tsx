"use client";

/** El Bloque 3: la misma tabla, abierta por los grupos de la acción elegida. */

/**
 * «EL MISMO DETALLE PERO POR GRUPOS DE LA AF ELEGIDA» (cliente, 23 sep
 * 2026). Se abre pulsando una fila de «Cupos e inscritos por acción» y
 * se cierra pulsándola otra vez.
 *
 * NACE CERRADA Y SE ABRE DE UNA EN UNA. Siete acciones abiertas a la
 * vez son setenta filas seguidas, que es el chorrero que el cliente ya
 * nos hizo quitar de esta misma pantalla.
 *
 * La columna «Nominados por la empresa» no dice lo mismo que «Cupos
 * reservados» de la tabla de arriba, y por eso se llama distinto: el
 * pie lo explica y `backend/src/crm/resumen-por-grupo.ts` lo razona.
 */

import { useCallback } from "react";

import { crmApi, type FilaDeGrupo } from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

import { Aviso } from "./marco-admin";
import { Bloque, Esqueleto, Vacio } from "./piezas";

const n = (v: number) => v.toLocaleString("es-CO");

const tasa = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);

/// Como se lee, no como está escrita en la base.
const MODALIDAD: Record<string, string> = {
  PRESENCIAL: "Presencial",
  VIRTUAL: "Virtual",
  MIXTA: "Mixta",
};

export function TablaPorGrupo({
  accionFormacionId,
  titulo,
}: {
  accionFormacionId: string;
  /// El código y el nombre de la acción abierta, para que el bloque
  /// diga de cuál son estos grupos sin tener que mirar arriba.
  titulo: string;
}) {
  const cargar = useCallback(
    () => crmApi.resumenPorGrupo(accionFormacionId),
    [accionFormacionId],
  );
  const vivos = useDatosVivos<FilaDeGrupo[]>(cargar, {
    clave: `resumen-por-grupo:${accionFormacionId}`,
  });

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto />;

  const filas = vivos.datos;
  if (filas.length === 0) {
    return (
      <Vacio titulo="Esa acción todavía no tiene grupos">
        Los grupos se crean en Cronograma; aquí aparecen con sus cupos en cuanto existan.
      </Vacio>
    );
  }

  const t = filas.reduce(
    (a, f) => ({
      meta: a.meta + f.meta,
      nominadosPorEmpresa: a.nominadosPorEmpresa + f.nominadosPorEmpresa,
      campanaDigital: a.campanaDigital + f.campanaDigital,
      totalLeads: a.totalLeads + f.totalLeads,
      inscritosReservas: a.inscritosReservas + f.inscritosReservas,
      inscritosCampana: a.inscritosCampana + f.inscritosCampana,
      totalInscritos: a.totalInscritos + f.totalInscritos,
      cuposDisponibles: a.cuposDisponibles + f.cuposDisponibles,
    }),
    {
      meta: 0,
      nominadosPorEmpresa: 0,
      campanaDigital: 0,
      totalLeads: 0,
      inscritosReservas: 0,
      inscritosCampana: 0,
      totalInscritos: 0,
      cuposDisponibles: 0,
    },
  );

  return (
    <Bloque
      sinRelleno
      titulo={`Grupos de ${titulo}`}
      descripcion="Lo mismo de arriba, grupo por grupo: dónde se dicta, cuántos cupos hay y cuánto falta."
    >
      <div className="caja-scroll overflow-x-auto">
        <table className="tabla-datos w-full">
          <thead>
            <tr>
              <th>Grupo</th>
              <th>Departamento</th>
              <th>Sede</th>
              <th>Modalidad</th>
              <th className="text-right">Meta</th>
              <th className="text-right">Nominados por la empresa</th>
              <th className="text-right">Campaña digital</th>
              <th className="text-right">Total leads</th>
              <th className="text-right">Inscritos reservas</th>
              <th className="text-right">Inscritos campaña</th>
              <th className="text-right">Total inscritos</th>
              <th className="text-right">Conversión</th>
              <th className="text-right">Cupos disponibles</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.grupoId}>
                <td className="whitespace-nowrap">Grupo {f.numero}</td>
                {/* Una raya y no una celda en blanco: en blanco no se
                    sabe si es que falta el dato o si es que nadie lo
                    llenó. */}
                <td className="min-w-[10rem]">{f.departamentos || "—"}</td>
                <td className="min-w-[10rem]">{f.sedes || "—"}</td>
                <td className="whitespace-nowrap">{MODALIDAD[f.modalidad] ?? f.modalidad}</td>
                <td className="text-right tabular-nums">{n(f.meta)}</td>
                <td className="text-right tabular-nums">{n(f.nominadosPorEmpresa)}</td>
                <td className="text-right tabular-nums">{n(f.campanaDigital)}</td>
                <td className="text-right font-medium tabular-nums">{n(f.totalLeads)}</td>
                <td className="text-right tabular-nums">{n(f.inscritosReservas)}</td>
                <td className="text-right tabular-nums">{n(f.inscritosCampana)}</td>
                <td className="text-right font-semibold text-exito tabular-nums">
                  {n(f.totalInscritos)}
                </td>
                <td className="text-right tabular-nums">{tasa(f.conversion)}</td>
                <td
                  className={
                    "text-right font-medium tabular-nums " +
                    (f.cuposDisponibles < 0 ? "text-error" : "")
                  }
                >
                  {n(f.cuposDisponibles)}
                </td>
                <td>
                  <span
                    className={
                      "text-[0.75rem] font-semibold " +
                      (f.estado === "CERRADO" ? "text-error" : "text-exito")
                    }
                  >
                    {f.estado === "CERRADO" ? "Cerrado" : "Abierto"}
                  </span>
                </td>
              </tr>
            ))}

            <tr className="border-t-2 border-borde font-semibold">
              <td colSpan={4}>Total</td>
              <td className="text-right tabular-nums">{n(t.meta)}</td>
              <td className="text-right tabular-nums">{n(t.nominadosPorEmpresa)}</td>
              <td className="text-right tabular-nums">{n(t.campanaDigital)}</td>
              <td className="text-right tabular-nums">{n(t.totalLeads)}</td>
              <td className="text-right tabular-nums">{n(t.inscritosReservas)}</td>
              <td className="text-right tabular-nums">{n(t.inscritosCampana)}</td>
              <td className="text-right text-exito tabular-nums">{n(t.totalInscritos)}</td>
              <td className="text-right tabular-nums">
                {tasa(t.totalLeads > 0 ? t.totalInscritos / t.totalLeads : null)}
              </td>
              <td className="text-right tabular-nums">{n(t.cuposDisponibles)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <p className="border-t border-borde px-7 py-3 text-[0.6875rem] leading-relaxed text-texto-suave">
        «Nominados por la empresa» no es lo mismo que «Cupos reservados» de la tabla de
        arriba: una reserva se aparta sobre la acción y la ciudad, no sobre un grupo, así que
        aquí se cuentan las personas que la empresa ya entregó con nombre propio. Por eso los
        grupos pueden sumar menos que su acción mientras queden cupos apartados sin nombre.
      </p>
    </Bloque>
  );
}
