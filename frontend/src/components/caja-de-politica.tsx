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

import { useEffect, useState } from "react";

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
  "personales para gestionar mi preinscripción, confirmar mi cupo y adelantar el " +
  "proceso de matrícula en la formación seleccionada, así como para contactarme por " +
  "los medios que registré. Podré conocer, actualizar, rectificar y suprimir mis " +
  "datos, y revocar esta autorización, en los términos de la Ley 1581 de 2012 y el " +
  "Decreto 1377 de 2013.";

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
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {titulo ?? politica?.titulo ?? "Política de tratamiento de datos personales"}
      </p>
      <div className="max-h-64 overflow-y-auto rounded-xl border border-campo-borde bg-campo-fondo p-4 text-sm leading-relaxed whitespace-pre-line text-texto">
        {politica?.contenido ?? TEXTO_DE_RESPALDO}
      </div>
      {politica && (
        <p className="text-xs text-texto-suave">
          Versión {politica.version}, vigente desde el{" "}
          {new Date(politica.vigenteDesde).toLocaleDateString("es-CO", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          .
        </p>
      )}
    </div>
  );
}
