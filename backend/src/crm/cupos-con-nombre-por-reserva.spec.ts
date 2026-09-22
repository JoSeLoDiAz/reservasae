import { cuentaDeNombres, type ReservaConNombres } from './control';

/// Lo que esto impide: que «Cupos apartados por empresas» (Control) y
/// el informe «Reservas» digan cifras distintas de los mismos cupos.
///
/// Pasó el 21 sep 2026: con los dos gremios el bloque decía 46 con
/// nombre y 493 sin nombre (restando personas al total) y las tablas
/// del informe sumaban 496, porque dos reservas tienen más personas
/// que cupos. Y «la que más debe» salía de las diez con más inscritos,
/// así que decía Transportes El Cóndor (28) cuando era Distribuidora
/// El Faro (39), que casi no tiene a nadie inscrito.

const r = (
  empresaId: string,
  cupos: number,
  personas: number,
  razonSocial = empresaId,
): ReservaConNombres => ({
  empresaId,
  razonSocial,
  cupos,
  personas,
});

describe('los cupos con nombre se cuentan por cupo y reserva por reserva', () => {
  it('una persona de más no llena el cupo de otra organización', () => {
    // Logística Sur Express: 12 personas para 10 cupos; otra, 0 de 5.
    const c = cuentaDeNombres([r('sur', 10, 12), r('otra', 5, 0)]);
    expect(c.cuposConNombre).toBe(10);
    expect(c.cuposSinNombre).toBe(5); // la resta daría 15 − 12 = 3
    expect(c.nombresDeMas).toBe(2);
  });

  it('con nombre + sin nombre = cupos, siempre', () => {
    const filas = [
      r('a', 10, 12),
      r('b', 5, 6),
      r('c', 40, 1),
      r('d', 0, 0),
      r('a', 3, 1),
    ];
    const c = cuentaDeNombres(filas);
    expect(c.cuposConNombre + c.cuposSinNombre).toBe(
      filas.reduce((s, f) => s + f.cupos, 0),
    );
  });

  it('una reserva en lista de espera (0 cupos) no debe nombres', () => {
    const c = cuentaDeNombres([r('espera', 0, 0)]);
    expect(c.cuposSinNombre).toBe(0);
    expect(c.empresaQueMasDebe).toBeNull();
  });
});

describe('la que más debe', () => {
  it('entra aunque no tenga a nadie inscrito', () => {
    const c = cuentaDeNombres([
      r('condor', 30, 2, 'Transportes El Cóndor'),
      r('faro', 40, 1, 'Distribuidora El Faro'),
      r('ruta', 21, 0, 'Turismo Ruta Dorada'),
    ]);
    expect(c.empresaQueMasDebe).toEqual({
      razonSocial: 'Distribuidora El Faro',
      sinNombre: 39,
      cupos: 40,
    });
  });

  it('suma sus reservas de varias acciones', () => {
    const c = cuentaDeNombres([r('x', 10, 0), r('x', 10, 0), r('y', 15, 0)]);
    expect(c.empresaQueMasDebe?.razonSocial).toBe('x');
    expect(c.empresaQueMasDebe?.sinNombre).toBe(20);
  });

  it('desempata como el informe: más cupos primero, luego el nombre', () => {
    const c = cuentaDeNombres([
      r('b', 12, 2, 'Beta'),
      r('a', 10, 0, 'Alfa'),
      r('c', 12, 2, 'Ceta'),
    ]);
    expect(c.empresaQueMasDebe?.razonSocial).toBe('Beta');
  });

  it('sin deudas no hay «la que más debe»', () => {
    expect(cuentaDeNombres([r('a', 5, 5)]).empresaQueMasDebe).toBeNull();
    expect(cuentaDeNombres([]).empresaQueMasDebe).toBeNull();
  });
});
