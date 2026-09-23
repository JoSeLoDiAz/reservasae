/** Cómo se reparte el aula en sus seis estados, una sola vez. */

/**
 * VIVE AQUÍ PARA QUE NO HAYA DOS REPARTOS.
 *
 * Estaba escrito dentro de `tablero-academico.tsx`, y el módulo 3
 * del Resumen necesita exactamente el mismo: la misma fila, la
 * misma barra apilada y el mismo orden. Copiado, las dos pantallas
 * contarían distinto el mismo grupo el día que alguien mueva un
 * estado de sitio --y ninguna de las dos fallaría--.
 *
 * Sale en `lib/` y no en el componente por una segunda razón: el
 * Resumen no puede importar de `tablero-academico.tsx` sin
 * arrastrar sus mil líneas al bundle de la primera pantalla.
 */

import { colorEtapa } from "@/components/admin/etapa";
import {
  ETIQUETA_ETAPA,
  type Etapa,
  type FilaAccionAula,
  type FilaGrupoAula,
  type MetricasAula,
  type TableroAcademico,
} from "@/lib/crm-api";

/**
 * Las seis del aula, y suman `enAula` exacto.
 *
 * `dentro` INCLUYE a los certificados, así que la primera es lo
 * que le queda a `dentro` al quitarle los certificados, y las
 * otras cuatro son las salidas. Por eso el donut y las barras
 * apiladas cuadran con la cifra grande sin pedir nada más.
 */
export const REPARTO: Array<{ etapa: Etapa; de: (m: MetricasAula) => number }> = [
  { etapa: "EN_FORMACION", de: (m) => m.dentro - m.certificados },
  { etapa: "CERTIFICADO", de: (m) => m.certificados },
  { etapa: "DESERTO", de: (m) => m.desertaron },
  { etapa: "ABANDONO", de: (m) => m.abandonaron },
  { etapa: "RETIRADO", de: (m) => m.retirados },
  { etapa: "NO_APROBO", de: (m) => m.noAprobaron },
];

/** Las series del reparto, ya con su color. */
export const SERIES_REPARTO = REPARTO.map((r) => ({
  nombre: ETIQUETA_ETAPA[r.etapa],
  color: colorEtapa(r.etapa),
}));

/** El código de la fila sin acción ni grupo. */
export const SIN_DATO = "—";

/// AF1, AF2… AF10: por el número, no alfabético.
function numeroDe(codigo: string): number {
  // la fila sin dato no tiene número
  if (codigo === SIN_DATO) return Number.MAX_SAFE_INTEGER;
  const hallado = /(\d+)/.exec(codigo);
  return hallado ? Number(hallado[1]) : 999;
}

// el codigo se repite entre convenios
export function porCodigo(a: FilaAccionAula, b: FilaAccionAula): number {
  const paso = numeroDe(a.codigo) - numeroDe(b.codigo);
  return paso !== 0 ? paso : a.nombre.localeCompare(b.nombre, "es");
}

/** Por AF y número; el «sin grupo», al final. */
export function porNumeroDeGrupo(a: FilaGrupoAula, b: FilaGrupoAula): number {
  // sin número, la resta da NaN
  if ((a.numero === null) !== (b.numero === null)) return a.numero === null ? 1 : -1;
  return porCodigo(a, b) || (a.numero ?? 0) - (b.numero ?? 0);
}

/** Cómo se nombra un grupo: «AF1-G3». */
export function nombreDeGrupo(g: FilaGrupoAula): string {
  return g.numero === null ? g.nombre : `${g.codigo}-G${g.numero}`;
}

/** Lo que hay que decir cuando hay gente sin medir. */
export function notaSinMedir(d: TableroAcademico): string {
  return d.sinMedir > 0
    ? " «Sin medir» no tiene actividades cargadas: no entra en el avance medio ni puede quedar listo."
    : "";
}
