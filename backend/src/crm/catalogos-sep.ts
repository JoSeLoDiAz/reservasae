/** Los catálogos del SEP, tal como los devuelve su base. */

import { TipoDocumento } from '../../generated/prisma';

export type ValorSep = { id: number; etiqueta: string };

/// Los ids del SEP para departamento y ciudad SON los
/// códigos DANE (5 = Antioquia, 5001 = Medellín), así que
/// no hace falta tabla de equivalencia: basta la columna.

export type DepartamentoSep = ValorSep & {
  /// NINGUNO y NACIONAL son centinelas del SEP.
  seleccionable: boolean;
};

export const DEPARTAMENTOS_SEP: DepartamentoSep[] = [
  { id: 1, etiqueta: 'NINGUNO', seleccionable: false },
  { id: 5, etiqueta: 'ANTIOQUIA', seleccionable: true },
  { id: 8, etiqueta: 'ATLÁNTICO', seleccionable: true },
  { id: 11, etiqueta: 'BOGOTÁ D.C', seleccionable: true },
  { id: 13, etiqueta: 'BOLÍVAR', seleccionable: true },
  { id: 15, etiqueta: 'BOYACÁ', seleccionable: true },
  { id: 17, etiqueta: 'CALDAS', seleccionable: true },
  { id: 18, etiqueta: 'CAQUETÁ', seleccionable: true },
  { id: 19, etiqueta: 'CAUCA', seleccionable: true },
  { id: 20, etiqueta: 'CESAR', seleccionable: true },
  { id: 23, etiqueta: 'CÓRDOBA', seleccionable: true },
  { id: 25, etiqueta: 'CUNDINAMARCA', seleccionable: true },
  { id: 27, etiqueta: 'CHOCÓ', seleccionable: true },
  { id: 41, etiqueta: 'HUILA', seleccionable: true },
  { id: 44, etiqueta: 'LA GUAJIRA', seleccionable: true },
  { id: 47, etiqueta: 'MAGDALENA', seleccionable: true },
  { id: 50, etiqueta: 'META', seleccionable: true },
  { id: 52, etiqueta: 'NARIÑO', seleccionable: true },
  { id: 54, etiqueta: 'NORTE DE SANTANDER', seleccionable: true },
  { id: 63, etiqueta: 'QUINDIO', seleccionable: true },
  { id: 66, etiqueta: 'RISARALDA', seleccionable: true },
  { id: 68, etiqueta: 'SANTANDER', seleccionable: true },
  { id: 70, etiqueta: 'SUCRE', seleccionable: true },
  { id: 73, etiqueta: 'TOLIMA', seleccionable: true },
  { id: 76, etiqueta: 'VALLE DEL CAUCA', seleccionable: true },
  { id: 81, etiqueta: 'ARAUCA', seleccionable: true },
  { id: 85, etiqueta: 'CASANARE', seleccionable: true },
  { id: 86, etiqueta: 'PUTUMAYO', seleccionable: true },
  { id: 88, etiqueta: 'ARCHIPIÉLAGO DE SAN', seleccionable: true },
  { id: 91, etiqueta: 'AMAZONAS', seleccionable: true },
  { id: 94, etiqueta: 'GUAINÍA', seleccionable: true },
  { id: 95, etiqueta: 'GUAVIARE', seleccionable: true },
  { id: 97, etiqueta: 'VAUPÉS', seleccionable: true },
  { id: 99, etiqueta: 'VICHADA', seleccionable: true },
  { id: 100, etiqueta: 'NACIONAL', seleccionable: false },
];

export const GENEROS_SEP: ValorSep[] = [
  { id: 1, etiqueta: 'MASCULINO' },
  { id: 2, etiqueta: 'FEMENINO' },
  { id: 3, etiqueta: 'NO BINARIO' },
];

export const NIVELES_OCUPACIONALES_SEP: ValorSep[] = [
  { id: 1, etiqueta: 'ALTA DIRECCIÓN' },
  { id: 2, etiqueta: 'MEDIO' },
  { id: 3, etiqueta: 'OPERATIVO' },
];

/// Decreto 957 de 2019: por INGRESOS y por SECTOR, no por
/// número de empleados. Por eso son doce y no cuatro.
export type TamanoEmpresaSep = ValorSep & {
  tamano: 'MICROEMPRESA' | 'PEQUEÑA' | 'MEDIANA' | 'GRANDE';
  sector: 'MANUFACTURA' | 'SERVICIOS' | 'COMERCIO';
};

