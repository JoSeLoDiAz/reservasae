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

  return armarAgrupadas(reservas, await cuposConNombre(prisma, reservas));
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
