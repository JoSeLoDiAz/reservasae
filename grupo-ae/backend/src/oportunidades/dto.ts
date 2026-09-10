/** Lo que el panel puede mandar, y nada más. */

import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  EtapaOportunidad,
  MotivoCierre,
  TipoEmbudo,
} from '../../generated/prisma';

export class CrearOportunidadDto {
  @IsEnum(TipoEmbudo)
  embudo!: TipoEmbudo;

  @IsString()
  @MinLength(3, { message: 'Escriba qué se le está vendiendo.' })
  @MaxLength(160)
  titulo!: string;

  @IsString()
  convenioId!: string;

  /**
   * En pesos enteros.
   *
   * Entero y no decimal a propósito: en Colombia no se cotiza en
   * centavos, y admitir decimales aquí solo abre la puerta a que
   * lleguen redondeos distintos desde dos pantallas.
   */
  @IsOptional()
  @IsInt({ message: 'El valor va en pesos enteros.' })
  @Min(0)
  valor?: number;

  @IsOptional()
  @IsISO8601({}, { message: 'La fecha de cierre no tiene un formato válido.' })
  cierreEsperado?: string;

  @IsOptional() @IsString() asesorId?: string;
  @IsOptional() @IsString() personaId?: string;
  @IsOptional() @IsString() empresaId?: string;
  @IsOptional() @IsString() @MaxLength(120) campana?: string;
  @IsOptional() @IsString() leadId?: string;

  /// Crear ya avanzada se permite —a veces la venta llega hecha—
  /// pero pasa por las mismas compuertas que llegar paso a paso.
  @IsOptional()
  @IsEnum(EtapaOportunidad)
  etapa?: EtapaOportunidad;
}

export class CambiarEtapaDto {
  @IsEnum(EtapaOportunidad)
  a!: EtapaOportunidad;

  @IsOptional()
  @IsEnum(MotivoCierre)
  motivo?: MotivoCierre;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  nota?: string;
}
