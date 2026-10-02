/** A quien ya cursó no se le cambia la acción de formación. */

/**
 * B-03.
 *
 * `PATCH crm/:id/formacion` movía a cualquiera de acción de formación,
 * incluida una persona YA CERTIFICADA. Entonces su certificado deja de
 * corresponder con lo que cursó.
 *
 * No es un defecto de pantalla: es lo que se le reporta al SENA, y
 * certificar es lo que el SENA paga.
 *
 * LA LISTA ES LA DECISIÓN, y por eso se prueba entera: qué etapas
 * cierran la historia y cuáles no. Equivocarse por exceso cierra una
 * puerta que se usa todos los días; por defecto, deja el agujero.
 */

import { HISTORIA_CERRADA, NO_RECIBEN_GRUPO } from './etapas';

describe('qué etapas cierran la historia', () => {
  it('CERTIFICADO, que es el que duele', () => {
    /// Es lo que paga el SENA y lo que faltaba: ninguna lista anterior
    /// lo tenía, porque todas se preguntaban por sillas y asientos, no
    /// por lo ya reportado.
    expect(HISTORIA_CERRADA).toContain('CERTIFICADO');
  });

  it('y las cuatro salidas, porque dicen de QUÉ curso salió', () => {
    expect(HISTORIA_CERRADA).toEqual(
      expect.arrayContaining(['RETIRADO', 'NO_APROBO', 'DESERTO', 'ABANDONO']),
    );
  });

  /**
   * PERDIDO NO, Y ES LA DIFERENCIA QUE IMPORTA.
   *
   * A un perdido no se le reportó nada: nunca entró a un curso. Volver
   * a captarlo para otra acción es trabajo normal de la mesa, no una
   * corrección de historia. Si estuviera en la lista, esta brecha se
   * habría «arreglado» rompiendo la recaptación.
   */
  it('PERDIDO no, aunque sí esté en NO_RECIBEN_GRUPO', () => {
    expect(HISTORIA_CERRADA).not.toContain('PERDIDO');
    expect(NO_RECIBEN_GRUPO).toContain('PERDIDO');
  });

  it('ni ninguna de las etapas en las que todavía se trabaja', () => {
    for (const viva of [
      'INTERESADO',
      'CONTACTADO',
      'DATOS_COMPLETOS',
      'INSCRITO',
      'EN_FORMACION',
    ]) {
      expect(HISTORIA_CERRADA).not.toContain(viva);
    }
  });

  /**
   * EN_FORMACION SÍ SE PUEDE MOVER, y conviene dejarlo escrito porque
   * es el caso límite: está en el aula, pero su paso por el curso aún
   * no está contado. Mientras no haya certificado ni salida, corregir
   * una asignación equivocada es lo que hay que poder hacer.
   */
  it('a quien está en formación todavía se le puede corregir', () => {
    expect(HISTORIA_CERRADA).not.toContain('EN_FORMACION');
  });
});

describe('la comprobación está puesta donde se asigna', () => {
  const fuente = () =>
    require('fs').readFileSync(
      require('path').join(__dirname, 'crm.service.ts'),
      'utf8',
    ) as string;

  const cuerpoDeAsignar = () => {
    const t = fuente();
    const i = t.indexOf('async asignar(');
    expect(i).toBeGreaterThan(-1);
    return t.slice(i, t.indexOf('\n  async ', i + 20));
  };

  it('asignar() la aplica', () => {
    expect(cuerpoDeAsignar()).toContain('HISTORIA_CERRADA.includes(p.etapa)');
  });

  /**
   * SOLO CUANDO CAMBIA DE VERDAD, que es la mitad del arreglo.
   *
   * La primera versión no distinguía CAMBIAR de PONER POR PRIMERA VEZ,
   * y lo vio José el 2 oct 2026: un certificado SIN acción no podía
   * recibir la suya ---y sin ella no entra al reporte del SENA---. O
   * sea que el arreglo causaba el mismo daño que venía a evitar.
   */
  it('solo cuando la acción cambia de verdad', () => {
    const cuerpo = cuerpoDeAsignar();
    expect(cuerpo).toContain('const cambiaDeAccion =');
    expect(cuerpo).toContain('p.accionFormacionId !== null &&');
    expect(cuerpo).toContain(
      'p.accionFormacionId !== oferta.accionFormacionId',
    );
    expect(cuerpo).toContain('cambiaDeAccion && HISTORIA_CERRADA');
  });

  /**
   * DESPUÉS DE CARGAR LA OFERTA ---hace falta su acción para saber si
   * hay cambio--- Y ANTES DE LO CERRADA Y DEL CUPO.
   *
   * Esto estaba al revés: la comprobación iba antes de la oferta, y
   * así no podía saber si cambiaba. El orden de hoy conserva lo que
   * se quería de aquel ---que el mensaje hable de la PERSONA y no de
   * una plaza--- sin pagar el precio de bloquear la primera
   * asignación.
   */
  it('después de la oferta, y antes de lo cerrada', () => {
    const cuerpo = cuerpoDeAsignar();
    const cargaOferta = cuerpo.indexOf("if (!oferta) throw");
    const etapa = cuerpo.indexOf('cambiaDeAccion && HISTORIA_CERRADA');
    const cerrada = cuerpo.indexOf('if (!oferta.abierta)');

    expect(cargaOferta).toBeGreaterThan(-1);
    expect(etapa).toBeGreaterThan(-1);
    expect(cerrada).toBeGreaterThan(-1);

    expect(cargaOferta).toBeLessThan(etapa);
    expect(etapa).toBeLessThan(cerrada);
  });
});
