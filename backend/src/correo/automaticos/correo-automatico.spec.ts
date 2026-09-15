/** El correo que sale solo, y las veces que no sale. */

/**
 * Un envio automatico no tiene a nadie mirando la pantalla,
 * asi que las razones por las que NO sale son la mitad del
 * trabajo: si se callan, la respuesta a «¿por que no le
 * llego?» es ir a la base.
 *
 * El doble de Prisma APLICA LOS FILTROS de verdad --`activa`,
 * `disparador`, el estado de la fila--. Con uno que los
 * ignorara, estos tests probarian el doble y no el candado, que
 * es un defecto que este proyecto ya pago cuatro veces.
 */

import { dobleDeEnlace } from '../../preinscripcion/doble-enlace';
import { dobleDeMarcaDeCarta } from '../carta/doble';
import { CorreoAutomaticoService } from './correo-automatico.service';

type Escritura = { id: string; datos: Record<string, unknown> };
type Where = Record<string, any>;

const PLANTILLA = {
  id: 'p1',
  asunto: 'Recibimos su preinscripcion',
  cuerpo: '{{saludo}}: {{accionFormacion}}, {{modalidad}}.',
  disparador: 'PREINSCRIPCION',
  etapasPermitidas: [] as string[],
  bannerMime: null,
  bannerVersion: 1,
  convenioId: 'c1',
  activa: true,
};

const FICHA = {
  etapa: 'INTERESADO',
  personaId: 'per1',
  convenioId: 'c1',
  convenio: { sigla: 'ADECOPRIA', nombre: 'Adecopria' },
  persona: {
    primerNombre: 'CAMILA',
    segundoNombre: null,
    primerApellido: 'CARO',
    segundoApellido: null,
    generoSepId: 2,
    numeroDocumento: '1017138135',
    correo: 'camila@ejemplo.test',
    celular: '3000000000',
  },
  empresa: null,
  reserva: null,
  accionFormacion: {
    codigo: 'AF1',
    nombre: 'Gestion de la atencion',
    modalidad: 'VIRTUAL',
    evento: 'CURSO',
    horas: 40,
  },
  oferta: { modalidad: 'VIRTUAL', ubicacion: { nombre: 'Santander' } },
  cobertura: null,
  asesor: null,
};

function armar(opciones: {
  plantillas?: Array<Record<string, unknown>>;
  autorizaciones?: unknown[];
  ficha?: unknown;
  envio?: unknown;
  fila?: Record<string, unknown> | null;
  /// Lo que devuelve el UPDATE que reclama la fila: 0 = otro
  /// proceso se la llevo.
  reclamada?: number;
}) {
  const escrituras: Escritura[] = [];
  const reclamos: Where[] = [];
  const caducados: Where[] = [];
  const fila =
    opciones.fila === undefined
      ? {
          id: 'ca1',
          motivo: 'PREINSCRIPCION',
          participanteId: 'par1',
          convenioId: 'c1',
          intentos: 0,
          estado: 'PENDIENTE',
        }
      : opciones.fila;

  const prisma = {
    correoAutomatico: {
      findFirst: ({ where }: { where: Where }) => {
        if (!fila) return Promise.resolve(null);
        /// El doble filtra DE VERDAD por el gremio, que es lo
        /// que impide que una fila sin plantilla tape la cola.
        const lista = where.convenioId?.in as string[] | undefined;
        if (lista && !lista.includes(fila.convenioId as string)) {
          return Promise.resolve(null);
        }
        return Promise.resolve(fila);
      },
      updateMany: ({ where, data }: { where: Where; data: Where }) => {
        if (where.estado === 'PENDIENTE' && where.id) {
          reclamos.push(where);
          return Promise.resolve({ count: opciones.reclamada ?? 1 });
        }
        caducados.push({ ...where, ...data });
        return Promise.resolve({ count: 0 });
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        escrituras.push({ id: where.id, datos: data });
        return Promise.resolve({});
      },
    },
    plantillaCorreo: {
      findMany: ({ where }: { where: Where }) => {
        const todas = (opciones.plantillas ?? [PLANTILLA]) as Array<
          Record<string, unknown>
        >;
        /// Los mismos dos filtros que pide el servicio.
        return Promise.resolve(
          todas.filter(
            (p) =>
              (where.activa === undefined || p.activa === where.activa) &&
              p.disparador !== 'NINGUNO',
          ),
        );
      },
    },
    participante: {
      findUnique: () =>
        Promise.resolve(opciones.ficha === undefined ? FICHA : opciones.ficha),
    },
    autorizacionDatos: {
      findMany: () =>
        Promise.resolve(opciones.autorizaciones ?? [{ revocadaEn: null }]),
    },
  };

  const enviados: unknown[] = [];
  const correo = {
    enviar: (c: unknown) => {
      enviados.push(c);
      return Promise.resolve(
        opciones.envio ?? {
          estado: 'ENVIADO',
          id: '<x@y>',
          para: ['camila@ejemplo.test'],
          desviado: false,
        },
      );
    },
  };

  const s = new CorreoAutomaticoService(
    prisma as never,
    correo as never,
    dobleDeMarcaDeCarta(),
    dobleDeEnlace(),
  );
  return { s, escrituras, enviados, reclamos, caducados };
}

