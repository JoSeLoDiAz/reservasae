/** Lo que es de la PARTICIPACIÓN, cuando el asesor ya tocó la ficha. */

/**
 * El candado del asesor se saltaba por cuatro campos.
 *
 * `guardarPersona` escribía `nivelEducativo`, `cargoEnEmpresa`,
 * `nivelOcupacionalSepId` y `beneficiarioPrevio` ARRIBA, antes de
 * mirar `datosTocadosPorAsesorEn`. Los de `Persona` sí pasaban
 * por el candado —se quedan como propuesta y decide alguien—,
 * pero estos cuatro se escribían siempre.
 *
 * Cómo se veía: el asesor corregía el nivel ocupacional desde el
 * panel, la persona volvía a abrir su enlace y reenviaba el
 * formulario, y el valor volvía atrás. En silencio: sin propuesta
 * que decidir, sin `ValorAnterior` que explicara de dónde venía,
 * y con la respuesta diciendo `{enEspera: true}` —o sea «no se
 * pisó nada»—, que para estos cuatro era mentira. Y el nivel
 * ocupacional es columna del F7.
 *
 * Lo que tapaba el defecto es justo esa respuesta: la pantalla
 * decía «sus datos quedaron en espera» y era verdad para once
 * campos de doce.
 *
 * LOS HUECOS SÍ SE RELLENAN, y eso no rompe el candado: un campo
 * vacío no es una corrección de nadie, así que escribirlo no pisa
 * trabajo del asesor. Es la misma idea que el `update` del
 * `upsert` de `Persona` en el registro público.
 *
 * Y lo que CHOCA no se tira: se nombra en el aviso que ya sale
 * para el asesor, con lo que la persona dijo, para que pueda
 * decidirlo. No va a `PropuestaDeDatos` porque esa tabla la
 * resuelve el panel con un `persona.update` de los campos
 * aceptados: meter ahí un campo de `Participante` reventaría al
 * aceptarlo.
 */

export type RepartoDeLaFicha = {
  /// Lo que se puede escribir ya: estaba vacío y no pisa nada.
  huecos: Record<string, unknown>;
  /// Lo que viene distinto de un valor que ya había. No se
  /// escribe; se cuenta.
  choques: { campo: string; dice: unknown; guardado: unknown }[];
};

/**
 * Reparte lo que llegó del formulario en «huecos» y «choques».
 *
 * `undefined` es «el formulario no lo mandó» y no es ninguna de
 * las dos cosas: ni rellena ni choca. `null` guardado y
 * `undefined` guardado son lo mismo aquí —el campo está vacío—
 * porque las dos cosas significan que nadie lo ha dicho todavía.
 */
export function repartirDatosDeLaFicha(
  dice: Record<string, unknown>,
  guardado: Record<string, unknown>,
): RepartoDeLaFicha {
  const huecos: Record<string, unknown> = {};
  const choques: RepartoDeLaFicha['choques'] = [];

  for (const [campo, valor] of Object.entries(dice)) {
    if (valor === undefined) continue;

    const antes = guardado[campo];
    const vacio =
      antes === null ||
      antes === undefined ||
      (typeof antes === 'string' && antes.trim() === '');

    if (vacio) {
      huecos[campo] = valor;
      continue;
    }
    /// Lo que llega IGUAL no es un choque ni hace falta
    /// escribirlo: avisar de eso llenaría la bandeja del asesor
    /// cada vez que alguien reenvía el formulario sin cambiar
    /// nada, que es el caso normal.
    if (antes !== valor) choques.push({ campo, dice: valor, guardado: antes });
  }

  return { huecos, choques };
}

/// Para la línea del aviso: en castellano y con el valor, que es
/// lo que el asesor necesita para decidir sin abrir nada.
export const NOMBRE_DEL_CAMPO: Record<string, string> = {
  nivelEducativo: 'nivel educativo',
  cargoEnEmpresa: 'cargo',
  nivelOcupacionalSepId: 'nivel ocupacional',
  beneficiarioPrevio: 'beneficiario previo del SENA',
};

export function comoSeCuentanLosChoques(
  choques: RepartoDeLaFicha['choques'],
): string {
  return choques
    .map((c) => {
      const nombre = NOMBRE_DEL_CAMPO[c.campo] ?? c.campo;
      return `${nombre}: dice «${texto(c.dice)}», está «${texto(c.guardado)}»`;
    })
    .join('; ');
}

function texto(valor: unknown): string {
  if (valor === true) return 'sí';
  if (valor === false) return 'no';
  if (valor === null || valor === undefined) return '';
  return String(valor);
}
