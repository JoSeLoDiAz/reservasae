/** La plantilla que se descarga para que la llene la organización. */

/**
 * UNA HOJA POR PERSONA Y UNA POR ORGANIZACIÓN, CON LISTAS AMARRADAS.
 *
 * «No sé si se pueda que la hoja de Participantes tenga un desplegable
 * de la AF de interés… y que las columnas de acción, departamento y
 * ciudad estén de primeras» (cliente, 22 sep 2026). Lo que se llena una
 * vez --NIT, razón social y el jefe inmediato-- va en su propia hoja,
 * porque aplica a toda la lista.
 *
 * Las tres primeras columnas se amarran entre ellas con la MISMA lógica
 * del formulario de personas: la acción manda, y solo ofrece los
 * departamentos donde se dicta; el departamento solo ofrece sus
 * municipios, con los que tienen aula primero.
 *
 * LISTAS CON NOMBRE E INDIRECTO, y no un rango calculado con DESREF: es
 * el único método que enseña la flecha del desplegable en Excel, en
 * LibreOffice y en OpenOffice. En Google Sheets no hay listas que
 * dependan de otra celda sin programar, así que allí se llena a mano; el
 * sistema revisa igual al importar.
 *
 * Los títulos se leen por su NOMBRE al importar (ver
 * `columnas-de-carga.ts`), así que mover una columna no rompe nada.
 */

import ExcelJS from 'exceljs';

import {
  DEPARTAMENTO_POR_ID,
  DEPARTAMENTOS_SEP,
  EDAD_MINIMA,
  MUNICIPIOS_SEP,
  NIVELES_OCUPACIONALES_SEP,
  DOCUMENTOS_DE_PERSONA,
} from './catalogos-sep';
import { ROTULOS_DE_ORGANIZACION } from './carga-archivo';
import { llano } from './columnas-de-carga';

/** Lo que hace falta saber del convenio para armarla. */
export type DatosDePlantilla = {
  /** Una por acción, con su etiqueta («AF3 · NOMBRE») y dónde se dicta. */
  acciones: Array<{ etiqueta: string; departamentos: number[] }>;
  /** Municipios que son sede de alguna oferta: van primero en su lista. */
  municipiosConAula: number[];
};

/** El género, tal como lo pidió el cliente: tres opciones y «Otro». */
export const GENEROS_DE_PLANTILLA = ['MASCULINO', 'FEMENINO', 'OTRO'];


/// El código de la acción, que es lo que ata su lista de departamentos:
/// «AF3 · NOMBRE» -> «AF3».
function codigo(etiqueta: string): string {
  return etiqueta.split(/\s/)[0].toUpperCase();
}

type Columna = {
  t: string;
  ancho: number;
  /** Parte el texto dentro de la celda en vez de derramarlo. */
  ajusta?: boolean;
  /** Se guarda como texto: un documento no es un número. */
  texto?: boolean;
  fecha?: boolean;
};

/// El orden lo pidió el cliente: primero qué quiere estudiar y dónde
/// vive --lo que manda en las listas-- y después quién es.
export const COLUMNAS_DE_CARGA: Columna[] = [
  { t: 'Acción de formación de interés', ancho: 46, ajusta: true },
  { t: 'Departamento', ancho: 20 },
  { t: 'Ciudad o municipio', ancho: 24 },
  { t: 'Tipo de documento', ancho: 24 },
  { t: 'Número de documento', ancho: 20, texto: true },
  { t: 'Primer nombre', ancho: 16 },
  { t: 'Segundo nombre', ancho: 16 },
  { t: 'Primer apellido', ancho: 16 },
  { t: 'Segundo apellido', ancho: 16 },
  { t: 'Fecha de nacimiento', ancho: 18, fecha: true },
  { t: 'Género', ancho: 14 },
  { t: 'Correo electrónico', ancho: 30, ajusta: true },
  { t: 'Teléfono celular', ancho: 16, texto: true },
  { t: 'Barrio o vereda', ancho: 18, ajusta: true },
  { t: 'Dirección', ancho: 26, ajusta: true },
  { t: 'Estrato socioeconómico', ancho: 12 },
  { t: 'Cargo en la organización', ancho: 22, ajusta: true },
  { t: 'Nivel ocupacional', ancho: 18 },
  { t: '¿Se ha beneficiado antes?', ancho: 14 },
];

/// Cuántas filas llevan lista y formato. 500: una reserva grande son
/// decenas, y el tope de la importación son 1.000 por tanda.
/// `dataValidations` existe en exceljs pero no en sus tipos.
type ConReglas = { dataValidations: { add(rango: string, regla: unknown): void } };
const reglas = (h: ExcelJS.Worksheet) => (h as unknown as ConReglas).dataValidations;

const FILAS = 500;
const VERDE = 'FF0B5D55';

