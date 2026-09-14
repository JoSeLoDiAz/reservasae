import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/// La misma que el CHECK de la base, para no discrepar.
const HORA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/// "" del formulario y null del botón de quitar valen lo mismo.
const aNuloOTexto = ({ value }: { value: unknown }) =>
  value === '' || value === null ? null : value;

/// Una sesion del grupo. Las reglas de verdad viven en
/// `sesiones.ts` y las aplica el servicio: aqui solo la forma.
export class SesionDto {
  @IsIn(['PRESENCIAL', 'SINCRONICA', 'PAT'])
  tipo!: 'PRESENCIAL' | 'SINCRONICA' | 'PAT';

  @IsOptional()
  @Transform(aNuloOTexto)
  @ValidateIf((_o: unknown, v: unknown) => v !== null)
  @IsISO8601()
  dia?: string | null;

  @Matches(HORA, { message: 'La hora de inicio va como HH:MM, de 00:00 a 23:59.' })
  horaInicio!: string;

  @Matches(HORA, { message: 'La hora de fin va como HH:MM, de 00:00 a 23:59.' })
  horaFin!: string;

  @IsOptional()
  @Transform(aNuloOTexto)
  @ValidateIf((_o: unknown, v: unknown) => v !== null)
  @IsString()
  ubicacionId?: string | null;
}

export class ActualizarGrupoDto {
  @IsOptional()
  @Transform(aNuloOTexto)
  @ValidateIf((_o: unknown, v: unknown) => v !== null)
  @IsISO8601()
  fechaInicio?: string | null;

  @IsOptional()
  @Transform(aNuloOTexto)
  @ValidateIf((_o: unknown, v: unknown) => v !== null)
  @IsISO8601()
  fechaFin?: string | null;

  /// Solo los dias: las horas viven en sus dos campos.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  dias?: string;

  /// Las sesiones que QUEDAN. No mandarlas es no tocarlas;
  /// mandar una lista vacia las borra todas.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SesionDto)
  sesiones?: SesionDto[];

  // el que le asigna el SENA, para el reporte
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? null : Number(value)))
  @ValidateIf((_o: unknown, v: unknown) => v !== null)
  @IsInt()
  sepGrupoId?: number | null;
}

/**
 * Los cupos de un grupo EN UNA UBICACIÓN.
 *
 * Se editan aquí y no en la oferta a propósito: `cuposBase` es lo
 * comprometido con el SENA por ese grupo en esa sede, y el tope de la
 * oferta sale de sumar los de todas sus coberturas. Al revés no se
 * puede repartir sin inventarse a quién le toca cada silla.
 */
/**
 * Los tres textos de «Información Acción de Formación».
 *
 * Se editan en el Catálogo y se leen en el formulario público detrás
 * de «Más información» (cliente, 13 sep 2026). Van juntos porque se
 * escriben de una sentada y salen en la misma ventana.
 *
 * 4.000 y no 1.200 como el resumen público: estos vienen del proyecto
 * y el objetivo de AF1 ya son 120 palabras.
 */
export class ActualizarInformacionDto {
  @IsOptional()
  @Transform(aNuloOTexto)
  @ValidateIf((_o: unknown, v: unknown) => v !== null)
  @IsString()
  @MaxLength(4000)
  objetivo?: string | null;

  @IsOptional()
  @Transform(aNuloOTexto)
  @ValidateIf((_o: unknown, v: unknown) => v !== null)
  @IsString()
  @MaxLength(4000)
  contenido?: string | null;

  @IsOptional()
  @Transform(aNuloOTexto)
  @ValidateIf((_o: unknown, v: unknown) => v !== null)
  @IsString()
  @MaxLength(4000)
  competencia?: string | null;
}

export class ActualizarCuposDto {
  /// Lo comprometido en el proyecto, sin sobrecupo.
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  cuposBase?: number;

  /// El tope duro, sobrecupo incluido. Nunca por debajo del base.
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  cuposMaximos?: number;
}
