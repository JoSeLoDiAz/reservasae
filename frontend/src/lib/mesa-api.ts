/** La mesa de entrada: lo que llegó por los webhooks. */

import { pedir } from "./pedir";

export type EstadoLead = "PENDIENTE" | "CONVERTIDO" | "DESCARTADO";

export type LeadDeLaMesa = {
  id: string;
  estado: EstadoLead;
  /// Qué le falta, o por qué se parece a otro. Null: nada.
  motivo: string | null;
  nombre: string;
  /// `1 · 1020304050`, o null si no trajo.
  documento: string | null;
  correo: string | null;
  celular: string | null;
  origen: string;
  /// El sistema que lo mandó: el orquestador, meta, postman.
  porDonde: string;
  gremio: string;
  /// Lo que PIDIÓ, en sus palabras.
  pidio: string | null;
  /// Y lo que se resolvió del catálogo. Null: no se reconoció.
  curso: string | null;
  recibidoEn: string;
  /// Si ya tiene ficha, para poder saltar a ella.
  participanteId: string | null;
};

export type ListadoDeLaMesa = {
  total: number;
  pagina: number;
  paginas: number;
  /// Cuántos hay por estado, en TODO el ámbito.
  resumen: Partial<Record<EstadoLead, number>>;
  leads: LeadDeLaMesa[];
};

export const ETIQUETA_ESTADO_LEAD: Record<EstadoLead, string> = {
  PENDIENTE: "Sin atender",
  CONVERTIDO: "Ya es ficha",
  DESCARTADO: "Descartado",
};

/// El color dice urgencia, no categoría: lo pendiente es lo
/// único que le pide algo a alguien.
export const TONO_ESTADO_LEAD: Record<EstadoLead, string> = {
  PENDIENTE: "text-aviso",
  CONVERTIDO: "text-exito",
  DESCARTADO: "text-texto-suave",
};

export const mesaApi = {
  listar: (q: {
    estado?: string;
    buscar?: string;
    pagina?: number;
    limite?: number;
  }) => {
    const p = new URLSearchParams();
    if (q.estado) p.set("estado", q.estado);
    if (q.buscar?.trim()) p.set("buscar", q.buscar.trim());
    if (q.pagina) p.set("pagina", String(q.pagina));
    if (q.limite) p.set("limite", String(q.limite));
    const cola = p.toString();
    return pedir<ListadoDeLaMesa>(`/admin/leads${cola ? `?${cola}` : ""}`);
  },
};
