/**
 * Crea o reinicia una cuenta de administrador desde la consola.
 *
 *   pnpm --filter backend db:crear-admin correo@ejemplo.com "Nombre Apellido"
 *   pnpm --filter backend db:crear-admin correo@ejemplo.com "Nombre" --rol GESTOR
 *
 * Imprime una contraseña temporal UNA sola vez; no queda guardada en claro en
 * ningún sitio. Quien entre con ella está obligado a cambiarla antes de poder
 * hacer nada.
 *
 * Existe para el primer usuario, cuando todavía no hay panel desde donde
 * crear otros, y para recuperar el acceso si se pierde la única cuenta.
 */

import { PrismaClient, RolAdmin } from '../generated/prisma';
import { generarClaveTemporal, hashearClave } from '../src/admin/claves';

const prisma = new PrismaClient();

async function main() {
  const argumentos = process.argv.slice(2);
  const posicion = argumentos.indexOf('--rol');
  const rolPedido = posicion >= 0 ? argumentos[posicion + 1] : undefined;
  // El valor de --rol no es un argumento suelto. La comprobación de posicion
  // >= 0 no sobra: sin ella, `posicion + 1` vale 0 y descarta el correo.
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
    // Si la cuenta ya existía se le pone contraseña nueva y se reactiva: es la
    // vía de recuperación cuando nadie puede entrar. El nombre y el rol NO se
    // pisan salvo que se hayan pasado a propósito.
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
