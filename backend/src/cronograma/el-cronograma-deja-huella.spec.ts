/** El cronograma deja huella: antes no podía, ni queriendo. */

/**
 * `E-01`, Y EL MATIZ QUE LO EXPLICA TODO.
 *
 * El módulo del cronograma ---fechas de inicio y fin, sesiones,
 * horarios, asesor académico y cupos de cada cobertura--- escribía sin
 * dejar una sola fila de auditoría. Y no era un olvido: `Entrada.entidad`
 * va tipada contra el catálogo de `auditoria.service.ts`, que está
 * declarado `as const`, y allí NO EXISTÍAN `GRUPO` ni `COBERTURA`. Es
 * decir: **auditar esto no compilaba**. Había que ampliar el catálogo
 * primero, y por eso la lista de pendientes lo traía como bloqueado.
 *
 * Por qué importa tanto en este módulo concreto: la fecha de inicio de
 * un grupo decide su cierre de inscripciones, los días que le quedan al
 * asesor y su meta diaria; los cupos de una cobertura deciden lo que el
 * sitio público anuncia como disponible. Se cambia un número y se nota
 * en tres pantallas al minuto, y hasta hoy no había forma de saber
 * quién lo tocó.
 *
 * Esta prueba fija las dos mitades: que el catálogo las admita, y que
 * los tres caminos que escriben las usen.
 */

import * as fs from 'fs';
import * as path from 'path';

import { ACCIONES, ENTIDADES } from '../comun/auditoria.service';

const leer = (...trozos: string[]) =>
  fs.readFileSync(path.join(__dirname, ...trozos), 'utf8');

describe('el catálogo admite lo que el cronograma toca', () => {
  it('existen las entidades GRUPO y COBERTURA', () => {
    expect(ENTIDADES.GRUPO).toBe('grupo');
    expect(ENTIDADES.COBERTURA).toBe('cobertura');
  });

  it('y las tres acciones que hacían falta', () => {
    expect(ACCIONES).toContain('GRUPO_EDITADO');
    expect(ACCIONES).toContain('CUPOS_EDITADOS');
    expect(ACCIONES).toContain('CRONOGRAMA_IMPORTADO');
  });
});

describe('los tres caminos que escriben dejan huella', () => {
  const servicio = () => leer('cronograma.service.ts');

  it('editar un grupo', () => {
    const t = servicio();
    expect(t).toContain("accion: 'GRUPO_EDITADO'");
    expect(t).toContain('entidad: ENTIDADES.GRUPO');
  });

  it('editar los cupos de una cobertura', () => {
    const t = servicio();
    expect(t).toContain("accion: 'CUPOS_EDITADOS'");
    expect(t).toContain('entidad: ENTIDADES.COBERTURA');
  });

  /**
   * Y EL VOLCADO DEL CRONOGRAMA, que es el que más falta hace poder
   * explicar: mueve de golpe las fechas de 26 grupos. Escribe su fila
   * con `tx` directo porque un guion no levanta el contenedor de Nest.
   */
  it('volcar el cronograma sobre los grupos', () => {
    const t = fs.readFileSync(
      path.join(__dirname, '..', '..', 'prisma', 'cronograma-a-los-grupos.ts'),
      'utf8',
    );
    expect(t).toContain("accion: 'CRONOGRAMA_IMPORTADO'");
    expect(t).toContain('tx.registroAuditoria.create');
  });
});

/**
 * Y LAS DOS REGLAS QUE NO SE PUEDEN PERDER AL TOCAR ESTO.
 */
describe('cómo se escribe la huella', () => {
  /**
   * LA DEL VOLCADO VA DENTRO DE LA TRANSACCIÓN, porque escribe con el
   * mismo `tx` que mueve las fechas: si el volcado se cae a la mitad,
   * no quedan filas de cambios que no ocurrieron.
   */
  it('la del volcado comparte transacción con el cambio', () => {
    const t = fs.readFileSync(
      path.join(__dirname, '..', '..', 'prisma', 'cronograma-a-los-grupos.ts'),
      'utf8',
    );
    const i = t.indexOf('await prisma.$transaction');
    const j = t.indexOf('escritos++', i);
    expect(i).toBeGreaterThan(-1);
    expect(t.slice(i, j)).toContain('tx.registroAuditoria.create');
  });

  /**
   * LA DE LOS CUPOS VA FUERA, y por el motivo contrario: `registrar`
   * abre su propia conexión y no admite la transacción de la llamada,
   * así que meterla dentro dejaría la fila escrita aunque el CHECK
   * `ofertas_cupos_dentro_del_tope` abortara ---y aborta cuando se
   * intenta dejar el tope por debajo de lo ya apartado---.
   *
   * Una bitácora que apunta cambios que no ocurrieron es peor que no
   * tenerla: manda a buscar la causa de algo que nunca pasó.
   */
  it('la de los cupos espera a que la transacción confirme', () => {
    const t = leer('cronograma.service.ts');
    const i = t.indexOf('async actualizarCupos');
    const trozo = t.slice(i);
    const finDeLaTransaccion = trozo.indexOf(
      'const resultado = await this.prisma.$transaction',
    );
    const registro = trozo.indexOf("accion: 'CUPOS_EDITADOS'");
    expect(finDeLaTransaccion).toBeGreaterThan(-1);
    expect(registro).toBeGreaterThan(finDeLaTransaccion);
    /// Y se devuelve lo que la transacción devolvió, no lo de antes.
    expect(trozo).toContain('return resultado;');
  });

  /**
   * Y LA BITÁCORA NUNCA TUMBA LA EDICIÓN. El `select` de arriba pide
   * la acción, pero si alguien lo recorta mañana, leerle `convenioId`
   * a `undefined` reventaría el guardado de un grupo por culpa de una
   * fila de auditoría. Se apunta sin convenio antes que no apuntar.
   */
  it('si faltara la acción, se apunta igual', () => {
    expect(leer('cronograma.service.ts')).toContain(
      'grupo.accionFormacion?.convenioId ?? null',
    );
  });
});
