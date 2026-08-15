/** Lo que se decide sobre los catálogos del SEP. */

import {
  CARACTERIZACIONES_SEP,
  DEPARTAMENTOS_SEP,
  GENEROS_SEP,
  MUNICIPIOS_SEP,
  NIVELES_OCUPACIONALES_SEP,
  RANGOS_EDAD_SEP,
  TAMANOS_EMPRESA_SEP,
  TIPOS_DOCUMENTO_SEP,
  type MunicipioSep,
  type ValorSep,
} from './catalogos-sep.generado';

export * from './catalogos-sep.generado';

const porId = <T extends ValorSep>(lista: T[]) => new Map(lista.map((v) => [v.id, v]));

export const TIPO_DOCUMENTO_POR_ID = porId(TIPOS_DOCUMENTO_SEP);
export const GENERO_POR_ID = porId(GENEROS_SEP);
export const NIVEL_OCUPACIONAL_POR_ID = porId(NIVELES_OCUPACIONALES_SEP);
export const RANGO_EDAD_POR_ID = porId(RANGOS_EDAD_SEP);
export const TAMANO_EMPRESA_POR_ID = porId(TAMANOS_EMPRESA_SEP);
export const CARACTERIZACION_POR_ID = porId(CARACTERIZACIONES_SEP);
export const DEPARTAMENTO_POR_ID = porId(DEPARTAMENTOS_SEP);
export const MUNICIPIO_POR_ID = new Map<number, MunicipioSep>(
  MUNICIPIOS_SEP.map((m) => [m[0], m]),
);

// que puede elegir cada quien

/// Tarjeta de identidad NO: un menor no entra a la
/// formación, y es decisión del cliente, no del SEP.
const TARJETA_DE_IDENTIDAD = 2;

/** Los que puede llevar un participante. */
export const DOCUMENTOS_DE_PERSONA = TIPOS_DOCUMENTO_SEP.filter(
  (t) => t.persona && t.id !== TARJETA_DE_IDENTIDAD,
);

/** Los que puede llevar la empresa donde labora. */
export const DOCUMENTOS_DE_EMPRESA = TIPOS_DOCUMENTO_SEP.filter((t) => t.empresa);

/// Cédula, tarjeta y NIT: solo dígitos. El resto admite
/// letras, que es lo que traen los documentos extranjeros.
const DOCUMENTOS_NUMERICOS = new Set([1, 2, 6]);

export function esDocumentoNumerico(tipoSepId: number): boolean {
  return DOCUMENTOS_NUMERICOS.has(tipoSepId);
}

const clave = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const ALIAS = new Map<string, number>();
for (const t of TIPOS_DOCUMENTO_SEP) {
  ALIAS.set(clave(t.sigla), t.id);
  ALIAS.set(clave(t.etiqueta), t.id);
}
/// Lo que la gente escribe de verdad en el Excel.
for (const [texto, id] of [
  ['CEDULA', 1],
  ['CEDULACIUDADANIA', 1],
  ['TARJETA', 2],
  ['TARJETAIDENTIDAD', 2],
  ['EXTRANJERIA', 3],
  ['CEDULAEXTRANJERIA', 3],
  ['PERMISOESPECIAL', 4],
  ['PERMISOPROTECCION', 61],
  ['PASAPORTE', 41],
  // el SEP lo llama "Pasaporte"; aqui se escribia PA
  ['PA', 41],
  ['NIT', 6],
  ['DNI', 81],
  ['RUT', 21],
] as Array<[string, number]>) {
  ALIAS.set(texto, id);
}

/** El id del SEP a partir de lo que alguien escribió. */
export function reconocerTipoDocumento(texto: string): number | null {
  return ALIAS.get(clave(texto)) ?? null;
}

/** La sigla, para mostrar junto al número. */
export function siglaDocumento(tipoSepId: number): string {
  return TIPO_DOCUMENTO_POR_ID.get(tipoSepId)?.sigla ?? '?';
}

// edad

/// Decisión del cliente: un menor no ingresa. El rango 1
/// del SEP existe pero aquí no se debe usar nunca.
export const EDAD_MINIMA = 18;

/** Años cumplidos, no la resta de años. */
export function edadCumplida(nacimiento: Date, ahora = new Date()): number {
  let edad = ahora.getFullYear() - nacimiento.getFullYear();
  const mes = ahora.getMonth() - nacimiento.getMonth();
  if (mes < 0 || (mes === 0 && ahora.getDate() < nacimiento.getDate())) edad -= 1;
  return edad;
}

/** El rango que el cargue pide junto a la edad. */
export function rangoEdadSep(edad: number): number {
  if (edad <= 17) return 1;
  if (edad <= 24) return 2;
  if (edad <= 30) return 3;
  if (edad <= 40) return 4;
  if (edad <= 55) return 5;
  return 6;
}

// otros valores del cargue

/// La salida para quien no quiere responder.
export const CARACTERIZACION_NINGUNA = 35;

/// En este proyecto no hay transferencia.
export const PERFIL_TRANSFERENCIA_NO_APLICA = { id: 4, etiqueta: 'NO APLICA' };

export const ESTRATO_MINIMO = 1;
export const ESTRATO_MAXIMO = 6;

// validación

/** Que el id exista en el catálogo. Nulo se admite. */
export function esValorValido(lista: ValorSep[], id: number | null | undefined): boolean {
  if (id === null || id === undefined) return true;
  return lista.some((v) => v.id === id);
}

/** El municipio existe y pertenece a ese departamento. */
export function municipioCuadra(
  departamentoId: number | null | undefined,
  municipioId: number | null | undefined,
): boolean {
  if (municipioId === null || municipioId === undefined) return true;
  const municipio = MUNICIPIO_POR_ID.get(municipioId);
  if (!municipio || !municipio[3]) return false;
  if (departamentoId === null || departamentoId === undefined) return true;
  return municipio[1] === departamentoId;
}

/** Los de un departamento, en orden alfabético. */
export function municipiosDe(departamentoId: number): MunicipioSep[] {
  return MUNICIPIOS_SEP.filter((m) => m[1] === departamentoId && m[3]).sort((a, b) =>
    a[2].localeCompare(b[2], 'es'),
  );
}
