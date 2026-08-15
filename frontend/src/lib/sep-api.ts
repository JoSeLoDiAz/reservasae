import { ErrorApi } from "./api";

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

export type FormatoSep = "uso-directo" | "cargue-sep";

async function pedir<T>(ruta: string): Promise<T> {
  const respuesta = await fetch(`/api${ruta}`);
  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const bruto = (cuerpo as { message?: string | string[] } | null)?.message;
    const mensaje = Array.isArray(bruto) ? bruto.join(". ") : bruto;
    throw new ErrorApi(respuesta.status, mensaje ?? "No se pudo consultar.", cuerpo);
  }
  return cuerpo as T;
}

export const sepApi = {
  alistamiento: (convenioId: string) =>
    pedir<Alistamiento>(`/admin/sep/alistamiento?convenioId=${convenioId}`),
};

/** Por navegación: así la cookie de sesión viaja sola. */
export function descargarSep(convenioId: string, formato: FormatoSep) {
  window.location.href = `/api/admin/sep/exportar?convenioId=${convenioId}&formato=${formato}`;
}
