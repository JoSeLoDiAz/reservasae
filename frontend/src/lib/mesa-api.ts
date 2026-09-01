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
  /// Qué le falta para poder ser ficha. Vacío: está listo.
  ///
  /// Lo dice el SERVIDOR, que es el que después va a convertir.
  /// Calcularlo aquí sería una segunda verdad: la casilla se
  /// encendería en un lead que el servidor va a rechazar.
  falta: string[];
  /// Si autorizó al llenar el formulario de la pauta.
  autorizoAlRegistrarse: boolean;
};

export type ResultadoDelLote = {
  pedidos: number;
  convertidos: number;
  conAutorizacion: number;
  sinAutorizacion: number;
  fallaron: number;
  fuera: number;
  problemas: Array<{ leadId: string; nombre?: string; porque?: string }>;
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

  convertirLote: (ids: string[]) =>
    pedir<ResultadoDelLote>("/admin/leads/lote/convertir", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
};

/// Cuántos caben de una vez. Lo fija el servidor; aquí solo se
/// usa para no dejar seleccionar de más y decirlo antes.
export const TOPE_DEL_LOTE = 100;
