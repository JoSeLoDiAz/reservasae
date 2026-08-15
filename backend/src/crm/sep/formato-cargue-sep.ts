/** El cargue masivo: 54 columnas. */

import type { FormatoColumna } from '../../tableros/exportar';
import { soloFecha } from '../../tableros/exportar';
import {
  CARACTERIZACION_POR_ID,
  DEPARTAMENTO_POR_ID,
  edadCumplida,
  MUNICIPIO_POR_ID,
  NIVEL_OCUPACIONAL_POR_ID,
  RANGO_EDAD_POR_ID,
  rangoEdadSep,
  TAMANO_EMPRESA_POR_ID,
  TIPO_DOCUMENTO_POR_ID,
} from '../catalogos-sep';
import type { FilaSep } from './datos';

export const COLUMNAS: Array<{
  titulo: string;
  clave: string;
  formato?: FormatoColumna;
  ancho?: number;
}> = [
  { titulo: 'NO.', clave: 'no', formato: 'entero' },
  { titulo: 'NOMBRE CONVINIENTE', clave: 'conviniente', ancho: 40 },
  { titulo: 'PROYECTO ID', clave: 'proyectoId', formato: 'entero' },
  { titulo: 'AF ID', clave: 'afId', formato: 'entero' },
  { titulo: 'ACCION DE FORMACION', clave: 'accion', ancho: 60 },
  { titulo: 'ID GRUPO', clave: 'grupoId', formato: 'entero' },
  { titulo: 'GRUPO', clave: 'grupo', formato: 'entero' },
  { titulo: 'TOTAL DE HORAS EVENTO', clave: 'horas', formato: 'entero' },
  { titulo: 'PERSONA ID', clave: 'personaId', formato: 'entero' },
  { titulo: 'POSTULACION 2025', clave: 'postulacion', formato: 'entero' },
  { titulo: 'TIPO IDENTIFICACION', clave: 'tipoDocumento', ancho: 30 },
  { titulo: 'ID TIPO DOCUMENTO', clave: 'tipoDocumentoId', formato: 'entero' },
  { titulo: 'NUMERODEIDENTIFICACION', clave: 'documento', formato: 'entero' },
  { titulo: 'NOMBRES', clave: 'nombres' },
  { titulo: 'PRIMER APELLIDO', clave: 'primerApellido' },
  { titulo: 'SEGUNDO APELLIDO', clave: 'segundoApellido' },
  { titulo: 'GENERO', clave: 'genero' },
  { titulo: 'ID GENERO', clave: 'generoId', formato: 'entero' },
  { titulo: 'ESTRATO SOCIO-ECONOMICO', clave: 'estrato', formato: 'entero' },
  { titulo: 'FECHA DE NACIMIENTO', clave: 'fechaNacimiento', formato: 'fecha' },
  { titulo: 'EDAD', clave: 'edad', formato: 'entero' },
  { titulo: 'ID RANGO', clave: 'rangoId', formato: 'entero' },
  { titulo: 'RANGO DE EDAD', clave: 'rango', ancho: 24 },
  { titulo: 'NUMERODECELULAR', clave: 'celular', formato: 'entero' },
  { titulo: 'CORREO', clave: 'correo', ancho: 32 },
  { titulo: 'CÓDIGO DEPARTAMENTO DE DOMICILIO', clave: 'departamentoId', formato: 'entero' },
  { titulo: 'DEPARTAMENTO DE DOMICILIO', clave: 'departamento', ancho: 28 },
  { titulo: 'CÓDIGO MUNICIPIO DOMICILIO', clave: 'municipioId', formato: 'entero' },
  { titulo: 'MUNICIPIO DOMICILIO', clave: 'municipio', ancho: 28 },
  { titulo: 'BARRIO/VEREDA', clave: 'barrio', ancho: 28 },
  { titulo: 'DIRECCION DOMICILIO', clave: 'direccion', ancho: 28 },
  { titulo: 'CÓDIGO CARACTERIZACION', clave: 'caracterizacionId', formato: 'entero' },
  { titulo: 'CARACTERIZACION', clave: 'caracterizacion', ancho: 36 },
  { titulo: 'TRANSFERENCIA', clave: 'transferencia' },
  { titulo: 'PERFIL DE TRANSFERENCIA', clave: 'perfil' },
  { titulo: 'PERFIL ID', clave: 'perfilId', formato: 'entero' },
  { titulo: 'EMPRESA ID', clave: 'empresaId', formato: 'entero' },
  {
    titulo: 'NÚMERO DE DOCUMENTO EMPRESA DONDE LABORA',
    clave: 'nitEmpresa',
    formato: 'entero',
  },
  { titulo: 'DV', clave: 'dv', formato: 'entero' },
  { titulo: 'NOMBRE EMPRESA DONDE LABORA', clave: 'empresa', ancho: 40 },
  { titulo: 'TAMAÑO EMPRESA DONDE LABORA', clave: 'tamano', ancho: 40 },
  { titulo: 'TAMAÑO EMP ID', clave: 'tamanoId', formato: 'entero' },
  { titulo: 'NIVEL OCUPACIONAL', clave: 'nivelOcupacional' },
  { titulo: 'NV ID', clave: 'nivelId', formato: 'entero' },
  { titulo: 'SE HA BENEFICIADO ANTERIORMENTE', clave: 'beneficiarioPrevio' },
  { titulo: 'CERTIFICA', clave: 'certifica' },
  { titulo: 'ESTADO INTERVENTORIA', clave: 'interventoria', ancho: 20 },
  { titulo: 'HORAS PRESENCIALES', clave: 'horasPresenciales', formato: 'entero' },
  { titulo: 'HORAS PAT', clave: 'horasPat', formato: 'entero' },
  { titulo: 'HORAS VIRTUALES', clave: 'horasVirtuales', formato: 'entero' },
  { titulo: 'HORAS HIBRIDAS', clave: 'horasHibridas', formato: 'entero' },
  { titulo: 'PORCENTAJE DE CUMPLIMIENTO', clave: 'cumplimiento', formato: 'entero' },
  { titulo: 'OBSERVACIONES', clave: 'observaciones', ancho: 30 },
  { titulo: 'ESTADO', clave: 'estado' },
];

