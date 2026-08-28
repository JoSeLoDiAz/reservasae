import { CampanasService } from './campanas.service';

/// Lo que cuida esto es la promesa central del producto:
/// BRITCHAM y ADECOPRIA son clientes DISTINTOS que compiten
/// entre sí. Que uno pueda leer, escribir o mandarle correos
/// a la gente del otro no es un fallo técnico, es perder el
/// contrato.
///
/// De once rutas de campañas, solo una comprobaba el gremio.

const DE_ELLOS = ['conv-britcham'];
const AJENA = { id: 'camp1', convenioId: 'conv-adecopria', nombre: 'suya' };

function servicio(campana: unknown = AJENA) {
  const prisma = {
    campana: { findUnique: () => Promise.resolve(campana) },
    destinatarioCampana: {
      findMany: () => Promise.resolve([{ correo: 'no-deberia@verse.co' }]),
      count: () => Promise.resolve(0),
      groupBy: () => Promise.resolve([]),
    },
    participante: { findMany: () => Promise.resolve([]) },
  };
  return new CampanasService(prisma as never, {} as never);
}

/// Una campaña ajena tiene que responder IGUAL que una que no
/// existe. Decir «no tiene permiso» confirmaría que ese id es
/// real, y con eso se recorre el catálogo del otro a base de
/// probar ids.
const COMO_SI_NO_EXISTIERA = /ya no existe/i;

describe('una campaña de otro gremio no se toca', () => {
  it('no se leen sus resultados', async () => {
    await expect(servicio().resultados('camp1', DE_ELLOS)).rejects.toThrow(
      COMO_SI_NO_EXISTIERA,
    );
  });

  it('NO se lee su lista de correos', async () => {
    // la peor: devolvía el directorio entero del otro gremio
    // consultando por campanaId a secas
    await expect(servicio().destinatarios('camp1', DE_ELLOS)).rejects.toThrow(
      COMO_SI_NO_EXISTIERA,
    );
  });

  it('no se lanza', async () => {
    // lanzarla es MANDARLE CORREOS a los ciudadanos del otro
    await expect(servicio().lanzar('camp1', DE_ELLOS)).rejects.toThrow(
      COMO_SI_NO_EXISTIERA,
    );
  });

  it('no se pausa ni se reanuda', async () => {
    await expect(servicio().pausar('camp1', DE_ELLOS)).rejects.toThrow(
      COMO_SI_NO_EXISTIERA,
    );
    await expect(servicio().reanudar('camp1', DE_ELLOS)).rejects.toThrow(
      COMO_SI_NO_EXISTIERA,
    );
  });

  it('no se le cambia el texto', async () => {
    await expect(
      servicio().editar(DE_ELLOS, 'camp1', { asunto: 'otro' }),
    ).rejects.toThrow(COMO_SI_NO_EXISTIERA);
  });

  it('no se le sube una base', async () => {
    await expect(
      servicio().cargarBase('camp1', Buffer.from(''), DE_ELLOS),
    ).rejects.toThrow(COMO_SI_NO_EXISTIERA);
  });

  it('el mensaje NO delata que la campaña existe', async () => {
    // si dijera «no tiene permiso», probando ids se sabría
    // cuáles son reales
    await expect(
      servicio().resultados('camp1', DE_ELLOS),
    ).rejects.toThrow(/ya no existe/i);
    await expect(
      servicio().resultados('camp1', DE_ELLOS),
    ).rejects.not.toThrow(/permiso|acceso|prohibid/i);
  });
});

describe('la suya sí se toca', () => {
  const PROPIA = { id: 'camp1', convenioId: 'conv-britcham', nombre: 'mía' };

  it('sus resultados se leen', async () => {
    await expect(
      servicio(PROPIA).resultados('camp1', DE_ELLOS),
    ).resolves.toBeDefined();
  });
});

describe('crear no acepta el gremio que le manden', () => {
  it('con un convenio ajeno en el cuerpo, se niega', async () => {
    // el convenioId venía del CUERPO validado solo con
    // @IsString(): con el id del otro se creaba una campaña
    // sobre sus participantes
    await expect(
      servicio().crear(
        DE_ELLOS,
        'conv-adecopria',
        { nombre: 'x', asunto: 'x', cuerpo: 'x', segmento: {} },
        'admin1',
      ),
    ).rejects.toThrow(/acceso a ese convenio/i);
  });

  it('y contar a cuántos va, tampoco', async () => {
    await expect(
      servicio().aCuantos('conv-adecopria', {}, DE_ELLOS),
    ).rejects.toThrow(/acceso a ese convenio/i);
  });
});
