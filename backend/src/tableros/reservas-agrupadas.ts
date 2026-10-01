/** La vista de Reservas, unificada: una fila por organización. */

/**
 * De dónde viene: «hay una empresa que tiene 4 reservas en 4 AF»
 * (cliente, 25 sep 2026). El listado de Reservas la enseñaba cuatro
 * veces —cuatro filas con la misma razón social, el mismo NIT y el
 * mismo formulario de entrada— y para saber qué apartó esa empresa
 * había que buscar sus filas a mano por toda la tabla.
 *
 * Aquí se unifica: una fila por organización, la acción de formación
 * pasa de ser un VALOR de la fila a ser una COLUMNA, y las fechas,
 * los contactos y los formularios se consolidan.
 *
 * Por qué agrupa el servidor y no el navegador, teniendo el listado
 * todas las columnas que hacen falta:
 *
 *  - El listado pagina con tope duro de 200. Agrupar sobre una
 *    página parte una organización en dos: sus AF1 y AF2 caen en la
 *    página 1 y sus AF3 y AF4 en la 2, y salen DOS filas de la misma
 *    empresa con la mitad de sus reservas cada una. El error no se
 *    ve: las dos filas parecen correctas.
 *  - Cada fila del listado arrastra todas las respuestas del
 *    formulario público. Para agrupar no se necesita ninguna.
 *  - El juego de columnas AF hay que saberlo ANTES de pintar la
 *    tabla, y solo se conoce mirando todas las reservas del recorte,
 *    no las de una página.
 *
 * Se trae una fila por reserva —estrecha, sin respuestas— y se
 * agrupa aquí. La tabla del navegador filtra y ordena sobre las
 * filas ya agrupadas, que es lo que sabe hacer.
 */

import { EstadoReserva, Prisma, type Modalidad } from '../../generated/prisma';
import { enPeriodo, PRIMERA_MATRICULA } from '../crm/anclas';
import { OCUPAN_SILLA } from '../crm/etapas';
import type { PrismaService } from '../prisma/prisma.service';
import { reservaDeConvenio } from './ambito';

/**
 * Tope de organizaciones.
 *
 * Hoy son 51 pares acción × organización, o sea bastantes menos
 * empresas. El tope no está para ahorrar: está para que, si algún
 * día se corta, se DIGA (`truncado`). El total se cuenta antes de
 * cortar.
 */
export const TOPE_ORGANIZACIONES = 500;

// ── el contrato ─────────────────────────────────────────────────
// Espejo de `frontend/src/lib/tableros-api.ts`. Si se cambia uno,
// se cambia el otro: la pantalla no tiene otra fuente de verdad.

/**
 * Una columna AF de la tabla.
 *
 * La llave es `accionFormacionId` y NO el código: «AF1» se repite
 * entre gremios y no significa lo mismo —en ADECOPRIA AF3 es un
 * taller y en Grupo AE es un curso—. Con el ámbito abierto a los
 * dos hay dos «AF1» distintos, y agruparlos por código los sumaría
 * en una sola columna.
 */
export type ColumnaAccion = {
  accionFormacionId: string;
  codigo: string;
  nombre: string;
  convenio: string;
  convenioSigla: string | null;
  modalidad: Modalidad;
  /// Solo se rotula con el gremio cuando hay más de uno a la vista:
  /// con un gremio solo, «AF1 · ADECOPRIA» en cada cabecera es ruido.
  ambiguo: boolean;
};

/** Una reserva suelta, dentro de la celda de su acción. */
export type ReservaEnCelda = {
  reservaId: string;
  estado: EstadoReserva;
  cuposSolicitados: number;
  cuposConfirmados: number;
  cuposEnEspera: number;
  /**
   * Cuántos de sus cupos ya tienen persona detrás.
   *
   * EL MISMO CRITERIO QUE «Control de Reservas», y por eso no se
   * cuenta aquí: la regla vive en `informe-de-reservas.ts` y cuenta a
   * quien ALGUNA VEZ llegó a INSCRITO (`PRIMERA_MATRICULA` +
   * `enPeriodo`), no a quien esté hoy en el aula. Con otro criterio,
   * esta pantalla y el Seguimiento dirían cifras distintas del mismo
   * cupo, que es la manera más rápida de que nadie se crea ninguna
   * de las dos.
   *
   * Una reserva cancelada va a cero aunque le queden personas
   * colgadas: sus cupos volvieron a la oferta.
   */
  conNombre: number;
  /** `max(0, cuposConfirmados − conNombre)`. Acotado EN LA RESERVA,
      que es donde está el cupo: así la cifra se puede sumar en
      cualquier sentido y doce personas en una reserva de diez no
      llenan las sillas de otra organización. */
  sinNombre: number;
  creadoEn: string;
  canceladaEn: string | null;
  ubicacion: string;
  modalidad: Modalidad;
  contactoNombre: string;
  contactoCorreo: string;
  contactoCelular: string | null;
  contactoCargo: string | null;
  formulario: { slug: string; titulo: string } | null;
};

