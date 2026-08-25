/** El tablero de Inscripciones: seis repartos y su conversión. */

import type { EtapaParticipante, Prisma } from '../../generated/prisma';
import { DEPARTAMENTO_POR_ID } from './catalogos-sep';
import { faltaDeLaPersona } from './completitud';

/// Las cuatro del embudo del asesor, en el orden del proceso.
///
/// «No interesado» es PERDIDO en la base: el nombre de la
/// pantalla y el de la columna no coinciden, y aqui manda el
/// de la pantalla. DATOS_COMPLETOS queda fuera porque dejo de
/// ser etapa, y las del aula porque no son de este tramo.
export const ETAPAS_DEL_EMBUDO: EtapaParticipante[] = [
  'INTERESADO',
  'CONTACTADO',
  'INSCRITO',
  'PERDIDO',
];

export const ETIQUETA_ETAPA: Record<string, string> = {
  INTERESADO: 'Interesado',
  CONTACTADO: 'Contactado',
  INSCRITO: 'Inscrito',
  PERDIDO: 'No interesado',
};

type Reparto = { etiqueta: string; valor: number };

export type MetricasInscripciones = {
  total: number;
  porEtapa: Reparto[];
  /// Cuántos leads están completos y cuántos a medias.
  porEstado: Reparto[];
  /// Cuántos leads trae cada gremio. Para la gráfica.
  porGremioTotal: Reparto[];
  /// Un bloque por gremio: son dos convenios y cada uno tiene
  /// sus propias acciones, mezclarlas no compara nada.
  /// Lleva el id porque es lo que entiende el filtro.
  porGremio: Array<{
    convenioId: string;
    gremio: string;
    acciones: Reparto[];
    conversion: { inscritos: number; base: number; porcentaje: number };
  }>;
  /// Cuántos leads entran por día, de media, desde el primero.
  promedioPorDia: { valor: number; dias: number };
  /// Sin los que no tienen domicilio y sin los que viven fuera
  /// de cobertura: no son un dato del embudo, son un hueco.
  porDepartamento: Reparto[];
  sinDepartamento: number;
  porAsesor: Reparto[];
  conversion: { inscritos: number; base: number; porcentaje: number };
};

/// Lo que hace falta para poder consultar. Se pasa entero para
/// no atar este archivo al servicio.
type Consulta = {
  prisma: {
    participante: {
      findMany: (args: unknown) => Promise<unknown[]>;
    };
  };
  donde: Prisma.ParticipanteWhereInput;
};

/// Fila mínima para poder repartir. Se pide una sola vez y se
/// cuenta en memoria: seis `groupBy` distintos contra la misma
/// tabla cuestan más que traer las filas y contarlas aquí, y
/// además el estado «datos completos» no es una columna.
type Fila = {
  etapa: EtapaParticipante;
  nivelOcupacionalSepId: number | null;
  convenio: { id: string; nombre: string; sigla: string | null } | null;
  creadoEn: Date;
  accionFormacion: { codigo: string; nombre: string } | null;
  asesor: { nombre: string } | null;
  persona: {
    correo: string | null;
    celular: string | null;
    fechaNacimiento: Date | null;
    generoSepId: number | null;
    estrato: number | null;
    departamentoSepId: number | null;
    municipioSepId: number | null;
    barrio: string | null;
    direccion: string | null;
  };
};

export const SELECT_METRICAS = {
  etapa: true,
  nivelOcupacionalSepId: true,
  convenio: { select: { id: true, nombre: true, sigla: true } },
  creadoEn: true,
  accionFormacion: { select: { codigo: true, nombre: true } },
  asesor: { select: { nombre: true } },
  persona: {
    select: {
      correo: true,
      celular: true,
      fechaNacimiento: true,
      generoSepId: true,
      estrato: true,
      departamentoSepId: true,
      municipioSepId: true,
      barrio: true,
      direccion: true,
    },
  },
} as const;

/// De mayor a menor, y a igualdad por nombre: sin el desempate
/// el orden cambia entre recargas y parece que se movio algo.
function ordenar(mapa: Map<string, number>): Reparto[] {
  return [...mapa.entries()]
    .map(([etiqueta, valor]) => ({ etiqueta, valor }))
    .sort((a, b) => b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta));
}

