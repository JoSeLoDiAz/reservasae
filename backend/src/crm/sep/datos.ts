/** La forma de una fila del reporte, ya resuelta. */

export type FilaSep = {
  participante: {
    id: string;
    etapa: string;
    cargoEnEmpresa: string | null;
    nivelOcupacionalSepId: number | null;
    beneficiarioPrevio: boolean | null;
    fechaMatricula: Date | null;
  };
  persona: {
    id: string;
    tipoDocumentoSepId: number;
    numeroDocumento: string;
    primerNombre: string;
    segundoNombre: string | null;
    primerApellido: string;
    segundoApellido: string | null;
    fechaNacimiento: Date | null;
    correo: string | null;
    celular: string | null;
    generoSepId: number | null;
    estrato: number | null;
    departamentoSepId: number | null;
    municipioSepId: number | null;
    barrio: string | null;
    direccion: string | null;
  };
  convenio: {
    sepProyectoId: number | null;
    sepNombreConviniente: string | null;
    nombre: string;
    sigla: string | null;
  };
  accion: {
    codigo: string;
    nombre: string;
    sepAfId: number | null;
    horas: number | null;
  };
  grupo: { numero: number; sepGrupoId: number | null };
  /**
   * LA ORGANIZACIÓN COMPLETA, no solo lo que pide el cargue.
   *
   * Llevaba cinco campos ---los que gastan las 54 columnas--- y el
   * F7 se armaba con una consulta aparte. Dos consultas con dos
   * filtros distintos sobre lo mismo es como los dos archivos que
   * se entregan juntos al SENA acabaron contradiciéndose: el cargue
   * mandaba 2 personas de una empresa y el F7 decía 3.
   *
   * Ahora el F7 sale de estas mismas filas, así que aquí tiene que
   * venir todo lo que él reporta de la empresa. `id` incluido: es
   * con lo que se agrupa, porque dos organizaciones pueden
   * compartir razón social y no son la misma.
   */
  empresa: {
    id: string;
    nit: string;
    digitoVerificacion: string | null;
    razonSocial: string;
    tamanoSepId: number | null;
    tipoDocumentoSepId: number | null;
    departamentoSepId: number | null;
    municipioSepId: number | null;
    direccion: string | null;
    telefono: string | null;
    contactoNombre: string | null;
    contactoCargo: string | null;
    contactoCorreo: string | null;
    numeroTrabajadores: number | null;
    papelEnConvenio: string | null;
    sectorEconomico: string | null;
    clasificacion: string | null;
  } | null;
  /// La etiqueta del género, resuelta aparte porque el
  /// catálogo del SEP la escribe en mayúsculas y el
  /// reporte la lleva en tipo título.
  genero: string;
  /// Nula mientras no se capture: no se rellena con 35.
  caracterizacionSepId: number | null;
};

/// El catálogo dice MASCULINO; el reporte, Masculino.
export const GENERO_EN_EL_REPORTE: Record<number, string> = {
  1: 'Masculino',
  2: 'Femenino',
  3: 'No binario',
};
