import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { diaBogota } from '../comun/dia-bogota';
import { DEPARTAMENTOS_SEP } from './catalogos-sep.generado';
import {
  ETIQUETA_ORIGEN_DE_LEAD,
  origenDeLeadSql,
  type OrigenDeLead,
} from './origen-del-lead';

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
 * pagada, así que se agrupan en tres puertas que responden la
 * pregunta que se hace al mirar esto: ¿de dónde salió esta gente
 * y cuál de los tres caminos vale la pena?
 */


export type FilaDelTablero = {
  departamento: string;
  pauta: number;
  organico: number;
  importacion: number;
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
  /// Para el gráfico de puertas, ya sumado.
  porPuerta: Array<{ puerta: OrigenDeLead; etiqueta: string; total: number }>;
  /// Lo que la pauta volvió a tocar SIN ser suyo: gente que ya
  /// estaba en el sistema y que el anuncio trajo de vuelta.
  /// Se cuenta aparte para que la campaña conste sin quitarle
  /// el lead a quien lo consiguió.
  rescatePorPauta: { tocados: number; yaEranDeOtro: number; inscritos: number };
  /// Cómo se comportó cada día, hasta hoy.
  serie: Array<{ dia: string; llegaron: number; inscritos: number }>;
  /// Cuánto convierte cada puerta. Es la cifra que decide dónde
  /// poner el dinero: el volumen dice cuál trae más, no cuál
  /// trae mejor.
  conversion: Array<{
    puerta: OrigenDeLead;
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
    pauta: 0,
    organico: 0,
    importacion: 0,
    interesados: 0,
    inscritos: 0,
    descartados: 0,
    total: 0,
  },
  porPuerta: [],
  rescatePorPauta: { tocados: 0, yaEranDeOtro: 0, inscritos: 0 },
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
      puerta: OrigenDeLead;
      inscrito: boolean;
      descartado: boolean;
      total: bigint;
    }>
  >(Prisma.sql`
    SELECT
      per."departamentoSepId" AS "departamentoId",
      ${origenDeLeadSql('p')} AS puerta,
      (p."etapa"::text IN (${Prisma.join(LLEGO_A_INSCRITO)})) AS inscrito,
      (p."etapa"::text IN (${Prisma.join(DESCARTADO)})) AS descartado,
      COUNT(*) AS total
    FROM "participantes" p
    JOIN "personas" per ON per."id" = p."personaId"
    WHERE ${Prisma.join(condiciones, ' AND ')}
    GROUP BY 1, 2, 3, 4
  `);

  const porDepto = new Map<string, FilaDelTablero>();
  const puertas: Record<OrigenDeLead, { base: number; inscritos: number }> = {
    PAUTA: { base: 0, inscritos: 0 },
    ORGANICO: { base: 0, inscritos: 0 },
    IMPORTACION: { base: 0, inscritos: 0 },
  };

  for (const f of filas) {
    const nombre =
      DEPARTAMENTOS_SEP.find((d) => d.id === f.departamentoId)?.etiqueta ??
      'Sin departamento';
    const fila =
      porDepto.get(nombre) ??
      ({
        departamento: nombre,
        pauta: 0,
        organico: 0,
        importacion: 0,
        interesados: 0,
        inscritos: 0,
        descartados: 0,
        total: 0,
      } satisfies FilaDelTablero);

    const n = Number(f.total);
    if (f.puerta === 'PAUTA') fila.pauta += n;
    else if (f.puerta === 'ORGANICO') fila.organico += n;
    else fila.importacion += n;

    if (f.inscrito) fila.inscritos += n;
    else if (f.descartado) fila.descartados += n;
    else fila.interesados += n;

    fila.total += n;
    porDepto.set(nombre, fila);

    puertas[f.puerta].base += n;
    if (f.inscrito) puertas[f.puerta].inscritos += n;
  }

  /// Por total, de mayor a menor: la lista se lee para saber
  /// dónde está la gente, no en orden alfabético.
  const ordenadas = [...porDepto.values()].sort((a, b) => b.total - a.total);

  const totales = ordenadas.reduce(
    (t, f) => ({
      pauta: t.pauta + f.pauta,
      organico: t.organico + f.organico,
      importacion: t.importacion + f.importacion,
      interesados: t.interesados + f.interesados,
      inscritos: t.inscritos + f.inscritos,
      descartados: t.descartados + f.descartados,
      total: t.total + f.total,
    }),
    VACIO.totales,
  );

  /// Lo que la pauta tocó, que NO es lo mismo que lo que la
  /// pauta trajo. Una persona que ya estaba —la subió el
  /// community manager— y que despues cayó por un anuncio
  /// tiene toque de pauta y primer origen de otro. Contarla
  /// como pauta le quitaria el lead a quien lo consiguio;
  /// no contarla dejaria la campaña sin constancia.
  /// La tabla puede no existir todavia: en un clon local las
  /// migraciones las corre una persona, no el arranque. En los
  /// contenedores el CMD hace `migrate deploy` ANTES de servir,
  /// asi que esta ventana no existe en produccion.
  const [{ hay }] = await prisma.$queryRaw<Array<{ hay: boolean }>>(
    Prisma.sql`SELECT to_regclass('public.toques_de_origen') IS NOT NULL AS hay`,
  );

  const rescate = !hay ? [] : await prisma.$queryRaw<
    Array<{ suya: boolean; total: bigint; inscritos: bigint }>
  >(Prisma.sql`
    SELECT
      (${origenDeLeadSql('p')} = 'PAUTA') AS suya,
      COUNT(*) AS total,
      COUNT(*) FILTER (
        WHERE p."etapa"::text IN (${Prisma.join(LLEGO_A_INSCRITO)})
      ) AS inscritos
    FROM "participantes" p
    WHERE ${Prisma.join(condiciones, ' AND ')}
      AND EXISTS (
        SELECT 1 FROM "toques_de_origen" t
        WHERE t."participanteId" = p."id" AND t."clase" = 'PAUTA'
      )
    GROUP BY 1
  `);

  const rescatePorPauta = rescate.reduce(
    (a, f) => ({
      tocados: a.tocados + Number(f.total),
      yaEranDeOtro: a.yaEranDeOtro + (f.suya ? 0 : Number(f.total)),
      inscritos: a.inscritos + Number(f.inscritos),
    }),
    { tocados: 0, yaEranDeOtro: 0, inscritos: 0 },
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

  const claves: OrigenDeLead[] = ['PAUTA', 'ORGANICO', 'IMPORTACION'];

  return {
    acciones: catalogo,
    filas: ordenadas,
    rescatePorPauta,
    serie: porDia.map((d) => ({
      dia: String(d.dia),
      llegaron: Number(d.llegaron),
      inscritos: Number(d.inscritos),
    })),
    totales,
    porPuerta: claves.map((c) => ({
      puerta: c,
      etiqueta: ETIQUETA_ORIGEN_DE_LEAD[c],
      total: puertas[c].base,
    })),
    conversion: claves.map((c) => ({
      puerta: c,
      etiqueta: ETIQUETA_ORIGEN_DE_LEAD[c],
      base: puertas[c].base,
      inscritos: puertas[c].inscritos,
      /// Sin base no hay tasa: 0/0 no es 0 %, es «todavía no se
      /// sabe», y pintar 0 % diría que esa puerta no sirve.
      tasa: puertas[c].base > 0 ? puertas[c].inscritos / puertas[c].base : 0,
    })),
  };
}