/**
 * Lo que esta organización tiene en UNA acción de formación.
 *
 * Lleva dentro una LISTA y no una reserva, y eso no es prudencia:
 * `@@unique([empresaId, ofertaId])` da una reserva por oferta, pero
 * una acción puede tener varias ofertas --la misma AF dictada en dos
 * sedes-- y la empresa puede apartar en las dos. En la base de
 * pruebas pasa cinco veces de sesenta reservas.
 *
 * Quedarse con la primera hacía que la fila dijera «3 reservas · 40
 * cupos» arriba y sus celdas sumaran 24: la tercera reserva contaba
 * en los totales y no se veía en ninguna columna. Una resta que no
 * cuadra y no se ve por qué.
 */
export type CeldaReserva = {
  reservas: ReservaEnCelda[];
  /// El estado de la celda cuando las suyas no coinciden: manda la
  /// que más sitio tiene, porque es la que mejor describe qué apartó
  /// la empresa en esta acción. La lista de arriba lleva el de cada
  /// una, y el cajón las edita por separado.
  estado: EstadoReserva;
  /// Si sus reservas no están todas en el mismo estado. La pantalla
  /// lo dice: si no, una celda verde escondería una cancelada.
  mixta: boolean;
  cuposSolicitados: number;
  cuposConfirmados: number;
  cuposEnEspera: number;
  /** La suma de los de sus reservas. Ver `ReservaEnCelda`. */
  conNombre: number;
  sinNombre: number;
  primera: string;
  ultima: string;
};

export type ContactoConsolidado = {
  nombre: string;
  correo: string;
  celular: string | null;
  cargo: string | null;
  /// En qué acciones aparece. Va porque el contacto es por reserva
  /// —«quien diligencia, distinto en cada curso», dice el modelo—,
  /// así que una empresa con cuatro AF puede traer cuatro personas.
  codigos: string[];
};

/**
 * Lo que la organización ha hecho con los leads que le llegaron.
 *
 * Es la mitad derecha del modelo que entregó el cliente (hoja
 * «Reservas», 30 sep 2026): de los cupos que apartó, cuántas
 * personas aparecieron, cuántas se inscribieron y cuántas se
 * cayeron por el camino. Hasta hoy esta vista solo sabía contar
 * cupos, que es la mitad de la pregunta que se hace delante de
 * ella: «aparté 40, ¿y qué pasó con ellos?».
 *
 * Se calcula en el servidor --no se deriva en el navegador-- porque
 * sale de `participantes` y de sus notas de gestión, que esta
 * pantalla no se trae: agruparlo allá sería traerse el CRM entero
 * para pintar seis columnas.
 */
export type CifrasDeLeads = {
  /** Personas de esa organización que entraron al CRM. */
  leadsRecibidos: number;
  inscritos: number;
  descartados: number;
  noContactable: number;
  /**
   * `inscritos + descartados + noContactable`. En su hoja es una
   * fórmula (`=K2+L2+M2`); aquí se calcula, y por eso los tres
   * cubos tienen que ser DISJUNTOS: ver `SQL_DE_LOS_CUBOS`.
   */
  totalLeadGestionados: number;
  /**
   * `cuposConfirmados − leadsRecibidos`, acotado a cero.
   *
   * En su hoja es `=I2-J2` y puede salir negativa; aquí no: quien
   * mandó más personas que cupos apartó no tiene «−5 cupos
   * pendientes», tiene cero y una sobra, que es otra cifra y no
   * esta.
   */
  cuposPendientes: number;
};

