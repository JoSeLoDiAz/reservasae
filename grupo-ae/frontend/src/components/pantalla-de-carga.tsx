"use client";

/** La pantalla entera mientras se abre algo. */

import { useEffect, useRef, useState } from "react";

import { SignoQueSeLlena } from "@/components/admin/signo-convoca";
import { FRASE, NOMBRE } from "@/components/firma-convoca";

import { FondoPublico } from "./fondo-publico";

/// Lo que tarda en aparecer cuando la espera empieza DESPUÉS de
/// que la pantalla ya está pintada: si el dato llega antes, no se
/// ve nunca y no hay parpadeo.
const RETRASO = 180;
/// Lo que dura una vuelta del relleno. Tiene que coincidir con
/// `carga-nivel` en `globals.css`, o la pantalla se iría a mitad
/// de la animación.
const UNA_VUELTA = 2400;
/// EL TOPE. Pase lo que pase, la pantalla se destapa a los 6 s.
///
/// Es una red, no un tiempo de espera: quien llama decide cuándo
/// ha terminado de cargar, y este número solo existe para que un
/// fallo suyo no deje la pantalla cubierta. El 12 sep 2026 el
/// acceso quedó tapado diez segundos por el túnel esperando la
/// marca, y con la llamada fallando se habría quedado así para
/// siempre: el velo es `fixed inset-0`, así que se come los clics
/// y nadie puede ni escribir la contraseña.
///
/// Seis segundos y no dos: por un enlace lento la espera legítima
/// puede pasar de cinco, y cortarla antes devuelve el parpadeo que
/// esta pantalla existe para quitar. Destapar de más es un salto
/// feo; no destapar es una pantalla muerta.
const TOPE = 6000;

type Fase = "nada" | "viendo";

/**
 * Si la pantalla de carga se vio, se queda hasta completar la
 * vuelta.
 *
 * Lo pidió el cliente el 11 sep 2026: «que cargue todo para que
 * muestre la animación completa». Sin esto la pantalla se iba en
 * cuanto llegaba el dato —en local, medio segundo— y lo que se
 * veía era un logo a medio llenar que desaparecía: justo lo que
 * hacía pensar que la animación no funcionaba.
 *
 * Las dos puntas están cuidadas, y son lo que hace que esto no
 * estorbe:
 *
 * - Si el dato llega ANTES de que la pantalla aparezca (180 ms),
 *   no se retiene nada: nadie vio nada que haya que terminar.
 * - Si la espera fue más larga que una vuelta, tampoco: la
 *   animación ya se vio entera y el formulario sale enseguida.
 *
 * O sea que como mucho añade lo que falte para completar una
 * vuelta, y solo cuando de verdad se está viendo.
 */
/// SIN RETENER NADA: el velo se va en cuanto llega el dato.
///
/// Para las pantallas que reciben trafico PAGADO. Ahi la vuelta
/// completa no es un detalle de marca, es dinero: ver
/// «Preinscripcion» arriba del anuncio y despues dos segundos de
/// pantalla tapada es donde se cae la gente. Ver CLAUDE.md.
export function useEsperaCorta(cargando: boolean): boolean {
  return useEspera(cargando, 0);
}

export function useEsperaCompleta(cargando: boolean): boolean {
  return useEspera(cargando, UNA_VUELTA);
}

