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
  /// De quién es. Null: sin dueño, en el montón común.
  asesor: { id: string; nombre: string } | null;
  /// Cuándo se tocó por última vez, y cuántas veces. Es lo que
  /// dice a quién hay que insistirle hoy.
  ultimaGestionEn: string | null;
  gestiones: number;
  /// Si se le puede llamar. La regla vive en el SERVIDOR: esto
  /// solo la pinta. `POST /notas` la vuelve a aplicar.
  puedoContactar: "SI" | "REVOCO" | "YA_NO_ESTA_EN_LA_MESA";
  /// Los valores EN CRUDO, para rellenar el formulario que los
  /// corrige. Arriba van compuestos, que es lo que se lee pero no
  /// lo que se puede meter en un campo.
  crudo: {
    tipoDocumentoSepId: number | null;
    numeroDocumento: string | null;
    primerNombre: string | null;
    primerApellido: string | null;
    segundoApellido: string | null;
    correo: string | null;
    celular: string | null;
    accionFormacionId: string | null;
    departamentoSepId: number | null;
    municipioSepId: number | null;
    generoSepId: number | null;
  };
};

/// Lo que se puede corregir de un lead. Todo opcional: se manda
/// solo lo que cambia.
export type ArregloDeLead = Partial<LeadDeLaMesa["crudo"]>;

export type ResultadoDelLote = {
  pedidos: number;
  convertidos: number;
  conAutorizacion: number;
  sinAutorizacion: number;
  fallaron: number;
  fuera: number;
  problemas: Array<{ leadId: string; nombre?: string; porque?: string }>;
};

export type AsesorDeLaMesa = { id: string; nombre: string; correo: string };

export type ListadoDeLaMesa = {
  total: number;
  /// Quién puede llevar estos leads. Viene en la misma llamada:
  /// pedirla aparte serían dos viajes para una pantalla.
  asesores: AsesorDeLaMesa[];
  /// Los cursos con los que se arregla un lead sin curso. Del
  /// ámbito y visibles: ofrecer los del otro gremio dejaría
  /// elegir uno que el servidor va a rechazar.
  cursos: Array<{
    id: string;
    codigo: string;
    nombre: string;
    convenioId: string;
  }>;
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

  /// `asesorId` solo lo manda quien REPARTE. Quien no, se las
  /// queda: el servidor le pone su propio id, y mandarlo desde
  /// aqui seria dejar que el navegador decidiera de quien son.
  convertirLote: (ids: string[], asesorId?: string) =>
    pedir<ResultadoDelLote>("/admin/leads/convertir-lote", {
      method: "POST",
      body: JSON.stringify(asesorId ? { ids, asesorId } : { ids }),
    }),

  arreglar: (id: string, cambios: ArregloDeLead) =>
    pedir<{ id: string }>(`/admin/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(cambios),
    }),

  /// La nota de gestión sobre un LEAD, sin convertirlo.
  ///
  /// Misma forma que la de la ficha, y a propósito: es la misma
  /// tabla y el mismo DTO del servidor.
  agregarNota: (
    id: string,
    nota: { texto: string; canales: string[]; resultado: string },
  ) =>
    pedir<{ id: string; creadoEn: string }>(`/admin/leads/${id}/notas`, {
      method: "POST",
      body: JSON.stringify(nota),
    }),

  /// Repartir. `null` los devuelve al montón sin dueño.
  asignar: (ids: string[], asesorId: string | null) =>
    pedir<{ repartidos: number; sinTocar: number; total: number }>(
      "/admin/leads/asignar-lote",
      { method: "POST", body: JSON.stringify({ ids, asesorId }) },
    ),

  descartarLote: (ids: string[], motivo: string) =>
    pedir<{ pedidos: number; descartados: number; sinTocar: number }>(
      "/admin/leads/descartar-lote",
      { method: "POST", body: JSON.stringify({ ids, motivo }) },
    ),
};

/// Cuántos caben de una vez. Lo fija el servidor; aquí solo se
/// usa para no dejar seleccionar de más y decirlo antes.
export const TOPE_DEL_LOTE = 100;

/// Un dato, dicho por quien lo diga.
export type Dicho = { valor: string | number | null; texto: string | null };

export type FilaComparada = {
  campo: string;
  etiqueta: string;
  /// Con qué clave se manda al PATCH. Null: no se aplica desde
  /// aquí — el documento es la identidad, no un dato más.
  clave: string | null;
  ficha: Dicho;
  leads: Array<Dicho & { deQuien: string }>;
  rui: Dicho | null;
  /// La ficha dice algo y otra fuente dice otra cosa.
  discrepa: boolean;
  /// La ficha lo tiene vacío y alguna fuente lo trae.
  falta: boolean;
};

export type Comparativo = {
  participanteId: string;
  fuentes: Array<{
    id: string;
    origen: string;
    porDonde: string;
    recibidoEn: string;
  }>;
  rui: { simulado: boolean; consultadoEn: string } | null;
  filas: FilaComparada[];
  discrepan: number;
  faltan: number;
};

export const comparativoApi = {
  de: (participanteId: string) =>
    pedir<Comparativo>(`/admin/leads/comparativo/${participanteId}`),
};
