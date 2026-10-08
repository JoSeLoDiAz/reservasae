/** Un cargue de un gremio no puede tragarse los leads del otro. */

/**
 * EL DEFECTO QUE ESTO PARA, CONTADO COMO SE VERÍA.
 *
 * `AF1` existe en ADECOPRIA ---neuroeducación--- y en BRITCHAM
 * ---agentes autónomos---: son cursos distintos con el mismo
 * código. Hasta el 5 oct 2026 la llave del lead no llevaba el
 * gremio, así que la misma cédula pidiendo «AF1» daba
 * `doc:1-1020304050:AF1` en los dos convenios.
 *
 * Con esa llave, subir la base de BRITCHAM habría encontrado como
 * «ya estaba» a cada persona que coincidiera con ADECOPRIA: no se
 * crea nada, se le rellenan huecos al lead del OTRO gremio, y el
 * informe dice «ya estaban». Que es exactamente lo que uno espera
 * leer al recargar un archivo, así que nadie lo habría buscado:
 * los leads del segundo gremio no existirían y la pantalla no
 * tendría nada raro que enseñar.
 *
 * Se prueba el OLVIDO, no la función. `llaveDelLead` ya tiene su
 * spec; lo que aquí puede romperse es que alguien forme la llave
 * del cargue sin pasar el convenio, que es un cambio de una línea
 * que compila y no falla ninguna otra prueba.
 */

import { llaveDeLaFila, ORIGEN_DEL_CARGUE } from './llave-de-la-fila';
import type { DatosDeLaFila } from './datos-de-la-fila';

function fila(parcial: Partial<DatosDeLaFila>): DatosDeLaFila {
  return {
    nombreCompleto: null,
    primerNombre: null,
    segundoNombre: null,
    primerApellido: null,
    segundoApellido: null,
    correo: null,
    celular: null,
    tipoDocumentoSepId: null,
    numeroDocumento: null,
    interes: null,
    accionFormacionId: null,
    departamentoSepId: null,
    municipioSepId: null,
    generoSepId: null,
    ...parcial,
  };
}

/// Solo para leer la llave en las pruebas: si la fila no se puede
/// reconocer, eso es otro caso y tiene su propio spec.
function llaveDe(
  datos: DatosDeLaFila,
  codigo: string | null,
  convenio: string,
) {
  const l = llaveDeLaFila(datos, codigo, convenio);
  if ('falta' in l) throw new Error(`no se formó la llave: ${l.falta}`);
  return l;
}

describe('la llave del cargue lleva el gremio', () => {
  it('la misma cédula pidiendo AF1 en dos gremios da dos llaves', () => {
    const quien = fila({
      tipoDocumentoSepId: 1,
      numeroDocumento: '1020304050',
    });

    const a = llaveDe(quien, 'AF1', 'conv-adecopria');
    const b = llaveDe(quien, 'AF1', 'conv-britcham');

    expect(a.llave).not.toBe(b.llave);
    /// Y el gremio va DELANTE del documento, que es donde lo puso
    /// el arreglo: así se lee de un golpe de qué convenio es la
    /// llave al mirar la columna en la base.
    expect(a.llave).toContain('conv-adecopria');
    expect(b.llave).toContain('conv-britcham');
  });

  it('también cuando la fila no trae documento y la llave sale del contenido', () => {
    /// Es la mitad que se olvida: dos leads con el mismo correo,
    /// celular y nombre en gremios distintos también daban la
    /// misma llave, y ahí el choque lo daba el único de la base
    /// ---un 500---.
    const quien = fila({ correo: 'ana@correo.com', celular: '3001112222' });

    expect(llaveDe(quien, null, 'conv-adecopria').llave).not.toBe(
      llaveDe(quien, null, 'conv-britcham').llave,
    );
  });

  it('se sigue devolviendo la llave de ANTES, para reconocer lo ya guardado', () => {
    /// Esta llave se GUARDA en `LeadEntrante.externoId`. Los leads
    /// que ya están llevan la forma vieja ---sin gremio--- así que
    /// buscar solo por la nueva no encontraría ninguno y el primer
    /// cargue duplicaría a toda la base que entró por la pauta.
    const a = llaveDe(
      fila({ tipoDocumentoSepId: 1, numeroDocumento: '1020304050' }),
      'AF1',
      'conv-adecopria',
    );

    expect(a.anterior).toBe('doc:1-1020304050:AF1');
  });

  it('el mismo documento en dos cursos son dos leads, que es lo correcto', () => {
    /// Quien pide AF1 y después AF2 se inscribe en dos cosas. Con
    /// la cédula sola, la segunda petición volvería como «repetido»
    /// y se perdería en silencio.
    const quien = fila({
      tipoDocumentoSepId: 1,
      numeroDocumento: '1020304050',
    });

    expect(llaveDe(quien, 'AF1', 'conv-adecopria').llave).not.toBe(
      llaveDe(quien, 'AF2', 'conv-adecopria').llave,
    );
  });
});

describe('el origen separa el cargue de la pauta', () => {
  it('no es «meta»', () => {
    /// Va en `origenSistema`, que es la columna que la mesa ya
    /// enseña como `porDonde`. Mezclarlos haría que el coste por
    /// inscrito de una campaña contara gente que nunca vio un
    /// anuncio.
    expect(ORIGEN_DEL_CARGUE).not.toBe('meta');
    expect(ORIGEN_DEL_CARGUE).toBe('cargue-masivo');
  });
});
