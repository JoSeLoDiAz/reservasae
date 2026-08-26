import { repartirCupos } from './cupos';

/// El ejemplo de Mauricio: «son 100 cupos para Bogota y una
/// empresa aparto 40, entonces al momento de realizar
/// inscripciones debe ir notificando en el panel cuantos
/// faltan, descontando esos 40, pero mostrando cuantos de
/// esos 40 ya se han completado».

describe('los 100 de Bogota con 40 apartados', () => {
  const r = repartirCupos({
    total: 100,
    apartados: 40,
    inscritosDeReserva: 12,
    inscritosLibres: 31,
  });

  it('descuenta los apartados del monton comun', () => {
    expect(r.apartados.cupos).toBe(40);
    expect(r.libres.cupos).toBe(60);
  });

  it('muestra cuantos de los apartados ya se completaron', () => {
    expect(r.apartados.inscritos).toBe(12);
    expect(r.apartados.faltan).toBe(28);
  });

  it('y como va el monton comun', () => {
    expect(r.libres.inscritos).toBe(31);
    expect(r.libres.faltan).toBe(29);
  });

  it('el panorama del 100', () => {
    expect(r.todo.inscritos).toBe(43);
    expect(r.todo.faltan).toBe(57);
    expect(r.lleno).toBe(false);
  });

  it('avisa de los turnos preferentes sin usar', () => {
    expect(r.turnosSinUsar).toBe(28);
  });
});

describe('cuando se llena', () => {
  it('cien inscritos de cien: no cabe nadie mas', () => {
    const r = repartirCupos({ total: 100, apartados: 40, inscritosDeReserva: 40, inscritosLibres: 60 });
    expect(r.lleno).toBe(true);
    expect(r.todo.faltan).toBe(0);
    expect(r.turnosSinUsar).toBe(0);
  });

  it('pasarse tambien es estar lleno', () => {
    const r = repartirCupos({ total: 10, apartados: 0, inscritosDeReserva: 0, inscritosLibres: 12 });
    expect(r.lleno).toBe(true);
    expect(r.todo.faltan).toBe(0);
  });
});

describe('una empresa que inscribe de mas', () => {
  /// Aparto 40 y metio 45. Los cinco de mas no son suyos:
  /// el turno preferente era por cuarenta.
  const r = repartirCupos({
    total: 100,
    apartados: 40,
    inscritosDeReserva: 45,
    inscritosLibres: 10,
  });

  it('su bloque no cuenta mas inscritos que cupos aparto', () => {
    expect(r.apartados.inscritos).toBe(40);
    expect(r.apartados.faltan).toBe(0);
  });

  it('los cinco de mas caen al monton comun', () => {
    expect(r.libres.inscritos).toBe(15);
  });

  it('el total sigue cuadrando', () => {
    expect(r.todo.inscritos).toBe(55);
  });
});

describe('bordes', () => {
  it('sin nada apartado, todo es comun', () => {
    const r = repartirCupos({ total: 50, apartados: 0, inscritosDeReserva: 0, inscritosLibres: 20 });
    expect(r.apartados.cupos).toBe(0);
    expect(r.apartados.avance).toBe(0);
    expect(r.libres.cupos).toBe(50);
  });

  it('no se puede apartar mas de lo que hay', () => {
    const r = repartirCupos({ total: 30, apartados: 80, inscritosDeReserva: 0, inscritosLibres: 0 });
    expect(r.apartados.cupos).toBe(30);
    expect(r.libres.cupos).toBe(0);
  });

  it('una oferta sin cupos no divide por cero', () => {
    const r = repartirCupos({ total: 0, apartados: 0, inscritosDeReserva: 0, inscritosLibres: 0 });
    expect(r.todo.avance).toBe(0);
    expect(r.lleno).toBe(true);
  });
});
