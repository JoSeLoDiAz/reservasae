/** Arreglar un lead a mano normaliza igual que el webhook. */

/**
 * DOS PUERTAS AL MISMO CAMPO CON DOS REGLAS.
 *
 * El webhook (`leads.service.ts`, `limpiar`) pasa el correo y el
 * celular por `correoValido`/`normalizarCorreo` y
 * `celularValido`/`normalizarCelular`. Esta pantalla los
 * escribía tal cual --`correo: dto.correo`-- y es la que MÁS se
 * teclea: existe precisamente para completar a mano el lead al
 * que le faltaban los datos.
 *
 * Lo que costaba, y por qué no se veía:
 *
 *  - Un celular escrito «+57 300 111 2222» dejaba de cruzar con
 *    Gestión de leads PARA SIEMPRE, porque `cruzar-con-el-crm.ts`
 *    compara el número exacto contra lo que la ficha tiene ya
 *    normalizado. No hay error ni aviso: simplemente no encuentra
 *    a nadie, que es indistinguible de «esta persona es nueva».
 *  - Un «no tiene» se guardaba como correo, y de ahí viaja al
 *    reporte del SEP y tapa la compuerta de «hay alguna forma de
 *    contactarla».
 */

import { BadRequestException } from '@nestjs/common';

import { MesaDeEntrada } from './mesa-de-entrada.service';

const PENDIENTE = {
  id: 'l1',
  convenioId: 'c-ade',
  estado: 'PENDIENTE',
  participanteId: null,
  tipoDocumentoSepId: 1,
  numeroDocumento: '1020304050',
  primerNombre: 'Ana',
  segundoNombre: null,
  primerApellido: 'Jaramillo',
  segundoApellido: null,
  nombreCompleto: 'Ana Jaramillo',
  departamentoSepId: null,
  municipioSepId: null,
  correo: null,
  celular: null,
};

function armar() {
  const guardados: Array<Record<string, unknown>> = [];

  const prisma = {
    leadEntrante: {
      findFirst: () => Promise.resolve(PENDIENTE),
      findUnique: () => Promise.resolve(PENDIENTE),
      update: ({ data }: { data: Record<string, unknown> }) => {
        guardados.push(data);
        return Promise.resolve({ id: 'l1' });
      },
    },
    accionFormacion: { findFirst: () => Promise.resolve({ id: 'af1' }) },
  };

  const s = new MesaDeEntrada(
    prisma as never,
    { cualesRevocaron: () => Promise.resolve(new Set<string>()) } as never,
    /// Esa cédula no es de nadie más: el caso normal, y el cruce
    /// tiene su propio spec.
    { mirar: () => Promise.resolve({ que: 'NO_ESTA' }) } as never,
  );

  return { s, guardados };
}

describe('el celular se guarda normalizado, como en el webhook', () => {
  it('«+57 300 111 2222» se guarda como «3001112222»', async () => {
    /// Si se guarda con el indicativo y los espacios, el cruce
    /// contra Gestión de leads no lo encuentra nunca: compara
    /// exacto contra lo que la ficha tiene ya limpio.
    const { s, guardados } = armar();

    await s.arreglar('l1', { celular: '+57 300 111 2222' }, ['c-ade']);

    expect(guardados[0].celular).toBe('3001112222');
  });

  it('un celular que no es un celular se rechaza y no se guarda', async () => {
    /// Aquí SÍ se rechaza, al contrario que en el webhook, y es a
    /// propósito: allí hay un lead pagado en juego y perderlo es
    /// peor que guardarlo cojo; aquí hay alguien delante del
    /// formulario que puede corregirlo en el momento. Es lo mismo
    /// que ya hace el documento en este método.
    const { s, guardados } = armar();

    await expect(
      s.arreglar('l1', { celular: 'no tiene' }, ['c-ade']),
    ).rejects.toThrow(BadRequestException);
    expect(guardados).toEqual([]);
  });

  it('vacío lo BORRA: puede no ser el número de esa persona', async () => {
    const { s, guardados } = armar();

    await s.arreglar('l1', { celular: '' }, ['c-ade']);

    expect(guardados[0].celular).toBeNull();
  });
});

describe('el correo se guarda normalizado, como en el webhook', () => {
  it('se recorta y se baja a minúsculas', async () => {
    /// Dos escrituras del mismo correo que difieren en una
    /// mayúscula son dos personas para cualquier comparación por
    /// igualdad, y el CRM compara por igualdad.
    const { s, guardados } = armar();

    await s.arreglar('l1', { correo: '  Ana@Ejemplo.TEST ' }, ['c-ade']);

    expect(guardados[0].correo).toBe('ana@ejemplo.test');
  });

  it('«no tiene» no es un correo y no entra', async () => {
    /// Es lo que de verdad se guardaba, y de ahí viaja al reporte
    /// del SEP como dato de contacto.
    const { s, guardados } = armar();

    await expect(
      s.arreglar('l1', { correo: 'no tiene' }, ['c-ade']),
    ).rejects.toThrow(BadRequestException);
    expect(guardados).toEqual([]);
  });
});

describe('lo que no se manda no se toca', () => {
  it('sin correo ni celular en el cuerpo, no se escriben', async () => {
    /// `undefined` es «no lo cambies» y no «bórralo»: el asesor
    /// que corrige solo el apellido no puede perder el celular
    /// que costó una llamada conseguir.
    const { s, guardados } = armar();

    await s.arreglar('l1', { primerApellido: 'Jaramillo Ruiz' }, ['c-ade']);

    expect(guardados[0].correo).toBeUndefined();
    expect(guardados[0].celular).toBeUndefined();
  });
});
