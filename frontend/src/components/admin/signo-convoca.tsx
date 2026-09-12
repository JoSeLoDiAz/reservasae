/** El signo de Convoca. */

/**
 * El corro con su puerta abajo.
 *
 * Un arco de 260° dibujado en línea —los cupos apartados:
 * contorno, hueco, todavía nadie— y en la abertura por donde
 * se entra el trazo se ha vuelto materia: un disco macizo
 * asentado sobre el propio radio del círculo, la persona ya
 * formada. «Del cupo reservado al resultado alcanzado» dicho en
 * el cambio de línea a mancha, sin flechas.
 *
 * El signo se dibujó con esa frase en su versión larga —«de los
 * cupos apartados a las personas formadas»—, que es la que
 * explica por qué el arco es contorno y el disco es materia. El
 * cliente la acortó el 12 sep 2026 y en el acceso ya sale la
 * corta; el dibujo no cambia, porque dice lo mismo.
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
 * espeje y no lo meta en una fila de iconos: su sitio es al
 * lado del nombre.
 *
 * SÍ se anima, y solo de UNA forma: `animado` dibuja el arco de
 * un trazo y asienta el disco al final. Eso NO contradice la
 * prohibición de arriba —que sigue en pie— porque lo prohibido
 * es GIRARLO: un aro que da vueltas es el indicador de carga,
 * y de ese hay que separarse. Dibujarse es lo contrario: cuenta
 * la misma frase que el signo ya dice quieto —del contorno
 * vacío a la persona formada— en el orden en que se lee.
 *
 * El último fotograma ES el estado de reposo, y eso no es un
 * detalle: las dos reglas de `globals.css` que apagan el
 * movimiento —la de `prefers-reduced-motion` y la del botón de
 * accesibilidad— dejan la animación en 0,01 ms, o sea que salta
 * a su último fotograma. Si terminara en `opacity: 0`, a quien
 * pide menos movimiento le desaparecería el signo.
 *
 * Para la espera hay una segunda forma, `SignoQueSeLlena`, más
 * abajo.
 */

/// La geometría, en un solo sitio: los dos modos tienen que
/// dibujar EL MISMO signo, y con el arco copiado a mano ya se
/// habían separado una vez.
const ARCO = "M7.88 21.96A10.6 10.6 0 1 1 24.12 21.96";
const DISCO = { cx: 16, cy: 25.75, r: 3.1 };

export function SignoConvoca({
  className,
  tamano = 32,
  animado = false,
}: {
  className?: string;
  tamano?: number;
  /// Se dibuja al montarse. Quien lo quiera al cambiar de
  /// pantalla le pone `key` con la ruta y se remonta solo.
  animado?: boolean;
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
      className={`${animado ? "signo-llega " : ""}${className ?? ""}`}
      aria-hidden="true"
    >
      {/* el corro: 260°, abierto abajo, centro (16 · 15,15)

          `pathLength="1"` normaliza el largo del trazo a 1, así
          que el guion se escribe en fracciones y no hay que
          medir el arco. Si mañana cambia el radio, sigue
          valiendo. */}
      <path
        d={ARCO}
        pathLength={animado ? 1 : undefined}
        className={animado ? "signo-arco" : undefined}
      />
      {/* la persona formada, sobre el radio exacto (10,6) */}
      <circle
        cx={DISCO.cx}
        cy={DISCO.cy}
        r={DISCO.r}
        fill="currentColor"
        stroke="none"
        className={animado ? "signo-disco" : undefined}
      />
    </svg>
  );
}

/**
 * El signo LLENÁNDOSE, para la espera.
 *
 * Lo pidió el cliente el 11 sep 2026 —«que se rellene»— y es
 * mejor que lo que había: el signo se dibujaba, y dibujarse dice
 * «te estoy escribiendo la firma», no «falta un rato». Un nivel
 * que sube dice lo segundo, y lo dice sin girar: el signo tiene
 * prohibido rotar, porque un aro que da vueltas es el indicador
 * de carga de cualquiera y de ese hay que separarse.
 *
 * El signo va DOS VECES, uno encima del otro: el de abajo es el
 * vacío —contorno tenue que sostiene la forma, para que a medio
 * llenar no se lea como medio signo— y el de arriba es el mismo,
 * entero, dentro de una caja que crece desde abajo.
 *
 * Y es una CAJA CON `overflow`, no un recorte de SVG. El primer
 * intento animaba un `<rect>` dentro de un `<clipPath>`: se veía
 * en las capturas y no se veía en el navegador del cliente —«¿dónde
 * se rellena?»—, porque animar los hijos de un `clipPath` no
 * repinta en todos los motores. Una caja que crece de alto es CSS
 * de toda la vida y se comporta igual en todas partes. Además ya
 * no hace falta un `id` único por instancia, así que esto vuelve a
 * ser un componente sin estado ni hooks.
 *
 * Se llena, se queda un momento lleno y se apaga para volver a
 * empezar. Se APAGA y no se vacía a propósito: verlo bajar se lee
 * como que algo se deshizo.
 */
export function SignoQueSeLlena({
  className,
  tamano = 88,
}: {
  className?: string;
  tamano?: number;
}) {
  const signo = (vacio: boolean) => (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={vacio ? "carga-vacio block" : "block"}
      aria-hidden="true"
    >
      <path d={ARCO} />
      <circle
        cx={DISCO.cx}
        cy={DISCO.cy}
        r={DISCO.r}
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );

  return (
    <span
      aria-hidden="true"
      className={`relative block shrink-0 ${className ?? ""}`}
      style={{ width: tamano, height: tamano }}
    >
      {signo(true)}
      {/* el nivel. La caja crece y el signo de dentro está pegado
          a SU borde de abajo, así que lo que se descubre sube. */}
      <span className="carga-nivel absolute inset-x-0 bottom-0 block overflow-hidden">
        <span
          className="absolute bottom-0 left-0 block"
          style={{ width: tamano, height: tamano }}
        >
          {signo(false)}
        </span>
      </span>
    </span>
  );
}
