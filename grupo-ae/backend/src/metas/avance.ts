/** Lo ganado contra lo que había que ganar, y qué hacer con el resto del mes. */

/**
 * La cifra que dirige.
 *
 * Un tablero informa: «llevamos 40 millones». Esto dirige:
 * «llevamos 40 de 60, quedan seis días hábiles y son 3,4 millones
 * diarios». La primera se mira; la segunda se obedece.
 *
 * Módulo puro y con su .spec, igual que `oportunidades/escalera.ts`,
 * porque aquí está todo lo que se puede calcular mal: los bordes
 * del mes, la meta en cero, el mes ya cerrado y las tres divisiones
 * que pueden partir por cero. Ninguna de esas se puede probar de
 * verdad si hay que levantar Nest y una base para llegar a ellas.
 *
 * NINGUNA función de aquí llama a `new Date()`: el instante entra
 * por parámetro. Un cálculo que lee el reloj por su cuenta solo se
 * puede probar el día correcto.
 */

import {
  diasHabilesDelMes,
  diasHabilesRestantes,
  mesTerminado,
  rotuloDeMes,
} from './periodo';

/**
 * En qué anda la meta, en una palabra.
 *
 * Cinco estados y no un booleano «va bien / va mal», porque los
 * casos que no son ninguno de los dos son justo los que confunden:
 * un mes sin meta puesta no va mal, y un mes ya terminado por
 * debajo no «va» atrasado —ya no va a ningún sitio—.
 */
export type Ritmo =
  /// Nadie le puso meta a este mes. No es un cero: es un vacío.
  | 'SIN_META'
  /// Llegó. Da igual que el mes siga o no.
  | 'CUMPLIDA'
  /// El mes sigue y lleva lo que le tocaría llevar a estas alturas.
  | 'EN_RITMO'
  /// El mes sigue y va por debajo. Todavía se arregla.
  | 'ATRASADO'
  /// El mes se acabó por debajo de la meta. Ya no se arregla.
  | 'INCUMPLIDA';

export type Avance = {
  anio: number;
  mes: number;
  rotulo: string;

  meta: number;
  ganado: number;
  /// Lo que falta para llegar. Nunca negativo: pasarse no es faltar
  /// menos que cero, es `excedente`. Un «falta -3.000.000» en
  /// pantalla se lee mal y se resta peor.
  falta: number;
  excedente: number;

  /**
   * De 0 a lo que sea. NULL cuando no hay meta.
   *
   * Null y no 0 ni 100: con meta cero, cualquier porcentaje es
   * mentira —el 0 % acusa a quien no tenía nada que cumplir y el
   * 100 % felicita a quien no hizo nada—. El panel escribe «—».
   */
  porcentaje: number | null;

  /// Lo que llevaría a estas alturas repartiendo la meta parejo
  /// entre los días hábiles. Es la vara contra la que se decide si
  /// va EN_RITMO, no una predicción.
  esperado: number;

  ritmo: Ritmo;
  mesCerrado: boolean;

  diasHabiles: number;
  /// Contando hoy: hoy todavía se vende.
  diasHabilesRestantes: number;
  diasHabilesTranscurridos: number;

  /**
   * Cuánto hay que vender cada día que queda. NULL cuando no queda
   * ninguno y todavía falta.
   *
   * Null y no Infinity ni «todo lo que falta»: si el mes se acabó
   * debiendo veinte millones, no hay día donde ponerlos, y un
   * número ahí sugiere una tarea que ya no existe.
   */
  faltaPorDiaHabil: number | null;

  /// Los festivos no se descuentan todavía. Viaja marcado para que
  /// el panel pueda decirlo en vez de aparentar precisión.
  sinDescontarFestivos: true;
};

export type EntradaDeAvance = {
  /// Ya en pesos enteros: el Decimal se convierte en `dinero.ts`.
  meta: number;
  ganado: number;
  anio: number;
  mes: number;
  /// El instante desde el que se mira. Entra por parámetro a
  /// propósito; ver la cabecera del módulo.
  ahora: Date;
};

/**
 * El avance de un mes contra su meta.
 *
 * Las tres divisiones peligrosas están todas aquí y ninguna
 * devuelve NaN:
 *
 *  1. `ganado / meta` con meta cero -> `porcentaje: null`.
 *  2. `falta / diasRestantes` sin días -> `faltaPorDiaHabil: null`.
 *  3. `transcurridos / diasHabiles`: no puede partir por cero
 *     —todo mes tiene al menos dieciocho hábiles— y por eso no se
 *     guarda; si algún día se descuentan festivos habrá que
 *     volver a mirar esta línea, no antes.
 */
export function calcularAvance(entrada: EntradaDeAvance): Avance {
  const { meta, ganado, anio, mes, ahora } = entrada;

  const diasHabiles = diasHabilesDelMes(anio, mes);
  const restantes = diasHabilesRestantes(anio, mes, ahora);
  const transcurridos = diasHabiles - restantes;
  const cerrado = mesTerminado(anio, mes, ahora);

  const falta = Math.max(0, meta - ganado);
  const excedente = Math.max(0, ganado - meta);

  const hayMeta = meta > 0;

  /// Sin meta no hay nada que repartir: el esperado es cero y no la
  /// mitad de nada.
  const esperado = hayMeta
    ? Math.round((meta * transcurridos) / diasHabiles)
    : 0;

  return {
    anio,
    mes,
    rotulo: `${rotuloDeMes(mes)} de ${anio}`,

    meta,
    ganado,
    falta,
    excedente,
    porcentaje: hayMeta ? Math.round((ganado / meta) * 100) : null,
    esperado,

    ritmo: ritmoDe({ hayMeta, ganado, meta, esperado, cerrado }),
    mesCerrado: cerrado,

    diasHabiles,
    diasHabilesRestantes: restantes,
    diasHabilesTranscurridos: transcurridos,

    /**
     * Hacia ARRIBA, y no al peso más cercano.
     *
     * Repartir tres millones en cuatro días a 750.000 justos está
     * bien; repartir cien en tres a 33 deja uno sin vender el
     * último día. La cuota diaria de una meta se redondea siempre
     * en contra de quien la persigue: es la única dirección en la
     * que la suma alcanza.
     */
    faltaPorDiaHabil:
      falta === 0 ? 0 : restantes > 0 ? Math.ceil(falta / restantes) : null,

    sinDescontarFestivos: true,
  };
}

function ritmoDe(datos: {
  hayMeta: boolean;
  ganado: number;
  meta: number;
  esperado: number;
  cerrado: boolean;
}): Ritmo {
  if (!datos.hayMeta) return 'SIN_META';
  if (datos.ganado >= datos.meta) return 'CUMPLIDA';
  if (datos.cerrado) return 'INCUMPLIDA';
  /// Empatar con lo esperado es ir en ritmo: quien lleva
  /// exactamente su parte no está atrasado.
  return datos.ganado >= datos.esperado ? 'EN_RITMO' : 'ATRASADO';
}

/// Las palabras con las que el panel lo dice. Viven aquí y no en el
/// panel porque las usan también los correos del resumen mensual, y
/// dos listas de nombres para lo mismo acaban discrepando.
const ROTULOS_DE_RITMO: Record<Ritmo, string> = {
  SIN_META: 'Sin meta',
  CUMPLIDA: 'Cumplida',
  EN_RITMO: 'En ritmo',
  ATRASADO: 'Atrasado',
  INCUMPLIDA: 'No se cumplió',
};

export function rotuloDeRitmo(ritmo: Ritmo): string {
  return ROTULOS_DE_RITMO[ritmo];
}
