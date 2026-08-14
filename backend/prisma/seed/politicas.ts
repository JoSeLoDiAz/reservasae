/** Siembra el texto legal. No pisa el que ya exista. */

import { DestinatarioPolitica, PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

// El texto que autoriza al SENA. Lo acepta la persona,
// no la empresa: el titular del dato es el empleado.
const PARTICIPANTE = `De conformidad con lo dispuesto en la Ley 1581 de 2012, su Decreto Reglamentario 1377 de 2013 y el Acuerdo No. 009 de 2016, AUTORIZO de manera libre, previa, expresa, voluntaria y debidamente informada, a que el Servicio Nacional de Aprendizaje – SENA recolecte, recaude, almacene, use, circule, suprima, procese, compile, intercambie, dé tratamiento, actualice y disponga de los datos que han sido suministrados y que se han incorporado en distintas bases o bancos de datos de todo tipo en el marco de las convocatorias que adelanta el Grupo de Gestión para la Productividad y la Competitividad.

En este sentido, el SENA queda autorizado de manera expresa e inequívoca para mantener y manejar toda mi información personal y profesional para los fines que se encuentra legal y reglamentariamente facultado; para darlos a conocer a los gremios, empresas, personas naturales, entre otros que suscriban Convenios Especiales de Cooperación en el marco de las Convocatorias que adelanta el Grupo de Gestión para la Productividad y la Competitividad.

Sin perjuicio de lo anterior, los referidos datos no podrán ser distribuidos, comercializados, compartidos, suministrados o intercambiados con terceros, y en general, realizar actividades en las cuales se vea comprometida la confidencialidad y protección de la información recolectada, y podré en cualquier momento solicitar que la información sea modificada, actualizada o retirada de las bases de datos del SENA.

Así mismo, se me indicó que para mayor información podré consultar en cualquier momento el Acuerdo 009 del 2016 – Tratamiento de Datos Personales – SENA, la Ley 1581 de 2012 y el Decreto 1377 de 2013.`;

type Semilla = {
  destinatario: DestinatarioPolitica;
  titulo: string;
  contenido: string;
};

const SEMILLAS: Semilla[] = [
  {
    destinatario: DestinatarioPolitica.PARTICIPANTE,
    titulo: 'Términos y Condiciones — Habeas Data',
    contenido: PARTICIPANTE,
  },
];

async function main() {
  const convenios = await prisma.convenio.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, sigla: true },
    orderBy: { orden: 'asc' },
  });

  if (convenios.length === 0) {
    console.log('No hay convenios activos. Siembre el catálogo primero.');
    return;
  }

  for (const convenio of convenios) {
    const nombre = convenio.sigla ?? convenio.nombre;

    for (const semilla of SEMILLAS) {
      const vigente = await prisma.politicaDatos.findFirst({
        where: {
          convenioId: convenio.id,
          destinatario: semilla.destinatario,
          vigenteHasta: null,
        },
        select: { version: true },
      });

      if (vigente) {
        console.log(`= ${nombre} · ${semilla.destinatario}: ya tiene la v${vigente.version}`);
        continue;
      }

      const ultima = await prisma.politicaDatos.findFirst({
        where: { convenioId: convenio.id, destinatario: semilla.destinatario },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const creada = await prisma.politicaDatos.create({
        data: {
          convenioId: convenio.id,
          destinatario: semilla.destinatario,
          version: (ultima?.version ?? 0) + 1,
          titulo: semilla.titulo,
          contenido: semilla.contenido,
        },
        select: { version: true },
      });

      console.log(`+ ${nombre} · ${semilla.destinatario}: sembrada la v${creada.version}`);
    }
  }

  // sin la de RESERVA no se puede publicar nada
  const faltan = await prisma.convenio.findMany({
    where: {
      activo: true,
      politicas: { none: { destinatario: 'RESERVA', vigenteHasta: null } },
    },
    select: { nombre: true, sigla: true },
  });

  if (faltan.length > 0) {
    console.log('');
    console.log('Falta la política de RESERVA en:');
    for (const c of faltan) console.log(`  - ${c.sigla ?? c.nombre}`);
    console.log('Sin ella no se puede publicar ninguna acción de formación.');
    console.log('Se escribe desde el panel, en Políticas de datos.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
