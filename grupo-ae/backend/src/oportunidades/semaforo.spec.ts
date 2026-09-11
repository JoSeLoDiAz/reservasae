import { limitesDeAgenda } from '../gestiones/agenda';
import {
  DIAS_HASTA_FRIO,
  frialdadDe,
  semaforoDe,
  type GestionPendiente,
} from './semaforo';

/// Un martes cualquiera a las 10 de la mañana en Bogotá, que es
/// 15:00 UTC. Se fija a mano para que las pruebas no dependan de
/// cuándo se ejecuten.
const MARTES_10AM = new Date('2026-09-15T15:00:00.000Z');
const limites = limitesDeAgenda(MARTES_10AM);

const pendiente = (venceEn: string | null): GestionPendiente => ({
  venceEn: venceEn === null ? null : new Date(venceEn),
  hechaEn: null,
});

const hecha = (venceEn: string): GestionPendiente => ({
  venceEn: new Date(venceEn),
  hechaEn: new Date('2026-09-14T15:00:00.000Z'),
});

describe('el semáforo del negocio', () => {
  it('sin gestiones, gris: nadie va a hacer nada con él', () => {
    expect(semaforoDe([], limites)).toBe('NINGUNA');
  });

  /**
   * El caso que da sentido a todo el módulo.
   *
   * Un negocio con una tarea sin fecha parece atendido y no lo
   * está: nadie tiene un día en el que hacerla. Si eso pintara
   * verde, bastaría con crear tareas vacías para que el tablero
   * entero se pusiera verde — y entonces deja de mirarse.
   */
  it('una tarea SIN FECHA no es un próximo paso: sigue gris', () => {
    expect(semaforoDe([pendiente(null)], limites)).toBe('NINGUNA');
  });

  it('lo ya hecho no cuenta: sigue gris', () => {
    expect(semaforoDe([hecha('2026-09-14T15:00:00.000Z')], limites)).toBe(
      'NINGUNA',
    );
  });

  it('con algo agendado para el viernes, verde', () => {
    expect(semaforoDe([pendiente('2026-09-18T15:00:00.000Z')], limites)).toBe(
      'AGENDADA',
    );
  });

  it('con algo para hoy, ámbar', () => {
    expect(semaforoDe([pendiente('2026-09-15T20:00:00.000Z')], limites)).toBe(
      'HOY',
    );
  });

  it('con algo de ayer sin hacer, rojo', () => {
    expect(semaforoDe([pendiente('2026-09-14T15:00:00.000Z')], limites)).toBe(
      'VENCIDA',
    );
  });

  describe('manda la más urgente, no la más cómoda', () => {
    /// Pintar verde porque «algo tiene agendado» es exactamente la
    /// mentira que este semáforo existe para no contar.
    it('vencida + agendada = rojo', () => {
      expect(
        semaforoDe(
          [pendiente('2026-09-18T15:00:00.000Z'), pendiente('2026-09-14T15:00:00.000Z')],
          limites,
        ),
      ).toBe('VENCIDA');
    });

    it('hoy + agendada = ámbar', () => {
      expect(
        semaforoDe(
          [pendiente('2026-09-25T15:00:00.000Z'), pendiente('2026-09-15T20:00:00.000Z')],
          limites,
        ),
      ).toBe('HOY');
    });

    it('el orden en que llegan no cambia el resultado', () => {
      const a = [pendiente('2026-09-14T15:00:00.000Z'), pendiente('2026-09-18T15:00:00.000Z')];
      const b = [...a].reverse();
      expect(semaforoDe(a, limites)).toBe(semaforoDe(b, limites));
    });
  });

  /**
   * El borde de las siete de la tarde.
   *
   * `agenda.ts` lo documenta: a partir de las 19:00 de Bogotá, un
   * cálculo hecho en UTC ya devuelve el día siguiente. Sin
   * corregirlo, cada tarde el tablero entero saltaría un día y lo
   * de hoy se marcaría vencido.
   */
  it('a las 19:00 de Bogotá, lo de hoy sigue siendo de hoy', () => {
    const sieteDeLaTarde = new Date('2026-09-16T00:30:00.000Z'); // 19:30 en Bogotá del día 15
    const tarde = limitesDeAgenda(sieteDeLaTarde);
    expect(semaforoDe([pendiente('2026-09-15T22:00:00.000Z')], tarde)).toBe('HOY');
  });
});

describe('cuánto se ha enfriado', () => {
  const ahora = new Date('2026-09-15T15:00:00.000Z');
  const haceDias = (n: number) =>
    new Date(ahora.getTime() - n * 86_400_000);

  it('recién tocado, nada', () => {
    expect(frialdadDe(ahora, ahora)).toBe(0);
  });

  it('el primer día no cuenta: un negocio de ayer no está frío', () => {
    expect(frialdadDe(haceDias(1), ahora)).toBe(0);
  });

  it('crece con los días', () => {
    const tres = frialdadDe(haceDias(3), ahora);
    const ocho = frialdadDe(haceDias(8), ahora);
    expect(tres).toBeGreaterThan(0);
    expect(ocho).toBeGreaterThan(tres);
  });

  it('llega a 1 a los catorce días y NO se pasa', () => {
    expect(frialdadDe(haceDias(DIAS_HASTA_FRIO), ahora)).toBe(1);
    /// Sin el tope, un negocio de hace un año daría 26 y el panel
    /// pintaría una opacidad negativa: invisible en vez de apagado.
    expect(frialdadDe(haceDias(365), ahora)).toBe(1);
  });
});
