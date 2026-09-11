/** Qué se le puede cambiar a una oportunidad viva, y qué queda escrito. */

/**
 * La otra mitad del embudo.
 *
 * `escalera.ts` decide de qué etapa a qué etapa se puede ir. Esto
 * decide lo demás: si un cambio de valor, de moneda, de asesor o de
 * cliente se puede guardar, si una oportunidad se puede borrar, y
 * qué frase queda en la bitácora cuando algo de eso pasa.
 *
 * Está aparte y sin Nest ni Prisma por la misma razón que la
 * escalera: son las reglas que hay que poder probar sin levantar
 * nada, y las que van a cambiar cuando el equipo aprenda a vender.
 *
 * Dos cosas que aquí NO se hacen, y conviene decir por qué:
 *
 *  - **No se revalidan las transiciones.** Cuando un cambio pone en
 *    duda la etapa actual —quitarle el valor a una CALIFICADA, por
 *    ejemplo— esto le vuelve a preguntar a `puedeIr`. Copiar las
 *    compuertas aquí sería tener dos sitios donde arreglar la misma
 *    regla, y el segundo siempre se olvida.
 *  - **No se escribe nada.** Devuelve veredictos y frases; guardar
 *    es del servicio. Así una prueba de estas reglas no necesita
 *    base de datos.
 */

import { EtapaOportunidad, TipoEmbudo } from '../../generated/prisma';
import { estaAbierta, probabilidadDe } from './embudos';
import { puedeIr, rotulo, type Hechos, type Veredicto } from './escalera';

const PASA: Veredicto = { puede: true, porque: null };

const no = (porque: string): Veredicto => ({ puede: false, porque });

// ─────────────────────────────────────────────────────────────
// LO QUE SE PUEDE GUARDAR
// ─────────────────────────────────────────────────────────────

/**
 * Si la oportunidad SIGUE cumpliendo lo que su etapa le exige.
 *
 * Esta es la respuesta a la pregunta incómoda: la escalera vigila la
 * puerta de entrada de cada etapa, pero una vez dentro el valor se
 * puede editar, y ponerle 0 a una CALIFICADA la deja exactamente en
 * el estado que la compuerta existe para impedir —una columna
 * ocupada que aporta cero al pronóstico— sin que ninguna transición
 * lo haya tocado.
 *
 * **Se BLOQUEA, no se avisa.** Avisar y guardar deja la fila mal y
 * la advertencia en un aviso que nadie vuelve a ver; y peor, el
 * rastro diría «se editó el valor» cuando lo que pasó es que esta
 * oportunidad dejó de estar calificada. Bloquear obliga a decir qué
 * pasó de verdad: o el negocio se enfrió —y entonces baja de etapa—
 * o se cayó —y entonces se cierra como perdida con su motivo, que es
 * lo único que deja aprendizaje.
 *
 * Se le pregunta a `puedeIr` con `de = null`, que es la forma que ya
 * tiene la escalera de decir «¿esta oportunidad podría estar hoy en
 * esta etapa con estos datos?». Es la misma pregunta que se hace al
 * crear directamente en una etapa avanzada.
 */
export function sigueEnPie(etapa: EtapaOportunidad, hechos: Hechos): Veredicto {
  const veredicto = puedeIr(null, etapa, hechos);
  if (veredicto.puede) return PASA;

  /// Con la etapa cerrada la salida es otra: no se puede «bajar de
  /// etapa» algo que ya terminó.
  const salida = estaAbierta(etapa)
    ? `Si el negocio de verdad cambió, muévala a una etapa anterior o ciérrela como perdida con su motivo. Dejarla en «${rotulo(etapa)}» con estos datos es lo único que no se puede.`
    : 'Corrija el valor, o reábrala explicando qué cambió.';

  return no(`${veredicto.porque} ${salida}`);
}

/// Las monedas que se manejan. Lista corta y cerrada a propósito:
/// con texto libre llegan «COP», «cop», «pesos» y «COL$», y el
/// informe acaba con cuatro filas de la misma moneda.
export const MONEDAS = ['COP', 'USD', 'EUR'] as const;

export type Moneda = (typeof MONEDAS)[number];

export function normalizarMoneda(texto: string): Moneda | null {
  const limpia = texto.trim().toUpperCase();
  return (MONEDAS as readonly string[]).includes(limpia)
    ? (limpia as Moneda)
    : null;
}

