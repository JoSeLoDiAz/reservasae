/** Lo que el panel puede cambiar de los parámetros, y nada más. */

import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { EtapaOportunidad, TipoEmbudo } from '../../generated/prisma';

/**
 * Los umbrales.
 *
 * TODOS LLEVAN TECHO, y no por manía de validar: un ANS de cien mil
 * minutos no es un compromiso, es apagar la alarma sin que se note
 * en la pantalla. El techo obliga a que apagarla sea una decisión
 * visible.
 */
export class ActualizarParametrosDto {
  /// Hasta una semana. Más que eso no es un compromiso de primera
  /// respuesta, es otra cosa.
  @IsOptional()
  @IsInt({ message: 'Los minutos de respuesta van en número entero.' })
  @Min(1, { message: 'El compromiso no puede ser de cero minutos.' })
  @Max(10080, { message: 'El compromiso no puede pasar de una semana.' })
  ansPersonaMinutos?: number;

  @IsOptional()
  @IsInt({ message: 'Los minutos de respuesta van en número entero.' })
  @Min(1, { message: 'El compromiso no puede ser de cero minutos.' })
  @Max(10080, { message: 'El compromiso no puede pasar de una semana.' })
  ansEmpresaMinutos?: number;

  /// Al menos dos: con una sola gestión, «lo trabajamos y no se
  /// mueve» no se sostiene.
  @IsOptional()
  @IsInt({ message: 'Las gestiones van en número entero.' })
  @Min(2, { message: 'Con una sola gestión no se puede hablar de bananeo.' })
  @Max(50)
  bananeoPersona?: number;

  @IsOptional()
  @IsInt({ message: 'Las gestiones van en número entero.' })
  @Min(2, { message: 'Con una sola gestión no se puede hablar de bananeo.' })
  @Max(50)
  bananeoEmpresa?: number;

  @IsOptional()
  @IsInt({ message: 'Los días van en número entero.' })
  @Min(1, { message: 'Un día es el mínimo para llamar fría a una oportunidad.' })
  @Max(365)
  diasParaFria?: number;
}

/** La probabilidad de una etapa dentro de un embudo. */
export class ActualizarProbabilidadDto {
  @IsEnum(TipoEmbudo, { message: 'Diga de qué embudo es la etapa.' })
  embudo!: TipoEmbudo;

  @IsEnum(EtapaOportunidad, { message: 'Esa etapa no existe.' })
  etapa!: EtapaOportunidad;

  @IsInt({ message: 'La probabilidad va en número entero.' })
  @Min(0, { message: 'La probabilidad va de 0 a 100.' })
  @Max(100, { message: 'La probabilidad va de 0 a 100.' })
  porcentaje!: number;
}
