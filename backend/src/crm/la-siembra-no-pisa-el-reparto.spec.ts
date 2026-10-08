/** Un reparto hecho a mano no se deshace en el siguiente despliegue. */

/**
 * LA SIEMBRA SE CORRE EN CADA DESPLIEGUE, Y ESCRIBÍA LOS CUPOS.
 *
 * `CLAUDE.md` declara la siembra «idempotente y se puede correr en cada
 * despliegue», y su `upsert` llevaba `cuposBase` y `cuposMaximos` en el
 * `update`. Juntas, las dos cosas significan que repartir la meta a
 * mano desde Cronograma --bajar Valle, subir Huila-- lo deshace el
 * siguiente despliegue SIN UN ERROR.
 *
 * Ya pasó una vez y está escrito: «sin eso, `prisma db seed` devolvía
 * el foro a 650 en silencio».
 *
 * Se lee el fichero porque lo que hay que fijar es que esas dos claves
 * NO estén en el camino de escritura por defecto, y eso no se observa
 * ejecutando: habría que sembrar contra una base de verdad.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SIEMBRA = readFileSync(
  join(__dirname, '..', '..', 'prisma', 'seed', 'index.ts'),
  'utf8',
);

/// Sin comentarios: este repositorio cita sus propias claves en los
/// docblocks mas veces de las que las escribe.
const codigo = SIEMBRA.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('la siembra no pisa un reparto hecho a mano', () => {
  it('la bandera existe y es explícita', () => {
    expect(codigo).toMatch(
      /const REIMPORTAR_CUPOS = process\.argv\.includes\('--cupos'\)/,
    );
  });

  /// Sin esto, un patron que no case deja los asertos de abajo
  /// mirando una lista vacia y pasando en verde. Paso hoy mismo con
  /// otro spec y solo lo vio una mutacion.
  it('el spec ve los upsert que dice mirar', () => {
    expect((codigo.match(/upsert\(\{/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((codigo.match(/update:/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  /// EL CANDADO: ningun `update:` escribe cupos directamente. Si
  /// alguien devuelve `update: { cuposBase: ... }`, esto cae.
  it('ningún `update` escribe cupos sin pedirlo', () => {
    /// `[\s\S]` y no `.` porque los ficheros son CRLF y el salto
    /// cuenta: con `.` el patron no cruza la linea y no ve nada.
    expect(codigo).not.toMatch(/update: \{[\s\S]{0,120}?cupos(Base|Maximos):/);
    /// Y donde SI se escriben, va detras de la bandera.
    expect((codigo.match(/update: REIMPORTAR_CUPOS/g) ?? []).length).toBe(2);
  });

  /// LO QUE SI SE SIGUE CORRIGIENDO SIEMPRE, y es lo que impide el
  /// arreglo excesivo: la modalidad es catalogo, no un reparto, y
  /// dejarla fuera haria que una correccion del Excel no llegara nunca.
  it('la modalidad de la oferta se sigue corrigiendo siempre', () => {
    expect(codigo).toMatch(
      /: \{ modalidad: ofertaJson\.modalidad as Modalidad \}/,
    );
  });

  /// Y crear lo que falta NO depende de la bandera: una accion nueva
  /// del catalogo tiene que entrar en el siguiente despliegue.
  it('crear lo que falta sigue sin condición', () => {
    expect(codigo).toMatch(
      /create: \{[\s\S]{0,220}?cuposBase: cobertura\.cuposBase/,
    );
  });
});
