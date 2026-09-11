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

/**
 * Cómo se reconoce una política de la época de la convocatoria.
 *
 * La vieja autorizaba al «Servicio Nacional de Aprendizaje – SENA»
 * a tratar los datos «en el marco de las convocatorias». Ninguna
 * redacción de GRUPO AE nombra al SENA, así que el nombre basta
 * para distinguirlas y no hay que comparar párrafos enteros —que
 * es lo que fallaría en cuanto alguien corrija una tilde.
 */
const CADUCA = /Servicio Nacional de Aprendizaje|SENA\b/;

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
        select: { id: true, version: true, contenido: true },
      });

      /// El texto de arriba se reescribió entero —autorizaba al SENA
      /// a tratar los datos «en el marco de las convocatorias»— y este
      /// guion no lo cambiaba: se plantaba con «ya tiene la v1» y la
      /// pantalla pública seguía enseñando el de la convocatoria. Que
      /// no pise lo que el panel haya escrito es correcto; que no
      /// pueda relevar un texto caduco no lo era.
      ///
      /// Se reconoce por el marcador, no por el texto entero: si la
      /// política vigente todavía nombra al SENA es la de antes,
      /// venga tal cual de la semilla vieja o retocada a mano.
      /// Cualquier texto que ya no lo nombre se respeta.
      ///
      /// Y se RELEVA, no se pisa: la v1 se cierra con `vigenteHasta` y
      /// nace la siguiente. `AutorizacionDatos` apunta a la versión
      /// que la persona leyó, así que lo ya autorizado se sigue
      /// pudiendo demostrar contra el texto que estaba delante.
      if (vigente && !CADUCA.test(vigente.contenido)) {
        console.log(`= ${nombre} · ${semilla.destinatario}: ya tiene la v${vigente.version}`);
        continue;
      }

      if (vigente) {
        await prisma.politicaDatos.update({
          where: { id: vigente.id },
          data: { vigenteHasta: new Date() },
        });
        console.log(
          `~ ${nombre} · ${semilla.destinatario}: la v${vigente.version} nombraba al SENA, cerrada`,
        );
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
