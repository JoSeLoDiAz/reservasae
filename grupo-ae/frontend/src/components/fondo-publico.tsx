"use client";

/** El fondo de las pantallas públicas: el signo y unas señas de estudio. */

/**
 * El fondo era plano, y las pantallas públicas son las únicas
 * del sistema que alguien de fuera ve. Aquí se pone lo mismo que
 * en el inicio de sesión —el signo de Convoca, gigante y casi
 * invisible— más unas cuantas señas de que esto va de formarse.
 *
 * Las reglas del rediseño se respetan, y son las que dan la
 * forma:
 *
 * - **No es un fondo de color.** El criterio dice que el color va
 *   en el texto y en marcas pequeñas, nunca en fondos, y que no
 *   pasen de dos fondos por pantalla. Esto no pinta ninguno: son
 *   trazos en `currentColor` al 4-7 %, o sea una marca grande, no
 *   una superficie. Por eso sobrevive a las dieciséis plantillas y
 *   a los dos esquemas sin tocar un token.
 * - **Iconos de trazo, nada de emoji.** Van dibujados aquí y usan
 *   `currentColor`, así que toman el color del tema.
 * - **Se mueve despacio.** Entre 28 y 46 segundos por vuelta. Un
 *   fondo que llama la atención en un formulario donde alguien
 *   teclea su cédula es un fondo mal hecho.
 *
 * El desplazamiento con el puntero NO se hace con estado de
 * React: iría un render por cada movimiento del ratón, en la
 * pantalla más pública que tenemos. Se escribe una variable CSS
 * sobre el nodo, dentro de un `requestAnimationFrame`.
 *
 * En el móvil se escucha el giroscopio, pero **nunca se pide
 * permiso**: desde iOS 13 hace falta `requestPermission()` tras un
 * gesto, y un formulario que al abrirse pregunta por los sensores
 * del teléfono asusta más de lo que aporta. Donde el navegador lo
 * entrega solo —Android y iOS con el permiso ya dado— se usa; donde
 * no, el fondo se queda quieto y no pasa nada.
 */

import { useEffect, useRef } from "react";

import { SignoConvoca } from "./admin/signo-convoca";

/// Cuánto se desplaza, como mucho, la capa que más se mueve.
const MAXIMO = 18;

export function FondoPublico() {
  const nodo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raiz = document.documentElement;

    /// Las dos formas de pedir menos movimiento, y las dos
    /// mandan: la del sistema y el botón de accesibilidad del
    /// propio sitio.
    ///
    /// El MediaQueryList se crea UNA vez. Fabricarlo dentro del
    /// manejador es un objeto nuevo por cada movimiento del
    /// raton en la pantalla mas publica que hay.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const quieto = () => raiz.dataset.sinMovimiento === "si" || mq.matches;

    let pedido = 0;
    let x = 0;
    let y = 0;
    /// Lo ultimo que se pinto, para no encolar un fotograma por
    /// un movimiento que no mueve nada. El giroscopio dispara a
    /// 60 Hz con el telefono quieto en la mano.
    let pintadoX = 0;
    let pintadoY = 0;

    const pintar = () => {
      pedido = 0;
      pintadoX = x;
      pintadoY = y;
      nodo.current?.style.setProperty("--px", `${x}px`);
      nodo.current?.style.setProperty("--py", `${y}px`);
    };

    const encolar = () => {
      if (pedido) return;
      /// Al pedir menos movimiento se vuelve al centro y se
      /// pinta una ultima vez. Rendirse sin mas dejaria el fondo
      /// congelado donde estuviera, torcido y para siempre.
      if (quieto()) {
        if (pintadoX || pintadoY) {
          x = 0;
          y = 0;
          pedido = requestAnimationFrame(pintar);
        }
        return;
      }
      if (Math.round(x) === Math.round(pintadoX) && Math.round(y) === Math.round(pintadoY)) return;
      pedido = requestAnimationFrame(pintar);
    };

    /// El ratón: del centro de la ventana hacia fuera, en
    /// fracción, para que no dependa del tamaño de pantalla.
    const conElRaton = (e: MouseEvent) => {
      x = (e.clientX / window.innerWidth - 0.5) * 2 * MAXIMO;
      y = (e.clientY / window.innerHeight - 0.5) * 2 * MAXIMO;
      encolar();
    };

    /// El giroscopio. `gamma` es la inclinación izquierda-derecha
    /// y `beta` la de adelante-atrás; se recortan a ±25° porque
    /// más allá de eso el teléfono ya no se está mirando.
    const conElTelefono = (e: DeviceOrientationEvent) => {
      const g = Math.max(-25, Math.min(25, e.gamma ?? 0));
      const b = Math.max(-25, Math.min(25, (e.beta ?? 0) - 45));
      x = (g / 25) * MAXIMO;
      y = (b / 25) * MAXIMO;
      encolar();
    };

    window.addEventListener("mousemove", conElRaton, { passive: true });
    window.addEventListener("deviceorientation", conElTelefono, {
      passive: true,
    });

    /// Si lo enciende con la pagina abierta, se entera. Los dos
    /// caminos: el del sistema y el del boton de accesibilidad,
    /// que escribe `data-sin-movimiento` sobre <html>.
    mq.addEventListener("change", encolar);
    const vigia = new MutationObserver(encolar);
    vigia.observe(raiz, { attributeFilter: ["data-sin-movimiento"] });

    return () => {
      window.removeEventListener("mousemove", conElRaton);
      window.removeEventListener("deviceorientation", conElTelefono);
      mq.removeEventListener("change", encolar);
      vigia.disconnect();
      if (pedido) cancelAnimationFrame(pedido);
    };
  }, []);

  return (
    <div
      ref={nodo}
      aria-hidden
      className="fondo-publico no-imprimir pointer-events-none fixed inset-0 -z-10 overflow-hidden text-marca"
    >
      {/* El signo, como en el inicio de sesión: se sale por el
          borde a propósito. Cortado se lee como fondo; entero y
          centrado se leería como una ilustración. */}
      <div className="absolute -right-32 top-[calc(50%-310px)] opacity-[0.05]">
        <div className="fondo-capa-1">
          <SignoConvoca tamano={620} />
        </div>
      </div>

      <div className="absolute -left-24 bottom-[-4rem] opacity-[0.04]">
        <div className="fondo-capa-2">
          <SignoConvoca tamano={380} />
        </div>
      </div>

      {/* Fuera va la POSICION y dentro el movimiento. Juntos, el
          `translate` de Tailwind y el de la animacion se pelean
          por la misma propiedad y la seña salta al empezar. */}
      {SENAS.map((s, i) => (
        <div key={i} className={`absolute ${s.donde}`} style={{ opacity: s.opacidad }}>
          <div className={s.deriva}>{s.icono}</div>
        </div>
      ))}
    </div>
  );
}

