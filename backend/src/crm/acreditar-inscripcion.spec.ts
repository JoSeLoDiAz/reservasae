/** A quién se le acredita una inscripción, y cuándo cuenta. */

/**
 * «DEBO SABER CUÁNTO HIZO CADA ASESORA AYER, ANTIER, HOY. VUELVO Y
 * REITERO: LOS FILTROS DE TIEMPO O DE FECHA NO FUNCIONAN, Y YA LO
 * HABÍA REITERADO EN MUCHAS OCASIONES» (cliente, 7 oct 2026).
 *
 * El periodo de Seguimiento de asesores recorta por `creadoEn`
 * ---cuándo LLEGÓ el lead--- así que la columna de inscritos
 * respondía «de los leads que llegaron ayer, cuántos están inscritos
 * hoy». Con una base que lleva meses creciendo, «ayer» daba casi cero
 * siempre: la columna no estaba rota, estaba contestando otra cosa.
 *
 * Aquí se prueba a quién se le acredita cada inscripción, que es la
 * decisión de tres ramas que un spec de leer-el-fuente no vería.
 */

import {
  acreditarPorQuienInscribio,
  SIN_ASESOR,
} from './acreditar-inscripcion';

describe('a quién se le acredita', () => {
  it('a quien hizo el movimiento', () => {
    const r = acreditarPorQuienInscribio(
      [{ adminId: 'ana', participanteId: 'f1' }],
      [{ id: 'f1', asesorId: 'lucia' }],
    );
    /// Ana la inscribió aunque la ficha sea de Lucía: la pregunta es
    /// qué hizo cada quien.
    expect(r.get('ana')).toBe(1);
    expect(r.get('lucia')).toBeUndefined();
  });

  /**
   * Y SI NADIE FIRMÓ EL MOVIMIENTO, al asesor de la ficha. Es la
   * persona completando sola el formulario público: el trabajo de
   * haberla traído y empujado es de quien la venía llevando.
   */
  it('al asesor de la ficha cuando la persona se inscribió sola', () => {
    const r = acreditarPorQuienInscribio(
      [{ adminId: null, participanteId: 'f1' }],
      [{ id: 'f1', asesorId: 'lucia' }],
    );
    expect(r.get('lucia')).toBe(1);
  });

  /// Y si no tiene dueño, cuenta igual: es trabajo hecho, y
  /// esconderlo haría que las filas no sumaran el total.
  it('a la fila de los que no tienen asesor cuando no hay ninguno', () => {
    const r = acreditarPorQuienInscribio(
      [{ adminId: null, participanteId: 'f1' }],
      [{ id: 'f1', asesorId: null }],
    );
    expect(r.get(SIN_ASESOR)).toBe(1);
  });

  /// Una ficha que ya no está en la lista de dueños ---no ocupa
  /// silla--- tampoco rompe nada: cae en la fila sin asesor.
  it('una ficha sin dueño conocido no revienta la cuenta', () => {
    const r = acreditarPorQuienInscribio(
      [{ adminId: null, participanteId: 'fantasma' }],
      [],
    );
    expect(r.get(SIN_ASESOR)).toBe(1);
  });
});

describe('qué se cuenta', () => {
  /**
   * PERSONAS DISTINTAS, NO MOVIMIENTOS. Quien entra, sale y vuelve a
   * entrar tiene dos movimientos a INSCRITO y es UNA inscripción para
   * la cuenta de la asesora. Contando movimientos, una ficha que va y
   * viene infla a quien la mueva.
   */
  it('la misma persona no se cuenta dos veces', () => {
    const r = acreditarPorQuienInscribio(
      [
        { adminId: 'ana', participanteId: 'f1' },
        { adminId: 'ana', participanteId: 'f1' },
      ],
      [{ id: 'f1', asesorId: 'ana' }],
    );
    expect(r.get('ana')).toBe(1);
  });

  /// Y si la movieron dos personas distintas, se la lleva la primera:
  /// las dos no pueden haberla inscrito.
  it('con dos asesoras sobre la misma ficha, cuenta la primera', () => {
    const r = acreditarPorQuienInscribio(
      [
        { adminId: 'ana', participanteId: 'f1' },
        { adminId: 'lucia', participanteId: 'f1' },
      ],
      [{ id: 'f1', asesorId: 'lucia' }],
    );
    expect(r.get('ana')).toBe(1);
    expect(r.get('lucia')).toBeUndefined();
  });

  it('cada quien lleva las suyas', () => {
    const r = acreditarPorQuienInscribio(
      [
        { adminId: 'ana', participanteId: 'f1' },
        { adminId: 'ana', participanteId: 'f2' },
        { adminId: 'lucia', participanteId: 'f3' },
      ],
      [],
    );
    expect(r.get('ana')).toBe(2);
    expect(r.get('lucia')).toBe(1);
  });

  it('sin inscripciones, el mapa sale vacío y no en cero', () => {
    expect([...acreditarPorQuienInscribio([], []).keys()]).toEqual([]);
  });
});
