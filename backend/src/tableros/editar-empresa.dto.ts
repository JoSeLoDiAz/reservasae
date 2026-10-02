/**
 * CORREGIR UNA ORGANIZACIÓN YA REGISTRADA, EL NIT INCLUIDO.
 *
 * «Al momento de ajustar o corregir un número de NIT no me lo permite,
 * afectándome un montón los datos de Gestión de leads, ya que esto va
 * asociado» (cliente, 28 sep 2026).
 *
 * Hasta hoy «Empresas registradas» era de solo lectura: un NIT mal
 * digitado se quedaba mal para siempre, y con él las reservas y los
 * leads que cuelgan de esa organización.
 *
 * POR QUÉ SE PUEDE CAMBIAR EL NIT SIN ROMPER NADA. Lo comprobé antes
 * de escribir una línea: NADIE apunta a una empresa por su NIT.
 * `Reserva` y `Participante` la referencian por `empresaId`, que es un
 * cuid interno y no se toca. El NIT es un dato único, no la llave de
 * las relaciones. Por eso corregirlo arrastra a los leads consigo en
 * vez de dejarlos huérfanos: siguen apuntando a la misma fila.
 *
 * LO QUE NO SE MANDA NO SE TOCA. Prisma trata `undefined` como «deja
 * lo que hay», así que corregir solo el NIT no borra el teléfono.
 */

import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { normalizarNit } from '../comun/nit';

/** Vacío es vacío: un campo que llega en blanco se borra. */
const aNuloOTexto = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

const aNumeroONulo = ({ value }: { value: unknown }): number | null =>
  value === '' || value === null || value === undefined ? null : Number(value);

/// El NIT se guarda en dígitos y nada más. Van con tipo de retorno
/// declarado a propósito: sin él, `value` sale como `any` del
/// decorador y el linter marca el retorno como inseguro, con razón.
/**
 * EL NIT, CON LA REGLA ÚNICA DE LA CASA.
 *
 * Era `replace(/\D/g, '')`. Con «890.982.209-4» daba «8909822094»,
 * que es el NIT con su dígito pegado: el control anti-fusión de
 * `tableros.service.ts` buscaba esa llave, no la encontraba ---la
 * real es «890982209»--- y el `update` RENOMBRABA la fila a la
 * pegada. El control estaba bien escrito y miraba la llave
 * equivocada, así que no se disparaba nunca.
 *
 * `normalizarNit` parte el dígito pegado desde el 30 sep 2026. Esta
 * era una de las tres puertas que no la llamaban; lo localizó una
 * auditoría del 2 oct.
 *
 * Si no tiene forma de NIT se deja el valor tal cual y lo rechaza la
 * validación de abajo, que da un mensaje mejor que un vacío.
 */
const soloDigitos = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? (normalizarNit(value)?.nit ?? value) : value;

const recortado = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class EditarEmpresaDto {
  /**
   * SOLO DÍGITOS, como en el resto del sistema.
   *
   * Se normaliza aquí y no se le pide a quien escribe: en un teclado
   * el NIT sale con puntos y guion la mitad de las veces, y guardar
   * «900.123.456-7» al lado de «9001234567» son dos organizaciones
   * distintas para la base y la misma para una persona.
   */
  @IsOptional()
  @Transform(soloDigitos)
  @IsString()
  @MinLength(5, { message: 'El NIT es demasiado corto para ser uno.' })
  @MaxLength(15, { message: 'El NIT es demasiado largo para ser uno.' })
  nit?: string;

  /// El dígito de verificación va aparte: no es parte del número.
  @IsOptional()
  @Transform(aNuloOTexto)
  @Matches(/^[0-9]$/, { message: 'El dígito de verificación es un solo número.' })
  digitoVerificacion?: string | null;

  @IsOptional()
  @Transform(recortado)
  @IsString()
  @MinLength(2, { message: 'La razón social no puede quedar vacía.' })
  @MaxLength(250)
  razonSocial?: string;

  @IsOptional()
  @Transform(aNuloOTexto)
  @IsString()
  @MaxLength(250)
  direccion?: string | null;

  @IsOptional()
  @Transform(aNuloOTexto)
  @IsString()
  @MaxLength(60)
  telefono?: string | null;

  @IsOptional()
  @Transform(aNuloOTexto)
  @IsString()
  @MaxLength(120)
  sectorEconomico?: string | null;

  @IsOptional()
  @Transform(aNuloOTexto)
  @IsString()
  @MaxLength(60)
  clasificacion?: string | null;

  @IsOptional()
  @Transform(aNuloOTexto)
  @IsString()
  @MaxLength(60)
  papelEnConvenio?: string | null;

  @IsOptional()
  @Transform(aNuloOTexto)
  @IsString()
  @MaxLength(60)
  redAsociada?: string | null;

  @IsOptional()
  @Transform(aNuloOTexto)
  @IsString()
  @MaxLength(120)
  redAsociadaOtra?: string | null;

  @IsOptional()
  @Transform(aNuloOTexto)
  @IsString()
  @MaxLength(160)
  contactoNombre?: string | null;

  @IsOptional()
  @Transform(aNuloOTexto)
  @IsString()
  @MaxLength(120)
  contactoCargo?: string | null;

  @IsOptional()
  @Transform(aNuloOTexto)
  @IsString()
  @MaxLength(160)
  contactoCorreo?: string | null;

  @IsOptional()
  @Transform(aNumeroONulo)
  @IsInt()
  @Min(0)
  numeroTrabajadores?: number | null;

  @IsOptional()
  @Transform(aNumeroONulo)
  @IsInt()
  @Min(0)
  numeroColaboradores?: number | null;

  /// Códigos DANE, como todo lo del SEP.
  @IsOptional()
  @Transform(aNumeroONulo)
  @IsInt()
  departamentoSepId?: number | null;

  @IsOptional()
  @Transform(aNumeroONulo)
  @IsInt()
  municipioSepId?: number | null;

  @IsOptional()
  @Transform(aNumeroONulo)
  @IsInt()
  tamanoSepId?: number | null;

  @IsOptional()
  @Transform(aNumeroONulo)
  @IsInt()
  tipoDocumentoSepId?: number | null;
}
