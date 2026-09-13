import { plainToInstance } from 'class-transformer';

import { aCelularGuardable } from './celular';
import { CrearParticipanteDto } from '../crm/dto';

/**
 * El mismo numero, escrito de las tres formas que de verdad
 * conviven en `personas` de produccion.
 *
 * El DTO se construye con las MISMAS opciones que `main.ts`, no
 * con las de por defecto: es la leccion que este repositorio ya
 * tiene escrita del campo vacio que llegaba como cero.
 */
const COMO_EN_MAIN = { enableImplicitConversion: true } as const;

function porElDto(celular: string): string | undefined {
  const dto = plainToInstance(
    CrearParticipanteDto,
    { tipoDocumentoSepId: 1, numeroDocumento: '123', primerNombre: 'A', primerApellido: 'B', celular },
    COMO_EN_MAIN,
  );
  return dto.celular;
}

describe('el celular se guarda de una sola forma', () => {
  it('las tres grafias que conviven hoy quedan iguales', () => {
    expect(aCelularGuardable('+57 300 111 2222')).toBe('3001112222');
    expect(aCelularGuardable('+573001112222')).toBe('3001112222');
    expect(aCelularGuardable('3001112222')).toBe('3001112222');
  });

  it('y tambien con guiones y parentesis', () => {
    expect(aCelularGuardable('(300) 111-2222')).toBe('3001112222');
    expect(aCelularGuardable('57-300-111-2222')).toBe('3001112222');
  });

  /// La regla de la casa: el celular avisa, no bloquea. Un «no
  /// tiene» tecleado se conserva para que el asesor lo vea y lo
  /// corrija; vaciarlo seria decidir por el que ahi no habia nada.
  it('lo que no es un movil se conserva tal cual', () => {
    expect(aCelularGuardable('no tiene')).toBe('no tiene');
    expect(aCelularGuardable('  601 2345678  ')).toBe('601 2345678');
    expect(aCelularGuardable('')).toBe('');
  });

  it('lo que no es texto no se toca', () => {
    expect(aCelularGuardable(undefined)).toBeUndefined();
    expect(aCelularGuardable(null)).toBeNull();
  });

  /// Lo que de verdad importa: que pase por la PUERTA, no solo
  /// que la funcion pura acierte. Es donde fallaba.
  it('el DTO del panel lo normaliza antes de llegar al servicio', () => {
    expect(porElDto('+57 300 111 2222')).toBe('3001112222');
    expect(porElDto('3001112222')).toBe('3001112222');
  });

  it('y el DTO no destruye lo que no es un movil', () => {
    expect(porElDto('no tiene')).toBe('no tiene');
  });
});
