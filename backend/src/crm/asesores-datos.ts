/** De dónde salen las cifras de cada asesor, en las dos subvistas. */

/**
 * Aparte de `seguimiento-de-asesores.ts` a propósito: allí viven las
 * CUENTAS --el ritmo, el color, la antigüedad-- y se prueban sin base
 * de datos; aquí vive de dónde se sacan las filas.
 *
 * Se traen filas estrechas y se reparten en memoria, por lo mismo que
 * en `metricas-inscripciones.ts`: «gestionado» no es una columna, es
 * una regla, y seis `groupBy` sobre las mismas dos tablas cuestan más
 * que traer lo justo y contarlo aquí.
 */

import { OCUPAN_SILLA } from './etapas';
import {
  antiguedadMedia,
  ritmoDe,
  type Carga,
  type Ritmo,
} from './seguimiento-de-asesores';
import {
  cierreDelGrupo,
  diasDeTrabajoEntre,
  hoyEnColombia,
  type ModalidadDeCierre,
} from './calendario-inscripcion';
import type { EtapaParticipante, Modalidad } from '../../generated/prisma';

/// «No interesado» en la pantalla; `PERDIDO` en la base.
const DESCARTADO: EtapaParticipante = 'PERDIDO';

/**
 * CONTRA QUÉ FECHA CORRE UN ASESOR, cuando lleva gente de varias
 * acciones a la vez.
 *
 * El cierre más próximo QUE TODAVÍA NO HA PASADO. Y esto no es un
 * detalle: la primera versión tomaba el más próximo a secas, y como
 * casi todos arrastran algún lead pegado a una acción que cerró en
 * julio, los seis asesores salían en rojo con «Vencido». Un tablero
 * donde todo el mundo está en rojo no dice a quién reforzar, que es
 * para lo único que se mira.
 *
 * Si de verdad no le queda ninguna fecha por delante, entonces sí
 * manda la última que pasó: ahí el rojo es cierto.
 *
 * Lo que se pierde, y hay que decirlo: los leads clavados en acciones
 * ya cerradas dejan de apretar el semáforo. No desaparecen --siguen
 * contados en «pendientes» y son los que le inflan la antigüedad
 * media--, pero su plazo ya no es una fecha a la que llegar.
 */
function elLimite(
  proximo: Date | null,
  ultimoPasado: Date | null,
): Date | null {
  return proximo ?? ultimoPasado;
}

/// Las dos etapas a las que se llega sin que nadie del equipo haga
/// nada: la de nacimiento, y la que calcula el sistema cuando la
/// persona termina su propio formulario. La misma regla que usa el
/// Resumen General de Control de inscritos.
const ETAPAS_SIN_TOCAR: EtapaParticipante[] = ['INTERESADO', 'DATOS_COMPLETOS'];

export type FilaDeAsesor = {
  asesorId: string | null;
  nombre: string;
  carga: Carga;
  /// `carga.resueltos` partido en sus dos mitades. Van aquí y no
  /// dentro de `Carga` porque esa forma la comparte la pestaña
  /// académica, donde «resuelto» es «certificado» y no hay
  /// descartados que separar.
  inscritos?: number;
  descartados?: number;
  ritmo: Ritmo;
  /// Días que llevan esperando, de media, los que siguen sin resolver.
  antiguedadMedia: number | null;
  /**
   * A CUÁNTA GENTE TOCÓ DENTRO DEL PERIODO. Otra cuenta que
   * `carga.gestionados`, y por eso va aparte.
   *
   * «No me está mostrando lo gestionado el viernes y lo gestionado
   * hoy» (cliente, 5 oct 2026). No lo mostraba porque no se podía:
   * `gestionados` responde «de los leads que LLEGARON en este
   * periodo, a cuántos se ha tocado alguna vez», y eso no cambia
   * entre el viernes y hoy si los leads llegaron en agosto. No había
   * ninguna fecha con la que recortar el acto de gestionar.
   *
   * La fecha sí existía, repartida en los tres sitios que ya
   * definían «gestionado»: la nota tiene `creadoEn`,
   * `datosTocadosPorAsesorEn` es un instante, y el movimiento de
   * etapa tiene el suyo. Esto cuenta las fichas donde ALGUNA de las
   * tres cayó dentro de la ventana, sin importar cuándo llegó la
   * persona. No hizo falta migración.
   *
   * Nulo cuando no hay ventana puesta: sin periodo, «gestionado en
   * el periodo» no quiere decir nada, y un cero ahí se leería como
   * que el asesor no hizo nada.
   */
  gestionadosEnElPeriodo: number | null;
  /// La fecha contra la que corre, para poder decirla en pantalla.
  limite: string | null;
  /// Su carga partida por accion: el desglose que se abre al pulsar
  /// la fila.
  ///
  /// OPCIONAL, y no por comodidad. Lo llena el reparto de
  /// INSCRIPCIONES, donde lo que aprieta es la fecha de cierre de
  /// cada accion. Los academicos llevan grupos enteros y su carga se
  /// mide contra el fin del curso: su desglose seria por grupo y es
  /// otra cuenta. Dejarlo vacio alli es mas honesto que inventarle
  /// uno, y la pantalla solo ofrece abrir la fila donde hay algo.
  porAccion?: CargaEnUnaAccion[];
};