const digitos = (v: string | null) => (v ?? '').replace(/\D/g, '');

const documentoParaExcel = (numero: string): string | number =>
  /^\d{1,15}$/.test(numero) && !numero.startsWith('0') ? Number(numero) : numero;

export function fila(p: FilaSep, indice: number, ano: number): Record<string, unknown> {
  const municipio = p.persona.municipioSepId
    ? MUNICIPIO_POR_ID.get(p.persona.municipioSepId)
    : null;

  // congelada contra la matricula: si se calcula al
  // exportar, la misma persona cambia de rango entre dos
  // cargues por haber cumplido anos
  const corte = p.participante.fechaMatricula ?? new Date();
  const edad = p.persona.fechaNacimiento
    ? edadCumplida(p.persona.fechaNacimiento, corte)
    : null;
  const rango = edad === null ? null : rangoEdadSep(edad);

  const celular = digitos(p.persona.celular);

  return {
    no: indice + 1,
    conviniente: p.convenio.sepNombreConviniente ?? p.convenio.nombre,
    proyectoId: p.convenio.sepProyectoId,
    afId: p.accion.sepAfId,
    accion: p.accion.nombre,
    grupoId: p.grupo.sepGrupoId,
    grupo: p.grupo.numero,
    horas: p.accion.horas,
    // los pone el cliente a mano despues de cargar
    personaId: '',
    postulacion: ano,
    tipoDocumento: TIPO_DOCUMENTO_POR_ID.get(p.persona.tipoDocumentoSepId)?.etiqueta ?? '',
    tipoDocumentoId: p.persona.tipoDocumentoSepId,
    documento: documentoParaExcel(p.persona.numeroDocumento),
    nombres: [p.persona.primerNombre, p.persona.segundoNombre].filter(Boolean).join(' '),
    primerApellido: p.persona.primerApellido,
    segundoApellido: p.persona.segundoApellido ?? '',
    genero: p.genero,
    generoId: p.persona.generoSepId,
    estrato: p.persona.estrato,
    fechaNacimiento: soloFecha(p.persona.fechaNacimiento),
    edad,
    rangoId: rango,
    rango: rango === null ? '' : (RANGO_EDAD_POR_ID.get(rango)?.etiqueta ?? ''),
    celular: celular.length === 10 ? Number(celular) : celular,
    correo: p.persona.correo ?? '',
    departamentoId: p.persona.departamentoSepId,
    departamento:
      DEPARTAMENTO_POR_ID.get(p.persona.departamentoSepId ?? -1)?.etiqueta ?? '',
    municipioId: p.persona.municipioSepId,
    municipio: municipio?.[2] ?? '',
    barrio: p.persona.barrio ?? '',
    direccion: p.persona.direccion ?? '',
    // vacias mientras no se capture: 35 = NINGUNA es una
    // declaracion de la persona, no la ausencia del dato
    caracterizacionId: p.caracterizacionSepId ?? '',
    caracterizacion: p.caracterizacionSepId
      ? (CARACTERIZACION_POR_ID.get(p.caracterizacionSepId)?.etiqueta ?? '')
      : '',
    transferencia: 'NO',
    perfil: 'NO APLICA',
    perfilId: 4,
    empresaId: '',
    nitEmpresa: p.empresa ? Number(p.empresa.nit) : '',
    dv: p.empresa?.digitoVerificacion ? Number(p.empresa.digitoVerificacion) : '',
    empresa: p.empresa?.razonSocial ?? '',
    tamano: p.empresa?.tamanoSepId
      ? (TAMANO_EMPRESA_POR_ID.get(p.empresa.tamanoSepId)?.etiqueta ?? '')
      : '',
    tamanoId: p.empresa?.tamanoSepId ?? '',
    nivelOcupacional:
      NIVEL_OCUPACIONAL_POR_ID.get(p.participante.nivelOcupacionalSepId ?? -1)?.etiqueta ??
      '',
    nivelId: p.participante.nivelOcupacionalSepId ?? '',
    beneficiarioPrevio: p.participante.beneficiarioPrevio ? 'S' : 'N',
    // el cierre es otro cargue: certificar aqui daria una
    // fila con 0 horas y 0 % que se contradice sola
    certifica: 'NO',
    interventoria: 'SIN VERIFICAR',
    horasPresenciales: 0,
    horasPat: 0,
    horasVirtuales: 0,
    horasHibridas: 0,
    cumplimiento: 0,
    observaciones: '',
    estado: 'ACTIVO',
  };
}
