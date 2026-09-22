/** El informe de reservas cuadra, y no enseña el gremio de otro. */

/**
 * Los defectos que esto viene a impedir, cada uno ya visto:
 *
 *  1. Dos tablas que dicen ser lo mismo y suman distinto. El PDF del
 *     cliente trae la Tabla 1 (por acción) y la Tabla 2 (por
 *     organización dentro de cada acción), cada una con su «Suma
 *     total». Si una se calcula con un WHERE y la otra con otro —una
 *     se olvida de las canceladas, otra acota el «sin nombre» por fila—
 *     los dos pies dicen cifras distintas y ninguno parece equivocado.
 *     Aquí se fija que la suma por acción, la suma por organización,
 *     las filas del cruce y los totales dan EXACTAMENTE lo mismo.
 *
 *  2. El «sin nombre» negativo o que se come lo ajeno. En la base
 *     local hay una reserva con 10 cupos y 12 matriculados. Sin acotar
 *     salía −2; acotado solo al agrupar, las dos personas de más se
 *     comían los huecos de OTRA reserva de la misma organización.
 *
 *  3. Dos «AF1» sumados en una fila. El código solo es único por
 *     convenio; agrupar por código mezcla los dos gremios. Pasó en el
 *     propio análisis de este encargo: salían «8 acciones» donde hay 13.
 *
 *  4. El filtro que sustituye al ámbito en vez de intersecarlo. Una
 *     cuenta de ADECOPRIA pidiendo `?convenioId=<BRITCHAM>` tiene que
 *     recibir un informe VACÍO, nunca el de BRITCHAM. Es el defecto de
 *     `interseca-no-sustituye.spec`, que ya pasó dos veces.
 *
 *  5. Filtros que no significan nada para una reserva (asesor, grupo,
 *     etapa) aceptados «para que filtre como los demás». Darían cero o
 *     el informe entero según el JOIN.
 *
 * No hay base de datos: `armarInforme` es una función pura sobre las
 * filas, y para el ámbito se usa un Prisma falso que APLICA los
 * filtros de verdad sobre una lista en memoria —uno que devolviera
 * siempre todo probaría el doble, no la cerradura—.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  armarInforme,
  consultaDeAcciones,
  consultaDeReservas,
  filtrosDelInforme,
  informeDeReservas,
  type AccionCruda,
  type InformeReservas,
  type ReservaCruda,
} from './informe-de-reservas';

// ── datos de prueba ──────────────────────────────────────────────
// La forma de la base local, en pequeño: los dos gremios, un AF1 en
// cada uno, la reserva con más gente que cupos, una en lista de
// espera, una cancelada y una acción sin ninguna reserva.

const BRI = 'conv-britcham';
const ADE = 'conv-adecopria';

const accion = (
  id: string,
  codigo: string,
  convenio: 'britcham-adee' | 'adecopria',
  techo: number,
  meta: number,
): AccionCruda => ({
  accionFormacionId: id,
  codigo,
  nombre: `${codigo} de ${convenio}`,
  convenio,
  convenioSigla: convenio === 'adecopria' ? 'ADECOPRIA' : 'BRITCHAM ADEE',
  modalidad: 'VIRTUAL',
  horas: 40,
  cuposDelProyecto: BigInt(techo),
  metaComprometida: BigInt(meta),
});

const ACCIONES: AccionCruda[] = [
  accion('af1-bri', 'AF1', 'britcham-adee', 520, 400),
  accion('af4-bri', 'AF4', 'britcham-adee', 195, 150),
  accion('af8-bri', 'AF8', 'britcham-adee', 650, 500),
  accion('af1-ade', 'AF1', 'adecopria', 520, 400),
  // sin ninguna reserva: tiene que salir, y su techo tiene que sumar
  accion('af5-ade', 'AF5', 'adecopria', 78, 60),
];

let secuencia = 0;
function reserva(p: {
  accion: AccionCruda;
  empresa: string;
  ubicacion: string;
  dia: string;
  confirmados: number;
  enEspera?: number;
  solicitados?: number;
  conNombre?: number;
  estado?: ReservaCruda['estado'];
}): ReservaCruda {
  secuencia += 1;
  return {
    id: `r${secuencia}`,
    estado: p.estado ?? 'CONFIRMADA',
    // la base devuelve bigint para los COUNT y los SUM: se mezcla a
    // propósito para que un `+` sin convertir se note
    solicitados: BigInt(p.solicitados ?? p.confirmados + (p.enEspera ?? 0)),
    confirmados: p.confirmados,
    enEspera: BigInt(p.enEspera ?? 0),
    dia: p.dia,
    accionFormacionId: p.accion.accionFormacionId,
    codigo: p.accion.codigo,
    accion: p.accion.nombre,
    convenio: p.accion.convenio,
    convenioSigla: p.accion.convenioSigla,
    modalidad: p.accion.modalidad,
    horas: p.accion.horas,
    empresaId: `emp-${p.empresa}`,
    nit: `9001${p.empresa.length}`,
    digitoVerificacion: '1',
    razonSocial: p.empresa,
    ubicacionId: `ub-${p.ubicacion}`,
    ubicacion: p.ubicacion,
    tipoUbicacion: 'DEPARTAMENTO',
    conNombre: BigInt(p.conNombre ?? 0),
  };
}

const [AF1B, AF4B, AF8B, AF1A] = ACCIONES;

const RESERVAS: ReservaCruda[] = [
  // más gente que cupos: 10 cupos, 12 personas (el caso real)
  reserva({
    accion: AF1B,
    empresa: 'Logística Sur',
    ubicacion: 'BOGOTÁ D.C',
    dia: '2026-07-02',
    confirmados: 10,
    conNombre: 12,
  }),
  // la misma organización, otra acción, con huecos: no se los puede
  // comer la sobra de la de arriba
  reserva({
    accion: AF8B,
    empresa: 'Logística Sur',
    ubicacion: 'CAUCA',
    dia: '2026-07-10',
    confirmados: 8,
    conNombre: 2,
  }),
  // la misma acción en dos ubicaciones: UN par con dos reservas
  reserva({
    accion: AF1B,
    empresa: 'Maderas',
    ubicacion: 'BOLÍVAR',
    dia: '2026-07-17',
    confirmados: 13,
    enEspera: 2,
    conNombre: 1,
  }),
  reserva({
    accion: AF1B,
    empresa: 'Maderas',
    ubicacion: 'CALDAS',
    dia: '2026-07-20',
    confirmados: 6,
  }),
  // lista de espera: cero cupos confirmados, la división por cero
  reserva({
    accion: AF4B,
    empresa: 'Chía Ltda',
    ubicacion: 'CHÍA',
    dia: '2026-07-20',
    confirmados: 0,
    enEspera: 5,
    estado: 'LISTA_ESPERA',
  }),
  // el otro AF1, de ADECOPRIA, reservado por la misma organización
  reserva({
    accion: AF1A,
    empresa: 'Maderas',
    ubicacion: 'ANTIOQUIA',
    dia: '2026-08-03',
    confirmados: 11,
    conNombre: 1,
  }),
  reserva({
    accion: AF1A,
    empresa: 'Colegio Montessori',
    ubicacion: 'ANTIOQUIA',
    dia: '2026-08-03',
    confirmados: 9,
    conNombre: 4,
  }),
  // cancelada, con gente colgada: ni sus cupos ni su gente cuentan
  reserva({
    accion: AF1A,
    empresa: 'Liceo Moderno',
    ubicacion: 'CALDAS',
    dia: '2026-08-05',
    confirmados: 0,
    solicitados: 17,
    conNombre: 3,
    estado: 'CANCELADA',
  }),
];

const RECORTE: InformeReservas['recorte'] = {
  convenios: [],
  accion: null,
  ubicacion: null,
  desde: null,
  hasta: null,
  incluyeCanceladas: false,
};

const armar = (o: { incluyeCanceladas?: boolean; tope?: number } = {}) =>
  armarInforme({
    reservas: RESERVAS,
    acciones: ACCIONES,
    recorte: { ...RECORTE, incluyeCanceladas: o.incluyeCanceladas ?? false },
    generadoEn: new Date('2026-09-21T15:00:00.000Z'),
    tope: o.tope,
  });

const CIFRAS = [
  'reservas',
  'cuposConfirmados',
  'cuposEnEspera',
  'conNombre',
  'sinNombre',
  'nombresDeMas',
] as const;

const suma = <T>(filas: T[], clave: keyof T) =>
  filas.reduce((s, f) => s + (f[clave] as unknown as number), 0);

// ── 1. las tablas cuadran ────────────────────────────────────────

describe('las dos tablas del PDF y los totales dicen lo mismo', () => {
  for (const incluyeCanceladas of [false, true]) {
    describe(
      incluyeCanceladas ? 'con las canceladas dentro' : 'sin las canceladas',
      () => {
        const informe = armar({ incluyeCanceladas });

        it.each(CIFRAS)(
          '%s: por acción = cruce = por organización = total',
          (clave) => {
            const total = informe.totales[clave];
            expect(suma(informe.porAccion, clave)).toBe(total);
            expect(suma(informe.cruce, clave)).toBe(total);
            expect(suma(informe.porOrganizacion, clave)).toBe(total);
          },
        );

        it('las gráficas suman lo mismo que las tablas', () => {
          expect(suma(informe.porUbicacion, 'reservas')).toBe(
            informe.totales.reservas,
          );
          expect(suma(informe.porUbicacion, 'cuposConfirmados')).toBe(
            informe.totales.cuposConfirmados,
          );
          expect(suma(informe.porDia, 'reservas')).toBe(
            informe.totales.reservas,
          );
          expect(suma(informe.porDia, 'cupos')).toBe(
            informe.totales.cuposConfirmados,
          );
        });

        it('el donut de estados suma el total de verdad, canceladas incluidas', () => {
          /// Con dos estados en vez de tres, el pie del donut mentía.
          expect(informe.porEstado.map((e) => e.estado)).toEqual([
            'CONFIRMADA',
            'LISTA_ESPERA',
            'CANCELADA',
          ]);
          const fuera = incluyeCanceladas
            ? 0
            : informe.totales.reservasCanceladas;
          expect(suma(informe.porEstado, 'reservas')).toBe(
            informe.totales.reservas + fuera,
          );
        });

        it('«pares» es el número de filas de la Tabla 2', () => {
          expect(informe.totales.pares).toBe(informe.cruce.length);
          expect(informe.totales.organizaciones).toBe(
            informe.porOrganizacion.length,
          );
        });

        it('en TODA fila: sinNombre = cupos − conNombre + nombresDeMas', () => {
          for (const f of [
            ...informe.porAccion,
            ...informe.cruce,
            ...informe.porOrganizacion,
            informe.totales,
          ]) {
            expect(f.sinNombre).toBe(
              f.cuposConfirmados - f.conNombre + f.nombresDeMas,
            );
            expect(f.sinNombre).toBeGreaterThanOrEqual(0);
          }
        });

        it('ningún número sale NaN ni infinito (la fila en lista de espera)', () => {
          const numeros: number[] = [];
          JSON.stringify(informe, (_k, v: unknown) => {
            if (typeof v === 'number') numeros.push(v);
            return v;
          });
          expect(numeros.length).toBeGreaterThan(0);
          expect(numeros.every(Number.isFinite)).toBe(true);
        });
      },
    );
  }
});

// ── 2. el «sin nombre» ───────────────────────────────────────────

describe('el «sin nombre» se acota en la reserva, que es donde está el cupo', () => {
  const informe = armar();
  const logistica = informe.porOrganizacion.find(
    (o) => o.razonSocial === 'Logística Sur',
  )!;

  it('la reserva con 12 personas en 10 cupos no da un −2', () => {
    const par = informe.cruce.find(
      (c) =>
        c.razonSocial === 'Logística Sur' && c.accionFormacionId === 'af1-bri',
    )!;
    expect(par.sinNombre).toBe(0);
    expect(par.nombresDeMas).toBe(2);
  });

  it('y su sobra no llena los huecos de su otra acción', () => {
    /// 18 cupos y 14 personas: acotado sobre la organización saldrían
    /// 4 sin nombre. Pero las dos de más están en AF1 y los seis
    /// huecos en AF8: siguen siendo seis.
    expect(logistica.cuposConfirmados).toBe(18);
    expect(logistica.conNombre).toBe(14);
    expect(logistica.sinNombre).toBe(6);
  });

  it('una reserva cancelada no aporta gente aunque la tenga colgada', () => {
    const conCanceladas = armar({ incluyeCanceladas: true });
    const liceo = conCanceladas.porOrganizacion.find(
      (o) => o.razonSocial === 'Liceo Moderno',
    )!;
    expect(liceo.conNombre).toBe(0);
    expect(conCanceladas.totales.conNombre).toBe(informe.totales.conNombre);
  });
});

// ── 3. la llave es la acción, no su código ───────────────────────

describe('dos «AF1» de dos gremios son dos filas', () => {
  const informe = armar();

  it('la Tabla 1 los separa', () => {
    const af1 = informe.porAccion.filter((a) => a.codigo === 'AF1');
    expect(af1.map((a) => a.accionFormacionId).sort()).toEqual([
      'af1-ade',
      'af1-bri',
    ]);
    expect(af1.map((a) => a.convenio).sort()).toEqual([
      'adecopria',
      'britcham-adee',
    ]);
  });

  it('«acciones» cuenta las que tienen reservas, no los códigos distintos', () => {
    /// AF1, AF4, AF8 de BRITCHAM y AF1 de ADECOPRIA: cuatro, aunque
    /// solo haya tres códigos distintos.
    expect(informe.totales.acciones).toBe(4);
  });

  it('la organización que reservó los dos dice de qué gremio es cada uno', () => {
    const maderas = informe.porOrganizacion.find(
      (o) => o.razonSocial === 'Maderas',
    )!;
    expect(maderas.acciones).toEqual([
      'AF1 · ADECOPRIA',
      'AF1 · BRITCHAM ADEE',
    ]);
  });

  it('una organización que repite acción en dos ubicaciones es UN par con 2', () => {
    const par = informe.cruce.find(
      (c) => c.razonSocial === 'Maderas' && c.accionFormacionId === 'af1-bri',
    )!;
    expect(par.reservas).toBe(2);
    expect(par.ubicaciones).toEqual(['BOLÍVAR', 'CALDAS']);
    expect(par.primeraReserva).toBe('2026-07-17');
    expect(par.ultimaReserva).toBe('2026-07-20');
  });

  it('la Tabla 2 va agrupada en el orden de la Tabla 1, como el PDF', () => {
    const orden = informe.porAccion.map((a) => a.accionFormacionId);
    const posiciones = informe.cruce.map((c) =>
      orden.indexOf(c.accionFormacionId),
    );
    expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b));
  });
});

// ── 4. canceladas, techo y tope ──────────────────────────────────

describe('lo que va aparte no se pierde', () => {
  it('las canceladas se cuentan SIEMPRE, se pidan o no en las tablas', () => {
    const sin = armar();
    const con = armar({ incluyeCanceladas: true });

    expect(sin.totales.reservasCanceladas).toBe(1);
    expect(sin.totales.cuposCancelados).toBe(17);
    expect(con.totales.reservasCanceladas).toBe(1);

    // fuera de las tablas por omisión...
    expect(sin.cruce.some((c) => c.razonSocial === 'Liceo Moderno')).toBe(
      false,
    );
    // ...dentro cuando se piden, sin mover los cupos
    expect(con.cruce.some((c) => c.razonSocial === 'Liceo Moderno')).toBe(true);
    expect(con.totales.reservas).toBe(sin.totales.reservas + 1);
    expect(con.totales.cuposConfirmados).toBe(sin.totales.cuposConfirmados);

    // y en la fila de su acción, aunque no entre en la tabla
    const af1a = sin.porAccion.find((a) => a.accionFormacionId === 'af1-ade')!;
    expect(af1a.reservasCanceladas).toBe(1);
    expect(af1a.cuposCancelados).toBe(17);
  });

  it('la acción sin reservas sale, y el techo del total es la suma de las filas', () => {
    const informe = armar();
    const af5 = informe.porAccion.find(
      (a) => a.accionFormacionId === 'af5-ade',
    )!;
    expect(af5.reservas).toBe(0);
    expect(af5.cuposDelProyecto).toBe(78);

    expect(informe.totales.cuposDelProyecto).toBe(520 + 195 + 650 + 520 + 78);
    expect(suma(informe.porAccion, 'cuposDelProyecto')).toBe(
      informe.totales.cuposDelProyecto,
    );
    expect(suma(informe.porAccion, 'metaComprometida')).toBe(
      informe.totales.metaComprometida,
    );
  });

  it('con el tope, la tabla se corta, lo DICE y los totales siguen enteros', () => {
    const entero = armar();
    const cortado = armar({ tope: 2 });

    expect(cortado.cruce).toHaveLength(2);
    expect(cortado.truncado).toBe(true);
    expect(cortado.totales).toEqual(entero.totales);
    expect(entero.truncado).toBe(false);
  });

  it('porDia trae solo los días con algo, en orden', () => {
    const dias = armar().porDia.map((d) => d.dia);
    expect(dias).toEqual([...new Set(dias)].sort());
    expect(dias).not.toContain('2026-08-05'); // el de la cancelada
  });
});

// ── 5. el ámbito ─────────────────────────────────────────────────

type Conv = {
  id: string;
  slug: string;
  sigla: string | null;
  nombre: string;
  orden: number;
};
const CONVENIOS: Conv[] = [
  {
    id: BRI,
    slug: 'britcham-adee',
    sigla: 'BRITCHAM ADEE',
    nombre: 'UT',
    orden: 0,
  },
  { id: ADE, slug: 'adecopria', sigla: 'ADECOPRIA', nombre: 'ASOC', orden: 1 },
];

/** Aplica de verdad el `where` que se usa para los convenios. */
function cumple(c: Conv, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([clave, valor]) => {
    if (clave === 'AND')
      return (valor as Record<string, unknown>[]).every((w) => cumple(c, w));
    const v = valor as { in?: string[] } | string;
    const propio = c[clave as keyof Conv];
    if (typeof v === 'object' && v && Array.isArray(v.in))
      return v.in.includes(propio as string);
    return propio === v;
  });
}

