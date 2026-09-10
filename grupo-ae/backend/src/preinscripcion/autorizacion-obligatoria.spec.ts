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
    convenio: {
      findFirst: () => Promise.resolve({ id: 'c1', nombre: 'ADECOPRIA' }),
    },
    oferta: {
      findFirst: () => Promise.resolve({ id: 'o1', accionFormacionId: 'af1' }),
    },
    politicaDatos: {
      findFirst: () => Promise.resolve(conPolitica ? { id: 'p1' } : null),
    },
    persona: {
      /// Null: la cédula NO estaba. Es el camino que prueban
      /// estos casos —alguien que se registra por primera
      /// vez— y el único en el que se devuelve el token.
      findUnique: () => Promise.resolve(null),
      upsert: anota('persona', 'upsert', { id: 'per1' }),
    },
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
      create: anota('enlaceCompletado', 'create', {
        id: 'e1',
        token: 'ESTE-TOKEN-NO-PUEDE-SALIR',
        expiraEn: new Date('2026-12-31T00:00:00Z'),
      }),
    },
    consultaRui: { findFirst: () => Promise.resolve(null) },
    propuestaDeDatos: {
      deleteMany: anota('propuestaDeDatos', 'deleteMany', { count: 0 }),
      create: anota('propuestaDeDatos', 'create', { id: 'pr1' }),
    },
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
  // la auditoria no es lo que se prueba aqui: se traga las
  // llamadas y no estorba
  const auditoria = { registrar: () => Promise.resolve() };
  /// El correo no es lo que se prueba aqui: se traga las
  /// llamadas y devuelve «apagado», que es lo que hace de
  /// verdad cuando no hay SMTP configurado.
  const correo = { enviar: () => Promise.resolve({ estado: 'APAGADO' }) };
  const s = new PreinscripcionService(
    prisma as never,
    cola as never,
    auditoria as never,
    correo as never,
    { agregarManual: () => Promise.resolve(null) } as never,
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
      s.registrar('adecopria', { ...BASE, aceptaPolitica: false }),
    ).rejects.toThrow(/política de tratamiento/i);
    expect(prisma.escrituras).toEqual([]);
  });

  it('aceptando, entra Y queda la constancia', async () => {
    const { s, prisma } = servicio();

    await s.registrar('adecopria', { ...BASE, aceptaPolitica: true });

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

    await s.registrar('adecopria', BASE);

    expect(prisma.escrituras.map((e) => e.tabla)).toContain('persona');
  });
});

/// El falso, con las piezas que una prueba concreta necesita
/// cambiar. Sin esto, TypeScript fija el tipo de
/// `persona.findUnique` en «devuelve null» a partir de la
/// primera versión y no deja sustituirla.
type Falso = {
  escrituras: Array<{ tabla: string; metodo: string }>;
  persona: {
    findUnique: () => Promise<unknown>;
    upsert: (args: { update: Record<string, unknown> }) => Promise<unknown>;
  };
};

