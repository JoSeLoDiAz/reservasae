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

/**
 * Los seis que se le ensenan a quien se inscribe.
 *
 * El catalogo del SEP trae diez para personas, y ocho de
 * ellos no los va a elegir nadie en esta convocatoria:
 * DNI, cedula de identidad, DPI y numero de seguridad
 * social son de otros paises. Un desplegable con diez
 * opciones donde solo valen seis se contesta mal.
 *
 * En orden de uso real, no por id.
 */
const ORDEN_DEL_FORMULARIO = [
  1, // C.C.
  3, // C.E.
  61, // P.P.T.
  4, // P.E.P.
  41, // Pasaporte
  5, // Otro
];

export const DOCUMENTOS_DEL_FORMULARIO = ORDEN_DEL_FORMULARIO.map(
  (id) => TIPOS_DOCUMENTO_SEP.find((t) => t.id === id)!,
).filter(Boolean);

/// La cedula es numerica y de diez digitos como maximo.
/// Los demas admiten letras: los documentos extranjeros
/// las traen, y rechazarlas deja a esa persona fuera.
export const DOCUMENTO_CEDULA = 1;
export const DOCUMENTO_OTRO = 5;

/**
 * Los tres sectores del Decreto 957 de 2019.
 *
 * No son las 21 secciones CIIU: son los tres con los que el
 * SEP ya clasifica el tamaño de la empresa. Si el sector se
 * capturara con la lista CIIU, no cuadraria con el tamaño
 * que se reporta al lado, y el SENA veria dos verdades.
 */
export const SECTORES_ECONOMICOS: ValorSep[] = [
  { id: 1, etiqueta: 'COMERCIO' },
  { id: 2, etiqueta: 'SERVICIOS' },
  { id: 3, etiqueta: 'MANUFACTURA' },
];

export const SECTOR_POR_ID = porId(SECTORES_ECONOMICOS);

/// El unico "otro" que admite el catalogo del SEP. Lo que
/// la persona escriba se guarda aparte y se le muestra,
/// pero al cargue viaja este id: no hay donde poner texto.
export const GENERO_NO_BINARIO = 3;

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

/**
 * Años cumplidos, no la resta de años.
 * En UTC a propósito: con la hora local, el contenedor
 * (UTC) y un portátil en Bogotá (UTC−5) dan edades
 * distintas el día del cumpleaños, y con la edad cambia
 * el rango que va al cargue.
 */