/** El municipio o el departamento de una ubicación de oferta. */
export function lugarDeUbicacion(
  nombre: string,
  departamento: string | null,
): { departamentoSepId: number; municipioSepId: number | null } | null {
  const u = llano(nombre);
  const porNombre = (d: { etiqueta: string }) => llano(d.etiqueta);
  const depto =
    DEPARTAMENTOS_SEP.find((d) => porNombre(d) === u) ??
    DEPARTAMENTOS_SEP.find((d) => porNombre(d).startsWith(u) || u.startsWith(porNombre(d)));
  if (depto) return { departamentoSepId: depto.id, municipioSepId: null };

  const candidatos = MUNICIPIOS_SEP.filter((m) => llano(m[2]) === u);
  const suyo = departamento
    ? candidatos.find((m) => {
        const d = DEPARTAMENTO_POR_ID.get(m[1]);
        return d ? llano(d.etiqueta) === llano(departamento) : false;
      })
    : undefined;
  const m = suyo ?? candidatos[0];
  return m ? { departamentoSepId: m[1], municipioSepId: m[0] } : null;
}

export async function libroDePlantilla(datos: DatosDePlantilla): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hp = libro.addWorksheet('Participantes', { views: [{ state: 'frozen', ySplit: 1 }] });
  const org = libro.addWorksheet('Organización');
  /// `veryHidden`: las listas no son para mirarlas, y una hoja oculta a
  /// medias invita a escribir en ella.
  const li = libro.addWorksheet('Listas', { state: 'veryHidden' });

  const orden = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });
  const acciones = [...datos.acciones].sort((a, b) => orden(a.etiqueta, b.etiqueta));
  const conAula = new Set(datos.municipiosConAula);
  const deptosUsados = [...new Set(acciones.flatMap((a) => a.departamentos))]
    .map((id) => DEPARTAMENTO_POR_ID.get(id))
    .filter((d): d is { id: number; etiqueta: string; seleccionable: boolean } => Boolean(d))
    .sort((a, b) => orden(a.etiqueta, b.etiqueta));

  // ── las listas ──────────────────────────────────────────
  const columna = (letra: string, titulo: string, valores: string[]) => {
    li.getCell(`${letra}1`).value = titulo;
    valores.forEach((v, i) => (li.getCell(`${letra}${i + 2}`).value = v));
    return `Listas!$${letra}$2:$${letra}$${Math.max(valores.length + 1, 2)}`;
  };
  const rAcciones = columna('A', 'Acciones', acciones.map((a) => a.etiqueta));

  li.getCell('B1').value = 'Departamentos por acción';
  let fila = 2;
  for (const a of acciones) {
    const nombres = a.departamentos
      .map((id) => DEPARTAMENTO_POR_ID.get(id)?.etiqueta)
      .filter((x): x is string => Boolean(x))
      .sort(orden);
    if (nombres.length === 0) continue;
    const desde = fila;
    for (const nombre of nombres) li.getCell(`B${fila++}`).value = nombre;
    libro.definedNames.add(`Listas!$B$${desde}:$B$${fila - 1}`, `DEP_${codigo(a.etiqueta)}`);
  }

  li.getCell('D1').value = 'Departamento';
  li.getCell('E1').value = 'Codigo';
  deptosUsados.forEach((d, i) => {
    li.getCell(`D${i + 2}`).value = d.etiqueta;
    li.getCell(`E${i + 2}`).value = d.id;
  });
  const rDeptos = `Listas!$D$2:$E$${Math.max(deptosUsados.length + 1, 2)}`;

  li.getCell('F1').value = 'Municipios por departamento';
  fila = 2;
  for (const d of deptosUsados) {
    const todos = MUNICIPIOS_SEP.filter((m) => m[1] === d.id);
    const conSede = todos.filter((m) => conAula.has(m[0])).map((m) => m[2]).sort(orden);
    const resto = todos.filter((m) => !conAula.has(m[0])).map((m) => m[2]).sort(orden);
    const desde = fila;
    for (const nombre of [...conSede, ...resto]) li.getCell(`F${fila++}`).value = nombre;
    if (fila > desde) libro.definedNames.add(`Listas!$F$${desde}:$F$${fila - 1}`, `MUN_${d.id}`);
  }

  /// Lo que dice el desplegable cuando todavía no hay de dónde sacar la
  /// lista. Sin esto salía «#¡REF!» y «#N/D», que el cliente leyó como
  /// un error del archivo.
  li.getCell('N1').value = 'Avisos';
  li.getCell('N2').value = 'Primero elija la acción de formación';
  li.getCell('N3').value = 'Primero elija el departamento';
  libro.definedNames.add('Listas!$N$2', 'DEP_');
  libro.definedNames.add('Listas!$N$3', 'MUN_');

  const rDoc = columna('H', 'Documento', DOCUMENTOS_DE_PERSONA.map((t) => t.etiqueta));
  const rGen = columna('I', 'Genero', GENEROS_DE_PLANTILLA);
  const rNiv = columna('J', 'Nivel', NIVELES_OCUPACIONALES_SEP.map((n) => n.etiqueta));
  const rEst = columna('K', 'Estrato', ['1', '2', '3', '4', '5', '6']);
  const rSiNo = columna('L', 'SiNo', ['Sí', 'No']);

  // ── la hoja de participantes ────────────────────────────
  const LETRA: Record<string, string> = {};
  COLUMNAS_DE_CARGA.forEach((c, i) => (LETRA[c.t] = String.fromCharCode(65 + i)));
  hp.addRow(COLUMNAS_DE_CARGA.map((c) => c.t));

  COLUMNAS_DE_CARGA.forEach((col, i) => {
    hp.getColumn(i + 1).width = col.ancho;
    const c = hp.getCell(1, i + 1);
    /// El color SOLO en las columnas que hay: pintando la fila entera la
    /// franja seguía hasta el infinito. Y el título en UN renglón: con
    /// ajuste de texto, «¿Se ha beneficiado antes?» se partía en tres y
    /// el último quedaba cortado.
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
    for (let r = 2; r <= FILAS + 1; r += 1) {
      const celda = hp.getCell(r, i + 1);
      if (col.texto) celda.numFmt = '@';
      if (col.fecha) celda.numFmt = 'dd/mm/yyyy';
      celda.alignment = { vertical: 'top', wrapText: Boolean(col.ajusta) };
    }
  });
  hp.getRow(1).height = 24;

  const lista = (titulo: string, formula: string, rotulo: string, texto: string) => {
    const letra = LETRA[titulo];
    reglas(hp).add(`${letra}2:${letra}${FILAS + 1}`, {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: rotulo,
      error: texto,
    });
  };
  const A = LETRA['Acción de formación de interés'];
  const D = LETRA.Departamento;
  const F = LETRA['Fecha de nacimiento'];

  lista('Tipo de documento', rDoc, 'Tipo de documento', 'Elija un tipo de documento de la lista.');
  lista('Género', rGen, 'Género', 'Elija Masculino, Femenino u Otro.');
  lista('Acción de formación de interés', rAcciones, 'Acción de formación', 'Elija una acción de formación de la lista.');
  lista(
    'Departamento',
    `INDIRECT(IFERROR("DEP_"&LEFT($${A}2,FIND(" ",$${A}2&" ")-1),"DEP_"))`,
    'Departamento',
    'Elija primero la acción de formación: aquí salen solo los departamentos donde se dicta.',
  );
  lista(
    'Ciudad o municipio',
    `INDIRECT(IFERROR("MUN_"&VLOOKUP($${D}2,${rDeptos},2,0),"MUN_"))`,
    'Ciudad o municipio',
    'Elija primero el departamento: aquí salen solo sus ciudades y municipios.',
  );
  lista('Estrato socioeconómico', rEst, 'Estrato', 'El estrato va de 1 a 6.');
  lista('Nivel ocupacional', rNiv, 'Nivel ocupacional', 'Elija un valor de la lista.');
  lista('¿Se ha beneficiado antes?', rSiNo, '¿Se ha beneficiado antes?', 'Responda Sí o No.');

  /// MAYOR DE EDAD: hasta hoy menos los años que exige el programa. Sin
  /// tope se escribía el año en curso por descuido y la persona salía
  /// con meses de edad. Regla de FÓRMULA y no de tipo fecha: la de fecha
  /// no admite fórmulas al escribirla, y esta la leen igual Excel,
  /// LibreOffice y Google Sheets.
  reglas(hp).add(`${F}2:${F}${FILAS + 1}`, {
    type: 'custom',
    allowBlank: true,
    formulae: [`AND(ISNUMBER(${F}2),${F}2>=DATE(1930,1,1),${F}2<=EDATE(TODAY(),-${EDAD_MINIMA * 12}))`],
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: 'Fecha de nacimiento',
    error: `La persona debe ser mayor de ${EDAD_MINIMA} años. Escriba su fecha de nacimiento, por ejemplo 15/03/1990.`,
  });

  // ── la hoja de la organización ──────────────────────────
  org.addRow(['Dato', 'Respuesta']);
  for (const col of [1, 2]) {
    const c = org.getCell(1, col);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { vertical: 'middle' };
  }
  org.getRow(1).height = 24;
  /// EN BLANCO a propósito: un NIT de ejemplo olvidado ahí vincularía
  /// toda la carga con una organización que no existe.
  for (const rotulo of ROTULOS_DE_ORGANIZACION) org.addRow([rotulo, '']);
  org.getColumn(1).width = 30;
  org.getColumn(2).width = 46;
  for (let r = 2; r <= ROTULOS_DE_ORGANIZACION.length + 1; r += 1) {
    org.getCell(`A${r}`).font = { bold: true };
    org.getCell(`B${r}`).numFmt = '@';
  }

  return Buffer.from(await libro.xlsx.writeBuffer());
}
