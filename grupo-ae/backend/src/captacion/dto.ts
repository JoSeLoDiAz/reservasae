/** Lo que un desconocido puede mandar por el formulario. */

/**
 * Esta ruta es PÚBLICA: quien la llama no es una pantalla nuestra.
 * El DTO no es una comodidad de tipos, es la lista de lo único que
 * se acepta —`whitelist` + `forbidNonWhitelisted` en `main.ts`
 * rechazan el resto—, así que lo que NO está aquí es tan importante
 * como lo que sí:
 *
 *  - **No hay `convenioId`.** La línea de negocio sale del slug,
 *    resuelto contra la base. Aceptarlo aquí sería dejar que
 *    cualquiera meta oportunidades en la cuenta del otro gremio.
 *  - **No hay `valor`.** El dinero lo pone el asesor al calificar.
 *    Aceptarlo aquí pondría el pronóstico —la cifra con la que se
 *    dirige el mes— en manos de cualquiera con `curl`.
 *  - **No hay `etapa` ni `asesorId`.** Se nace en CAPTADO y sin
 *    dueño: eso es exactamente lo que mide el reloj de primera
 *    respuesta.
 *  - **No hay `embudo`.** Lo dice el formulario. Ver
 *    `embudo-del-formulario.ts`.
 */

import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { OrigenParticipante } from '../../generated/prisma';
import { booleanoDeVerdad } from '../comun/booleano-de-verdad';
import { aNumeroOAusente } from '../comun/campo-vacio';
import { RespuestaDto } from '../formularios/dto';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CaptarDto {
  // quién escribe

  /**
   * El nombre en una línea, tal como lo pregunta el constructor de
   * formularios en su campo `CONTACTO_NOMBRE`.
   *
   * Se guarda tal cual para la empresa y para la primera gestión.
   * Solo se parte en piezas si hay que crear una `Persona` y no
   * vinieron las piezas — ver `captacion.service.ts`.
   */
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nombre?: string;

  /**
   * El nombre en piezas. Si vienen, MANDAN sobre `nombre`.
   *
   * Partir «Ana María Ruiz Gómez» es adivinar —pueden ser dos
   * nombres y dos apellidos, o uno y tres— y quien llenó el
   * formulario sí lo sabía. Es la misma razón por la que
   * `LeadEntrante` guarda las cuatro por separado.
   */
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(80)
  primerNombre?: string;
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(80)
  segundoNombre?: string;
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(80)
  primerApellido?: string;
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(80)
  segundoApellido?: string;

  /**
   * El documento: la identidad en todo el sistema.
   *
   * `Persona` es única por `(tipoDocumentoSepId, numeroDocumento)`,
   * así que esto es lo que hace que la persona que escribe hoy y la
   * que ya estaba en el CRM sean una sola, y lo único contra lo que
   * se puede dejar la constancia de la Ley 1581 a su nombre.
   *
   * Opcional AQUÍ y exigido en el embudo de personas por el
   * servicio: en el de empresas el negocio es de la empresa —cuya
   * llave es el NIT— y pedirle la cédula a quien pide una cotización
   * para su compañía es un campo que cuesta leads y no compra nada.
   */
  @IsOptional()
  @Transform(aNumeroOAusente)
  @IsInt({ message: 'Elija un tipo de documento de la lista.' })
  tipoDocumentoSepId?: number;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(40)
  numeroDocumento?: string;

  // cómo responderle

  /// Sin `@IsEmail`: la forma del correo la juzga
  /// `hayComoResponder`, que es la que además decide si con lo que
  /// vino se puede captar. Con las dos reglas, un correo mal
  /// tecleado daría dos mensajes distintos según cuál saltara
  /// primero.
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

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(150)
  cargo?: string;

  // la empresa, cuando el formulario la pregunta

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(20)
  nit?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200)
  razonSocial?: string;

  // la casilla

  /**
   * El valor CRUDO, como en `leads/dto.ts` y en `reservas`.
   *
   * `enableImplicitConversion` convierte un campo `boolean` con la
   * regla de JavaScript: cualquier cadena no vacía es `true`, y
   * «false» llegaba como TRUE. Aquí es la constancia de que la
   * persona aceptó la política, y guardarla al revés le estampa una
   * autorización que NO dio.
   *
   * No lleva `@Equals(true)` a propósito: lo exige el servicio, que
   * es quien sabe si esta línea de negocio tiene texto publicado y
   * puede decir contra QUÉ versión se aceptó.
   */
  @IsOptional()
  @Transform(({ obj, key }) =>
    booleanoDeVerdad((obj as Record<string, unknown>)[key]),
  )
  @IsBoolean()
  aceptaPolitica?: boolean;

  // de dónde vino

  /**
   * El canal. Lo pone la página desde su `utm_source`.
   *
   * Se acepta del cliente —el mismo criterio que el webhook de
   * leads— porque quien conoce el anuncio es la página, no nosotros.
   * Lo peor que puede hacer un cliente mentiroso es ensuciar la
   * atribución; no toca ni el dinero ni el ámbito. Por omisión,
   * AUTOGESTION: «llegó por el formulario público».
   */
  @IsOptional()
  @IsEnum(OrigenParticipante)
  origen?: OrigenParticipante;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(120)
  campana?: string;

  /// El lead de la mesa de entrada que trajo a esta persona, si la
  /// página lo sabe. El servicio comprueba que sea de esta misma
  /// línea de negocio antes de creérselo.
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200)
  leadId?: string;

  /**
   * Lo demás que preguntó el formulario.
   *
   * Se validan contra las preguntas publicadas con el MISMO código
   * que usa una reserva (`FormulariosService.prepararRespuestas`):
   * las obligatorias, las opciones válidas y los largos. Dos
   * validadores para el mismo formulario acabarían discrepando.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RespuestaDto)
  respuestas?: RespuestaDto[];
}
