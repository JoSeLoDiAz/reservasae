/** El caso de AF6: se dicta en Medellín y admite a los de Rionegro. */

/**
 * «Los de AF6, que es en Medellín, así la persona sea de Rionegro debe
 * permitir inscribirla; esto ya lo había indicado, no quedó» (cliente,
 * 30 sep 2026).
 *
 * SE PRUEBA LA PUERTA QUE BLOQUEABA ---`asignar`---, no el predicado
 * suelto. `cubreA` ya tiene su propio spec, y ahí no estaba lo que él
 * veía: lo que él veía era que asignar la oferta lanzaba «no se puede
 * inscribir a esta persona en esa acción: corresponde escribirle un
 * correo de agradecimiento». Eso es lo que hay que ver caer.
 *
 * Es la lección de `cambiar-etapa`: los predicados salían bien y el
 * defecto vivía en quien los llamaba. Una prueba que solo mirara
 * `cubreA` pasaría mañana aunque alguien volviera a poner el candado
 * aquí.
 *
 * CON LOS IDS DEL DANE Y NO CON NOMBRES, porque es lo que guarda la
 * ficha: el servicio traduce 5615 a «RIONEGRO» por el catálogo del
 * SEP. Un doble que le pasara el nombre ya masticado no probaría esa
 * traducción, que es justo por donde se escapan los errores de sede.
 *
 * Y SE FIJA LA FRONTERA QUE SE QUEDA: alguien de Bogotá sigue sin
 * poder entrar al presencial de Medellín. Sin esa segunda mitad, el
 * encargo se podría «cumplir» quitando la comprobación entera.
 */

import { BadRequestException } from '@nestjs/common';

import { CrmService } from './crm.service';
import { cubreA } from './cobertura';

/// Los de verdad, sacados del catálogo del SEP.
const ANTIOQUIA = 5;
const MEDELLIN = 5001;
const RIONEGRO = 5615;
const APARTADO = 5045;
const BOGOTA = 11;
const BOGOTA_CIUDAD = 11001;

const EN_MEDELLIN = {
  nombre: 'MEDELLÍN',
  tipo: 'CIUDAD',
  departamento: 'ANTIOQUIA',
};

function armar(vive: { departamentoSepId: number; municipioSepId: number }) {
  const escrito: Array<Record<string, unknown>> = [];

  const prisma = {
    participante: {
      /// Sirve a las tres consultas de `asignar`: la del guard del
      /// ámbito, la de la ficha y la de `dondeVive`, que es la que
      /// lee los ids del SEP.
      findUnique: () =>
        Promise.resolve({
          id: 'p-1',
          convenioId: 'c-adecopria',
          personaId: 'per-1',
          accionFormacionId: null,
          etapa: 'INTERESADO',
          ofertaId: null,
          coberturaId: null,
          persona: vive,
        }),
      findFirst: () => Promise.resolve(null),
      count: () => Promise.resolve(0),
      update: (a: Record<string, unknown>) => {
        escrito.push(a);
        return Promise.resolve({ id: 'p-1' });
      },
    },
    oferta: {
      findUnique: () =>
        Promise.resolve({
          id: 'of-af6',
          cuposMaximos: 100,
          accionFormacionId: 'af6',
          ubicacionId: 'u-med',
          abierta: true,
          ubicacion: EN_MEDELLIN,
          accionFormacion: {
            convenioId: 'c-adecopria',
            codigo: 'AF6',
            nombre: 'GOBERNANZA',
          },
        }),
    },
  };

  const servicio = new CrmService(
    prisma as never,
    { registrar: () => Promise.resolve() } as never,
    {} as never,
    {} as never,
    {} as never,
    { avisar: () => Promise.resolve() } as never,
    /// El catálogo de notas. Devuelve «sin clasificar», que es lo
    /// que anota una pantalla que todavía no ofrece los
    /// desplegables: ninguno de estos tests clasifica nada.
    {
      exigirClasificacion: () =>
        Promise.resolve({ categoriaId: null, subcategoriaId: null }),
    } as never,
  );

  const asignar = () =>
    (
      servicio as unknown as {
        asignar: (
          id: string,
          dto: unknown,
          admin: unknown,
          ambito: string[],
          ip?: string,
        ) => Promise<unknown>;
      }
    ).asignar(
      'p-1',
      { ofertaId: 'of-af6' },
      { id: 'a-1', nombre: 'Ana', rol: 'SUPERADMIN' },
      ['c-adecopria'],
      '1.2.3.4',
    );

  return { asignar, escrito };
}

/// Lo que de verdad se vigila: que NO caiga por la sede. El doble no
/// es una base, así que puede tropezar más adelante por otra cosa; lo
/// que no puede es rechazar por cobertura.
async function rechazoPorSede(asignar: () => Promise<unknown>) {
  try {
    await asignar();
    return null;
  } catch (e) {
    if (!(e instanceof BadRequestException)) return null;
    return /no cubre|correo de agradecimiento/i.test(e.message)
      ? e.message
      : null;
  }
}

describe('AF6 se dicta en Medellín', () => {
  /// EL ENCARGO, dicho sobre la puerta que él usa.
  it('deja inscribir a alguien de Rionegro', async () => {
    const { asignar } = armar({
      departamentoSepId: ANTIOQUIA,
      municipioSepId: RIONEGRO,
    });

    expect(await rechazoPorSede(asignar)).toBeNull();
  });

  it('y a alguien de Apartadó, que también es Antioquia', async () => {
    const { asignar } = armar({
      departamentoSepId: ANTIOQUIA,
      municipioSepId: APARTADO,
    });

    expect(await rechazoPorSede(asignar)).toBeNull();
  });

  it('a los de Medellín, como siempre', async () => {
    const { asignar } = armar({
      departamentoSepId: ANTIOQUIA,
      municipioSepId: MEDELLIN,
    });

    expect(await rechazoPorSede(asignar)).toBeNull();
  });

  /**
   * LA FRONTERA QUE SE QUEDA. Si esto pasara, la ficha quedaría con
   * grupo, el tablero la contaría como lista, y el error aparecería
   * el día que la persona no llega al curso.
   */
  it('pero NO a alguien de Bogotá, y lo dice', async () => {
    const { asignar, escrito } = armar({
      departamentoSepId: BOGOTA,
      municipioSepId: BOGOTA_CIUDAD,
    });

    const motivo = await rechazoPorSede(asignar);
    expect(motivo).toMatch(/no cubre/i);
    expect(motivo).toMatch(/BOGOT/i);
    /// Y no escribe nada: el rechazo es antes de tocar la ficha.
    expect(escrito).toHaveLength(0);
  });
});

/// La regla suelta, con los nombres que el catálogo le da a esos ids.
/// Va detrás y no delante: primero la puerta, que es lo que falla.
describe('la regla de cobertura, por si alguien la toca', () => {
  it('una ciudad cubre su departamento', () => {
    expect(
      cubreA(EN_MEDELLIN, { departamento: 'ANTIOQUIA', ciudad: 'RIONEGRO' }),
    ).toBe(true);
  });

  it('y no cubre otro departamento', () => {
    expect(
      cubreA(EN_MEDELLIN, {
        departamento: 'BOGOTÁ D.C.',
        ciudad: 'BOGOTÁ D.C.',
      }),
    ).toBe(false);
  });
});
