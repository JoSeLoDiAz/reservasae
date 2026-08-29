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

import { CanalAutorizacion, OrigenParticipante } from '../../generated/prisma';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/// Los dos gremios, y nada mas.
const CONVENIOS = ['adecopria', 'britcham-adee'];

export class EntraLeadDto {
  /**
   * De que gremio es. No hace falta si se llama al subdominio.
   *
   * Opcional porque `adecopria.reservasae.com` ya lo dice, y
   * repetirlo ahi seria pedir dos veces lo mismo. Si viene y NO
   * coincide con la direccion, el servicio lo rechaza: no se
   * elige uno de los dos en silencio.
   */
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @IsIn(CONVENIOS, {
    message: `El convenio tiene que ser uno de: ${CONVENIOS.join(', ')}.`,
  })
  convenio?: string;

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

/**
 * Convertir un lead en ficha. Lo hace un ASESOR, no el webhook.
 *
 * Un lead de un anuncio llenó un formulario de Facebook, no el
 * nuestro: no hay constancia de que autorizara el tratamiento de
 * sus datos. Convertirlo solo, y de paso consultarlo en el RUI
 * —un portal del Estado—, seria tratar sus datos sin nada que
 * demostrar. Por eso convertir es una acción de quien llamó, y
 * el canal de la autorización es OBLIGATORIO: pedirlo opcional
 * es no pedirlo.
 */
export class ConvertirLeadDto {
  /// Por donde lo autorizo. Casi siempre VERBAL_ASESOR.
  @IsEnum(CanalAutorizacion)
  canal!: CanalAutorizacion;

  /// Donde quedo la prueba: la llamada, el acta, el correo.
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  evidencia!: string;

  /// El tipo de documento, si el lead no lo trajo.
  @IsOptional() @IsInt() tipoDocumentoSepId?: number;

  /// El documento, si el lead no lo trajo o venia mal.
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(40)
  numeroDocumento?: string;
}
