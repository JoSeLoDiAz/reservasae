/** El arnés de las pruebas del cargue: un .xlsx de verdad y una base de mentira. */

/**
 * SE CONSTRUYE UN .xlsx DE VERDAD, no se simula el lector.
 *
 * Simularlo dejaría sin probar justo lo que más se rompe: que el
 * rótulo «Nro documento» se reconozca, que el título de arriba no
 * se lea como una persona, que una celda con un número no llegue
 * como `3001112222.0`. Todo eso lo decide exceljs y el lector
 * juntos, y con un lector de mentira las pruebas pasarían con el
 * de verdad roto.
 *
 * Fichero sin `.spec` a propósito: `testRegex` solo corre los
 * `*.spec.ts`, así que esto no se ejecuta como prueba.
 */

import ExcelJS from 'exceljs';

import { Prisma } from '../../../generated/prisma';

/// El prototipo de `PrismaClientKnownRequestError`, para que el
/// `instanceof` del servicio reconozca el error de la carrera.
///
/// Hace falta porque el servicio distingue ese caso de los demás
/// con un `instanceof`, y un objeto suelto con `code: 'P2002'` no
/// lo pasaría: la prueba diría que el cargue falla con ese choque
/// cuando en producción se recupera, o al revés.
const PRISMA_CONOCIDO = Prisma.PrismaClientKnownRequestError.prototype;

/** Un libro con una hoja, a partir de filas de texto. */
export async function hojaDeExcel(filas: unknown[][]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Hoja1');
  for (const fila of filas) hoja.addRow(fila);
  return Buffer.from(await libro.xlsx.writeBuffer());
}

export type LeadDeMentira = {
  id: string;
  externoId: string;
  origenSistema?: string;
  estado: string;
  participanteId: string | null;
  nombreCompleto: string | null;
  primerNombre: string | null;
  segundoNombre: string | null;
  primerApellido: string | null;
  segundoApellido: string | null;
  correo: string | null;
  celular: string | null;
  tipoDocumentoSepId: number | null;
  numeroDocumento: string | null;
  interes: string | null;
  accionFormacionId: string | null;
  departamentoSepId: number | null;
  municipioSepId: number | null;
  origen: string;
  motivo?: string | null;
};

/** Un lead guardado con todo en null menos lo que se diga. */
export function leadGuardado(
  parcial: Partial<LeadDeMentira> & { id: string },
): LeadDeMentira {
  return {
    externoId: `llave-de-${parcial.id}`,
    origenSistema: 'meta',
    estado: 'PENDIENTE',
    participanteId: null,
    nombreCompleto: null,
    primerNombre: null,
    segundoNombre: null,
    primerApellido: null,
    segundoApellido: null,
    correo: null,
    celular: null,
    tipoDocumentoSepId: null,
    numeroDocumento: null,
    interes: null,
    accionFormacionId: null,
    departamentoSepId: null,
    municipioSepId: null,
    origen: 'FACEBOOK',
    motivo: null,
    ...parcial,
  };
}

export type BaseDeMentira = {
  prisma: unknown;
  /// Lo que se escribió, en orden. Las pruebas miran esto: es la
  /// diferencia entre «la vista previa no escribe» y «la vista
  /// previa escribe y nadie lo nota».
  creados: Array<Record<string, unknown>>;
  actualizados: Array<{ id: string; data: Record<string, unknown> }>;
  notas: Array<Record<string, unknown>>;
  /// Los `where` que salieron hacia Prisma. Es lo único que
  /// distingue «el ámbito ACOTA» de «el filtro lo SUSTITUYE», y esa
  /// distinción ya falló dos veces en este repositorio.
  dondes: unknown[];
};

/**
 * Una base de mentira con los leads que ya están.
 *
 * `findMany` devuelve TODOS los que se le dieron y no filtra por el
 * `where`: lo que se prueba aquí es el cruce en memoria
 * ---`aQuienYaTeniamos`--- y filtrar también aquí probaría dos
 * veces lo mismo y taparía un cruce mal escrito. El acotado al
 * convenio tiene su propia prueba, que mira el `where`.
 */
export function baseDeMentira(
  yaEstan: LeadDeMentira[],
  opciones: {
    acciones?: Array<{ id: string; codigo: string; visible: boolean }>;
    /// Para probar que una fila mala no tumba el cargue: el número
    /// de fila del Excel que tiene que reventar al crearse.
    revientaEnLaFila?: number;
    /// Para probar la carrera: la fila en la que `create` lanza un
    /// P2002 porque otro cargue se adelantó.
    seAdelantanEnLaFila?: number;
  } = {},
): BaseDeMentira {
  const creados: Array<Record<string, unknown>> = [];
  const actualizados: Array<{ id: string; data: Record<string, unknown> }> = [];
  const notas: Array<Record<string, unknown>> = [];
  const dondes: unknown[] = [];
  let n = 0;

  const leadEntrante = {
    findMany: (a: { where?: unknown }) => {
      dondes.push(a.where);
      return Promise.resolve(yaEstan);
    },
    create: (a: { data: Record<string, unknown>; select?: unknown }) => {
      n += 1;
      const fila = (a.data.carga as { fila?: number } | undefined)?.fila;
      if (opciones.revientaEnLaFila && fila === opciones.revientaEnLaFila) {
        return Promise.reject(
          new Error('null value in column "convenioId" violates not-null'),
        );
      }
      if (
        opciones.seAdelantanEnLaFila &&
        fila === opciones.seAdelantanEnLaFila
      ) {
        /// El mismo objeto que lanza Prisma: lleva `code`, y el
        /// servicio distingue por `code` y no por el mensaje.
        const e = Object.assign(new Error('Unique constraint failed'), {
          code: 'P2002',
          clientVersion: '6',
          name: 'PrismaClientKnownRequestError',
        });
        Object.setPrototypeOf(e, PRISMA_CONOCIDO);
        return Promise.reject(e);
      }
      creados.push(a.data);
      return Promise.resolve({
        ...leadGuardado({ id: `nuevo-${n}` }),
        ...a.data,
      });
    },
    update: (a: { where: { id: string }; data: Record<string, unknown> }) => {
      actualizados.push({ id: a.where.id, data: a.data });
      return Promise.resolve({ id: a.where.id });
    },
    findUnique: (a: { where: { origenSistema_externoId?: unknown } }) => {
      /// El que ganó la carrera: se finge que es un lead que ya
      /// está con esa misma llave.
      const llave = (
        a.where.origenSistema_externoId as { externoId: string } | undefined
      )?.externoId;
      return Promise.resolve(
        llave ? leadGuardado({ id: 'el-que-gano', externoId: llave }) : null,
      );
    },
  };

  const prisma = {
    convenio: {
      findFirst: (a: { where?: unknown }) => {
        dondes.push(a.where);
        return Promise.resolve({
          id: 'conv-adecopria',
          slug: 'adecopria',
          acciones: opciones.acciones ?? [
            { id: 'af1-adecopria', codigo: 'AF1', visible: true },
          ],
        });
      },
    },
    leadEntrante,
    notaDeGestion: {
      create: (a: { data: Record<string, unknown> }) => {
        notas.push(a.data);
        return Promise.resolve({ id: `nota-${notas.length}` });
      },
    },
    /// La transacción se ejecuta con el MISMO objeto: lo que se
    /// prueba es qué se escribe, no que Postgres sepa abrirla.
    $transaction: <T>(fn: (tx: unknown) => Promise<T>) => fn(prisma),
  };

  return { prisma, creados, actualizados, notas, dondes };
}