export function edadCumplida(nacimiento: Date, ahora = new Date()): number {
  let edad = ahora.getUTCFullYear() - nacimiento.getUTCFullYear();
  const mes = ahora.getUTCMonth() - nacimiento.getUTCMonth();
  if (mes < 0 || (mes === 0 && ahora.getUTCDate() < nacimiento.getUTCDate())) edad -= 1;
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

/** Los ids del SEP que puede traer una persona. */
export type IdsDePersona = {
  generoSepId?: number | null;
  departamentoSepId?: number | null;
  municipioSepId?: number | null;
  nivelOcupacionalSepId?: number | null;
};

/**
 * El motivo por el que un id no vale, o null si todos valen.
 *
 * Escrito una vez y usado por el panel y por las dos rutas
 * públicas. Estaba en el panel y no en las públicas, así que
 * la ruta del asesor rechazaba un género inventado y la del
 * ciudadano lo aceptaba: la pública era la MÁS permisiva de
 * las dos, al revés de como tiene que ser.
 *
 * `guardado` es lo que ya hay en la base, y es la mitad del
 * arreglo. La comprobación de que el municipio sea de su
 * departamento corría solo cuando llegaban los DOS campos, así
 * que partiendo la petición en dos entraba un par imposible —
 * y después la ficha contaba como completa, lista para el
 * cargue, con un municipio que no existe.
 */
export function motivoDeIdInvalido(
  dto: IdsDePersona,
  guardado?: { departamentoSepId?: number | null },
): string | null {
  for (const [lista, valor, que] of [
    [GENEROS_SEP, dto.generoSepId, 'género'],
    [NIVELES_OCUPACIONALES_SEP, dto.nivelOcupacionalSepId, 'nivel ocupacional'],
    [DEPARTAMENTOS_SEP, dto.departamentoSepId, 'departamento'],
  ] as const) {
    if (!esValorValido(lista as ValorSep[], valor)) {
      return `Ese ${que} no está en el catálogo del SEP.`;
    }
  }

  // el departamento que valdrá al terminar, no el que llegó
  const departamento = dto.departamentoSepId ?? guardado?.departamentoSepId;
  if (!municipioCuadra(departamento, dto.municipioSepId)) {
    return 'Ese municipio no pertenece a ese departamento.';
  }

  return null;
}

/** Los de un departamento, en orden alfabético. */
export function municipiosDe(departamentoId: number): MunicipioSep[] {
  return MUNICIPIOS_SEP.filter((m) => m[1] === departamentoId && m[3]).sort((a, b) =>
    a[2].localeCompare(b[2], 'es'),
  );
}

// tamano de organizacion

/**
 * Las cuatro tallas del Decreto 957 de 2019, y de donde salen.
 *
 * El SEP clasifica por INGRESOS Y SECTOR, no por numero de
 * empleados: sus doce valores son la talla cruzada con el sector
 * («GRANDE - COMERCIO», «MICROEMPRESA - SERVICIOS»…). La talla
 * es el primer segmento de la etiqueta, asi que se DERIVA del
 * catalogo y no se escribe un mapa de doce entradas al lado: un
 * mapa a mano y el catalogo generado acaban discrepando el dia
 * que el SEP anada un valor.
 *
 * Importa porque los dos proyectos comprometen un numero de
 * MIPYMES, y hasta hoy el corte de `/analisis` lo contaba con el
 * criterio de la Ley 590 original -- numero de empleados -- que
 * no es el mismo: una empresa de 8 personas y $30.000 millones
 * salia «Microempresa» y para el SEP es «Grande». El dato bueno
 * ya estaba en la base (`Empresa.tamanoSepId`, que es lo que
 * viaja al F7); simplemente nadie lo miraba aqui.
 */
export type Talla = 'Microempresa' | 'Pequeña' | 'Mediana' | 'Grande';

export const TALLAS: Talla[] = ['Microempresa', 'Pequeña', 'Mediana', 'Grande'];

/// Las tres primeras son mipyme; la cuarta no.
export const TALLAS_MIPYME: Talla[] = ['Microempresa', 'Pequeña', 'Mediana'];

/// La etiqueta del SEP dice PEQUEÑA y MICROEMPRESA.
const DEL_SEP: Record<string, Talla> = {
  MICROEMPRESA: 'Microempresa',
  PEQUEÑA: 'Pequeña',
  MEDIANA: 'Mediana',
  GRANDE: 'Grande',
};

const TALLA_POR_ID = new Map<number, Talla>(
  TAMANOS_EMPRESA_SEP.map((v) => {
    const cabeza = v.etiqueta.split('-')[0].trim().toUpperCase();
    return [v.id, DEL_SEP[cabeza]] as [number, Talla];
  }).filter(([, talla]) => talla !== undefined),
);

/**
 * Por empleados, que es el criterio VIEJO (Ley 590 de 2000).
 *
 * Se conserva solo como respaldo para las organizaciones que
 * todavia no han declarado su rango de ingresos, y el resultado
 * dice que viene de aqui: una cifra de mipymes mezclada con dos
 * criterios sin decirlo es la peor clase de cifra.
 */
function porEmpleados(colaboradores: number): Talla {
  if (colaboradores <= 10) return 'Microempresa';
  if (colaboradores <= 50) return 'Pequeña';
  if (colaboradores <= 200) return 'Mediana';
  return 'Grande';
}

export type Origen = 'DECRETO_957' | 'EMPLEADOS' | 'SIN_DATO';

/** La talla de una organizacion, diciendo con que criterio. */
export function tallaDeOrganizacion(empresa: {
  tamanoSepId?: number | null;
  numeroColaboradores?: number | null;
}): { talla: Talla | null; origen: Origen } {
  /// El id del SEP manda cuando esta: es el que el cliente
  /// declaro y el que viaja en el reporte, asi que la pantalla
  /// tiene que contar lo mismo que el archivo.
  const delSep = empresa.tamanoSepId ? TALLA_POR_ID.get(empresa.tamanoSepId) : undefined;
  if (delSep) return { talla: delSep, origen: 'DECRETO_957' };

  if (empresa.numeroColaboradores !== null && empresa.numeroColaboradores !== undefined) {
    return { talla: porEmpleados(empresa.numeroColaboradores), origen: 'EMPLEADOS' };
  }

  return { talla: null, origen: 'SIN_DATO' };
}
