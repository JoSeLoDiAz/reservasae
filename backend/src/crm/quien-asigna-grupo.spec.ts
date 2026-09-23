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

    /// Lleva sistemas en un gremio y inscripciones en el otro: el
    /// ámbito ya lo recortó el guard de sesión, así que basta con que
    /// lo lleve donde está trabajando.
    it('basta con llevarlo en uno de sus gremios', () => {
      const peticion = conRoles('GESTOR', {
        ade: ['GESTOR_INSCRIPCION'],
        britcham: [ROL_QUE_ASIGNA_GRUPO],
      });
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
  });
});
