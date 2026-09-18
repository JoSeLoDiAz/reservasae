/** El origen que le corresponde a quien llegó por esta visita. */

/**
 * SE EXIGE PRUEBA DE QUE SE PAGÓ, no de que venga de una red.
 *
 * Una primera versión atribuía a pauta a todo el que llegara
 * desde la app de Facebook o Instagram, y una revisión la paró:
 * ese navegador se abre con **cualquier** enlace tocado dentro de
 * esas apps — un post orgánico, un mensaje del community manager,
 * un enlace reenviado por Messenger. Con 111 visitas de app y una
 * sola preinscripción del anuncio, habría marcado como pagado
 * casi todo el tráfico orgánico, justo en el informe donde se
 * justifica la inversión.
 *
 * La prueba de lo pagado es la etiqueta que pone Ads Manager en
 * el enlace del anuncio: `utm_campaign`, o en su defecto el
 * `fbclid` que cuelga el redirector de Meta. Sin eso, la visita
 * se queda en `AUTOGESTION` y lo que se sabe queda en un toque.
 */

import { OrigenParticipante } from '../../generated/prisma';

/// Qué procedencia corresponde a qué origen de ficha. Solo las
/// redes: el resto no cambia nada.
export const DE_RED: Partial<Record<string, OrigenParticipante>> = {
  FACEBOOK: OrigenParticipante.FACEBOOK,
  INSTAGRAM: OrigenParticipante.INSTAGRAM,
  /// Sabemos que fue Meta y no cuál. `REDES` también cuenta como
  /// pauta en `origenDeLead`, así que la atribución no se pierde.
  META: OrigenParticipante.REDES,
};

/// Donde el canal ES el origen, sin pauta que probar.
///
/// Tiene que ser DISJUNTO de `DE_RED`: si una procedencia
/// cayera en los dos, cual gana lo decidiria el orden de dos
/// `??` y la compuerta de pago dejaria de ser una compuerta.
/// `origen-de-la-visita.spec.ts` lo ata.
///
/// QR se queda fuera a proposito: `OrigenParticipante` no
/// tiene esa palabra, y mapearlo a `OTRO` --que significa «no
/// sabemos»-- destruiria justo lo que se sabe. Se mide como
/// trafico igual; lo que no se puede es sellarlo en la ficha.
export const DE_CANAL: Partial<Record<string, OrigenParticipante>> = {
  CORREO: OrigenParticipante.CORREO,
  /// Quien entra por el enlace que repartió su empresa. Aquí SÍ
  /// hay palabra en el enum --«La empresa lo nominó»--, así que
  /// no pasa lo del QR. Va con `origenLead: ORGANICO` como el
  /// correo: llenó el formulario ella misma y nadie pagó por
  /// traerla. Y no toca la constancia de autorización:
  /// `autorizoAlRegistrarse` es de los leads del webhook, y quien
  /// se preinscribe deja la suya al aceptar la política.
  RESERVA: OrigenParticipante.EMPRESA,
  /// Entró el 18 sep 2026 con «Se reparte por → WhatsApp»: el
  /// enlace ya llegaba marcado y la ficha se quedaba en «Se
  /// inscribió solo». La palabra existe en el enum, y marcar
  /// WhatsApp de más no infla ninguna cifra de pago. Incluye el
  /// referente de WhatsApp Web: también es cierto.
  WHATSAPP: OrigenParticipante.WHATSAPP,
};

export type LlegadaDeLaVisita = {
  procedencia: string | null;
  /// Trae la etiqueta de campaña o el `fbclid`: se pagó.
  pagada: boolean;
  /// El nombre del envio (`utm_campaign`, o el del enlace
  /// corto). Opcional: quien no lo necesita no lo pide.
  campana?: string | null;
};

/**
 * El origen de la ficha, o `null` si la llegada no lo cambia.
 *
 * `null` y no `AUTOGESTION` a propósito: quien llama tiene que
 * poder distinguir «esta visita prueba que vino de una pauta» de
 * «esta visita no prueba nada», y dejar el valor de siempre en el
 * segundo caso sin escribirlo dos veces.
 */
export function origenDeLaVisita(llegada: LlegadaDeLaVisita | null): OrigenParticipante | null {
  if (!llegada?.procedencia || !llegada.pagada) return null;
  return DE_RED[llegada.procedencia] ?? null;
}

/**
 * Lo que se sabe de la llegada aunque NO se pueda atribuir.
 *
 * Una visita de Instagram sin etiqueta de campaña no vuelve la
 * ficha «pauta pagada», pero sí es cierto que llegó por ahí y eso
 * merece constancia. Va al toque, que es donde caben las cosas
 * ciertas que no cambian a quién pertenece el lead.
 */
export function redDeLaVisita(llegada: LlegadaDeLaVisita | null): OrigenParticipante | null {
  if (!llegada?.procedencia) return null;
  return DE_RED[llegada.procedencia] ?? null;
}

/**
 * El canal por el que llegó, y aquí NO se exige `pagada`.
 *
 * Un correo no se paga, así que pedirle prueba de pago sería
 * pedirle algo que nunca va a poder dar. Lo que sí hay es la
 * etiqueta que ponemos nosotros en el enlace (`utm_source`) y
 * dos hechos del navegador: el referente de un webmail y el del
 * redirector del proveedor de envíos.
 *
 * Es una afirmación más débil que la de pauta, y puede serlo:
 * marcar «Correo electrónico» de más no le quita el lead a
 * nadie ni infla la cifra con la que se justifica un gasto, que
 * es lo que la compuerta de pago existe para proteger.
 */
export function canalDeLaVisita(llegada: LlegadaDeLaVisita | null): OrigenParticipante | null {
  if (!llegada?.procedencia) return null;
  return DE_CANAL[llegada.procedencia] ?? null;
}
