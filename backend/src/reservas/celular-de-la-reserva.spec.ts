/** El celular de una reserva son diez dígitos. */

/**
 * Lo vio el cliente en producción: la ficha de una reserva
 * mostraba `30130480335`, once dígitos. El campo solo tenía
 * `@MaxLength(40)`, así que cabía cualquier cosa, y ese número
 * no sirve ni para llamar ni para el reporte.
 *
 * Se valida y se normaliza con la MISMA regla de las fichas
 * —`comun/celular.ts`—, y el spec construye el DTO con las
 * opciones de `main.ts`, que es lo único que reproduce lo que
 * de verdad llega por la puerta pública.
 */

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { CrearReservaDto } from './dto/crear-reserva.dto';

/// Las de `main.ts`, ni una más ni una menos.
const COMO_EN_PRODUCCION = { enableImplicitConversion: true };

const BASE = {
  ofertaId: 'of1',
  nit: '890123456',
  razonSocial: 'Instituto Musical',
  contactoNombre: 'Natalia Montes',
  contactoCorreo: 'natalia@ejemplo.test',
  cuposSolicitados: 40,
  aceptaTerminos: true,
  aceptaPoliticaDatos: true,
};

function comoLlega(celular?: unknown): CrearReservaDto {
  return plainToInstance(
    CrearReservaDto,
    { ...BASE, ...(celular === undefined ? {} : { contactoCelular: celular }) },
    COMO_EN_PRODUCCION,
  );
}

function fallaEnCelular(celular: unknown): boolean {
  return validateSync(comoLlega(celular)).some((e) => e.property === 'contactoCelular');
}

describe('el celular de la reserva', () => {
  it('rechaza el de once dígitos que entró en producción', () => {
    expect(fallaEnCelular('30130480335')).toBe(true);
  });

  it('rechaza uno corto y uno que no empieza por 3', () => {
    expect(fallaEnCelular('3013048')).toBe(true);
    expect(fallaEnCelular('6041234567')).toBe(true);
  });

  it('acepta el celular de diez dígitos', () => {
    expect(fallaEnCelular('3013048033')).toBe(false);
  });

  it('se queda con los diez, venga como venga', () => {
    /// Como llega pegado de una hoja de cálculo o del teclado
    /// del teléfono. En la base tiene que quedar igual que en
    /// las fichas, o el mismo número no se encuentra dos veces.
    expect(comoLlega('+57 301 304 8033').contactoCelular).toBe('3013048033');
    expect(comoLlega('573013048033').contactoCelular).toBe('3013048033');
    expect(comoLlega('301-304-8033').contactoCelular).toBe('3013048033');
  });

  it('sigue siendo opcional: sin celular la reserva pasa', () => {
    expect(fallaEnCelular(undefined)).toBe(false);
    expect(fallaEnCelular('')).toBe(false);
    expect(comoLlega('').contactoCelular).toBeUndefined();
  });
});
