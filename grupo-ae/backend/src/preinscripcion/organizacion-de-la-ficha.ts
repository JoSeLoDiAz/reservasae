/** A qué organización se ata la ficha cuando la persona la dice. */

/**
 * Son dos cosas distintas y estaban en el mismo `??`:
 *
 *     const suya = p.reserva?.empresaId ?? p.empresaId ?? null;
 *
 * El comentario decía «la de la reserva manda y no se cambia: la
 * nominó ella», y es cierto del PRIMER término. El segundo no es
 * una nominación: es la respuesta anterior de la propia persona,
 * y corregirla es justo para lo que existe el enlace.
 *
 * Con los dos juntos, quien volvía diciendo «me equivoqué,
 * trabajo en Vise LTDA» reescribía la organización VIEJA con los
 * datos de la nueva. Y como el NIT y la razón social no viajan
 * en `datos`, quedaba una fila imposible: el NIT y el nombre de
 * la primera con la persona de contacto de la segunda. Visto en
 * producción; la organización nueva no llegaba a crearse.
 */

export type Decision = {
  /// La organización a la que se ata. `null` quiere decir «cae
  /// en la rama del NIT», que hace `upsert` y vuelve a atarla.
  atar: string | null;
  /// Si cambió de organización, para dejarlo en la auditoría.
  cambia: boolean;
};

export function aQueOrganizacionSeAta(caso: {
  /// La que apartó el cupo. Si existe, manda y no se discute.
  nominadaPorReserva: string | null;
  /// La que tiene atada hoy, con su NIT ya normalizado.
  suyaAhora: { id: string; nit: string } | null;
  /// El NIT que acaba de escribir, ya sin puntos ni guiones.
  nitQueDice: string | null;
}): Decision {
  const { nominadaPorReserva, suyaAhora, nitQueDice } = caso;

  /// Se compara por NIT y no por id: es lo único que la persona
  /// escribe, y es la clave única de `Empresa`.
  const cambia =
    !nominadaPorReserva && nitQueDice !== null && suyaAhora !== null
      ? suyaAhora.nit !== nitQueDice
      : false;

  const atar =
    nominadaPorReserva ?? (cambia ? null : (suyaAhora?.id ?? null)) ?? null;

  return { atar, cambia };
}