/** Una organización sin un solo lead: todo a cero, nada en blanco. */
export const SIN_LEADS: CifrasDeLeads = {
  leadsRecibidos: 0,
  inscritos: 0,
  descartados: 0,
  noContactable: 0,
  totalLeadGestionados: 0,
  cuposPendientes: 0,
};

export type FilaAgrupada = {
  empresaId: string;
  nit: string;
  digitoVerificacion: string | null;
  razonSocial: string;
  numeroColaboradores: number | null;
  redAsociada: string | null;
  redAsociadaOtra: string | null;

  /// Las fechas, consolidadas. Si solo reservó un día, las dos son
  /// la misma y la pantalla enseña una.
  primeraReserva: string;
  ultimaReserva: string;

  contactos: ContactoConsolidado[];
  formularios: Array<{ slug: string; titulo: string; codigos: string[] }>;

  /// Cuántas AF apartó, contando las canceladas: son las que
  /// explican la columna Estado.
  totalReservas: number;
  reservasVivas: number;
  reservasCanceladas: number;
  cuposConfirmados: number;
  cuposEnEspera: number;
  cuposSolicitados: number;
  /** «Cupos ocupados» y «Pendientes» de la pantalla, sumados de sus
      reservas. Ver `ReservaEnCelda`. */
  conNombre: number;
  sinNombre: number;

  /// Lo que pasó con sus leads. Ver `CifrasDeLeads`.
  leads: CifrasDeLeads;

  /// La fila, abierta por acción. La llave es `accionFormacionId`.
  porAccion: Record<string, CeldaReserva>;
};

export type ReservasAgrupadas = {
  total: number;
  truncado: boolean;
  acciones: ColumnaAccion[];
  filas: FilaAgrupada[];
};

export type FiltrosAgrupadas = {
  ambito: string[];
  convenio?: string;
  accionId?: string;
  formulario?: string;
  buscar?: string;
  /// Por omisión entran: una organización que canceló sus cuatro
  /// reservas sigue siendo una fila con historia, y esconderla
  /// dejaría la columna Estado sin nada que explicar.
  incluyeCanceladas?: boolean;
  /// EL MISMO PERIODO QUE LA LISTA. Sin esto, las dos vistas de la
  /// misma pantalla ---«Por reserva» y «Por organización»---
  /// contestarían distinto al mismo filtro.
  llegoDesde?: string;
  llegoHasta?: string;
};

const soloDigitos = (texto: string) => texto.replace(/\D/g, '');

