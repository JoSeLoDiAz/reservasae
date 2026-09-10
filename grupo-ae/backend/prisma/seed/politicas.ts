/** Siembra el texto legal. No pisa el que ya exista. */

import { DestinatarioPolitica, PrismaClient } from '../../generated/prisma';
import { exigirBaseSegura } from '../guardia-de-base';

// el 5433 es produccion, aunque diga localhost
exigirBaseSegura('La siembra de politicas');

const prisma = new PrismaClient();

// El texto que autoriza a Grupo AE. Lo acepta la persona,
// no la empresa: el titular del dato es el empleado.
const PARTICIPANTE = `De conformidad con lo dispuesto en la Ley 1581 de 2012 y su Decreto Reglamentario 1377 de 2013, AUTORIZO de manera libre, previa, expresa, voluntaria y debidamente informada, a que GRUPO AE recolecte, almacene, use, circule, suprima, procese, compile, dé tratamiento, actualice y disponga de los datos que he suministrado y que se han incorporado en sus bases de datos, con el fin de atender mi solicitud, contactarme y presentarme propuestas comerciales de sus servicios.

En este sentido, GRUPO AE queda autorizado de manera expresa e inequívoca para mantener y manejar mi información personal y de contacto con fines comerciales, de atención de solicitudes y de gestión de la relación con clientes y prospectos; y para compartirla con sus aliados y proveedores únicamente cuando ello sea necesario para prestar el servicio contratado.

Sin perjuicio de lo anterior, los referidos datos no podrán ser distribuidos, comercializados, compartidos, suministrados o intercambiados con terceros, y en general, realizar actividades en las cuales se vea comprometida la confidencialidad y protección de la información recolectada, y podré en cualquier momento conocer, actualizar, rectificar o solicitar la supresión de mi información en las bases de datos de GRUPO AE.

Así mismo, se me indicó que para mayor información podré consultar en cualquier momento la Política de Tratamiento de Datos Personales de GRUPO AE, la Ley 1581 de 2012 y el Decreto 1377 de 2013.`;

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
