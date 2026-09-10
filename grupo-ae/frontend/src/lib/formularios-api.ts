/** Tipos y llamadas del constructor de formularios. */

import { ErrorApi } from "./api";
import { pedir } from "./pedir";

export type TipoPregunta =
  | "TEXTO_CORTO"
  | "TEXTO_LARGO"
  | "NUMERO"
  | "CORREO"
  | "TELEFONO"
  | "FECHA"
  | "SELECCION_UNICA"
  | "SELECCION_MULTIPLE"
  | "CASILLA"
  | "PARRAFO";

export type CampoNucleo =
  | "EMPRESA_NIT"
  | "EMPRESA_RAZON_SOCIAL"
  | "EMPRESA_COLABORADORES"
  | "EMPRESA_RED_ASOCIADA"
  | "EMPRESA_RED_ASOCIADA_OTRA"
  | "CONTACTO_NOMBRE"
  | "CONTACTO_CORREO"
  | "CONTACTO_CELULAR"
  | "CONTACTO_CARGO"
  | "ACCION_FORMACION"
  | "OFERTA"
  | "CUPOS_SOLICITADOS"
  | "ACEPTA_TERMINOS"
  | "ACEPTA_POLITICA_DATOS";

export type ControlEspecial = "ACCION" | "OFERTA" | "CUPOS" | null;

export type DefinicionCampoNucleo = {
  campo: CampoNucleo;
  etiquetaSugerida: string;
  tipo: TipoPregunta;
  obligatorioParaPublicar: boolean;
  controlEspecial?: ControlEspecial;
  descripcion: string;
};

export type Opcion = {
  id: string;
  etiqueta: string;
  valor: string;
  orden: number;
  archivada: boolean;
};

export type PreguntaAdmin = {
  id: string;
  seccionId: string | null;
  etiqueta: string;
  ayuda: string | null;
  marcador: string | null;
  tipo: TipoPregunta;
  obligatoria: boolean;
  orden: number;
  campoNucleo: CampoNucleo | null;
  minimo: number | null;
  maximo: number | null;
  largoMinimo: number | null;
  largoMaximo: number | null;
  dependeDePreguntaId: string | null;
  dependeDeValor: string | null;
  archivada: boolean;
  opciones: Opcion[];
  _count: { respuestas: number };
};

export type SeccionAdmin = {
  id: string;
  titulo: string;
  descripcion: string | null;
  orden: number;
};

export type FormularioAdmin = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  mensajeExito: string | null;
  publicado: boolean;
  convenio: { id: string; slug: string; sigla: string | null };
  secciones: SeccionAdmin[];
  preguntas: PreguntaAdmin[];
  /** Lo que impide publicar. */
  problemas: string[];
  /** Solo los colores que sobreescribe. */
  coloresClaro: Record<string, string> | null;
  coloresOscuro: Record<string, string> | null;
};

export type ResumenFormulario = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  publicado: boolean;
  convenio: string;
  convenioSigla: string | null;
  preguntas: number;
  secciones: number;
  actualizadoEn: string;
};

// formulario público

export type PreguntaPublica = {
  id: string;
  etiqueta: string;
  ayuda: string | null;
  marcador: string | null;
  tipo: TipoPregunta;
  obligatoria: boolean;
  campoNucleo: CampoNucleo | null;
  controlEspecial: ControlEspecial;
  minimo: number | null;
  maximo: number | null;
  largoMinimo: number | null;
  largoMaximo: number | null;
  dependeDePreguntaId: string | null;
  dependeDeValor: string | null;
  opciones: Array<{ id: string; etiqueta: string; valor: string }>;
};

export type SeccionPublica = {
  id: string;
  titulo: string;
  descripcion: string | null;
  preguntas: PreguntaPublica[];
};

export type FormularioPublico = {
  slug: string;
  titulo: string;
  descripcion: string | null;
  mensajeExito: string | null;
  convenio: { slug: string; sigla: string | null; nombre: string };
  secciones: SeccionPublica[];
  sueltas: PreguntaPublica[];
};


const cuerpo = (datos: unknown) => JSON.stringify(datos);

