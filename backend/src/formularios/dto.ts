import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateNested,
} from 'class-validator';

import { CampoNucleo, TipoPregunta } from '../../generated/prisma';
import { ColoresDeTema } from '../admin/dto';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearFormularioDto {
  @IsString()
  @MinLength(1)
  convenioId!: string;

  // va en la URL pública
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'El identificador solo admite minúsculas, números y guiones.',
  })
  @Transform(recortar)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(recortar)
  titulo!: string;
}

export class DuplicarFormularioDto {
  // va en la URL pública
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'El identificador solo admite minúsculas, números y guiones.',
  })
  @Transform(recortar)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(recortar)
  titulo!: string;
}

export class ActualizarFormularioDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) @Transform(recortar)
  titulo?: string;

  @IsOptional() @IsString() @MaxLength(1000) @Transform(recortar)
  descripcion?: string;

  @IsOptional() @IsString() @MaxLength(1000) @Transform(recortar)
  mensajeExito?: string;

  @IsOptional() @IsBoolean()
  publicado?: boolean;
}

/** Solo los colores que sobreescribe. */
export class ActualizarAparienciaDto {
  @IsOptional()
  @Validate(ColoresDeTema)
  coloresClaro?: Record<string, string> | null;

  @IsOptional()
  @Validate(ColoresDeTema)
  coloresOscuro?: Record<string, string> | null;
}

export class SeccionDto {
  @IsString() @MinLength(1) @MaxLength(200) @Transform(recortar)
  titulo!: string;

  @IsOptional() @IsString() @MaxLength(1000) @Transform(recortar)
  descripcion?: string;
}

export class CrearPreguntaDto {
  @IsOptional() @IsString()
  seccionId?: string;

  @IsString() @MinLength(1) @MaxLength(300) @Transform(recortar)
  etiqueta!: string;

  @IsEnum(TipoPregunta)
  tipo!: TipoPregunta;

  /** Ata la pregunta a una columna real de la reserva. */
  @IsOptional() @IsEnum(CampoNucleo)
  campoNucleo?: CampoNucleo;
}

export class ActualizarPreguntaDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300) @Transform(recortar)
  etiqueta?: string;

  @IsOptional() @IsString() @MaxLength(1000) @Transform(recortar)
  ayuda?: string;

  @IsOptional() @IsString() @MaxLength(200) @Transform(recortar)
  marcador?: string;

  @IsOptional() @IsEnum(TipoPregunta)
  tipo?: TipoPregunta;

  @IsOptional() @IsBoolean()
  obligatoria?: boolean;

  @IsOptional() @IsString()
  seccionId?: string;

  @IsOptional() @IsInt() @Min(-1_000_000) @Max(1_000_000)
  minimo?: number | null;

  @IsOptional() @IsInt() @Min(-1_000_000) @Max(1_000_000)
  maximo?: number | null;

  @IsOptional() @IsInt() @Min(0) @Max(10_000)
  largoMinimo?: number | null;

  @IsOptional() @IsInt() @Min(1) @Max(10_000)
  largoMaximo?: number | null;

  @IsOptional() @IsString()
  dependeDePreguntaId?: string | null;

  @IsOptional() @IsString() @MaxLength(200)
  dependeDeValor?: string | null;

  @IsOptional() @IsBoolean()
  archivada?: boolean;
}

export class OpcionDto {
  @IsString() @MinLength(1) @MaxLength(200) @Transform(recortar)
  etiqueta!: string;

  @IsOptional() @IsString() @MaxLength(200) @Transform(recortar)
  valor?: string;
}

export class ActualizarOpcionDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) @Transform(recortar)
  etiqueta?: string;

  @IsOptional() @IsBoolean()
  archivada?: boolean;
}

/** La lista completa de ids, en orden. */
export class ReordenarDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids!: string[];
}

/** Respuesta a una pregunta propia. */
export class RespuestaDto {
  @IsString() @MinLength(1)
  preguntaId!: string;

  @IsOptional() @IsString() @MaxLength(5000) @Transform(recortar)
  texto?: string;

  @IsOptional() @IsInt() @Min(-1_000_000_000) @Max(1_000_000_000)
  numero?: number;

  @IsOptional() @IsBoolean()
  booleano?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  seleccion?: string[];
}

export class RespuestasDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RespuestaDto)
  respuestas?: RespuestaDto[];
}
