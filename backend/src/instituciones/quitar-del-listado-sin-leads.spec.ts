/** Quitar del listado una organización que no tiene a nadie. */

/**
 * «No tengo la opción de eliminar, ¿dónde se elimina el que no tiene
 * leads asociados?» (cliente, 30 sep 2026), en Sistemas → Empresas
 * registradas, al lado de la columna «Leads asociados» que acababa de
 * aparecer.
 *
 * Lo que vigila este fichero son las cuatro cosas que hacen que esa
 * acción sea segura:
 *
 *  1. QUITAR ES OCULTAR. Se escribe `activo: false` y NADA MÁS: ningún
 *     `delete`. El NIT de esa organización ya viajó al SENA dentro de
 *     informes entregados, y borrar la fila los deja sin respaldo.
 *  2. SOLO SI NO LE CUELGA NADIE, y lo comprueba el SERVIDOR. Lo que
 *     mande la pantalla no decide: entre que se pintó la tabla y que se
 *     pulsó el botón, alguien pudo mover un lead aquí.
 *  3. CUANDO SE NIEGA, DICE CUÁNTOS. Es lo que explica por qué la
 *     columna que se acaba de leer decía otra cosa.
 *  4. SE PUEDE DESHACER. Sin eso, quitar sería borrar con otro nombre.
 */

import { AuditoriaService, type Entrada } from '../comun/auditoria.service';
import { InstitucionesService } from './instituciones.service';
import { PrismaService } from '../prisma/prisma.service';

const ADMIN = { id: 'admin-ana', nombre: 'Ana Jaramillo' };

const VACIA = {
  id: 'inst-vacia',
  nit: '900111222',
  razonSocial: 'TEXTILES DEL NORTE S.A.S',
  activo: true,
};

const CON_GENTE = {
  id: 'inst-con-gente',
  nit: '900333444',
  razonSocial: 'ALIMENTOS DEL SUR LTDA',
  activo: true,
};

/**
 * Un Prisma de mentira que apunta lo que se le pide.
 *
 * `empresas` es el puente de verdad entre una organización y sus
 * personas: cuelgan de `Empresa` y `Empresa` se une a `Institucion` POR
 * NIT. Se finge igual aquí para que la cuenta que hace el servicio sea
 * la misma que alimenta la columna de la pantalla.
 */
function armar(
  fichas: Array<typeof VACIA>,
  empresas: Array<{ nit: string; participantes: number }>,
) {
  const escritos: Array<{ id: string; data: Record<string, unknown> }> = [];
  const auditado: Entrada[] = [];
  let borrados = 0;

  const prisma = {
    institucion: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(fichas.find((f) => f.id === where.id) ?? null),
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        escritos.push({ id: where.id, data });
        const f = fichas.find((x) => x.id === where.id);
        if (f) Object.assign(f, data);
        return Promise.resolve(f);
      },
      /// Existen para que, si alguien escribiera un borrado de verdad,
      /// la prueba lo CACE en vez de reventar con «no es una función».
      delete: () => {
        borrados += 1;
        return Promise.resolve({});
      },
      deleteMany: () => {
        borrados += 1;
        return Promise.resolve({ count: 1 });
      },
    },
    empresa: {
      findMany: ({ where }: { where: { nit: { in: string[] } } }) =>
        Promise.resolve(
          empresas
            .filter((e) => where.nit.in.includes(e.nit))
            .map((e) => ({
              nit: e.nit,
              _count: { participantes: e.participantes },
            })),
        ),
    },
  } as unknown as PrismaService;

  const auditoria = {
    registrar: (entrada: Entrada) => {
      auditado.push(entrada);
      return Promise.resolve();
    },
  } as unknown as AuditoriaService;

  return {
    servicio: new InstitucionesService(prisma, auditoria),
    fichas,
    escritos,
    auditado,
    cuantosBorrados: () => borrados,
  };
}

