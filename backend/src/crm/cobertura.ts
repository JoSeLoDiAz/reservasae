/** A quién cubre un grupo, por dónde vive. */

/// Un grupo se dicta en una ciudad o cubre un departamento
/// entero. Ofrecerle a alguien de Bogotá un grupo de Medellín
/// no es una opción: es un error esperando a que alguien lo
/// cometa con prisa un viernes a las cinco.
///
/// Y cuando se comete no se nota: la ficha queda con grupo, el
/// tablero la cuenta como lista, y el error aparece el día que
/// la persona no llega al curso.
///
/// La regla es la misma que usa el formulario público para
/// decidir qué ofertas enseñar, y por eso vive aparte de los
/// dos: si mañana cambia, tiene que cambiar en un solo sitio.

export type DondeSeDicta = {
  /// Como se llama la ubicación del grupo.
  nombre: string;
  /// CIUDAD cubre solo esa ciudad; DEPARTAMENTO, todo el suyo.
  tipo: string;
  /// Para las ciudades: a qué departamento pertenecen.
  departamento: string | null;
};

export type DondeVive = {
  departamento: string | null;
  ciudad: string | null;
};

/// Sin tildes, sin mayúsculas y sin espacios de más:
/// «BOGOTÁ D.C.» y «Bogota D.C» son el mismo sitio, y quien
/// escribió cada uno no se puso de acuerdo con el otro.
function igual(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  /// Los puntos se BORRAN, no se vuelven espacio: «D.C.» y
  /// «DC» son la misma sigla, y cambiándolos por espacio
  /// quedaba «d c», que ya no coincide con nada.
  const limpiar = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .trim();
  return limpiar(a) === limpiar(b);
}

/**
 * ¿Este grupo le sirve a esta persona?
 *
 * Cuando NO se sabe dónde vive, se dice que sí: no se puede
 * esconder media oferta por un dato que falta. El aviso de que
 * falta el domicilio va por otro lado; aquí, esconder sería
 * peor que ofrecer.
 */
export function cubreA(donde: DondeSeDicta, vive: DondeVive): boolean {
  if (!vive.departamento && !vive.ciudad) return true;

  if (donde.tipo === 'DEPARTAMENTO') {
    return igual(donde.nombre, vive.departamento);
  }

  /// Una ciudad cubre a quien vive EN ella.
  ///
  /// No basta con que coincida el departamento: un grupo
  /// presencial en Medellín no le sirve a alguien de Apartadó
  /// aunque los dos sean de Antioquia. Ese es justo el error
  /// que esto viene a impedir.
  if (igual(donde.nombre, vive.ciudad)) return true;

  /// Salvo que no sepamos su ciudad. Entonces se cae al
  /// departamento: es lo único que se puede afirmar, y dejar
  /// fuera un grupo bueno por un dato incompleto también es
  /// un error.
  if (!vive.ciudad) return igual(donde.departamento, vive.departamento);

  return false;
}

/// Los que le sirven, y cuántos quedaron fuera. El número
/// importa: una lista que se acorta sola sin decir por qué
/// parece un sistema roto.
export function repartirPorCobertura<T extends { ubicacion: DondeSeDicta }>(
  grupos: T[],
  vive: DondeVive,
): { cubren: T[]; fuera: number } {
  const cubren = grupos.filter((g) => cubreA(g.ubicacion, vive));
  return { cubren, fuera: grupos.length - cubren.length };
}
