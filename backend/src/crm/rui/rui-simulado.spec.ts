import { EstadoConsultaRui } from '../../../generated/prisma';
import { RuiService } from './rui.service';

/// Lo que dice la ficha sobre una respuesta ya dada tiene
/// que salir de la fila, no de RUI_PROVEEDOR.
///
/// La variable dice con que corre el servidor AHORA. Si la
/// ficha la leyera, apagar el simulador convertiria sus
/// nombres inventados en respuestas del Estado -- justo lo
/// contrario de lo que este validador existe para hacer.

/// Una base de mentira que solo sabe devolver una consulta
/// y decir si la persona es inventada.
function conLaFila(
  fila: Record<string, unknown> | null,
  esDePrueba = false,
) {
  const prisma = {
    consultaRui: {
      findFirst: jest.fn().mockResolvedValue(fila),
      count: jest.fn().mockResolvedValue(0),
    },
    persona: {
      findUnique: jest.fn().mockResolvedValue({ esDePrueba }),
    },
  };
  return new RuiService(
    prisma as never,
    { encolar: jest.fn(), priorizar: jest.fn() } as never,
    { registrar: jest.fn() } as never,
    {} as never,
  );
}

const YA_RESPONDIDA = {
  id: 'c1',
  estado: EstadoConsultaRui.LISTA,
  nombreEncontrado: 'SIMULADO . el RUI no esta conectado (doc. 123)',
  nombreTecleado: 'ANA PEREZ',
  nombreCoincide: false,
  resueltaEn: new Date('2026-08-23T08:00:00Z'),
  prioridad: 0,
  creadoEn: new Date('2026-08-23T07:59:00Z'),
  simulado: true,
};

describe('de donde sale la marca de simulado', () => {
  const antes = process.env.RUI_PROVEEDOR;
  afterEach(() => {
    if (antes === undefined) delete process.env.RUI_PROVEEDOR;
    else process.env.RUI_PROVEEDOR = antes;
  });

  it('una respuesta del simulador sigue marcada aunque hoy el RUI este conectado', async () => {
    process.env.RUI_PROVEEDOR = 'VENTANILLA';
    const r = await conLaFila(YA_RESPONDIDA).estadoDe('p1');
    expect(r.simulado).toBe(true);
  });

  it('una respuesta del RUI no se marca aunque hoy corra el simulador', async () => {
    delete process.env.RUI_PROVEEDOR;
    const r = await conLaFila({
      ...YA_RESPONDIDA,
      nombreEncontrado: 'Camila Alejandra Caro Garavito',
      simulado: false,
    }).estadoDe('p1');
    expect(r.simulado).toBe(false);
  });

  it('mientras espera, la marca dice con que se va a consultar', async () => {
    process.env.RUI_PROVEEDOR = 'VENTANILLA';
    const r = await conLaFila({
      ...YA_RESPONDIDA,
      estado: EstadoConsultaRui.PENDIENTE,
      nombreEncontrado: null,
      resueltaEn: null,
      simulado: true,
    }).estadoDe('p1');
    expect(r.simulado).toBe(false);
  });

  it('sin ninguna consulta, tambien dice con que se va a consultar', async () => {
    delete process.env.RUI_PROVEEDOR;
    const r = await conLaFila(null).estadoDe('p1');
    expect(r.estado).toBe('SIN_CONSULTA');
    expect(r.simulado).toBe(true);
  });
});

/// Una cedula inventada le pertenece a alguien de verdad. La
/// ficha tiene que poder decir por que no se consulto, en vez
/// de quedarse callada como si nadie hubiera preguntado.
describe('personas inventadas', () => {
  it('la ficha sabe que es un dato de prueba', async () => {
    const r = await conLaFila(null, true).estadoDe('p1');
    expect(r.estado).toBe('SIN_CONSULTA');
    expect(r.esDePrueba).toBe(true);
  });

  it('una persona de verdad no queda marcada', async () => {
    const r = await conLaFila(null, false).estadoDe('p1');
    expect(r.esDePrueba).toBe(false);
  });
});
