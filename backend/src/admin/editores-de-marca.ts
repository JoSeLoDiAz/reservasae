/** Quién puede cambiar la marca de TODOS: logos, colores del sistema, textos. */

/// Por qué es una lista de correos y no un rol.
///
/// «Que nadie pueda modificar los logos, solo con el correo de acceso
/// de José, Diana y la Sra. Catalina; ni yo puedo hacerlo» (cliente,
/// 21 sep 2026). Lo dijo un superadministrador sobre sí mismo, así que
/// el rol no sirve de cerradura: un SUPERADMIN tenía que poder no
/// estar. La marca es de todos --un logo o un color del sistema lo ve
/// el equipo entero y la gente de afuera en los formularios--, y quién
/// la toca es una decisión de personas concretas.
///
/// La lista vive en la configuración del servidor (`EDITORES_DE_MARCA`,
/// correos separados por comas) y no en el código: los correos son de
/// personas, cambian, y no deben quedar escritos en el repositorio.
///
/// SIN LISTA, NADIE. Si la variable falta, ninguna cuenta puede
/// cambiar la marca --tampoco un superadministrador--: abrir la puerta
/// a todos por un olvido de configuración sería justo lo que se pidió
/// evitar. Lo que SÍ puede cualquier persona, siempre, es elegir sus
/// propios colores (ver `tema-propio.ts`): esos le quedan solo a ella.

import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UseGuards,
} from '@nestjs/common';

import type { PeticionConAdmin } from './admin.guard';

/** Los correos autorizados, en minúsculas y sin espacios. */
export function editoresDeMarca(valor: string | undefined = process.env.EDITORES_DE_MARCA): string[] {
  return (valor ?? '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

/** Si esta cuenta puede cambiar la marca de todos. */
export function esEditorDeMarca(
  correo: string | null | undefined,
  lista: string[] = editoresDeMarca(),
): boolean {
  if (!correo) return false;
  return lista.includes(correo.trim().toLowerCase());
}

export const MENSAJE_SOLO_EDITORES =
  'Los logos y la marca de todo el sistema solo los cambian las personas autorizadas. ' +
  'Sus colores sí los puede elegir usted en Apariencia, y le quedan solo a usted.';

/// La cerradura. Corre después del guard global, que es quien carga la
/// cuenta en la petición.
@Injectable()
export class EditoresDeMarcaGuard implements CanActivate {
  canActivate(contexto: ExecutionContext): boolean {
    const peticion = contexto.switchToHttp().getRequest<PeticionConAdmin>();
    if (!esEditorDeMarca(peticion.admin?.correo)) {
      throw new ForbiddenException(MENSAJE_SOLO_EDITORES);
    }
    return true;
  }
}

/** Solo los correos de `EDITORES_DE_MARCA`. Sustituye al rol, no se suma. */
export function SoloEditoresDeMarca() {
  return applyDecorators(UseGuards(EditoresDeMarcaGuard));
}