/// Son DOS funciones exportadas y no una con bandera: el nombre
/// de la que se llama dice cual se eligio, y una bandera se
/// olvida en la llamada.
function useEspera(cargando: boolean, retener: number): boolean {
  /// Si al primer render ya se está cargando —o sea, al abrir o
  /// al recargar la página—, la pantalla cuenta como VISTA desde
  /// el principio: sale en el HTML del servidor, sin desvanecido y
  /// sin esperar nada, y por eso se garantiza la vuelta completa.
  ///
  /// Aquí estaba el doble parpadeo que vio el cliente el 11 sep
  /// 2026: la pantalla aparecía con un desvanecido de CSS y, al
  /// hidratar, el componente se monta otra vez y el desvanecido
  /// vuelve a correr. Dos entradas en medio segundo.
  const [fase, setFase] = useState<Fase>(cargando ? "viendo" : "nada");
  /// Cuándo empezó a verse. Se rellena en el efecto y no al
  /// declararlo: `Date.now()` en el cuerpo del render es impuro y
  /// con dos pasadas daría dos relojes distintos.
  const desde = useRef<number | null>(null);

  useEffect(() => {
    if (cargando) {
      if (fase === "viendo") {
        // la vuelta empieza a contar desde el primer pintado
        desde.current ??= Date.now();
        return;
      }
      // empezó con la pantalla ya pintada: se espera un poco antes
      // de tapar nada, por si el dato llega enseguida
      desde.current = Date.now();
      const reloj = setTimeout(() => setFase("viendo"), RETRASO);
      return () => clearTimeout(reloj);
    }

    // ya llegó el dato
    if (fase === "nada") return;

    const falta = retener - (Date.now() - (desde.current ?? Date.now()));
    if (falta <= 0) {
      setFase("nada");
      return;
    }
    const reloj = setTimeout(() => setFase("nada"), falta);
    return () => clearTimeout(reloj);
  }, [cargando, fase, retener]);

  /// LA RED, aparte y a propósito.
  ///
  /// Va en su propio efecto y no dentro del de arriba porque aquel
  /// depende de `cargando`: mientras quien llama siga diciendo que
  /// carga, su rama vuelve a armarse y nunca llega al desenlace.
  /// Este mira solo la fase, así que cuenta desde que el velo se
  /// vio y lo quita a los 6 s pase lo que pase.
  useEffect(() => {
    if (fase !== "viendo") return;
    const falta = TOPE - (Date.now() - (desde.current ?? Date.now()));
    const reloj = setTimeout(() => setFase("nada"), Math.max(falta, 0));
    return () => clearTimeout(reloj);
  }, [fase]);

  return fase === "viendo";
}

/**
 * El signo de Convoca llenándose, a pantalla completa y sobre el
 * fondo del sitio.
 *
 * Lo pidió el cliente el 11 sep 2026: «cuando cargue, que muestre
 * una dinámica bonita con el logo», y al verla a medias, «que se
 * rellene». Reemplaza los renglones sueltos —«Cargando la
 * convocatoria…», «Abriendo su registro…», «Entrando…»— que
 * salían pegados a una esquina de una página en blanco y se leían
 * como que algo se había roto.
 *
 * Cuatro decisiones que no se ven:
 *
 * - **Lleva el fondo de las pantallas públicas** (`FondoPublico`:
 *   el signo gigante y las señas de estudio). Sin él la espera era
 *   una pantalla lisa con un logo en medio, y lo que se pidió es
 *   que se vea el diseño, no un aviso. Va como hijo con `-z-10`:
 *   dentro de este contenedor se pinta encima de su fondo y debajo
 *   del contenido.
 * - **La firma va completa** —signo, nombre, raya y frase—, la
 *   misma que cierra el pie. Es la única pantalla del trámite
 *   donde la casa puede presentarse sin quitarle sitio al gremio.
 * - **Aparece con RETRASO** (`carga-pantalla`, en `globals.css`):
 *   si el dato llega antes de 180 ms no se ve nunca. Sin eso, en
 *   una conexión buena la pantalla parpadeaba.
 * - **Quien pide menos movimiento la ve QUIETA**, con el signo
 *   lleno. Sigue diciendo que algo está pasando.
 *
 * Es para cuando la pantalla todavía no tiene forma: los dos
 * formularios públicos y la entrada al panel. Dentro del panel,
 * con la barra y la cabecera ya pintadas, se usa `Cargando` (en
 * `admin/piezas.tsx`), que lleva el mismo signo llenándose en
 * pequeño: tapar el marco entero para traer una tabla sería peor
 * que el renglón.
 */
export function PantallaDeCarga({ que }: { que: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-fondo px-6"
    >
      <FondoPublico />

      <div className="flex flex-col items-center text-center">
        <SignoQueSeLlena tamano={96} className="text-marca" />

        <p className="mt-6 text-2xl font-bold tracking-tight">{NOMBRE}</p>
        {/* sin raya entre el nombre y la frase, como la firma */}
        <p className="mt-2 text-[13px] leading-snug font-medium opacity-65">{FRASE}</p>

        {/* SIN la franja que cruzaba.

            Estaba debajo de la frase y el cliente la quitó el 11
            sep 2026: «esto se va y que deje ver la imagen». Tenía
            razón en lo que importa —había DOS indicadores de lo
            mismo en la misma pantalla, el logo llenándose y una
            barrita, y el que cuenta la historia es el logo—. */}
        <p className="mt-6 text-sm text-texto-suave">{que}…</p>
      </div>
    </div>
  );
}
