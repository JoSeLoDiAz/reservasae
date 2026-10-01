/** La memoria de lo que ya se rechazó en «Por revisar». */

/// POR QUÉ EXISTE ESTO.
///
/// Descartar una propuesta cerraba la fila y nada más. Como la
/// limpieza previa a crear la siguiente solo borra las PENDIENTE,
/// y `fichaAPropuesta` solo compara contra lo que la ficha YA
/// tiene, descartar un teléfono dejaba el campo vacío --y
/// «vacío» era justo la condición para volver a proponer EL
/// MISMO teléfono--. La bandeja se rellenaba sola con lo ya
/// rechazado, que es la razón de fondo de que nunca bajara de 45.
///
/// Aquí está el lado que habla con la base; la normalización de
/// la clave vive en `ficha-a-propuesta.ts` (`claveDescarte`),
/// que es quien también filtra al proponer.

import type { FuenteDato, Prisma } from '../../../generated/prisma';
import type { PrismaService } from '../../prisma/prisma.service';
import { claveDescarte, textoDelValor } from './ficha-a-propuesta';

/// Lo mínimo que se necesita de Prisma. Se pide así --y no el
/// `PrismaService` entero-- para que esto valga igual dentro de
/// una transacción (`tx`) que fuera de ella.
export type ClienteDescartes = {
  descarteDeCampo: {
    findMany: (args: {
      where: { institucionId: string };
      select: { campo: true; valor: true };
    }) => Promise<Array<{ campo: string; valor: string }>>;
  };
};

/// Lo rechazado por esta institución, ya en forma de claves.
///
/// Se trae TODO lo de la ficha en una consulta en vez de
/// preguntar campo por campo: son catorce campos como máximo y
/// la tabla está indexada por institución, así que una lectura
/// sale más barata que catorce.
export async function cargarDescartes(
  prisma: ClienteDescartes,
  institucionId: string,
): Promise<Set<string>> {
  const filas = await prisma.descarteDeCampo.findMany({
    where: { institucionId },
    select: { campo: true, valor: true },
  });
  /// `valor` ya está normalizado en la base, así que la clave se
  /// arma a mano y no con `claveDescarte` (que normalizaría dos
  /// veces; es idempotente, pero dejarlo explícito evita que un
  /// cambio futuro en la normalización rompa las filas viejas en
  /// silencio).
  return new Set(filas.map((f) => `${f.campo}\u0000${f.valor}`));
}

/// Las filas que hay que crear para recordar un rechazo.
///
/// Devuelve datos en vez de escribir, para que quien llame
/// decida la transacción y el `skipDuplicates`: el mismo valor
/// se puede rechazar dos veces desde dos propuestas distintas y
/// eso no es un error, es la misma decisión repetida.
export function filasDeDescarte(
  institucionId: string,
  campos: Record<string, unknown>,
  fuente: FuenteDato,
  adminId: string | null,
): Prisma.DescarteDeCampoCreateManyInput[] {
  return Object.entries(campos).map(([campo, valor]) => ({
    institucionId,
    campo,
    valor: claveDescarte(campo, valor).split('\u0000')[1],
    valorMostrado: textoDelValor(valor),
    fuente,
    descartadoPorId: adminId,
  }));
}

/// Escribe la memoria del rechazo. `skipDuplicates` porque la
/// llave es (institución, campo, valor): repetir el rechazo no
/// añade información y no puede hacer fallar el descarte.
export async function recordarDescartes(
  prisma: Pick<PrismaService, 'descarteDeCampo'>,
  filas: Prisma.DescarteDeCampoCreateManyInput[],
): Promise<void> {
  if (filas.length === 0) return;
  await prisma.descarteDeCampo.createMany({
    data: filas,
    skipDuplicates: true,
  });
}
