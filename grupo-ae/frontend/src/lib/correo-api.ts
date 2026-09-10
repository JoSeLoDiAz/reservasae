/** Correo saliente. */

import { pedir } from "./pedir";

export type EstadoCorreo = {
  configurado: boolean;
  servidor: string | null;
  puerto: number;
  usuario: string | null;
  remitente: string | null;
  nombre: string;
  /// Si hay clave puesta. Nunca viaja la clave.
  tieneClave: boolean;
  /// Si el servidor la aceptó ahora mismo, no cuando se
  /// configuró: una clave revocada se ve aquí.
  acepta: boolean;
  error: string | null;
  /// A quién se le desvía TODO. Vacío = va a su
  /// destinatario, que es lo normal en producción.
  desviadoA: string[];
  esPrueba: boolean;
};

export const correoApi = {
  estado: () => pedir<EstadoCorreo>("/admin/correo/estado"),

  probar: (para: string) =>
    pedir<{
      enviado: boolean;
      /// A donde FUE, que con el desvío no es lo pedido.
      para: string[];
      pedido: string;
      desviado: boolean;
      id: string;
    }>("/admin/correo/probar", {
      method: "POST",
      body: JSON.stringify({ para }),
    }),
};
