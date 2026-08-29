/** El banco de pruebas del webhook de Meta. */

import { pedir } from "./pedir";

export type EstadoMeta = {
  /// Si no falta nada para que Meta pueda conectarse.
  listo: boolean;
  /// Lo que falta, ya redactado: cada línea dice qué es, de
  /// dónde sale y dónde se pone.
  faltan: string[];
  paraMeta: {
    /// Lo que se pega en Meta tal cual.
    urlDeDevolucion: string;
    /// El token NO viaja: solo si está puesto. Es una
    /// credencial, y una credencial en pantalla es una
    /// credencial en una captura.
    tokenPuesto: boolean;
    campo: string;
  };
  convenio: { slug: string; nombre: string; activo: boolean } | null;
  leads: { total: number; pendientes: number };
  /// La tabla donde se guardan los leads no existe todavía.
  /// Va aparte de `faltan` porque el remedio no se parece:
  /// no es poner una variable, es aplicar una migración.
  sinTabla: boolean;
  /// Inventar leads solo se puede en pruebas.
  puedeSimular: boolean;
};

export type Resultado = {
  pasa: boolean;
  /// Por qué pasó o por qué no, en una frase que se pueda
  /// leer sin saber qué es un HMAC.
  porque: string;
  estado?: number;
  devolvio?: string;
};

export type ResultadoAviso = Resultado & {
  mandados?: number;
  guardados?: number;
  sinConvenio?: boolean;
  filas?: Array<{
    externoId: string;
    estado: string;
    origen: string;
    motivo: string | null;
    recibidoEn: string;
    deprueba: boolean;
  }>;
};

export const metaApi = {
  estado: () => pedir<EstadoMeta>("/admin/pruebas/meta"),

  probarVerificacion: () =>
    pedir<Resultado>("/admin/pruebas/meta/verificacion", { method: "POST" }),

  probarAviso: (cuantos: number) =>
    pedir<ResultadoAviso>(`/admin/pruebas/meta/aviso?cuantos=${cuantos}`, {
      method: "POST",
    }),

  limpiar: () =>
    pedir<{ borrados: number }>("/admin/pruebas/meta/limpiar", {
      method: "POST",
    }),
};
