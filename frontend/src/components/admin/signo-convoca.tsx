/** El signo de Convoca. */

/**
 * El corro con su puerta abajo.
 *
 * Un arco de 260° dibujado en línea —los cupos apartados:
 * contorno, hueco, todavía nadie— y en la abertura por donde
 * se entra el trazo se ha vuelto materia: un disco macizo
 * asentado sobre el propio radio del círculo, la persona ya
 * formada. «De los cupos apartados a las personas formadas»
 * dicho en el cambio de línea a mancha, sin flechas.
 *
 * La puerta va ABAJO y en el eje, y no es indiferente: al
 * nordeste, un aro con un disco arriba a la derecha es la
 * insignia de no leído, que es el parecido más caro en un
 * panel lleno de contadores; abajo a la derecha es el punto de
 * presencia de un avatar; arriba es el botón de encendido; al
 * este es una ©. Abajo no hay convención que ocupe ese sitio.
 *
 * NO pasa por el envoltorio `Svg` de `iconos.tsx`: aquel fija
 * lienzo 24 y trazo 1,75, así que recortaría el dibujo y
 * adelgazaría el arco sin tocar el disco — justo la asimetría
 * que estos números existen para evitar.
 *
 * Va en `currentColor` y hereda el color del TEXTO del
 * encabezado, nunca un token de superficie: así sobrevive a
 * las dieciséis plantillas y a las dos paletas. Es lo contrario
 * de los logos institucionales, que necesitan placa blanca
 * porque están hechos para papel.
 *
 * No lo rote (arriba es encendido, al este es ©), no lo
 * espeje, no lo anime (girando es el indicador de carga del
 * que se separa) y no lo meta en una fila de iconos: su sitio
 * es al lado del nombre.
 */
export function SignoConvoca({
  className,
  tamano = 32,
}: {
  className?: string;
  tamano?: number;
}) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* el corro: 260°, abierto abajo, centro (16 · 15,15) */}
      <path d="M7.88 21.96A10.6 10.6 0 1 1 24.12 21.96" />
      {/* la persona formada, sobre el radio exacto (10,6) */}
      <circle cx="16" cy="25.75" r="3.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
