"use client";

/**
 * SEGUIMIENTO DE ASESORES, con sus dos subvistas.
 *
 * Ruta propia y no una pestaña más de `/admin/informes`: allí
 * `asesores` ya es Comité Marketing, y dos cosas distintas con el
 * mismo nombre en el mismo menú es lo primero que confunde.
 */

import { PanelAsesores } from "@/components/admin/panel-asesores";

export default function PaginaDeAsesores() {
  return <PanelAsesores />;
}
