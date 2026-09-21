/** Lo facturado, tal como llega del panel. */

/**
 * Este spec arma el DTO con las MISMAS opciones que `main.ts`
 * —conversión implícita, lista blanca y rechazo de lo que sobra— y
 * esa es toda la razón de que exista, igual que
 * `comun/campo-vacio.spec.ts`.
 *
 * La trampa es la de siempre con los números: la conversión
 * implícita corre ANTES de validar y convierte la casilla vacía
 * —`''`— en `0`. En lo facturado eso no da un error: da un dato
 * falso. Vaciar la casilla para decir «todavía no se ha facturado»
 * guardaría «se facturó en cero», con esa frase en la bitácora y un
 * cero sumado al informe del mes. Un test que no active la
 * conversión pasa en verde mientras el servidor hace eso.
 */

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ActualizarOportunidadDto } from './dto';

/// Las de `main.ts`, ni una más ni una menos.
const COMO_EN_PRODUCCION = { enableImplicitConversion: true };
const VALIDAR_COMO_EN_PRODUCCION = {
  whitelist: true,
  forbidNonWhitelisted: true,
};

function comoLlega(cuerpo: Record<string, unknown>) {
  const dto = plainToInstance(
    ActualizarOportunidadDto,
    cuerpo,
    COMO_EN_PRODUCCION,
  );
  const errores = validateSync(dto, VALIDAR_COMO_EN_PRODUCCION).flatMap(
    (e) => Object.values(e.constraints ?? {}),
  );
  return { dto, errores };
}

describe('lo facturado, como llega del panel', () => {
  describe('vacío es «sin facturar», nunca cero', () => {
    it('la casilla vaciada llega como null, no como 0', () => {
      const { dto, errores } = comoLlega({ valorFacturado: '' });
      expect(dto.valorFacturado).toBeNull();
      expect(errores).toEqual([]);
    });

    it('los espacios en blanco tampoco son una cifra', () => {
      const { dto, errores } = comoLlega({ valorFacturado: '   ' });
      expect(dto.valorFacturado).toBeNull();
      expect(errores).toEqual([]);
    });

    it('null a propósito lo devuelve a «sin facturar»', () => {
      const { dto, errores } = comoLlega({ valorFacturado: null });
      expect(dto.valorFacturado).toBeNull();
      expect(errores).toEqual([]);
    });

    /// Omitirlo es «no lo toqué», que es otra cosa que quitarlo: el
    /// servicio deja lo que hubiera.
    it('sin mandarlo, queda como estaba', () => {
      const { dto, errores } = comoLlega({ titulo: 'Workspace para 40' });
      expect(dto.valorFacturado).toBeUndefined();
      expect(errores).toEqual([]);
    });
  });

  describe('lo que sí es una cifra', () => {
    it('un entero pasa tal cual', () => {
      const { dto, errores } = comoLlega({ valorFacturado: 11_900_000 });
      expect(dto.valorFacturado).toBe(11_900_000);
      expect(errores).toEqual([]);
    });

    it('escrito como texto, se lee como número', () => {
      const { dto, errores } = comoLlega({ valorFacturado: '11900000' });
      expect(dto.valorFacturado).toBe(11_900_000);
      expect(errores).toEqual([]);
    });

    /// El cero sí es un dato: se regaló la licencia para cerrar.
    it('el cero de verdad se queda en cero', () => {
      const { dto, errores } = comoLlega({ valorFacturado: 0 });
      expect(dto.valorFacturado).toBe(0);
      expect(errores).toEqual([]);
    });
  });

  describe('lo que no se puede guardar, dicho en español', () => {
    it('negativo, no', () => {
      const { errores } = comoLlega({ valorFacturado: -1 });
      expect(errores).toContain('El valor facturado no puede ser negativo.');
    });

    it('con centavos, no', () => {
      const { errores } = comoLlega({ valorFacturado: 1_000.5 });
      expect(errores).toContain(
        'El valor facturado va en pesos enteros, sin centavos.',
      );
    });

    it('texto que no es número, no', () => {
      const { errores } = comoLlega({ valorFacturado: 'once millones' });
      expect(errores).toContain(
        'El valor facturado va en pesos enteros, sin centavos.',
      );
    });

    /// Lo que no cabe en Decimal(14,2) lo rechazaría la base con un
    /// desbordamiento, y eso llega al panel como un 500 sin
    /// explicación. Aquí se para antes, diciendo qué revisar.
    it('más de lo que cabe en la columna, no', () => {
      const { errores } = comoLlega({ valorFacturado: 1_000_000_000_000 });
      expect(errores.join(' ')).toContain('ceros');
    });

    it('el tope exacto de la columna sí cabe', () => {
      const { errores } = comoLlega({ valorFacturado: 999_999_999_999 });
      expect(errores).toEqual([]);
    });
  });
});