describe('el correo automático', () => {
  it('manda y deja escrito a dónde fue', async () => {
    const { s, escrituras, enviados } = armar({});
    const hubo = await s.mandarUno();

    expect(hubo).toBe(true);
    expect(enviados).toHaveLength(1);
    expect(escrituras[0].datos.estado).toBe('ENVIADO');
    expect(escrituras[0].datos.entregadoA).toBe('camila@ejemplo.test');
  });

  it('llena la plantilla con los datos de esa ficha', async () => {
    const { s, enviados } = armar({});
    await s.mandarUno();

    const c = enviados[0] as { texto: string; deParte: string };
    expect(c.texto).toContain('Estimada Sra. Caro');
    expect(c.texto).toContain('AF1 · Gestion de la atencion');
    /// De la oferta y no de la accion: es la celda que la
    /// persona eligio.
    expect(c.texto).toContain('Virtual');
  });

  it('reclama la fila ANTES de mandarla', async () => {
    const { s, reclamos } = armar({});
    await s.mandarUno();

    /// Con el estado en el `where`: si dos procesos leen la
    /// misma fila, solo uno la escribe.
    expect(reclamos[0]).toMatchObject({ id: 'ca1', estado: 'PENDIENTE' });
  });

  it('si otro proceso se la llevó, no manda nada', async () => {
    const { s, enviados } = armar({ reclamada: 0 });
    await s.mandarUno();

    expect(enviados).toHaveLength(0);
  });

  it('sin plantilla NO cierra la fila: la deja esperando', async () => {
    const { s, escrituras, enviados } = armar({ plantillas: [] });
    const hubo = await s.mandarUno();

    /// Cerrarla seria condenar a esa persona: la plantilla se
    /// crea desde el panel, y hasta que exista NO hay ninguna.
    /// Al desplegar esto, ninguna la tiene.
    expect(hubo).toBe(false);
    expect(enviados).toHaveLength(0);
    expect(escrituras).toHaveLength(0);
  });

  it('una plantilla APAGADA no dispara nada', async () => {
    const { s, enviados } = armar({
      plantillas: [{ ...PLANTILLA, activa: false }],
    });
    const hubo = await s.mandarUno();

    expect(hubo).toBe(false);
    expect(enviados).toHaveLength(0);
  });

  it('una plantilla SIN disparador no dispara nada', async () => {
    const { s, enviados } = armar({
      plantillas: [{ ...PLANTILLA, disparador: 'NINGUNO' }],
    });
    await s.mandarUno();

    expect(enviados).toHaveLength(0);
  });

  it('no toma la fila de un gremio que no tiene plantilla', async () => {
    const { s, enviados } = armar({
      plantillas: [{ ...PLANTILLA, convenioId: 'OTRO-GREMIO' }],
    });
    const hubo = await s.mandarUno();

    /// Sin este filtro, esa fila se queda en la cabeza de la
    /// cola tapando a todas las demas cada segundo y medio.
    expect(hubo).toBe(false);
    expect(enviados).toHaveLength(0);
  });

  it('respeta las etapas permitidas, igual que el envío manual', async () => {
    const { s, escrituras, enviados } = armar({
      plantillas: [{ ...PLANTILLA, etapasPermitidas: ['INSCRITO'] }],
    });
    await s.mandarUno();

    expect(enviados).toHaveLength(0);
    expect(escrituras[0].datos.estado).toBe('OMITIDO');
  });

  it('a quien revocó NO se le escribe', async () => {
    const { s, escrituras, enviados } = armar({
      autorizaciones: [{ revocadaEn: new Date() }],
    });
    await s.mandarUno();

    expect(enviados).toHaveLength(0);
    expect(escrituras[0].datos.estado).toBe('OMITIDO');
    expect(String(escrituras[0].datos.detalle)).toContain('Revocó');
  });

  it('un hueco sin llenar detiene el envío y se dice cuál', async () => {
    const { s, escrituras, enviados } = armar({
      plantillas: [
        {
          ...PLANTILLA,
          /// `grupo` es nulo para un recien preinscrito: por
          /// la regla del cliente nada de lo inscrito cuelga
          /// del cronograma.
          cuerpo: 'Su grupo es el {{grupo}}.',
        },
      ],
    });
    await s.mandarUno();

    expect(enviados).toHaveLength(0);
    expect(escrituras[0].datos.estado).toBe('OMITIDO');
    expect(String(escrituras[0].datos.detalle)).toContain('{{grupo}}');
  });

  it('la del gremio le gana a la general', async () => {
    const general = { ...PLANTILLA, id: 'pG', asunto: 'General', convenioId: null };
    const suya = { ...PLANTILLA, id: 'pA', asunto: 'De ADECOPRIA' };
    /// La general va PRIMERO a proposito: si ganara el orden
    /// de la lista, este caso pasaria por casualidad.
    const { s, enviados } = armar({ plantillas: [general, suya] });
    await s.mandarUno();

    expect((enviados[0] as { asunto: string }).asunto).toBe('De ADECOPRIA');
  });

  it('firma con el gremio de QUIEN LO RECIBE, no con el de la plantilla', async () => {
    /// Con la plantilla general, `quienFirma` de la plantilla
    /// daria «Convoca CRM» a alguien que se inscribio en
    /// ADECOPRIA. La marca sale del gremio del destinatario:
    /// es la regla del correo de acceso, ya escrita.
    const { s, enviados } = armar({
      plantillas: [{ ...PLANTILLA, convenioId: null }],
    });
    await s.mandarUno();

    expect((enviados[0] as { deParte: string }).deParte).toBe('ADECOPRIA');
  });

  it('con el correo apagado devuelve el intento y no cierra la fila', async () => {
    const { s, escrituras } = armar({ envio: { estado: 'APAGADO' } });
    const hubo = await s.mandarUno();

    /// `false` para que el trabajador se duerma un minuto en
    /// vez de girar en vacio. Y el intento se devuelve: no se
    /// intento nada, y quemarlos dejaria el acuse en FALLO por
    /// una variable que falta en el servidor.
    expect(hubo).toBe(false);
    expect(escrituras[0].datos.intentos).toBe(0);
    expect(escrituras[0].datos.ultimoIntentoEn).toBeNull();
  });

  it('un fallo de SMTP se reintenta, no se descarta', async () => {
    const { s, escrituras } = armar({
      envio: { estado: 'FALLO', error: 'timeout' },
    });
    await s.mandarUno();

    /// Sigue PENDIENTE: el estado no se toca hasta agotar los
    /// intentos, y el siguiente espera diez minutos.
    expect(escrituras[0].datos.estado).toBeUndefined();
    expect(escrituras[0].datos.detalle).toBe('timeout');
  });

  it('el último intento sí lo cierra en FALLO', async () => {
    const { s, escrituras } = armar({
      envio: { estado: 'FALLO', error: 'timeout' },
      fila: {
        id: 'ca1',
        motivo: 'PREINSCRIPCION',
        participanteId: 'par1',
        convenioId: 'c1',
        intentos: 4,
        estado: 'PENDIENTE',
      },
    });
    await s.mandarUno();

    expect(escrituras[0].datos.estado).toBe('FALLO');
  });
});
