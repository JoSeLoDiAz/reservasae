"use client";

/** El texto de la política, para leerlo antes de aceptarlo. */

/**
 * Vive aquí porque lo necesitan los DOS formularios públicos —el
 * de reserva de cupos y el de preinscripción— y el texto de
 * respaldo tiene que ser uno solo: dos versiones de lo que la
 * persona autoriza es exactamente lo que no puede pasar.
 *
 * **Es el texto, no un enlace, y eso está decidido.** La
 * preinscripción llevaba la casilla al pie con un enlace al
 * lado, y el comentario que lo cambió sigue valiendo: «casi
 * nadie abría el enlace, y eso no alcanza para sostener que la
 * persona leyó lo que autorizó». Una casilla que dice «acepto»
 * junto a algo ilegible no es consentimiento informado, que es
 * justo lo que el artículo 9 de la Ley 1581 pide poder
 * demostrar.
 *
 * El destinatario NO es cosmético: `RESERVA` es el texto que
 * acepta la empresa que aparta cupos, y `PARTICIPANTE` el que
 * acepta la persona que se inscribe. Son dos tratamientos
 * distintos y se guardan contra políticas distintas.
 */

import { Fragment, useEffect, useState, type ReactNode } from "react";

import { ErrorApi } from "@/lib/pedir";
import { politicaVigente, type Destinatario, type PoliticaPublica } from "@/lib/politicas-api";

/**
 * Solo por si el convenio todavía no tiene texto cargado.
 *
 * El bueno se redacta en el panel, en Políticas. Este existe
 * para que el formulario público no quede con una casilla que
 * no dice nada mientras eso llega — pero no lo sustituye, y
 * `POST /reservas` guarda la aceptación contra la política real
 * cuando existe.
 */
export const TEXTO_DE_RESPALDO =
  "Autorizo de manera libre, previa, expresa e informada el tratamiento de mis datos " +
  "personales para atender mi solicitud, elaborar la cotización correspondiente y " +
  "adelantar el proceso comercial del servicio seleccionado, así como para contactarme por " +
  "los medios que registré. Podré conocer, actualizar, rectificar y suprimir mis " +
  "datos, y revocar esta autorización, en los términos de la Ley 1581 de 2012 y el " +
  "Decreto 1377 de 2013.";

/// Las direcciones del texto, pulsables, y NADA MAS.
///
/// El texto lo redacta un administrador y acaba en el
/// formulario publico, asi que pintarlo como HTML seria dejarle
/// inyectar lo que quiera --la misma razon por la que los
/// colores se validan clave por clave antes de entrar en una
/// etiqueta `<style>`--. Se parte por la expresion y solo los
/// trozos que SON una direccion se vuelven `<a>`; el resto
/// sigue siendo texto.
///
/// Vive aqui y lo usan los cuatro sitios que pintan una politica:
/// la preinscripcion, el enlace de completado, el modal y el
/// panel. En uno solo, el enlace funcionaria en una pantalla y en
/// las otras tres no.
const ENLACE = /https?:\/\/[^\s<>"')\]]*[^\s<>"')\].,;:!?]/g;

export function conEnlaces(texto: string): ReactNode[] {
  const trozos: ReactNode[] = [];
  let desde = 0;

  for (const hallado of texto.matchAll(ENLACE)) {
    const i = hallado.index;
    if (i > desde) trozos.push(<Fragment key={`t${desde}`}>{texto.slice(desde, i)}</Fragment>);
    trozos.push(
      <a
        key={`e${i}`}
        href={hallado[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium break-words text-marca underline underline-offset-2"
      >
        {hallado[0]}
      </a>,
    );
    desde = i + hallado[0].length;
  }

  if (desde < texto.length) trozos.push(<Fragment key={`t${desde}`}>{texto.slice(desde)}</Fragment>);
  return trozos;
}

/**
 * La política vigente de ese convenio, o null.
 *
 * Un convenio sin texto publicado NO es un error de pantalla:
 * la ruta devuelve 404 y aquí se cae al texto de respaldo. Que
 * el formulario dejara de funcionar por una tarea pendiente
 * nuestra sería peor que el texto genérico.
 *
 * El prefijo `use` se queda en inglés aunque el resto del
 * proyecto vaya en español, como `useMarca` y `useDatosVivos`:
 * `react-hooks/rules-of-hooks` reconoce un hook por el nombre y
 * con `usar...` marca error en cada llamada.
 */
export function usePolitica(
  slug: string | null | undefined,
  destinatario: Destinatario,
): PoliticaPublica | null {
  const [politica, setPolitica] = useState<PoliticaPublica | null>(null);

  useEffect(() => {
    if (!slug) return;
    let vivo = true;
    void politicaVigente(slug, destinatario)
      .then((p) => {
        if (vivo) setPolitica(p);
      })
      .catch((e: ErrorApi) => {
        // 404 = todavia no hay texto: se usa el de respaldo
        if (vivo && e.estado !== 404) setPolitica(null);
      });
    return () => {
      vivo = false;
    };
  }, [slug, destinatario]);

  return politica;
}

/**
 * El texto, en una caja con su propio scroll.
 *
 * `max-h` con scroll propio y no la página entera: dentro de un
 * formulario largo, un texto legal de dos mil palabras sin
 * recortar deja el botón de enviar a diez pantallas de
 * distancia y la gente abandona. `whitespace-pre-line` conserva
 * los saltos de línea del texto que se redactó en el panel; sin
 * eso, los artículos salen pegados en un solo párrafo.
 */
export function CajaDePolitica({
  politica,
  titulo,
}: {
  politica: PoliticaPublica | null;
  /// Si se pasa, manda sobre el de la politica.
  titulo?: string;
}) {
  return (
    /// Sin caja con borde y sin radio 14.
    ///
    /// El texto legal es el unico sub-bloque del producto que
    /// retrocede sobre `--superficie-alterna`, y esta nombrado
    /// asi en la direccion. El borde completo se reserva para
    /// tres objetos --campo, modal y ficha del tablero-- y esto
    /// no es ninguno.
    ///
    /// Y la fecha va como TODAS las fechas del producto:
    /// «9 sep 2026», mes en tres letras, minuscula, sin punto y
    /// sin coma. Convivian tres formatos en tres pantallas.
    <div>
      <p className="rotulo-bloque">
        {titulo ?? politica?.titulo ?? "Política de tratamiento de datos personales"}
      </p>
      <div className="texto-legal dato prosa mt-2">
        {conEnlaces(politica?.contenido ?? TEXTO_DE_RESPALDO)}
      </div>
      {politica && (
        <p className="micro mt-2">
          Versión {politica.version}, vigente desde el {fecha(politica.vigenteDesde)}.
        </p>
      )}
    </div>
  );
}

/**
 * La fecha del producto: «9 sep 2026».
 *
 * Mes en tres letras, en minúscula, sin punto y sin coma.
 * `toLocaleDateString` con `month: "short"` devuelve «sept» en
 * es-CO y a veces con punto, así que se recorta a tres y se le
 * quita el punto: el formato es el contrato, no lo que decida
 * la tabla del navegador.
 */
function fecha(valor: string): string {
  const d = new Date(valor);
  const mes = d
    .toLocaleDateString("es-CO", { month: "short" })
    .replace(".", "")
    .slice(0, 3)
    .toLowerCase();
  return `${d.getDate()} ${mes} ${d.getFullYear()}`;
}