/// Señas de que esto va de formarse. Trazo, `currentColor` y
/// repartidas para que ninguna caiga detrás de la columna del
/// formulario, que en escritorio va centrada y estrecha.
const SENAS = [
  { donde: "left-[6%] top-[14%]", deriva: "fondo-capa-2", opacidad: 0.07, icono: <Birrete /> },
  { donde: "right-[9%] top-[26%]", deriva: "fondo-capa-3", opacidad: 0.06, icono: <Libro /> },
  { donde: "left-[11%] top-[58%]", deriva: "fondo-capa-3", opacidad: 0.05, icono: <Lapiz /> },
  { donde: "right-[7%] bottom-[18%]", deriva: "fondo-capa-2", opacidad: 0.06, icono: <Diploma /> },
  { donde: "left-[18%] bottom-[8%]", deriva: "fondo-capa-1", opacidad: 0.05, icono: <Bombilla /> },
  { donde: "right-[20%] top-[6%]", deriva: "fondo-capa-1", opacidad: 0.05, icono: <Portatil /> },
];

/// Los dibujos. Uno por concepto y ninguno importado: son seis,
/// y traerse un paquete de mil por seis engorda el bundle de la
/// pantalla mas publica que hay.
const TRAZO = {
  width: 96,
  height: 96,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Birrete() {
  return (
    <svg {...TRAZO}>
      <path d="M12 4 2 9l10 5 10-5-10-5Z" />
      <path d="M6 11.5V17c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-5.5" />
      <path d="M22 9v5" />
    </svg>
  );
}

function Libro() {
  return (
    <svg {...TRAZO}>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v16H5.5A1.5 1.5 0 0 0 4 20.5Z" />
      <path d="M4 17.5A1.5 1.5 0 0 1 5.5 16H19" />
    </svg>
  );
}

function Lapiz() {
  return (
    <svg {...TRAZO}>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      <path d="M14.5 5.5l3 3" />
    </svg>
  );
}

function Diploma() {
  return (
    <svg {...TRAZO}>
      <circle cx="12" cy="9" r="5" />
      <path d="M9 13.5 8 21l4-2 4 2-1-7.5" />
    </svg>
  );
}

function Bombilla() {
  return (
    <svg {...TRAZO}>
      <path d="M9 17h6" />
      <path d="M10 20h4" />
      <path d="M12 2a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1v.5h6v-.5c0-.4.1-.8.5-1.1A6 6 0 0 0 12 2Z" />
    </svg>
  );
}

function Portatil() {
  return (
    <svg {...TRAZO}>
      <rect x="4" y="5" width="16" height="11" rx="1.5" />
      <path d="M2 19h20" />
    </svg>
  );
}
