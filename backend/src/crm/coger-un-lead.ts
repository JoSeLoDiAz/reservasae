/** Quién puede cambiarle el asesor a un lead. */

/**
 * UN ASESOR PUEDE COGER UN LEAD LIBRE, Y NADA MÁS (2 oct 2026).
 *
 * La regla de `REPARTEN_FICHAS` sigue en pie y su motivo también:
 * «decidir a quién le toca cada lead es organizar el trabajo del
 * equipo, y eso lo hace quien responde por el equipo». Lo que
 * protegía, con sus palabras, era que «cualquiera podía pasarle sus
 * fichas a otro ---o quitárselas».
 *
 * Pero dejaba al equipo parado: los cinco gestores de ADECOPRIA son
 * justo quienes trabajan los leads, y no podían ni quedarse con uno
 * que no era de nadie. Josse abrió EXACTAMENTE esa rendija (2 oct
 * 2026): coger uno libre, para sí, y nada más.
 *
 * Las tres condiciones son la regla entera, y ninguna sobra:
 *
 *   - el lead NO TIENE DUEÑO. Si ya es de alguien, quitárselo es
 *     repartir, que es lo que la regla protege.
 *   - se lo queda QUIEN LO PIDE. Dárselo a un tercero también es
 *     repartir, aunque el lead estuviera libre.
 *   - y quien lo pide PUEDE LLEVAR FICHAS. Un académico o una
 *     cuenta de consulta no se quedan con leads; dejarlo entrar
 *     crearía un dueño que no los trabaja.
 *
 * SOLTAR TAMPOCO ES COGER, y por eso no se permite: dejar un lead
 * sin dueño lo saca de la lista de quien responde por él sin que
 * nadie lo decida. Eso sigue siendo de un líder.
 *
 * ESTO NO ESTABA COMPROBADO EN NINGÚN SITIO, y ese es el defecto
 * que venía de antes: `PATCH lote/asesor` sí exigía repartir, y
 * `PATCH :id` ---la ficha--- no exigía nada. Comprobado en caliente
 * el 2 oct 2026: una gestora movió una ficha de un asesor a otro
 * por esa puerta y recibió un 200. El candado vivía solo en la
 * pantalla, que es el «control en pie y vacío de efecto» de
 * siempre.
 */

export type QuienTocaElAsesor = {
  /// Quién lo pide. Se compara con el asesor pedido.
  adminId: string;
  /// Si REPARTE en el convenio de esta ficha.
  reparte: boolean;
  /// Si puede quedarse con fichas en el convenio de esta ficha.
  llevaFichas: boolean;
};

/** El motivo por el que no puede, o `null` si puede. */
export function motivoParaNoTocarElAsesor(caso: {
  quien: QuienTocaElAsesor;
  asesorAhora: string | null;
  asesorPedido: string | null;
}): string | null {
  const { quien, asesorAhora, asesorPedido } = caso;

  /// Quien reparte hace lo de siempre: poner, cambiar y quitar.
  if (quien.reparte) return null;

  if (asesorPedido === null) {
    return (
      'Soltar un lead lo hace un líder: deja de tener quien responda ' +
      'por él.'
    );
  }

  if (asesorAhora !== null) {
    return (
      'Ese lead ya tiene asesor. Pasárselo a otra persona lo hace un ' +
      'líder: es organizar el trabajo del equipo.'
    );
  }

  if (asesorPedido !== quien.adminId) {
    return (
      'Solo puede cogerlo para usted. Asignárselo a otra persona lo ' +
      'hace un líder.'
    );
  }

  if (!quien.llevaFichas) {
    return 'Su rol no se queda con leads.';
  }

  return null;
}

/** Si ese lead lo puede coger quien mira, tal como está hoy. */
export function puedeCogerlo(caso: {
  quien: QuienTocaElAsesor;
  asesorAhora: string | null;
}): boolean {
  return (
    motivoParaNoTocarElAsesor({
      quien: caso.quien,
      asesorAhora: caso.asesorAhora,
      asesorPedido: caso.quien.adminId,
    }) === null
  );
}
