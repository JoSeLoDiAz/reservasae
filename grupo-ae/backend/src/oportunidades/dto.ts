/** Lo que el panel puede mandar, y nada más. */

import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
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

/**
 * Editar la ficha: lo que se corrige sin mover el negocio de sitio.
 *
 * Todos los campos opcionales, y el servicio distingue «no vino» de
 * «vino en null». No es lo mismo: guardar la ficha sin tocar la
 * fecha de cierre tiene que dejarla como estaba, y quitarla a
 * propósito tiene que borrarla. Con un solo `undefined` para las dos
 * cosas, la fecha de cierre no se puede quitar nunca.
 *
 * La etapa NO está aquí: se mueve por `PATCH :id/etapa`, que es
 * donde vive la escalera. Dejarla colarse en la edición sería la
 * puerta de atrás que salta las compuertas.
 */
export class ActualizarOportunidadDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Escriba qué se le está vendiendo.' })
  @MaxLength(160)
  titulo?: string;

  /// Entero, por lo mismo que al crear: aquí no se cotiza en
  /// centavos y dos pantallas con redondeos distintos descuadran el
  /// pronóstico.
  @IsOptional()
  @IsInt({ message: 'El valor va en pesos enteros.' })
  @Min(0)
  valor?: number;

  /// El servicio comprueba cuál es contra la lista de `edicion.ts`,
  /// y exige que venga con el valor ya convertido.
  @IsOptional()
  @IsString()
  @MaxLength(3)
  moneda?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'La fecha de cierre no tiene un formato válido.' })
  cierreEsperado?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  campana?: string | null;
}

/**
 * Pasarle el negocio a otra persona, o soltarlo.
 *
 * `asesorId` es obligatorio y admite null: soltar una oportunidad
 * hay que pedirlo escribiendo `null`, no omitiendo el campo. Un
 * `undefined` que se cuela desde el panel dejaría sin dueño una
 * oportunidad que alguien estaba trabajando, y eso pasa en silencio.
 */
export class AsignarAsesorDto {
  @ValidateIf((_o: unknown, valor: unknown) => valor !== null)
  @IsString({ message: 'Diga a quién se la pasa, o mande null para soltarla.' })
  asesorId!: string | null;

  /// Por qué se la pasa. Va a la bitácora junto al traspaso.
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  nota?: string;
}

/**
 * Pisar la probabilidad a mano, o devolverla a la de su etapa.
 *
 * `null` es la vuelta atrás, y por eso el campo es obligatorio: si
 * fuera opcional, un cuerpo vacío sería indistinguible de «suéltala»
 * y nadie sabría cuál de las dos pidió.
 */
export class PisarProbabilidadDto {
  @ValidateIf((_o: unknown, valor: unknown) => valor !== null)
  @IsInt({ message: 'La probabilidad va de 0 a 100, en enteros.' })
  @Min(0)
  @Max(100)
  probabilidad!: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  nota?: string;
}

/**
 * Atarle a quién se le vende.
 *
 * Una sola de las dos, y la que sea la decide el embudo —eso lo
 * comprueba `puedeAtarse`—. Se mandan las dos como opcionales
 * porque el panel usa el mismo formulario para los dos embudos.
 */
export class AtarClienteDto {
  @IsOptional() @IsString() empresaId?: string;
  @IsOptional() @IsString() personaId?: string;
}

/**
 * Una nota suelta en la bitácora.
 *
 * Sin agendar nada: para eso está una gestión de tipo TAREA, que
 * tiene fecha y dueño. Esto es «hablé con ella en el ascensor y me
 * dijo que el presupuesto sale en marzo», que no es un compromiso
 * de nadie pero es justo lo que hay que releer antes de llamar.
 */
export class NotaDto {
  @IsString()
  @MinLength(2, { message: 'Escriba la nota.' })
  @MaxLength(1000)
  nota!: string;
}
