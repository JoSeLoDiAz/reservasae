/** La paleta del gremio, ya dentro del HTML. */

/// El unico sitio del frontend que lee `next/headers`, y por
/// eso va en su propio archivo: es la pieza que vuelve
/// dinamica la aplicacion, y asi se ve de un vistazo cual es.
///
/// Sin esto el color del gremio llegaria despues de un fetch
/// del cliente, que es exactamente el destello que la paleta
/// en el servidor existe para evitar.

import { headers } from "next/headers";

import { estilosDeGremio } from "@/lib/marca-servidor";

export async function EstilosGremio() {
  const css = await estilosDeGremio((await headers()).get("host"));
  if (!css) return null;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
