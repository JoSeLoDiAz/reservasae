/** «Nuevo contacto»: la persona y su negocio, escritos a mano. */

/**
 * Archivo propio y no un método más de `crm-api.ts`: aquel habla con
 * `/admin/participantes`, que crea fichas de formación, y este
 * contacto no crea ninguna —crea la persona y su negocio en el
 * embudo—. El porqué entero está en el backend, en
 * `crm/contacto-nuevo.ts`.
 */

import type { Origen } from "./crm-api";
import { pedir } from "./pedir";
import type { TipoEmbudo } from "./oportunidades-api";

export type LineaDeNegocio = { id: string; nombre: string; sigla: string | null };
export type TipoDeDocumento = { id: number; etiqueta: string; sigla: string };

export type OpcionesDeContacto = {
  lineas: LineaDeNegocio[];
  tiposDeDocumento: TipoDeDocumento[];
};

/// Los tres por los que un asesor puede decir que la persona
/// autorizó. El formulario web y la carga de una empresa los deja
/// el sistema, y el servidor los rechaza si llegan de aquí.
export type CanalAMano = "VERBAL_ASESOR" | "CORREO" | "PRESENCIAL";

export const CANALES_A_MANO: Array<{ valor: CanalAMano; rotulo: string }> = [
  { valor: "VERBAL_ASESOR", rotulo: "De palabra (llamada o reunión)" },
  { valor: "CORREO", rotulo: "Por correo" },
  { valor: "PRESENCIAL", rotulo: "En persona, por escrito" },
];

export type NuevoContacto = {
  convenioId: string;
  tipoDocumentoSepId: number;
  numeroDocumento: string;
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  correo?: string;
  celular?: string;
  organizacion?: string;
  nit?: string;
  cargo?: string;
  embudo: TipoEmbudo;
  interes?: string;
  origen?: Origen;
  autorizo: boolean;
  canalAutorizacion?: CanalAMano;
  nota?: string;
};

export type ResultadoDelContacto = {
  /// CREADO: negocio nuevo. YA_ESTABA: el mismo envío de hace un
  /// momento. ANOTADO: ya había uno vivo y se anotó en él.
  que: "CREADO" | "YA_ESTABA" | "ANOTADO";
  oportunidad: { id: string; codigo: string; embudo: TipoEmbudo };
  personaYaExistia: boolean;
  loQueNoSePiso: string[];
  asignadoAQuienLoCreo: boolean;
  constancia: "REGISTRADA" | "YA_TENIA" | "SIN_POLITICA" | "NO_DIJO";
};

export const contactosApi = {
  opciones: () => pedir<OpcionesDeContacto>("/admin/contactos/opciones"),

  crear: (datos: NuevoContacto) =>
    pedir<ResultadoDelContacto>("/admin/contactos", {
      method: "POST",
      body: JSON.stringify(datos),
    }),
};
