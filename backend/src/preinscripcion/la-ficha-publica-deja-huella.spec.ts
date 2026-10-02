/** Crear ficha por la puerta pública deja huella en la bitácora. */

/**
 * B-14.
 *
 * De los dos sitios del backend que crean un participante, solo
 * `crm.crear()` dejaba rastro. El agujero estaba justo en la puerta que
 * MÁS fichas crea ---la gente que se inscribe sola--- así que «¿de
 * dónde salió esta ficha?» no siempre tenía respuesta.
 *
 * Quedaba el `MovimientoParticipante`, que dice la etapa pero no quién
 * ni desde dónde: sirve para seguir el embudo, no para responder de una
 * ficha.
 *
 * LO QUE MÁS IMPORTA DE ESTE ARREGLO NO ES QUE ANOTE, SINO CUÁNDO. Si
 * anotara siempre, cada reenvío del formulario de alguien que ya está
 * inscrito dejaría un «nació» que no ocurrió, y una bitácora con
 * nacimientos falsos es peor que una sin ellos: deja de poder usarse
 * para contar.
 */

const fuente = () =>
  require('fs').readFileSync(
    require('path').join(__dirname, 'preinscripcion.service.ts'),
    'utf8',
  ) as string;

describe('la ficha que nace en el formulario público', () => {
  it('deja su anotación', () => {
    const t = fuente();
    expect(t).toContain("accion: 'PARTICIPANTE_CREADO'");
  });

  /**
   * Y SOLO SI DE VERDAD NACIÓ.
   *
   * `esNueva` se calcula ANTES del `create`, porque después `yaEsta` ya
   * no distingue: la variable se queda con la ficha, venga de donde
   * venga. Comprobar el orden es comprobar que la condición significa
   * algo.
   */
  it('solo cuando de verdad se creó una', () => {
    const t = fuente();
    expect(t).toContain('const esNueva = !yaEsta;');
    expect(t).toContain('if (esNueva) {');

    const decide = t.indexOf('const esNueva = !yaEsta;');
    const crea = t.indexOf('this.prisma.participante.create({');
    const anota = t.indexOf("accion: 'PARTICIPANTE_CREADO'");

    expect(decide).toBeGreaterThan(-1);
    /// Se decide antes de crear, y se anota después.
    expect(decide).toBeLessThan(crea);
    expect(crea).toBeLessThan(anota);
  });

  /**
   * EL ACTOR ES LA PERSONA, NO «SISTEMA».
   *
   * No hay administrador detrás, pero poner «Sistema» escondería lo
   * único que esta fila tiene que decir: que entró sola por el
   * formulario. Es el mismo nombre que ya usan las otras anotaciones
   * de este servicio.
   */
  it('y dice que fue la persona, no el sistema', () => {
    const t = fuente();
    const i = t.indexOf("accion: 'PARTICIPANTE_CREADO'");
    /// La anotación completa: desde el `registrar` anterior hasta su
    /// cierre.
    const bloque = t.slice(t.lastIndexOf('this.auditoria.registrar({', i), i);
    expect(bloque).toContain('La persona, desde el formulario público');
    expect(bloque).not.toContain("nombre: 'Sistema'");
  });

  /**
   * Y QUE DIGA EN QUÉ SE INSCRIBIÓ.
   *
   * Una fila que dice «se inscribió» sin decir en qué no responde
   * nada, que es justo el problema que esta brecha describía.
   */
  it('y en qué acción de formación', () => {
    const t = fuente();
    expect(t).toContain('Se inscribió por su cuenta en ${oferta.accionFormacion.codigo}');
    /// El código tiene que venir en el `select`, o la plantilla
    /// imprimiría «undefined» sin que nada falle.
    expect(t).toContain('accionFormacion: { select: { evento: true, codigo: true } }');
  });
});

describe('la otra puerta sigue dejando la suya', () => {
  it('crm.crear() no se tocó', () => {
    const crm = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'crm', 'crm.service.ts'),
      'utf8',
    ) as string;
    expect(crm).toContain("accion: 'PARTICIPANTE_CREADO'");
  });
});