describe('el enlace no se le entrega a quien solo sabe una cédula', () => {
  /// La ficha que abre ese enlace lleva la dirección, el
  /// celular, el estrato y la caracterización de población
  /// vulnerable. Quien llena el formulario público es un
  /// desconocido: lo único que demuestra es saberse un número
  /// que está en cualquier fotocopia.

  it('cédula NUEVA: se devuelve el token', async () => {
    // no hay nada que proteger: la ficha solo tiene lo que él
    // mismo acaba de escribir
    const { s } = servicio();
    const r = (await s.registrar('adecopria', {
      ...BASE,
      aceptaPolitica: true,
    } as never)) as { token: string | null; yaEstaba: boolean };

    expect(r.yaEstaba).toBe(false);
    expect(r.token).toBe('ESTE-TOKEN-NO-PUEDE-SALIR');
  });

  it('cédula QUE YA ESTABA: no sale token por ninguna parte', async () => {
    const prisma = prismaFalso(true) as unknown as Falso;
    prisma.persona.findUnique = () =>
      Promise.resolve({ id: 'per1', correo: 'dueña@x.co', celular: '300' });

    const cola = { encolarSiHaceFalta: () => Promise.resolve() };
    const auditoria = { registrar: () => Promise.resolve() };
    const correo = { enviar: () => Promise.resolve({ estado: 'ENVIADO' }) };
    const s = new PreinscripcionService(
      prisma as never,
      cola as never,
      auditoria as never,
      correo as never,
    { agregarManual: () => Promise.resolve(null) } as never,
    );

    const r = (await s.registrar('adecopria', {
      ...BASE,
      aceptaPolitica: true,
    } as never)) as { token: string | null; yaEstaba: boolean };

    expect(r.yaEstaba).toBe(true);
    expect(r.token).toBeNull();
    // y la respuesta ENTERA, por si mañana alguien añade un
    // campo y se lo lleva de vuelta sin darse cuenta
    expect(JSON.stringify(r)).not.toContain('ESTE-TOKEN-NO-PUEDE-SALIR');
  });

  it('el correo del formulario NO pisa el que ya estaba', async () => {
    // un POST con la cédula de otra persona y un correo propio
    // desviaba hacia el atacante todo lo que se le mandara
    // después, sin que la dueña notara nada
    const prisma = prismaFalso(true) as unknown as Falso;
    prisma.persona.findUnique = () =>
      Promise.resolve({ id: 'per1', correo: 'dueña@x.co', celular: '3001' });

    let loQueSeEscribio: Record<string, unknown> = {};
    prisma.persona.upsert = (args) => {
      loQueSeEscribio = args.update;
      return Promise.resolve({ id: 'per1' });
    };

    const s = new PreinscripcionService(
      prisma as never,
      { encolarSiHaceFalta: () => Promise.resolve() } as never,
      { registrar: () => Promise.resolve() } as never,
      { enviar: () => Promise.resolve({ estado: 'ENVIADO' }) } as never,
        { agregarManual: () => Promise.resolve(null) } as never,
    );

    await s.registrar('adecopria', {
      ...BASE,
      correo: 'atacante@mail.com',
      celular: '3009999999',
      aceptaPolitica: true,
    } as never);

    expect(loQueSeEscribio.correo).toBe('dueña@x.co');
    expect(loQueSeEscribio.celular).toBe('3001');
  });
});

describe('la misma cédula que vuelve con otro correo', () => {
  /// La cédula es la llave. Cuando alguien se registra otra
  /// vez con otro correo hay dos posibilidades y desde el
  /// formulario no se distinguen: o es ella y cambió de
  /// correo, o alguien escribió mal la cédula. Ninguna se
  /// resuelve sin hablar con alguien.

  function conCedulaConocida() {
    const prisma = prismaFalso(true) as unknown as Falso & {
      propuestaDeDatos: { create: (a: unknown) => Promise<unknown> };
    };
    prisma.persona.findUnique = () =>
      Promise.resolve({
        id: 'per1',
        correo: 'suyo@x.co',
        celular: '3001',
        primerNombre: 'María',
        segundoNombre: null,
        primerApellido: 'Bustos',
        segundoApellido: null,
        generoSepId: null,
        fechaNacimiento: null,
        estrato: null,
        departamentoSepId: null,
        municipioSepId: null,
        barrio: null,
        direccion: null,
      });

    const s = new PreinscripcionService(
      prisma as never,
      { encolarSiHaceFalta: () => Promise.resolve() } as never,
      { registrar: () => Promise.resolve() } as never,
      { enviar: () => Promise.resolve({ estado: 'ENVIADO' }) } as never,
        { agregarManual: () => Promise.resolve(null) } as never,
    );
    return { s, prisma };
  }

  it('lo guardado NO se pisa', async () => {
    const { s, prisma } = conCedulaConocida();
    let escrito: Record<string, unknown> = {};
    prisma.persona.upsert = (a) => {
      escrito = a.update;
      return Promise.resolve({ id: 'per1' });
    };

    await s.registrar('adecopria', {
      ...BASE,
      correo: 'otro@mail.com',
      aceptaPolitica: true,
    } as never);

    expect(escrito.correo).toBe('suyo@x.co');
  });

  it('pero lo nuevo TAMPOCO se tira: queda como propuesta', async () => {
    // descartarlo en silencio deja sin recibir nada a quien de
    // verdad cambió de correo, y nadie se entera
    const { s, prisma } = conCedulaConocida();
    await s.registrar('adecopria', {
      ...BASE,
      correo: 'otro@mail.com',
      aceptaPolitica: true,
    } as never);

    const propuestas = prisma.escrituras.filter(
      (e) => e.tabla === 'propuestaDeDatos',
    );
    expect(propuestas.length).toBeGreaterThan(0);
  });

  it('una cédula NUEVA no genera propuesta: no hay nada que comparar', async () => {
    const { s, prisma } = servicio();
    await s.registrar('adecopria', { ...BASE, aceptaPolitica: true } as never);

    expect(
      prisma.escrituras.filter((e) => e.tabla === 'propuestaDeDatos'),
    ).toHaveLength(0);
  });
});
