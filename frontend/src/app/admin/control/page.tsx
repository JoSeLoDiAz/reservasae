"use client";

import { Suspense } from "react";

import { PantallaDeInformes } from "@/components/admin/pantalla-de-informes";
import { Cargando } from "@/components/admin/piezas";

/**
 * La dirección de siempre de los informes.
 *
 * Desde el 22 sep 2026 cada informe tiene su propia ruta
 * (`/admin/informes/…`) y el menú los ofrece por separado. Esta se
 * queda para los enlaces guardados: lee `?pantalla` como toda la vida.
 *
 * `Suspense` porque la pantalla usa `useSearchParams`: sin él,
 * `next build` no puede prerenderizarla y la compilación de producción
 * se cae. En desarrollo no se nota, que es como se cuela.
 */
export default function PaginaControl() {
  return (
    <Suspense fallback={<Cargando que="Cargando el informe…" />}>
      <PantallaDeInformes />
    </Suspense>
  );
}
