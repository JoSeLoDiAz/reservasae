/**
 * Crea o reinicia una cuenta de administrador.
 *
 *   pnpm --filter backend db:crear-admin correo@ejemplo.com "Nombre" [--rol GESTOR]
 *
 * Imprime la clave temporal una sola vez. Para el primer usuario o para
 * recuperar el acceso.
 */

import { PrismaClient, RolAdmin } from '../generated/prisma';
import { generarClaveTemporal, hashearClave } from '../src/admin/claves';

const prisma = new PrismaClient();

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
    console.error('Uso: db:crear-admin <correo> "<nombre>" [--rol SUPERADMIN|GESTOR|CONSULTA]');
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

  const claveTemporal = generarClaveTemporal();
  const hashClave = await hashearClave(claveTemporal);

  const existente = await prisma.admin.findUnique({ where: { correo } });
  const admin = await prisma.admin.upsert({
    where: { correo },
    create: { correo, nombre, rol, hashClave, debeCambiarClave: true },
    // si ya existia: clave nueva y reactivada
    update: { hashClave, debeCambiarClave: true, activo: true },
  });

  console.log(existente ? '\nContraseña reiniciada.' : '\nCuenta creada.');
  console.log(`  correo:      ${admin.correo}`);
  console.log(`  nombre:      ${admin.nombre}`);
  console.log(`  rol:         ${admin.rol}`);
  console.log(`  contraseña:  ${claveTemporal}`);
  console.log(
    '\nEsta contraseña no se vuelve a mostrar y hay que cambiarla al entrar.\n',
  );
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
