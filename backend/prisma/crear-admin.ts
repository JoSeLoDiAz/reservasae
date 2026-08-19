/** Crea o reinicia una cuenta de administrador. */

import { PrismaClient, RolAdmin, RolConvenio } from '../generated/prisma';
import { generarClaveTemporal, hashearClave } from '../src/admin/claves';

const prisma = new PrismaClient();

const USO = [
  'Uso: db:crear-admin <correo> "<nombre>" [--rol SUPERADMIN|GESTOR|CONSULTA]',
  '     db:crear-admin <correo> "<nombre>" --solo-permisos',
].join('\n');

async function main() {
  const argumentos = process.argv.slice(2);
  const posicion = argumentos.indexOf('--rol');
  const rolPedido = posicion >= 0 ? argumentos[posicion + 1] : undefined;
  // el valor de --rol no es un argumento suelto
  const indiceValorRol = posicion >= 0 ? posicion + 1 : -1;
  const sueltos = argumentos.filter(
    (a, i) => !a.startsWith('--') && i !== indiceValorRol,
  );

  const [correoCrudo, nombre] = sueltos;
  if (!correoCrudo || !nombre) {
    console.error(USO);
    process.exitCode = 1;
    return;
  }

  const correo = correoCrudo.trim().toLowerCase();
  const rol = (rolPedido as RolAdmin | undefined) ?? RolAdmin.SUPERADMIN;
  if (!Object.values(RolAdmin).includes(rol)) {
    console.error(`Rol inválido: ${rol}. Use ${Object.values(RolAdmin).join(', ')}.`);
    process.exitCode = 1;
    return;
  }

  // para dar permisos sin tocarle la clave a nadie
  const soloPermisos = argumentos.includes('--solo-permisos');
  const existente = await prisma.admin.findUnique({ where: { correo } });

  if (soloPermisos && !existente) {
    console.error(`No existe ninguna cuenta con el correo ${correo}.`);
    process.exitCode = 1;
    return;
  }

  const claveTemporal = soloPermisos ? null : generarClaveTemporal();

  const admin = claveTemporal
    ? await prisma.admin.upsert({
        where: { correo },
        create: {
          correo,
          nombre,
          rol,
          hashClave: await hashearClave(claveTemporal),
          debeCambiarClave: true,
        },
        // si ya existia: clave nueva y reactivada
        update: {
          hashClave: await hashearClave(claveTemporal),
          debeCambiarClave: true,
          activo: true,
        },
      })
    : existente!;

  // sin concesion no ve nada, y este script es el que
  // recupera el acceso si nadie puede entrar
  const convenios = await prisma.convenio.findMany({
    where: { activo: true },
    select: { id: true, sigla: true, slug: true },
  });
  const rolConvenio =
    admin.rol === RolAdmin.SUPERADMIN
      ? RolConvenio.LIDER_SISTEMAS
      : RolConvenio.GESTOR_INSCRIPCION;

  const otorgados: string[] = [];
  for (const convenio of convenios) {
    const ya = await prisma.adminConvenio.findFirst({
      where: { adminId: admin.id, convenioId: convenio.id },
    });
    if (ya) continue;
    await prisma.adminConvenio.create({
      data: { adminId: admin.id, convenioId: convenio.id, rol: rolConvenio },
    });
    otorgados.push(convenio.sigla ?? convenio.slug);
  }

  const encabezado = soloPermisos
    ? 'Permisos revisados. La contraseña no se tocó.'
    : existente
      ? 'Contraseña reiniciada.'
      : 'Cuenta creada.';

  console.log(`\n${encabezado}`);
  console.log(`  correo:      ${admin.correo}`);
  console.log(`  nombre:      ${admin.nombre}`);
  console.log(`  rol:         ${admin.rol}`);
  console.log(
    `  convenios:   ${
      otorgados.length
        ? `${otorgados.join(', ')} como ${rolConvenio}`
        : 'sin cambios, ya los tenía'
    }`,
  );
  if (claveTemporal) {
    console.log(`  contraseña:  ${claveTemporal}`);
    console.log(
      '\nEsta contraseña no se vuelve a mostrar y hay que cambiarla al entrar.\n',
    );
  } else {
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