export type FilaDeAsesorAcademico = FilaDeAsesor & {
  grupos: number;
  certificados: number;
  /// Cuántos de sus PAX ya recibieron al menos un seguimiento.
  conSeguimiento: number;
};

// ── inscripciones ────────────────────────────────────────────────

export type LeadDelAsesor = {
  asesorId: string | null;
  asesorNombre: string | null;
  etapa: EtapaParticipante;
  creadoEn: Date;
  datosTocadosPorAsesorEn: Date | null;
  notas: number;
  accionFormacionId: string | null;
  /// «AF1». Para rotular el desglose sin una segunda consulta.
  accionCodigo: string | null;
  accionNombre: string | null;
};

/**
 * LA CARGA DE UN ASESOR EN UNA ACCION, que es el desglose que se abre
 * al pulsar su fila.
 *
 * «Como la tablita, que cuando uno da clic dé como el desglose
 * detallado» (cliente, 24 sep 2026), igual que en Control de
 * inscritos.
 *
 * Por ACCION y no por grupo: lo que aprieta a un asesor es la fecha
 * de cierre, y esa es de la accion --el cierre mas proximo de sus
 * grupos--. Repartirlo por grupo daria filas con uno o dos leads y
 * ninguna respondería «donde se le esta acumulando».
 */
export type CargaEnUnaAccion = {
  accionFormacionId: string | null;
  codigo: string | null;
  /// EL NOMBRE ADEMÁS DEL CÓDIGO. Los AF se repiten entre convenios
  /// ---el foro es AF8 en un gremio y AF7 en el otro--- y hay dos
  /// acciones con código «AF1», así que un desplegable de códigos
  /// ofrece dos opciones idénticas.
  nombre: string | null;
  total: number;
  gestionados: number;
  resueltos: number;
  /// LOS DOS LADOS DE «RESUELTO», POR SEPARADO (cliente, 26 sep
  /// 2026: «esto es separado, o sea una columna Inscritos y en otro
  /// Descartados»). Sumados dan `resueltos`, pero juntos no se leen:
  /// un asesor con quince resueltos puede haber inscrito a quince o
  /// haber descartado a quince, y son dos conversaciones distintas.
  inscritos: number;
  descartados: number;
  pendientes: number;
};

/// Hasta cuándo puede inscribir cada acción: el cierre MÁS PRÓXIMO de
/// sus grupos. El más próximo y no el más lejano: en cuanto uno cierra
/// ya hay gente a la que no se puede meter ahí, y el asesor tiene que
/// enterarse entonces, no cuando cierre el último.
/**
 * Lo que hace falta saber de un grupo para fechar su cierre.
 *
 * `cierreInscripciones` OPCIONAL: los que todavía no lo seleccionan
 * siguen derivando, sin cambiar de comportamiento.
 */
export type GrupoConCierre = {
  accionFormacionId: string;
  fechaInicio: Date | null;
  modalidad: Modalidad;
  cierreInscripciones?: Date | null;
};

