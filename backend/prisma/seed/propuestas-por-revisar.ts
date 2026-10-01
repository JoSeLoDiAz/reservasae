/** Propuestas de mentira para la bandeja «Por revisar». */

/// La base de pruebas tiene CERO propuestas, así que el defecto
/// que el cliente ve en su entorno --45 esperando que nunca
/// bajan-- no se reproduce solo aquí. Sin datos no se puede
/// comprobar ni el lote, ni la memoria de los descartes, ni que
/// aceptar datos del buscador deje de verificar la ficha.
///
/// Siembra sobre las instituciones que YA existan: no inventa
/// organizaciones, que son el maestro del banco de empresas y
/// acabarían en un reporte.
///
/// Se corre con:  npx ts-node prisma/seed/propuestas-por-revisar.ts

import { FuenteDato, PrismaClient } from '../../generated/prisma';
import { exigirBaseSegura } from '../guardia-de-base';

const prisma = new PrismaClient();

/**
 * LA GUARDA DE LA CASA, QUE MIRA EL PUERTO.
 *
 * Aquí había una propia que miraba si `DATABASE_URL` contenía la
 * palabra «prueba», y el comentario decía que era «la misma guarda que
 * el resto». NO LO ERA, y José lo vio al revisar la entrega del 1 oct
 * 2026: el resto importan `guardia-de-base`, que es una regla de
 * PUERTO, y lo es precisamente porque aquí ya se concluyó que
 * **ninguna regla sobre el nombre sirve** ---una base «reservasae»
 * alcanzada por el túnel no lleva «prueba» en la URL---.
 *
 * Era la guarda débil justo en la semana en que se toca producción, y
 * en el guión que SIEMBRA DATOS INVENTADOS.
 */
function comprobarQueEsPruebas() {
  exigirBaseSegura('Sembrar propuestas por revisar');
}

/// Lo que cada propuesta trae. Valores plausibles y distintos
/// entre sí, para poder ver en pantalla qué se aceptó y qué no.
const LOTES: Array<{ fuente: FuenteDato; campos: Record<string, unknown> }> = [
  {
    fuente: 'WEB',
    campos: {
      telefono: '(601) 518-6600',
      correo: 'contacto@ejemplo-sembrado.com',
      paginaWeb: 'ejemplo-sembrado.com',
    },
  },
  {
    fuente: 'WEB',
    campos: {
      direccion: 'Carrera 7 # 71-21, Torre B',
      ciudadNombre: 'Bogotá D.C.',
      departamentoNombre: 'Bogotá D.C.',
    },
  },
  {
    fuente: 'WEB',
    campos: { tamano: 'MEDIANA', numeroEmpleados: 184 },
  },
  {
    fuente: 'RUES',
    campos: { codigoCiiu: '8549', sectorEconomico: 'SERVICIOS' },
  },
  {
    fuente: 'WEB',
    campos: { nombreComercial: 'Nombre sembrado de prueba' },
  },
];

async function sembrar() {
  comprobarQueEsPruebas();

  const fichas = await prisma.institucion.findMany({
    where: { activo: true },
    select: { id: true, nit: true, razonSocial: true },
    orderBy: { creadoEn: 'asc' },
  });

  if (fichas.length === 0) {
    console.error('\n  No hay ninguna institución activa a la que proponerle nada.\n');
    process.exit(1);
  }

  let puestas = 0;
  for (const [i, lote] of LOTES.entries()) {
    const ficha = fichas[i % fichas.length];
    await prisma.propuestaInstitucion.create({
      data: {
        institucionId: ficha.id,
        fuente: lote.fuente,
        campos: lote.campos as never,
        /// Con fechas escalonadas hacia atrás, para que la
        /// pantalla pueda decir «espera hace N días»: es la
        /// unidad en la que se mide el atraso de una bandeja.
        creadoEn: new Date(Date.now() - (i + 1) * 3 * 86_400_000),
      },
    });
    puestas += 1;
  }

  const pendientes = await prisma.propuestaInstitucion.count({
    where: { estado: 'PENDIENTE' },
  });

  console.log(`\n  ${puestas} propuestas sembradas sobre ${fichas.length} institución(es).`);
  console.log(`  La bandeja «Por revisar» tiene ahora ${pendientes} esperando.\n`);
}

sembrar()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
