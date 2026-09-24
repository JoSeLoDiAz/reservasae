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
  ///
  /// YA NO SE PINTA en la tarjeta: lo sustituyen los tres textos de
  /// abajo, detrás de «Más información» (cliente, 13 sep 2026). El
  /// campo se conserva porque el texto guardado sigue en la base.
  resumen: string | null;
  /// «Información Acción de Formación»: lo que se abre con «Más
  /// información». Los tres pueden venir vacíos —hay quince acciones
  /// y estos textos se escriben a mano—, y si los tres faltan el
  /// botón no se pinta.
  objetivo: string | null;
  contenido: string | null;
  competencia: string | null;
  ofertas: OfertaPublica[];
};

export type ValorSep = { id: number; etiqueta: string };

export type CatalogoPreinscripcion = {
  convenio: { id: string; slug: string; nombre: string; sigla: string | null };
  acciones: AccionPublica[];
  /// Solo lo que tiene alguna oferta abierta.
  /// `ciudades` son TODOS los municipios del departamento --ahi
  /// se dice donde se vive-- y `sedes` las que ademas tienen
  /// clase presencial.
  ubicaciones: Array<{
    departamento: string;
    ciudades: string[];
    sedes: string[];
  }>;
  documentos: ValorSep[];
  generos: ValorSep[];
  /// El habeas data que hay que aceptar, entero. Null si el
  /// convenio todavia no tiene texto vigente.
  politica: { id: string; version: number; titulo: string; contenido: string } | null;
  /// Que formulario es este. Null --lo normal-- es el general.
  /// Lo decide el servidor: la palabra del enlace por si sola no
  /// significa nada hasta que el la reconoce.
  formulario: {
    palabra: string;
    titulo: string;
    /// Trae una sola accion, ya elegida. Con esto la pantalla
    /// quita los textos de escoger: no hay entre que escoger.
    accionUnica: boolean;
    /// El tercero que acompana esta convocatoria, para la banda
    /// de arriba. Null en los que no llevan ninguno.
    aliado: { nombre: string; logo: string } | null;
  } | null;
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
  /// La visita que mide el embudo. Opaca, sin datos de nadie.
  visita?: string;
  /// La palabra del formulario por el que entro. Es la llave que
  /// deja registrar en una accion sin publicar, asi que el
  /// servidor la vuelve a comprobar; mandarla no basta.
  formulario?: string;
};

export type FichaAbierta = {
  expiraEn: string;
  /// `telefono` es el del gremio, y se usa en el aviso del
  /// domicilio: sin número, «comuníquese con un asesor» no lleva
  /// a ninguna parte.
  convenio: { nombre: string; sigla: string | null; telefono: string | null };
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
  /// Lo que le falta con la MISMA regla del panel.
  faltaDeLaPersona: string[];
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

  catalogo: (slug: string, formulario?: string) =>
    pedir<CatalogoPreinscripcion>(
      `/preinscripcion/${slug}` +
        (formulario ? `?f=${encodeURIComponent(formulario)}` : ""),
    ),

  registrar: (slug: string, datos: DatosBasicos) =>
    /// `token` es NULL cuando el documento ya estaba registrado: el
    /// enlace abre la ficha entera de esa persona y quien llena el
    /// formulario puede ser cualquiera que se sepa una cédula. En
    /// ese caso llega `mensaje` con lo que hay que decirle. El tipo
    /// decía `string` y la pantalla lo creyó: armaba
    /// `/completar/null` (visto en producción el 11 sep 2026).
    pedir<{
      registrado: boolean;
      yaEstaba: boolean;
      token: string | null;
      expiraEn: string | null;
      mensaje?: string;
    }>(
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