export function cierrePorAccion(grupos: GrupoConCierre[]): Map<string, Date> {
  const por = new Map<string, Date>();
  for (const g of grupos) {
    const cierre = cierreDelGrupo({
      fechaInicio: g.fechaInicio,
      modalidad: g.modalidad as unknown as ModalidadDeCierre,
      cierreInscripciones: g.cierreInscripciones,
    });
    if (!cierre) continue;
    const actual = por.get(g.accionFormacionId);
    if (!actual || cierre < actual) por.set(g.accionFormacionId, cierre);
  }
  return por;
}

/**
 * TODAS las fechas en que cierra una acción, en orden.
 *
 * UNA ACCIÓN NO CIERRA ENTERA: «las AF no cierran como tal una
 * completa sino por partes» (cliente, 2 oct 2026). En el cronograma
 * de ADECOPRIA seis de las siete cierran en dos o más fechas, y AF3
 * tiene una por cada uno de sus cinco grupos.
 *
 * `cierrePorAccion` se queda con la más próxima ---y hace bien, es
 * la primera puerta que se cierra--- pero enseñar SOLO esa deja al
 * asesor de los grupos que cierran después con unos días y una meta
 * diaria que no son los suyos. Esto devuelve la lista entera para
 * poder decirlo.
 */
export function cierresPorAccion(
  grupos: GrupoConCierre[],
): Map<string, Date[]> {
  const por = new Map<string, Date[]>();
  for (const g of grupos) {
    const cierre = cierreDelGrupo({
      fechaInicio: g.fechaInicio,
      modalidad: g.modalidad as unknown as ModalidadDeCierre,
      cierreInscripciones: g.cierreInscripciones,
    });
    if (!cierre) continue;
    const ya = por.get(g.accionFormacionId) ?? [];
    /// Por valor y no por identidad: dos grupos que cierran el
    /// mismo día son UNA fecha de cierre, no dos.
    if (!ya.some((d) => d.getTime() === cierre.getTime())) ya.push(cierre);
    por.set(g.accionFormacionId, ya);
  }
  for (const fechas of por.values())
    fechas.sort((a, b) => a.getTime() - b.getTime());
  return por;
}