export function repartir(filas: Fila[]): MetricasInscripciones {
  const total = filas.length;

  // --- etapa: las cuatro siempre, aunque alguna vaya en cero
  const etapas = new Map<string, number>(
    ETAPAS_DEL_EMBUDO.map((e) => [ETIQUETA_ETAPA[e], 0]),
  );
  for (const f of filas) {
    const clave = ETIQUETA_ETAPA[f.etapa];
    if (clave !== undefined) etapas.set(clave, (etapas.get(clave) ?? 0) + 1);
  }

  // --- estado de la ficha
  let completos = 0;
  for (const f of filas) {
    const falta = faltaDeLaPersona({
      persona: f.persona,
      nivelOcupacionalSepId: f.nivelOcupacionalSepId,
    });
    if (falta.length === 0) completos += 1;
  }

  // --- gremios: sus acciones, su total y su conversion
  const gremios = new Map<
    string,
    { nombre: string; acciones: Map<string, number>; total: number; inscritos: number }
  >();
  for (const f of filas) {
    if (!f.convenio) continue;
    const g =
      gremios.get(f.convenio.id) ??
      {
        nombre: f.convenio.sigla || f.convenio.nombre,
        acciones: new Map<string, number>(),
        total: 0,
        inscritos: 0,
      };
    g.total += 1;
    if (f.etapa === 'INSCRITO') g.inscritos += 1;
    if (f.accionFormacion) {
      const clave = `${f.accionFormacion.codigo} · ${f.accionFormacion.nombre}`;
      g.acciones.set(clave, (g.acciones.get(clave) ?? 0) + 1);
    }
    gremios.set(f.convenio.id, g);
  }

  // --- departamento, sin los huecos
  const deptos = new Map<string, number>();
  let sinDepartamento = 0;
  for (const f of filas) {
    const id = f.persona.departamentoSepId;
    const nombre = id ? DEPARTAMENTO_POR_ID.get(id)?.etiqueta : undefined;
    if (!nombre) {
      sinDepartamento += 1;
      continue;
    }
    deptos.set(nombre, (deptos.get(nombre) ?? 0) + 1);
  }

  // --- asesor
  const asesores = new Map<string, number>();
  for (const f of filas) {
    const nombre = f.asesor?.nombre ?? 'Sin asignar';
    asesores.set(nombre, (asesores.get(nombre) ?? 0) + 1);
  }

  const inscritos = filas.filter((f) => f.etapa === 'INSCRITO').length;

  /// Cuantos leads entran por dia desde que entro el primero.
  /// Sobre dias corridos, no sobre dias con movimiento: los
  /// dias en que no entro nadie tambien cuentan, y no decirlo
  /// infla el promedio.
  const fechas = filas.map((f) => f.creadoEn.getTime());
  const dias =
    fechas.length > 0
      ? Math.max(
          1,
          Math.ceil((Math.max(...fechas) - Math.min(...fechas)) / 86_400_000) + 1,
        )
      : 0;
  const promedio = {
    valor: dias > 0 ? Math.round((total / dias) * 10) / 10 : 0,
    dias,
  };

  return {
    total,
    // el embudo no se ordena por tamaño: su orden es el del proceso
    porEtapa: ETAPAS_DEL_EMBUDO.map((e) => ({
      etiqueta: ETIQUETA_ETAPA[e],
      valor: etapas.get(ETIQUETA_ETAPA[e]) ?? 0,
    })),
    porEstado: [
      { etiqueta: 'Datos completos', valor: completos },
      { etiqueta: 'Datos parciales', valor: total - completos },
    ],
    porGremioTotal: ordenar(
      new Map([...gremios.values()].map((g) => [g.nombre, g.total])),
    ),
    porGremio: [...gremios.entries()]
      .map(([convenioId, g]) => ({
        convenioId,
        gremio: g.nombre,
        acciones: ordenar(g.acciones),
        conversion: {
          inscritos: g.inscritos,
          base: g.total,
          porcentaje: g.total > 0 ? Math.round((g.inscritos / g.total) * 1000) / 10 : 0,
        },
      }))
      .sort((a, b) => a.gremio.localeCompare(b.gremio)),
    promedioPorDia: promedio,
    porDepartamento: ordenar(deptos),
    sinDepartamento,
    porAsesor: ordenar(asesores),
    conversion: {
      inscritos,
      base: total,
      porcentaje: total > 0 ? Math.round((inscritos / total) * 1000) / 10 : 0,
    },
  };
}

export async function metricasDeInscripciones(
  c: Consulta,
): Promise<MetricasInscripciones> {
  const filas = (await c.prisma.participante.findMany({
    where: c.donde,
    select: SELECT_METRICAS,
  })) as Fila[];

  return repartir(filas);
}
