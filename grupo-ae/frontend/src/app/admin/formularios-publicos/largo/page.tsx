/** Se fundió en una sola vista con pestañas. */

/// Los dos formularios viven ahora en la misma pantalla. Esta
/// ruta se queda redirigiendo porque estuvo en el menú y hay
/// gente con el enlace guardado.

import { redirect } from "next/navigation";

export default function Redirigir() {
  redirect("/admin/formularios-publicos");
}