type Sql = { sql: string; values: unknown[] };

function prismaFalso(acciones: Array<{ id: string; convenioId: string }> = []) {
  const consultas: Sql[] = [];
  const dondeAcciones: unknown[] = [];
  const prisma = {
    convenio: {
      findMany: (q: { where: Record<string, unknown> }) =>
        Promise.resolve(CONVENIOS.filter((c) => cumple(c, q.where))),
    },
    accionFormacion: {
      findFirst: (q: {
        where: { id: string; convenioId: { in: string[] } };
      }) => {
        dondeAcciones.push(q.where);
        const a = acciones.find(
          (x) =>
            x.id === q.where.id && q.where.convenioId.in.includes(x.convenioId),
        );
        return Promise.resolve(
          a ? { id: a.id, codigo: 'AF1', nombre: 'X' } : null,
        );
      },
    },
    ubicacion: {
      findUnique: () => Promise.resolve({ id: 'ub', nombre: 'BOGOTÁ D.C' }),
    },
    $queryRaw: (sql: Sql) => {
      consultas.push(sql);
      return Promise.resolve([]);
    },
  };
  return { prisma: prisma as never, consultas, dondeAcciones };
}

describe('el filtro se interseca con el ámbito, nunca lo sustituye', () => {
  it('sin ámbito no se consulta nada y sale vacío', async () => {
    const { prisma, consultas } = prismaFalso();
    const informe = await informeDeReservas(prisma, [], { convenioId: ADE });

    expect(consultas).toHaveLength(0);
    expect(informe.totales.reservas).toBe(0);
    expect(informe.recorte.convenios).toEqual([]);
  });

  it('una cuenta de ADECOPRIA que pide BRITCHAM recibe VACÍO, no BRITCHAM', async () => {
    /// La que importa. Pedir uno de fuera devuelve vacío, nunca todo.
    for (const filtro of [{ convenioId: BRI }, { convenio: 'britcham-adee' }]) {
      const { prisma, consultas } = prismaFalso();
      const informe = await informeDeReservas(prisma, [ADE], filtro);

      expect(informe.recorte.convenios).toEqual([]);
      expect(consultas).toHaveLength(0);
    }
  });

  it('pidiendo el suyo, el recorte es ese y el SQL no nombra el otro', async () => {
    const { prisma, consultas } = prismaFalso();
    const informe = await informeDeReservas(prisma, [ADE], { convenioId: ADE });

    expect(informe.recorte.convenios.map((c) => c.id)).toEqual([ADE]);
    expect(consultas).toHaveLength(2);
    for (const q of consultas) expect(q.values).not.toContain(BRI);
  });

  it('con los dos en el ámbito y uno pedido, el otro solo está en el candado', async () => {
    /// El candado del guard (ámbito entero) va SIEMPRE y el recorte
    /// debajo, en otro AND. BRITCHAM aparece una vez —en el candado—
    /// y ADECOPRIA dos: candado y recorte.
    const { prisma, consultas } = prismaFalso();
    await informeDeReservas(prisma, [BRI, ADE], { convenioId: ADE });

    for (const q of consultas) {
      expect(q.values.filter((v) => v === BRI)).toHaveLength(1);
      expect(q.values.filter((v) => v === ADE)).toHaveLength(2);
    }
  });

  it('si llegan id y slug, manda el id', async () => {
    const { prisma } = prismaFalso();
    const informe = await informeDeReservas(prisma, [BRI, ADE], {
      convenioId: ADE,
      convenio: 'britcham-adee',
    });
    expect(informe.recorte.convenios.map((c) => c.slug)).toEqual(['adecopria']);
  });

  it('la acción se busca dentro del ámbito; una de fuera es 404', async () => {
    const acciones = [{ id: 'af1-bri', convenioId: BRI }];
    const { prisma, dondeAcciones } = prismaFalso(acciones);

    await expect(
      informeDeReservas(prisma, [ADE], { accionFormacionId: 'af1-bri' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(dondeAcciones[0]).toMatchObject({ convenioId: { in: [ADE] } });
  });
});

describe('la consulta de reservas', () => {
  const texto = consultaDeReservas([BRI, ADE], [ADE], {
    desde: '2026-08-01',
    hasta: '2026-08-31',
    accionFormacionId: 'af1',
    ubicacionId: 'ub1',
  }).sql;

  it('lleva el candado de ambito.ts, no una copia', () => {
    expect(texto).toContain('EXISTS');
    expect(texto).toMatch(/af\."convenioId" IN/);
  });

  it('corta por el día de BOGOTÁ dicho por su nombre, nunca contra NOW()', () => {
    /// NOW() contra una columna sin zona depende del TimeZone de la
    /// sesión: Bogotá en local, UTC en el servidor. La misma ventana
    /// arrancaba cinco horas antes allá.
    expect(texto).toContain("AT TIME ZONE 'UTC' AT TIME ZONE");
    expect(texto).toContain('::date');
    expect(texto).not.toMatch(/NOW\(\)/i);
  });

  it('cuenta «con nombre» con el MISMO criterio que el bloque de Control', () => {
    /// Primera matrícula (llegó alguna vez a INSCRITO), sin ventana, y
    /// sin las reservas canceladas. Con otro criterio el informe abría
    /// con 11 donde el bloque desde el que se hizo clic dice 13.
    expect(texto).toContain('primera_matricula');
    expect(texto).toContain("'INSCRITO'");
    expect(texto).toContain('"momento" IS NOT NULL');
    expect(texto).toContain("<> 'CANCELADA'");
  });

  it('el techo y la meta no se recortan por fechas', () => {
    const acciones = consultaDeAcciones([ADE], [ADE], {
      desde: '2026-08-01',
      hasta: '2026-08-31',
    });
    expect(acciones.values).not.toContain('2026-08-01');
    expect(acciones.sql).not.toContain('creadoEn');
  });
});

// ── 6. los filtros que existen, y ninguno más ────────────────────

describe('el informe acepta cinco filtros y descarta el resto', () => {
  it('asesor, grupo, etapa, búsqueda, paginación y ámbito no pasan', () => {
    const f = filtrosDelInforme({
      convenioId: ADE,
      asesorId: 'as1',
      grupoId: 'g1',
      etapa: 'INSCRITO',
      departamentoSepId: '5',
      buscar: 'colegio',
      pagina: '2',
      porPagina: '1',
      rango: 'semana',
      ambito: BRI,
    });
    expect(Object.keys(f).sort()).toEqual(
      [
        'accionFormacionId',
        'convenio',
        'convenioId',
        'desde',
        'hasta',
        'incluirCanceladas',
        'ubicacionId',
      ].sort(),
    );
    expect(f.convenioId).toBe(ADE);
    expect(JSON.stringify(f)).not.toContain(BRI);
  });

  it('las canceladas van fuera por omisión, y «false» entre comillas es NO', () => {
    expect(filtrosDelInforme({}).incluirCanceladas).toBe(false);
    expect(
      filtrosDelInforme({ incluirCanceladas: 'false' }).incluirCanceladas,
    ).toBe(false);
    expect(
      filtrosDelInforme({ incluirCanceladas: 'true' }).incluirCanceladas,
    ).toBe(true);
  });

  it('una fecha que no se entiende no se ignora en silencio', () => {
    for (const malo of ['2026-02-30', '21/09/2026', '2026-9-1', 'ayer']) {
      expect(() => filtrosDelInforme({ desde: malo })).toThrow(
        BadRequestException,
      );
    }
    expect(() =>
      filtrosDelInforme({ desde: '2026-09-10', hasta: '2026-09-01' }),
    ).toThrow(BadRequestException);
    expect(
      filtrosDelInforme({ desde: '2026-09-01', hasta: '2026-09-01' }).hasta,
    ).toBe('2026-09-01');
  });

  it('un gremio repetido en la consulta no se resuelve eligiendo uno', () => {
    expect(() => filtrosDelInforme({ convenioId: [ADE, BRI] })).toThrow(
      BadRequestException,
    );
  });
});
