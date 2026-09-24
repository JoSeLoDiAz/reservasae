"use client";

import { notFound } from "next/navigation";
import { Suspense, use } from "react";

import {
  PantallaDeInformes,
  PESTANA_DE_SLUG,
} from "@/components/admin/pantalla-de-informes";
import { Cargando } from "@/components/admin/piezas";

/**
 * UN INFORME, UNA DIRECCIÓN.
 *
 * `/admin/informes/trafico`, `/leads`, `/reservas`, `/asesores`. Los
 * cuatro son vistas de la misma pantalla --comparten periodo y
 * filtros--, pero cada uno con su ruta: en el menú «se subrayan casi
 * todas las vistas» (cliente, 22 sep 2026) porque el menú compara
 * caminos, y los cuatro eran el mismo camino con otra pregunta. Con una
 * ruta cada uno, el menú enciende el que es y cada informe se puede
 * enlazar suelto.
 */
export default function PaginaDeInforme({ params }: { params: Promise<{ vista: string }> }) {
  const { vista } = use(params);
  const pestana = PESTANA_DE_SLUG[vista];
  /// Una dirección que no es de ningún informe es un 404 de verdad, no
  /// un informe cualquiera: así un enlace mal escrito se ve.
  if (!pestana) notFound();

  return (
    <Suspense fallback={<Cargando que="Cargando el informe…" />}>
      <PantallaDeInformes vista={pestana} />
    </Suspense>
  );
}
