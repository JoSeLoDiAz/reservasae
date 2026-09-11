/** El embudo sale de lo que el formulario pregunta. */

import { CampoNucleo, TipoEmbudo } from '../../generated/prisma';
import { embudoDelFormulario, pideElNit } from './embudo-del-formulario';

describe('a qué embudo entra un formulario', () => {
  it('el que pregunta el NIT es de empresas', () => {
    const campos = [
      CampoNucleo.EMPRESA_NIT,
      CampoNucleo.EMPRESA_RAZON_SOCIAL,
      CampoNucleo.CONTACTO_NOMBRE,
    ];
    expect(embudoDelFormulario(campos)).toBe(TipoEmbudo.EMPRESA);
    expect(pideElNit(campos)).toBe(true);
  });

  it('el que solo pide contacto es de personas', () => {
    const campos = [
      CampoNucleo.CONTACTO_NOMBRE,
      CampoNucleo.CONTACTO_CORREO,
      CampoNucleo.CONTACTO_CELULAR,
    ];
    expect(embudoDelFormulario(campos)).toBe(TipoEmbudo.PERSONA);
  });

  /**
   * El aserto que protege de la corrección ingenua —«también la
   * razón social suena a empresa»—. Sin NIT no hay a quién colgarle
   * el negocio: este sistema guarda una organización por NIT, y esa
   * es la llave con la que después se deduplica. Un formulario que
   * pregunta dónde trabaja usted capta personas, no empresas.
   */
  it('preguntar dónde trabaja no lo convierte en un formulario de empresas', () => {
    const campos = [
      CampoNucleo.CONTACTO_NOMBRE,
      CampoNucleo.EMPRESA_RAZON_SOCIAL,
      CampoNucleo.EMPRESA_COLABORADORES,
    ];
    expect(embudoDelFormulario(campos)).toBe(TipoEmbudo.PERSONA);
    expect(pideElNit(campos)).toBe(false);
  });

  /// Las preguntas libres no llevan campo del núcleo, y son la
  /// mayoría de un formulario: no pueden decidir el embudo.
  it('las preguntas sin núcleo no dicen nada', () => {
    expect(embudoDelFormulario([null, null, null])).toBe(TipoEmbudo.PERSONA);
    expect(embudoDelFormulario([])).toBe(TipoEmbudo.PERSONA);
  });
});
