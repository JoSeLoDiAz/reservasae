/** De qué enlace entró cada persona se guarda siempre. */

/**
 * «SI O SI EL SISTEMA DEBE DECIRME DE QUE LINK DE FORMULARIO ENTRO
 * PORQUE ES IMPOSIBLE QUE NO SE PUEDA, OSEA ES UNA FALACIA» (cliente,
 * 5 oct 2026).
 *
 * No era una falacia. Era un dato que LLEGABA Y SE TIRABA: el POST
 * público recibe la palabra del formulario personalizado, la marca del
 * enlace corto y la baliza de la visita ---los tres están en el DTO
 * desde hace meses--- y ninguno se guardaba en la ficha.
 *
 * LO QUE HABÍA, Y POR QUÉ NO BASTABA. Existía `campanaDeEntrada`, pero
 * se escribe en un bloque posterior con tres condiciones: que la ficha
 * sea NUEVA, que no hubiera ningún lead esperando, y que se reconozca
 * el canal. Las tres son deliberadas ---evitan que el último clic borre
 * de dónde vino de verdad--- pero dejan sin respuesta justo lo que se
 * pregunta:
 *
 *   - una campaña de RECAPTACIÓN no se mide: la persona ya tenía ficha,
 *     vuelve por su enlace, y no queda nada;
 *   - quien entra por un enlace cuyo canal no se reconoce tampoco deja
 *     rastro.
 *
 * Por eso estos tres van en el `create`, sin condición ninguna.
 *
 * Y HACIA ATRÁS NO SE PUEDE RECONSTRUIR: `pasos_de_visita` se borra a
 * los 90 días y su id nunca se guardó en la ficha. De aquí en adelante,
 * en todas.
 */

import * as fs from 'fs';
import * as path from 'path';

const servicio = () =>
  fs.readFileSync(
    path.join(__dirname, 'preinscripcion.service.ts'),
    'utf8',
  ) as string;

/// El `create` de la ficha pública, que es el único sitio donde vale.
const elCreate = () => {
  const t = servicio();
  const i = t.indexOf('participante = await this.prisma.participante.create(');
  expect(i).toBeGreaterThan(-1);
  return t.slice(i, t.indexOf('select: { id: true }', i));
};

describe('los tres se guardan al crear la ficha', () => {
  it('la palabra del formulario personalizado', () => {
    expect(elCreate()).toContain('formularioDeEntrada: dto.formulario');
  });

  it('la marca del enlace corto', () => {
    expect(elCreate()).toContain('enlaceDeEntrada: dto.enlace');
  });

  it('y la baliza de la visita, para poder cruzar con el tráfico', () => {
    expect(elCreate()).toContain('visitaDeEntrada: dto.visita');
  });

  /**
   * SIN CONDICIONES, que es la mitad del arreglo. Si alguien los
   * moviera al bloque de atribución de más abajo, volverían a perderse
   * en los dos casos que importan: la recaptación y el enlace sin
   * canal reconocido.
   */
  it('dentro del create, no en el bloque condicional de atribución', () => {
    const t = servicio();
    const create = t.indexOf(
      'participante = await this.prisma.participante.create(',
    );
    const atribucion = t.indexOf('const campana =');
    expect(create).toBeGreaterThan(-1);
    expect(atribucion).toBeGreaterThan(-1);
    /// Los tres campos aparecen ANTES de donde empieza la atribución
    /// condicional: están en el alta, no colgando de un `if`.
    for (const campo of [
      'formularioDeEntrada:',
      'enlaceDeEntrada:',
      'visitaDeEntrada:',
    ]) {
      const donde = t.indexOf(campo);
      expect(donde).toBeGreaterThan(create);
      expect(donde).toBeLessThan(atribucion);
    }
  });

  /**
   * Y VACÍO ES NULO, no cadena vacía. Un `''` guardado se cuenta como
   * un enlace más al agrupar, y saldría un renglón sin nombre con la
   * mitad de la base dentro.
   */
  it('lo que llega vacío se guarda como nulo', () => {
    const c = elCreate();
    expect(c).toContain('dto.formulario?.trim() || null');
    expect(c).toContain('dto.enlace?.trim() || null');
    expect(c).toContain('dto.visita?.trim() || null');
  });
});

describe('el dato ya llegaba: solo faltaba guardarlo', () => {
  /// Los tres estaban en el DTO desde antes. Esto lo fija para que no
  /// se quiten pensando que no se usan.
  it('el formulario público los sigue recibiendo', () => {
    const dto = fs.readFileSync(path.join(__dirname, 'dto.ts'), 'utf8');
    expect(dto).toContain('formulario?: string');
    expect(dto).toContain('enlace?: string');
    expect(dto).toContain('visita?: string');
  });
});

/**
 * Y LA FICHA LOS DEVUELVE, que es la otra mitad: guardarlos sin
 * enseñarlos sería cambiar un hueco por otro.
 */
describe('se pueden consultar', () => {
  it('la migración deja por dónde preguntarlos sin leer la tabla entera', () => {
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        'prisma',
        'migrations',
        '20261005140000_por_que_enlace_entro',
        'migration.sql',
      ),
      'utf8',
    );
    /// Por convenio, porque «cuántos trajo este enlace» siempre se
    /// pregunta dentro de un gremio.
    expect(sql).toContain('"convenioId", "formularioDeEntrada"');
    expect(sql).toContain('"convenioId", "enlaceDeEntrada"');
  });

  it('y no inventa de dónde vino lo que ya existía', () => {
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        'prisma',
        'migrations',
        '20261005140000_por_que_enlace_entro',
        'migration.sql',
      ),
      'utf8',
    );
    /// Nulos, sin UPDATE de relleno: suponerlo diría de dónde vino
    /// alguien sin que conste.
    expect(sql).not.toMatch(/UPDATE\s+"participantes"/i);
  });
});
