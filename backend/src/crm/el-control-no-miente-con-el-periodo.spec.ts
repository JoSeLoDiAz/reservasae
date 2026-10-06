/** Control de inscritos: ni cifras sin periodo, ni la AF pegada. */

/**
 * DOS FALLOS DE LA MISMA PANTALLA, los dos reportados el 5 oct 2026.
 *
 * EL «25». «Ayer hago 5 inscripciones y hoy 20, pero los de hoy les
 * hago una nota y me cuentan como si fueran 25». La ventana del
 * periodo la resuelve la cabecera y llega en una respuesta APARTE: en
 * el primer render no existe, y estos dos bloques preguntaban igual
 * ---con `desde` y `hasta` vacíos--- al servidor, que SIN VENTANA NO
 * FILTRA. Salía el histórico completo bajo el rótulo «Hoy». Y se
 * quedaba así si la segunda petición se perdía, que con el limitador
 * de 60 por minuto por IP pasa.
 *
 * LA AF PEGADA. «Selecciono AF4, AF5 y no me sale abajo solo esa AF;
 * se queda congelado en AF3». Pulsar una fila guarda esa acción para
 * abrir sus grupos, y ese valor PISABA al del desplegable sin que
 * nada lo soltara.
 *
 * Esto se fija leyendo el fuente del panel porque el frontend no
 * tiene corredor de pruebas: es eso o nada. Lo que se mira son las
 * piezas que hacen el arreglo, no el texto suelto, para que quitar
 * cualquiera de ellas se note.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const frontend = (...t: string[]) =>
  readFileSync(join(__dirname, '../../../frontend/src', ...t), 'utf8');

const PANEL = () => frontend('components/admin/panel-proceso.tsx');

describe('sin la ventana del periodo no se pregunta', () => {
  /**
   * LOS DOS BLOQUES, que son los dos que el cliente ve con el «25»:
   * el resumen general de arriba y la tabla del comité.
   */
  it('los tres bloques esperan a que la cabecera conteste', () => {
    const t = PANEL();
    for (const bloque of [
      '<ResumenGeneral',
      '<TablaPorAccion',
      '<TablaPorGrupo',
    ]) {
      const i = t.indexOf(bloque);
      expect(i).toBeGreaterThan(-1);
      /// Dentro de SUS atributos, no en cualquier parte del fichero.
      expect(t.slice(i, t.indexOf('/>', i))).toContain(
        'ventanaResuelta={control != null}',
      );
    }
  });

  /**
   * Y ES «YA CONTESTÓ», NO «HAY DOS FECHAS». Esto se hizo primero
   * mirando las fechas, y al probarlo en pantalla la tabla del comité
   * no pedía nada: con el periodo en «Desde el principio» ---que es
   * como arranca--- no hay ventana NUNCA, así que los tres bloques se
   * quedaban en esqueleto para siempre. Que no haya ventana es una
   * respuesta, no una espera.
   */
  it('y la espera no mira las fechas, que con «Desde el principio» no llegan', () => {
    for (const f of [
      'components/admin/resumen-general.tsx',
      'components/admin/tabla-por-accion.tsx',
      'components/admin/tabla-por-grupo.tsx',
    ]) {
      const t = frontend(f);
      expect(t).toContain('const listo = ventanaResuelta;');
      expect(t).not.toContain('esperaVentana');
    }
  });

  /**
   * Y LOS TRES LO HONRAN. Pasar la bandera sin que el componente la
   * mire deja el fallo intacto y las pruebas de arriba en verde, que
   * es la peor combinación posible.
   */
  it('el resumen general no consulta hasta tenerla', () => {
    const t = frontend('components/admin/resumen-general.tsx');
    /// Lo que decide si se pregunta es eso, no otra cosa.
    expect(t).toContain('activo: listo');
    /// Mientras espera, esqueleto. Un cero o la cifra vieja se leen
    /// como un dato: es justo el «25» con otra cara.
    expect(t).toContain('if (!listo) return <Esqueleto />;');
  });

  it('las dos tablas tampoco', () => {
    for (const f of [
      'components/admin/tabla-por-accion.tsx',
      'components/admin/tabla-por-grupo.tsx',
    ]) {
      const t = frontend(f);
      expect(t).toContain('activo: listo');
      /// Las dos ya traían su esqueleto para cuando no hay datos, y
      /// con `activo` en falso no los hay. Se fija para que siga ahí.
      expect(t).toContain('if (!vivos.datos) return <Esqueleto />;');
    }
  });

  /**
   * Y EL TIPO DEL ENDPOINT DECLARA LA VENTANA. `Filtros` es el tipo
   * del listado y no lleva periodo; `resumenGeneral` recibía eso, así
   * que `desde`/`hasta` viajaban sin que el compilador los conociera
   * y nadie se habría enterado de que el bloque no los mandaba.
   */
  it('el endpoint del resumen general declara el periodo que recibe', () => {
    const t = frontend('lib/crm-api.ts');
    const i = t.indexOf('resumenGeneral: (');
    expect(i).toBeGreaterThan(-1);
    expect(t.slice(i, i + 120)).toContain('desde?: string');
  });
});

