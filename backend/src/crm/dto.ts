import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  CanalAutorizacion,
  EtapaParticipante,
  OrigenParticipante,
  TipoDocumento,
} from '../../generated/prisma';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearParticipanteDto {
  @IsEnum(TipoDocumento)
  tipoDocumento!: TipoDocumento;

  @IsString()
  @IsNotEmpty()
  numeroDocumento!: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  primerNombre!: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  segundoNombre?: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  primerApellido!: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  segundoApellido?: string;

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sexo?: string;

  @IsOptional()
  @Transform(recortar)
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  correo?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(30)
  celular?: string;

  // a que convenio pertenece esta participacion
  @IsString()
  @IsNotEmpty()
  convenioId!: string;

  @IsOptional()
  @IsString()
  ofertaId?: string;

  @IsOptional()
  @IsString()
  reservaId?: string;

  @IsOptional()
  @IsEnum(OrigenParticipante)
  origen?: OrigenParticipante;

  @IsOptional()
  @IsString()
  asesorId?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(120)
  cargoEnEmpresa?: string;

  // pasarse del cupo exige decir por que
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  sobrecupoMotivo?: string;
}

export class ActualizarParticipanteDto {
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  primerNombre?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  segundoNombre?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  primerApellido?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  segundoApellido?: string;

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sexo?: string;

  @IsOptional()
  @Transform(recortar)
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  correo?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(30)
  celular?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(120)
  cargoEnEmpresa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nivelEducativo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nivelOcupacional?: string;

  @IsOptional()
  @IsString()
  asesorId?: string;

  @IsOptional()
  @IsString()
  coberturaId?: string;
}

export class CambiarEtapaDto {
  @IsEnum(EtapaParticipante)
  etapa!: EtapaParticipante;

  // obligatorio al perder o retirar, lo valida el servicio
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(300)
  motivo?: string;
}

export class CrearNotaDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  texto!: string;
}

export class FiltrosParticipantesDto {
  @IsOptional() @IsString() convenioId?: string;
  @IsOptional() @IsEnum(EtapaParticipante) etapa?: EtapaParticipante;
  @IsOptional() @IsString() accionFormacionId?: string;
  @IsOptional() @IsString() coberturaId?: string;
  @IsOptional() @IsString() grupoId?: string;
  @IsOptional() @IsString() asesorId?: string;
  @IsOptional() @IsString() buscar?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(400)
  pagina?: number;

  // el tablero reparte una sola pagina entre nueve
  // columnas: con 30 filas las columnas salen vacias
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(300)
  limite?: number;
}

export class AsignarFormacionDto {
  @IsString()
  @IsNotEmpty()
  ofertaId!: string;

  @IsOptional()
  @IsString()
  coberturaId?: string;

  // pasarse del cupo exige decir por que
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  sobrecupoMotivo?: string;
}

export class RegistrarAutorizacionDto {
  @IsEnum(CanalAutorizacion)
  canal!: CanalAutorizacion;

  /** Dónde quedó la prueba: acta, correo, archivo. */
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(300)
  evidencia?: string;
}

export class CargaDto {
  @IsString()
  @IsNotEmpty()
  convenioId!: string;

  @IsOptional()
  @IsString()
  ofertaId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200_000)
  texto!: string;

  /** Solo al confirmar: las líneas que se van a crear. */
  @IsOptional()
  lineas?: number[];
}
