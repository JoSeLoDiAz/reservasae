/** De la acción y dónde vive, a la oferta concreta. */

/**
 * Es lo que faltaba para que un lead naciera pudiendo
 * matricularse.
 *
 * `Oferta` es acción × ubicación. Con el curso solo se sabe QUÉ
 * quiere y no DÓNDE lo va a tomar, así que la ficha nacía con la
 * acción puesta y el panel decía «falta la sede». El formulario
 * público pregunta el domicilio ANTES que el curso justamente
 * por esto — y el de la pauta tiene que preguntar lo mismo.
 *
 * La regla es la misma que usa la ficha del asesor, y tiene que
 * serlo: dos formas de elegir la sede acaban eligiendo sedes
 * distintas para la misma persona.
 */

import { cubreA } from '../crm/cobertura';

export type OfertaCandidata = {
  id: string;
  accionFormacionId: string;
  cuposMaximos: number;
  cuposOcupados: number;
  ubicacion: { nombre: string; tipo: string; departamento?: string | null };
};

export type Vive = { departamento?: string | null; ciudad?: string | null };

/**
 * La sede que le toca, o null si ninguna lo cubre.
 *
 * Null NO es un fallo: significa que su departamento no tiene esa
 * acción, y eso hay que decirlo en vez de asignarle una sede
 * donde no puede ir. Es la misma decisión que ya toma `asignar()`
 * en la ficha.
 */
export function sedeQueLeToca(
  ofertas: OfertaCandidata[],
  accionFormacionId: string,
  vive: Vive,
): OfertaCandidata | null {
  const suyas = ofertas.filter(
    (o) =>
      o.accionFormacionId === accionFormacionId &&
      cubreA(
        {
          nombre: o.ubicacion.nombre,
          tipo: o.ubicacion.tipo,
          departamento: o.ubicacion.departamento ?? null,
        },
        { departamento: vive.departamento ?? null, ciudad: vive.ciudad ?? null },
      ),
  );

  if (suyas.length === 0) return null;

  /// Con varias, gana la que MÁS CUPO LIBRE tenga.
  ///
  /// Es el único desempate que no perjudica a nadie: mandarla a
  /// la más llena la deja en lista de espera por un criterio que
  /// ella no eligió. Y es el mismo desempate que usa la ficha,
  /// porque si aquí y allá se ordenara distinto, la misma persona
  /// caería en sedes distintas según por dónde entrara.
  return suyas.reduce((mejor, o) =>
    o.cuposMaximos - o.cuposOcupados > mejor.cuposMaximos - mejor.cuposOcupados
      ? o
      : mejor,
  );
}