export const formulariosApi = {
  camposNucleo: () =>
    pedir<DefinicionCampoNucleo[]>("/admin/formularios/campos-nucleo"),

  listar: () => pedir<ResumenFormulario[]>("/admin/formularios"),

  /// Las dos líneas que ve quien se preinscribe, por acción.
  ///
  /// La ruta existía desde hace tiempo y no la llamaba nadie: una
  /// API sin pantalla, así que en el formulario público salía lo
  /// que hubiera dejado la siembra.
  guardarResumen: (accionId: string, resumen: string | null) =>
    pedir<{ id: string; codigo: string; resumenPublico: string | null }>(
      `/admin/formularios/resumenes/${accionId}`,
      { method: "PATCH", body: cuerpo({ resumen }) },
    ),

  obtener: (id: string) => pedir<FormularioAdmin>(`/admin/formularios/${id}`),

  crear: (datos: { convenioId: string; slug: string; titulo: string }) =>
    pedir<FormularioAdmin>("/admin/formularios", { method: "POST", body: cuerpo(datos) }),

  actualizar: (
    id: string,
    datos: Partial<Pick<FormularioAdmin, "titulo" | "descripcion" | "mensajeExito" | "publicado">>,
  ) => pedir<FormularioAdmin>(`/admin/formularios/${id}`, { method: "PATCH", body: cuerpo(datos) }),

  duplicar: (id: string, datos: { slug: string; titulo: string }) =>
    pedir<FormularioAdmin>(`/admin/formularios/${id}/duplicar`, {
      method: "POST",
      body: cuerpo(datos),
    }),

  eliminar: (id: string) =>
    pedir<{ eliminado: boolean }>(`/admin/formularios/${id}`, { method: "DELETE" }),

  crearSeccion: (id: string, datos: { titulo: string; descripcion?: string }) =>
    pedir<FormularioAdmin>(`/admin/formularios/${id}/secciones`, {
      method: "POST",
      body: cuerpo(datos),
    }),

  actualizarSeccion: (seccionId: string, datos: { titulo: string; descripcion?: string }) =>
    pedir<FormularioAdmin>(`/admin/formularios/secciones/${seccionId}`, {
      method: "PATCH",
      body: cuerpo(datos),
    }),

  eliminarSeccion: (seccionId: string) =>
    pedir<FormularioAdmin>(`/admin/formularios/secciones/${seccionId}`, { method: "DELETE" }),

  reordenarSecciones: (id: string, ids: string[]) =>
    pedir<FormularioAdmin>(`/admin/formularios/${id}/secciones/orden`, {
      method: "PATCH",
      body: cuerpo({ ids }),
    }),

  crearPregunta: (
    id: string,
    datos: { etiqueta: string; tipo: TipoPregunta; seccionId?: string; campoNucleo?: CampoNucleo },
  ) =>
    pedir<FormularioAdmin>(`/admin/formularios/${id}/preguntas`, {
      method: "POST",
      body: cuerpo(datos),
    }),

  actualizarPregunta: (preguntaId: string, datos: Record<string, unknown>) =>
    pedir<FormularioAdmin>(`/admin/formularios/preguntas/${preguntaId}`, {
      method: "PATCH",
      body: cuerpo(datos),
    }),

  reordenarPreguntas: (id: string, ids: string[]) =>
    pedir<FormularioAdmin>(`/admin/formularios/${id}/preguntas/orden`, {
      method: "PATCH",
      body: cuerpo({ ids }),
    }),

  crearOpcion: (preguntaId: string, datos: { etiqueta: string; valor?: string }) =>
    pedir<FormularioAdmin>(`/admin/formularios/preguntas/${preguntaId}/opciones`, {
      method: "POST",
      body: cuerpo(datos),
    }),

  actualizarOpcion: (opcionId: string, datos: { etiqueta?: string; archivada?: boolean }) =>
    pedir<FormularioAdmin>(`/admin/formularios/opciones/${opcionId}`, {
      method: "PATCH",
      body: cuerpo(datos),
    }),

  eliminarOpcion: (opcionId: string) =>
    pedir<FormularioAdmin>(`/admin/formularios/opciones/${opcionId}`, { method: "DELETE" }),

  reordenarOpciones: (preguntaId: string, ids: string[]) =>
    pedir<FormularioAdmin>(`/admin/formularios/preguntas/${preguntaId}/opciones/orden`, {
      method: "PATCH",
      body: cuerpo({ ids }),
    }),
};

export const formularioPublico = (slug: string) =>
  pedir<FormularioPublico>(`/formularios/${slug}`);

export const TIPOS: Array<{ valor: TipoPregunta; etiqueta: string; ayuda: string }> = [
  { valor: "TEXTO_CORTO", etiqueta: "Texto corto", ayuda: "Una línea." },
  { valor: "TEXTO_LARGO", etiqueta: "Texto largo", ayuda: "Varias líneas." },
  { valor: "NUMERO", etiqueta: "Número", ayuda: "Solo cifras." },
  { valor: "CORREO", etiqueta: "Correo", ayuda: "Se valida el formato." },
  { valor: "TELEFONO", etiqueta: "Teléfono o celular", ayuda: "Abre el teclado numérico." },
  { valor: "FECHA", etiqueta: "Fecha", ayuda: "Con selector de calendario." },
  { valor: "SELECCION_UNICA", etiqueta: "Elegir una opción", ayuda: "Desplegable." },
  { valor: "SELECCION_MULTIPLE", etiqueta: "Elegir varias", ayuda: "Casillas múltiples." },
  { valor: "CASILLA", etiqueta: "Casilla de aceptación", ayuda: "Sí o no." },
  { valor: "PARRAFO", etiqueta: "Solo texto", ayuda: "No pide nada; muestra un aviso." },
];

export const LLEVA_OPCIONES: TipoPregunta[] = ["SELECCION_UNICA", "SELECCION_MULTIPLE"];
export const ES_TEXTO: TipoPregunta[] = ["TEXTO_CORTO", "TEXTO_LARGO", "CORREO", "TELEFONO"];
