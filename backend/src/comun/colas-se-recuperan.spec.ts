/** Ninguna cola deja una fila tomada para siempre. */

/**
 * El defecto, que aparecio DOS veces por separado:
 *
 * un trabajador toma una fila y la marca `EN_CURSO`. Si el
 * proceso muere ahi —un despliegue, un reinicio, un failover de
 * sede— la fila se queda `EN_CURSO` y **nadie la vuelve a
 * coger**, porque la sentencia que reparte trabajo solo mira
 * `PENDIENTE`. La pantalla dice «consultando...» para siempre.
 *
 * Paso en el RUI con un despliegue, y se encontro una del
 * buscador de empresas colgada desde hacia CUATRO DIAS. Ahi es
 * peor: `SIN_RESOLVER` incluye `EN_CURSO`, asi que una colgada
 * ademas impide encolar otra para ese NIT.
 *
 * Y no es un caso raro en este sistema: hay tres sedes que se
 * promueven solas, asi que matar un proceso a media consulta es
 * parte del funcionamiento normal.
 *
 * Este spec lee el SQL de las dos colas y exige que las dos
 * sepan recuperar. Se lee el fichero a proposito: es la unica
 * forma de cubrir las dos con una regla, y de que una cola
 * NUEVA que copie el patron viejo salte aqui.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const COLAS = [
  {
    que: 'la del RUI',
    fichero: join(__dirname, '..', 'crm', 'rui', 'rui.service.ts'),
    tabla: 'consultas_rui',
  },
  {
    que: 'la del buscador de empresas',
    fichero: join(__dirname, '..', 'instituciones', 'web', 'web.service.ts'),
    tabla: 'consultas_rues',
  },
];

/** El SELECT que decide a quien se le da trabajo. */
function repartoDeTrabajo(fichero: string, tabla: string): string {
  const texto = readFileSync(fichero, 'utf8');
  const i = texto.indexOf(`SELECT "id" FROM "${tabla}"`);
  if (i === -1) {
    throw new Error(
      `No se encontro el reparto de trabajo de ${tabla}. ` +
        'Si se reescribio, actualice este spec: la regla sigue valiendo.',
    );
  }
  return texto.slice(i, texto.indexOf('LIMIT 1', i));
}

describe('una fila tomada por un worker muerto se recupera', () => {
  for (const cola of COLAS) {
    describe(cola.que, () => {
      it('vuelve a coger las EN_CURSO viejas, no solo las PENDIENTE', () => {
        const sql = repartoDeTrabajo(cola.fichero, cola.tabla);

        expect({ cola: cola.que, recupera: sql.includes("'EN_CURSO'") }).toEqual({
          cola: cola.que,
          recupera: true,
        });
      });

      it('y solo las viejas: se mide contra `tomadaEn`', () => {
        /// Sin la ventana, un worker VIVO perderia su propia
        /// fila a mitad de consulta y dos la trabajarian a la
        /// vez. La recuperacion tiene que distinguir «murio» de
        /// «esta tardando».
        const sql = repartoDeTrabajo(cola.fichero, cola.tabla);

        expect(sql).toMatch(/"tomadaEn"\s*<\s*NOW\(\)\s*-\s*INTERVAL/);
      });

      it('la ventana deja terminar a un worker vivo', () => {
        /// El RUI espera 25 s por consulta; el buscador, 90 s
        /// por intento y tres corridas de consenso. La ventana
        /// tiene que ser holgada frente a eso o se recuperan
        /// filas que nadie habia soltado.
        const sql = repartoDeTrabajo(cola.fichero, cola.tabla);
        const m = /INTERVAL\s+'(\d+)\s+minutes'/.exec(sql);

        expect(m).not.toBeNull();
        expect(Number(m![1])).toBeGreaterThanOrEqual(5);
      });
    });
  }
});
