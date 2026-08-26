/** Cómo van los cupos de una oferta, bloque por bloque. */

/// Una pre-reserva NO garantiza el cupo: da prevalencia.
///
/// Es la regla que ordena todo esto. La empresa que aparta
/// cuarenta cupos no tiene cuarenta sillas: tiene cuarenta
/// turnos preferentes, y solo se convierten en silla cuando
/// cada persona queda INSCRITA. Los que no se completen antes
/// del cierre se liberan y pasan al montón común.
///
/// Por eso el panel no puede decir «60 libres» y ya. Tiene
/// que decir las dos cosas a la vez:
///
///     100 cupos en Bogotá
///      40 apartados por empresas ......  12 inscritos, faltan 28
///      60 libres ......................  31 inscritos, faltan 29
///     ---------------------------------------------------------
///      43 inscritos en total, faltan 57
///
/// Sin ese desglose, quien inscribe no sabe que hay 28 turnos
/// preferentes sin usar que va a tener que liberar.

export type BloqueDeCupos = {
  /// Cuantos cupos abarca este bloque.
  cupos: number;
  /// Cuantos ya se convirtieron en una persona inscrita.
  inscritos: number;
  /// Los que faltan por completar. Nunca negativo.
  faltan: number;
  /// De 0 a 100, para la barra.
  avance: number;
};

export type CuposDeLaOferta = {
  total: number;
  /// Lo apartado por empresas que todavia no se ha liberado.
  apartados: BloqueDeCupos;
  /// El resto, para quien llegue.
  libres: BloqueDeCupos;
  /// Los dos juntos.
  todo: BloqueDeCupos;
  /// Ya no caben mas: no se puede inscribir a nadie.
  lleno: boolean;
  /// Turnos preferentes sin usar. Son los que hay que
  /// reclamar antes del cierre, o liberar.
  turnosSinUsar: number;
};

function bloque(cupos: number, inscritos: number): BloqueDeCupos {
  const faltan = Math.max(0, cupos - inscritos);
  return {
    cupos,
    inscritos,
    faltan,
    avance: cupos === 0 ? 0 : Math.min(100, Math.round((inscritos / cupos) * 100)),
  };
}

/**
 * Reparte los cupos de una oferta en sus dos bloques.
 *
 * `apartados` es la suma de lo que las empresas reservaron y
 * sigue vivo. `inscritosDeReserva` son los de esas empresas
 * que YA quedaron inscritos.
 *
 * Ojo con el caso que parece raro y no lo es: una empresa
 * puede inscribir a MÁS gente de la que aparto. Esos de mas
 * no salen de su bloque, salen del comun, porque el turno
 * preferente era por los cuarenta y no por los cuarenta y
 * tres. Por eso el bloque de apartados nunca cuenta mas
 * inscritos que cupos aparto.
 */
export function repartirCupos(entrada: {
  total: number;
  apartados: number;
  inscritosDeReserva: number;
  inscritosLibres: number;
}): CuposDeLaOferta {
  const total = Math.max(0, entrada.total);
  // no se puede apartar mas de lo que hay
  const apartados = Math.min(Math.max(0, entrada.apartados), total);
  const libres = total - apartados;

  // lo que una empresa inscriba de mas cae al comun
  const dentroDeSuTurno = Math.min(Math.max(0, entrada.inscritosDeReserva), apartados);
  const seDesbordo = Math.max(0, entrada.inscritosDeReserva) - dentroDeSuTurno;

  const enElComun = Math.max(0, entrada.inscritosLibres) + seDesbordo;

  const bApartados = bloque(apartados, dentroDeSuTurno);
  const bLibres = bloque(libres, enElComun);
  const inscritosTotales = dentroDeSuTurno + enElComun;

  return {
    total,
    apartados: bApartados,
    libres: bLibres,
    todo: bloque(total, inscritosTotales),
    lleno: inscritosTotales >= total,
    turnosSinUsar: bApartados.faltan,
  };
}
