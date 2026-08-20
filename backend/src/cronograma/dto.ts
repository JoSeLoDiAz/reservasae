import { Transform } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

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

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  horario?: string;

  // el que le asigna el SENA, para el reporte
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? null : Number(value)))
  @ValidateIf((_o: unknown, v: unknown) => v !== null)
  @IsInt()
  sepGrupoId?: number | null;
}