/** Una fila por asesor de inscripciones. */
export function repartirInscripciones(
  leads: LeadDelAsesor[],
  cierres: Map<string, Date>,
  hoy: Date,
  /**
   * A CUÁNTAS FICHAS TOCÓ CADA ASESOR DENTRO DE LA VENTANA, por su
   * id ---y `'SIN_ASESOR'` para las que no tienen---.
   *
   * Viene de una consulta aparte y no se deduce de `leads`: estas
   * filas son las de los leads que LLEGARON en la ventana, y
   * gestionar es otra cosa que llegar. Quien el viernes trabajó
   * fichas de agosto no aparecería en ninguna.
   *
   * `undefined` = no hay ventana puesta, y entonces la cifra sale
   * nula en vez de cero: un cero se leería como que no hizo nada.
   */
  tocadosEnLaVentana?: Map<string, number>,
): FilaDeAsesor[] {
  const por = new Map<
    string,
    {
      nombre: string;
      total: number;
      resueltos: number;
      inscritos: number;
      descartados: number;
      gestionados: number;
      /// Cuándo llegó cada uno de los que siguen abiertos.
      esperando: Date[];
      /// El más viejo de TODOS, para saber cuántos días lleva con
      /// esta carga encima.
      primero: Date | null;
      /// El cierre más próximo QUE TODAVÍA NO HA PASADO, y aparte el
      /// último que ya pasó. Ver `elLimite`.
      proximo: Date | null;
      ultimoPasado: Date | null;
      /// Su carga partida por acción: el desglose de su fila.
      porAccion: Map<string, CargaEnUnaAccion>;
    }
  >();

  for (const l of leads) {
    /// La llave es el id, y «sin asesor» es una fila de verdad: son
    /// los leads que nadie está trabajando, y esconderlos es como se
    /// pierden.
    const llave = l.asesorId ?? 'SIN_ASESOR';
    const fila = por.get(llave) ?? {
      nombre: l.asesorNombre ?? 'Sin asesor asignado',
      total: 0,
      resueltos: 0,
      inscritos: 0,
      descartados: 0,
      gestionados: 0,
      esperando: [] as Date[],
      primero: null as Date | null,
      proximo: null as Date | null,
      ultimoPasado: null as Date | null,
      porAccion: new Map<string, CargaEnUnaAccion>(),
    };

    fila.total += 1;
    if (!fila.primero || l.creadoEn < fila.primero) fila.primero = l.creadoEn;

    /// Se parte en sus dos lados y `resuelto` es la suma: así la
    /// cuenta de siempre no puede separarse de las dos nuevas.
    const inscrito = OCUPAN_SILLA.includes(l.etapa);
    const descartado = l.etapa === DESCARTADO;
    const resuelto = inscrito || descartado;
    if (inscrito) fila.inscritos += 1;
    if (descartado) fila.descartados += 1;
    if (resuelto) fila.resueltos += 1;
    else fila.esperando.push(l.creadoEn);

    const gestionado =
      l.notas > 0 ||
      l.datosTocadosPorAsesorEn !== null ||
      !ETAPAS_SIN_TOCAR.includes(l.etapa);
    if (gestionado) fila.gestionados += 1;

    /// Y lo mismo, partido por acción. La llave es el id, y los que
    /// no tienen ninguna van juntos en una fila propia: son los que
    /// nadie ha encaminado todavía, y esconderlos es como se pierden
    /// --la misma razón por la que «sin asesor» es una fila--.
    const suAccion = l.accionFormacionId ?? 'SIN_ACCION';
    const enLaAccion = fila.porAccion.get(suAccion) ?? {
      accionFormacionId: l.accionFormacionId,
      codigo: l.accionCodigo,
      nombre: l.accionNombre,
      total: 0,
      gestionados: 0,
      resueltos: 0,
      inscritos: 0,
      descartados: 0,
      pendientes: 0,
    };
    enLaAccion.total += 1;
    if (gestionado) enLaAccion.gestionados += 1;
    if (inscrito) enLaAccion.inscritos += 1;
    if (descartado) enLaAccion.descartados += 1;
    if (resuelto) enLaAccion.resueltos += 1;
    else enLaAccion.pendientes += 1;
    fila.porAccion.set(suAccion, enLaAccion);

    /// Solo las acciones donde todavía le queda gente por resolver:
    /// los ya resueltos no aprietan. Se guardan los dos lados --lo que
    /// viene y lo que ya pasó-- y `elLimite` decide cuál manda.
    if (!resuelto && l.accionFormacionId) {
      const cierre = cierres.get(l.accionFormacionId);
      if (cierre) {
        if (cierre >= hoy) {
          if (!fila.proximo || cierre < fila.proximo) fila.proximo = cierre;
        } else if (!fila.ultimoPasado || cierre > fila.ultimoPasado) {
          fila.ultimoPasado = cierre;
        }
      }
    }

    por.set(llave, fila);
  }

  return (
    [...por.entries()]
      .map(([id, f]) => {
        const carga: Carga = {
          total: f.total,
          resueltos: f.resueltos,
          gestionados: f.gestionados,
        };
        const diasCorridos = f.primero
          ? Math.max(
              0,
              diasDeTrabajoEntre(hoyEnColombia(f.primero), hoyEnColombia(hoy)),
            )
          : 0;
        const limite = elLimite(f.proximo, f.ultimoPasado);
        return {
          asesorId: id === 'SIN_ASESOR' ? null : id,
          nombre: f.nombre,
          carga,
          inscritos: f.inscritos,
          descartados: f.descartados,
          ritmo: ritmoDe({ carga, limite, hoy, diasCorridos }),
          antiguedadMedia: antiguedadMedia(f.esperando, hoy),
          /// Nulo cuando no hay ventana: sin periodo, «gestionado
          /// en el periodo» no quiere decir nada.
          gestionadosEnElPeriodo: tocadosEnLaVentana
            ? (tocadosEnLaVentana.get(id) ?? 0)
            : null,
          limite: limite ? limite.toISOString().slice(0, 10) : null,
          /// En el mismo orden que la tabla de fuera: los que más
          /// pendientes tienen, arriba. Quien abre una fila busca dónde
          /// se le está acumulando, no la lista alfabética.
          porAccion: [...f.porAccion.values()].sort(
            (a, b) =>
              b.pendientes - a.pendientes ||
              (a.codigo ?? '').localeCompare(b.codigo ?? ''),
          ),
        };
      })
      /// Los que peor van, arriba: la pantalla es para decidir a quién
      /// reforzar, no para pasar lista.
      .sort(
        (a, b) =>
          b.ritmo.pendientes - a.ritmo.pendientes ||
          a.nombre.localeCompare(b.nombre),
      )
  );
}

