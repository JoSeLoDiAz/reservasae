/** El lector del registro y la baliza dicen lo mismo. */

/**
 * Son dos copias de la misma regla y no hay forma de que sean
 * una: la baliza corre en el navegador --con `navigator
 * .userAgent` delante-- y el lector corre sobre un archivo de
 * texto, meses después. Lo que sí se puede es atarlas, que es
 * lo que hacen ya `la-escalera-no-se-separa` y
 * `el-espejo-no-se-separa`.
 *
 * Si se separan, la misma visita se clasifica de dos maneras
 * según de qué fuente venga, y el corte de procedencia diría
 * que Instagram subió el día que se importó el histórico.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { navegadorDe } from './leer-registro';

const BALIZA = join(__dirname, '../../../../frontend/src/lib/visita.ts');

describe('el lector lee como la baliza', () => {
  const texto = readFileSync(BALIZA, 'utf8');

  it('usa las MISMAS marcas de user-agent', () => {
    /// Se leen del archivo del panel, no de una lista copiada.
    const instagram = texto.match(/if \(\/(.+?)\/i\.test\(ua\)\) return "APP_INSTAGRAM"/);
    const facebook = texto.match(/if \(\/(.+?)\/i\.test\(ua\)\) return "APP_FACEBOOK"/);

    expect(instagram).not.toBeNull();
    expect(facebook).not.toBeNull();

    /// Cada marca que declara la baliza tiene que dar el mismo
    /// valor aquí.
    for (const marca of instagram![1].split('|')) {
      expect(navegadorDe(`Mozilla/5.0 ${marca} 1.0`)).toBe('APP_INSTAGRAM');
    }
    for (const marca of facebook![1].split('|')) {
      expect(navegadorDe(`Mozilla/5.0 [${marca}/470.0]`)).toBe('APP_FACEBOOK');
    }
  });

  it('las prueba en el MISMO orden', () => {
    /// Instagram primero: su navegador manda también las
    /// marcas de Facebook en algunas versiones, y al revés no
    /// pasa. Invertirlo aquí contaría como Facebook la mitad
    /// del tráfico de Instagram.
    expect(texto.indexOf('APP_INSTAGRAM')).toBeLessThan(
      texto.indexOf('APP_FACEBOOK'),
    );
    expect(navegadorDe('Instagram 446 [FBAV/470.0]')).toBe('APP_INSTAGRAM');
  });

  it('lo que no es ninguna de las dos es OTRO, no vacío', () => {
    /// La columna es NOT NULL con default 'OTRO': un vacío
    /// rompería la llave única de la tabla.
    expect(navegadorDe('')).toBe('OTRO');
    expect(texto).toContain('return "OTRO"');
  });
});