describe('quitar del listado: se oculta, no se borra', () => {
  it('sin nadie asociado: la aparta y deja escrito quién lo hizo', async () => {
    const { servicio, escritos, auditado, cuantosBorrados } = armar(
      [{ ...VACIA }],
      /// Hay una empresa con ese NIT, pero sin ninguna persona dentro.
      /// Es el caso que el cliente tiene delante: la columna dice «sin
      /// nadie» porque la última persona se movió a otra organización.
      [{ nit: VACIA.nit, participantes: 0 }],
    );

    const r = await servicio.ocultar(VACIA.id, ADMIN);

    expect(r).toEqual({
      id: VACIA.id,
      razonSocial: VACIA.razonSocial,
      activo: false,
    });

    /// Lo único que se escribe es `activo`.
    expect(escritos).toEqual([{ id: VACIA.id, data: { activo: false } }]);
    expect(cuantosBorrados()).toBe(0);

    expect(auditado).toHaveLength(1);
    expect(auditado[0]).toMatchObject({
      actor: ADMIN,
      accion: 'EMPRESA_OCULTADA',
      entidad: 'institucion',
      entidadId: VACIA.id,
      camposTocados: ['activo'],
    });
    /// El NIT dentro del resumen: es por lo que se buscaría esta
    /// entrada si el SENA pregunta por un informe viejo.
    expect(auditado[0].resumen).toContain(VACIA.nit);
    expect(auditado[0].resumen).toContain(VACIA.razonSocial);
  });

  it('con gente dentro: SE NIEGA, dice cuántos y no toca la fila', async () => {
    const { servicio, escritos, auditado, fichas } = armar(
      [{ ...CON_GENTE }],
      [{ nit: CON_GENTE.nit, participantes: 3 }],
    );

    await expect(servicio.ocultar(CON_GENTE.id, ADMIN)).rejects.toThrow(
      /3 leads/,
    );

    expect(escritos).toEqual([]);
    expect(auditado).toEqual([]);
    /// La fila sigue entera y sigue activa.
    expect(fichas[0]).toMatchObject({ ...CON_GENTE, activo: true });
  });

  it('con una sola persona lo dice en singular', async () => {
    const { servicio } = armar(
      [{ ...CON_GENTE }],
      [{ nit: CON_GENTE.nit, participantes: 1 }],
    );

    await expect(servicio.ocultar(CON_GENTE.id, ADMIN)).rejects.toThrow(
      /1 lead asociado/,
    );
  });

  it('cuenta TODAS las empresas que comparten el NIT, no la primera', async () => {
    /// Un mismo NIT puede tener varias filas en `Empresa` —una por
    /// convenio, o por cómo se escribió el nombre—. Quedarse con una
    /// sola daría un cero falso, y un cero falso es permiso para
    /// apartar una organización con gente dentro.
    const { servicio } = armar(
      [{ ...CON_GENTE }],
      [
        { nit: CON_GENTE.nit, participantes: 0 },
        { nit: CON_GENTE.nit, participantes: 2 },
      ],
    );

    await expect(servicio.ocultar(CON_GENTE.id, ADMIN)).rejects.toThrow(
      /2 leads/,
    );
  });

  it('sin ninguna empresa con ese NIT también se puede apartar', async () => {
    /// No hay ni una fila en `Empresa`: nadie puede colgar de ella.
    const { servicio, fichas } = armar([{ ...VACIA }], []);

    await servicio.ocultar(VACIA.id, ADMIN);

    expect(fichas[0].activo).toBe(false);
  });

  it('la que no existe no se inventa', async () => {
    const { servicio } = armar([{ ...VACIA }], []);

    await expect(servicio.ocultar('no-existe', ADMIN)).rejects.toThrow(
      /ninguna institución/,
    );
  });
});

describe('devolver al listado: quitar se puede desandar', () => {
  it('la oculta vuelve a estar activa y queda auditado', async () => {
    const { servicio, escritos, auditado, fichas } = armar(
      [{ ...VACIA, activo: false }],
      [{ nit: VACIA.nit, participantes: 0 }],
    );

    const r = await servicio.mostrar(VACIA.id, ADMIN);

    expect(r).toEqual({
      id: VACIA.id,
      razonSocial: VACIA.razonSocial,
      activo: true,
    });
    expect(fichas[0].activo).toBe(true);
    expect(escritos).toEqual([{ id: VACIA.id, data: { activo: true } }]);
    expect(auditado[0]).toMatchObject({
      accion: 'EMPRESA_MOSTRADA',
      entidad: 'institucion',
      entidadId: VACIA.id,
    });
  });

  it('devolver NO exige que siga sin leads: se desanda un error', async () => {
    /// Mientras estuvo oculta alguien pudo asignarle personas. Exigirle
    /// cero aquí dejaría la fila atrapada fuera del listado.
    const { servicio, fichas } = armar(
      [{ ...CON_GENTE, activo: false }],
      [{ nit: CON_GENTE.nit, participantes: 5 }],
    );

    await servicio.mostrar(CON_GENTE.id, ADMIN);

    expect(fichas[0].activo).toBe(true);
  });

  it('repetir la acción no vuelve a escribir ni a auditar', async () => {
    /// Dos personas pueden estar limpiando el mismo listado. Que la
    /// segunda no falle, pero tampoco apunte un cambio que no ocurrió.
    const { servicio, escritos, auditado } = armar(
      [{ ...VACIA, activo: false }],
      [],
    );

    await servicio.ocultar(VACIA.id, ADMIN);

    expect(escritos).toEqual([]);
    expect(auditado).toEqual([]);
  });
});

describe('el listado sabe pedir las ocultas', () => {
  /// `listar` filtra por `activo`, así que las apartadas son justo las
  /// que nunca enseña. Sin esta puerta, quitar no tendría vuelta atrás.
  function espiarWhere() {
    const vistos: Array<Record<string, unknown>> = [];
    const prisma = {
      $transaction: (promesas: Promise<unknown>[]) => Promise.all(promesas),
      institucion: {
        findMany: ({ where }: { where: Record<string, unknown> }) => {
          vistos.push(where);
          return Promise.resolve([]);
        },
        count: () => Promise.resolve(0),
      },
      empresa: { findMany: () => Promise.resolve([]) },
    } as unknown as PrismaService;

    const servicio = new InstitucionesService(prisma, {
      registrar: () => Promise.resolve(),
    } as unknown as AuditoriaService);
    return { servicio, vistos };
  }

  it('por defecto trae las activas', async () => {
    const { servicio, vistos } = espiarWhere();
    await servicio.listar({});
    expect(vistos[0]).toMatchObject({ activo: true });
  });

  it('con `soloOcultas` trae las apartadas', async () => {
    const { servicio, vistos } = espiarWhere();
    await servicio.listar({ soloOcultas: true });
    expect(vistos[0]).toMatchObject({ activo: false });
  });
});
