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

/// Los dos bloques de columnas, los mismos de la tabla de acciones.
/// LAS DOS MITADES DE LA TABLA, y por que llevan clase propia.
///
const ENTRO = "text-center whitespace-nowrap text-marca";
const INSCRIBIO = "text-center whitespace-nowrap text-exito";

/// Las mismas dos mitades, en el cuerpo. La clase va en la celda y no
/// en la fila porque la raya es de la COLUMNA.
const CELDA_ENTRO = "text-center tabular-nums";
const CELDA_ENTRO_TOTAL = "text-center font-medium tabular-nums";
const CELDA_INSCRIBIO = "text-center tabular-nums";

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
    >
      <div className="caja-scroll overflow-x-auto">
        <table className="tabla-datos w-full">
          <thead>
            {/* LAS MISMAS COLUMNAS QUE LA TABLA DE ACCIONES, y sin
                «Sede» (cliente, 23 sep 2026): el departamento ya dice
                dónde, y la sede repetía casi siempre lo mismo. */}
            <tr>
              <th>Grupo</th>
              <th className="w-full">Departamento</th>
              <th className="text-center whitespace-nowrap">Modalidad</th>
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
              /// LA LLAVE LLEVA EL DEPARTAMENTO. Desde que un grupo
              /// puede dar dos filas --una por departamento-- el id
              /// del grupo solo ya no identifica la fila, y React con
              /// llaves repetidas reordena mal y reusa celdas de otra
              /// fila sin avisar de nada.
              <tr key={`${f.grupoId}·${f.departamento}`}>
                <td className="whitespace-nowrap">Grupo {f.numero}</td>
                {/* Una raya y no una celda en blanco: en blanco no se
                    sabe si es que falta el dato o si es que nadie lo
                    llenó. */}
                <td className="min-w-[10rem]">{f.departamento || "—"}</td>
                <td className="whitespace-nowrap">{MODALIDAD[f.modalidad] ?? f.modalidad}</td>
                <td className="text-center tabular-nums">{n(f.meta)}</td>
                <td className={CELDA_ENTRO}>{n(f.nominadosPorEmpresa)}</td>
                <td className={CELDA_ENTRO}>{n(f.campanaDigital)}</td>
                <td className={CELDA_ENTRO_TOTAL}>{n(f.totalLeads)}</td>
                <td className={CELDA_INSCRIBIO}>{n(f.inscritosReservas)}</td>
                <td className={CELDA_INSCRIBIO}>{n(f.inscritosCampana)}</td>
                <td className="text-center font-semibold text-exito tabular-nums">
                  {n(f.totalInscritos)}
                </td>
                <td className="text-center tabular-nums">{tasa(f.conversion)}</td>
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
              <td colSpan={3}>Total</td>
              <td className="text-center tabular-nums">{n(t.meta)}</td>
              {/* LAS CLASES DE LAS DOS MITADES, TAMBIÉN AQUÍ. Sin
                  ellas la raya de color se paraba en la última fila
                  de datos y la de totales quedaba suelta, como si no
                  fuera de la misma tabla. */}
              <td className={CELDA_ENTRO}>{n(t.nominadosPorEmpresa)}</td>
              <td className={CELDA_ENTRO}>{n(t.campanaDigital)}</td>
              <td className={CELDA_ENTRO}>{n(t.totalLeads)}</td>
              <td className={CELDA_INSCRIBIO}>{n(t.inscritosReservas)}</td>
              <td className={CELDA_INSCRIBIO}>{n(t.inscritosCampana)}</td>
              <td className="text-center text-exito tabular-nums">
                {n(t.totalInscritos)}
              </td>
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
