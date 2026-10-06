/** Corregir una organización, y el candado del NIT repetido. */

/**
 * SE PRUEBA EL SERVICIO Y NO LA REGLA SUELTA, que es donde esta casa
 * se llevó el susto con `cambiarEtapa`: los predicados salían bien y
 * el defecto vivía en quien los llamaba.
 *
 * Lo que se fija aquí:
 *
 * - Que el NIT SE PUEDA corregir. Era el encargo: «al momento de
 *   ajustar o corregir un número de NIT no me lo permite» (cliente,
 *   28 sep 2026).
 * - Que NO se pueda pisar el de otra organización, porque eso no es
 *   corregir: es fundir dos, y eso mueve reservas y leads.
 * - Que el cambio quede AUDITADO con las dos cifras. Es el que
 *   arrastra los leads detrás.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';

import { TablerosService } from './tableros.service';

type FilaEmpresa = { id: string; nit: string; razonSocial: string };

function armar(empresas: FilaEmpresa[]) {
  const auditado: Array<Record<string, unknown>> = [];
  const escrito: Record<string, unknown> = {};

  const prisma = {
    empresa: {
      findUnique: ({ where }: { where: { id?: string; nit?: string } }) =>
        Promise.resolve(
          empresas.find(
            (e) =>
              (where.id !== undefined && e.id === where.id) ||
              (where.nit !== undefined && e.nit === where.nit),
          ) ?? null,
        ),
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        escrito.id = where.id;
        escrito.data = data;
        return Promise.resolve({ id: where.id, ...data });
      },
    },
  };

  const auditoria = {
    registrar: (e: Record<string, unknown>) => {
      auditado.push(e);
      return Promise.resolve();
    },
  };

  return {
    servicio: new TablerosService(prisma as never, auditoria as never),
    auditado,
    escrito,
  };
}

const ACTOR = { id: 'ana', nombre: 'Ana Jaramillo' };

const UNA: FilaEmpresa = {
  id: 'e1',
  nit: '900111222',
  razonSocial: 'Colegio Uno',
};
const OTRA: FilaEmpresa = {
  id: 'e2',
  nit: '900333444',
  razonSocial: 'Colegio Dos',
};

describe('corregir una organización', () => {
  it('deja corregir el NIT, que es lo que no se podía', async () => {
    const { servicio, escrito } = armar([UNA, OTRA]);

    await servicio.editarEmpresa('e1', { nit: '900111999' }, ACTOR);

    expect(escrito.id).toBe('e1');
    expect(escrito.data).toMatchObject({ nit: '900111999' });
  });

  /// LO QUE NO SE MANDA NO SE TOCA. Corregir el NIT no puede borrar
  /// el teléfono que alguien capturó hace un mes.
  it('no toca los campos que no vienen', async () => {
    const { servicio, escrito } = armar([UNA]);

    await servicio.editarEmpresa(
      'e1',
      { razonSocial: 'Colegio Uno S.A.S.' },
      ACTOR,
    );

    expect(Object.keys(escrito.data as object)).toEqual(['razonSocial']);
  });

  /**
   * EL CANDADO. Poner el NIT de otra no es corregir: es decir que las
   * dos son la misma, y eso mueve las reservas y los leads de una a
   * la otra. Es una decisión de una persona, no de un PATCH.
   */
  it('no deja pisar el NIT de otra organización', async () => {
    const { servicio, escrito } = armar([UNA, OTRA]);

    await expect(
      servicio.editarEmpresa('e1', { nit: '900333444' }, ACTOR),
    ).rejects.toThrow(BadRequestException);

    /// Y no se guarda NADA: ni los otros campos que vinieran en el
    /// mismo envío.
    expect(escrito.data).toBeUndefined();
  });

  /// El mensaje DICE CUÁL es la otra. Sin el nombre, quien lo lee no
  /// sabe adónde ir a mirar y acaba probando NIT por NIT.
  it('el error dice de quién es ese NIT', async () => {
    const { servicio } = armar([UNA, OTRA]);

    await expect(
      servicio.editarEmpresa('e1', { nit: '900333444' }, ACTOR),
    ).rejects.toThrow(/Colegio Dos/);
  });

  /// Guardar el MISMO NIT que ya tiene no es un choque consigo misma.
  it('guardar su propio NIT sin cambios no choca', async () => {
    const { servicio, escrito } = armar([UNA]);

    await servicio.editarEmpresa(
      'e1',
      { nit: '900111222', razonSocial: 'Colegio Uno' },
      ACTOR,
    );

    expect(escrito.data).toMatchObject({ nit: '900111222' });
  });

  it('una organización que no existe no se inventa', async () => {
    const { servicio } = armar([UNA]);

    await expect(
      servicio.editarEmpresa('no-existe', { nit: '900111999' }, ACTOR),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('el registro de lo que se cambió', () => {
  /// CON LAS DOS CIFRAS. El día que alguien pregunte «¿por qué esta
  /// ficha está en otra empresa?», la respuesta tiene que estar
  /// escrita, no deducirse.
  it('el cambio de NIT queda escrito de qué a qué', async () => {
    const { servicio, auditado } = armar([UNA]);

    await servicio.editarEmpresa('e1', { nit: '900111999' }, ACTOR);

    expect(auditado).toHaveLength(1);
    expect(auditado[0]).toMatchObject({
      accion: 'EMPRESA_EDITADA',
      entidad: 'empresa',
      entidadId: 'e1',
    });
    expect(auditado[0].resumen).toContain('900111222');
    expect(auditado[0].resumen).toContain('900111999');
  });

  it('apunta qué campos se tocaron', async () => {
    const { servicio, auditado } = armar([UNA]);

    await servicio.editarEmpresa(
      'e1',
      { razonSocial: 'Otra cosa', telefono: '3001112233' },
      ACTOR,
    );

    expect(auditado[0].camposTocados).toEqual(['razonSocial', 'telefono']);
  });

  /// Y quién lo hizo: un registro sin actor no sirve para nada.
  it('deja quién lo hizo', async () => {
    const { servicio, auditado } = armar([UNA]);

    await servicio.editarEmpresa('e1', { telefono: '3001112233' }, ACTOR);

    expect(auditado[0].actor).toEqual(ACTOR);
  });
});
