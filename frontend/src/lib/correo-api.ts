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
};

export const correoApi = {
  estado: () => pedir<EstadoCorreo>("/admin/correo/estado"),

  probar: (para: string) =>
    pedir<{ enviado: boolean; para: string; id: string }>("/admin/correo/probar", {
      method: "POST",
      body: JSON.stringify({ para }),
    }),
};