/**
 * Si ese cambio de moneda se puede guardar.
 *
 * El tablero suma `valor` sin mirar `moneda` —y así va a seguir
 * mientras casi todo se cotice en pesos, porque convertir de verdad
 * pide una tabla de tasas por día y eso es otro proyecto—. Con esa
 * suma, pasar una oportunidad de 12.000.000 COP a USD sin tocar el
 * número la mete en el pronóstico como doce millones de dólares, y
 * nadie lo nota hasta que el total del mes es absurdo.
 *
 * Así que la moneda solo se cambia junto con el valor ya expresado
 * en ella. La única excepción es la que no puede hacer daño: si vale
 * cero, no hay cifra que malinterpretar.
 *
 * Devuelve además la moneda que QUEDA —la nueva ya normalizada, o
 * la de antes si no se pidió cambio— para que el servicio no tenga
 * que volver a normalizar lo que aquí ya se miró. Normalizar dos
 * veces es la forma habitual de que una de las dos se quede vieja.
 */
export function revisarMoneda(
  actual: { moneda: string; valor: number },
  pedido: { moneda?: string; valor?: number },
): Veredicto & { moneda: string } {
  const igual = { ...PASA, moneda: actual.moneda };
  if (pedido.moneda === undefined) return igual;

  const nueva = normalizarMoneda(pedido.moneda);
  if (nueva === null) {
    return {
      ...no(
        `«${pedido.moneda}» no es una de las monedas que se manejan. Use ${MONEDAS.join(', ')}.`,
      ),
      moneda: actual.moneda,
    };
  }
  if (nueva === actual.moneda) return igual;
  if (actual.valor === 0 || pedido.valor !== undefined) {
    return { ...PASA, moneda: nueva };
  }

  return {
    ...no(
      `El tablero suma los valores sin convertir de moneda, así que pasarla a ${nueva} dejando la cifra en ${enDinero(actual.valor, actual.moneda)} multiplicaría el pronóstico. Mande el valor ya expresado en ${nueva}.`,
    ),
    moneda: actual.moneda,
  };
}

/**
 * Si se le puede atar ese cliente a ese embudo.
 *
 * El modelo guarda las dos columnas —`empresaId` y `personaId`— y
 * deja la regla al servicio, que es lo que dice el comentario del
 * esquema: los dos embudos comparten tabla porque partirla en dos
 * obligaría a duplicar cada informe.
 *
 * La regla es que el embudo manda. Colgarle una persona a una
 * oportunidad de empresas no la deja «más completa»: la deja con un
 * dato que ninguna pantalla lee —el tablero enseña la empresa— y con
 * la compuerta de calificar todavía sin cumplir, porque esa
 * compuerta pide la empresa. El sitio del contacto que decide es la
 * ficha de la empresa, que ya tiene nombre y cargo.
 */
export function puedeAtarse(
  embudo: TipoEmbudo,
  que: 'empresa' | 'persona',
): Veredicto {
  const esperado = embudo === TipoEmbudo.EMPRESA ? 'empresa' : 'persona';
  if (que === esperado) return PASA;

  return embudo === TipoEmbudo.EMPRESA
    ? no(
        'Esta oportunidad va por el embudo de empresas: se le ata una empresa, no una persona. Si quien decide es un contacto suyo, va en la ficha de la empresa.',
      )
    : no(
        'Esta oportunidad va por el embudo de personas: se le ata una persona, no una empresa. Si de verdad se le vende a la empresa, créela en el embudo de empresas.',
      );
}

// ─────────────────────────────────────────────────────────────
// LA PROBABILIDAD A MANO
// ─────────────────────────────────────────────────────────────

/**
 * Si esa probabilidad se puede pisar.
 *
 * Pisarla es para el asesor que sabe algo que la etapa no dice: la
 * propuesta está enviada —50 % por tabla— pero el que decide se va
 * del país. Eso solo tiene sentido con el negocio vivo. En una
 * cerrada la probabilidad ya no es una apuesta sino un hecho, y
 * además no entra en el pronóstico, que solo cuenta lo abierto:
 * dejar pisarla ahí sería ofrecer un control que no mueve ninguna
 * cifra.
 */
