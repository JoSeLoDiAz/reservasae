/** Lo que el panel puede mandar, y nada más. */

import { Transform } from 'class-transformer';
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
import { aNumeroONulo } from '../comun/campo-vacio';

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
  /// La columna es Decimal(14,2): sin tope, un cero de más llegaba a
  /// la base y volvía como un 500 sin explicación.
  @Max(999_999_999_999, {
    message: 'Ese valor pasa de 999.999.999.999 pesos: revise que no le sobren ceros.',
  })
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
  /// La columna es Decimal(14,2): sin tope, un cero de más llegaba a
  /// la base y volvía como un 500 sin explicación.
  @Max(999_999_999_999, {
    message: 'Ese valor pasa de 999.999.999.999 pesos: revise que no le sobren ceros.',
  })
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

  /// Del portafolio. Null lo quita; omitirlo lo deja como estaba.
  @IsOptional()
  @ValidateIf((_o: unknown, v: unknown) => v !== null)
  @IsString({ message: 'Elija un servicio del portafolio.' })
  servicioId?: string | null;

  /// Cuántas licencias, equipos o cursos. Null la borra.
  @IsOptional()
  @ValidateIf((_o: unknown, v: unknown) => v !== null)
  @IsInt({ message: 'La cantidad va en números enteros.' })
  @Min(1, { message: 'La cantidad tiene que ser al menos 1.' })
  cantidad?: number | null;

  /**
   * Lo que de verdad se facturó. Null lo devuelve a «sin facturar»;
   * omitirlo lo deja como estaba.
   *
   * Entero, por lo mismo que `valor`: aquí no se factura en centavos,
   * y el panel y la bitácora enseñan pesos sin decimales, así que un
   * centavo guardado sería una diferencia que nadie ve y que descuadra
   * la suma del mes contra la de las fichas.
   *
   * El cero SÍ se admite, y es distinto de null: una licencia que se
   * regaló para cerrar el negocio se facturó en cero, y eso es un dato.
   *
   * Y por eso mismo lleva `aNumeroONulo`: `main.ts` convierte según el
   * tipo declarado ANTES de validar, y la casilla vaciada en el panel
   * —`''`— llegaría aquí como `0`. Sin el transform, borrar lo
   * facturado lo guardaría como «facturado en cero», en silencio y
   * con la frase equivocada en la bitácora. Vacío es «quítelo»; el
   * porqué largo está en `comun/campo-vacio.ts`.
   *
   * El tope es el de la columna, Decimal(14,2). Sin él, una cifra
   * mal tecleada con dos ceros de más la rechaza la base con un error
   * de desbordamiento que llega al panel como un 500 sin explicación.
   *
   * Si la oportunidad está en una etapa donde se puede facturar lo
   * decide `puedeFacturarse`, en `edicion.ts`: esto solo mira la forma.
   */
  @IsOptional()
  @Transform(aNumeroONulo)
  @ValidateIf((_o: unknown, v: unknown) => v !== null)
  @IsInt({ message: 'El valor facturado va en pesos enteros, sin centavos.' })
  @Min(0, { message: 'El valor facturado no puede ser negativo.' })
  @Max(999_999_999_999, {
    message: 'Ese valor facturado es demasiado grande. Revise que no le sobren ceros.',
  })
  valorFacturado?: number | null;
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
  @IsString({ message: 'Elija el asesor o déjela sin asignar.' })
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
