import { ErrorApi } from "./api";
import { pedir } from "./pedir";

export type Alistamiento = {
  convenio: { nombre: string; sigla: string | null };
  listos: number;
  noListos: number;
  motivos: Array<{ motivo: string; total: number }>;
  personas: Array<{
    nombre: string;
    documento: string;
    etapa: string;
    motivo: string;
  }>;
};

export type FormatoSep = "uso-directo" | "cargue-sep" | "f7";


export const sepApi = {
  alistamiento: (convenioId: string) =>
    pedir<Alistamiento>(`/admin/sep/alistamiento?convenioId=${convenioId}`),
};

/** Por navegación: así la cookie de sesión viaja sola. */
export function descargarSep(convenioId: string, formato: FormatoSep) {
  window.location.href = `/api/admin/sep/exportar?convenioId=${convenioId}&formato=${formato}`;
}
