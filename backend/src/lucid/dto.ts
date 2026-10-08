import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsISO8601,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
  MaxLength,
  MinLength,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/// El resumen de una conversacion de Lucid.
export class NotaDeLucidDto {
  /// Su id de conversacion. Con el origen forma la llave que
  /// impide que un reintento deje la nota dos veces.
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  externoId!: string;

  /// Con +57 o sin el: se normaliza al entrar.
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  telefono!: string;

  /// Lo que la persona hablo con Lucid. Es lo que se lee.
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  resumen!: string;

  @IsOptional()
  @Transform(recortar)
  @IsIn(['adecopria', 'britcham-adee'])
  convenio?: string;

  @IsOptional()
  @IsISO8601()
  ocurridoEn?: string;

  /// El cuerpo de ellos, entero. Se guarda para poder demostrar
  /// que llego y para depurar, como `LeadEntrante.carga`.
  @IsOptional()
  @IsObject()
  carga?: Record<string, unknown>;
}

/**
 * A quién se pega una conversación que no se pegó sola.
 *
 * Los dos opcionales, y la validación de que venga UNO de los dos va
 * en el servicio: con `@ValidateIf` cruzado, el mensaje que sale no
 * dice qué falta, y quien lo lee es una persona en una pantalla.
 */
export class PegarConversacionDto {
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  participanteId?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  leadId?: string;
}

/**
 * EL TOPE DEL LOTE: cuantas conversaciones caben en una llamada.
 *
 * El mismo numero que el lote de leads y por el mismo motivo, que no
 * es la memoria sino el RELOJ: Cloudflare corta a los ~100 s, asi que
 * un lote mas grande se pierde entero despues de haber escrito la
 * mitad. Cada fila aqui pregunta por su celular y puede crear una
 * nota, o sea menos trabajo que un lead.
 */
export const TOPE_DE_NOTAS = 500;

/**
 * VARIAS CONVERSACIONES DE UNA VEZ, para cargar un historico.
 *
 * «Los que no estan registrados se ingresen de manera masiva [...] y
 * posteriormente guarde la gestion de los mensajes» (Josse, 8 oct
 * 2026). Sin esto el historico de conversaciones son N llamadas: la
 * puerta de notas era de una en una.
 *
 * Mismo camino que la de una: misma llave, mismo gremio por
 * subdominio, misma idempotencia por `(origenSistema, externoId)`. Lo
 * unico que cambia es que se contesta FILA POR FILA, para que quien
 * lo manda sepa cual se pego, cual quedo sin dueno y cual estaba ya.
 */
export class LoteDeNotasDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'El lote viene vacio.' })
  @ArrayMaxSize(TOPE_DE_NOTAS, {
    message:
      `Un lote admite hasta ${TOPE_DE_NOTAS} conversaciones. ` +
      'Partalo: mas no cabe en el tiempo que aguanta la conexion.',
  })
  @ValidateNested({ each: true })
  @Type(() => NotaDeLucidDto)
  notas!: NotaDeLucidDto[];
}
