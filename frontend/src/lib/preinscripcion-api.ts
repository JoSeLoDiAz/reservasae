/** Lo público: inscribirse y completar la propia ficha. */

import { ErrorApi } from "./api";
import { pedir } from "./pedir";

export type OfertaPublica = {
  id: string;
  ubicacion: string;
  /// CIUDAD cubre solo esa ciudad; DEPARTAMENTO cubre a todos
  /// los que viven en el, que es lo que hace virtual una oferta.
  tipo: "CIUDAD" | "DEPARTAMENTO";
  /// El departamento de la ciudad, o el suyo propio.
  departamento: string | null;
  modalidad: string;
  libres: number;
};

export type AccionPublica = {
  id: string;
  codigo: string;
  nombre: string;
  horas: number;
  modalidad: string;
  /// Lo que se lleva quien haga el curso. Se edita en
  /// el panel, en Formularios. Null mientras nadie lo escriba.
  resumen: string | null;
  ofertas: OfertaPublica[];
};

export type ValorSep = { id: number; etiqueta: string };

export type CatalogoPreinscripcion = {
  convenio: { id: string; slug: string; nombre: string; sigla: string | null };
  acciones: AccionPublica[];
  /// Solo lo que tiene alguna oferta abierta.
  ubicaciones: Array<{ departamento: string; ciudades: string[] }>;
  documentos: ValorSep[];
  generos: ValorSep[];
  /// El habeas data que hay que aceptar, entero. Null si el
  /// convenio todavia no tiene texto vigente.
  politica: { id: string; version: number; titulo: string; contenido: string } | null;
};

export type BusquedaNit = {
  nit: string;
  digitoVerificacion: string;
  instituciones: Array<{ id: string; nit: string; razonSocial: string }>;
  agrupaVarias: boolean;
};

export type DatosBasicos = {
  ofertaId: string;
  tipoDocumentoSepId: number;
  numeroDocumento: string;
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  generoSepId?: number;
  /// Lo que escribio cuando eligio "Otro". Al SEP viaja
  /// NO BINARIO; esto es solo para mostrarselo al asesor.
  generoOtroTexto?: string;
  celular?: string;
  correo?: string;
  /// El domicilio que eligio para ver la cobertura. Es el
  /// mismo que pide el SEP, asi que viaja desde aqui.
  departamentoNombre?: string;
  ciudadNombre?: string;
  /// Lo que autorizo en la pantalla de habeas data. Se
  /// guarda contra la version que leyo, no como un si suelto.
  aceptaPolitica?: boolean;
};

export type FichaAbierta = {
  expiraEn: string;
  convenio: { nombre: string; sigla: string | null };
  formacion: {
    codigo: string;
    nombre: string;
    horas: number;
    /// Decide qué se le dice al terminar: acceso o sede.
    modalidad: string;
    ubicacion: string | null;
  } | null;
  empresa: string | null;
  nitEmpresa: string | null;
  /** Si la nominó una empresa, no la cambia ella. */
  empresaFijada: boolean;
  /// Lo que le falta A LA EMPRESA. Vacío: no hay nada que
  /// preguntarle de su organización.
  faltaDeLaEmpresa: string[];
  cargoEnEmpresa: string | null;
  nivelOcupacionalSepId: number | null;
  beneficiarioPrevio: boolean | null;
  persona: Record<string, unknown> & {
    primerNombre: string;
    primerApellido: string;
    numeroDocumento: string;
  };
  yaAutorizo: boolean;
  politica: { id: string; version: number; titulo: string; contenido: string } | null;
  documentos: ValorSep[];
  generos: ValorSep[];
  /// Las 43 del SEP: población vulnerable. Es lo que el F7
  /// lleva y que hasta ahora nadie preguntaba.
  caracterizaciones: ValorSep[];
  /// Lo que esta persona ya marcó, para no preguntárselo en
  /// blanco si vuelve al enlace.
  caracterizacionesElegidas: number[];
  /// Dijo que prefiere no decirlo. No es lo mismo que no
  /// haber contestado.
  caracterizacionRechazada: boolean;
  nivelesOcupacionales: ValorSep[];
  departamentos: ValorSep[];
  /** [id, departamentoId, nombre]: se filtra sin pedir nada. */
  municipios: Array<[number, number, string]>;
};


export const preinscripcionApi = {
  /** El banco de NIT: trae la razón social. */
  buscarNit: (nit: string) => pedir<BusquedaNit>(`/directorio/nit/${nit}`),

  catalogo: (slug: string) => pedir<CatalogoPreinscripcion>(`/preinscripcion/${slug}`),

  registrar: (slug: string, datos: DatosBasicos) =>
    pedir<{ registrado: boolean; yaEstaba: boolean; token: string; expiraEn: string }>(
      `/preinscripcion/${slug}`,
      { method: "POST", body: JSON.stringify(datos) },
    ),

  abrir: (token: string) => pedir<FichaAbierta>(`/completar/${token}`),

  guardarPersona: (token: string, datos: Record<string, unknown>) =>
    pedir<{ guardado: boolean }>(`/completar/${token}`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

  guardarEmpresa: (token: string, datos: Record<string, unknown>) =>
    pedir<{ guardado: boolean; enlaceCerrado: boolean }>(`/completar/${token}/empresa`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

  cerrar: (token: string) =>
    pedir<{ cerrado: boolean }>(`/completar/${token}/cerrar`, { method: "POST" }),
};
