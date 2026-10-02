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

  it('asignar() la aplica', () => {
    const t = fuente();
    const i = t.indexOf('async asignar(');
    expect(i).toBeGreaterThan(-1);

    /// Dentro de su cuerpo, no en cualquier parte del fichero: el
    /// servicio tiene miles de líneas y buscar suelto daría verde
    /// aunque la comprobación viviera en otro método.
    const cuerpo = t.slice(i, t.indexOf('\n  async ', i + 20));
    expect(cuerpo).toContain('HISTORIA_CERRADA.includes(p.etapa)');
  });

  /**
   * ANTES DE MIRAR LA OFERTA.
   *
   * Si fuera después, a una persona certificada se le contestaría
   * «esa oferta está cerrada» o «no hay cupo» ---sobre un cupo que no
   * es el problema--- y alguien abriría la oferta para nada.
   */
  it('y antes de la comprobación de la oferta', () => {
    const t = fuente();
    const i = t.indexOf('async asignar(');
    const cuerpo = t.slice(i, t.indexOf('\n  async ', i + 20));

    const etapa = cuerpo.indexOf('HISTORIA_CERRADA.includes(p.etapa)');
    const oferta = cuerpo.indexOf('if (!oferta)');
    expect(etapa).toBeGreaterThan(-1);
    expect(oferta).toBeGreaterThan(-1);
    expect(etapa).toBeLessThan(oferta);
  });
});
