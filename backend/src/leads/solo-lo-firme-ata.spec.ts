/** Una coincidencia floja NO ata el lead a una ficha. */

/**
 * `cruzarConElCrm` calcula `firme` —true solo con el documento—
 * y el fichero explica bien por qué: una familia comparte buzón
 * y una empresa pone el correo de la secretaria en veinte
 * formularios, así que lo que encuentra el correo o el celular
 * tiene que quedar como PROPUESTA.
 *
 * Eso estaba escrito y no estaba conectado. `grep firme` en
 * todo `leads/` solo daba dentro de `cruzar-con-el-crm.ts` y su
 * spec: nadie la leía. El servicio ataba `participanteId` y
 * marcaba `CONVERTIDO` con CUALQUIER coincidencia, y el log
 * decía «queda propuesta para el asesor» mientras la decisión
 * ya estaba tomada.
 *
 * Es el defecto que este repositorio lleva semanas nombrando:
 * el control en pie y vacío de efecto. Y el daño concreto es
 * que un lead nuevo caía encima de la ficha de otra persona.
 *
 * Este spec mira lo que se ESCRIBE, que es lo único que
 * distingue «se decidió» de «se propuso».
 */

import { LeadsService } from './leads.service';

type Escrito = { estado?: string; participanteId?: string; motivo?: string };

function armar(coincide: { firme: boolean; por: string }) {
  const escrito: Escrito[] = [];

  const tx = {
    leadEntrante: {
      update: ({ data }: { data: Escrito }) => {
        escrito.push(data);
        return Promise.resolve({});
      },
    },
    toqueDeOrigen: { upsert: () => Promise.resolve({}) },
    participante: { updateMany: () => Promise.resolve({}) },
    propuestaDeDatos: {
      deleteMany: () => Promise.resolve({}),
      create: () => Promise.resolve({}),
    },
  };

  const prisma = {
    persona: {
      findUnique: () =>
        Promise.resolve({
          primerNombre: 'Ana',
          segundoNombre: null,
          primerApellido: 'Ruiz',
          segundoApellido: null,
          correo: 'oficina@empresa.test',
          celular: '3001112233',
        }),
    },
    $transaction: (f: (t: unknown) => Promise<unknown>) => f(tx),
  };

  const s = new LeadsService(prisma as never, {} as never);

  const llamar = (
    s as unknown as {
      avisarQueYaEstaba: (
        id: string,
        c: unknown,
        d: unknown,
        p: boolean,
      ) => Promise<void>;
    }
  ).avisarQueYaEstaba.bind(s);

  return {
    escrito,
    correr: () =>
      llamar(
        'lead1',
        {
          ...coincide,
          personaId: 'per1',
          participanteId: 'part-de-otro',
        },
        { correo: 'nuevo@ejemplo.test', celular: null, nombreCompleto: 'Ana Ruiz' },
        true,
      ),
  };
}

describe('con documento: se ata, porque es la llave del sistema', () => {
  it('queda CONVERTIDO y pegado a la ficha', async () => {
    const { escrito, correr } = armar({ firme: true, por: 'DOCUMENTO' });
    await correr();

    expect(escrito[0].estado).toBe('CONVERTIDO');
    expect(escrito[0].participanteId).toBe('part-de-otro');
  });
});

describe('con correo o celular: se PROPONE, no se decide', () => {
  for (const por of ['CORREO', 'CELULAR']) {
    it(`por ${por} NO se ata el lead a esa ficha`, async () => {
      /// Lo que importa es que NO viaje `participanteId`: eso
      /// es lo que convierte una sospecha en un hecho.
      const { escrito, correr } = armar({ firme: false, por });
      await correr();

      expect(escrito[0].participanteId).toBeUndefined();
    });

    it(`por ${por} se queda PENDIENTE, esperando al asesor`, async () => {
      const { escrito, correr } = armar({ firme: false, por });
      await correr();

      expect(escrito[0].estado).toBe('PENDIENTE');
    });

    it(`por ${por} el motivo dice que hay que confirmarlo`, async () => {
      /// «Posible repetido» y no «ya estaba»: el asesor tiene
      /// que saber que le toca decidir a él.
      const { escrito, correr } = armar({ firme: false, por });
      await correr();

      expect(escrito[0].motivo).toMatch(/confirme/i);
    });
  }
});
