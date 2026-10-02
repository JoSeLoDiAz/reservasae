import { Transform } from 'class-transformer';
import { IsEmail, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class EditarReservaDto {
  /** El NIT de la empresa dueña. */
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  @Transform(recortar)
  nit!: string;

  /**
   * EL CORREO CON EL QUE SE HIZO LA RESERVA.
   *
   * El NIT NO ES UNA CREDENCIAL: está en el RUES, en cualquier factura
   * y en el pie de página de la web de la institución. Hasta el 2 oct
   * 2026 era lo único que se pedía para editar y para CANCELAR, así que
   * cualquiera podía entrar a la consulta pública, teclear el NIT de
   * otra organización, ver sus cupos y pulsar «Cancelar». Los cupos se
   * liberaban, la lista de espera los repartía en el acto y la empresa
   * se quedaba fuera sin recibir ningún aviso.
   *
   * El correo sí es privado: lo escribió quien reservó y le llegó ahí
   * el acuse. No es un segundo factor de verdad ---un código de un solo
   * uso al correo lo sería--- pero cierra la puerta de que baste un
   * dato público.
   *
   * CONSULTAR sigue pidiendo solo el NIT: ver los propios cupos no
   * destruye nada, y pedir el correo para mirar dejaría sin salida a
   * quien lo olvidó.
   */
  @IsEmail()
  @MaxLength(120)
  @Transform(recortar)
  correo!: string;

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

  /// El mismo motivo que en `EditarReservaDto`, y aquí pesa más:
  /// cancelar no se deshace desde la vía pública.
  @IsEmail()
  @MaxLength(120)
  @Transform(recortar)
  correo!: string;
}

export class ConsultarReservasDto {
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  @Transform(recortar)
  nit!: string;
}