export async function reservasAgrupadas(
  prisma: PrismaService,
  filtros: FiltrosAgrupadas,
): Promise<ReservasAgrupadas> {
  const y: Prisma.ReservaWhereInput[] = [reservaDeConvenio(filtros.ambito)];

  if (filtros.convenio) {
    y.push({ oferta: { accionFormacion: { convenio: { slug: filtros.convenio } } } });
  }
  if (filtros.accionId) y.push({ oferta: { accionFormacionId: filtros.accionId } });
  if (filtros.formulario) y.push({ formulario: { slug: filtros.formulario } });
  if (filtros.incluyeCanceladas === false) {
    y.push({ estado: { not: EstadoReserva.CANCELADA } });
  }

  /**
   * La búsqueda va por la ORGANIZACIÓN, no por la reserva.
   *
   * Buscando por el nombre del contacto sobre la reserva se caían
   * del grupo las AF que otra persona diligenció, y la fila salía
   * con dos de sus cuatro columnas vacías sin decir por qué. Lo que
   * se busca aquí es la empresa; el contacto se busca dentro de ella.
   */
  /// Por cuándo se hizo la reserva, igual que en la lista.
  if (filtros.llegoDesde) y.push({ creadoEn: { gte: new Date(filtros.llegoDesde) } });
  if (filtros.llegoHasta) y.push({ creadoEn: { lt: new Date(filtros.llegoHasta) } });

  if (filtros.buscar?.trim()) {
    const texto = filtros.buscar.trim();
    const digitos = soloDigitos(texto);
    y.push({
      empresa: {
        OR: [
          { razonSocial: { contains: texto, mode: 'insensitive' } },
          ...(digitos ? [{ nit: { contains: digitos } }] : []),
          {
            reservas: {
              some: {
                OR: [
                  { contactoNombre: { contains: texto, mode: 'insensitive' } },
                  { contactoCorreo: { contains: texto, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      },
    });
  }

  const reservas = await prisma.reserva.findMany({
    where: { AND: y },
    orderBy: { creadoEn: 'asc' },
    select: {
      id: true,
      estado: true,
      cuposSolicitados: true,
      cuposConfirmados: true,
      cuposEnEspera: true,
      creadoEn: true,
      canceladaEn: true,
      contactoNombre: true,
      contactoCorreo: true,
      contactoCelular: true,
      contactoCargo: true,
      empresa: {
        select: {
          id: true,
          nit: true,
          digitoVerificacion: true,
          razonSocial: true,
          numeroColaboradores: true,
          redAsociada: true,
          redAsociadaOtra: true,
        },
      },
      oferta: {
        select: {
          modalidad: true,
          ubicacion: { select: { nombre: true } },
          accionFormacion: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              convenio: { select: { slug: true, sigla: true } },
            },
          },
        },
      },
      formulario: { select: { slug: true, titulo: true } },
    },
  });

  const conNombre = await cuposConNombre(prisma, reservas);
  const leads = await cifrasDeLeadsPorEmpresa(
    prisma,
    [...new Set(reservas.map((r) => r.empresa.id))],
    filtros.ambito,
  );

  return armarAgrupadas(reservas, conNombre, leads);
}

/* ═══════════════════════════════════════════════════════════════
   LOS CUBOS DE UN LEAD — PROVISIONAL, UN SOLO SITIO

   Aquí vive la ÚNICA definición de «inscrito», «descartado» y «no
   contactable» de esta pantalla, y está en un solo sitio a
   propósito: dos de las tres son provisionales y van a cambiar.

   DE DÓNDE VENDRÁN DESPUÉS: hay otro proceso construyendo las
   CATEGORÍAS DE NOTA de gestión --«No contactado» pasa a llamarse
   «Sin respuesta»--, y esa categoría será la fuente definitiva de
   «No contactable». Mientras no exista, se deduce del resultado de
   las notas, que es lo más parecido que hay hoy. «Descartados» sale
   de la etapa PERDIDO, que también está por confirmar: no es seguro
   que «descartado» y «perdido» sean la misma cosa para el cliente.

   El día que lleguen las categorías se cambia ESTE fragmento de SQL
   y nada más: ni la consulta, ni el agrupado, ni la pantalla saben
   de etapas ni de resultados.

   LOS TRES CUBOS SON DISJUNTOS, y no es un detalle: el cliente suma
   los tres en «Total lead gestionados» (=K2+L2+M2 en su hoja). Si
   un PERDIDO al que nadie logró contactar contara en dos cubos, el
   total pasaría de los leads recibidos y la fila se leería como un
   error de cuentas. La precedencia es inscrito → descartado → no
   contactable: quien se inscribió fue contactado, se mire como se
   mire, y quien está PERDIDO está descartado aunque además no
   contestara nunca.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Los tres cubos, en SQL, contra los alias `p` (el participante) y
 * `sg` (el resumen de sus notas de gestión).
 *
 * Va aparte de la consulta para que se lea de un tirón y para que
 * el día del cambio no haya que entender el resto del SELECT.
 */
function sqlDeLosCubos(): Prisma.Sql {
  /// «Inscrito» con el MISMO criterio que ocupa silla --inscrito o
  /// más allá-- y no `etapa = 'INSCRITO'` a secas: quien ya está en
  /// formación o certificado se inscribió, y dejarlo fuera haría
  /// que la columna bajara sola el día que empiezan las clases.
  const ocupaSilla = Prisma.sql`p."etapa"::text IN (${Prisma.join(OCUPAN_SILLA)})`;
  const descartado = Prisma.sql`p."etapa"::text = 'PERDIDO'`;
  /// Intentos de gestión sin un solo contacto logrado. Las notas sin
  /// resultado --las de antes del canal y las que escribe el
  /// sistema-- no son intentos: no dicen que se llamara a nadie.
  const nadieLoContacto = Prisma.sql`COALESCE(sg."intentos", 0) > 0
                                     AND COALESCE(sg."contactos", 0) = 0`;

  return Prisma.sql`
    COUNT(*)                              AS "leadsRecibidos",
    COUNT(*) FILTER (WHERE ${ocupaSilla}) AS inscritos,
    COUNT(*) FILTER (WHERE NOT (${ocupaSilla}) AND ${descartado})
                                          AS descartados,
    COUNT(*) FILTER (WHERE NOT (${ocupaSilla}) AND NOT (${descartado})
                       AND (${nadieLoContacto}))
                                          AS "noContactable"
  `;
}

/** Las cuatro cifras que salen de la base, sin las dos fórmulas. */
export type LeadsCrudos = Omit<
  CifrasDeLeads,
  'totalLeadGestionados' | 'cuposPendientes'
>;

/**
 * Las cifras de leads de cada organización, de una sola consulta.
 *
 * POR EMPRESA Y NO POR RESERVA, y la empresa de un lead se busca
 * por DOS caminos: su propio `empresaId` --donde trabaja, que se
 * rellena aunque llegara por su cuenta-- y, si no lo tiene, el de
 * la reserva por la que entró. En la base de hoy son 5 por el
 * primero y 80 por el segundo: mirando solo uno de los dos,
 * «leads recibidos» salía casi en cero y no se veía por qué.
 *
 * Acotada al ámbito por `convenioId`: la misma empresa puede tener
 * fichas en los dos gremios, y una cuenta de ADECOPRIA no puede ver
 * los leads de Grupo AE.
 */
export async function cifrasDeLeadsPorEmpresa(
  prisma: PrismaService,
  empresaIds: string[],
  ambito: string[],
): Promise<Map<string, LeadsCrudos>> {
  /// `Prisma.join` de una lista vacía es un SQL roto, y sin
  /// organizaciones --o sin ámbito-- no hay nada que contar.
  if (empresaIds.length === 0 || ambito.length === 0) return new Map();

  const filas = await prisma.$queryRaw<
    Array<{
      eid: string;
      leadsRecibidos: bigint;
      inscritos: bigint;
      descartados: bigint;
      noContactable: bigint;
    }>
  >(Prisma.sql`
    WITH gestion AS (
      SELECT n."participanteId" AS pid,
             COUNT(*) FILTER (
               WHERE n."resultado"::text IN ('SIN_RESPUESTA', 'DATO_MALO')
             ) AS intentos,
             COUNT(*) FILTER (WHERE n."resultado"::text = 'CONTACTO') AS contactos
        FROM "notas_participante" n
       WHERE n."participanteId" IS NOT NULL
       GROUP BY 1
    )
    SELECT COALESCE(p."empresaId", res."empresaId") AS eid,
           ${sqlDeLosCubos()}
      FROM "participantes" p
      LEFT JOIN "reservas" res ON res."id" = p."reservaId"
      LEFT JOIN gestion sg     ON sg."pid" = p."id"
     WHERE COALESCE(p."empresaId", res."empresaId") IN (${Prisma.join(empresaIds)})
       AND p."convenioId" IN (${Prisma.join(ambito)})
     GROUP BY 1
  `);

  return new Map(
    filas.map((f) => [
      f.eid,
      {
        leadsRecibidos: Number(f.leadsRecibidos),
        inscritos: Number(f.inscritos),
        descartados: Number(f.descartados),
        noContactable: Number(f.noContactable),
      },
    ]),
  );
}

/**
 * Las dos fórmulas de su hoja, cerradas sobre las cifras crudas.
 *
 * Exportada y aparte de la consulta porque es lo que se prueba: que
 * el total sume los tres cubos y que los pendientes resten, sin
 * base de datos de por medio.
 */
export function cerrarCifrasDeLeads(
  crudas: LeadsCrudos,
  cuposConfirmados: number,
): CifrasDeLeads {
  return {
    ...crudas,
    totalLeadGestionados:
      crudas.inscritos + crudas.descartados + crudas.noContactable,
    cuposPendientes: Math.max(0, cuposConfirmados - crudas.leadsRecibidos),
  };
}

/**
 * Cuántas personas cuelgan de cada reserva, con el criterio del
 * informe.
 *
 * VA APARTE Y EN SQL CRUDO A PROPÓSITO. La regla no es «cuántos
 * participantes tiene la reserva»: es cuántos ALGUNA VEZ llegaron a
 * INSCRITO, que es lo que miran «Cupos apartados por empresas» y el
 * Seguimiento de Control de Reservas. Escrita con `_count` de Prisma
 * saldría la primera, que es parecida y no es la misma, y las dos
 * pantallas dirían números distintos del mismo cupo.
 *
 * Reusa los mismos trozos de SQL que el informe --`PRIMERA_MATRICULA`
 * y `enPeriodo`--: una segunda copia de la regla es la que se queda
 * vieja cuando alguien cambie la primera.
 */
async function cuposConNombre(
  prisma: PrismaService,
  reservas: Array<{ id: string }>,
): Promise<Map<string, number>> {
  /// `Prisma.join` de una lista vacía es un SQL roto, y sin reservas
  /// no hay nada que contar.
  if (reservas.length === 0) return new Map();

  const filas = await prisma.$queryRaw<Array<{ rid: string; n: bigint }>>(Prisma.sql`
    WITH ${PRIMERA_MATRICULA}
    SELECT p."reservaId" AS rid, COUNT(*) AS n
      FROM "participantes" p
      LEFT JOIN primera_matricula an ON an."pid" = p."id"
     WHERE p."reservaId" IN (${Prisma.join(reservas.map((r) => r.id))})
     ${enPeriodo(null, null)}
     GROUP BY 1
  `);

  return new Map(filas.map((f) => [f.rid, Number(f.n)]));
}

/** La fila cruda que agrupa `armarAgrupadas`. Se exporta para la prueba. */
export type ReservaParaAgrupar = {
  id: string;
  estado: EstadoReserva;
  cuposSolicitados: number;
  cuposConfirmados: number;
  cuposEnEspera: number;
  creadoEn: Date;
  canceladaEn: Date | null;
  contactoNombre: string;
  contactoCorreo: string;
  contactoCelular: string | null;
  contactoCargo: string | null;
  empresa: {
    id: string;
    nit: string;
    digitoVerificacion: string | null;
    razonSocial: string;
    numeroColaboradores: number | null;
    redAsociada: string | null;
    redAsociadaOtra: string | null;
  };
  oferta: {
    modalidad: Modalidad;
    ubicacion: { nombre: string };
    accionFormacion: {
      id: string;
      codigo: string;
      nombre: string;
      convenio: { slug: string; sigla: string | null };
    };
  };
  formulario: { slug: string; titulo: string } | null;
};

/**
 * El agrupado, a partir de las filas ya traídas.
 *
 * Aparte de la consulta —y probado aparte— porque es donde está lo
 * que puede salir mal: que una empresa se parta en dos filas, que
 * una columna AF se pierda, o que los totales dejen de cuadrar con
 * lo que suman las celdas.
 */
export function armarAgrupadas(
  reservas: ReservaParaAgrupar[],
  /// Reserva -> cuántos de sus cupos tienen ya persona. Opcional
  /// porque las pruebas arman filas a mano y lo que comprueban es el
  /// agrupado, no la cobertura; sin él, todo sale sin nombre.
  conNombrePorReserva: Map<string, number> = new Map(),
  /// Organización -> lo que pasó con sus leads, sin las dos
  /// fórmulas: las cierra esta función con los cupos ya sumados de
  /// la fila, que es cuando se conocen. Opcional por lo mismo.
  leadsPorEmpresa: Map<string, LeadsCrudos> = new Map(),
): ReservasAgrupadas {
  const columnas = new Map<string, ColumnaAccion>();
  const porEmpresa = new Map<string, FilaAgrupada>();
  /// Los contactos y los formularios se juntan por su llave natural
  /// —el correo y el slug— para no repetir a la misma persona
  /// cuatro veces cuando diligenció las cuatro AF.
  const contactos = new Map<string, Map<string, ContactoConsolidado>>();
  const formularios = new Map<
    string,
    Map<string, { slug: string; titulo: string; codigos: string[] }>
  >();

  /// Qué gremios trae cada código. Con dos, la cabecera tiene que
  /// decir cuál es cuál: dos columnas rotuladas «AF1» a secas son
  /// indistinguibles.
  const gremiosPorCodigo = new Map<string, Set<string>>();

  for (const r of reservas) {
    const af = r.oferta.accionFormacion;

    if (!columnas.has(af.id)) {
      columnas.set(af.id, {
        accionFormacionId: af.id,
        codigo: af.codigo,
        nombre: af.nombre,
        convenio: af.convenio.slug,
        convenioSigla: af.convenio.sigla,
        modalidad: r.oferta.modalidad,
        ambiguo: false,
      });
    }
    const gremios = gremiosPorCodigo.get(af.codigo) ?? new Set<string>();
    gremios.add(af.convenio.slug);
    gremiosPorCodigo.set(af.codigo, gremios);

    let fila = porEmpresa.get(r.empresa.id);
    if (!fila) {
      fila = {
        empresaId: r.empresa.id,
        nit: r.empresa.nit,
        digitoVerificacion: r.empresa.digitoVerificacion,
        razonSocial: r.empresa.razonSocial,
        numeroColaboradores: r.empresa.numeroColaboradores,
        redAsociada: r.empresa.redAsociada,
        redAsociadaOtra: r.empresa.redAsociadaOtra,
        primeraReserva: r.creadoEn.toISOString(),
        ultimaReserva: r.creadoEn.toISOString(),
        contactos: [],
        formularios: [],
        totalReservas: 0,
        reservasVivas: 0,
        reservasCanceladas: 0,
        cuposConfirmados: 0,
        cuposEnEspera: 0,
        cuposSolicitados: 0,
        conNombre: 0,
        sinNombre: 0,
        /// Se rellena al cerrar la fila, cuando ya están sumados sus
        /// cupos: «Cupos pendientes» los resta.
        leads: SIN_LEADS,
        porAccion: {},
      };
      porEmpresa.set(r.empresa.id, fila);
      contactos.set(r.empresa.id, new Map());
      formularios.set(r.empresa.id, new Map());
    }

    /// Todas las de esta acción caen en la misma celda: la misma AF
    /// en dos sedes son dos reservas, y quedarse con una dejaría la
    /// otra contando en los totales sin verse en ninguna columna.
    const celda = (fila.porAccion[af.id] ??= {
      reservas: [],
      estado: r.estado,
      mixta: false,
      cuposSolicitados: 0,
      cuposConfirmados: 0,
      cuposEnEspera: 0,
      conNombre: 0,
      sinNombre: 0,
      primera: r.creadoEn.toISOString(),
      ultima: r.creadoEn.toISOString(),
    });

    /// Cancelada = cero, aunque le queden personas colgadas: sus
    /// cupos volvieron a la oferta y contarlas subiría la cobertura
    /// justo al cancelar. Es la misma defensa que hace el informe.
    const conNombre =
      r.estado === EstadoReserva.CANCELADA ? 0 : (conNombrePorReserva.get(r.id) ?? 0);
    /// Acotado EN LA RESERVA y no en la fila: doce personas en una
    /// reserva de diez no llenan las sillas de otra, y acotando más
    /// arriba la sobra de una se comería los huecos de la de al lado
    /// según cómo se agrupara.
    const sinNombre = Math.max(0, r.cuposConfirmados - conNombre);

    celda.reservas.push({
      reservaId: r.id,
      estado: r.estado,
      cuposSolicitados: r.cuposSolicitados,
      cuposConfirmados: r.cuposConfirmados,
      cuposEnEspera: r.cuposEnEspera,
      conNombre,
      sinNombre,
      creadoEn: r.creadoEn.toISOString(),
      canceladaEn: r.canceladaEn?.toISOString() ?? null,
      ubicacion: r.oferta.ubicacion.nombre,
      modalidad: r.oferta.modalidad,
      contactoNombre: r.contactoNombre,
      contactoCorreo: r.contactoCorreo,
      contactoCelular: r.contactoCelular,
      contactoCargo: r.contactoCargo,
      formulario: r.formulario,
    });
    celda.cuposSolicitados += r.cuposSolicitados;
    celda.cuposConfirmados += r.cuposConfirmados;
    celda.cuposEnEspera += r.cuposEnEspera;
    celda.conNombre += conNombre;
    celda.sinNombre += sinNombre;
    if (r.creadoEn.toISOString() < celda.primera) celda.primera = r.creadoEn.toISOString();
    if (r.creadoEn.toISOString() > celda.ultima) celda.ultima = r.creadoEn.toISOString();

    fila.totalReservas += 1;
    if (r.estado === EstadoReserva.CANCELADA) fila.reservasCanceladas += 1;
    else fila.reservasVivas += 1;
    fila.cuposConfirmados += r.cuposConfirmados;
    fila.cuposEnEspera += r.cuposEnEspera;
    fila.cuposSolicitados += r.cuposSolicitados;
    fila.conNombre += conNombre;
    fila.sinNombre += sinNombre;

    const iso = r.creadoEn.toISOString();
    if (iso < fila.primeraReserva) fila.primeraReserva = iso;
    if (iso > fila.ultimaReserva) fila.ultimaReserva = iso;

    const suyos = contactos.get(r.empresa.id)!;
    const llave = r.contactoCorreo.trim().toLowerCase();
    const yaEsta = suyos.get(llave);
    if (yaEsta) {
      if (!yaEsta.codigos.includes(af.codigo)) yaEsta.codigos.push(af.codigo);
    } else {
      suyos.set(llave, {
        nombre: r.contactoNombre,
        correo: r.contactoCorreo,
        celular: r.contactoCelular,
        cargo: r.contactoCargo,
        codigos: [af.codigo],
      });
    }

    if (r.formulario) {
      const losSuyos = formularios.get(r.empresa.id)!;
      const entrada = losSuyos.get(r.formulario.slug);
      if (entrada) {
        if (!entrada.codigos.includes(af.codigo)) entrada.codigos.push(af.codigo);
      } else {
        losSuyos.set(r.formulario.slug, {
          slug: r.formulario.slug,
          titulo: r.formulario.titulo,
          codigos: [af.codigo],
        });
      }
    }
  }

  for (const [empresaId, fila] of porEmpresa) {
    fila.contactos = [...contactos.get(empresaId)!.values()];
    fila.formularios = [...formularios.get(empresaId)!.values()];

    /// Las dos fórmulas de la hoja del cliente, AQUÍ y no en la
    /// consulta: «Cupos pendientes» resta los leads de los cupos
    /// CONFIRMADOS de la fila, que es una suma de sus reservas y no
    /// un dato de la base.
    fila.leads = cerrarCifrasDeLeads(
      leadsPorEmpresa.get(empresaId) ?? SIN_LEADS,
      fila.cuposConfirmados,
    );

    /// El estado de cada celda, ya con todas sus reservas dentro.
    /// Manda la que más sitio tiene: si una de las dos sedes quedó
    /// confirmada, en esa acción la empresa TIENE cupo, y pintar la
    /// celda de cancelada por la otra diría lo contrario.
    for (const celda of Object.values(fila.porAccion)) {
      const estados = new Set(celda.reservas.map((x) => x.estado));
      celda.mixta = estados.size > 1;
      celda.estado = estados.has(EstadoReserva.CONFIRMADA)
        ? EstadoReserva.CONFIRMADA
        : estados.has(EstadoReserva.LISTA_ESPERA)
          ? EstadoReserva.LISTA_ESPERA
          : EstadoReserva.CANCELADA;
    }
  }

  for (const columna of columnas.values()) {
    columna.ambiguo = (gremiosPorCodigo.get(columna.codigo)?.size ?? 1) > 1;
  }

  /// Las columnas van por código —AF1, AF2, AF3…— y con el gremio
  /// de desempate: así los dos «AF1» quedan juntos y se ven como lo
  /// que son, dos acciones distintas con el mismo número.
  const acciones = [...columnas.values()].sort(
    (a, b) =>
      a.codigo.localeCompare(b.codigo, 'es', { numeric: true }) ||
      a.convenio.localeCompare(b.convenio),
  );

  /// De más a menos apartado: quien más cupos tiene es de quien más
  /// hay que hablar. La tabla deja reordenar por la columna que sea.
  const filas = [...porEmpresa.values()].sort(
    (a, b) =>
      b.cuposConfirmados - a.cuposConfirmados ||
      b.totalReservas - a.totalReservas ||
      a.razonSocial.localeCompare(b.razonSocial, 'es'),
  );

  return {
    total: filas.length,
    truncado: filas.length > TOPE_ORGANIZACIONES,
    acciones,
    filas: filas.slice(0, TOPE_ORGANIZACIONES),
  };
}
