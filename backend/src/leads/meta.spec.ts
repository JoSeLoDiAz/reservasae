import { createHmac } from 'node:crypto';

import {
  avisosDeLead,
  firmaDeMeta,
  respuestaDeVerificacion,
} from './meta';

/// Meta no se adapta a nadie. Si no se le contesta como
/// espera, apaga el webhook — y no avisa: simplemente dejan de
/// llegar leads pagados.

const SECRETO = 'un-secreto-de-pruebas-largo-y-aleatorio';

function firmar(cuerpo: string): string {
  return 'sha256=' + createHmac('sha256', SECRETO).update(cuerpo).digest('hex');
}

describe('la firma de Meta', () => {
  const cuerpo = '{"object":"page","entry":[]}';

  it('la buena pasa', () => {
    expect(
      firmaDeMeta(Buffer.from(cuerpo), firmar(cuerpo), SECRETO),
    ).toBe(true);
  });

  it('si cambia UN byte del cuerpo, no', () => {
    // por eso hace falta el cuerpo crudo: sobre el JSON
    // parseado y vuelto a serializar nunca cuadraría
    expect(
      firmaDeMeta(Buffer.from(cuerpo + ' '), firmar(cuerpo), SECRETO),
    ).toBe(false);
  });

  it('con otro secreto, no', () => {
    expect(firmaDeMeta(Buffer.from(cuerpo), firmar(cuerpo), 'otro')).toBe(
      false,
    );
  });

  it('sin cabecera, no', () => {
    expect(firmaDeMeta(Buffer.from(cuerpo), undefined, SECRETO)).toBe(false);
  });

  it('sin el prefijo sha256=, no', () => {
    const suelta = createHmac('sha256', SECRETO).update(cuerpo).digest('hex');
    expect(firmaDeMeta(Buffer.from(cuerpo), suelta, SECRETO)).toBe(false);
  });

  it('con un largo distinto no revienta: contesta false', () => {
    // timingSafeEqual lanza si los largos no coinciden
    expect(firmaDeMeta(Buffer.from(cuerpo), 'sha256=abcd', SECRETO)).toBe(
      false,
    );
  });

  it('sin secreto configurado, no', () => {
    expect(firmaDeMeta(Buffer.from(cuerpo), firmar(cuerpo), undefined)).toBe(
      false,
    );
  });
});

describe('leer lo que manda Meta', () => {
  const unAviso = {
    object: 'page',
    entry: [
      {
        id: '111',
        changes: [
          {
            field: 'leadgen',
            value: {
              leadgen_id: '999',
              form_id: '222',
              page_id: '111',
              ad_id: '333',
              created_time: 1787000000,
            },
          },
        ],
      },
    ],
  };

  it('saca el leadgen_id, que es lo único que Meta manda', () => {
    const r = avisosDeLead(unAviso);
    expect(r).toHaveLength(1);
    expect(r[0].leadgenId).toBe('999');
    expect(r[0].anuncioId).toBe('333');
  });

  it('la fecha viene en SEGUNDOS y se pasa a milisegundos', () => {
    // sin el x1000, todos los leads quedan en 1970
    expect(avisosDeLead(unAviso)[0].creadoEn?.getFullYear()).toBeGreaterThan(
      2020,
    );
  });

  it('un POST con VARIOS avisos los saca todos', () => {
    // Meta agrupa. Devolver solo el primero pierde los demás
    // en silencio, que es el fallo que nadie nota hasta que
    // faltan leads
    const dos = {
      entry: [
        { changes: [{ field: 'leadgen', value: { leadgen_id: 'a' } }] },
        { changes: [{ field: 'leadgen', value: { leadgen_id: 'b' } }] },
      ],
    };
    expect(avisosDeLead(dos).map((x) => x.leadgenId)).toEqual(['a', 'b']);
  });

  it('lo que no es leadgen se ignora sin ruido', () => {
    // por el mismo webhook llegan cambios de la página
    const otro = { entry: [{ changes: [{ field: 'feed', value: {} }] }] };
    expect(avisosDeLead(otro)).toEqual([]);
  });

  it('un aviso sin leadgen_id se descarta: no hay nada que pedir', () => {
    const sinId = { entry: [{ changes: [{ field: 'leadgen', value: {} }] }] };
    expect(avisosDeLead(sinId)).toEqual([]);
  });

  it('basura no revienta', () => {
    expect(avisosDeLead(null)).toEqual([]);
    expect(avisosDeLead({})).toEqual([]);
    expect(avisosDeLead({ entry: 'no soy una lista' })).toEqual([]);
  });
});

describe('la verificación, que es lo que enciende el webhook', () => {
  it('con el token bueno, devuelve el reto TAL CUAL', () => {
    expect(respuestaDeVerificacion('subscribe', 'abc', 'reto123', 'abc')).toBe(
      'reto123',
    );
  });

  it('con el token malo, nada', () => {
    expect(
      respuestaDeVerificacion('subscribe', 'otro', 'reto123', 'abc'),
    ).toBeNull();
  });

  it('sin modo subscribe, nada', () => {
    expect(
      respuestaDeVerificacion('unsubscribe', 'abc', 'reto123', 'abc'),
    ).toBeNull();
  });

  it('sin token configurado no se acepta a nadie', () => {
    // si no, cualquiera valida el webhook
    expect(
      respuestaDeVerificacion('subscribe', 'abc', 'reto', undefined),
    ).toBeNull();
  });
});
