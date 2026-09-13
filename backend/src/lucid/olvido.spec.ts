import { DIAS_QUE_SE_GUARDAN, limiteDelOlvido } from './olvido';

describe('el olvido de las conversaciones sin dueño', () => {
  it('son sesenta días, como lo pidió el cliente', () => {
    expect(DIAS_QUE_SE_GUARDAN).toBe(60);
  });

  it('el límite cae sesenta días atrás', () => {
    const hoy = new Date('2026-09-13T12:00:00.000Z');
    expect(limiteDelOlvido(hoy).toISOString()).toBe('2026-07-15T12:00:00.000Z');
  });

  /// La de ayer no se toca; la de hace sesenta y un días sí.
  it('la frontera separa lo que se queda de lo que se va', () => {
    const hoy = new Date('2026-09-13T12:00:00.000Z');
    const limite = limiteDelOlvido(hoy);
    const dias = (n: number) => new Date(hoy.getTime() - n * 86_400_000);

    expect(dias(1) > limite).toBe(true);
    expect(dias(59) > limite).toBe(true);
    expect(dias(61) < limite).toBe(true);
  });
});
