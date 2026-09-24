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

/// Los dos bloques de columnas, cada uno de su color. Van en una
/// constante y no escritos doce veces: el día que cambie el criterio,
/// cambia aquí y en la tabla de grupos, que usa las mismas.
/// LAS DOS MITADES DE LA TABLA, y por que llevan clase propia.
///
/// `grupo-entro` y `grupo-inscribio` no pintan texto: pintan la RAYA
/// que separa cada columna (`globals.css`, la cuadricula). El color
/// del rotulo ya decia de que mitad es cada columna, pero en una fila
/// de doce cifras el rotulo queda arriba del todo y a la altura del
/// dato ya no se sabe: «coloreame las separaciones» (cliente, 24 sep
/// 2026).
const ENTRO = "text-center whitespace-nowrap text-marca grupo-entro";
const INSCRIBIO = "text-center whitespace-nowrap text-exito grupo-inscribio";

/// Las mismas dos mitades, en el cuerpo. La clase va en la celda y no
/// en la fila porque la raya es de la COLUMNA.
const CELDA_ENTRO = "text-center tabular-nums grupo-entro";
const CELDA_ENTRO_TOTAL = "text-center font-medium tabular-nums grupo-entro";
const CELDA_INSCRIBIO = "text-center tabular-nums grupo-inscribio";

/// El porcentaje, o una raya: sin leads no hay conversión, y un 0 %
/// diría que nadie convirtió cuando lo cierto es que nadie llegó.
const tasa = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);

export function TablaPorAccion({
  alElegir,
  elegida,
  recorte,
}: {
  /// Los cinco filtros y la ventana, los mismos de arriba.
  recorte?: Record<string, unknown>;
  /// La pantalla la usa para abrir el detalle por grupos: la fila
  /// entera es el botón.
  alElegir?: (fila: FilaDeAccion) => void;
  elegida?: string | null;
}) {
  const clave = JSON.stringify(recorte ?? {});
  const cargar = useCallback(() => crmApi.resumenPorAccion(recorte ?? {}), [clave]); // eslint-disable-line react-hooks/exhaustive-deps
  const vivos = useDatosVivos<FilaDeAccion[]>(cargar, { clave: `resumen-por-accion:${clave}` });

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
    >
      <div className="caja-scroll overflow-x-auto">
        <table className="tabla-datos tabla-cuadricula w-full">
          <thead>
            {/* LOS RÓTULOS CENTRADOS Y EN DOS COLORES (cliente, 23 sep
                2026): azul el bloque de lo que ENTRÓ --reservados,
                pauta y su total-- y verde el de lo que se INSCRIBIÓ.
                Son las dos mitades de la tabla y así se ven de un
                vistazo sin leer los nombres.

                Y las CIFRAS también van centradas, no a la derecha:
                un rótulo centrado encima de un número pegado al canto
                es la desalineación que el cliente ya señaló una vez. */}
            <tr>
              <th>AF</th>
              <th className="w-full">Nombre</th>
              <th className="text-center whitespace-nowrap">Meta</th>
              <th className={ENTRO}>Cupos reservados</th>
              <th className={ENTRO}>Leads Pauta</th>
              <th className={ENTRO}>Total leads</th>
              <th className={INSCRIBIO}>Inscritos reservas</th>
              <th className={INSCRIBIO}>Inscritos Pauta</th>
              <th className={INSCRIBIO}>Total inscritos</th>
              <th className="text-center whitespace-nowrap">Conversión</th>
              <th className="text-center whitespace-nowrap">Cupos disponibles</th>
              <th className="text-center whitespace-nowrap">Estado</th>
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
                <td className="text-center tabular-nums">{n(f.meta)}</td>
                <td className={CELDA_ENTRO}>{n(f.cuposReservados)}</td>
                <td className={CELDA_ENTRO}>{n(f.campanaDigital)}</td>
                <td className={CELDA_ENTRO_TOTAL}>{n(f.totalLeads)}</td>
                <td className={CELDA_INSCRIBIO}>{n(f.inscritosReservas)}</td>
                <td className={CELDA_INSCRIBIO}>{n(f.inscritosCampana)}</td>
                <td className="text-center font-semibold text-exito tabular-nums grupo-inscribio">
                  {n(f.totalInscritos)}
                </td>
                <td className="text-center tabular-nums">{tasa(f.conversion)}</td>
                {/* En rojo cuando ya se pasó: es el «−4» de su hoja, y
                    dice que esa acción entregó más cupos de los
                    comprometidos. */}
                <td
                  className={
                    "text-center font-medium tabular-nums " +
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
              <td className="text-center tabular-nums">{n(t.meta)}</td>
              <td className="text-center tabular-nums">{n(t.cuposReservados)}</td>
              <td className="text-center tabular-nums">{n(t.campanaDigital)}</td>
              <td className="text-center tabular-nums">{n(t.totalLeads)}</td>
              <td className="text-center tabular-nums">{n(t.inscritosReservas)}</td>
              <td className="text-center tabular-nums">{n(t.inscritosCampana)}</td>
              <td className="text-center text-exito tabular-nums">{n(t.totalInscritos)}</td>
              <td className="text-center tabular-nums">
                {tasa(t.totalLeads > 0 ? t.totalInscritos / t.totalLeads : null)}
              </td>
              <td className="text-center tabular-nums">{n(t.cuposDisponibles)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

    </Bloque>
  );
}