export const TAMANOS_EMPRESA_SEP: TamanoEmpresaSep[] = [
  { id: 1, tamano: 'GRANDE', sector: 'COMERCIO', etiqueta: 'GRANDE - COMERCIO (SUPERIOR A $104.600.300.908)' },
  { id: 2, tamano: 'GRANDE', sector: 'SERVICIOS', etiqueta: 'GRANDE - SERVICIOS (SUPERIOR A $24.054.610.166)' },
  { id: 3, tamano: 'GRANDE', sector: 'MANUFACTURA', etiqueta: 'GRANDE - MANUFACTURA (SUPERIOR A $86.479.200.435)' },
  { id: 4, tamano: 'MEDIANA', sector: 'COMERCIO', etiqueta: 'MEDIANA - COMERCIO (SUPERIOR A $21.473.129.604 Y HASTA $104.600.300.908)' },
  { id: 41, tamano: 'MEDIANA', sector: 'MANUFACTURA', etiqueta: 'MEDIANA - MANUFACTURA (SUPERIOR A $10.208.546.005 Y HASTA $86.479.200.435)' },
  { id: 42, tamano: 'MEDIANA', sector: 'SERVICIOS', etiqueta: 'MEDIANA - SERVICIOS (SUPERIOR A $6.571.027.849 Y HASTA $24.054.610.166)' },
  { id: 43, tamano: 'MICROEMPRESA', sector: 'MANUFACTURA', etiqueta: 'MICROEMPRESA - MANUFACTURA (HASTA $1.173.413.837)' },
  { id: 44, tamano: 'MICROEMPRESA', sector: 'SERVICIOS', etiqueta: 'MICROEMPRESA - SERVICIOS (HASTA $1.642.769.412)' },
  { id: 45, tamano: 'MICROEMPRESA', sector: 'COMERCIO', etiqueta: 'MICROEMPRESA - COMERCIO (HASTA $2.229.451.431)' },
  { id: 46, tamano: 'PEQUEÑA', sector: 'MANUFACTURA', etiqueta: 'PEQUEÑA - MANUFACTURA (SUPERIOR A $1.173.413.837 Y HASTA $10.208.546.005)' },
  { id: 47, tamano: 'PEQUEÑA', sector: 'SERVICIOS', etiqueta: 'PEQUEÑA - SERVICIOS (SUPERIOR A $1.642.769.412 Y HASTA $6.571.027.489)' },
  { id: 48, tamano: 'PEQUEÑA', sector: 'COMERCIO', etiqueta: 'PEQUEÑA - COMERCIO (SUPERIOR A $2.229.451.431 Y HASTA $21.473.129.604)' },
];

/// El SEP marca a qué sirve cada documento: los de empresa
/// no valen para una persona y al revés.
export type TipoDocumentoSep = ValorSep & {
  sigla: string;
  persona: boolean;
  empresa: boolean;
};

export const TIPOS_DOCUMENTO_SEP: TipoDocumentoSep[] = [
  { id: 1, etiqueta: 'Cédula de Ciudadanía', sigla: 'C.C.', persona: true, empresa: false },
  { id: 2, etiqueta: 'Tarjeta de Identidad', sigla: 'T.I.', persona: true, empresa: false },
  { id: 3, etiqueta: 'Cédula de Extranjería', sigla: 'C.E.', persona: true, empresa: false },
  { id: 4, etiqueta: 'Permiso Especial de Permanencia', sigla: 'P.E.P.', persona: true, empresa: false },
  { id: 5, etiqueta: 'Otro', sigla: 'O.T.', persona: true, empresa: true },
  { id: 6, etiqueta: 'Nit', sigla: 'N.I.T.', persona: false, empresa: true },
  { id: 7, etiqueta: 'Nis', sigla: 'N.I.S.', persona: false, empresa: true },
  { id: 21, etiqueta: 'RUT', sigla: 'R.U.T.', persona: false, empresa: true },
  { id: 41, etiqueta: 'Pasaporte', sigla: 'Pasaporte', persona: true, empresa: false },
  { id: 61, etiqueta: 'Permiso por Protección Temporal', sigla: 'P.P.T', persona: true, empresa: false },
  { id: 81, etiqueta: 'Documento Nacional de Identidad', sigla: 'D.N.I', persona: true, empresa: false },
  { id: 82, etiqueta: 'Cédula de Identidad', sigla: 'C.I', persona: true, empresa: false },
  { id: 101, etiqueta: 'Documento Personal de Identificación', sigla: 'D.P.I', persona: true, empresa: false },
  { id: 121, etiqueta: 'Número De Seguridad Social', sigla: 'N.S.S', persona: true, empresa: false },
  { id: 141, etiqueta: 'EIN', sigla: 'E.I.N.', persona: false, empresa: true },
];

/**
 * Nuestro enum contra el id del SEP.
 * `RC` (registro civil) NO tiene equivalente: un menor
 * identificado así no se puede reportar.
 */
export const DOCUMENTO_A_SEP: Record<TipoDocumento, number | null> = {
  CC: 1,
  TI: 2,
  CE: 3,
  PEP: 4,
  PPT: 61,
  PA: 41,
  NIT: 6,
  OTRO: 5,
  RC: null,
};

const porId = <T extends ValorSep>(lista: T[]) => new Map(lista.map((v) => [v.id, v]));

export const DEPARTAMENTO_POR_ID = porId(DEPARTAMENTOS_SEP);
export const GENERO_POR_ID = porId(GENEROS_SEP);
export const NIVEL_OCUPACIONAL_POR_ID = porId(NIVELES_OCUPACIONALES_SEP);
export const TAMANO_EMPRESA_POR_ID = porId(TAMANOS_EMPRESA_SEP);
export const TIPO_DOCUMENTO_POR_ID = porId(TIPOS_DOCUMENTO_SEP);

/** Que el valor exista en el catálogo, o no entra. */
export function esValorValido(lista: ValorSep[], id: number | null | undefined): boolean {
  if (id === null || id === undefined) return true;
  return lista.some((v) => v.id === id);
}
