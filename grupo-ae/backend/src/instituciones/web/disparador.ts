/** Disparo de la validación al inscribir un participante. */

/// Regla acordada: cuando un participante tiene los 3 datos de contacto
/// (persona de contacto, cargo y correo), pasa a "Empresas registradas" y
/// se dispara la búsqueda. Si es NIT (empresa) va a la cola; si es RUT
/// (persona natural) migra con reglas fijas, sin búsqueda web.
///
/// Los tres datos NO viven en el participante: viven en su Empresa
/// (`contactoNombre` / `contactoCargo` / `contactoCorreo`), que es donde
/// el F7 los pide. La cadena real del modelo es:
///
///     Participante --empresaId--> Empresa --institucionId--> Institucion
///
/// La Institucion es la ficha maestra (el banco de empresas únicas): es a
/// ella a la que apuntan ConsultaRues y PropuestaInstitucion.

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { pareceNitDeEmpresa } from '../../comun/nit';
import {
  DEPARTAMENTO_POR_ID,
  MUNICIPIO_POR_ID,
  TIPO_DOCUMENTO_POR_ID,
} from '../../crm/catalogos-sep';
import { PrismaService } from '../../prisma/prisma.service';
import { propuestaDeRut } from './rut';
import { WebService } from './web.service';

/**
 * Persona natural (no se busca en la web) vs empresa (a la cola).
 *
 * La decisión sale de la bandera `empresa` del catálogo del SEP, no de un
 * id clavado: N.I.T., N.I.S. y R.U.T. identifican una organización; la
 * cédula y sus parientes, a una persona. Ojo con el nombre: aquí «RUT» es
 * el tipo 21 del SEP, que el catálogo marca como documento de empresa. El
 * independiente del que habla el negocio NO llega con ese tipo: llega con
 * su cédula, que es la que le hace de RUT (ver `comun/nit.ts`).
 *
 * Cuando no hay tipo —fichas viejas, cargadas antes de que la columna
 * existiera— se cae al número: nueve dígitos que empiezan en 8 o 9 es una
 * empresa. `pareceNitDeEmpresa` solo sirve de respaldo, nunca para
 * rechazar (hay NIT viejos que no siguen la regla), y aquí ese es
 * exactamente su papel.
 */
export function esPersonaNatural(
  tipoDocumentoSepId: number | null | undefined,
  numeroDocumento?: string | null,
): boolean {
  if (tipoDocumentoSepId !== null && tipoDocumentoSepId !== undefined) {
    const tipo = TIPO_DOCUMENTO_POR_ID.get(tipoDocumentoSepId);
    if (tipo) return !tipo.empresa;
  }
  return !pareceNitDeEmpresa((numeroDocumento ?? '').trim());
}

export type ResultadoInscripcion = 'ENCOLADO' | 'RUT_PROPUESTO';

/// Lo que hace falta de la Empresa. Aparte para que el `select` de Prisma
/// y el tipo no se puedan separar.
const EMPRESA = {
  id: true,
  nit: true,
  digitoVerificacion: true,
  razonSocial: true,
  institucionId: true,
  tipoDocumentoSepId: true,
  direccion: true,
  telefono: true,
  sectorEconomico: true,
  departamentoSepId: true,
  municipioSepId: true,
  contactoNombre: true,
  contactoCargo: true,
  contactoCorreo: true,
} as const;

type EmpresaDelDisparo = {
  id: string;
  nit: string;
  digitoVerificacion: string | null;
  razonSocial: string;
  institucionId: string | null;
  tipoDocumentoSepId: number | null;
  direccion: string | null;
  telefono: string | null;
  sectorEconomico: string | null;
  departamentoSepId: number | null;
  municipioSepId: number | null;
  contactoNombre: string | null;
  contactoCargo: string | null;
  contactoCorreo: string | null;
};

@Injectable()
export class DisparadorInscripcion {
  constructor(
    private readonly prisma: PrismaService,
    private readonly web: WebService,
  ) {}

  /**
   * Llamar cuando un participante pasa a "inscrito".
   *
   * Devuelve qué se hizo: 'ENCOLADO' (empresa, a la cola) o
   * 'RUT_PROPUESTO' (persona natural, propuesta directa). Lanza
   * BadRequestException si faltan los 3 datos de contacto.
   */
  async alInscribir(participanteId: string): Promise<ResultadoInscripcion> {
    const participante = await this.prisma.participante.findUnique({
      where: { id: participanteId },
      select: { id: true, empresa: { select: EMPRESA } },
    });

    if (!participante) throw new NotFoundException('Ese participante ya no existe.');

    const empresa = participante.empresa;
    if (!empresa) {
      throw new BadRequestException(
        'Para inscribir hay que decir en qué empresa trabaja la persona.',
      );
    }

    if (
      !empresa.contactoNombre?.trim() ||
      !empresa.contactoCargo?.trim() ||
      !empresa.contactoCorreo?.trim()
    ) {
      throw new BadRequestException(
        'Para inscribir se requieren persona de contacto, cargo y correo de la empresa.',
      );
    }

    // La ficha maestra a la que se le van a proponer los datos.
    const institucionId = await this.fichaMaestra(empresa);

    if (esPersonaNatural(empresa.tipoDocumentoSepId, empresa.nit)) {
      await this.proponerRut(empresa, institucionId);
      return 'RUT_PROPUESTO';
    }

    // NIT: a la cola. El dedup por NIT / banco único lo hace encolar().
    await this.web.encolar(institucionId, 100);
    return 'ENCOLADO';
  }