export function puedePisarProbabilidad(
  etapa: EtapaOportunidad,
  pisada: number | null,
): Veredicto {
  if (pisada === null) return PASA;
  if (!estaAbierta(etapa)) {
    return no(
      `«${rotulo(etapa)}» ya no es una apuesta: la probabilidad de una oportunidad cerrada no cuenta en el pronóstico. Si el negocio volvió, reábrala.`,
    );
  }
  return PASA;
}

/**
 * Qué probabilidad queda, y si es propia.
 *
 * `null` la devuelve a la de su etapa y baja la bandera. Sin esa
 * vuelta atrás, pisarla una vez la congela para siempre:
 * `cambiarEtapa` respeta `probabilidadPropia` a propósito, así que
 * una oportunidad pisada al 10 % se quedaría al 10 % aunque llegara
 * a negociación.
 */
export function resolverProbabilidad(
  embudo: TipoEmbudo,
  etapa: EtapaOportunidad,
  pisada: number | null,
): { probabilidad: number; probabilidadPropia: boolean } {
  if (pisada === null) {
    return {
      probabilidad: probabilidadDe(embudo, etapa),
      probabilidadPropia: false,
    };
  }
  return { probabilidad: pisada, probabilidadPropia: true };
}

// ─────────────────────────────────────────────────────────────
// BORRAR
// ─────────────────────────────────────────────────────────────

/// El rastro que dejó una oportunidad, que es lo que decide si se
/// puede borrar.
export type Rastro = {
  etapa: EtapaOportunidad;
  /// Cuántas gestiones cuelgan de ella.
  gestiones: number;
  /// Cuántos movimientos tiene EN TOTAL. El alta escribe uno
  /// siempre, así que «sin historia» es exactamente uno.
  movimientos: number;
};

/**
 * Si se puede borrar de verdad, en vez de cerrar.
 *
 * En esta casa no se borra: se oculta, se cancela o se cierra, y la
 * fila se queda. Esta es la única excepción, y es estrecha a
 * propósito.
 *
 * La razón es que hay dos cosas distintas pidiendo el mismo botón.
 * Un negocio que se cayó es información —perdimos por precio contra
 * este competidor en junio— y borrarlo es tirar justo el dato del
 * que se aprende el año que viene; por eso todo lo que se trabajó se
 * cierra como PERDIDO con su motivo. Pero una fila creada por error
 * hace diez minutos —el título mal, el formulario mandado dos veces,
 * una prueba— no es información de nada: cerrarla como perdida mete
 * ruido en el informe de pérdidas y en la tasa de cierre, que son
 * las dos cifras que se miran para decidir.
 *
 * Las tres condiciones dicen «esto entró por error y nadie lo
 * tocó»: sigue en CAPTADO, nadie la ha gestionado y no se ha movido
 * de etapa ni una vez. En cuanto una falla hay trabajo o hay
 * historia, y entonces se cierra.
 *
 * La tercera hace falta además por un caso concreto: una perdida que
 * se reabre vuelve a CAPTADO. Sin mirar los movimientos, reabrir
 * sería el camino para borrar una oportunidad con su motivo de
 * cierre y todo su historial dentro.
 */
export function puedeBorrarse(rastro: Rastro): Veredicto {
  const cierre =
    'Ciérrela como perdida con su motivo: eso deja el aprendizaje y la saca del pronóstico igual.';

  if (rastro.etapa !== EtapaOportunidad.CAPTADO) {
    return no(
      `Solo se borra lo que entró por error y nadie llegó a trabajar. Esta ya va en «${rotulo(rastro.etapa)}». ${cierre}`,
    );
  }
  if (rastro.gestiones > 0) {
    return no(
      `Tiene ${rastro.gestiones} ${rastro.gestiones === 1 ? 'gestión registrada' : 'gestiones registradas'}, así que alguien la trabajó. ${cierre}`,
    );
  }
  if (rastro.movimientos > 1) {
    return no(
      `Ya se movió de etapa alguna vez, así que tiene historia que se perdería. ${cierre}`,
    );
  }
  return PASA;
}

// ─────────────────────────────────────────────────────────────
// LO QUE QUEDA ESCRITO
// ─────────────────────────────────────────────────────────────

/// Lo editable de una oportunidad, que es justo lo que hay que
/// saber narrar.
export type Campos = {
  titulo: string;
  valor: number;
  moneda: string;
  cierreEsperado: Date | null;
  campana: string | null;
};

