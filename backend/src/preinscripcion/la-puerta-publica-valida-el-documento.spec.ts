/** La puerta pública valida el documento contra su tipo. */

/**
 * B-08, Y ERA LA ÚNICA PUERTA SIN ELLO.
 *
 * `normalizarDocumento` limpia y deja algo; comprobar que ese algo
 * PUEDA ser ese documento es otra cosa. Las otras siete puertas del
 * backend ya la hacían ---la carga masiva, el panel, la búsqueda, la
 * conversión de leads, el webhook---. La preinscripción pública no, y
 * es por la que entra MÁS gente.
 *
 * Una cédula con letras entraba por ahí y de ahí salía al cargue del
 * SENA, que es donde se descubre: tarde y en bloque.
 *
 * LO QUE NO PODÍA PASAR AL ARREGLARLO era dejar fuera al pasaporte. Una
 * regla «solo dígitos» a secas habría rechazado a quien se inscribe con
 * uno, que es gente real; por eso la validación mira el TIPO. Esa es la
 * mitad del arreglo y es lo que más se prueba aquí.
 */

import { documentoValido, normalizarDocumento } from '../comun/documento';
import { esDocumentoNumerico } from '../crm/catalogos-sep';

/**
 * LOS IDS DEL SEP, SACADOS DEL CATÁLOGO Y NO DE MEMORIA.
 *
 * Al escribir esto puse 4 para el pasaporte. El 4 es el «Permiso
 * Especial de Permanencia», que TAMBIÉN admite letras, así que el caso
 * pasaba en verde probando otra cosa. El pasaporte es el 41.
 *
 * Por eso el primer caso comprueba que cada uno sea lo que se cree que
 * es: un id equivocado aquí no falla, miente.
 */
const CC = 1;
const PASAPORTE = 41;

describe('qué tipos son numéricos', () => {
  /// Si estos dos dejaran de ser lo que son, los casos de abajo
  /// probarían otra cosa sin fallar.
  it('la cédula sí y el pasaporte no', () => {
    expect(esDocumentoNumerico(CC)).toBe(true);
    expect(esDocumentoNumerico(PASAPORTE)).toBe(false);
  });
});

describe('lo que ya no entra por la puerta pública', () => {
  it('una cédula con letras', () => {
    const d = normalizarDocumento('ABC123456');
    expect(d).toBeTruthy();
    /// Normalizaba bien ---devuelve algo--- y por eso pasaba: la puerta
    /// solo miraba que no viniera vacío.
    expect(documentoValido(CC, d as string)).toBe(false);
  });

  it('ni una demasiado corta', () => {
    expect(documentoValido(CC, '123')).toBe(false);
  });
});

describe('lo que SÍ sigue entrando', () => {
  it('una cédula normal', () => {
    expect(documentoValido(CC, '1020304050')).toBe(true);
  });

  /**
   * EL PASAPORTE, QUE ES LO QUE SE PODÍA ROMPER.
   *
   * Lleva letras por definición. Si la validación no mirara el tipo,
   * este arreglo habría cerrado la inscripción a los extranjeros para
   * tapar una cédula mal escrita.
   */
  it('y un pasaporte con sus letras', () => {
    expect(documentoValido(PASAPORTE, 'AX1234567')).toBe(true);
  });
});

describe('la comprobación está puesta en la puerta pública', () => {
  const fuente = () =>
    require('fs').readFileSync(
      require('path').join(__dirname, 'preinscripcion.service.ts'),
      'utf8',
    ) as string;

  it('el servicio la llama', () => {
    expect(fuente()).toContain(
      'if (!documentoValido(dto.tipoDocumentoSepId, documento)) {',
    );
  });

  /**
   * Y CON EL MISMO TEXTO QUE LAS DEMÁS: dos mensajes distintos para el
   * mismo error hacen pensar que son dos errores, y quien atiende el
   * teléfono acaba inventándose una explicación para cada uno.
   */
  it('con el mismo mensaje que las otras puertas', () => {
    const texto = 'El número de documento no tiene un formato válido para ese tipo.';
    expect(fuente()).toContain(texto);

    const crm = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'crm', 'crm.service.ts'),
      'utf8',
    ) as string;
    expect(crm).toContain(texto);
  });
});
