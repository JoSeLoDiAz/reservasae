import { ForbiddenException } from '@nestjs/common';

import { RolAdmin, RolConvenio, type Admin } from '../../generated/prisma';
import type { Ambito } from '../admin/admin.guard';
import type { PrismaService } from '../prisma/prisma.service';
import { GestionesService } from './gestiones.service';

/**
 * Dos decisiones se prueban aquí, y las dos son de las que no
 * avisan cuando salen mal:
 *
 *  1. **Quién ve la agenda de quién.** Un asesor ve la suya; ver
 *     la del equipo es organizar el trabajo ajeno.
 *  2. **Que el ámbito acote SIEMPRE.** Es la regla de la casa, y
 *     olvidarla en una sola consulta deja escapar la cuenta del
 *     otro convenio sin que nada falle.
 *
 * Se hace con un Prisma de mentira porque lo que se comprueba es
 * el `where` que se construye, no lo que devuelve la base: si la
 * consulta sale mal armada, ninguna prueba contra datos de
 * ejemplo lo enseñaría —enseñaría filas de más, que parecen
 * filas.
 */
const prismaFalso = () => {
  const gestion = { findMany: jest.fn().mockResolvedValue([]) };
  const oportunidad = { findMany: jest.fn().mockResolvedValue([]) };
  return {
    servicio: new GestionesService({
      gestion,
      oportunidad,
    } as unknown as PrismaService),
    gestion,
    oportunidad,
  };
};

const CONVENIO = 'cnv-britcham';
const OTRO = 'cnv-adecopria';

const quien = (id: string, rol: RolAdmin = RolAdmin.GESTOR) =>
  ({ id, rol, nombre: 'Quien sea' }) as Admin;

const ambitoDe = (...roles: RolConvenio[]): Ambito => ({
  convenios: [CONVENIO],
  todos: false,
  roles: { [CONVENIO]: roles },
  gremioElegido: CONVENIO,
  concedidos: [CONVENIO, OTRO],
  gremioFijo: false,
});

const GESTOR = ambitoDe(RolConvenio.GESTOR_INSCRIPCION);
const LIDER = ambitoDe(RolConvenio.LIDER_INSCRIPCION);

describe('quién mira la agenda de quién', () => {
  it('un gestor ve la suya, y solo la suya', async () => {
    const { servicio, gestion } = prismaFalso();
    await servicio.agenda(quien('yo'), GESTOR, { asesorId: null });

    expect(gestion.findMany.mock.calls[0][0].where.asesorId).toBe('yo');
  });

  it('un gestor no puede pedir la de otro', async () => {
    const { servicio } = prismaFalso();
    await expect(
      servicio.agenda(quien('yo'), GESTOR, { asesorId: 'otro' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ni la del equipo entero', async () => {
    const { servicio } = prismaFalso();
    await expect(
      servicio.agenda(quien('yo'), GESTOR, { asesorId: null, todos: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  /// «Líder» no es una lista nueva: es `REPARTEN_FICHAS`, la
  /// misma decisión ya tomada para repartir leads. Si esa lista
  /// cambia, esta prueba cambia con ella y no se quedan dos
  /// criterios distintos de quién manda.
  it('un líder sí ve la del equipo, sin filtro de asesor', async () => {
    const { servicio, gestion } = prismaFalso();
    await servicio.agenda(quien('jefa'), LIDER, { asesorId: null, todos: true });

    expect(gestion.findMany.mock.calls[0][0].where.asesorId).toBeUndefined();
  });

  it('y la de una persona concreta de su equipo', async () => {
    const { servicio, gestion } = prismaFalso();
    await servicio.agenda(quien('jefa'), LIDER, { asesorId: 'asesor-3' });

    expect(gestion.findMany.mock.calls[0][0].where.asesorId).toBe('asesor-3');
  });

  it('un superadmin manda aunque no tenga rol de convenio', async () => {
    const { servicio, gestion } = prismaFalso();
    await servicio.agenda(quien('root', RolAdmin.SUPERADMIN), GESTOR, {
      asesorId: null,
      todos: true,
    });

    expect(gestion.findMany.mock.calls[0][0].where.asesorId).toBeUndefined();
  });

  it('lo mismo vale para «sin próximo paso»', async () => {
    const { servicio } = prismaFalso();
    await expect(
      servicio.sinProximoPaso(quien('yo'), GESTOR, { asesorId: null, todos: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('el ámbito acota, pase lo que pase', () => {
  it('la agenda solo mira los convenios del ámbito', async () => {
    const { servicio, gestion } = prismaFalso();
    await servicio.agenda(quien('jefa'), LIDER, { asesorId: null, todos: true });

    const { where } = gestion.findMany.mock.calls[0][0];
    expect(where.oportunidad.convenioId).toEqual({ in: [CONVENIO] });
    /// El convenio que su cuenta le concede pero que el gremio
    /// elegido dejó fuera NO puede colarse.
    expect(where.oportunidad.convenioId.in).not.toContain(OTRO);
  });

  it('«sin próximo paso» también', async () => {
    const { servicio, oportunidad } = prismaFalso();
    await servicio.sinProximoPaso(quien('jefa'), LIDER, {
      asesorId: null,
      todos: true,
    });

    expect(oportunidad.findMany.mock.calls[0][0].where.convenioId).toEqual({
      in: [CONVENIO],
    });
  });

  /// El corazón de la consulta: se descartan las oportunidades
  /// que YA tienen un compromiso vigente. `none` y no `some`
  /// negado a mano, y con la medianoche de Bogotá como corte.
  it('descarta las que tienen un compromiso sin vencer', async () => {
    const { servicio, oportunidad } = prismaFalso();
    const jueves = new Date('2026-09-10T17:00:00.000Z');
    await servicio.sinProximoPaso(quien('yo'), GESTOR, { asesorId: null }, jueves);

    const { where } = oportunidad.findMany.mock.calls[0][0];
    expect(where.gestiones.none.hechaEn).toBeNull();
    expect(where.gestiones.none.venceEn.gte.toISOString()).toBe(
      '2026-09-10T05:00:00.000Z',
    );
  });
});