/**
 * Qué cambió, en las frases que va a leer una persona dentro de un
 * año.
 *
 * Devuelve una línea por campo y **vacío cuando no cambió nada**,
 * que es la mitad del trabajo: el panel manda la ficha entera en
 * cada guardado, así que sin esta comparación cada vez que alguien
 * abre y cierra el formulario queda un movimiento nuevo. Cien
 * movimientos que dicen «se editó» esconden el uno que dice que el
 * valor se dobló, y una bitácora que hay que filtrar para leerla ya
 * no se lee.
 *
 * Se narra el ANTES y el DESPUÉS en la misma línea. Guardar solo el
 * valor nuevo obliga a reconstruir el anterior leyendo la historia
 * hacia atrás, que es lo que hace que nadie audite nunca un
 * pronóstico.
 */
export function narrarEdicion(antes: Campos, despues: Campos): string[] {
  const lineas: string[] = [];

  if (antes.titulo !== despues.titulo) {
    lineas.push(`Título: «${antes.titulo}» → «${despues.titulo}»`);
  }

  /// Valor y moneda en una sola línea: se mueven juntos, y leerlos
  /// en líneas separadas invita a comparar cifras de dos monedas.
  if (antes.valor !== despues.valor || antes.moneda !== despues.moneda) {
    lineas.push(
      `Valor: ${enDinero(antes.valor, antes.moneda)} → ${enDinero(despues.valor, despues.moneda)}`,
    );
  }

  /// Se comparan ya formateadas: la fecha de cierre es un día, no un
  /// instante, y dos `Date` del mismo día con distinta hora no son
  /// un cambio que nadie quiera leer en la bitácora.
  const cierreAntes = fechaCorta(antes.cierreEsperado);
  const cierreDespues = fechaCorta(despues.cierreEsperado);
  if (cierreAntes !== cierreDespues) {
    lineas.push(`Cierre esperado: ${cierreAntes} → ${cierreDespues}`);
  }

  if ((antes.campana ?? null) !== (despues.campana ?? null)) {
    lineas.push(
      `Campaña: ${antes.campana ?? 'sin campaña'} → ${despues.campana ?? 'sin campaña'}`,
    );
  }

  return lineas;
}

/** Quién la tenía y quién la tiene. */
export function narrarAsesor(
  antes: string | null,
  despues: string | null,
): string {
  if (antes === null && despues !== null) return `Asignada a ${despues}`;
  /// Soltarla se dice con el nombre de quien la suelta: «quedó sin
  /// dueño» a secas no deja a quién preguntarle qué pasó.
  if (antes !== null && despues === null) {
    return `${antes} la soltó: queda sin asesor`;
  }
  return `Pasó de ${antes} a ${despues}`;
}

/** Que la probabilidad se pisó, o que se soltó. */
export function narrarProbabilidad(
  antes: number,
  despues: number,
  pisada: boolean,
): string {
  return pisada
    ? `Probabilidad puesta a mano: ${antes} % → ${despues} %`
    : `Probabilidad devuelta a la de su etapa: ${antes} % → ${despues} %`;
}

/** A quién se le vende, cuando se ata o se corrige. */
export function narrarCliente(
  que: 'empresa' | 'persona',
  antes: string | null,
  despues: string,
): string {
  if (antes === null) return `Atada a la ${que} ${despues}`;
  return `${que === 'empresa' ? 'Empresa' : 'Persona'}: ${antes} → ${despues}`;
}

// ─────────────────────────────────────────────────────────────
// FORMATO
// ─────────────────────────────────────────────────────────────

/**
 * Miles con punto, como se escribe aquí.
 *
 * A mano y no con `Intl`: el texto de la bitácora se guarda en la
 * base para siempre, y no puede depender de qué juego de locales
 * traía el contenedor donde corría el backend ese día.
 */
export function enDinero(valor: number, moneda: string): string {
  const entero = Math.round(valor).toString();
  return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ${moneda}`;
}

/**
 * `30/06/2026`, y en UTC.
 *
 * En UTC porque el cierre esperado llega como fecha sin hora y se
 * guarda a medianoche UTC: leerlo en la hora de Bogotá —cinco horas
 * atrás— lo enseñaría siempre como el día anterior.
 */
export function fechaCorta(fecha: Date | null): string {
  if (fecha === null) return 'sin fecha';
  const dia = String(fecha.getUTCDate()).padStart(2, '0');
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${fecha.getUTCFullYear()}`;
}
