/** Contra el muro del buscador no se insiste. */

/**
 * Cuando Google contesta «hemos detectado trafico inusual», eso no es un
 * fallo pasajero: pide una persona (aceptar condiciones o el captcha) o
 * cambiar de proveedor. Insistir es peor que no hacer nada, porque cada
 * intento nos marca un poco mas.
 *
 * Y se insistia por partida doble:
 *
 *   1. El consenso seguia con las corridas que faltaban, contra el mismo
 *      muro y con cuatro segundos de pausa.
 *   2. La consulta volvia a PENDIENTE, y el trabajador la retomaba seis
 *      segundos despues, hasta agotar los tres intentos.
 *
 * Nueve peticiones en un minuto justo cuando ya nos habian marcado.
 *
 * Ojo con el punto 1 al tocar `consultarConConsenso`: alli solo se
 * conservaba el TEXTO del error, y el FALLO se rehacia al final. Marcar
 * la respuesta del proveedor no bastaba: la bandera se perdia por el
 * camino y todo seguia igual. Por eso la prueba mira las dos cosas.
 */

import { EstadoConsultaRues } from '../../../generated/prisma';
import type { RespuestaWeb } from './proveedor-web';
import { WebService } from './web.service';

const MURO: RespuestaWeb = {
  estado: 'FALLO',
  reintentar: false,
  error: 'El buscador no dejó pasar: pide aceptar condiciones...',
};

const CAIDA: RespuestaWeb = {
  estado: 'FALLO',
  error: 'Chrome se cerró solo (código 1) sin abrir el puerto 9222.',
};

function armar(respuesta: RespuestaWeb) {
  const consulta = {
    id: 'c1',
    institucionId: 'i1',
    nit: '860507033',
    estado: 'PENDIENTE' as string,
    intentos: 0,
    resueltaEn: null as Date | null,
    ultimoError: null as string | null,
  };

  let consultas = 0;

  const prisma = {
    $queryRaw: async () => {
      if (consulta.estado !== 'PENDIENTE') return [];
      consulta.estado = 'EN_CURSO';
      consulta.intentos += 1;
      return [{ id: consulta.id, institucionId: consulta.institucionId, nit: consulta.nit }];
    },
    consultaRues: {
      findUnique: async () => consulta,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(consulta, data);
        return consulta;
      },
    },
  };

  const proveedor = {
    consultar: async () => {
      consultas += 1;
      return respuesta;
    },
  };

  const web = new WebService(prisma as never, proveedor as never);
  return { web, consulta, cuantasConsultas: () => consultas };
}

describe('el muro del buscador', () => {
  it('corta el consenso en la primera: no gasta las tres corridas', async () => {
    const { web, cuantasConsultas } = armar(MURO);

    await web.procesarUna();

    expect(cuantasConsultas()).toBe(1);
  }, 30_000);

  it('deja la consulta FALLIDA, no PENDIENTE para que la retomen', async () => {
    const { web, consulta } = armar(MURO);

    await web.procesarUna();

    expect(consulta.estado).toBe(EstadoConsultaRues.FALLIDA);
    expect(consulta.resueltaEn).not.toBeNull();
  }, 30_000);

  /// Lo de siempre tiene que seguir reintentandose: que Chrome no
  /// arranque una vez si se arregla solo al siguiente intento.
  it('un fallo normal si vuelve a PENDIENTE', async () => {
    const { web, consulta } = armar(CAIDA);

    await web.procesarUna();

    expect(consulta.estado).toBe('PENDIENTE');
    expect(consulta.resueltaEn).toBeNull();
  }, 30_000);
});
