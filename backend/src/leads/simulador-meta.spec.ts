import { avisosDeLead, firmaDeMeta } from './meta';
import { esDePrueba, simularAviso } from './simulador-meta';

/// Lo que cuidan estas pruebas: que el simulador sea de
/// verdad un simulador. Si arma un cuerpo parecido al de Meta
/// pero no igual, pasar la prueba no significa nada -- se
/// habría probado un lector aproximado con un cuerpo
/// aproximado, y el dia de la conexion real falla igual.
///
/// Por eso todas cierran el circulo: lo que sale del
/// simulador entra por las MISMAS funciones que atienden a
/// Meta.

const SECRETO = 'secreto-de-prueba';
const AHORA = 1_756_000_000_000;

describe('el cuerpo que arma es el que Meta manda', () => {
  it('nuestro propio lector lo entiende', () => {
    const s = simularAviso({ cuantos: 1, ahora: AHORA }, SECRETO)!;
    const avisos = avisosDeLead(JSON.parse(s.cuerpo));
    expect(avisos).toHaveLength(1);
    expect(avisos[0].leadgenId).toBe(s.leadgenIds[0]);
  });

  it('la fecha va en SEGUNDOS, como la manda Meta', () => {
    // si aqui se mandaran milisegundos, el x1000 del backend
    // los llevaria al año 57000 y la prueba pasaria igual
    const s = simularAviso({ cuantos: 1, ahora: AHORA }, SECRETO)!;
    const avisos = avisosDeLead(JSON.parse(s.cuerpo));
    expect(avisos[0].creadoEn?.getTime()).toBe(AHORA);
  });

  it('trae el anuncio, que es lo que deja medir la pauta', () => {
    const s = simularAviso({ cuantos: 1, ahora: AHORA }, SECRETO)!;
    expect(avisosDeLead(JSON.parse(s.cuerpo))[0].anuncioId).toBeTruthy();
  });
});

describe('varios en un mismo POST, que es como agrupa Meta', () => {
  it('los tres llegan', () => {
    // quedarse con el primero y perder los demas es el fallo
    // que nadie nota hasta que faltan leads
    const s = simularAviso({ cuantos: 3, ahora: AHORA }, SECRETO)!;
    expect(avisosDeLead(JSON.parse(s.cuerpo))).toHaveLength(3);
  });

  it('con identificadores distintos', () => {
    const s = simularAviso({ cuantos: 3, ahora: AHORA }, SECRETO)!;
    expect(new Set(s.leadgenIds).size).toBe(3);
  });

  it('no se puede pedir un lote absurdo', () => {
    const s = simularAviso({ cuantos: 5000, ahora: AHORA }, SECRETO)!;
    expect(s.leadgenIds.length).toBeLessThanOrEqual(10);
  });

  it('ni cero: uno es el minimo util', () => {
    const s = simularAviso({ cuantos: 0, ahora: AHORA }, SECRETO)!;
    expect(s.leadgenIds).toHaveLength(1);
  });
});

describe('la firma, que es lo que de verdad se esta probando', () => {
  it('nuestro verificador la acepta', () => {
    const s = simularAviso({ cuantos: 1, ahora: AHORA }, SECRETO)!;
    expect(
      firmaDeMeta(Buffer.from(s.cuerpo, 'utf8'), s.firma, SECRETO),
    ).toBe(true);
  });

  it('con otro secreto NO', () => {
    const s = simularAviso({ cuantos: 1, ahora: AHORA }, SECRETO)!;
    expect(
      firmaDeMeta(Buffer.from(s.cuerpo, 'utf8'), s.firma, 'otro'),
    ).toBe(false);
  });

  it('si se toca un byte del cuerpo, deja de valer', () => {
    // esto es lo que prueba que la firma va sobre el cuerpo
    // CRUDO y no sobre el objeto vuelto a serializar
    const s = simularAviso({ cuantos: 1, ahora: AHORA }, SECRETO)!;
    const tocado = s.cuerpo.replace('"page"', '"pagex"');
    expect(firmaDeMeta(Buffer.from(tocado, 'utf8'), s.firma, SECRETO)).toBe(
      false,
    );
  });

  it('sin secreto no se inventa una firma: se dice que no se pudo', () => {
    // devolver una firma inventada haria que la prueba fallara
    // con «firma invalida», que es cierto y no es el problema
    expect(simularAviso({ cuantos: 1, ahora: AHORA }, undefined)).toBeNull();
  });
});

describe('se ve a un metro que el lead es inventado', () => {
  it('los que arma el simulador se reconocen', () => {
    const s = simularAviso({ cuantos: 1, ahora: AHORA }, SECRETO)!;
    expect(esDePrueba(s.leadgenIds[0])).toBe(true);
  });

  it('uno de Meta de verdad, no', () => {
    // asi nadie llama a un telefono que no existe
    expect(esDePrueba('1234567890123456')).toBe(false);
  });
});
