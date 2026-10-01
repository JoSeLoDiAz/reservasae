/** La bandeja «Por revisar» tiene que poder quedar vacía. */

/**
 * El cliente lo dijo el 30 de septiembre de 2026: «esto al final
 * debemos darle cierre porque no se ha logrado solucionar». En su
 * entorno tenía 45 propuestas esperando y nunca bajaban.
 *
 * No era que nadie las revisara. Eran tres cosas, y este fichero
 * vigila las tres:
 *
 *  1. DESCARTAR NO TENÍA MEMORIA. Al descartar un campo, el campo
 *     quedaba vacío en la ficha, y vacío era justo la condición
 *     para que la siguiente consulta del mismo NIT lo propusiera
 *     otra vez. La bandeja se rellenaba sola con lo ya rechazado.
 *  2. NO SE PODÍA RESOLVER EN LOTE. De a una, entre dos y siete
 *     clics cada una: hasta 315 para vaciarla.
 *  3. ACEPTAR DATOS DEL BUSCADOR DEJABA LA FICHA VERIFICADA, y por
 *     tanto reportable al SENA, cuando la propia pantalla promete
 *     que lo sugerido no se reporta hasta que alguien lo compruebe.
 */

import { AuditoriaService } from '../comun/auditoria.service';
import { InstitucionesService } from './instituciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { fichaAPropuesta } from './web/ficha-a-propuesta';
import { leerFichaWeb } from './web/leer-ficha-web';

const ADMIN = 'admin-ana';
const FICHA = 'institucion-abc';

/// La ficha completa, con todo lo obligatorio puesto. Se usa para
/// el caso de la verificación automática: es el único escenario en
/// el que la regla vieja se disparaba.
const COMPLETA = {
  id: FICHA,
  razonSocial: 'ABC LABORATORIOS S.A.S',
  nombreComercial: 'ABC LABORATORIOS',
  direccion: 'Calle 24 # 27A-56',
  telefono: '(601) 518-6600',
  ciudadNombre: 'Bogotá D.C.',
  departamentoNombre: 'Cundinamarca',
  sectorEconomico: 'MANUFACTURA',
  codigoCiiu: '3290',
  clasificacion: 'EMPRESA_PRIVADA',
  tamano: 'PEQUENA',
  verificadaEn: null as Date | null,
  fuentePorCampo: {} as Record<string, string>,
};

type Propuesta = {
  id: string;
  estado: string;
  campos: Record<string, unknown>;
  fuente: string;
  institucionId: string;
};

