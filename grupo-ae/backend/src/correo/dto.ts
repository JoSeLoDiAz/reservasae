import { IsEmail } from 'class-validator';

export class ProbarCorreoDto {
  /// A dónde mandar la prueba. Se valida aquí y no en el
  /// servicio para que un correo mal escrito se rechace antes
  /// de abrir una conexión con Google.
  @IsEmail({}, { message: 'Eso no parece una dirección de correo.' })
  para!: string;
}
