/** BBDD Leads deja marcar y asignar, como Gestión de leads. */

/**
 * «SE DEBE PERMITIR ASIGNAR; ES LA VISUAL DE GESTIÓN DE LEADS Y NO LA
 * VEO IGUAL» (cliente, 7 oct 2026), después de que le llamaran la
 * atención por ello.
 *
 * Yo había leído «que se vea como Gestión de leads» como las columnas,
 * los filtros y el Excel, y había dejado fuera lo único que de verdad
 * hace falta: REPARTIR. Una base de 1.252 personas sin repartir no es
 * trabajo de nadie, y abrirlas de una en una por el cajón son 1.252
 * clics.
 *
 * Se prueba leyendo la fuente ---como `el-espejo-no-se-separa`--- y no
 * montando la pantalla: lo que se quiere fijar es que esta tabla NO
 * pierda la selección en la próxima limpieza, y para eso basta ver que
 * los dos accesorios siguen puestos y que la ruta es la de leads.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGINA = readFileSync(
  join(
    __dirname,
    '..',
    '..',
    '..',
    'frontend',
    'src',
    'app',
    'admin',
    'bbdd-leads',
    'page.tsx',
  ),
  'utf8',
);

describe('la base se puede marcar y repartir', () => {
  it('la tabla lleva selección y barra de lote', () => {
    expect(PAGINA).toContain('seleccion');
    expect(PAGINA).toContain('accionesLote');
  });

  /**
   * Y REPARTE POR LA RUTA DE LEADS, no por la de fichas.
   *
   * `crmApi.asignarAsesorEnLote` ---la de Gestión de leads--- trabaja
   * sobre PARTICIPANTES. Estos son leads de la mesa, que todavía no
   * tienen ficha: llamar a aquella desde aquí no encontraría ninguno
   * y la pantalla diría «0 repartidos» sin explicar por qué.
   */
  it('y llama a la de leads, que es otra población', () => {
    expect(PAGINA).toContain('mesaApi.asignar(');
    /// CON EL PARÉNTESIS. El comentario de arriba la NOMBRA para
    /// explicar por qué no se usa, así que sin él la prueba se
    /// tropieza con su propia explicación.
    expect(PAGINA).not.toContain('crmApi.asignarAsesorEnLote(');
  });

  /**
   * Y PIDE EL MISMO PERMISO QUE LA MESA. Dos nombres para el mismo
   * permiso acaban dando dos respuestas distintas: la pantalla
   * ofrecería repartir y el servidor lo negaría, o al revés.
   */
  it('con la misma llave de permiso que la mesa', () => {
    expect(PAGINA).toContain('admin?.puede?.repartirFichas');
  });

  /**
   * Y DICE LO QUE NO SE TOCÓ. El servidor salta a quien ya tiene ficha
   * o revocó, así que `repartidos` puede ser menor que lo marcado.
   * Callarlo deja a quien reparte creyendo que los 50 quedaron
   * repartidos, que es peor que no haberlo intentado.
   */
  it('y avisa de los que se quedaron sin tocar', () => {
    expect(PAGINA).toContain('sinTocar');
    expect(PAGINA).toContain('ya tienen ficha o no se les puede contactar');
  });

  /**
   * Y A QUIEN NO PUEDE, SE LE DICE POR QUÉ. Esconder el control a
   * secas deja a quien lo busca pensando que la pantalla está rota.
   */
  it('y a quien no puede le dice a quién pedírselo', () => {
    expect(PAGINA).toContain('lo hace un líder de');
  });
});
