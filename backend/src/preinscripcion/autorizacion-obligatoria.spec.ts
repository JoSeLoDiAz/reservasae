/** Sin aceptar la política no se guarda nada. */

/**
 * Es la compuerta de la Ley 1581: la persona entrega cédula,
 * fecha de nacimiento, celular y correo, y lo único que
 * legitima tenerlos es su autorización.
 *
 * El único candado estaba en el navegador. El DTO la declara
 * opcional y la constancia se dejaba dentro de un `if`, así que
 * un POST directo metía a la persona en la base SIN la
 * constancia que hay que poder demostrar. Se comprueba que no
 * se escribe NADA, que es lo que importa: el código de error
 * puede cambiar, el dato dentro de la base no.
 */

import { BadRequestException } from '@nestjs/common';

import { PreinscripcionService } from './preinscripcion.service';

type Llamada = { tabla: string; metodo: string };

/** Un Prisma de mentira que anota lo que se le escribe. */
function prismaFalso(conPolitica: boolean) {
  const escrituras: Llamada[] = [];

  const anota = (tabla: string, metodo: string, valor: unknown) => () => {
    escrituras.push({ tabla, metodo });
    return Promise.resolve(valor);
  };

  return {
    escrituras,
    convenio: { findFirst: () => Promise.resolve({ id: 'c1' }) },
    oferta: {
      findFirst: () => Promise.resolve({ id: 'o1', accionFormacionId: 'af1' }),
    },
    politicaDatos: {
      findFirst: () => Promise.resolve(conPolitica ? { id: 'p1' } : null),
    },
    persona: { upsert: anota('persona', 'upsert', { id: 'per1' }) },
    participante: {
      findFirst: () => Promise.resolve(null),
      create: anota('participante', 'create', { id: 'par1' }),
    },
    autorizacionDatos: {
      findFirst: () => Promise.resolve(null),
      create: anota('autorizacionDatos', 'create', { id: 'a1' }),
    },
    enlaceCompletado: {
      updateMany: anota('enlaceCompletado', 'updateMany', { count: 0 }),
      create: anota('enlaceCompletado', 'create', { id: 'e1' }),
    },
    consultaRui: { findFirst: () => Promise.resolve(null) },
  };
}

const BASE = {
  ofertaId: 'o1',
  tipoDocumentoSepId: 1,
  numeroDocumento: '1019456782',
  primerNombre: 'Ana',
  primerApellido: 'Jaramillo',
  celular: '3001234567',
  correo: 'ana@ejemplo.test',
};

function servicio(conPolitica = true) {
  const prisma = prismaFalso(conPolitica);
  const cola = { encolarSiHaceFalta: () => Promise.resolve() };
  const s = new PreinscripcionService(
    prisma as never,
    cola as never,
  );
  return { s, prisma };
}

describe('la autorización de datos es obligatoria en el servidor', () => {
  it('sin el campo no se crea la persona', async () => {
    const { s, prisma } = servicio();

    await expect(s.registrar('adecopria', BASE as never)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.escrituras).toEqual([]);
  });

  it('mandando false tampoco: el rechazo explícito no cuela', async () => {
    const { s, prisma } = servicio();

    await expect(
      s.registrar('adecopria', { ...BASE, aceptaPolitica: false } as never),
    ).rejects.toThrow(/política de tratamiento/i);
    expect(prisma.escrituras).toEqual([]);
  });

  it('aceptando, entra Y queda la constancia', async () => {
    const { s, prisma } = servicio();

    await s.registrar('adecopria', { ...BASE, aceptaPolitica: true } as never);

    const tablas = prisma.escrituras.map((e) => e.tabla);
    expect(tablas).toContain('persona');
    expect(tablas).toContain('participante');
    // la constancia no es opcional: es la prueba
    expect(tablas).toContain('autorizacionDatos');
  });

  it('sin política publicada no se bloquea a nadie', async () => {
    /// Si el convenio no tiene el texto todavía, exigir que lo
    /// acepte sería cerrar el formulario público por una tarea
    /// pendiente nuestra. Entra, y no hay constancia porque no
    /// hay nada que constatar.
    const { s, prisma } = servicio(false);

    await s.registrar('adecopria', BASE as never);

    expect(prisma.escrituras.map((e) => e.tabla)).toContain('persona');
  });
});
