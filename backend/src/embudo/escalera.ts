/** Los peldaños de una visita al formulario público. */

/// Sube cuando cambia el ORDEN de la escalera.
///
/// Sin esto, un informe que junte dos versiones del formulario
/// mezcla peldaños que no significan lo mismo.
export const VERSION_EMBUDO = 1;

/**
 * En ORDEN, y ese orden es el informe.
 *
 * Refleja el formulario de hoy: primero la oferta, después los
 * datos con el permiso al pie, y al final la revisión. Si el
 * formulario se reordena, se sube `VERSION_EMBUDO`.
 *
 * `AUTORIZO` va antes que `DATOS_COMPLETOS` y no al revés: desde
 * el 14 sep 2026 la autorización es uno de los requisitos que
 * `faltaEnDatos` exige, así que no se puede estar completo sin
 * haberla marcado. El embudo sale monótono por construcción.
 */
export const ESCALERA = [
  'LLEGO',
  'CATALOGO_LISTO',
  'ELIGIO_UBICACION',
  'VIO_ACCIONES',
  'ELIGIO_ACCION',
  'AUTORIZO',
  'DATOS_COMPLETOS',
  'LLEGO_A_REVISION',
  'ENVIO',
  'REGISTRADO',
] as const;

/// Fuera de la escalera: dicen por qué se paró --o que quien
/// llegó era alguien--, no hasta dónde llegó. Meterlas en el
/// orden haría un embudo que sube.
///
/// `SE_QUEDO` es la única que no habla de un fallo: la escribe
/// un temporizador, no un suceso de la página, y por eso tampoco
/// sube `VERSION_EMBUDO` — el ORDEN de la escalera no cambia.
export const MARCAS = [
  'CATALOGO_FALLO',
  'SIN_COBERTURA',
  'ENVIO_FALLO',
  'SE_QUEDO',
] as const;

/// Cuanto hay que seguir ahi para contar como persona.
///
/// Un escaner de enlaces carga la pagina y cierra el navegador;
/// una persona sigue ahi. Tres segundos es del cliente (16 sep
/// 2026): «quitar los que nunca estuvieron ni tres segundos».
///
/// NO se puede calcular hacia atras, y se comprobo: el `ms` que
/// ya guarda cada paso mide lo que TARDO EN CARGAR, no lo que la
/// persona se quedo. De 8.309 visitas con un paso pasados los
/// 3 s, 8.254 lo eran solo por un catalogo lento.
export const SEGUNDOS_PARA_CONTAR = 3;

export type Peldano = (typeof ESCALERA)[number];
export type Marca = (typeof MARCAS)[number];
export type Paso = Peldano | Marca;

export const PASOS: readonly string[] = [...ESCALERA, ...MARCAS];

/// Lo escribe el SERVIDOR, no el navegador.
///
/// Es el único que no se puede permitir perder: beaconeado se cae
/// justo cuando la pestaña muere entre el envío y la respuesta,
/// que es un caso real en el que la ficha SÍ se creó.
export const DEL_SERVIDOR: readonly string[] = ['REGISTRADO'];

/// Los que acepta la puerta pública.
export const DEL_NAVEGADOR: readonly string[] = PASOS.filter(
  (p) => !DEL_SERVIDOR.includes(p),
);

/** En qué peldaño va, o -1 si es una marca. */
export function altura(paso: string): number {
  return (ESCALERA as readonly string[]).indexOf(paso);
}

/**
 * El primer peldaño que NO se alcanza sin mover algo.
 *
 * Un escáner de enlaces --el del proveedor de correo masivo, el
 * antivirus de un buzón corporativo-- ejecuta JavaScript y
 * escribe exactamente `LLEGO` y después `CATALOGO_LISTO` o
 * `CATALOGO_FALLO`. Nada más: de aquí arriba todo cuelga de un
 * gesto. `ELIGIO_UBICACION` sale del `onChange` del desplegable
 * de departamento, y los de encima de un clic o del envío.
 *
 * Medido en producción el 16 sep 2026: un mailing trajo 565
 * llegadas en cinco minutos, 573 de 574 en escritorio y CERO en
 * tableta --la firma de una flota de navegadores iguales, no de
 * un público--, y solo DOS pasaron de aquí. Esas dos se
 * preinscribieron.
 *
 * NO es un detector de robots y no hay que venderlo como tal:
 * una persona que abre, mira y se va escribe lo mismo que un
 * escáner. Por eso la cifra que sale de aquí es un SUELO, y la
 * pantalla lo dice.
 */
export const PRIMER_GESTO = 'ELIGIO_UBICACION';

/// Si ese peldaño exige un gesto de la persona. Se deriva de la
/// escalera para que no haya dos verdades sobre la misma línea.
///
/// Una MARCA queda fuera sola: `altura()` le devuelve -1, que no
/// alcanza ningún peldaño. Llevaba un `n >= 0` delante y era
/// código muerto -- la prueba de mutación no pudo matarlo.
export function pideGesto(paso: string): boolean {
  return altura(paso) >= altura(PRIMER_GESTO);
}
