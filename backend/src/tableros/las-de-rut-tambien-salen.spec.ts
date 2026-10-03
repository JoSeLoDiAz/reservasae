/** El listado de organizaciones enseña también a las que no reservaron. */

/**
 * «EN DÓNDE QUEDA EL LISTADO DE EMPRESAS, NO VEO LAS DE RUT, O SEA ME
 * DESGASTO PARA NADA» (cliente, 2 oct 2026).
 *
 * El listado filtraba con `empresaDeConvenio`, que reconoce a una
 * empresa POR TENER UNA RESERVA. Para las tarjetas de reservas eso
 * está bien ---la pregunta allí es cuántas han apartado cupos--- pero
 * el listado de organizaciones no pregunta eso.
 *
 * Por el formulario público la persona declara su organización, o su
 * RUT si es independiente, y ahí NO HAY NINGUNA RESERVA. Esas
 * organizaciones existen, tienen gente colgando, salen en los cargues
 * al SENA... y el listado no las enseñaba nunca. Medido en la base de
 * pruebas: de 31 organizaciones salían 13, y cinco de las que faltaban
 * tenían gente inscrita detrás ---dos de ellas personas naturales con
 * su documento por NIT, que son justo «las de RUT»---.
 *
 * Lo que se arregla es el alcance. Lo que NO se toca es
 * `empresaDeConvenio`: sus otros dos usos viven entre cifras de
 * reservas y mezclarles las que no han reservado cambiaría lo que esas
 * cifras han dicho siempre.
 */

import { empresaDeConvenio, organizacionDeConvenio } from './ambito';

const AMBITO = ['conv-adecopria'];

describe('quién es una organización del gremio', () => {
  it('la vieja regla solo mira reservas', () => {
    expect(empresaDeConvenio(AMBITO)).toEqual({
      reservas: {
        some: { oferta: { accionFormacion: { convenioId: { in: AMBITO } } } },
      },
    });
  });

  /**
   * LAS DOS PUERTAS, y por eso es un `OR`. Una organización entra en
   * el gremio porque apartó cupos O porque tiene gente formándose en
   * él. Exigir las dos cosas dejaría fuera a casi todas.
   */
  it('la nueva mira las dos puertas: reservó, o tiene gente', () => {
    const donde = organizacionDeConvenio(AMBITO);
    expect(donde.OR).toHaveLength(2);
    expect(donde.OR).toEqual([
      {
        reservas: {
          some: { oferta: { accionFormacion: { convenioId: { in: AMBITO } } } },
        },
      },
      { participantes: { some: { convenioId: { in: AMBITO } } } },
    ]);
  });

  /**
   * Y SIGUE ACOTADA AL GREMIO, que es lo que no se puede perder al
   * ampliarla: una organización con gente en BRITCHAM no es de
   * ADECOPRIA. Las dos ramas del `OR` llevan el ámbito dentro; si
   * alguna lo perdiera, el listado enseñaría las de todos.
   */
  it('las dos ramas siguen atadas al gremio', () => {
    const texto = JSON.stringify(organizacionDeConvenio(AMBITO));
    const cuantas = texto.split('conv-adecopria').length - 1;
    expect(cuantas).toBe(2);
  });
});

/**
 * EL FILTRO DE BÚSQUEDA VA CON `AND`, Y NO ES UN DETALLE DE ESTILO.
 *
 * `organizacionDeConvenio` trae un `OR` suyo y el de la búsqueda es
 * otro. Puestos los dos al mismo nivel de un objeto literal ---que es
 * como estaba escrito el filtro viejo, con un spread--- el segundo
 * PISA al primero, y el listado pasaría a enseñar las organizaciones
 * de TODOS los gremios en cuanto alguien escribiera algo en el
 * buscador. Un fallo de ámbito disfrazado de búsqueda, que además solo
 * aparecería al buscar.
 */
describe('buscar no puede romper el ámbito', () => {
  it('dos OR al mismo nivel se pisan: por eso van en AND', () => {
    const delGremio = { OR: ['reservó', 'tiene gente'] };
    const deLaBusqueda = { OR: ['por nit', 'por nombre'] };

    const malHecho = { ...delGremio, ...deLaBusqueda };
    expect(malHecho.OR).toEqual(['por nit', 'por nombre']);

    const bienHecho = { AND: [delGremio, deLaBusqueda] };
    expect(bienHecho.AND).toHaveLength(2);
  });
});
