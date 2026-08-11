/** Publica u oculta las acciones de un convenio. */

import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const argumentos = process.argv.slice(2);
  const ocultar = argumentos.includes('--ocultar');
  const [slug, ...codigos] = argumentos.filter((a) => !a.startsWith('--'));

  if (!slug) {
    console.error('Falta el convenio. Ejemplo: db:publicar britcham-adee');
    process.exitCode = 1;
    return;
  }

  const convenio = await prisma.convenio.findUnique({ where: { slug } });
  if (!convenio) {
    const todos = await prisma.convenio.findMany({ select: { slug: true } });
    console.error(
      `No existe el convenio "${slug}". Hay: ${todos.map((c) => c.slug).join(', ')}`,
    );
    process.exitCode = 1;
    return;
  }

  const resultado = await prisma.accionFormacion.updateMany({
    where: {
      convenioId: convenio.id,
      ...(codigos.length ? { codigo: { in: codigos } } : {}),
    },
    data: { visible: !ocultar },
  });

  const visibles = await prisma.accionFormacion.count({
    where: { convenioId: convenio.id, visible: true },
  });

  console.log(
    `${ocultar ? 'Ocultadas' : 'Publicadas'} ${resultado.count} acciones de ${slug}. ` +
      `Ahora hay ${visibles} publicadas.`,
  );
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
