/** El maestro de organizaciones. */

import { ErrorApi } from "./api";
import { pedir } from "./pedir";

export type FuenteDato = "CARGA" | "RUES" | "WEB" | "HUMANO";

export type TamanoEmpresa = "MICROEMPRESA" | "PEQUENA" | "MEDIANA" | "GRANDE";

export type ClasificacionEmpresa =
  | "ASOCIACION"
  | "CENTRO_DESARROLLO_TECNOLOGICO"
  | "EMPRESA_ASOCIATIVA_DE_TRABAJO"
  | "EMPRESA_PRIVADA"
  | "EMPRESA_PUBLICA"
  | "ENTIDAD_ECONOMIA_SOLIDARIA"
  | "ENTIDAD_SIN_ANIMO_DE_LUCRO"
  | "ENTIDAD_TERRITORIAL"
  | "GREMIO"
  | "MIXTA";

export const ETIQUETA_FUENTE: Record<FuenteDato, string> = {
  CARGA: "Carga inicial",
  RUES: "Dato importado del RUES",
  WEB: "Dato importado desde la validación web",
  HUMANO: "Dato ingresado manualmente",
};

export const ETIQUETA_TAMANO: Record<TamanoEmpresa, string> = {
  MICROEMPRESA: "Microempresa",
  PEQUENA: "Pequeña",
  MEDIANA: "Mediana",
  GRANDE: "Grande",
};

/// Los rangos de la ley 590 de 2000, para poder avisar
/// cuando el numero de empleados no cuadra con el tamano.
export const TRABAJADORES_POR_TAMANO: Record<TamanoEmpresa, [number, number]> = {
  MICROEMPRESA: [1, 10],
  PEQUENA: [11, 50],
  MEDIANA: [51, 200],
  GRANDE: [201, Number.MAX_SAFE_INTEGER],
};

export const ETIQUETA_CLASIFICACION: Record<ClasificacionEmpresa, string> = {
  ASOCIACION: "Asociación",
  CENTRO_DESARROLLO_TECNOLOGICO: "Centro de Desarrollo Tecnológico (CDT)",
  EMPRESA_ASOCIATIVA_DE_TRABAJO: "Empresa asociativa de trabajo",
  EMPRESA_PRIVADA: "Empresa privada",
  EMPRESA_PUBLICA: "Empresa pública",
  ENTIDAD_ECONOMIA_SOLIDARIA: "Entidad de economía solidaria",
  ENTIDAD_SIN_ANIMO_DE_LUCRO: "Entidad sin ánimo de lucro",
  ENTIDAD_TERRITORIAL: "Entidad territorial — gobierno",
  GREMIO: "Gremio",
  MIXTA: "Mixta",
};

/// Como se llama cada campo en pantalla. Se usa tanto en la
/// ficha como en la bandeja de propuestas.
export const ETIQUETA_CAMPO: Record<string, string> = {
  razonSocial: "Razón social",
  nombreComercial: "Nombre comercial",
  fechaFundacion: "Fecha de fundación",
  direccion: "Dirección",
  telefono: "Teléfono",
  correo: "Correo",
  paginaWeb: "Página web",
  ciudadNombre: "Ciudad",
  departamentoNombre: "Departamento",
  tamano: "Tamaño",
  numeroEmpleados: "Número de empleados",
  clasificacion: "Clasificación",
  sectorEconomico: "Sector económico",
  codigoCiiu: "Código CIIU",
};

export type Institucion = {
  id: string;
  nit: string;
  razonSocial: string;
  nombreComercial: string | null;
  digitoDeclarado: string | null;
  fechaFundacion: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  paginaWeb: string | null;
  ciudadNombre: string | null;
  departamentoNombre: string | null;
  departamentoSepId: number | null;
  municipioSepId: number | null;
  tamano: TamanoEmpresa | null;
  numeroEmpleados: number | null;
  clasificacion: ClasificacionEmpresa | null;
  sectorEconomico: string | null;
  codigoCiiu: string | null;
  fuente: FuenteDato;
  /// Campo → de dónde salió.
  fuentePorCampo: Record<string, FuenteDato> | null;
  /// CUÁNTAS PERSONAS CUELGAN DE ESTA ORGANIZACIÓN.
  ///
  /// «Colocar otra columna que diga leads asociados, así se sabe si
  /// se puede o no» (cliente, 30 sep 2026), hablando de quitar del
  /// listado una organización que quedó vacía.
  ///
  /// `null` NO ES CERO: es «no se pidió la cuenta». Cero quiere decir
  /// que no le queda nadie ---y entonces se puede quitar---, y
  /// pintarlos igual sería dar permiso sin haber mirado.
  leads: number | null;
  verificadaEn: string | null;
  verificadaPor: { nombre: string } | null;
  /// Lo que le falta para poder reportarse al SENA.
  falta: string[];
  /// Lo que trajo un buscador y nadie ha confirmado.
  sinConfirmar: string[];
  reportable: boolean;
  _count?: { empresas: number; propuestas: number };
};

export type Propuesta = {
  id: string;
  campos: Record<string, unknown>;
  fuente: FuenteDato;
  creadoEn: string;
};

export type ConsultaRues = {
  id: string;
  estado: "PENDIENTE" | "EN_CURSO" | "LISTA" | "SIN_RESULTADO" | "FALLIDA";
  ultimoError: string | null;
  resueltaEn: string | null;
  creadoEn: string;
};

