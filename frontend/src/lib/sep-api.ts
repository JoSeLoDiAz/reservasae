import { ErrorApi } from "./api";
import { pedir } from "./pedir";

export type Alistamiento = {
  convenio: { nombre: string; sigla: string | null };
  listos: number;
  noListos: number;
  motivos: Array<{ motivo: string; total: number }>;
  personas: Array<{
    /// El id de la PARTICIPACIÓN. Una misma persona en dos
    /// acciones de formación son dos filas, y sin esto la
    /// pantalla las trataba como la misma.
    id: string;
    nombre: string;
    documento: string;
    etapa: string;
    accion: string | null;
    motivo: string;
  }>;
};

/**
 * El del F7 va por ORGANIZACION y es otra cifra.
 *
 * La pantalla pintaba el numero de personas al lado del boton
 * del F7 y no tenia con que saber si habia alguna empresa
 * lista, asi que ese boton era el unico de los tres siempre
 * activo.
 */
export type AlistamientoF7 = {
  listos: number;
  noListos: number;
  motivos: Array<{ motivo: string; total: number }>;
  empresas: Array<{
    empresa: string;
    nit: string;
    accion: string;
    motivo: string;
  }>;
};

export type FormatoSep = "uso-directo" | "cargue-sep" | "f7";

export const sepApi = {
  alistamiento: (convenioId: string) =>
    pedir<Alistamiento>(`/admin/sep/alistamiento?convenioId=${convenioId}`),
  alistamientoF7: (convenioId: string) =>
    pedir<AlistamientoF7>(`/admin/sep/alistamiento-f7?convenioId=${convenioId}`),
};

/** Por navegación: así la cookie de sesión viaja sola. */
export function descargarSep(convenioId: string, formato: FormatoSep) {
  window.location.href = `/api/admin/sep/exportar?convenioId=${convenioId}&formato=${formato}`;
}
