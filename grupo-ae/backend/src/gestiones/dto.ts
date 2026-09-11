/** Lo que el panel puede mandar sobre una gestión, y nada más. */

import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { TipoGestion } from '../../generated/prisma';

export class CrearGestionDto {
  @IsEnum(TipoGestion, {
    message: 'Diga qué clase de gestión es: llamada, reunión, correo, WhatsApp, visita o tarea.',
  })
  tipo!: TipoGestion;

  @IsString()
  @MinLength(3, { message: 'Escriba en una línea qué hay que hacer.' })
  @MaxLength(160)
  titulo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  nota?: string | null;

  /**
   * Cuándo hay que hacerla.
   *
   * Sin esto la gestión es un apunte de algo que pasó y no sale
   * en la agenda de nadie. Con esto es un compromiso.
   */
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha de vencimiento no tiene un formato válido.' })
  venceEn?: string | null;

  /**
   * Para registrar lo que YA se hizo, con su fecha real.
   *
   * Se admite una fecha y no un simple `hecha: true` porque el
   * caso normal es teclear al final del día lo de la mañana, y
   * fecharlo todo «ahora» arruina la única medición honesta que
   * hay de cuándo se trabaja. Lo que no se admite es el futuro:
   * eso lo comprueba el servicio.
   */
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha en que se hizo no tiene un formato válido.' })
  hechaEn?: string | null;

  /// Quién responde. Si no viene, la hereda la oportunidad.
  @IsOptional()
  @IsString()
  asesorId?: string | null;
}

/**
 * Editar.
 *
 * Todos los campos son opcionales y `null` significa BORRAR el
 * dato, mientras que no mandarlo significa dejarlo como está. La
 * distinción hace falta de verdad: sin ella no hay forma de
 * quitarle la fecha a una gestión —de convertir un compromiso en
 * una nota— sin borrarla y volverla a escribir.
 *
 * `hechaEn` no está aquí a propósito: marcar y desmarcar tienen
 * su propia ruta porque no son una corrección de texto, son un
 * cambio de estado del que depende la agenda.
 */
export class EditarGestionDto {
  @IsOptional()
  @IsEnum(TipoGestion)
  tipo?: TipoGestion;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Escriba en una línea qué hay que hacer.' })
  @MaxLength(160)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  nota?: string | null;

  @IsOptional()
  @IsISO8601({}, { message: 'La fecha de vencimiento no tiene un formato válido.' })
  venceEn?: string | null;

  @IsOptional()
  @IsString()
  asesorId?: string | null;
}
