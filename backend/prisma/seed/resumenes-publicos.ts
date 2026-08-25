/** Textos de prueba para la tarjeta pública. */

/// Redactados a mano solo para poder probar la pantalla.
/// NO son definitivos: el objetivo real del catalogo esta
/// escrito para el convenio -- mayusculas y 120 palabras --
/// y no sirve para que alguien decida si le interesa.
/// Se editan desde el panel, en Formularios.

import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

/// [slug del convenio, codigo, resumen]
const RESUMENES: Array<[string, string, string]> = [
  [
    'adecopria',
    'AF1',
    'Aprenderá a sostener la atención de un grupo acostumbrado a la pantalla, ' +
      'con estrategias de aula aplicables desde la semana siguiente y una forma de ' +
      'medir si están funcionando.',
  ],
  [
    'adecopria',
    'AF2',
    'Saldrá con un plan concreto para incorporar inteligencia artificial en su ' +
      'institución: qué tareas de planeación automatizar, cuáles no, y cómo presentarlo ' +
      'al equipo docente.',
  ],
  [
    'adecopria',
    'AF3',
    'Ocho horas para formular una política de diversidad, equidad e inclusión que ' +
      'pueda sustentar ante el consejo directivo, con indicadores y no solo con intenciones.',
  ],
  [
    'adecopria',
    'AF4',
    'Conocerá cómo usar realidad virtual y cartografía digital en clase con los ' +
      'recursos que ya tiene la institución, sin depender de comprar equipos nuevos.',
  ],
  [
    'adecopria',
    'AF5',
    'Entenderá cómo montar una cooperativa o proyecto asociativo escolar: figura ' +
      'legal, reparto de excedentes y canales de venta responsables.',
  ],
  [
    'adecopria',
    'AF6',
    'Aprenderá a estructurar un laboratorio de innovación en su institución: qué ' +
      'espacio destinar, cómo organizar los proyectos y cómo sostenerlo en el tiempo.',
  ],
  [
    'adecopria',
    'AF7',
    'Dos horas para revisar si su modelo híbrido está dejando gente atrás, y qué ' +
      'ajustar primero para que no ocurra.',
  ],

  [
    'britcham-adee',
    'AF1',
    'Aprenderá a poner agentes de inteligencia artificial a hacer trabajo repetitivo ' +
      'de su organización, y a decidir qué procesos conviene automatizar y cuáles no.',
  ],
  [
    'britcham-adee',
    'AF2',
    'Saldrá con modelos financieros propios construidos con IA generativa: proyecciones, ' +
      'escenarios y tableros que pueda presentar a su junta.',
  ],
  [
    'britcham-adee',
    'AF3',
    'Conocerá cómo automatizar la captación de clientes en una empresa que está ' +
      'creciendo, sin multiplicar el equipo comercial al mismo ritmo.',
  ],
  [
    'britcham-adee',
    'AF4',
    'Ocho horas para llevarse una hoja de ruta de inteligencia artificial para su ' +
      'área, y los argumentos para defenderla donde se toman las decisiones.',
  ],
  [
    'britcham-adee',
    'AF5',
    'Sabrá qué datos de su empresa están expuestos hoy, qué exige la ley colombiana ' +
      'y por dónde empezar a cerrar los riesgos más caros.',
  ],
  [
    'britcham-adee',
    'AF6',
    'Aprenderá a diseñar experiencias turísticas y gastronómicas que se puedan cobrar ' +
      'más caro, encadenando proveedores campesinos de su región.',
  ],
  [
    'britcham-adee',
    'AF7',
    'Dieciséis horas para evaluar si su negocio puede salir a otro mercado: qué país, ' +
      'con qué modelo y qué haría falta para sostenerlo.',
  ],
  [
    'britcham-adee',
    'AF8',
    'Dos horas para identificar dónde su operación está botando plata en desperdicio, ' +
      'y qué se puede recircular sin frenar la producción.',
  ],
];

async function main() {
  let puestos = 0;
  let sinAccion = 0;

  for (const [slug, codigo, resumen] of RESUMENES) {
    const convenio = await prisma.convenio.findFirst({
      where: { slug },
      select: { id: true },
    });
    if (!convenio) {
      sinAccion += 1;
      continue;
    }

    const hecho = await prisma.accionFormacion.updateMany({
      where: { convenioId: convenio.id, codigo },
      data: { resumenPublico: resumen },
    });

    if (hecho.count === 0) sinAccion += 1;
    else puestos += hecho.count;
  }

  const faltan = await prisma.accionFormacion.count({
    where: { resumenPublico: null },
  });

  console.log(`\n  ${puestos} resúmenes puestos.`);
  if (sinAccion) console.log(`  ${sinAccion} no encontraron su acción.`);
  console.log(`  ${faltan} acciones siguen sin resumen.\n`);
  console.log('  Son textos de prueba. Se editan en el panel, en Formularios.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
