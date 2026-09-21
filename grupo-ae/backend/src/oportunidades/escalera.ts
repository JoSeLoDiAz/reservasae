/** Qué movimiento de etapa es posible, y qué exige antes. */

/**
 * La escalera de la venta, hermana de `crm/escalera.ts`.
 *
 * Misma idea y por la misma razón: mover de etapa es UN solo PATCH
 * y el asesor elige el destino libremente, así que sin reglas de
 * transición la etapa de llegada es lo único que se mira y la de
 * salida no cuenta para nada. En el CRM de inscripciones eso dejó
 * a gente «en formación» sin autorización de datos.
 *
 * Aquí el daño equivalente es un pronóstico inflado, que es más
 * silencioso y peor: nadie se entera hasta que el mes cierra por
 * debajo y ya no hay a quién preguntarle.
 *
 * Las tres compuertas de esta escalera son las que separan un
 * embudo que informa de uno que solo se ve bonito:
 *
 *  - **Calificar exige tener con qué.** Sin valor, una oportunidad
 *    calificada aporta cero al pronóstico y ocupa una columna. Es
 *    la casilla que en todos los CRMs se queda vacía.
 *  - **Cerrar exige motivo.** Sin motivo no se aprende nada del año
 *    anterior, y el informe de perdidas es una lista de nombres.
 *  - **Cada embudo solo sube sus peldaños.** Una oportunidad de
 *    persona no puede estar «en negociación»: esa etapa no existe
 *    en su embudo y su probabilidad es cero, así que la fila
 *    desaparecería del pronóstico sin que nadie lo pidiera.
 *
 * Nada está prohibido de verdad. Se puede retroceder, se puede
 * reabrir una perdida y se puede saltar de CAPTADO a GANADO si de
 * verdad pasó. Lo que no se puede es hacerlo sin que quede escrito
 * quién y por qué: es la diferencia entre no poder y tener que
 * decirlo.
 *
 * Módulo puro y aparte para poder probarlo sin levantar la
 * aplicación, igual que `embudos.ts`.
 */

import {
  EtapaOportunidad,
  TipoEmbudo,
  type MotivoCierre,
} from '../../generated/prisma';
import {
  ETAPAS_ABIERTAS,
  esDelEmbudo,
  estaAbierta,
  motivoValeParaCerrar,
} from './embudos';

/** Lo que se sabe de la oportunidad al pedir el movimiento. */
export type Hechos = {
  embudo: TipoEmbudo;
  /// Lo que se le va a facturar. En pesos, ya en número.
  valor: number;
  /// De quién es. Una de las dos, según el embudo.
  tieneEmpresa: boolean;
  tienePersona: boolean;
  /// Quién responde por ella.
  tieneAsesor: boolean;
  /// Lo que trae la petición, cuando cierra.
  motivo?: MotivoCierre | null;
  nota?: string | null;
};

export type Veredicto = {
  puede: boolean;
  /// Qué falta, en la frase que va a leer el asesor. Null si pasa.
  porque: string | null;
};

const PASA: Veredicto = { puede: true, porque: null };

const no = (porque: string): Veredicto => ({ puede: false, porque });

/**
 * Si se puede ir de una etapa a otra, y qué falta si no.
 *
 * `de` es null cuando la oportunidad se está creando: nace en
 * CAPTADO y esa entrada también pasa por aquí, para que crear
 * directamente en una etapa avanzada exija lo mismo que llegar a
 * ella paso a paso. Sin eso, la compuerta se esquiva creando.
 */
export function puedeIr(
  de: EtapaOportunidad | null,
  a: EtapaOportunidad,
  hechos: Hechos,
): Veredicto {
  const { embudo } = hechos;

  /// Antes que nada: que la etapa sea de este embudo.
  if (!esDelEmbudo(embudo, a)) {
    const cual = embudo === TipoEmbudo.PERSONA ? 'de personas' : 'de empresas';
    return no(`«${rotulo(a)}» no es una etapa del embudo ${cual}.`);
  }

  if (de === a) return no('Ya está en esa etapa.');

  /// Toda oportunidad viva necesita dueño antes de avanzar. En
  /// CAPTADO todavía no: es justo el estado de «entró y no lo ha
  /// tomado nadie», que es lo que mide el reloj de respuesta.
  if (a !== EtapaOportunidad.CAPTADO && !hechos.tieneAsesor) {
    return no('Asígnele un asesor antes de moverla: sin dueño no la trabaja nadie.');
  }

  /// De quién es. Se pide al calificar y no al crear, porque un
  /// lead entra muchas veces sin más que un celular.
  const desdeCalificado = ordenDe(embudo, a) >= ordenDe(embudo, EtapaOportunidad.CALIFICADO);
  if (desdeCalificado && estaAbierta(a)) {
    if (embudo === TipoEmbudo.EMPRESA && !hechos.tieneEmpresa) {
      return no('Falta la empresa. Calificar en el embudo de empresas es saber a quién se le vende.');
    }
    if (embudo === TipoEmbudo.PERSONA && !hechos.tienePersona) {
      return no('Falta la persona a la que se le vende.');
    }
    if (hechos.valor <= 0) {
      return no('Falta el valor. Una oportunidad calificada sin valor aporta cero al pronóstico y ocupa una columna.');
    }
  }

  /// Cerrar, en cualquiera de las dos formas.
  if (!estaAbierta(a)) {
    if (!hechos.motivo) {
      return no('Diga por qué se cierra. Sin motivo, el informe del año que viene es una lista de nombres.');
    }
    if (!motivoValeParaCerrar(a, hechos.motivo)) {
      const verbo = a === EtapaOportunidad.GANADO ? 'ganar' : 'perder';
      return no(`«${rotuloMotivo(hechos.motivo)}» no es un motivo de ${verbo}.`);
    }
    if (a === EtapaOportunidad.GANADO && hechos.valor <= 0) {
      return no('Una venta ganada tiene que tener valor: es la cifra que va a cerrar el mes.');
    }
  }

  /**
   * Reabrir.
   *
   * Se permite —los negocios vuelven— pero exige nota. El motivo
   * de cierre anterior se queda en el historial y la nota explica
   * por qué dejó de valer; sin ella, la oportunidad reaparece en
   * el pronóstico sin que nadie sepa de dónde salió.
   */
  if (de !== null && !estaAbierta(de) && estaAbierta(a)) {
    if (!hechos.nota?.trim()) {
      return no('Para reabrirla, escriba qué cambió. Vuelve a contar en el pronóstico y eso hay que poder explicarlo.');
    }
  }

  return PASA;
}

