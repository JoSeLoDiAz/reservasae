import { Transform } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class EditarReservaDto {
  /** El NIT de la empresa dueña. */
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  @Transform(recortar)
  nit!: string;

  // 0 no se admite: bajar a cero es cancelar
  @IsInt()
  @Min(1)
  @Max(500)
  cuposSolicitados!: number;
}

export class CancelarReservaDto {
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  @Transform(recortar)
  nit!: string;
}

export class ConsultarReservasDto {
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  @Transform(recortar)
  nit!: string;
}