/// Una entrada del control de cambios.
export type CambioRegistrado = {
  id: string;
  actorNombre: string;
  accion: string;
  /// Campo: valor anterior → valor nuevo.
  resumen: string | null;
  camposTocados: string[];
  creadoEn: string;
};

export type FichaInstitucion = Institucion & {
  digitoVerificacion: string;
  historial: CambioRegistrado[];
  empresas: Array<{ id: string; razonSocial: string; _count: { participantes: number } }>;
  propuestas: Propuesta[];
  consultas: ConsultaRues[];
};

export type Listado = {
  instituciones: Institucion[];
  total: number;
  pagina: number;
  porPagina: number;
};

export type ResumenInstituciones = {
  total: number;
  verificadas: number;
  sinVerificar: number;
  incompletas: number;
  sugeridas: number;
  propuestas: number;
};

/// En que va la validacion por buscador web.
export type EstadoWeb = {
  /// Si el servidor tiene con que consultar.
  conectado: boolean;
  ultima: {
    estado: ConsultaRues["estado"];
    camposNuevos: number | null;
    ultimoError: string | null;
    creadoEn: string;
    resueltaEn: string | null;
  } | null;
};

/// Lo que devuelve quitar del listado o devolver a él. No trae la ficha
/// entera a propósito: la pantalla no la vuelve a pintar —la fila
/// desaparece— y el nombre sirve para decir qué pasó.
export type OrganizacionApartada = {
  id: string;
  razonSocial: string;
  activo: boolean;
};

export type PropuestaPendiente = Propuesta & {
  institucion: { id: string; nit: string; razonSocial: string };
};


export const institucionesApi = {
  listar: (filtros: {
    buscar?: string;
    incompletas?: boolean;
    sinVerificar?: boolean;
    sugeridos?: boolean;
    /// Las que se quitaron del listado, para poder devolverlas.
    ocultas?: boolean;
    pagina?: number;
  }) => {
    const q = new URLSearchParams();
    if (filtros.buscar) q.set("buscar", filtros.buscar);
    if (filtros.incompletas) q.set("incompletas", "1");
    if (filtros.sinVerificar) q.set("sinVerificar", "1");
    if (filtros.sugeridos) q.set("sugeridos", "1");
    if (filtros.ocultas) q.set("ocultas", "1");
    if (filtros.pagina && filtros.pagina > 1) q.set("pagina", String(filtros.pagina));
    const cola = q.toString();
    return pedir<Listado>(`/admin/instituciones${cola ? `?${cola}` : ""}`);
  },

  resumen: () => pedir<ResumenInstituciones>("/admin/instituciones/resumen"),

  pendientes: () => pedir<PropuestaPendiente[]>("/admin/instituciones/pendientes"),

  ver: (id: string) => pedir<FichaInstitucion>(`/admin/instituciones/${id}`),

  editar: (id: string, datos: Record<string, unknown>) =>
    pedir<Institucion>(`/admin/instituciones/${id}`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

  verificar: (id: string) =>
    pedir<Institucion>(`/admin/instituciones/${id}/verificar`, { method: "POST" }),

  desverificar: (id: string) =>
    pedir<Institucion>(`/admin/instituciones/${id}/desverificar`, { method: "POST" }),

  /// QUITAR DEL LISTADO, QUE NO ES BORRAR: la fila se queda con todo su
  /// historial —su NIT ya viajó al SENA en informes entregados— y solo
  /// deja de salir en «Empresas registradas».
  ///
  /// El servidor vuelve a contar los leads y se niega si le cuelga
  /// alguien, diciendo cuántos: la columna de la tabla puede estar vieja.
  ocultar: (id: string) =>
    pedir<OrganizacionApartada>(`/admin/instituciones/${id}/ocultar`, {
      method: "POST",
    }),

  /// Devolverla al listado. Sin condiciones: quitar por error tiene que
  /// poder desandarse.
  mostrar: (id: string) =>
    pedir<OrganizacionApartada>(`/admin/instituciones/${id}/mostrar`, {
      method: "POST",
    }),

  /// Que el buscador web vaya a mirar este NIT. No devuelve
  /// los datos: devuelve en que va la consulta. La respuesta
  /// llega despues, como propuesta, para que alguien la
  /// acepte campo por campo.
  validarWeb: (id: string) =>
    pedir<EstadoWeb>(`/admin/instituciones/${id}/validar-web`, { method: "POST" }),

  estadoWeb: (id: string) => pedir<EstadoWeb>(`/admin/instituciones/${id}/estado-web`),

  /// Cierra varias propuestas de un tirón sin tocar ninguna
  /// ficha. Es la salida de una bandeja atascada: de a una,
  /// cuarenta y cinco propuestas son cientos de clics.
  descartarPropuestas: (ids: string[]) =>
    pedir<{ descartadas: number; yaResueltas: number }>(
      "/admin/instituciones/propuestas/descartar",
      { method: "POST", body: JSON.stringify({ ids }) },
    ),

  /// ACEPTA TODOS LOS CAMPOS de esas propuestas: en lote no hay
  /// forma de elegir. Quien tiene que advertirlo es la pantalla,
  /// antes de confirmar.
  aceptarPropuestas: (ids: string[]) =>
    pedir<{
      aceptadas: number;
      aplicados: number;
      fallidas: Array<{ id: string; motivo: string }>;
    }>("/admin/instituciones/propuestas/aceptar", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  aplicarPropuesta: (id: string, campos: string[]) =>
    pedir<{ aplicados: number; descartados: number }>(
      `/admin/instituciones/propuestas/${id}/aplicar`,
      { method: "POST", body: JSON.stringify({ campos }) },
    ),
};
