/** El asesor no pone grupo: lo ponen el analista y los administradores. */

import { ForbiddenException } from '@nestjs/common';

import type { PeticionConAdmin } from '../admin/admin.guard';
import type { PrismaService } from '../prisma/prisma.service';
import {
  AsignaGrupoGuard,
  exigirQuienAsignaGrupo,
  MENSAJE_SOLO_ANALISTA,
  puedeAsignarGrupo,
  ROL_QUE_ASIGNA_GRUPO,
} from './quien-asigna-grupo';

const contexto = (peticion: unknown) =>
  ({ switchToHttp: () => ({ getRequest: () => peticion }) }) as never;

function conRoles(rol: string, roles: Record<string, string[]>): PeticionConAdmin {
  return {
    admin: { rol },
    ambito: { roles },
  } as unknown as PeticionConAdmin;
}

describe('quién asigna grupo', () => {
  describe('en la puerta de la ruta', () => {
    it('el asesor de inscripciones NO puede', () => {
      const peticion = conRoles('GESTOR', { ade: ['GESTOR_INSCRIPCION'] });
      expect(puedeAsignarGrupo(peticion)).toBe(false);
      expect(() => new AsignaGrupoGuard().canActivate(contexto(peticion))).toThrow(
        MENSAJE_SOLO_ANALISTA,
      );
    });

    /// El líder de inscripciones tampoco: el cliente nombró «líder de
    /// sistemas y los admin», y ampliarlo por nuestra cuenta sería
    /// abrir una puerta que nadie pidió.
    it('el líder de inscripciones tampoco', () => {
      expect(puedeAsignarGrupo(conRoles('GESTOR', { ade: ['LIDER_INSCRIPCION'] }))).toBe(
        false,
      );
    });

    it('el líder de sistemas sí', () => {
      expect(puedeAsignarGrupo(conRoles('GESTOR', { ade: [ROL_QUE_ASIGNA_GRUPO] }))).toBe(
        true,
      );
    });

    it('un superadministrador sí, aunque no lleve el rol en ningún convenio', () => {
      expect(puedeAsignarGrupo(conRoles('SUPERADMIN', {}))).toBe(true);
    });

    /// Por la PUERTA GENERAL no hay gremio elegido, así que no hay
    /// nada que recortar y basta con llevarlo en uno. Ahí la
    /// cerradura que cuenta es la del servicio, que sí recibe el
    /// convenio de la ficha.
    it('por la puerta general basta con llevarlo en uno de sus gremios', () => {
      const peticion = conRoles('GESTOR', {
        ade: ['GESTOR_INSCRIPCION'],
        britcham: [ROL_QUE_ASIGNA_GRUPO],
      });
      expect(puedeAsignarGrupo(peticion)).toBe(true);
    });

    /**
     * CON GREMIO EN LA DIRECCIÓN, SOLO CUENTA ESE.
     *
     * El docblock decía que «el ámbito ya lo recortó el guard», y es
     * falso: `admin.guard.ts` recorta `alcance`, no `roles`. Mirando
     * el mapa entero, quien lleva sistemas en ADECOPRIA y es asesor en
     * BRITCHAM asignaba grupo en BRITCHAM — el caso que el ámbito
     * existe para separar.
     */
    it('con gremio en la dirección, el rol del OTRO no sirve', () => {
      const peticion = {
        admin: { rol: 'GESTOR' },
        ambito: {
          roles: {
            ade: [ROL_QUE_ASIGNA_GRUPO],
            britcham: ['GESTOR_INSCRIPCION'],
          },
          gremioElegido: 'britcham',
        },
      } as unknown as PeticionConAdmin;
      expect(puedeAsignarGrupo(peticion)).toBe(false);
    });

    it('con gremio en la dirección, el rol de ESE sí', () => {
      const peticion = {
        admin: { rol: 'GESTOR' },
        ambito: {
          roles: { ade: [ROL_QUE_ASIGNA_GRUPO] },
          gremioElegido: 'ade',
        },
      } as unknown as PeticionConAdmin;
      expect(puedeAsignarGrupo(peticion)).toBe(true);
    });

    it('sin sesión, no', () => {
      expect(puedeAsignarGrupo({} as PeticionConAdmin)).toBe(false);
    });
  });

  describe('dentro del servicio: guardar un lead o inscribir a alguien', () => {
    const prismaCon = (concesion: unknown) =>
      ({
        adminConvenio: { findFirst: jest.fn().mockResolvedValue(concesion) },
      }) as unknown as PrismaService;

    it('un superadministrador no paga ni la consulta', async () => {
      const prisma = prismaCon(null);
      await expect(
        exigirQuienAsignaGrupo(prisma, { id: 'a1', rol: 'SUPERADMIN' }),
      ).resolves.toBeUndefined();
      expect(prisma.adminConvenio.findFirst).not.toHaveBeenCalled();
    });

    it('con la concesión de líder de sistemas, pasa', async () => {
      await expect(
        exigirQuienAsignaGrupo(prismaCon({ id: 'c1' }), { id: 'a2', rol: 'GESTOR' }),
      ).resolves.toBeUndefined();
    });

    it('sin ella, se niega y se dice por qué', async () => {
      await expect(
        exigirQuienAsignaGrupo(prismaCon(null), { id: 'a3', rol: 'GESTOR' }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        exigirQuienAsignaGrupo(prismaCon(null), { id: 'a3', rol: 'GESTOR' }),
      ).rejects.toThrow(MENSAJE_SOLO_ANALISTA);
    });

    /// La consulta busca ESE rol, no cualquiera: sin el filtro, un
    /// gestor con cualquier concesión pasaría.
    it('la consulta filtra por el rol que asigna', async () => {
      const prisma = prismaCon({ id: 'c1' });
      await exigirQuienAsignaGrupo(prisma, { id: 'a4', rol: 'GESTOR' });
      expect(prisma.adminConvenio.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { adminId: 'a4', rol: ROL_QUE_ASIGNA_GRUPO },
        }),
      );
    });

    /**
     * Y FILTRA POR EL CONVENIO DE LA FICHA.
     *
     * Sin él la consulta encuentra la concesión de cualquier gremio, y
     * quien lleva sistemas en uno asigna grupo en el otro, donde es
     * asesor. Es la misma regla que el caso de arriba, en la otra
     * mitad del candado.
     */
    it('la consulta filtra también por el convenio de la ficha', async () => {
      const prisma = prismaCon({ id: 'c1' });
      await exigirQuienAsignaGrupo(prisma, { id: 'a5', rol: 'GESTOR' }, 'cv-britcham');
      expect(prisma.adminConvenio.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            adminId: 'a5',
            rol: ROL_QUE_ASIGNA_GRUPO,
            convenioId: 'cv-britcham',
          },
        }),
      );
    });
  });
});
