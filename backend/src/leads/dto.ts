/** Lo que el orquestador nos manda por cada lead. */

import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { OrigenParticipante } from '../../generated/prisma';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/// Los dos gremios, y nada mas.
const CONVENIOS = ['adecopria', 'britcham-adee'];

export class EntraLeadDto {
  /// De que gremio es. Explicito: no se adivina.
  @Transform(recortar)
  @IsString()
  @IsIn(CONVENIOS, {
    message: `El convenio tiene que ser uno de: ${CONVENIOS.join(', ')}.`,
  })
  convenio!: string;

  /// El id que le da QUIEN lo manda. Es la idempotencia.
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  externoId!: string;

  @IsOptional()
  @IsEnum(OrigenParticipante)
  origen?: OrigenParticipante;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200)
  nombreCompleto?: string;
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200)
  correo?: string;
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(40)
  celular?: string;

  @IsOptional() @IsInt() tipoDocumentoSepId?: number;
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(40)
  numeroDocumento?: string;

  /// Que dijo que le interesa, en sus palabras.
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(500)
  interes?: string;

  /**
   * El cuerpo original, si el emisor lo trae aparte.
   *
   * Sirve para que el orquestador nos pase lo que Meta le dio
   * sin tener que traducirlo entero. Si no viene, se guarda lo
   * que llegó.
   */
  @IsOptional()
  @IsObject()
  carga?: Record<string, unknown>;
}
