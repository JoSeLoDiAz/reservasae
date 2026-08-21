import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/// "" del formulario vale como "no lo puso".
const aNumero = ({ value }: { value: unknown }) =>
  value === '' || value === null || value === undefined ? undefined : Number(value);

const aTexto = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : recortar({ value });

/** Lo mínimo para quedar registrado. */
export class CrearPreinscripcionDto {
  @IsString() @IsNotEmpty()
  ofertaId!: string;

  @Transform(({ value }) => Number(value)) @IsInt()
  tipoDocumentoSepId!: number;

  @Transform(recortar) @IsString() @IsNotEmpty() @MaxLength(30)
  numeroDocumento!: string;

  @Transform(recortar) @IsString() @IsNotEmpty() @MaxLength(60)
  primerNombre!: string;

  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(60)
  segundoNombre?: string;

  @Transform(recortar) @IsString() @IsNotEmpty() @MaxLength(60)
  primerApellido!: string;

  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(60)
  segundoApellido?: string;

  @IsOptional() @Transform(aNumero) @IsInt()
  generoSepId?: number;

  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(30)
  celular?: string;

  @IsOptional() @Transform(aTexto) @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  correo?: string;
}

/** El resto de sus datos, todos opcionales. */
export class DatosPersonaDto {
  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(60) primerNombre?: string;
  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(60) segundoNombre?: string;
  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(60) primerApellido?: string;
  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(60) segundoApellido?: string;
  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(30) celular?: string;

  @IsOptional() @Transform(aTexto)
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  correo?: string;

  @IsOptional() @Transform(aNumero) @IsInt() generoSepId?: number;
  @IsOptional() @Transform(aTexto) @IsISO8601() fechaNacimiento?: string;

  @IsOptional() @Transform(aNumero) @IsInt() @Min(1) @Max(6) estrato?: number;

  @IsOptional() @Transform(aNumero) @IsInt() departamentoSepId?: number;
  @IsOptional() @Transform(aNumero) @IsInt() municipioSepId?: number;

  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(120) barrio?: string;
  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(200) direccion?: string;
  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(120) nivelEducativo?: string;
  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(120) cargoEnEmpresa?: string;

  /** Aceptar la politica: es lo que hay que demostrar. */
  @IsOptional() @IsBoolean() aceptaPolitica?: boolean;
}

/** Lo que el F7 pide de la organización. */
export class DatosEmpresaDto {
  // solo de quien no vino por una reserva: la suya ya la
  // fijo la empresa que lo nomino y no la cambia el
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(20) nit?: string;
  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(1) digitoVerificacion?: string;
  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(200) razonSocial?: string;

  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(200) direccion?: string;
  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(40) telefono?: string;

  @IsOptional() @Transform(aNumero) @IsInt() departamentoSepId?: number;
  @IsOptional() @Transform(aNumero) @IsInt() municipioSepId?: number;

  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(120) sectorEconomico?: string;

  @IsOptional() @Transform(aNumero) @IsInt() @Min(1) numeroTrabajadores?: number;

  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(120) contactoNombre?: string;
  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(120) contactoCargo?: string;

  @IsOptional() @Transform(aTexto)
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  contactoCorreo?: string;
}
