import { TipoServicio } from '../../generated/prisma';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Lo que se corrige de un servicio desde el panel.
 *
 * La FAMILIA no está: mover un servicio de Educación a Empresas es otro
 * servicio, con otra oferta al público, y los negocios que ya lo llevan
 * cambiarían de familia sin que nadie los tocara.
 */
export class ActualizarServicioDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'El nombre del servicio es muy corto.' })
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsEnum(TipoServicio, { message: 'Elija un tipo válido.' })
  tipo?: TipoServicio;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Diga en qué se cuenta: licencia, equipo, curso…' })
  @MaxLength(30)
  unidad?: string;

  /// Oculto y no borrado: puede ser lo que se vendió en un negocio.
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}
