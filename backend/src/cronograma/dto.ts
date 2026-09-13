import { Transform } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/// La misma que el CHECK de la base, para no discrepar.
const HORA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/// "" del formulario y null del botón de quitar valen lo mismo.
const aNuloOTexto = ({ value }: { value: unknown }) =>
  value === '' || value === null ? null : value;

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

  @IsOptional()
  @Transform(aNuloOTexto)
  @ValidateIf((_o: unknown, v: unknown) => v !== null)
  @Matches(HORA, { message: 'La hora de inicio va como HH:MM, de 00:00 a 23:59.' })
  horaInicio?: string | null;

  @IsOptional()
  @Transform(aNuloOTexto)
  @ValidateIf((_o: unknown, v: unknown) => v !== null)
  @Matches(HORA, { message: 'La hora de fin va como HH:MM, de 00:00 a 23:59.' })
  horaFin?: string | null;

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
