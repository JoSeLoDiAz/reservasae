/** Los doce orígenes, agrupados como los nombra el negocio. */

/**
 * La maqueta del cliente habla de cuatro canales —Mailing,
 * Afiliados, Aliados y Pauta— y el sistema guarda DOCE orígenes.
 * «Mapear» (Josse, 22 sep 2026).
 *
 * VA EN UN `Record<Origen, …>` Y NO EN UN MAPA SUELTO: así el
 * compilador obliga a clasificar cualquier origen nuevo. Un mapa a
 * mano se queda viejo el día que se añada uno, y el síntoma sería
 * un canal que desaparece de la tabla sin que nada falle —el mismo
 * defecto que `ETIQUETA_ETAPA` evita en `filtros-en-la-url.ts`—.
 *
 * DOS GRUPOS QUE NO ESTÁN EN LA MAQUETA, Y TIENEN QUE ESTAR:
 *
 * - «Se inscribió solo» (AUTOGESTION) es el más grande de
 *   producción —21 de 127 fichas— y no es ninguno de los cuatro:
 *   es quien llegó al formulario público por un enlace SIN
 *   etiqueta. Meterlo en Mailing porque la mayoría venga del correo
 *   sería convertir un agujero de medición en una afirmación sobre
 *   el canal, que es justo lo que este proyecto se negó a hacer con
 *   «No dejó rastro».
 * - «Otros» recoge lo que no es ninguno. Prefiero una fila que
 *   diga «otros» a un cajón que mienta.
 *
 * Y PAUTA NO ES «REDES A SECAS». Se agrupan aquí los mismos
 * orígenes que `origenDeLead` ya clasifica como PAUTA en el
 * servidor: si esta pantalla dijera «pauta» de algo que el informe
 * de orígenes cuenta como orgánico, serían dos verdades sobre la
 * misma inversión.
 */

import type { Origen } from "./crm-api";

export type CanalDelResumen =
  | "MAILING"
  | "AFILIADOS"
  | "ALIADOS"
  | "PAUTA"
  | "SOLO"
  | "OTROS";

export const NOMBRE_CANAL: Record<CanalDelResumen, string> = {
  MAILING: "Mailing",
  AFILIADOS: "Afiliados",
  ALIADOS: "Aliados",
  PAUTA: "Pauta",
  SOLO: "Se inscribió solo",
  OTROS: "Otros",
};

/// El orden de la tabla: los cuatro del cliente primero, y los dos
/// que este sistema añade al final.
export const ORDEN_CANALES: CanalDelResumen[] = [
  "MAILING",
  "AFILIADOS",
  "ALIADOS",
  "PAUTA",
  "SOLO",
  "OTROS",
];

export const CANAL_DE_ORIGEN: Record<Origen, CanalDelResumen> = {
  /// El envío a la base del gremio. Lo escribe el marcador de
  /// enlaces cuando el correo sale con `utm_source=correo`.
  CORREO: "MAILING",

  /// La institución afiliada que reservó cupos y nominó a su gente.
  EMPRESA: "AFILIADOS",

  /// Quien llega POR alguien: un referido o una feria del gremio.
  /// No es el afiliado que nomina ni la pauta que se paga.
  REFERIDO: "ALIADOS",
  EVENTO: "ALIADOS",

  /// Los mismos que `origenDeLead` cuenta como PAUTA en el
  /// servidor. No se añade ni se quita ninguno.
  FACEBOOK: "PAUTA",
  INSTAGRAM: "PAUTA",
  REDES: "PAUTA",
  LINKEDIN: "PAUTA",

  /// El formulario público sin etiqueta: no se sabe por dónde vino.
  AUTOGESTION: "SOLO",

  ASESOR: "OTROS",
  WHATSAPP: "OTROS",
  OTRO: "OTROS",
};

/** Suma los orígenes en sus canales, conservando la regla de cada cifra. */
export function porCanal(
  filas: Array<{ etiqueta: string; leads: number; inscritos: number }>,
): Array<{ canal: CanalDelResumen; nombre: string; leads: number; inscritos: number }> {
  const suma = new Map<CanalDelResumen, { leads: number; inscritos: number }>();
  for (const f of filas) {
    /// Un origen que no esté en el mapa cae en «Otros» en vez de
    /// desaparecer: la tabla tiene que seguir sumando el total.
    const canal = CANAL_DE_ORIGEN[f.etiqueta as Origen] ?? "OTROS";
    const x = suma.get(canal) ?? { leads: 0, inscritos: 0 };
    x.leads += f.leads;
    x.inscritos += f.inscritos;
    suma.set(canal, x);
  }
  return ORDEN_CANALES.filter((c) => suma.has(c)).map((c) => ({
    canal: c,
    nombre: NOMBRE_CANAL[c],
    leads: suma.get(c)!.leads,
    inscritos: suma.get(c)!.inscritos,
  }));
}
