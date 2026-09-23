"use client";

/** La tabla del comité: una fila por acción de formación. */

/**
 * ES EL EXCEL DEL CLIENTE, DENTRO DEL CRM.
 *
 * Nos pasó su hoja el 23 de septiembre de 2026 --«esto es como la tabla
 * que te compartí; el resumen es lo gráfico, ya el detalle es la
 * tabla»--, con sus mismas columnas y en su mismo orden. Lo que cambia
 * respecto a la hoja es lo que la hoja no podía hacer:
 *
 * - las cifras salen del sistema, no de un copiado semanal;
 * - donde la hoja decía «#REF!» y «#DIV/0!» aquí va una raya, que es lo
 *   que significan: no hay de dónde calcular;
 * - la fila de totales suma lo que se está viendo.
 *
 * De dónde sale cada columna está en `resumen-por-accion.ts`, que es
 * donde viven las cuentas y sus pruebas.
 */

import { useCallback } from "react";

import { crmApi, type FilaDeAccion } from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

import { Aviso } from "./marco-admin";
import { Bloque, Esqueleto, Vacio } from "./piezas";

const n = (v: number) => v.toLocaleString("es-CO");

/// El porcentaje, o una raya: sin leads no hay conversión, y un 0 %
/// diría que nadie convirtió cuando lo cierto es que nadie llegó.
const tasa = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);

export function TablaPorAccion({
  alElegir,
  elegida,
}: {
  /// La pantalla la usa para abrir el detalle por grupos: la fila
  /// entera es el botón.
  alElegir?: (fila: FilaDeAccion) => void;
  elegida?: string | null;
}) {
  const cargar = useCallback(() => crmApi.resumenPorAccion(), []);
  const vivos = useDatosVivos<FilaDeAccion[]>(cargar, { clave: "resumen-por-accion" });

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto />;

  const filas = vivos.datos;
  if (filas.length === 0) {
    return (
      <Vacio titulo="Todavía no hay acciones de formación">
        Se crean en Oferta formativa; aquí aparecen con sus cupos en cuanto tengan grupos.
      </Vacio>
    );
  }

  /// Los totales, sumados de lo que se ve. La conversión del total se
  /// recalcula --no se promedian porcentajes-- porque una acción con
  /// tres leads pesaría igual que una con mil.
  const t = filas.reduce(
    (a, f) => ({
      meta: a.meta + f.meta,
      cuposReservados: a.cuposReservados + f.cuposReservados,
      campanaDigital: a.campanaDigital + f.campanaDigital,
      totalLeads: a.totalLeads + f.totalLeads,
      inscritosReservas: a.inscritosReservas + f.inscritosReservas,
      inscritosCampana: a.inscritosCampana + f.inscritosCampana,
      totalInscritos: a.totalInscritos + f.totalInscritos,
      cuposDisponibles: a.cuposDisponibles + f.cuposDisponibles,
    }),
    {
      meta: 0,
      cuposReservados: 0,
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
      /// NO «Por acción de formación» a secas: así se llama una de las
      /// donas que el cliente mandó quitar, y dos bloques con el mismo
      /// nombre en la misma pantalla es justo lo que hace dudar de cuál
      /// se está mirando.
      titulo="Cupos e inscritos por acción"
      descripcion="Cupos comprometidos, por dónde llegó la gente y cuánto falta para cerrar cada acción."
    >
      <div className="caja-scroll overflow-x-auto">
        <table className="tabla-datos w-full">
          <thead>
            <tr>
              <th>AF</th>
              <th>Nombre</th>
              <th className="text-right">Meta</th>
              <th className="text-right">Cupos reservados</th>
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
              <tr
                key={f.accionFormacionId}
                onClick={alElegir ? () => alElegir(f) : undefined}
                className={
                  (alElegir ? "cursor-pointer hover:bg-superficie-alterna " : "") +
                  (elegida === f.accionFormacionId ? "bg-marca-suave" : "")
                }
              >
                <td className="font-mono text-xs whitespace-nowrap">{f.codigo}</td>
                <td className="min-w-[18rem]">{f.nombre}</td>
                <td className="text-right tabular-nums">{n(f.meta)}</td>
                <td className="text-right tabular-nums">{n(f.cuposReservados)}</td>
                <td className="text-right tabular-nums">{n(f.campanaDigital)}</td>
                <td className="text-right font-medium tabular-nums">{n(f.totalLeads)}</td>
                <td className="text-right tabular-nums">{n(f.inscritosReservas)}</td>
                <td className="text-right tabular-nums">{n(f.inscritosCampana)}</td>
                <td className="text-right font-semibold text-exito tabular-nums">
                  {n(f.totalInscritos)}
                </td>
                <td className="text-right tabular-nums">{tasa(f.conversion)}</td>
                {/* En rojo cuando ya se pasó: es el «−4» de su hoja, y
                    dice que esa acción entregó más cupos de los
                    comprometidos. */}
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
              <td colSpan={2}>Total</td>
              <td className="text-right tabular-nums">{n(t.meta)}</td>
              <td className="text-right tabular-nums">{n(t.cuposReservados)}</td>
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
        La meta son los cupos comprometidos en el cronograma, sumando los grupos de cada
        acción. Los cupos reservados no descuentan disponibles: el cupo se consume cuando la
        persona queda inscrita.
      </p>
    </Bloque>
  );
}
