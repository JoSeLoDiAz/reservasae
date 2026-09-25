/**
 * Los OCHO grupos de cada acción, con gente dentro.
 *
 * «Necesito registros de los 8 grupos por las 8 AF para que esa tabla
 * se vea bien, y si filtro una AF se vea solo lo de esa AF» (cliente,
 * 25 sep 2026), sobre el consolidado de Seguimiento académico.
 *
 * QUÉ FALTABA: no era la pantalla, era la base. De las quince acciones
 * solo cuatro tenían sus ocho grupos; el resto andaba entre uno y
 * cinco, y la mayoría sin nadie dentro. El consolidado salía con tres
 * filas y no había forma de juzgarlo, ni de ver que el filtro por
 * acción hace lo que tiene que hacer.
 *
 * QUÉ NO HACE, y es lo importante:
 *
 * - NO toca las reservas ni los cupos de las ofertas. Esta gente entra
 *   como quien se inscribió por su cuenta ---`reservaId` nulo, que el
 *   modelo permite a propósito---, así que ni un cupo apartado cambia
 *   y los informes de reservas siguen cuadrando igual que antes.
 * - NO reparte estados ni avance. De eso se encarga
 *   `db:sembrar-academico`, que ya está calibrado contra los umbrales
 *   del servicio. Aquí solo se crea gente EN FORMACIÓN; aquel la
 *   reparte entre los seis estados. Correr este y no aquel deja el
 *   aula entera «Sin actividades», que es verdad y se ve fatal.
 * - NO borra nada. Es idempotente por el documento: los que ya existen
 *   se dejan como están, y correrlo dos veces no duplica a nadie.
 *
 * Todas las personas van con `esDePrueba: true`, que es lo que hace
 * que el RUI no las consulte nunca.
 */

import {
  EtapaParticipante,
  Modalidad,
  OrigenParticipante,
  PrismaClient,
} from '../../generated/prisma';

const prisma = new PrismaClient();

const GRUPOS_POR_ACCION = 8;
/** Cuánta gente por grupo. Varía para que la torta tenga tajadas de
    tamaños distintos: con todos iguales no se juzga un reparto. */
const POR_GRUPO = [12, 9, 14, 7, 11, 8, 13, 10];

/** Rango de documento reservado a esta siembra. Fuera de los que usa
    `prueba.ts`, para que las dos puedan convivir sin pisarse. */
const DOCUMENTO_BASE = 88_000_000;

const NOMBRES = [
  'Camilo', 'Daniela', 'Andrés', 'Paula', 'Julián', 'Mariana', 'Sebastián',
  'Valentina', 'Esteban', 'Carolina', 'Mateo', 'Luisa', 'Nicolás', 'Sara',
];
const APELLIDOS = [
  'Ramírez', 'Cárdenas', 'Osorio', 'Betancur', 'Naranjo', 'Zapata', 'Arango',
  'Villa', 'Mejía', 'Restrepo', 'Gallego', 'Hoyos', 'Tobón', 'Correa',
];

const sinTildes = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

