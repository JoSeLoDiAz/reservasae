/**
 * LAS SEIS DEL AULA: UT1..UT5 y EVAL FINAL.
 *
 * «Son solo 6 actividades que traerá el LMS, y es lo que importa;
 * las 12 no aplican para este módulo» (cliente, 24 sep 2026). Lo
 * dijo tres veces, y la tercera ---«pero es que son 6 actividades
 * que debe tener, o sea piensa de verdad»--- fue la que dio en el
 * clavo: el problema no era cómo se contaba, era el DATO.
 *
 * `prueba.ts` siembra doce actividades genéricas por acción
 * ---«Unidad 1 — Conceptos fundamentales», «Taller práctico 1»,
 * «Foro: casos de mi empresa»...--- de las cuales nueve son
 * obligatorias. De ahí salía el «6 de 9» del cajón, el «% avance» y
 * el estado de cada quien, mientras la tabla enseñaba seis columnas
 * UT en raya porque ningún título casaba. Dos listas para la misma
 * cosa, y la que mandaba era la equivocada.
 *
 * Esto pone la buena. Solo en los CURSOS ---por `evento`, que es
 * donde vive la regla: un foro o un bootcamp no tienen unidades
 * temáticas--- y solo en la base de pruebas.
 *
 * NO BORRA NADA, y eso importa: las seis que sobran se DESPUBLICAN.
 * Las personas ya tienen avances apuntando a ellas, y borrarlas se
 * llevaría por delante el historial de quien hizo el taller 2.
 * Despublicadas dejan de contar para el avance y siguen ahí, que es
 * la regla de la casa: ocultar, nunca eliminar.
 *
 * Y RENOMBRA en vez de crear: si se crearan seis nuevas, los avances
 * existentes quedarían colgando de las viejas y todo el mundo
 * aparecería en cero. Renombrando, quien llevaba cuatro actividades
 * sigue llevando cuatro, ahora con el nombre que el LMS va a usar.
 */

import { PrismaClient, TipoActividad } from '../../generated/prisma';
import { exigirBaseSegura } from '../guardia-de-base';
import { soloEnPruebas } from './solo-pruebas';

const prisma = new PrismaClient();

/**
 * Las seis, en su orden, tal como el cliente las dictó.
 *
 * Las CINCO UT son las unidades temáticas y EVAL FINAL es la
 * evaluación de cierre. Todas obligatorias: las seis cuentan para el
 * avance, que es justo lo que las distinguía de las doce de antes
 * ---allí tres eran de adorno---.
 */
const LAS_SEIS: Array<[string, TipoActividad]> = [
  ['UT1', TipoActividad.LECCION],
  ['UT2', TipoActividad.LECCION],
  ['UT3', TipoActividad.LECCION],
  ['UT4', TipoActividad.LECCION],
  ['UT5', TipoActividad.LECCION],
  ['EVAL FINAL', TipoActividad.EVALUACION],
];

async function main() {
  exigirBaseSegura('El arreglo de las actividades del aula');
  soloEnPruebas('db:actividades-del-aula');

  /// SOLO LOS CURSOS. La regla va por `evento` y no por el código de
  /// la acción: los códigos AF se repiten entre convenios y no
  /// significan lo mismo ---el foro es AF8 en un gremio y AF7 en el
  /// otro---, así que una lista de códigos a mano se equivoca de
  /// gremio sin que nada falle.
  const cursos = await prisma.accionFormacion.findMany({
    where: { evento: 'CURSO' },
    select: { id: true, codigo: true, nombre: true },
    orderBy: { codigo: 'asc' },
  });
  console.log(`  ${cursos.length} cursos\n`);

  let renombradas = 0;
  let ocultadas = 0;
  let creadas = 0;

  for (const curso of cursos) {
    const suyas = await prisma.actividad.findMany({
      where: { accionFormacionId: curso.id },
      orderBy: { orden: 'asc' },
      select: { id: true, orden: true, titulo: true },
    });

    /// LOS ÓRDENES SE LIBERAN PRIMERO.
    ///
    /// `@@unique([accionFormacionId, orden])`: si se reescribe la
    /// tercera como orden 1 estando la primera todavía en el 1,
    /// Postgres la rechaza. Se corren todas a un rango que no
    /// estorba y desde ahí se colocan.
    ///
    /// ARRIBA Y NO EN NEGATIVO: hay un `CHECK` en la tabla
    /// ---`actividades_orden_positivo`--- que exige que el orden sea
    /// positivo, y el primer intento se estrelló contra él. Mil es
    /// más que cualquier curso real y menos que cualquier desborde.
    const APARCADERO = 1000;
    for (const a of suyas) {
      await prisma.actividad.update({
        where: { id: a.id },
        data: { orden: APARCADERO + a.orden },
      });
    }

    for (const [i, [titulo, tipo]] of LAS_SEIS.entries()) {
      const vieja = suyas[i];
      if (vieja) {
        await prisma.actividad.update({
          where: { id: vieja.id },
          data: {
            orden: i + 1,
            titulo,
            tipo,
            obligatoria: true,
            publicada: true,
            /// La evaluación pesa más que una unidad: es el mismo
            /// reparto que traía la siembra.
            ponderacion: tipo === TipoActividad.EVALUACION ? 30 : 14,
          },
        });
        renombradas += 1;
      } else {
        /// Un curso con menos de seis: se le completan. Pasa con los
        /// que se cargaron a mano.
        await prisma.actividad.create({
          data: {
            accionFormacionId: curso.id,
            orden: i + 1,
            titulo,
            tipo,
            obligatoria: true,
            publicada: true,
            ponderacion: tipo === TipoActividad.EVALUACION ? 30 : 14,
          },
        });
        creadas += 1;
      }
    }

    /// LAS QUE SOBRAN: despublicadas, no borradas. Siguen con su
    /// título de antes y con los avances que alguien les hizo; lo
    /// único que cambia es que dejan de contar.
    const sobran = suyas.slice(LAS_SEIS.length);
    for (const [i, a] of sobran.entries()) {
      await prisma.actividad.update({
        where: { id: a.id },
        data: {
          orden: LAS_SEIS.length + i + 1,
          publicada: false,
          obligatoria: false,
        },
      });
      ocultadas += 1;
    }

    console.log(
      `  · ${curso.codigo} — ${LAS_SEIS.length} publicadas, ${sobran.length} ocultas`,
    );
  }

  console.log(
    `\n✓ ${renombradas} renombradas, ${creadas} creadas, ${ocultadas} ocultas`,
  );

  /// LA COMPROBACIÓN, sobre lo que quedó: si alguna acción no tiene
  /// exactamente seis obligatorias publicadas, esto no sirvió y hay
  /// que verlo ahora y no en la pantalla.
  const cuenta = await prisma.actividad.groupBy({
    by: ['accionFormacionId'],
    where: {
      publicada: true,
      obligatoria: true,
      accionFormacion: { evento: 'CURSO' },
    },
    _count: { _all: true },
  });
  const malas = cuenta.filter((c) => c._count._all !== LAS_SEIS.length);
  if (malas.length > 0) {
    console.error(`\n✗ ${malas.length} cursos no quedaron en seis`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ los ${cuenta.length} cursos quedaron en seis obligatorias`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