describe('la acción abierta no pisa al filtro de arriba', () => {
  /**
   * SE RESUELVE AL VUELO, no con un efecto que llame a `setEstado`:
   * un efecto repintaría dos veces y dejaría un fotograma con la
   * tabla de AF3 debajo del rótulo de AF4.
   */
  it('manda el filtro cuando los dos nombran acciones distintas', () => {
    const t = PANEL();
    const i = t.indexOf('const abiertaVale =');
    expect(i).toBeGreaterThan(-1);
    const bloque = t.slice(i, t.indexOf('const recorteConLaAbierta', i));
    /// La abierta vale si no hay filtro, o si el filtro nombra esa
    /// misma acción.
    expect(bloque).toContain('!filtros.accionFormacionId');
    expect(bloque).toContain('filtros.accionFormacionId === accionAbierta.id');
  });

  /**
   * Y LOS SITIOS QUE LA USAN LA PIDEN VALIDADA.
   *
   * Es la mitad del arreglo: calcular `abiertaVale` y seguir leyendo
   * `accionAbierta` en la tabla ---o en el bloque de grupos--- deja la
   * pantalla igual de pegada.
   */
  it('la tabla, su comparación y el detalle por grupos', () => {
    const t = PANEL();
    /// El corte de la tabla.
    expect(t).toContain('recorte={recorteConLaAbierta}');
    /// Y el del periodo con el que compara: sin esto, la cifra de
    /// arriba de cada celda era de AF3 y la de abajo de todas las
    /// acciones. Dos números apilados con cara de ser comparables.
    const i = t.indexOf('recorteAnterior={');
    expect(i).toBeGreaterThan(-1);
    expect(t.slice(i, t.indexOf('rotuloAnterior', i))).toContain(
      'abiertaVale',
    );
    /// El bloque 3 y la fila resaltada.
    expect(t).toContain('{abiertaVale && (');
    expect(t).toContain('elegida={abiertaVale?.id ?? null}');
  });

  it('y nada vuelve a leer la cruda fuera de donde se valida', () => {
    /// Se mide por líneas y no por posiciones de carácter: los
    /// ficheros son CRLF y contar a mano se equivoca por uno en cada
    /// salto.
    const lineas = PANEL().split(/\r?\n/);
    const donde = (aguja: string) =>
      lineas.findIndex((l) => l.includes(aguja));
    const abre = donde('const abiertaVale =');
    const cierra = donde('const recorteConLaAbierta');
    expect(abre).toBeGreaterThan(-1);
    expect(cierra).toBeGreaterThan(abre);

    /// Todo uso de la cruda, menos donde se declara, donde se guarda
    /// y el tramo donde se valida, es un sitio que volvió a quedarse
    /// pegado en AF3.
    const fuera = lineas
      .map((l, n) => ({ n, l }))
      .filter(({ l }) => /\baccionAbierta\b/.test(l))
      /// Los comentarios la nombran para explicar el arreglo: los de
      /// linea y los de JSX, que es como se comenta dentro del
      /// `return`.
      .filter(({ l }) => !l.trimStart().startsWith('///'))
      .filter(({ l }) => !l.trimStart().startsWith('{/*'))
      .filter(({ l }) => !/setAccionAbierta|useState/.test(l))
      .filter(({ n }) => n < abre || n >= cierra)
      .map(({ n, l }) => `${n + 1}: ${l.trim()}`);
    expect(fuera).toEqual([]);
  });
});
