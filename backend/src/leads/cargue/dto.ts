/** Lo que acompaña al archivo del cargue de leads. */

/**
 * Va en el CUERPO del multipart y no en la URL, y eso tiene una
 * consecuencia que conviene tener delante: los campos de un
 * multipart llegan SIEMPRE como texto, aunque el formulario mande
 * un número o un booleano. Aquí los dos son texto de verdad, así
 * que no hace falta transformar nada --pero el día que se añada un
 * «cuántas filas», acordarse--.
 */

import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { OrigenParticipante } from '../../../generated/prisma';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CargarLeadsDto {
  /**
   * DE QUÉ GREMIO ES LA BASE. Obligatorio y sin valor por omisión.
   *
   * Es la decisión más importante del cargue entero. Los códigos AF
   * se repiten entre convenios y no significan lo mismo, así que
   * una base cargada en el gremio equivocado no falla: entra, cruza
   * contra la gente del otro gremio y le rellena huecos. Adivinarlo
   * ---por el ámbito, si la persona solo tiene uno--- sería
   * acertar hoy y meter mil personas en el convenio equivocado el
   * día que alguien tenga los dos.
   *
   * Se admite el id o el slug: la pantalla tiene el id, y quien
   * prueba la ruta a mano tiene «adecopria».
   */
  @IsString()
  @Transform(recortar)
  @IsNotEmpty({
    message:
      'Falta el convenio: mande el id del gremio o su slug (adecopria, ' +
      'britcham-adee). No se adivina, porque el mismo código AF es otro ' +
      'curso en cada gremio.',
  })
  convenio!: string;

  /**
   * De dónde salió esta base, si se sabe. Opcional.
   *
   * Por omisión `ASESOR` --«lo cargó el equipo»--, que es lo que
   * `origenDeLead()` cuenta como IMPORTACION y no como pauta. Se
   * puede decir otro si la base es de una feria (`EVENTO`) o la
   * mandó una empresa (`EMPRESA`): de eso vive la comparación entre
   * lo que cuesta un inscrito por pauta y lo que cuesta por otras
   * vías, y meter aquí `FACEBOOK` la falsearía entera.
   */
  @IsOptional()
  @IsEnum(OrigenParticipante, {
    message:
      'Ese origen no existe. Son: ' +
      Object.values(OrigenParticipante).join(', ') +
      '.',
  })
  origen?: OrigenParticipante;
}
