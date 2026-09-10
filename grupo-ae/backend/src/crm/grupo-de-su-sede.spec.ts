/** Nadie entra en un grupo de otra ciudad. */

/**
 * El fallo: la pantalla que ofrece los grupos al inscribir listaba los
 * de TODAS las ciudades donde se da el curso, y los dos sitios que
 * escriben el grupo comprobaban solo la acción de formación. Se podía
 * meter a alguien de Bogotá en el grupo de Atlántico, la ficha quedaba
 * con grupo, el tablero la contaba como lista, y el error aparecía el
 * día que la persona no llegaba al aula --o antes, en el cargue al
 * SENA, con un grupo de otra sede.
 *
 * La regla vive ahora en un solo sitio, `exigirCoberturaDeLaOferta`, y
 * la comprueban las dos puertas: `asignar` y `actualizar`.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';

import { exigirCoberturaDeLaOferta } from './cobertura';

const BOGOTA = 'ubi-bogota';
const ATLANTICO = 'ubi-atlantico';
const CURSO = 'af-1';

/// Un Prisma que solo sabe de coberturas.
function prismaCon(cobertura: Record<string, unknown> | null) {
  return {
    grupoCobertura: { findUnique: () => Promise.resolve(cobertura) },
  } as never;
}

const laDeBogota = {
  id: 'cob-bogota',
  ubicacionId: BOGOTA,
  ubicacion: { nombre: 'Bogotá D.C.' },
  grupo: { accionFormacionId: CURSO, numero: 1 },
};

describe('el grupo tiene que ser de la sede de la oferta', () => {
  it('el de su misma sede pasa, y devuelve su número', async () => {
    const r = await exigirCoberturaDeLaOferta(prismaCon(laDeBogota), 'cob-bogota', {
      accionFormacionId: CURSO,
      ubicacionId: BOGOTA,
    });

    expect(r.numero).toBe(1);
    expect(r.ubicacionId).toBe(BOGOTA);
  });

  /// El fallo que motiva todo esto.
  it('el de otra ciudad NO pasa, y el mensaje dice cuál es', async () => {
    await expect(
      exigirCoberturaDeLaOferta(prismaCon(laDeBogota), 'cob-bogota', {
        accionFormacionId: CURSO,
        ubicacionId: ATLANTICO,
      }),
    ).rejects.toThrow(/Bogotá D\.C\..*otra sede/);
  });

  it('el de otra acción de formación tampoco', async () => {
    await expect(
      exigirCoberturaDeLaOferta(prismaCon(laDeBogota), 'cob-bogota', {
        accionFormacionId: 'af-2',
        ubicacionId: BOGOTA,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('uno que no existe se distingue de uno que no cuadra', async () => {
    await expect(
      exigirCoberturaDeLaOferta(prismaCon(null), 'no-existe', {
        accionFormacionId: CURSO,
        ubicacionId: BOGOTA,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  /// Quien todavía no tiene oferta no tiene sede contra la que
  /// comparar. Se juzga solo la acción, que es lo que se hacía siempre:
  /// bloquear aquí dejaría sin grupo a fichas a medio llenar.
  it('sin oferta todavía, se juzga solo la acción', async () => {
    const r = await exigirCoberturaDeLaOferta(prismaCon(laDeBogota), 'cob-bogota', {
      accionFormacionId: CURSO,
      ubicacionId: null,
    });

    expect(r.numero).toBe(1);
  });

  it('y sin oferta, una acción distinta sigue sin pasar', async () => {
    await expect(
      exigirCoberturaDeLaOferta(prismaCon(laDeBogota), 'cob-bogota', {
        accionFormacionId: 'af-2',
        ubicacionId: null,
      }),
    ).rejects.toThrow(/otra acción/);
  });
});
