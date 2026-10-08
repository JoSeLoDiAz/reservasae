/** La regla del cliente sobre los repetidos, en los dos sentidos. */

/**
 * «Complete lo que no tiene datos y los que estén diferentes como
 * la alerta cuando lo volvieron a llenar» (cliente, 5 oct 2026).
 *
 * Las dos mitades fallan de formas distintas y las dos sin ruido:
 *
 *   - Si NO se rellenaran los huecos, el cargue no serviría para
 *     nada: su razón de ser es que el lead que entró por una pauta
 *     sin cédula tenga por fin la cédula que el cliente sí tiene.
 *     Y el informe diría «ya estaban», que suena a que todo está
 *     bien.
 *
 *   - Si se pisara lo distinto, un cargue borraría lo que un asesor
 *     corrigió por teléfono. Eso no se ve: la pantalla enseña un
 *     número limpio y lo que había ya no está para compararlo. Es
 *     el mismo defecto que se cerró en la preinscripción, donde
 *     cuatro campos se escribían por encima del candado del asesor
 *     y la respuesta decía «quedó en espera».
 */

import {
  repartirLaFila,
  comoSeCuentanLosChoquesDelCargue,
} from './reparto-de-la-fila';
import type { DatosDeLaFila } from './datos-de-la-fila';

function trae(parcial: Partial<DatosDeLaFila>): DatosDeLaFila {
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
    fechaNacimiento: null,
    estrato: null,
    barrio: null,
    direccion: null,
    cargoEnEmpresa: null,
    nivelOcupacionalSepId: null,
    beneficiarioPrevio: null,
    ...parcial,
  };
}

describe('lo que está vacío se rellena', () => {
  it('el lead sin cédula se queda con la del archivo', () => {
    /// Es EL caso: el lead entró por una pauta con el celular y
    /// nada más, y la base del cliente le tiene la cédula.
    const r = repartirLaFila(
      trae({ tipoDocumentoSepId: 1, numeroDocumento: '1020304050' }),
      {
        celular: '3001112222',
        numeroDocumento: null,
        tipoDocumentoSepId: null,
      },
    );

    expect(r.huecos).toEqual({
      tipoDocumentoSepId: 1,
      numeroDocumento: '1020304050',
    });
    expect(r.choques).toEqual([]);
  });

  it('una cadena en blanco guardada cuenta como vacía', () => {
    /// `null`, `undefined` y «   » son lo mismo aquí: las tres
    /// significan que nadie lo ha dicho todavía. Si «» contara
    /// como un valor, el correo del archivo saldría como un choque
    /// y habría que decidir a mano lo que no hay que decidir.
    const r = repartirLaFila(trae({ correo: 'ana@correo.com' }), {
      correo: '   ',
    });

    expect(r.huecos).toEqual({ correo: 'ana@correo.com' });
  });

  it('los huecos se dicen en castellano, para poder enseñarlos', () => {
    const r = repartirLaFila(
      trae({ tipoDocumentoSepId: 1, numeroDocumento: '1020304050' }),
      {},
    );

    /// «tipoDocumentoSepId» no es castellano, y la pantalla lo
    /// pinta tal cual si no se traduce aquí.
    expect(r.rellena).toEqual(['tipo de documento', 'número de documento']);
  });
});

describe('lo que está distinto NO se pisa', () => {
  it('el celular corregido por el asesor se queda, y el del archivo se cuenta', () => {
    const r = repartirLaFila(trae({ celular: '3009998888' }), {
      celular: '3001112222',
    });

    expect(r.huecos).toEqual({});
    expect(r.choques).toEqual([
      {
        campo: 'celular',
        comoSeLlama: 'celular',
        dice: '3009998888',
        guardado: '3001112222',
      },
    ]);
  });

  it('lo que llega IGUAL no es un choque ni se escribe', () => {
    /// Avisar de eso llenaría la mesa de notas cada vez que se
    /// recarga el mismo archivo, que es el caso normal: se sube,
    /// se revisa, se vuelve a subir.
    const r = repartirLaFila(trae({ correo: 'ana@correo.com' }), {
      correo: 'ana@correo.com',
    });

    expect(r.huecos).toEqual({});
    expect(r.choques).toEqual([]);
  });

  it('lo que el archivo NO trae no rellena ni choca', () => {
    /// Esto es lo que hace el cargue no restrictivo de verdad: una
    /// base con la mitad de las columnas vacías no propone vaciar
    /// media mesa de entrada. Es la misma regla 3 del cargue de
    /// empresas: «una celda vacía nunca borra».
    const r = repartirLaFila(trae({}), {
      correo: 'ana@correo.com',
      celular: '3001112222',
      numeroDocumento: '1020304050',
    });

    expect(r.huecos).toEqual({});
    expect(r.choques).toEqual([]);
  });

  it('la constancia lleva los DOS valores delante', () => {
    /// Con solo los nombres de campo, el asesor tiene que abrir el
    /// archivo del cliente para saber qué decía ---y ese archivo no
    /// va a estar ahí dentro de dos semanas---. Con los dos
    /// números, llama y resuelve en la misma llamada.
    const r = repartirLaFila(
      trae({ celular: '3009998888', correo: 'otra@correo.com' }),
      { celular: '3001112222', correo: 'ana@correo.com' },
    );

    const linea = comoSeCuentanLosChoquesDelCargue(r.choques);
    expect(linea).toContain('3009998888');
    expect(linea).toContain('3001112222');
    expect(linea).toMatch(/el archivo dice/);
  });
});
