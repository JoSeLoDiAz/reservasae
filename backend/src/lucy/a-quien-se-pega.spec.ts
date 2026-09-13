import { aQuienSePega, type Candidato } from './a-quien-se-pega';

const dia = (d: number) => new Date(2026, 8, d);

const ficha = (id: string, personaId: string, d = 1): Candidato => ({
  tipo: 'FICHA',
  id,
  personaId,
  creadoEn: dia(d),
});
const lead = (id: string, d = 1): Candidato => ({ tipo: 'LEAD', id, creadoEn: dia(d) });

describe('a quien se le pega la conversacion', () => {
  it('sin nadie detras, queda sin dueno', () => {
    expect(aQuienSePega([]).estado).toBe('SIN_DUENO');
  });

  it('una sola ficha, va ahi', () => {
    const r = aQuienSePega([ficha('f1', 'p1')]);
    expect(r.estado).toBe('PEGADA');
    if (r.estado === 'PEGADA') expect(r.destino.id).toBe('f1');
  });

  it('un solo lead suelto, va ahi', () => {
    const r = aQuienSePega([lead('l1')]);
    expect(r.estado).toBe('PEGADA');
    if (r.estado === 'PEGADA') expect(r.destino.id).toBe('l1');
  });

  /// EL CASO NORMAL DEL SISTEMA: la misma cedula en dos cursos
  /// es UNA persona con dos participaciones. Contando filas en
  /// vez de personas, esto caia en cuarentena.
  it('una persona con dos fichas no es ambigua: va en la mas reciente', () => {
    const r = aQuienSePega([ficha('vieja', 'p1', 1), ficha('nueva', 'p1', 20)]);
    expect(r.estado).toBe('PEGADA');
    if (r.estado === 'PEGADA') expect(r.destino.id).toBe('nueva');
  });

  /// AQUI SI: el resumen de un chat en el expediente de un
  /// extrano, y las notas no se borran.
  it('dos personas distintas con el mismo numero: no se elige', () => {
    const r = aQuienSePega([ficha('f1', 'p1'), ficha('f2', 'p2')]);
    expect(r.estado).toBe('AMBIGUA');
    expect(r.motivo).toMatch(/2 personas/);
  });

  it('una ficha y un lead sin convertir tampoco se eligen', () => {
    const r = aQuienSePega([ficha('f1', 'p1'), lead('l1')]);
    expect(r.estado).toBe('AMBIGUA');
    expect(r.motivo).toMatch(/lead/);
  });

  it('dos leads sueltos tampoco', () => {
    const r = aQuienSePega([lead('l1'), lead('l2')]);
    expect(r.estado).toBe('AMBIGUA');
    expect(r.motivo).toMatch(/2 leads/);
  });

  /// El motivo se enseña y tiene que decir POR QUE, no solo que
  /// no se pudo: es lo que alguien va a leer para resolverlo.
  it('siempre dice por que', () => {
    for (const cs of [[], [ficha('f1', 'p1'), ficha('f2', 'p2')], [lead('a'), lead('b')]]) {
      expect(aQuienSePega(cs as Candidato[]).motivo.length).toBeGreaterThan(10);
    }
  });
});
