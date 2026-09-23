"use client";

/**
 * El tráfico vuelve a ser su propia pantalla (22 sep 2026).
 *
 * El 21 sep se fusionó dentro de Control de Inscritos —«Tráfico del
 * formulario fusionado con Control de inscritos»— y el 22 Josse lo
 * deshizo con el motivo escrito: **«eso lo dejamos en el listado
 * principal porque eso no es inscritos»**. Y es exacto: lo que se
 * mide aquí pasa ANTES de que exista el lead, así que colgarlo de
 * la pantalla de los inscritos lo ponía al final de un proceso que
 * empieza con él.
 *
 * El cuerpo NO se copió de vuelta: vive en `PanelTrafico`, extraído
 * en la entrega del 21 sep, y desde entonces lo monta quien lo
 * necesite. Esta página solo le pone el título.
 *
 * EL ENCABEZADO LO PONE ESTA PÁGINA y no el panel, porque el panel
 * se lo quitó a propósito cuando vivía dentro de Control: dos `h1`
 * en la misma pantalla no se leen como una pantalla con partes, se
 * leen como dos pantallas pegadas.
 */

import { Encabezado } from "@/components/admin/piezas";
import { PanelTrafico } from "@/components/admin/panel-trafico";

export default function PaginaTrafico() {
  return (
    <div className="flex flex-col gap-5 px-4 pt-3 pb-6">
      <Encabezado
        titulo="Tráfico del formulario"
        descripcion="Cuánta gente abre el formulario público, de dónde llega y cuántos terminan preinscritos."
      />
      <PanelTrafico />
    </div>
  );
}
