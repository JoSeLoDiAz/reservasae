/** Quién puede meter a una persona en un grupo. */

/**
 * NO EL ASESOR.
 *
 * «El asesor de inscripciones no puede colocar el Grupo; esto lo hace
 * el analista y/o administrador, son los únicos autorizados para poder
 * hacer esta gestión» (cliente, 23 sep 2026). Y al preguntarle quién es
 * el analista dentro del sistema: «sería líder de sistemas, o bueno el
 * rol que tiene Mauricio Andrés Palma Mesa, que es de Líder de Sistemas
 * de Información, y todos los que sean Admin».
 *
 * Por qué importa: el grupo decide en qué cohorte queda la persona y,
 * con ella, las fechas y el cupo que consume. Un asesor que asigna mal
 * llena un grupo que no era y deja otro vacío, y eso no se ve hasta el
 * reporte al SENA. La cerradura va en el servidor porque es donde
 * cuenta: esconder el botón no impide la llamada.
 *
 * Lo que el asesor SÍ sigue haciendo es todo lo demás de su lead
 * --gestionarlo, completar sus datos, cambiar su etapa--; lo único que
 * pierde es poner el grupo.
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

/// El rol de convenio que sí puede. Uno solo, y a propósito: el
/// cliente nombró ese y no la lista entera de líderes.
export const ROL_QUE_ASIGNA_GRUPO: RolConvenio = 'LIDER_SISTEMAS';

export const MENSAJE_SOLO_ANALISTA =
  'Asignar el grupo lo hace el analista o un administrador. Pídalo por su canal de siempre.';

/**
 * Si esta cuenta puede asignar grupo.
 *
 * Un superadministrador puede siempre --es el «y todos los que sean
 * Admin» de la frase-- y, fuera de eso, hace falta llevar líder de
 * sistemas en ALGÚN convenio de su ámbito. No se exige que sea el
 * convenio de la persona que se está asignando: el ámbito ya lo
 * recortó el guard de sesión, y quien lleva sistemas en el gremio que
 * está mirando no está tocando el otro.
 */
export function puedeAsignarGrupo(peticion: PeticionConAdmin): boolean {
  if (peticion.admin?.rol === 'SUPERADMIN') return true;
  const porConvenio = peticion.ambito?.roles ?? {};
  return Object.values(porConvenio).some((roles) =>
    roles.includes(ROL_QUE_ASIGNA_GRUPO),
  );
}

@Injectable()
export class AsignaGrupoGuard implements CanActivate {
  canActivate(contexto: ExecutionContext): boolean {
    const peticion = contexto.switchToHttp().getRequest<PeticionConAdmin>();
    if (!puedeAsignarGrupo(peticion)) {
      throw new ForbiddenException(MENSAJE_SOLO_ANALISTA);
    }
    return true;
  }
}

/** Solo analista --líder de sistemas-- o administrador. */
export function SoloQuienAsignaGrupo() {
  return applyDecorators(UseGuards(AsignaGrupoGuard));
}

/**
 * La misma cerradura, pero DENTRO del servicio.
 *
 * El grupo no solo se pone por lote: también al guardar un lead y al
 * inscribir a alguien a mano. En esas dos el guard de ruta no sirve
 * --bloquearía la operación entera, y el asesor sí puede guardar su
 * lead--, así que se comprueba aquí y solo cuando la petición trae
 * grupo.
 *
 * Una consulta y solo cuando hace falta: un superadministrador no la
 * paga, y quien no manda grupo tampoco.
 */
export async function exigirQuienAsignaGrupo(
  prisma: PrismaService,
  admin: Pick<Admin, 'id' | 'rol'>,
): Promise<void> {
  if (admin.rol === 'SUPERADMIN') return;
  const concesion = await prisma.adminConvenio.findFirst({
    where: { adminId: admin.id, rol: ROL_QUE_ASIGNA_GRUPO },
    select: { id: true },
  });
  if (!concesion) throw new ForbiddenException(MENSAJE_SOLO_ANALISTA);
}
