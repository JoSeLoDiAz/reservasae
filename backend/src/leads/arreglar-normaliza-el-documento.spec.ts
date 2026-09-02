/** Componer un lead a mano no puede crear una cédula distinta. */

/**
 * Este spec mira el `data` que sale hacia Prisma, no el
 * resultado. Es lo único que distingue «se guardó el documento
 * normalizado» de «se guardó lo que el asesor tecleó».
 *
 * El agujero es real y ya se cerró una vez en otra puerta: la
 * preinscripción pública hacía `.trim()` a secas y creaba dos
 * `Persona` para el mismo ser humano, porque el `@@unique` de
 * `(tipoDocumentoSepId, numeroDocumento)` compara TEXTO y
 * «1.020.304.050» no es «1020304050».
 *
 * `PATCH /admin/leads/:id` nació con el mismo `@Transform(recortar)`
 * del DTO, que solo quita espacios. Y es la puerta donde más se
 * teclea con puntos, porque es justo donde se compone a mano el
 * lead al que le FALTABA el documento.
 */

import { BadRequestException } from '@nestjs/common';

import { MesaDeEntrada } from './mesa-de-entrada.service';

function armar() {
  const escrituras: { data?: Record<string, unknown> }[] = [];

  const prisma = {
    leadEntrante: {
      /// El lead existe, está en el ámbito y sigue PENDIENTE:
      /// las tres guardas que `arreglar` comprueba antes.
      findFirst: () =>
        Promise.resolve({
          id: 'lead-1',
          convenioId: 'c1',
          estado: 'PENDIENTE',
          participanteId: null,
        }),
      /// `arreglar` relee el domicilio guardado para juzgar el par
      /// departamento/municipio COMO QUEDARÁ, no como llegó. Sin
      /// este doble el método revienta antes de llegar al update.
      findUnique: () =>
        Promise.resolve({ departamentoSepId: null, municipioSepId: null }),
      update: (a: { data?: Record<string, unknown> }) => {
        escrituras.push(a);
        return Promise.resolve({ id: 'lead-1' });
      },
    },
  };

  return { s: new MesaDeEntrada(prisma as never, {
    /// Nadie revoco: es el caso normal y la revocacion tiene su
    /// propio spec.
    cualesRevocaron: () => Promise.resolve(new Set<string>()),
    revoco: () => Promise.resolve(false),
  } as never), escrituras };
}

describe('arreglar un lead desde la mesa', () => {
  it('guarda la cédula sin puntos aunque se teclee con ellos', async () => {
    const { s, escrituras } = armar();

    await s.arreglar(
      'lead-1',
      { tipoDocumentoSepId: 1, numeroDocumento: '1.020.304.050' } as never,
      ['c1'],
    );

    expect(escrituras).toHaveLength(1);
    expect(escrituras[0].data?.numeroDocumento).toBe('1020304050');
  });

  it('quita también los espacios y los guiones, y sube a mayúsculas', async () => {
    const { s, escrituras } = armar();

    /// Pasaporte: alfanumérico, y el tipo lo admite.
    await s.arreglar(
      'lead-1',
      { tipoDocumentoSepId: 4, numeroDocumento: ' ab-12 345 ' } as never,
      ['c1'],
    );

    expect(escrituras[0].data?.numeroDocumento).toBe('AB12345');
  });

  it('no toca el documento cuando el asesor no lo manda', async () => {
    const { s, escrituras } = armar();

    await s.arreglar('lead-1', { primerNombre: 'Ana' } as never, ['c1']);

    /// `undefined` es lo que hace que Prisma NO escriba la
    /// columna. Un `null` la borraría, que es otra cosa.
    expect(escrituras[0].data?.numeroDocumento).toBeUndefined();
  });

  it('se niega si lo tecleado no tiene forma de documento', async () => {
    const { s, escrituras } = armar();

    await expect(
      s.arreglar('lead-1', { numeroDocumento: '...' } as never, ['c1']),
    ).rejects.toThrow(BadRequestException);

    /// Y no escribe nada: se niega ANTES del update.
    expect(escrituras).toHaveLength(0);
  });

  it('se niega si el número no sirve para ese tipo de documento', async () => {
    const { s, escrituras } = armar();

    /// Cédula (tipo numérico) con letras dentro.
    await expect(
      s.arreglar(
        'lead-1',
        { tipoDocumentoSepId: 1, numeroDocumento: 'AB12345' } as never,
        ['c1'],
      ),
    ).rejects.toThrow(BadRequestException);

    expect(escrituras).toHaveLength(0);
  });
});