/// Un Prisma de mentira que apunta lo que se le pide. Solo hay
/// que mirar DOS cosas: qué filas de descarte se guardaron y qué
/// se escribió sobre la institución.
/// Copia nueva en cada prueba: la ficha se MUTA (ver `update`), y
/// compartir el objeto haría que una prueba arrastrara a la
/// siguiente.
function armar(
  propuestas: Propuesta[],
  ficha: typeof COMPLETA = { ...COMPLETA, fuentePorCampo: {} },
) {
  const descartes: Array<Record<string, unknown>> = [];
  const escritosEnFicha: Array<Record<string, unknown>> = [];
  const propuestasResueltas: Array<{ ids: string[]; estado: string }> = [];

  const prisma = {
    propuestaInstitucion: {
      findUnique: ({ where }: { where: { id: string } }) => {
        const p = propuestas.find((x) => x.id === where.id);
        return Promise.resolve(
          p
            ? {
                id: p.id,
                estado: p.estado,
                campos: p.campos,
                fuente: p.fuente,
                institucionId: p.institucionId,
                institucion: {
                  id: p.institucionId,
                  fuentePorCampo: ficha.fuentePorCampo,
                },
              }
            : null,
        );
      },
      findMany: ({
        where,
      }: {
        where: { id: { in: string[] }; estado: string };
      }) =>
        Promise.resolve(
          propuestas.filter(
            (p) => where.id.in.includes(p.id) && p.estado === where.estado,
          ),
        ),
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: { estado: string };
      }) => {
        propuestasResueltas.push({ ids: [where.id], estado: data.estado });
        const p = propuestas.find((x) => x.id === where.id);
        if (p) p.estado = data.estado;
        return Promise.resolve({});
      },
      updateMany: ({
        where,
        data,
      }: {
        where: { id: { in: string[] } };
        data: { estado: string };
      }) => {
        propuestasResueltas.push({ ids: where.id.in, estado: data.estado });
        for (const p of propuestas) {
          if (where.id.in.includes(p.id)) p.estado = data.estado;
        }
        return Promise.resolve({ count: where.id.in.length });
      },
    },
    descarteDeCampo: {
      createMany: ({ data }: { data: Array<Record<string, unknown>> }) => {
        descartes.push(...data);
        return Promise.resolve({ count: data.length });
      },
      findMany: () => Promise.resolve([]),
    },
    institucion: {
      update: ({ data }: { data: Record<string, unknown> }) => {
        escritosEnFicha.push(data);
        /// Se aplica de verdad sobre la ficha, no solo se apunta:
        /// la regla de la verificación automática VUELVE a leerla
        /// después de escribir, y con una ficha congelada el
        /// `fuentePorCampo` nunca llegaría a decir WEB --o sea que
        /// la prueba pasaría por el motivo equivocado--.
        Object.assign(ficha, data);
        return Promise.resolve(ficha);
      },
      findUnique: () => Promise.resolve(ficha),
    },
  } as unknown as PrismaService;

  const auditoria = {
    registrar: () => Promise.resolve(),
  } as unknown as AuditoriaService;

  return {
    servicio: new InstitucionesService(prisma, auditoria),
    descartes,
    escritosEnFicha,
    propuestasResueltas,
  };
}

describe('1 · lo descartado NO vuelve a proponerse', () => {
  it('al descartar se guarda el par campo+valor, no solo el campo', async () => {
    const { servicio, descartes } = armar([
      {
        id: 'p1',
        estado: 'PENDIENTE',
        campos: { telefono: '(601) 518-6600', correo: 'ventas@abc.com' },
        fuente: 'WEB',
        institucionId: FICHA,
      },
    ]);

    await servicio.aplicarPropuesta('p1', { campos: [] }, ADMIN);

    expect(descartes).toHaveLength(2);
    const telefono = descartes.find((d) => d.campo === 'telefono');
    expect(telefono).toMatchObject({
      institucionId: FICHA,
      /// Normalizado: así «(601) 518-6600» y el mismo valor con
      /// otro espaciado cuentan como el mismo rechazo.
      valor: '(601) 518-6600',
      valorMostrado: '(601) 518-6600',
      fuente: 'WEB',
      descartadoPorId: ADMIN,
    });
  });

  it('lo que se aceptó no se apunta como descartado, lo que se dejó sin marcar sí', async () => {
    const { servicio, descartes } = armar([
      {
        id: 'p1',
        estado: 'PENDIENTE',
        campos: { telefono: '6015186600', direccion: 'Calle 1' },
        fuente: 'WEB',
        institucionId: FICHA,
      },
    ]);

    await servicio.aplicarPropuesta('p1', { campos: ['telefono'] }, ADMIN);

    expect(descartes.map((d) => d.campo)).toEqual(['direccion']);
  });

  it('el buscador NO vuelve a proponer el teléfono descartado, pero sí otro distinto', () => {
    const ficha = leerFichaWeb(
      'Razón social: ABC LABORATORIOS S.A.S.Teléfono: (601) 518-6600' +
        'Dirección: Calle 24 # 27A-56',
    );

    /// LA REGRESIÓN DE FONDO. La ficha tiene el teléfono VACÍO
    /// --porque alguien acaba de descartarlo-- y antes eso era
    /// justo la condición para proponerlo otra vez.
    const sinMemoria = fichaAPropuesta(ficha, { telefono: null });
    expect(sinMemoria.telefono).toBe('(601) 518-6600');

    const conMemoria = fichaAPropuesta(
      ficha,
      { telefono: null },
      new Set(['telefono\u0000(601) 518-6600']),
    );
    expect(conMemoria.telefono).toBeUndefined();
    /// La dirección no se descartó: esa sigue proponiéndose.
    expect(conMemoria.direccion).toBe('Calle 24 # 27A-56');

    /// Y si el buscador trae OTRO teléfono, ese sí entra: lo que
    /// se rechazó es un valor, no el campo para siempre.
    const otro = leerFichaWeb('Teléfono: (601) 999-0000');
    expect(
      fichaAPropuesta(
        otro,
        { telefono: null },
        new Set(['telefono\u0000(601) 518-6600']),
      ).telefono,
    ).toBe('(601) 999-0000');
  });
});

