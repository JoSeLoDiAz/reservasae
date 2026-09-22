/** Una variable de UNA ficha no cabe en una campaña. */

/// `{{enlace}}` es un token de un solo uso por persona, y en
/// una campaña `valoresDe` lo devuelve nulo SIEMPRE. Dejándola
/// pasar, la campaña sale, la regla 1 omite al cien por cien de
/// la lista, y en cada fila queda escrito «le faltan datos» —
/// que manda a buscar el defecto a fichas que están completas.
/// Y una campaña que no sale no se descubre hasta que alguien
/// pregunta por qué nadie contestó.

import { BadRequestException } from '@nestjs/common';

import { CampanasService } from './campanas.service';
import {
  VARIABLES,
  VARIABLES_DE_CAMPANA,
  valoresDe,
} from '../plantillas/variables';

/// `revisarTexto` es privada a propósito: se llama por el
/// camino de verdad, que es crear una campaña.
const revisar = (asunto: string, cuerpo: string) =>
  (
    CampanasService.prototype as unknown as {
      revisarTexto(a: string, c: string): void;
    }
  ).revisarTexto(asunto, cuerpo);

describe('el catálogo de una campaña', () => {
  it('no ofrece las que solo se pueden llenar en una ficha', () => {
    expect(VARIABLES_DE_CAMPANA.map((v) => v.clave)).not.toContain('enlace');
  });

  it('y las demás siguen ahí', () => {
    const claves = VARIABLES_DE_CAMPANA.map((v) => v.clave);

    expect(claves).toContain('primerNombre');
    expect(claves).toContain('accionFormacion');
    expect(claves).toContain('donde');
    expect(claves.length).toBe(VARIABLES.length - 1);
  });
});

describe('escribir una campaña', () => {
  it('rechaza {{enlace}} al ESCRIBIRLA, no al mandarla', () => {
    expect(() => revisar('Hola', 'Entra en {{enlace}}')).toThrow(
      BadRequestException,
    );
    expect(() => revisar('Hola', 'Entra en {{enlace}}')).toThrow(
      /desde su lead/i,
    );
  });

  it('también si viene en el asunto', () => {
    expect(() => revisar('Su enlace {{enlace}}', 'Hola')).toThrow(
      BadRequestException,
    );
  });

  it('una variable normal pasa', () => {
    expect(() => revisar('Hola', 'Hola {{primerNombre}}')).not.toThrow();
  });

  it('una inventada sigue dando el otro mensaje', () => {
    expect(() => revisar('Hola', '{{NOMBRE_PARTICIPANTE}}')).toThrow(
      /no existen/i,
    );
  });
});

describe('por qué nunca se podría llenar', () => {
  it('valoresDe deja el enlace en nulo, venga la ficha como venga', () => {
    const v = valoresDe({
      primerNombre: 'Camila',
      segundoNombre: null,
      primerApellido: 'Caro',
      segundoApellido: null,
      generoSepId: 2,
      numeroDocumento: '123',
      correo: 'c@x.co',
      celular: '3000000000',
      empresa: 'ABC',
      accionFormacion: 'AF1',
      evento: 'CURSO',
      horas: 40,
      grupo: 1,
      fechaInicio: null,
      ubicacion: 'Medellín',
      modalidad: 'PRESENCIAL',
      asesor: 'Ana',
      gremio: 'ADECOPRIA',
      donde: 'Medellín',
      faltan: [],
    });

    expect(v.enlace).toBeNull();
  });
});
