"use client";

/** Un formulario público: qué pide, dónde vive y su QR. */

/// Los dos momentos del formulario son distintos por
/// naturaleza, y la pantalla tiene que decirlo:
///
///   El CORTO es público. Vive en una URL por gremio, la
///   misma para todo el mundo, y se puede repartir en un QR.
///
///   El LARGO es personal. Cada enlace se emite desde la
///   lead de un lead, es de un solo uso y caduca. NO tiene
///   QR, y ofrecerlo seria mentir: un QR pegado en una pared
///   solo puede llevar a un sitio, y este cambia por persona.

import { BloqueDeBanda, Rotulo } from "./bloques";
import { EnlaceConCampana } from "./enlace-con-campana";

export type Campo = { etiqueta: string; obligatorio?: boolean };
export type Bloque = { titulo: string; campos: Campo[] };

/// El QR y la dirección con su botón de copiar viven con el
/// generador de enlaces: son las mismas piezas y una copia
/// suelta aquí acabaría divergiendo de la otra.
export { CodigoQR, Direccion } from "./enlace-con-campana";

/**
 * COLUMNAS QUE MIDEN LO QUE MIDE UN RÓTULO, Y NI UNA MÁS QUE
 * BLOQUES HAY.
 *
 * Eran dos columnas a cualquier ancho, así que a 1920 cada una
 * medía 800 px para «Tipo de documento», que son 130, con su
 * raya de un píxel corriendo seiscientos más hasta no
 * encontrarse con nada. Eso es repartir el sobrante entre las
 * columnas que ya hay, que es el defecto del ancho con otro
 * disfraz.
 *
 * Dos decisiones, y las dos salen del dato:
 *
 * 1. **Una columna topa en 420 px**, que es lo que mide el
 *    rótulo más largo del formulario largo —«O bien: trabajo por
 *    mi cuenta, y su cédula es su RUT»—. Un renglón de lista no
 *    es contenido de trabajo que quiera todo el monitor: es una
 *    etiqueta, y su raya tiene que acabar donde acaba ella.
 * 2. **Nunca más columnas que bloques.** El corto tiene cuatro
 *    —quién es, cómo ubicarlo, qué necesita, permiso— y el largo
 *    tiene dos. Con cuatro pistas fijas, el largo dejaba dos
 *    vacías: una rejilla con la mitad de las pistas en blanco se
 *    lee como si faltara algo, y aquí no falta nada.
 *
 * Las clases van literales —una por cuenta de bloques— porque
 * Tailwind lee el código al compilar: una armada en tiempo de
 * ejecución no genera CSS.
 *
 * Y es consulta de CONTENEDOR: esta lista vive dentro de una
 * banda cuyo ancho cambia cuando se pliega la barra lateral, sin
 * que la ventana cambie de tamaño.
 */
const COLUMNAS_POR_BLOQUES: Record<number, string> = {
  1: "grid-cols-[minmax(0,420px)]",
  2: "grid-cols-[minmax(0,420px)] @[560px]:grid-cols-[repeat(2,minmax(0,420px))]",
  3: "grid-cols-[minmax(0,420px)] @[560px]:grid-cols-[repeat(2,minmax(0,420px))] @[1080px]:grid-cols-[repeat(3,minmax(0,420px))]",
  4: "grid-cols-[minmax(0,420px)] @[560px]:grid-cols-[repeat(2,minmax(0,420px))] @[1080px]:grid-cols-[repeat(3,minmax(0,420px))] @[1440px]:grid-cols-[repeat(4,minmax(0,420px))]",
};

/** Lo que el formulario le pregunta a la persona. */
export function LoQuePregunta({ bloques }: { bloques: Bloque[] }) {
  const columnas =
    COLUMNAS_POR_BLOQUES[Math.min(Math.max(bloques.length, 1), 4)];

  return (
    /// El asterisco de «obligatorio» iba en `--aviso`, y el ámbar
    /// de este panel significa una sola cosa: que alguien lleva
    /// esperando. Un campo obligatorio no es una espera, así que
    /// va apagado.
    <div className="@container">
      <div className={`grid gap-x-10 gap-y-6 ${columnas}`}>
        {bloques.map((b) => (
          <div key={b.titulo} className="min-w-0">
            <Rotulo className="mb-2">{b.titulo}</Rotulo>
            <ul style={{ fontSize: "0.8125rem", lineHeight: 1.4 }}>
              {b.campos.map((c) => (
                <li
                  key={c.etiqueta}
                  className="flex items-baseline gap-1.5 border-b border-hairline py-[7px] last:border-b-0"
                >
                  <span className="min-w-0">{c.etiqueta}</span>
                  {c.obligatorio && (
                    <span className="text-texto-suave" title="Obligatorio">
                      *
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Una dirección pública con su QR, por gremio.
 *
 * Ya no es una dirección fija: es la MISMA dirección con la
 * campaña que se le ponga. Un enlace sin campaña no dice de
 * dónde vino nadie, y esa es justamente la cuenta que hay que
 * poder enseñar para seguir pagando el anuncio.
 *
 * Es un BLOQUE y no una banda. Traía su propia `Seccion`, así
 * que dos líneas de negocio eran dos bandas apiladas, y cada
 * una gastaba 758 px de los 1636 de la banda: el resto era
 * papel. Puestas al lado —que es lo que hace la pantalla que
 * lo usa— la banda se usa entera y las dos direcciones se leen
 * comparándolas, que es como se miran: la de empresas y la de
 * personas no se reparten en los mismos sitios.
 */
export function EnlacePublico({
  sigla,
  slug,
  ruta,
  campanas,
}: {
  sigla: string;
  /** Lo que se escribe dentro de la campaña: la puerta. */
  slug: string;
  /** Dónde vive el formulario, desde la raíz del dominio. */
  ruta: string;
  campanas?: string[];
}) {
  return (
    <BloqueDeBanda rotulo={sigla}>
      <EnlaceConCampana slug={slug} ruta={ruta} titulo={sigla} campanas={campanas} />
    </BloqueDeBanda>
  );
}