describe('2 · el lote descarta varias de una', () => {
  it('cierra todas las pendientes de la lista y recuerda todo lo rechazado', async () => {
    const { servicio, descartes, propuestasResueltas } = armar([
      {
        id: 'p1',
        estado: 'PENDIENTE',
        campos: { telefono: '111' },
        fuente: 'WEB',
        institucionId: FICHA,
      },
      {
        id: 'p2',
        estado: 'PENDIENTE',
        campos: { correo: 'a@b.com', direccion: 'Calle 2' },
        fuente: 'WEB',
        institucionId: FICHA,
      },
      /// Ya resuelta: no es un error, dos personas pueden estar
      /// vaciando la misma bandeja.
      {
        id: 'p3',
        estado: 'DESCARTADA',
        campos: { tamano: 'GRANDE' },
        fuente: 'WEB',
        institucionId: FICHA,
      },
    ]);

    const r = await servicio.descartarVarias(['p1', 'p2', 'p3'], ADMIN);

    expect(r).toEqual({ descartadas: 2, yaResueltas: 1 });
    expect(propuestasResueltas).toEqual([
      { ids: ['p1', 'p2'], estado: 'DESCARTADA' },
    ]);
    expect(descartes.map((d) => d.campo).sort()).toEqual([
      'correo',
      'direccion',
      'telefono',
    ]);
  });

  it('descartar en lote no escribe NADA en ninguna ficha', async () => {
    const { servicio, escritosEnFicha } = armar([
      {
        id: 'p1',
        estado: 'PENDIENTE',
        campos: { telefono: '111' },
        fuente: 'WEB',
        institucionId: FICHA,
      },
    ]);

    await servicio.descartarVarias(['p1'], ADMIN);

    expect(escritosEnFicha).toEqual([]);
  });
});

describe('3 · aceptar datos del buscador NO verifica la institución', () => {
  it('con un campo de fuente WEB la ficha completa NO queda verificada', async () => {
    const { servicio, escritosEnFicha } = armar([
      {
        id: 'p1',
        estado: 'PENDIENTE',
        campos: { telefono: '(601) 518-6600' },
        fuente: 'WEB',
        institucionId: FICHA,
      },
    ]);

    await servicio.aplicarPropuesta('p1', { campos: ['telefono'] }, ADMIN);

    /// El dato entra --la persona lo autorizó-- con su fuente WEB.
    expect(escritosEnFicha[0]).toMatchObject({
      telefono: '(601) 518-6600',
      fuentePorCampo: { telefono: 'WEB' },
    });
    /// Pero NADIE firma la ficha: «sugerido, sin verificar» no
    /// puede convertirse en VERIFICADA y reportable al SENA por el
    /// camino de aceptar una propuesta.
    expect(
      escritosEnFicha.some(
        (e) => 'verificadaEn' in e || 'verificadaPorId' in e,
      ),
    ).toBe(false);
  });

  it('del RUES sí: es fuente oficial y la ficha queda aprobada', async () => {
    const { servicio, escritosEnFicha } = armar([
      {
        id: 'p1',
        estado: 'PENDIENTE',
        campos: { telefono: '(601) 518-6600' },
        fuente: 'RUES',
        institucionId: FICHA,
      },
    ]);

    await servicio.aplicarPropuesta('p1', { campos: ['telefono'] }, ADMIN);

    expect(escritosEnFicha.some((e) => 'verificadaEn' in e)).toBe(true);
  });
});
