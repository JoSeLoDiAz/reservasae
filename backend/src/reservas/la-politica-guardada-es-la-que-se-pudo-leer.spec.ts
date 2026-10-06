/** La reserva apunta a la versión de la política que la persona vio. */

/**
 * LO ENCONTRÓ UNA AUDITORÍA DEL 5 OCT 2026.
 *
 * Lo que se guarda en `Reserva.politicaDatosId` no es un «sí, aceptó»:
 * es el puntero a la VERSIÓN exacta del texto que la persona marcó. Es
 * lo único que se puede enseñar dentro de seis meses si alguien
 * pregunta qué autorizó, y por eso tiene que ser la misma versión que
 * la pantalla le puso delante.
 *
 * Aquí se elegía con `vigenteHasta: null` ---«la que todavía no se ha
 * cerrado»--- mientras las otras dos puertas del sistema
 * ---`crm/constancia-de-autorizacion.ts` y el catálogo de la
 * preinscripción--- eligen con `vigenteDesde <= ahora` ordenando por
 * versión. No son el mismo criterio: una versión programada para
 * entrar en vigor más adelante tiene `vigenteHasta` en null y la
 * versión más alta, así que ganaba la cuenta de aquí y perdía la de la
 * pantalla. Resultado: la pantalla mostraba la v1, la persona aceptaba
 * la v1 y la reserva quedaba apuntando a la v2, un texto que nadie
 * pudo leer todavía.
 *
 * Tres criterios para la misma decisión acaban siempre así. Ahora son
 * dos sitios con el mismo, y el último caso de este fichero está para
 * que no vuelvan a ser tres.
 */

import { ConflictException } from '@nestjs/common';

import {
  baseFalsa,
  CONTEXTO,
  dtoDeReserva,
  mundoBase,
  type PoliticaFalsa,
} from './base-falsa-de-reservas';
import { ReservasService } from './reservas.service';

const CONVENIO = 'cnv-adecopria';

function politica(ajustes: Partial<PoliticaFalsa>): PoliticaFalsa {
  return {
    id: 'pol',
    convenioId: CONVENIO,
    destinatario: 'RESERVA',
    version: 1,
    vigenteDesde: new Date('2026-01-01'),
    vigenteHasta: null,
    ...ajustes,
  };
}

async function politicaQueGuarda(politicas: PoliticaFalsa[]) {
  const mundo = mundoBase({ politicas });
  const servicio = new ReservasService(baseFalsa(mundo) as any, {} as any);
  await servicio.crear(dtoDeReserva(), CONTEXTO);
  return mundo.reservas[0].politicaDatosId;
}

describe('qué versión de la política guarda la reserva', () => {
  /**
   * EL CASO QUE ROMPÍA. La v2 está publicada pero entra en vigor el
   * 20 de octubre, así que la pantalla sigue mostrando la v1 ---y la
   * v1 tiene `vigenteHasta` puesto porque la v2 la reemplazará---.
   * Con el criterio viejo la única candidata era la v2.
   */
  it('no la que todavía no ha entrado en vigor', async () => {
    const guardada = await politicaQueGuarda([
      politica({
        id: 'pol-v1',
        version: 1,
        vigenteDesde: new Date('2026-01-01'),
        vigenteHasta: new Date('2026-10-20'),
      }),
      politica({
        id: 'pol-v2',
        version: 2,
        vigenteDesde: new Date('2026-10-20'),
        vigenteHasta: null,
      }),
    ]);

    expect(guardada).toBe('pol-v1');
  });

  it('con dos ya en vigor, la versión más alta', async () => {
    const guardada = await politicaQueGuarda([
      politica({
        id: 'pol-v1',
        version: 1,
        vigenteDesde: new Date('2026-01-01'),
      }),
      politica({
        id: 'pol-v2',
        version: 2,
        vigenteDesde: new Date('2026-06-01'),
      }),
    ]);

    expect(guardada).toBe('pol-v2');
  });

  /**
   * UNA VERSIÓN CERRADA SIGUE SIRVIENDO si es la que está en vigor.
   * Cerrar la v1 es anunciar que la v2 la reemplaza, no borrar la v1
   * de la historia: mientras la v2 no haya entrado, lo que la persona
   * lee es la v1 y es la v1 lo que hay que poder demostrar.
   */
  it('una sola versión, aunque esté cerrada, es la que se guarda', async () => {
    const guardada = await politicaQueGuarda([
      politica({
        id: 'pol-v1',
        version: 1,
        vigenteDesde: new Date('2026-01-01'),
        vigenteHasta: new Date('2026-12-31'),
      }),
    ]);

    expect(guardada).toBe('pol-v1');
  });

  /**
   * SIN TEXTO NO HAY NADA QUE ACEPTAR. No es una pega del formulario:
   * es que ese convenio no tiene política publicada, y hasta que la
   * tenga no se pueden recibir registros.
   */
  it('sin ninguna en vigor, la reserva no entra', async () => {
    const mundo = mundoBase({
      politicas: [
        politica({
          id: 'pol-v1',
          version: 1,
          vigenteDesde: new Date('2027-01-01'),
        }),
      ],
    });
    const servicio = new ReservasService(baseFalsa(mundo) as any, {} as any);

    await expect(servicio.crear(dtoDeReserva(), CONTEXTO)).rejects.toThrow(
      ConflictException,
    );
    /// Y sin dejar nada a medias, como todo lo de `crear`.
    expect(mundo.empresas).toHaveLength(0);
  });

  it('y la de otro convenio no se cuela', async () => {
    const mundo = mundoBase({
      politicas: [
        politica({
          id: 'pol-britcham',
          convenioId: 'cnv-britcham',
          version: 9,
        }),
        politica({ id: 'pol-v1', version: 1 }),
      ],
    });
    const servicio = new ReservasService(baseFalsa(mundo) as any, {} as any);
    await servicio.crear(dtoDeReserva(), CONTEXTO);

    expect(mundo.reservas[0].politicaDatosId).toBe('pol-v1');
  });
});

describe('el mismo criterio en las dos puertas', () => {
  const leer = (ruta: string) =>
    require('fs').readFileSync(
      require('path').join(__dirname, ruta),
      'utf8',
    ) as string;

  /**
   * ESTO ES LO QUE DE VERDAD SE ARREGLÓ: no un cálculo, sino que dos
   * sitios dejaran de decidir lo mismo de dos maneras. Si alguien
   * cambia uno de los dos, esta prueba se cae antes de que la
   * contradicción llegue a un informe.
   */
  it('reservas y la constancia del CRM eligen igual', () => {
    const dePago = [
      leer('reservas.service.ts').slice(
        leer('reservas.service.ts').indexOf('private async politicaVigente('),
      ),
      leer('../crm/constancia-de-autorizacion.ts'),
    ];

    for (const fuente of dePago) {
      expect(fuente).toContain('vigenteDesde: { lte: new Date() }');
      expect(fuente).toContain("orderBy: { version: 'desc' }");
    }
  });

  it('y en reservas ya no queda el criterio viejo', () => {
    const fuente = leer('reservas.service.ts');
    const i = fuente.indexOf('private async politicaVigente(');
    const cuerpo = fuente.slice(i, fuente.indexOf('\n  private ', i + 20));
    expect(cuerpo).not.toContain('vigenteHasta');
  });
});
