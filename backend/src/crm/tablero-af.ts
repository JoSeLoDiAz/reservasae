import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { diaBogota } from '../comun/dia-bogota';
import { DEPARTAMENTOS_SEP } from './catalogos-sep.generado';

/**
 * El informe por acción de formación.
 *
 * Cruza lo que las hojas del cliente cruzaban a mano: por cada
 * acción —y si se pide, por cada grupo— cuántos leads llegaron
 * de cada departamento, por qué puerta entraron, y en qué
 * quedaron.
 *
 * Las puertas son las de ESTE sistema y no las de HubSpot. El
 * CRM guarda doce orígenes y además si el lead vino de una pauta
 * pagada, así que se agrupan en tres canastas que responden la
 * pregunta que se hace al mirar esto: ¿de dónde salió esta gente
 * y cuál de los tres caminos vale la pena?
 */

/// Las tres canastas. `PAUTA` manda sobre el origen: un lead de
/// Instagram que llegó por un anuncio pagado es campaña pagada,
/// no red orgánica -- si no, la pauta se contaría como si la
/// gente hubiera llegado sola.
export type Canasta = 'DIRECTO' | 'PAGADA' | 'ORGANICA';

export const ETIQUETA_CANASTA: Record<Canasta, string> = {
  DIRECTO: 'Directo y referidos',
  PAGADA: 'Campaña pagada',
  ORGANICA: 'Redes orgánicas',
};

/// Los que NO son digitales: alguien los trajo.
const DE_MANO = ['EMPRESA', 'ASESOR', 'REFERIDO', 'EVENTO', 'CORREO', 'OTRO'];

export type FilaDelTablero = {
  departamento: string;
  directo: number;
  pagada: number;
  organica: number;
  interesados: number;
  inscritos: number;
  descartados: number;
  total: number;
};

export type AccionDelTablero = {
  id: string;
  codigo: string;
  nombre: string;
  convenio: string;
  grupos: Array<{ id: string; numero: number; etiqueta: string }>;
};

export type TableroAf = {
  acciones: AccionDelTablero[];
  filas: FilaDelTablero[];
  totales: Omit<FilaDelTablero, 'departamento'>;
  /// Para el gráfico de canastas, ya sumado.
  porCanasta: Array<{ canasta: Canasta; etiqueta: string; total: number }>;
  /// Cómo se comportó cada día, hasta hoy.
  serie: Array<{ dia: string; llegaron: number; inscritos: number }>;
  /// Cuánto convierte cada canasta. Es la cifra que decide dónde
  /// poner el dinero: el volumen dice cuál trae más, no cuál
  /// trae mejor.
  conversion: Array<{
    canasta: Canasta;
    etiqueta: string;
    base: number;
    inscritos: number;
    tasa: number;
  }>;
};

const VACIO: TableroAf = {
  acciones: [],
  filas: [],
  totales: {
    directo: 0,
    pagada: 0,
    organica: 0,
    interesados: 0,
    inscritos: 0,
    descartados: 0,
    total: 0,
  },
  porCanasta: [],
  serie: [],
  conversion: [],
};

/// Las etapas que cuentan como «se inscribió»: se mira el HECHO
/// de haber llegado al aula, no el estado de hoy. Quien ya cursa
/// o se certificó llegó a inscrito igual.
const LLEGO_A_INSCRITO = [
  'INSCRITO',
  'EN_FORMACION',
  'CERTIFICADO',
  'NO_APROBO',
  'DESERTO',
  'ABANDONO',
  'RETIRADO',
];

/// Y las de salida sin haber entrado.
const DESCARTADO = ['PERDIDO'];

