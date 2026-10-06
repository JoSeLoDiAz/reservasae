/** El lead que el cruce ata a una ficha queda marcado como procesado. */

/**
 * A-15.
 *
 * Cuando un lead entra y el cruce encuentra FIRMEMENTE a esa persona en
 * el CRM ---por documento---, el lead se ata a su ficha y queda en
 * CONVERTIDO. Pero no se le ponía `procesadoEn`.
 *
 * Es el camino MÁS recorrido de los cuatro que dejan un lead en
 * CONVERTIDO: es por donde pasa todo el que ya estaba. Los otros tres
 * ---la conversión manual, el lote y los que esperaban--- sí lo ponían.
 *
 * Sin esa fecha, cualquier cosa que pregunte «¿qué queda por procesar?»
 * ve esos leads como pendientes PARA SIEMPRE, aunque su estado diga que
 * ya se procesaron: dos campos que se contradicen.
 */

describe('quién marca procesadoEn al dejar un lead en CONVERTIDO', () => {
  const leer = (ruta: string) =>
    require('fs').readFileSync(
      require('path').join(__dirname, ruta),
      'utf8',
    ) as string;

  /**
   * LA RAMA QUE FALTABA. Se busca dentro del `update` del cruce y no en
   * todo el fichero: `procesadoEn` podría aparecer en otro sitio y dar
   * verde sin que esta rama lo tenga.
   */
  it('la rama firme del cruce, que es la que faltaba', () => {
    const t = leer('leads.service.ts');
    const i = t.indexOf('data: coincide.firme');
    expect(i).toBeGreaterThan(-1);

    /// Hasta donde se cierra el ternario: la rama de abajo es la
    /// PENDIENTE y ahí no debe ir.
    const rama = t.slice(i, t.indexOf(': {', t.indexOf('  : {', i)));
    expect(rama).toContain("estado: 'CONVERTIDO'");
    expect(rama).toContain('procesadoEn: new Date()');
  });

  it('y las otras tres, que ya lo hacían', () => {
    expect(leer('conversion.service.ts')).toContain('procesadoEn: new Date()');
    expect(leer('leads-que-esperaban.ts')).toContain('procesadoEn: new Date()');
    expect(leer('lote.service.ts')).toContain('procesadoEn: new Date()');
  });

  /**
   * Y DONDE NO DEBE IR.
   *
   * La otra rama del mismo ternario deja el lead en PENDIENTE a
   * propósito, esperando a que un asesor confirme una coincidencia
   * floja. Marcarlo como procesado ahí lo sacaría de la cola de alguien
   * que todavía tiene que mirarlo.
   */
  it('la rama floja NO lo marca: todavía no se ha procesado nada', () => {
    const t = leer('leads.service.ts');
    const i = t.indexOf('data: coincide.firme');
    /// Desde donde empieza la rama de abajo hasta que cierra el update.
    const floja = t.slice(
      t.indexOf("estado: 'PENDIENTE'", i),
      t.indexOf('});', i),
    );
    expect(floja).toContain("estado: 'PENDIENTE'");
    expect(floja).not.toContain('procesadoEn');
  });
});
