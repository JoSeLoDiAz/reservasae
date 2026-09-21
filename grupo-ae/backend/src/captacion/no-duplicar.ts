/** Cuándo el mismo formulario es el mismo negocio. */

/**
 * El formulario público se manda dos veces. Siempre.
 *
 * Se manda dos veces porque el botón no dio señal, porque la
 * conexión tardó, porque la persona corrigió una letra del correo y
 * volvió a enviar, y porque un mes después vuelve a preguntar por lo
 * mismo. Sin una regla, cada uno de esos es una oportunidad nueva: y
 * dos oportunidades del mismo cliente en el mismo embudo son dos
 * asesores llamando a la misma persona el mismo día, dos propuestas
 * con precios distintos, y un pronóstico que cuenta el mismo dinero
 * dos veces.
 *
 * DOS VENTANAS, porque son dos preguntas distintas:
 *
 *  - **¿Es el mismo envío?** Minutos. Fue el mismo acto: doble clic,
 *    reintento, una corrección. No se crea nada y NI SIQUIERA se
 *    anota: apuntar cada doble clic llena la ficha de ruido y el
 *    asesor deja de leerla.
 *  - **¿Es el mismo negocio?** Meses. Volvió a levantar la mano
 *    sobre algo que ya se está trabajando. No se crea otra
 *    oportunidad, pero SÍ se anota: que el cliente vuelva a escribir
 *    es información, y es de las pocas señales que tiene el asesor
 *    de que sigue interesado.
 *
 * Y lo que NO se deduplica nunca:
 *
 *  - Lo CERRADO. Quien ya compró y vuelve es una recompra, y quien
 *    se perdió y vuelve es un negocio nuevo. Colgar el interés
 *    nuevo de la oportunidad perdida obligaría a reabrirla, y
 *    reabrirla le quitaría al informe del mes una pérdida que sí
 *    ocurrió. El histórico no se corrige hacia atrás: se suma una
 *    fila nueva.
 *  - Lo VIEJO, aunque siga abierto. Un negocio que lleva tres meses
 *    quieto y una persona que vuelve a escribir hoy no son la misma
 *    conversación. La vieja se queda donde está —aquí nada se
 *    borra— y el asesor la cerrará con el motivo que sea; cerrarla
 *    desde aquí sería inventarle un motivo, y el motivo es lo único
 *    que hace útil el informe de pérdidas.
 *
 * Módulo puro y aparte, con su spec, por lo mismo que `escalera.ts`:
 * son ventanas de tiempo, que es justo lo que no se puede probar
 * levantando la aplicación y esperando.
 */

import { EtapaOportunidad } from '../../generated/prisma';
import { estaAbierta } from '../oportunidades/embudos';

/**
 * Cuánto dura «el mismo envío».
 *
 * Quince minutos y no cinco. El encargo pedía que dos envíos en
 * cinco minutos no dieran dos oportunidades, y cinco justos es un
 * umbral que se cumple por los pelos: quien no recibe el correo de
 * confirmación espera un rato, se impacienta y vuelve a llenarlo, y
 * a los ocho minutos ya no es «el mismo envío» por tres minutos.
 * Nada malo pasa por estirarlo — dentro de la ventana larga
 * tampoco se crea una segunda oportunidad; lo único que cambia es
 * si el segundo envío se anota en la ficha o no.
 */
export const MINUTOS_DEL_MISMO_ENVIO = 15;

/**
 * Cuánto dura «el mismo negocio». Tres meses.
 *
 * Sale del ciclo de venta de esta casa, no de una constante
 * bonita: una venta a empresa se cierra en semanas y una a persona
 * en días, así que a los noventa días lo que había ya se ganó, se
 * perdió o se murió sin que nadie lo cerrara. Se recalcula cuando
 * haya cierres suficientes para saber cuánto dura de verdad — la
 * misma promesa que las probabilidades de `embudos.ts`.
 */
export const DIAS_DEL_MISMO_NEGOCIO = 90;

/// Una oportunidad que ya existe del mismo cliente, en la misma
/// línea de negocio y el mismo embudo. Quien llama la busca; esto
/// solo juzga.
export type Anterior = {
  id: string;
  codigo: string;
  etapa: EtapaOportunidad;
  creadoEn: Date;
  /// Cualquier cosa que la haya movido. Ver `queHacerCon`.
  ultimoToqueEn: Date;
};

export type Veredicto =
  /// No hay nada suyo vivo: es un negocio.
  | { que: 'CREAR' }
  /// El mismo acto de hace un rato. Silencio.
  | { que: 'EL_MISMO_ENVIO'; id: string; codigo: string }
  /// Vuelve sobre algo que ya se trabaja. Se anota en la que hay.
  | { que: 'EL_MISMO_NEGOCIO'; id: string; codigo: string };

const MINUTO = 60_000;
const DIA = 24 * 60 * MINUTO;

/**
 * Qué hacer con lo que este cliente ya tiene.
 *
 * Las ventanas se miden contra dos relojes distintos, y es
 * deliberado:
 *
 *  - La corta, contra `creadoEn`. Pregunta «¿esto nació hace un
 *    momento?», que es literalmente lo que es un doble envío.
 *  - La larga, contra `ultimoToqueEn`. Pregunta «¿alguien está
 *    trabajando esto?». Un negocio que nació hace medio año pero
 *    que el asesor movió ayer está más vivo que nunca, y medirlo
 *    contra el nacimiento le habría creado un duplicado justo
 *    cuando estaba caliente — que es el peor momento posible.
 */
export function queHacerCon(
  anteriores: Anterior[],
  ahora: Date = new Date(),
): Veredicto {
  /// Solo lo vivo estorba. Lo cerrado es historia, y la historia no
  /// se toca: ver el docblock.
  const abiertas = anteriores.filter((a) => estaAbierta(a.etapa));
  if (abiertas.length === 0) return { que: 'CREAR' };

  /// La más reciente manda. Si hubiera varias abiertas —que no
  /// debería, y es justo lo que esto evita— la vieja no puede
  /// decidir por la nueva.
  const ultima = abiertas.reduce((mas, a) =>
    a.creadoEn > mas.creadoEn ? a : mas,
  );

  const minutosDesdeQueNacio =
    (ahora.getTime() - ultima.creadoEn.getTime()) / MINUTO;
  if (minutosDesdeQueNacio < MINUTOS_DEL_MISMO_ENVIO) {
    return { que: 'EL_MISMO_ENVIO', id: ultima.id, codigo: ultima.codigo };
  }

  const diasDesdeQueLaTocaron =
    (ahora.getTime() - ultima.ultimoToqueEn.getTime()) / DIA;
  if (diasDesdeQueLaTocaron < DIAS_DEL_MISMO_NEGOCIO) {
    return { que: 'EL_MISMO_NEGOCIO', id: ultima.id, codigo: ultima.codigo };
  }

  return { que: 'CREAR' };
}
