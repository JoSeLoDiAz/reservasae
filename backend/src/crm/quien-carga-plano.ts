/** Quién puede meter leads por archivo plano. */

/**
 * NO EL GESTOR DE INSCRIPCIONES.
 *
 * «Una restricción que no se tiene, para los usuarios de Gestor(a) de
 * inscripciones: no pueden cargar por plano, no pueden borrar leads»
 * (cliente, 1 oct 2026).
 *
 * POR QUÉ IMPORTA, que es lo que no se ve al mirar la pantalla: una
 * carga no crea un lead, crea cientos de una vez, y cada uno entra con
 * su gremio, su acción de formación y su asesor. Un archivo mal armado
 * ---la columna corrida, el convenio equivocado, la misma gente dos
 * veces--- no se deshace borrando: hay que ir ficha por ficha, y para
 * entonces ya salieron correos y ya cuentan en los tableros. Es una
 * decisión sobre el trabajo de TODO el equipo, no sobre la ficha que
 * uno lleva, y por eso la firma quien responde por el equipo.
 *
 * Al gestor no se le quita su día: sigue inscribiendo de a uno desde
 * «Inscribir a alguien», que es la puerta donde cada dato se mira.
 *
 * LO DE BORRAR LEADS YA ESTABA: `@Roles(RolAdmin.SUPERADMIN)` cierra
 * el borrado individual y el de lote desde el 13 sep 2026. Se
 * comprobó antes de tocar nada, para no poner un segundo candado
 * sobre una puerta que ya estaba cerrada. Ver `crm.controller.ts`.
 *
 * La cerradura va en el SERVIDOR porque es donde cuenta: esconder el
 * botón no impide la llamada. Lo de la pantalla va aparte, en el
 * `puede` que `admin.controller.ts` le manda al panel, y es solo para
 * no ofrecer lo que el servidor va a rechazar.
 */

import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UseGuards,
} from '@nestjs/common';

import type { Admin, RolConvenio } from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import type { PeticionConAdmin } from '../admin/admin.guard';

/**
 * Los roles de convenio que sí cargan.
 *
 * Hoy solo TRES roles tienen `inscripciones: ESCRIBIR` ---gestor de
 * inscripciones, líder de inscripciones y líder de sistemas---, que es
 * lo único que pedía la carga. Quitando al gestor quedan los dos
 * líderes, que es la misma lista de `MUEVEN_INSCRITO` y
 * `REPARTEN_FICHAS` menos el académico: cargar participantes es del
 * lado de inscripciones.
 */
export const CARGAN_PLANO: RolConvenio[] = [
  'LIDER_INSCRIPCION',
  'LIDER_SISTEMAS',
];

export const MENSAJE_SOLO_LIDER_CARGA =
  'Cargar un archivo de participantes lo hace un líder de inscripciones, ' +
  'el analista o un administrador. Para inscribir a una persona, use ' +
  '«Inscribir a alguien».';

/**
 * Si esta cuenta puede cargar por plano.
 *
 * OJO AL GREMIO, que es la lección de `quien-asigna-grupo.ts`: en
 * `admin.guard.ts` lo que se recorta por gremio es `alcance`; `roles`
 * se publica con TODAS las concesiones. Sin mirar el gremio elegido,
 * quien es líder en ADECOPRIA y gestor en BRITCHAM cargaría también en
 * BRITCHAM ---justo el caso que el ámbito existe para separar---.
 */
export function puedeCargarPlano(peticion: PeticionConAdmin): boolean {
  if (peticion.admin?.rol === 'SUPERADMIN') return true;
  const porConvenio = peticion.ambito?.roles ?? {};
  const elegido = peticion.ambito?.gremioElegido;
  const aMirar = elegido
    ? [porConvenio[elegido] ?? []]
    : Object.values(porConvenio);
  return aMirar.some((roles) => roles.some((r) => CARGAN_PLANO.includes(r)));
}

/** Los convenios donde esta cuenta sí carga, para el panel. */
export const conveniosQueCargan = (roles: Record<string, RolConvenio[]>) =>
  Object.entries(roles)
    .filter(([, suyos]) => suyos.some((r) => CARGAN_PLANO.includes(r)))
    .map(([convenioId]) => convenioId);

/**
 * LA MISMA CERRADURA, PERO CONTRA EL CONVENIO DE LA PETICIÓN.
 *
 * El guard de ruta no basta, y esto lo encontró José al revisar la
 * entrega del 1 oct 2026. `puedeCargarPlano` mira `gremioElegido`,
 * pero en `admin.guard.ts` ese valor queda NULO cuando no hay
 * subdominio ni cabecera `x-gremio` ---que es como entra la mayoría---,
 * y entonces se miran TODAS las concesiones. Y el convenio de la carga
 * no sale del host: viene en el CUERPO, `CargaDto.convenioId`.
 *
 * O sea: quien es líder en ADECOPRIA y gestor en BRITCHAM pasaba el
 * guard por su rol de ADECOPRIA y cargaba un archivo en BRITCHAM,
 * donde solo es gestor. Es exactamente el tercer agujero de
 * `PATCH grupos/lote`, y lo peor es que el docblock de este fichero ya
 * citaba esa lección y aun así dejó la rama abierta.
 *
 * Por eso esta comprobación va DENTRO del servicio y recibe el
 * convenio de la ficha, igual que `exigirQuienAsignaGrupo`: es el
 * único sitio donde se sabe a qué gremio se está cargando de verdad.
 *
 * Una consulta y solo cuando hace falta: un superadministrador no la
 * paga.
 */
export async function exigirQuienCargaPlano(
  prisma: PrismaService,
  admin: Pick<Admin, 'id' | 'rol'>,
  convenioId: string,
): Promise<void> {
  if (admin.rol === 'SUPERADMIN') return;
  const concesion = await prisma.adminConvenio.findFirst({
    where: { adminId: admin.id, convenioId, rol: { in: CARGAN_PLANO } },
    select: { id: true },
  });
  if (!concesion) throw new ForbiddenException(MENSAJE_SOLO_LIDER_CARGA);
}

@Injectable()
export class CargaPlanoGuard implements CanActivate {
  canActivate(contexto: ExecutionContext): boolean {
    const peticion = contexto.switchToHttp().getRequest<PeticionConAdmin>();
    if (!puedeCargarPlano(peticion)) {
      throw new ForbiddenException(MENSAJE_SOLO_LIDER_CARGA);
    }
    return true;
  }
}

/** Solo líder de inscripciones, analista o administrador. */
export function SoloQuienCargaPlano() {
  return applyDecorators(UseGuards(CargaPlanoGuard));
}