export async function tableroPorAccion(
  prisma: PrismaService,
  ambito: string[],
  filtros: { accionFormacionId?: string; coberturaId?: string },
): Promise<TableroAf> {
  if (ambito.length === 0) return VACIO;

  const acciones = await prisma.accionFormacion.findMany({
    where: { convenioId: { in: ambito } },
    orderBy: [{ convenio: { nombre: 'asc' } }, { orden: 'asc' }],
    select: {
      id: true,
      codigo: true,
      nombre: true,
      convenio: { select: { sigla: true, nombre: true } },
      grupos: {
        orderBy: { numero: 'asc' },
        select: {
          numero: true,
          coberturas: { select: { id: true, ubicacion: { select: { nombre: true } } } },
        },
      },
    },
  });

  const catalogo: AccionDelTablero[] = acciones.map((a) => ({
    id: a.id,
    codigo: a.codigo,
    nombre: a.nombre,
    convenio: a.convenio.sigla ?? a.convenio.nombre,
    grupos: a.grupos.flatMap((g) =>
      g.coberturas.map((c) => ({
        id: c.id,
        numero: g.numero,
        etiqueta: `Grupo ${g.numero} · ${c.ubicacion.nombre}`,
      })),
    ),
  }));

  /// Sin acción elegida no se cruza nada: el informe es POR
  /// accion, y sumar las quince daría el tablero general que ya
  /// existe dos pantallas más arriba.
  if (!filtros.accionFormacionId) {
    return { ...VACIO, acciones: catalogo };
  }

  const condiciones: Prisma.Sql[] = [
    Prisma.sql`p."convenioId" IN (${Prisma.join(ambito)})`,
    Prisma.sql`p."accionFormacionId" = ${filtros.accionFormacionId}`,
  ];
  if (filtros.coberturaId) {
    condiciones.push(Prisma.sql`p."coberturaId" = ${filtros.coberturaId}`);
  }

  const filas = await prisma.$queryRaw<
    Array<{
      departamentoId: number | null;
      canasta: Canasta;
      inscrito: boolean;
      descartado: boolean;
      total: bigint;
    }>
  >(Prisma.sql`
    SELECT
      per."departamentoSepId" AS "departamentoId",
      CASE
        WHEN p."origenLead" = 'PAUTA' THEN 'PAGADA'
        WHEN p."origen"::text IN (${Prisma.join(DE_MANO)}) THEN 'DIRECTO'
        ELSE 'ORGANICA'
      END AS canasta,
      (p."etapa"::text IN (${Prisma.join(LLEGO_A_INSCRITO)})) AS inscrito,
      (p."etapa"::text IN (${Prisma.join(DESCARTADO)})) AS descartado,
      COUNT(*) AS total
    FROM "participantes" p
    JOIN "personas" per ON per."id" = p."personaId"
    WHERE ${Prisma.join(condiciones, ' AND ')}
    GROUP BY 1, 2, 3, 4
  `);

  const porDepto = new Map<string, FilaDelTablero>();
  const canastas: Record<Canasta, { base: number; inscritos: number }> = {
    DIRECTO: { base: 0, inscritos: 0 },
    PAGADA: { base: 0, inscritos: 0 },
    ORGANICA: { base: 0, inscritos: 0 },
  };

  for (const f of filas) {
    const nombre =
      DEPARTAMENTOS_SEP.find((d) => d.id === f.departamentoId)?.etiqueta ??
      'Sin departamento';
    const fila =
      porDepto.get(nombre) ??
      ({
        departamento: nombre,
        directo: 0,
        pagada: 0,
        organica: 0,
        interesados: 0,
        inscritos: 0,
        descartados: 0,
        total: 0,
      } satisfies FilaDelTablero);

    const n = Number(f.total);
    if (f.canasta === 'DIRECTO') fila.directo += n;
    else if (f.canasta === 'PAGADA') fila.pagada += n;
    else fila.organica += n;

    if (f.inscrito) fila.inscritos += n;
    else if (f.descartado) fila.descartados += n;
    else fila.interesados += n;

    fila.total += n;
    porDepto.set(nombre, fila);

    canastas[f.canasta].base += n;
    if (f.inscrito) canastas[f.canasta].inscritos += n;
  }

  /// Por total, de mayor a menor: la lista se lee para saber
  /// dónde está la gente, no en orden alfabético.
  const ordenadas = [...porDepto.values()].sort((a, b) => b.total - a.total);

  const totales = ordenadas.reduce(
    (t, f) => ({
      directo: t.directo + f.directo,
      pagada: t.pagada + f.pagada,
      organica: t.organica + f.organica,
      interesados: t.interesados + f.interesados,
      inscritos: t.inscritos + f.inscritos,
      descartados: t.descartados + f.descartados,
      total: t.total + f.total,
    }),
    VACIO.totales,
  );

  /// El comportamiento por dia, hasta HOY incluido.
  ///
  /// Los dias se cortan en Bogota y no en UTC: a secas, las
  /// cinco horas de tarde-noche -- cuando la gente diligencia --
  /// se cargarian al dia siguiente.
  const porDia = await prisma.$queryRaw<
    Array<{ dia: string; llegaron: bigint; inscritos: bigint }>
  >(Prisma.sql`
    SELECT
      ${diaBogota(Prisma.sql`p."creadoEn"`)} AS dia,
      COUNT(*) AS llegaron,
      COUNT(*) FILTER (
        WHERE p."etapa"::text IN (${Prisma.join(LLEGO_A_INSCRITO)})
      ) AS inscritos
    FROM "participantes" p
    WHERE ${Prisma.join(condiciones, ' AND ')}
    GROUP BY 1
    ORDER BY 1
  `);

  const claves: Canasta[] = ['DIRECTO', 'PAGADA', 'ORGANICA'];

  return {
    acciones: catalogo,
    filas: ordenadas,
    serie: porDia.map((d) => ({
      dia: String(d.dia),
      llegaron: Number(d.llegaron),
      inscritos: Number(d.inscritos),
    })),
    totales,
    porCanasta: claves.map((c) => ({
      canasta: c,
      etiqueta: ETIQUETA_CANASTA[c],
      total: canastas[c].base,
    })),
    conversion: claves.map((c) => ({
      canasta: c,
      etiqueta: ETIQUETA_CANASTA[c],
      base: canastas[c].base,
      inscritos: canastas[c].inscritos,
      /// Sin base no hay tasa: 0/0 no es 0 %, es «todavía no se
      /// sabe», y pintar 0 % diría que esa puerta no sirve.
      tasa: canastas[c].base > 0 ? canastas[c].inscritos / canastas[c].base : 0,
    })),
  };
}