async function main() {
  /// LA GUARDIA, PRIMERO. Esta siembra crea cientos de personas: en
  /// una base que no sea la de pruebas eso es un destrozo, y el
  /// nombre de la base es lo único que hay para distinguirlas.
  const url = process.env.DATABASE_URL ?? '';
  if (!/prueba/i.test(url)) {
    console.error(
      'Esta siembra solo corre contra una base cuyo nombre lleve «prueba».\n' +
        'DATABASE_URL apunta a otra cosa, así que no se toca nada.',
    );
    process.exit(1);
  }

  const acciones = await prisma.accionFormacion.findMany({
    select: { id: true, codigo: true, convenioId: true },
    orderBy: [{ convenioId: 'asc' }, { codigo: 'asc' }],
  });

  /// Una ubicación para las coberturas. Se reutiliza la que ya tenga
  /// la acción; si no tiene ninguna, la primera del catálogo. La
  /// cobertura hace falta porque es de ella de donde cuelga el
  /// participante: sin ella no hay forma de decir en qué grupo está.
  const cualquierUbicacion = await prisma.ubicacion.findFirstOrThrow({
    select: { id: true },
  });

  let gruposNuevos = 0;
  let genteNueva = 0;
  let documento = DOCUMENTO_BASE;

  for (const accion of acciones) {
    for (let numero = 1; numero <= GRUPOS_POR_ACCION; numero++) {
      const grupo = await prisma.grupo.upsert({
        where: { accionFormacionId_numero: { accionFormacionId: accion.id, numero } },
        update: {},
        create: {
          accionFormacionId: accion.id,
          numero,
          /// VIRTUAL: el aula es lo virtual, y un grupo presencial
          /// pediría sede.
          modalidad: Modalidad.VIRTUAL,
        },
        select: { id: true, creadoEn: true, actualizadoEn: true },
      });
      /// `upsert` con `update: {}` no toca el que ya estaba, así que
      /// esto cuenta solo los de verdad nuevos.
      if (grupo.creadoEn.getTime() === grupo.actualizadoEn.getTime()) gruposNuevos++;

      const cobertura = await prisma.grupoCobertura.findFirst({
        where: { grupoId: grupo.id },
        select: { id: true },
      });
      const coberturaId =
        cobertura?.id ??
        (
          await prisma.grupoCobertura.create({
            data: {
              grupoId: grupo.id,
              ubicacionId: cualquierUbicacion.id,
              modalidad: Modalidad.VIRTUAL,
              cuposBase: 30,
              cuposMaximos: 39,
            },
            select: { id: true },
          })
        ).id;

      const cuantos = POR_GRUPO[(numero - 1) % POR_GRUPO.length];
      const yaHay = await prisma.participante.count({ where: { coberturaId } });

      for (let k = yaHay; k < cuantos; k++) {
        documento += 1;
        const numeroDocumento = String(documento);
        const primerNombre = NOMBRES[(documento + k) % NOMBRES.length];
        const primerApellido = APELLIDOS[(documento + numero) % APELLIDOS.length];
        const segundoApellido = APELLIDOS[(documento + k + 3) % APELLIDOS.length];

        const persona = await prisma.persona.upsert({
          /// La llave única es EL PAR tipo + número, no el número
          /// solo: la misma cédula puede repetirse con otro tipo de
          /// documento.
          where: { tipoDocumentoSepId_numeroDocumento: { tipoDocumentoSepId: 1, numeroDocumento } },
          update: {},
          create: {
            tipoDocumentoSepId: 1,
            numeroDocumento,
            esDePrueba: true,
            primerNombre,
            primerApellido,
            segundoApellido,
            correo: `${sinTildes(primerNombre)}.${sinTildes(primerApellido)}${documento}@ejemplo.test`,
            celular: `3${String(100000000 + (documento % 899999999))}`.slice(0, 10),
          },
          select: { id: true },
        });

        const participante = await prisma.participante.create({
          data: {
            personaId: persona.id,
            convenioId: accion.convenioId,
            accionFormacionId: accion.id,
            coberturaId,
            /// SIN RESERVA: esta gente entra «por su cuenta», que es
            /// lo que el modelo contempla con `reservaId` nulo. Así no
            /// se toca ni un cupo apartado y los informes de reservas
            /// siguen cuadrando.
            etapa: EtapaParticipante.EN_FORMACION,
            origen: OrigenParticipante.ASESOR,
          },
          select: { id: true },
        });

        /// EL MOVIMIENTO A INSCRITO, que no es decorativo: de él sale
        /// `primera_matricula`, y de ahí salen «cupos ocupados» y la
        /// ventana de los informes. Sin él, esta gente estaría en el
        /// aula y sería invisible para todo lo demás.
        await prisma.movimientoParticipante.create({
          data: {
            participanteId: participante.id,
            etapaAntes: EtapaParticipante.DATOS_COMPLETOS,
            etapaDespues: EtapaParticipante.INSCRITO,
            motivo: 'Siembra de aula',
          },
        });
        await prisma.movimientoParticipante.create({
          data: {
            participanteId: participante.id,
            etapaAntes: EtapaParticipante.INSCRITO,
            etapaDespues: EtapaParticipante.EN_FORMACION,
            motivo: 'Siembra de aula',
          },
        });

        genteNueva++;
      }
    }
  }

  console.log(
    `Listo: ${gruposNuevos} grupos nuevos y ${genteNueva} participantes nuevos ` +
      `sobre ${acciones.length} acciones.`,
  );
  console.log('Ahora corra `pnpm db:sembrar-academico` para repartirles estado y avance.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