  /// La Empresa es el registro del CRM; la Institucion es la ficha
  /// maestra del banco. El enlace es opcional en el esquema, así que
  /// cuando falta se resuelve por (nit, razonSocial) —la misma clave
  /// única que usa el alta manual del directorio— y se deja amarrado.
  private async fichaMaestra(empresa: EmpresaDelDisparo): Promise<string> {
    if (empresa.institucionId) return empresa.institucionId;

    const razonSocial = empresa.razonSocial.trim().replace(/\s+/g, ' ');
    const ficha = await this.prisma.institucion.upsert({
      /// Por NIT: un NIT es una organizacion. Con la llave vieja
      /// esto creaba una segunda ficha cada vez que la razon
      /// social llegaba escrita de otra forma.
      ///
      /// Y NO se pisa el nombre aqui: este camino viene del CRM,
      /// no de una fuente oficial, y el directorio ya puede tener
      /// uno mejor --verificado o del RUES--. Solo se marca
      /// activa.
      where: { nit: empresa.nit },
      update: { activo: true },
      create: {
        nit: empresa.nit,
        razonSocial,
        digitoDeclarado: empresa.digitoVerificacion,
        // viene del CRM, no de una fuente oficial
        fuente: 'CARGA',
        fuentePorCampo: { razonSocial: 'CARGA' },
      },
      select: { id: true },
    });

    await this.prisma.empresa.update({
      where: { id: empresa.id },
      data: { institucionId: ficha.id },
    });

    return ficha.id;
  }

  /// Persona natural: no se busca en la web. Se propone con las reglas
  /// fijas y los datos que ya tiene el CRM.
  private async proponerRut(
    empresa: EmpresaDelDisparo,
    institucionId: string,
  ): Promise<void> {
    // Empleados = # de registros con ese mismo documento. El NIT de la
    // Empresa es único, así que sus participantes son justo esos.
    const registros = await this.prisma.participante.count({
      where: { empresaId: empresa.id },
    });

    const campos = propuestaDeRut({
      nombre: empresa.razonSocial,
      ciudadNombre: nombreDeMunicipio(empresa.municipioSepId),
      correo: empresa.contactoCorreo,
      telefono: empresa.telefono,
      direccion: empresa.direccion,
      sectorEconomico: empresa.sectorEconomico,
      registros,
    });

    // El departamento del SEP es el bueno: pisa al derivado de la ciudad,
    // cuya tabla solo cubre las capitales.
    const departamento = nombreDeDepartamento(empresa.departamentoSepId);
    if (departamento) campos.departamentoNombre = departamento;

    if (Object.keys(campos).length === 0) return;

    // No dejar dos propuestas WEB pendientes del mismo destino.
    await this.prisma.propuestaInstitucion.deleteMany({
      where: { institucionId, fuente: 'WEB', estado: 'PENDIENTE' },
    });
    await this.prisma.propuestaInstitucion.create({
      data: { institucionId, fuente: 'WEB', campos },
    });
  }
}

/// El catálogo los guarda en mayúscula sostenida («MEDELLÍN»); la ficha
/// los muestra como nombre propio.
function nombreDeMunicipio(id: number | null | undefined): string | null {
  if (id === null || id === undefined) return null;
  return aNombrePropio(MUNICIPIO_POR_ID.get(id)?.[2]);
}

function nombreDeDepartamento(id: number | null | undefined): string | null {
  if (id === null || id === undefined) return null;
  return aNombrePropio(DEPARTAMENTO_POR_ID.get(id)?.etiqueta);
}

/// Las partículas van en minúscula salvo al principio: el catálogo dice
/// «VALLE DEL CAUCA» y la ficha muestra «Valle del Cauca».
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);

function aNombrePropio(texto: string | undefined): string | null {
  if (!texto) return null;
  const bajo = texto.toLocaleLowerCase('es-CO');
  return bajo.replace(/(^|[\s(])(\p{L}[\p{L}\p{M}]*)/gu, (_, antes: string, palabra: string) => {
    if (antes !== '' && PARTICULAS.has(palabra)) return antes + palabra;
    return antes + palabra.charAt(0).toLocaleUpperCase('es-CO') + palabra.slice(1);
  });
}
