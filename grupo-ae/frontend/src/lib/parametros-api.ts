/** Los parámetros con los que se arma el tablero. */

import { pedir } from "./pedir";
import type { EtapaOportunidad, TipoEmbudo } from "./oportunidades-api";

export type Probabilidad = {
  embudo: TipoEmbudo;
  etapa: EtapaOportunidad;
  /// Ya viene en español desde el backend, del mismo sitio del que
  /// salen los nombres de etapa del embudo: no se traduce aquí para
  /// que no haya dos vocabularios.
  rotulo: string;
  porcentaje: number;
  /// Nadie la ha tocado: la está poniendo el código.
  deFabrica: boolean;
};

export type Parametros = {
  ans: Record<TipoEmbudo, number>;
  bananeo: Record<TipoEmbudo, number>;
  diasParaFria: number;
  actualizadoEn: string | null;
  probabilidades: Probabilidad[];
};

export type CambioDeParametros = Partial<{
  ansPersonaMinutos: number;
  ansEmpresaMinutos: number;
  bananeoPersona: number;
  bananeoEmpresa: number;
  diasParaFria: number;
}>;

/// Los minutos, dichos como los diría una persona. El backend tiene
/// su propia versión de esto para las frases que él escribe; aquí
/// hace falta para el rótulo que va al lado del campo.
export function enTiempo(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = minutos / 60;
  if (horas < 24) return Number.isInteger(horas) ? `${horas} h` : `${horas.toFixed(1)} h`;
  const dias = horas / 24;
  return dias === 1 ? "1 día" : `${Number.isInteger(dias) ? dias : dias.toFixed(1)} días`;
}

export const parametrosApi = {
  ver: () => pedir<Parametros>("/admin/parametros"),
  actualizar: (cambios: CambioDeParametros) =>
    pedir<Parametros>("/admin/parametros", {
      method: "PATCH",
      body: JSON.stringify(cambios),
    }),
  fijarProbabilidad: (
    embudo: TipoEmbudo,
    etapa: EtapaOportunidad,
    porcentaje: number,
  ) =>
    pedir<Parametros>("/admin/parametros/probabilidad", {
      method: "PUT",
      body: JSON.stringify({ embudo, etapa, porcentaje }),
    }),
  volverDeFabrica: (embudo: TipoEmbudo, etapa: EtapaOportunidad) =>
    pedir<Parametros>(`/admin/parametros/probabilidad/${embudo}/${etapa}`, {
      method: "DELETE",
    }),
};