// ── académicos ───────────────────────────────────────────────────

export type PaxDelAsesor = {
  asesorAcademicoId: string | null;
  asesorNombre: string | null;
  grupoId: string;
  fechaFin: Date | null;
  fechaInicio: Date | null;
  etapa: EtapaParticipante;
  notas: number;
};

/** Una fila por asesor académico. */
export function repartirAcademicos(
  pax: PaxDelAsesor[],
  hoy: Date,
): FilaDeAsesorAcademico[] {
  const por = new Map<
    string,
    {
      nombre: string;
      grupos: Set<string>;
      total: number;
      certificados: number;
      conSeguimiento: number;
      proximo: Date | null;
      ultimoPasado: Date | null;
      primero: Date | null;
    }
  >();

  for (const p of pax) {
    const llave = p.asesorAcademicoId ?? 'SIN_ASESOR';
    const fila = por.get(llave) ?? {
      nombre: p.asesorNombre ?? 'Sin asesor asignado',
      grupos: new Set<string>(),
      total: 0,
      certificados: 0,
      conSeguimiento: 0,
      proximo: null as Date | null,
      ultimoPasado: null as Date | null,
      primero: null as Date | null,
    };

    fila.grupos.add(p.grupoId);
    fila.total += 1;
    if (p.etapa === 'CERTIFICADO') fila.certificados += 1;
    if (p.notas > 0) fila.conSeguimiento += 1;

    /// El fin de curso más próximo QUE NO HAYA PASADO, y solo de los
    /// grupos donde aún queda gente sin certificar. El mismo criterio
    /// que en inscripciones, y por la misma razón: ver `elLimite`.
    if (p.etapa !== 'CERTIFICADO' && p.fechaFin) {
      if (p.fechaFin >= hoy) {
        if (!fila.proximo || p.fechaFin < fila.proximo)
          fila.proximo = p.fechaFin;
      } else if (!fila.ultimoPasado || p.fechaFin > fila.ultimoPasado) {
        fila.ultimoPasado = p.fechaFin;
      }
    }
    if (p.fechaInicio && (!fila.primero || p.fechaInicio < fila.primero)) {
      fila.primero = p.fechaInicio;
    }

    por.set(llave, fila);
  }

  return [...por.entries()]
    .map(([id, f]) => {
      const carga: Carga = {
        total: f.total,
        resueltos: f.certificados,
        gestionados: f.conSeguimiento,
      };
      /// Los días que lleva el grupo andando, no los del periodo: un
      /// asesor cuyo curso arrancó ayer no puede tener el ritmo de uno
      /// que lleva un mes.
      const diasCorridos = f.primero
        ? Math.max(
            0,
            diasDeTrabajoEntre(hoyEnColombia(f.primero), hoyEnColombia(hoy)),
          )
        : 0;
      const limite = elLimite(f.proximo, f.ultimoPasado);
      return {
        asesorId: id === 'SIN_ASESOR' ? null : id,
        nombre: f.nombre,
        grupos: f.grupos.size,
        certificados: f.certificados,
        conSeguimiento: f.conSeguimiento,
        carga,
        ritmo: ritmoDe({ carga, limite, hoy, diasCorridos }),
        /// En académica la antigüedad no se pide: lo que importa es
        /// cuánto falta para el cierre, no cuánto lleva esperando.
        antiguedadMedia: null,
        /// Y tampoco «gestionado en el periodo»: el aula la
        /// alimenta el LMS, así que tocar una ficha no es lo que
        /// mide el trabajo de un académico.
        gestionadosEnElPeriodo: null,
        limite: limite ? limite.toISOString().slice(0, 10) : null,
      };
    })
    .sort(
      (a, b) =>
        b.ritmo.pendientes - a.ritmo.pendientes ||
        a.nombre.localeCompare(b.nombre),
    );
}
