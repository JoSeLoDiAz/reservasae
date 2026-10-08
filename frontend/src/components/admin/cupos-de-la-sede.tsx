"use client";

/** Los cupos de un grupo en UNA sede, editables. Dos puertas, una regla. */

/**
 * ESTABA DENTRO DE `cronograma-vista` Y AHORA LO USAN DOS PANTALLAS.
 *
 * Josse pidió el 7 oct 2026 que la meta se pueda tocar también desde
 * «Grupos de AF», en Tableros: «no se ve la opción de agregar grupos y
 * que la meta sea modificable manual». Copiarlo habría dejado dos
 * formularios para la misma escritura ---y el día que uno aprenda a
 * validar algo, el otro no---. Es el mismo criterio que
 * `columnas-participante`, `logos-por-fondo` y `cumplimiento`.
 *
 * EL `bonito()` SE QUEDÓ FUERA a propósito: es de la vista del
 * cronograma, donde los nombres vienen en mayúscula sostenida. Aquí
 * entra el nombre ya como se quiera leer, así que quien llama decide.
 */

import { useState } from "react";

import { cronogramaApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";

import { CLASE_CONTROL } from "./marco-admin";

/**
 * Hasta el 7 oct 2026 esto solo entraba por la semilla: si el proyecto
 * sumaba plazas en un departamento y las quitaba en otro, tocaba el
 * Excel y volver a sembrar. El total de la acción en esa ciudad lo
 * recalcula el servidor como la suma de sus sedes, así que no hay forma
 * de dejar las dos cifras separadas desde aquí.
 */
export function CuposDeLaSede({
  sede,
  alGuardar,
  alFallar,
}: {
  /**
   * EL NOMBRE ENTRA YA COMO SE LEE, y `inscritos` es OPCIONAL.
   *
   * El cronograma pasa el suyo por `bonito()` ---allá vienen en
   * mayúscula sostenida--- y tiene el conteo a mano; la tabla de
   * grupos no lo tiene, y poner un cero sería afirmar que ese grupo
   * está vacío. Sin el dato no se pinta la frase.
   */
  sede: {
    id: string;
    nombre: string;
    cupos: number;
    tope: number;
    inscritos?: number;
  };
  alGuardar: () => Promise<void>;
  alFallar: (m: string) => void;
}) {
  const [base, setBase] = useState(String(sede.cupos));
  const [tope, setTope] = useState(String(sede.tope));
  const [guardando, setGuardando] = useState(false);

  const cambio = base !== String(sede.cupos) || tope !== String(sede.tope);

  async function guardar() {
    setGuardando(true);
    try {
      await cronogramaApi.actualizarCupos(sede.id, {
        cuposBase: Number(base),
        cuposMaximos: Number(tope),
      });
      await alGuardar();
    } catch (e) {
      alFallar((e as ErrorApi).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-hairline p-3">
      <p className="min-w-[9rem] grow text-[0.78125rem] font-medium text-titulo">
        {sede.nombre}
        {sede.inscritos !== undefined && (
          <span className="ml-2 font-normal text-texto-suave tabular-nums">
            {sede.inscritos} dentro
          </span>
        )}
      </p>

      <label className="block">
        <span className="mb-1 block text-xs font-medium">Comprometido</span>
        <input
          type="number"
          min={0}
          value={base}
          onChange={(e) => setBase(e.target.value)}
          className={`${CLASE_CONTROL} w-[6rem]`}
          aria-label={`Cupos comprometidos en ${sede.nombre}`}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium">Tope</span>
        <input
          type="number"
          min={0}
          value={tope}
          onChange={(e) => setTope(e.target.value)}
          className={`${CLASE_CONTROL} w-[6rem]`}
          aria-label={`Tope de cupos en ${sede.nombre}`}
        />
      </label>

      <button
        onClick={guardar}
        disabled={!cambio || guardando}
        className="sin-aro rounded-lg bg-marca px-3 py-1.5 text-[0.78125rem] font-semibold text-blanco transition disabled:opacity-40"
      >
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}