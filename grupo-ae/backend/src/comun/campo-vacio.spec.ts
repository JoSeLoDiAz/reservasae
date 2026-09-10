/** Un campo vacío no es un cero. */

/**
 * Este spec construye los DTO con las MISMAS opciones que
 * `main.ts` —`enableImplicitConversion: true`— y esa es toda la
 * razón de que exista. Con las opciones por defecto de
 * `plainToInstance` el defecto NO se reproduce: la conversión
 * implícita es la que convierte `''` en `0` antes de que corra
 * el `@Transform`, así que un test que no la active pasa en
 * verde mientras el servidor falla.
 *
 * Se descubrió en producción: el formulario público de
 * completar datos mandaba `municipioSepId: ''` —un campo que ni
 * pregunta ni enseña, porque ya se dio al reservar— y el
 * servidor contestaba «Ese municipio no pertenece a ese
 * departamento». La ficha quedaba imposible de terminar.
 */

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';

import { DatosPersonaDto } from '../preinscripcion/dto';
import { ActualizarParticipanteDto } from '../crm/dto';
import { motivoDeIdInvalido, municipioCuadra } from '../crm/catalogos-sep';

/// Las de `main.ts`, ni una más ni una menos.
const COMO_EN_PRODUCCION = { enableImplicitConversion: true };

function comoLlega<T>(clase: new () => T, cuerpo: Record<string, unknown>): T {
  return plainToInstance(clase, cuerpo, COMO_EN_PRODUCCION);
}

describe('la cadena vacía NO se convierte en cero', () => {
  it('en el formulario público de completar datos', () => {
    const dto = comoLlega(DatosPersonaDto, {
      departamentoSepId: '11',
      municipioSepId: '',
    });

    expect(dto.municipioSepId).toBeUndefined();
    expect(dto.departamentoSepId).toBe(11);
  });

  it('y en el panel, donde vaciar un desplegable SÍ borra', () => {
    /// Aquí `null` y no `undefined`, y la diferencia importa:
    /// `undefined` es «no lo mandé» y deja lo que hubiera;
    /// `null` es «quítalo». `motivoDeIdInvalido` depende de esa
    /// distinción para no rechazarse a sí mismo.
    const dto = comoLlega(ActualizarParticipanteDto, {
      departamentoSepId: '11',
      municipioSepId: '',
    });

    expect(dto.municipioSepId).toBeNull();
  });

  it('los espacios en blanco tampoco son un dato', () => {
    const dto = comoLlega(DatosPersonaDto, { municipioSepId: '   ' });
    expect(dto.municipioSepId).toBeUndefined();
  });

  it('un id de verdad sigue llegando entero', () => {
    const dto = comoLlega(DatosPersonaDto, {
      departamentoSepId: '11',
      municipioSepId: '11001',
    });
    expect(dto.municipioSepId).toBe(11001);
  });
});

describe('el cero era el problema, y por qué', () => {
  it('cero NO es un municipio, así que se rechazaría', () => {
    /// Esto es lo que veía el servidor antes del arreglo. No se
    /// prueba el arreglo: se prueba POR QUÉ hacía falta.
    expect(municipioCuadra(11, 0)).toBe(false);
  });

  it('vacío de verdad sí cuadra con cualquier departamento', () => {
    expect(municipioCuadra(11, undefined)).toBe(true);
    expect(municipioCuadra(11, null)).toBe(true);
  });
});

describe('el caso de producción, de punta a punta', () => {
  /// Tenía departamento 11 y municipio NULO en la base, y el
  /// formulario le devolvía el municipio como cadena vacía
  /// porque ni lo pregunta.
  const GUARDADO = { departamentoSepId: 11, municipioSepId: null };

  it('completar la ficha ya NO se rechaza a sí misma', () => {
    const dto = comoLlega(DatosPersonaDto, {
      departamentoSepId: '11',
      municipioSepId: '',
      barrio: 'San Vicente',
    });

    expect(motivoDeIdInvalido(dto, GUARDADO)).toBeNull();
  });

  it('y un municipio de otro departamento SÍ se sigue rechazando', () => {
    /// El arreglo no puede haber apagado la comprobación: 5001
    /// es Medellín y 11 es Bogotá.
    const dto = comoLlega(DatosPersonaDto, {
      departamentoSepId: '11',
      municipioSepId: '5001',
    });

    expect(motivoDeIdInvalido(dto, GUARDADO)).toMatch(/no pertenece/i);
  });
});
