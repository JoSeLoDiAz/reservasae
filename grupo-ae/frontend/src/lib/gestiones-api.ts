/** Las gestiones: lo que un asesor hizo o tiene que hacer por un negocio. */

/**
 * EXISTÍA ENTERO EN EL BACKEND Y NINGUNA PANTALLA LO USABA.
 *
 * Agenda, «sin próximo paso», crear, marcar hecha y reabrir estaban en
 * `admin/gestiones` desde hace semanas. El panel no los llamaba, así
 * que el CRM no podía contestar «¿a quién llamo hoy?», las tareas que
 * los formularios crean solas no las veía nadie y el bananeo —que
 * cuenta gestiones hechas— no se podía encender nunca (auditoría del
 * 18 sep 2026). Esto es solo el cliente: las reglas siguen allá.
 */

import { pedir } from "./pedir";
import type { EtapaOportunidad, TipoEmbudo } from "./oportunidades-api";

export type TipoGestion = "LLAMADA" | "REUNION" | "CORREO" | "WHATSAPP" | "VISITA" | "TAREA";

/// En el orden en que se ofrecen: lo más frecuente primero.
export const TIPOS_DE_GESTION: Array<{ valor: TipoGestion; rotulo: string }> = [
  { valor: "LLAMADA", rotulo: "Llamada" },
  { valor: "WHATSAPP", rotulo: "WhatsApp" },
  { valor: "CORREO", rotulo: "Correo" },
  { valor: "REUNION", rotulo: "Reunión" },
  { valor: "VISITA", rotulo: "Visita" },
  { valor: "TAREA", rotulo: "Tarea" },
];

export const ROTULO_GESTION: Record<TipoGestion, string> = Object.fromEntries(
  TIPOS_DE_GESTION.map((t) => [t.valor, t.rotulo]),
) as Record<TipoGestion, string>;

export type Gestion = {
  id: string;
  tipo: TipoGestion;
  titulo: string;
  nota: string | null;
  venceEn: string | null;
  hechaEn: string | null;
  creadoEn: string;
  asesor: { id: string; nombre: string } | null;
  creadaPor: { id: string; nombre: string } | null;
};

export type GestionConNegocio = Gestion & {
  oportunidad: {
    id: string;
    codigo: string;
    titulo: string;
    etapa: EtapaOportunidad;
    embudo: TipoEmbudo;
    valor: number | string;
    empresa: { razonSocial: string } | null;
    persona: { primerNombre: string; primerApellido: string } | null;
  };
};

export type Agenda = {
  dia: string;
  deQuien: string;
  vencidas: GestionConNegocio[];
  hoy: GestionConNegocio[];
  estaSemana: GestionConNegocio[];
  cuantas: { vencidas: number; hoy: number; estaSemana: number };
};

export type SinProximoPaso = {
  dia: string;
  cuantas: number;
  oportunidades: Array<{
    id: string;
    codigo: string;
    titulo: string;
    etapa: EtapaOportunidad;
    embudo: TipoEmbudo;
    valor: number;
    asesor: { id: string; nombre: string } | null;
    deQuien: string | null;
    diasQuieta: number;
  }>;
};

export type NuevaGestion = {
  tipo: TipoGestion;
  titulo: string;
  nota?: string | null;
  venceEn?: string | null;
  hechaEn?: string | null;
};

export const gestionesApi = {
  /// `todos=si` es la del equipo; sin él, la de quien mira.
  agenda: (todos = true) => pedir<Agenda>(`/admin/gestiones/agenda${todos ? "?todos=si" : ""}`),
  sinProximoPaso: (todos = true) =>
    pedir<SinProximoPaso>(`/admin/gestiones/sin-proximo-paso${todos ? "?todos=si" : ""}`),
  deOportunidad: (oportunidadId: string) =>
    pedir<{ pendientes: Gestion[]; hechas: Gestion[]; cuantas: number }>(
      `/admin/gestiones/oportunidad/${oportunidadId}`,
    ),
  crear: (oportunidadId: string, datos: NuevaGestion) =>
    pedir<Gestion>(`/admin/gestiones/oportunidad/${oportunidadId}`, {
      method: "POST",
      body: JSON.stringify(datos),
    }),
  hecha: (id: string) => pedir<Gestion>(`/admin/gestiones/${id}/hecha`, { method: "POST" }),
  reabrir: (id: string) => pedir<Gestion>(`/admin/gestiones/${id}/hecha`, { method: "DELETE" }),
};

/// «hoy 3:00 p. m.», «mañana», «vie 20 sep»: cómo se lee un
/// vencimiento de un vistazo.
export function cuandoVence(iso: string | null, ahora = new Date()): string {
  if (!iso) return "Sin fecha";
  const f = new Date(iso);
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((dia(f) - dia(ahora)) / 86_400_000);
  const hora = f.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  const conHora = f.getHours() !== 0 || f.getMinutes() !== 0;
  if (dias === 0) return conHora ? `Hoy ${hora}` : "Hoy";
  if (dias === 1) return conHora ? `Mañana ${hora}` : "Mañana";
  if (dias === -1) return "Ayer";
  if (dias < -1) return `Hace ${-dias} días`;
  return f.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
}
