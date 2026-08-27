/** El F7: las empresas que se le reportan al SENA. */

import type { FormatoColumna } from '../../tableros/exportar';
import { TAMANO_EMPRESA_POR_ID } from '../catalogos-sep';

/**
 * A diferencia de los otros dos, este NO va por persona:
 * una fila es una organización dentro de una acción de
 * formación, con cuántos de los suyos se están formando.
 *
 * Los títulos son el contrato y van literales: la J lleva
 * un espacio delante y la P un salto de línea dentro, tal
 * como venían en el archivo del cliente.
 */
export const COLUMNAS: Array<{
  titulo: string;
  clave: string;
  formato?: FormatoColumna;
  ancho?: number;
}> = [
  { titulo: '#', clave: 'numero', formato: 'entero' },
  { titulo: 'NOMBRE DE LA ACCIÓN DE FORMACIÓN', clave: 'accion', ancho: 60 },
  { titulo: 'NOMBRE EMPRESA', clave: 'empresa', ancho: 40 },
  { titulo: 'NIT', clave: 'nit', formato: 'entero' },
  { titulo: 'DV', clave: 'dv' },
  { titulo: 'DEPARTAMENTO SEDE DE LA EMPRESA', clave: 'departamento', ancho: 24 },
  { titulo: 'MUNICIPIO SEDE DE LA EMPRESA', clave: 'municipio', ancho: 24 },
  { titulo: 'DIRECCIÓN', clave: 'direccion', ancho: 40 },
  { titulo: 'TELÉFONO', clave: 'telefono' },
  { titulo: ' NOMBRE PERSONA DE CONTACTO', clave: 'contactoNombre', ancho: 30 },
  { titulo: 'CARGO PERSONA DE CONTACTO', clave: 'contactoCargo', ancho: 24 },
  { titulo: 'CORREO ELECTRÓNICO', clave: 'contactoCorreo', ancho: 32 },
  { titulo: 'TAMAÑO DE LA EMPRESA', clave: 'tamano', ancho: 40 },
  {
    titulo: 'NÚMERO DE TRABAJADORES TOTALES DE LA EMPRESA',
    clave: 'trabajadores',
    formato: 'entero',
  },
  {
    titulo: 'NÚMERO DE BENEFICIARIOS DEL PFCE DE LA  EMPRESA',
    clave: 'beneficiarios',
    formato: 'entero',
  },
  {
    titulo:
      'EMPRESA/GREMIO\n(Conviniente/Beneficiaria/Perteneciente a la Cadena Productiva',
    clave: 'papel',
    ancho: 30,
  },
  { titulo: 'SECTOR ECONÓMICO AL QUE PERTENECE', clave: 'sector', ancho: 24 },
  { titulo: 'CLASIFICACIÓN DE LA EMPRESA', clave: 'clasificacion', ancho: 24 },
];

export type FilaF7 = {
  accion: string;
  empresa: {
    razonSocial: string;
    nit: string;
    digitoVerificacion: string | null;
    departamento: string | null;
    municipio: string | null;
    direccion: string | null;
    telefono: string | null;
    contactoNombre: string | null;
    contactoCargo: string | null;
    contactoCorreo: string | null;
    tamanoSepId: number | null;
    numeroTrabajadores: number | null;
    papelEnConvenio: string | null;
    sectorEconomico: string | null;
    clasificacion: string | null;
  };
  beneficiarios: number;
};

/**
 * Una fila del F7, con el tipo escrito.
 *
 * El tipo no es adorno: sin el, `TAMANO_EMPRESA_POR_ID.get()`
 * devolvia el objeto entero del catalogo y la columna «TAMAÑO
 * DE LA EMPRESA» salia con `[object Object]` en las 18 filas.
 * Compilaba porque el retorno era inferido, asi que la unica
 * forma de que no vuelva es declararlo.
 */
export type CeldasF7 = {
  numero: number;
  accion: string;
  empresa: string;
  nit: number;
  dv: string;
  departamento: string;
  municipio: string;
  direccion: string;
  telefono: string;
  contactoNombre: string;
  contactoCargo: string;
  contactoCorreo: string;
  tamano: string;
  trabajadores: number | '';
  beneficiarios: number;
  papel: string;
  sector: string;
  clasificacion: string;
};

export function fila(f: FilaF7, indice: number): CeldasF7 {
  const e = f.empresa;
  return {
    numero: indice + 1,
    accion: f.accion,
    empresa: e.razonSocial,
    // como numero para que Excel no lo parta ni lo alinee
    // a la izquierda; el DV va aparte y es texto
    nit: Number(e.nit),
    dv: e.digitoVerificacion ?? '',
    departamento: e.departamento ?? '',
    municipio: e.municipio ?? '',
    direccion: e.direccion ?? '',
    telefono: e.telefono ?? '',
    contactoNombre: e.contactoNombre ?? '',
    contactoCargo: e.contactoCargo ?? '',
    contactoCorreo: e.contactoCorreo ?? '',
    tamano: TAMANO_EMPRESA_POR_ID.get(e.tamanoSepId ?? -1)?.etiqueta ?? '',
    trabajadores: e.numeroTrabajadores ?? '',
    beneficiarios: f.beneficiarios,
    papel: e.papelEnConvenio ?? '',
    sector: e.sectorEconomico ?? '',
    clasificacion: e.clasificacion ?? '',
  };
}

/** Qué le falta a esta organización para poder reportarse. */
export function faltaEnF7(e: FilaF7['empresa']): string[] {
  const falta: string[] = [];
  if (!e.departamento || !e.municipio) falta.push('sin departamento o municipio de la sede');
  if (!e.direccion) falta.push('sin dirección');
  if (!e.telefono) falta.push('sin teléfono');
  if (!e.contactoNombre) falta.push('sin persona de contacto');
  if (!e.contactoCorreo) falta.push('sin correo de contacto');
  if (!e.tamanoSepId) falta.push('sin tamaño de empresa');
  if (!e.numeroTrabajadores) falta.push('sin número de trabajadores');
  if (!e.sectorEconomico) falta.push('sin sector económico');
  return falta;
}
