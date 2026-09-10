/** El reporte de uso directo: 27 columnas. */

import type { FormatoColumna } from '../../tableros/exportar';
import { soloFecha } from '../../tableros/exportar';
import {
  CARACTERIZACION_POR_ID,
  DEPARTAMENTO_POR_ID,
  MUNICIPIO_POR_ID,
  NIVEL_OCUPACIONAL_POR_ID,
  TAMANO_EMPRESA_POR_ID,
  TIPO_DOCUMENTO_POR_ID,
} from '../catalogos-sep';
import type { FilaSep } from './datos';

/// El titulo es el contrato: va literal, con su tilde y
/// con el espacio final de "Estrato socio-economico ".
export const COLUMNAS: Array<{
  titulo: string;
  clave: string;
  formato?: FormatoColumna;
  ancho?: number;
}> = [
  { titulo: 'AF', clave: 'af' },
  { titulo: 'Nombre AF', clave: 'nombreAf', ancho: 60 },
  { titulo: 'Grupo', clave: 'grupo' },
  { titulo: 'Tipo de identificación del Beneficiario', clave: 'tipoDocumento', ancho: 32 },
  { titulo: 'Número de identificación', clave: 'documento', formato: 'entero' },
  { titulo: 'Nombres', clave: 'nombres' },
  { titulo: '1 Apellidos', clave: 'primerApellido' },
  { titulo: '2 Apellidos', clave: 'segundoApellido' },
  { titulo: 'Género', clave: 'genero' },
  { titulo: 'Estrato socio-económico ', clave: 'estrato', formato: 'entero' },
  { titulo: 'Fecha de nacimiento', clave: 'fechaNacimiento', formato: 'fecha' },
  { titulo: 'Número de Celular', clave: 'celular', formato: 'entero' },
  { titulo: 'Departamento', clave: 'departamento' },
  { titulo: 'Ciudad', clave: 'ciudad' },
  { titulo: 'Correo', clave: 'correo', ancho: 32 },
  { titulo: 'Barrio / Vereda', clave: 'barrio', ancho: 28 },
  { titulo: 'Dirección', clave: 'direccion', ancho: 28 },
  { titulo: 'Se ha beneficiado anteriormente', clave: 'beneficiarioPrevio' },
  { titulo: 'NIT de la empresa', clave: 'nit', formato: 'entero' },
  { titulo: 'Dígito de verificación', clave: 'dv', formato: 'entero' },
  { titulo: 'Nombre de la empresa', clave: 'empresa', ancho: 40 },
  { titulo: 'Tamaño empresa', clave: 'tamanoEmpresa', ancho: 40 },
  {
    titulo: 'Marca de caracterización de población a la que pertenece',
    clave: 'caracterizacion',
    ancho: 36,
  },
  { titulo: 'Nivel ocupacional', clave: 'nivelOcupacional' },
  { titulo: 'Cargo', clave: 'cargo', ancho: 28 },
  { titulo: 'Transferencia', clave: 'transferencia' },
  { titulo: 'Perfil de Transferencia', clave: 'perfilTransferencia' },
];

/// Solo digitos: el celular puede venir con +57 o guiones.
const digitos = (v: string | null) => (v ?? '').replace(/\D/g, '');

/// Un numero si son solo digitos, y texto si no: un
/// pasaporte con letras en una celda numerica se pierde.
const documentoParaExcel = (numero: string): string | number =>
  /^\d{1,15}$/.test(numero) && !numero.startsWith('0') ? Number(numero) : numero;

export function fila(p: FilaSep): Record<string, unknown> {
  const municipio = p.persona.municipioSepId
    ? MUNICIPIO_POR_ID.get(p.persona.municipioSepId)
    : null;
  const celular = digitos(p.persona.celular);

  return {
    af: p.accion.codigo,
    nombreAf: p.accion.nombre,
    grupo: `${p.accion.codigo}.G${p.grupo.numero}`,
    tipoDocumento: TIPO_DOCUMENTO_POR_ID.get(p.persona.tipoDocumentoSepId)?.etiqueta ?? '',
    documento: documentoParaExcel(p.persona.numeroDocumento),
    nombres: [p.persona.primerNombre, p.persona.segundoNombre].filter(Boolean).join(' '),
    primerApellido: p.persona.primerApellido,
    segundoApellido: p.persona.segundoApellido ?? '',
    genero: p.genero,
    estrato: p.persona.estrato,
    fechaNacimiento: soloFecha(p.persona.fechaNacimiento),
    celular: celular.length === 10 ? Number(celular) : celular,
    departamento:
      DEPARTAMENTO_POR_ID.get(p.persona.departamentoSepId ?? -1)?.etiqueta ?? '',
    ciudad: municipio?.[2] ?? '',
    correo: p.persona.correo ?? '',
    barrio: p.persona.barrio ?? '',
    direccion: p.persona.direccion ?? '',
    beneficiarioPrevio: p.participante.beneficiarioPrevio ? 'si' : 'no',
    nit: p.empresa ? Number(p.empresa.nit) : '',
    dv: p.empresa?.digitoVerificacion ? Number(p.empresa.digitoVerificacion) : '',
    empresa: p.empresa?.razonSocial ?? '',
    tamanoEmpresa: p.empresa?.tamanoSepId
      ? (TAMANO_EMPRESA_POR_ID.get(p.empresa.tamanoSepId)?.etiqueta ?? '')
      : '',
    // hoy no se captura: va vacia, nunca "NINGUNA", que
    // seria afirmar por la persona algo que no dijo
    caracterizacion: p.caracterizacionSepId
      ? (CARACTERIZACION_POR_ID.get(p.caracterizacionSepId)?.etiqueta ?? '')
      : '',
    nivelOcupacional:
      NIVEL_OCUPACIONAL_POR_ID.get(p.participante.nivelOcupacionalSepId ?? -1)?.etiqueta ??
      '',
    cargo: p.participante.cargoEnEmpresa ?? '',
    transferencia: 'NO',
    perfilTransferencia: 'NO APLICA',
  };
}