/**
 * En qué peldaño va, para saber si sube o baja.
 *
 * Las cerradas van al final y empatadas: ganar y perder son dos
 * finales, no uno mejor que el otro. Una etapa que no es del
 * embudo devuelve -1, y por eso `puedeIr` la rechaza antes de
 * llegar aquí.
 */
export function ordenDe(embudo: TipoEmbudo, etapa: EtapaOportunidad): number {
  if (!estaAbierta(etapa)) return 99;
  return ETAPAS_ABIERTAS[embudo].indexOf(etapa);
}

/** Si ese movimiento va hacia adelante. Para la bitácora. */
export function avanza(
  embudo: TipoEmbudo,
  de: EtapaOportunidad | null,
  a: EtapaOportunidad,
): boolean {
  if (de === null) return true;
  return ordenDe(embudo, a) > ordenDe(embudo, de);
}

/// Los rótulos que ve la gente. Viven aquí y no en el panel porque
/// los usan los mensajes de error del backend.
///
/// HAY UNA SEGUNDA COPIA, en `cajon-oportunidad.tsx`, y es
/// inevitable: son dos paquetes y el panel no puede importar del
/// backend. Las dos se cambian juntas. Lo que NO se puede es dejar
/// que discrepen: en `EtapaParticipante` pasó justo eso y acabó
/// mandando campañas a la gente equivocada.
///
/// EL NOMBRE DEL ENUM NO CAMBIA, SOLO EL RÓTULO. La dirección
/// llamó a estas etapas «solicitud de negocio», «cotización» y
/// «cerrado ganado / perdido» (notas del 15 sep 2026), y eso es lo
/// que tiene que leerse en pantalla. Renombrar el enum obligaría a
/// una migración sobre una columna que ya tiene historial en
/// `movimientos_oportunidad`, y a cambio de nada: el valor de la
/// base no lo lee nadie más que el código.
///
/// SIGUEN EN PASADO, que es la regla del enum: «Cotización
/// enviada» y no «Cotización», porque «cotización» a secas se
/// puede marcar con la intención de cotizar algún día, y un
/// pronóstico hecho de intenciones no vale nada.
const ROTULOS: Record<EtapaOportunidad, string> = {
  CAPTADO: 'Solicitud de negocio',
  CONTACTADO: 'Contactado',
  CALIFICADO: 'Calificado',
  PROPUESTA_ENVIADA: 'Cotización enviada',
  EN_NEGOCIACION: 'En negociación',
  GANADO: 'Cerrado ganado',
  PERDIDO: 'Cerrado perdido',
};

export function rotulo(etapa: EtapaOportunidad): string {
  return ROTULOS[etapa];
}

const ROTULOS_MOTIVO: Record<MotivoCierre, string> = {
  PRECIO_ACEPTADO: 'Aceptó el precio',
  UNICA_OPCION: 'Era la única opción',
  RECOMENDACION: 'Vino recomendado',
  PRECIO_ALTO: 'Le pareció caro',
  SIN_PRESUPUESTO: 'No tenía presupuesto',
  SE_FUE_CON_OTRO: 'Se fue con otro',
  FUERA_DE_TIEMPO: 'Fuera de tiempo',
  NO_ERA_QUIEN_DECIDE: 'No era quien decide',
  NUNCA_RESPONDIO: 'Nunca respondió',
  NO_LE_INTERESA: 'No le interesa',
  DATOS_ERRADOS: 'Datos errados',
  OTRO: 'Otro',
};

export function rotuloMotivo(motivo: MotivoCierre): string {
  return ROTULOS_MOTIVO[motivo];
}
