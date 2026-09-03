/** El banco de NIT: autocompletar y dar de alta. */

import { BadRequestException, Injectable } from '@nestjs/common';

import type { FuenteDato } from '../../generated/prisma';
import { calcularDigitoVerificacion, leerNit } from '../comun/nit';
import { PrismaService } from '../prisma/prisma.service';

export type InstitucionDelBanco = {
  id: string;
  nit: string;
  razonSocial: string;
  /// Solo cuando la fuente declara uno distinto al de la
  /// DIAN. Sirve para avisar, nunca para usarlo.
  digitoDeclarado: string | null;
  fuente: FuenteDato;
};

export type BusquedaNit = {
  nit: string;
  /// El de la DIAN, que es el que vale.
  digitoVerificacion: string;
  digitoTecleado: string | null;
  digitoCuadra: boolean;
  /// Vacío cuando el NIT no está en el banco.
  instituciones: InstitucionDelBanco[];
  /// Verdadero si el NIT ampara a varias: hay que elegir.
  agrupaVarias: boolean;
};

@Injectable()
export class DirectorioService {
  constructor(private readonly prisma: PrismaService) {}

  /** Qué instituciones hay bajo ese NIT. */
  async buscar(valor: string): Promise<BusquedaNit> {
    const lectura = leerNit(valor);
    if (!lectura) throw new BadRequestException('El NIT no tiene forma de NIT.');

    const filas = await this.prisma.institucion.findMany({
      where: { nit: lectura.nit, activo: true },
      orderBy: { razonSocial: 'asc' },
      select: {
        id: true,
        nit: true,
        razonSocial: true,
        digitoDeclarado: true,
        fuente: true,
      },
    });

    // el declarado solo se muestra si difiere del real
    const instituciones = filas.map((f) => ({
      ...f,
      digitoDeclarado:
        f.digitoDeclarado && f.digitoDeclarado !== lectura.digitoVerificacion
          ? f.digitoDeclarado
          : null,
    }));

    return {
      nit: lectura.nit,
      digitoVerificacion: lectura.digitoVerificacion,
      digitoTecleado: lectura.digitoTecleado,
      digitoCuadra: lectura.digitoCuadra,
      instituciones,
      agrupaVarias: instituciones.length > 1,
    };
  }

  /// Cuando el NIT existe pero con otra razón social, o no
  /// está. No se rechaza: se guarda como alta manual y
  /// queda marcada por su fuente para poder revisarla.
  async agregarManual(
    valor: string,
    razonSocial: string,
  ): Promise<InstitucionDelBanco> {
    const lectura = leerNit(valor);
    if (!lectura) throw new BadRequestException('El NIT no tiene forma de NIT.');

    const nombre = razonSocial.trim().replace(/\s+/g, ' ');
    if (nombre.length < 3) {
      throw new BadRequestException('La razón social es demasiado corta.');
    }

    const fila = await this.prisma.institucion.upsert({
      /// Por NIT, no por (nit, nombre).
      ///
      /// Con la llave vieja, escribir un nombre distinto para el
      /// mismo NIT CREABA OTRA FILA -- y asi es como el SENA
      /// acababa siendo «SENA» y «SENA REGIONAL ANTIOQUIA» a la
      /// vez. Un NIT es una organizacion: lo que la persona
      /// escribe CORRIGE el nombre, no anade una segunda.
      where: { nit: lectura.nit },
      update: { activo: true, razonSocial: nombre },
      create: {
        nit: lectura.nit,
        razonSocial: nombre,
        digitoDeclarado: lectura.digitoVerificacion,
        // la escribio una persona, no una fuente oficial:
        // el RUES puede corregirla despues
        fuente: 'HUMANO',
        fuentePorCampo: { razonSocial: 'HUMANO' },
      },
      select: {
        id: true,
        nit: true,
        razonSocial: true,
        digitoDeclarado: true,
        fuente: true,
      },
    });

    return { ...fila, digitoDeclarado: null };
  }

  /** El DV, para no pedírselo a nadie. */
  digitoDe(nit: string): string {
    return calcularDigitoVerificacion(nit);
  }
}
