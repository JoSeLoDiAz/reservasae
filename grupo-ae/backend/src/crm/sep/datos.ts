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
  accion: { codigo: string; nombre: string; sepAfId: number | null; horas: number | null };
  grupo: { numero: number; sepGrupoId: number | null };
  empresa: {
    nit: string;
    digitoVerificacion: string | null;
    razonSocial: string;
    tamanoSepId: number | null;
    tipoDocumentoSepId: number | null;
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
