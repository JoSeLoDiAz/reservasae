/** El desglose de un asesor sale DENTRO de su fila, y con la fila viva. */

/**
 * CUATRO COSAS QUE NINGUN TEST PODIA CAZAR, Y LAS CUATRO YA PASARON.
 *
 * Este desglose ha vivido en tres sitios en quince dias --cajon,
 * subtabla debajo, y ahora dentro de la fila-- porque el cliente lo
 * movio tres veces. Cada mudanza es una linea, asi que la siguiente
 * tambien lo sera, y lo que se pierde al moverlo no falla nunca:
 * compila, se pinta, y dice un numero distinto del de al lado.
 *
 * Es un spec de SUPERFICIE, como `escribir-pide-escribir` o
 * `la-escalera-no-se-separa`: lee los ficheros del panel. El panel no
 * tiene jest y esta casa ya tiene cuatro specs escritos asi.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PANEL = join(__dirname, '..', '..', '..', 'frontend', 'src', 'components', 'admin');
const leer = (n: string) => readFileSync(join(PANEL, n), 'utf8');

describe('el desglose sale dentro de la fila', () => {
  describe('la tabla calcula su propio colSpan', () => {
    const tabla = leer('tabla.tsx');

    it('acepta una fila desplegada', () => {
      expect(tabla).toMatch(/desplegado\?: \(f: T\) => ReactNode/);
    });

    /**
     * EL DEFECTO DE AGOSTO, QUE ESTA ESCRITO EN CLAUDE.md: la fila
     * desplegable llevaba un `colSpan` FIJO y «con columnas que se
     * quitan y se ponen ese numero se descuadra solo», asi que el
     * detalle de una reserva acabo en un cajon lateral. Esta tabla
     * deja elegir columnas, asi que un literal volveria a descuadrarse
     * --y no romperia nada: pintaria una celda corta o pasada de
     * ancho, que es de las cosas que nadie reporta--.
     */
    it('el colSpan sale de las columnas en pantalla, no de un numero', () => {
      const celda = /<td\s*$\s*colSpan=\{([^}]*)\}/m.exec(tabla);
      expect(celda).not.toBeNull();
      const cuenta = celda![1];
      expect(cuenta).toContain('enPantalla.length');
      /// y cuenta la de seleccion, que es una columna mas cuando esta
      expect(cuenta).toContain('seleccion');
      expect(cuenta).not.toMatch(/^\s*\d+\s*$/);
    });

    /// Dos llamadas serian dos arboles de React por fila.
    it('llama a `desplegado` una sola vez por fila', () => {
      const cuerpo = /<tbody>([\s\S]*?)<\/tbody>/.exec(tabla)?.[1] ?? '';
      expect(cuerpo).not.toBe('');
      expect(cuerpo.match(/desplegado\??\.?\(f\)/g) ?? []).toHaveLength(1);
    });
  });

  describe('el panel lo monta en la fila y no debajo', () => {
    const asesores = leer('panel-asesores.tsx');

    /**
     * LO QUE JOSSE PIDIO EL 7 OCT, Y ES LO QUE UN ARREGLO FUTURO
     * DESHARIA SIN ENTERARSE: «que no es que al darle clic en Juliet
     * Herrera abajo me salga otra tabla, sino que me despliegue dentro
     * de la misma tabla donde esta Juliet». Montado como hermano de la
     * `Tabla` se ve igual de bien en una pantalla de tres asesores y
     * queda a cinco pantallas de scroll en una de veinticinco.
     */
    it('el desglose va dentro del `desplegado` de la tabla', () => {
      const dentro =
        /desplegado=\{\(f\) =>([\s\S]*?)\n\s{10}\}/.exec(asesores)?.[1] ?? '';
      expect(dentro).toContain('<DesgloseDelAsesor');
    });

    it('y no se monta en ningun otro sitio', () => {
      expect(asesores.match(/<DesgloseDelAsesor/g) ?? []).toHaveLength(1);
    });

    /**
     * LA FILA VIVA Y NO LA GUARDADA. Esta pantalla se refresca sola
     * cada 30 s (`datos-vivos`), asi que el estado es una FOTO.
     * Guardando la fila, la de arriba diria 41 y su desglose sumaria
     * 38, UNO AL LADO DEL OTRO. Con el cajon y con la subtabla de
     * debajo no se notaba: nadie compara dos cifras separadas por
     * cinco pantallas.
     */
    it('guarda el id, no la fila', () => {
      expect(asesores).toMatch(/const \[desglosado, setDesglosado\] = useState<string \| null>/);
    });

    it('le pasa al desglose la fila que recibe, no la del estado', () => {
      const dentro =
        /desplegado=\{\(f\) =>([\s\S]*?)\n\s{10}\}/.exec(asesores)?.[1] ?? '';
      expect(dentro).toMatch(/fila=\{f\}/);
      expect(dentro).not.toMatch(/fila=\{desglosado\}/);
    });

    /// La clave de la fila y la del desglose son la misma funcion:
    /// escritas dos veces, el dia que cambie una la fila se abre y el
    /// desglose no sale --o sale el de otro asesor--.
    it('la clave de la fila y la del desglose son la misma', () => {
      expect(asesores).toMatch(/const idDeAsesor = \(f: FilaDeAsesor\) =>/);
      expect(asesores).toMatch(/clave=\{idDeAsesor\}/);
      const dentro =
        /desplegado=\{\(f\) =>([\s\S]*?)\n\s{10}\}/.exec(asesores)?.[1] ?? '';
      expect(dentro).toContain('idDeAsesor(f)');
    });
  });

  /**
   * LOS CUATRO NUMEROS QUE JOSSE LISTO: «los leads asignados, los
   * gestionados, los inscritos, los descartados» (7 oct 2026). El
   * desglose los daba en TRES columnas --inscritos y descartados
   * sumados en `resueltos`-- y los dos ya viajaban separados desde el
   * servidor. Diez inscritos y cero descartados no es el mismo asesor
   * que cero inscritos y diez descartados, y sumados se leen igual.
   */
  describe('inscritos y descartados van por separado', () => {
    const desglose = leer('desglose-del-asesor.tsx');

    it('tiene las dos cabeceras', () => {
      expect(desglose).toMatch(/>Inscritos<\/th>/);
      expect(desglose).toMatch(/>Descartados<\/th>/);
    });

    it('pinta los dos numeros y no la suma', () => {
      expect(desglose).toContain('n(a.inscritos)');
      expect(desglose).toContain('n(a.descartados)');
      /// `resueltos` solo puede quedar nombrado en la prosa
      const sinComentarios = desglose
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/\/?.*$/gm, '');
      expect(sinComentarios).not.toContain('resueltos');
    });

    /// El total se suma de las filas de ESTA tabla y no se toma de
    /// `fila.carga`: si las dos cuentas discreparan, aqui se ve.
    it('el total suma las mismas filas', () => {
      expect(desglose).toContain('s + a.inscritos, 0');
      expect(desglose).toContain('s + a.descartados, 0');
    });
  });
});
