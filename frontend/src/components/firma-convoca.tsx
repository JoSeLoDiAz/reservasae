"use client";

/** La firma del producto: el signo, el nombre y la frase. */

/**
 * Vive aquí y no repetida en cada pantalla porque aparece en
 * cuatro sitios —la barra del panel, el login, el pie de los
 * formularios públicos y la ficha del perfil— y una firma que
 * se escribe cuatro veces acaba diciendo cuatro cosas.
 *
 * El año y la versión salen de `/api/estado`, que es pública.
 * El año se toma del reloj DEL SERVIDOR y no del navegador: en
 * un componente que se pinta en los dos lados, `new Date()`
 * puede dar años distintos y eso rompe la hidratación en
 * Nochevieja, que es justo el día en que nadie lo va a mirar.
 */

import { useEffect, useState } from "react";

import { SignoConvoca } from "@/components/admin/signo-convoca";

/// El nombre visible del producto, en un solo sitio.
///
/// Estaba escrito a pelo dentro del JSX, y el mismo texto vive en
/// el `<title>`, en los correos y en una columna de la base. Una
/// constante no arregla eso sola, pero al menos aqui no se
/// escribe dos veces.
export const NOMBRE = "Convoca CRM";
export const FRASE = "Relaciones que generan resultados";

type Estado = { version: string; hora: string };

/** La versión y el año, del servidor. */
export function useEstado(): Estado | null {
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    let vivo = true;
    void fetch("/api/estado")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // si no responde, la firma sale sin version
        if (vivo && d?.version) setEstado({ version: d.version, hora: d.hora });
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  return estado;
}

/**
 * El signo con el nombre, la línea y la frase.
 *
 * Con `animado` se escribe: el signo se dibuja, el nombre se
 * descubre bajo una máscara que avanza, la raya se traza desde su
 * izquierda y la frase se posa. Todo encadenado y de izquierda a
 * derecha, que es como se escribe una firma — y este componente
 * se llama así por algo.
 *
 * Los tiempos viven en `globals.css`, no aquí: son cinco
 * animaciones que tienen que solaparse entre ellas, y repartidas
 * en dos ficheros acabarían descuadradas.
 */
export function FirmaConvoca({
  tamano = 32,
  conFrase = true,
  apilado = false,
  animado = false,
  filete = false,
  className,
}: {
  tamano?: number;
  conFrase?: boolean;
  /// El signo encima del nombre en vez de a su lado. Para el
  /// pie, donde la firma cierra la pagina centrada y en
  /// columna; al lado del nombre solo funciona cuando va
  /// alineada a un borde.
  apilado?: boolean;
  /// El signo se dibuja al montarse.
  animado?: boolean;
  /// UNA RAYA DEBAJO DE LA FRASE, AL ANCHO DE LA FRASE.
  ///
  /// Solo apilada, y solo donde la firma hace de portada: hoy el
  /// panel del acceso. Ahí separa dos cosas distintas --quién
  /// firma y qué promete-- y el cliente la pidió midiendo lo
  /// mismo que el lema: «la línea a la par de: relaciones que
  /// generan resultados» (12 sep 2026).
  ///
  /// No es la raya que se quitó el 11 sep. Aquella iba ENTRE el
  /// nombre y el lema, partiendo la firma en tres piezas donde
  /// solo hacen falta dos. Esta va DEBAJO de la firma entera y
  /// cierra el bloque.
  filete?: boolean;
  className?: string;
}) {
  /// El texto crece con el signo, no aparte.
  ///
  /// Un nombre de 1,05rem al lado de un signo de 56 px se lee
  /// como un pie de foto. Tres escalones:
  ///
  ///   - hasta 43: FIRMA. Va al pie o dentro de una fila.
  ///   - de 44 a 59: CABECERA.
  ///   - 60 y más: PORTADA, y hace falta para el panel del
  ///     acceso. Ahí el panel mide media pantalla --960 px en un
  ///     monitor de 1920-- y un nombre de 1,75rem centrado en
  ///     ese ancho se ve diminuto: «se ve la letra pequeña en un
  ///     panel con tanto espacio, ¿no?» (cliente, 12 sep 2026).
  const grande = tamano >= 44;
  const portada = tamano >= 60;

  return (
    <span
      className={`flex ${
        apilado
          ? "flex-col items-center gap-2 text-center"
          : `items-center ${grande ? "gap-3.5" : "gap-2.5"}`
      } ${className ?? ""}`}
    >
      <SignoConvoca tamano={tamano} animado={animado} className="shrink-0" />
      <span
        className={`flex min-w-0 flex-col leading-none ${
          apilado ? "items-center" : ""
        }`}
      >
        <span
          className={`font-bold tracking-tight ${
            portada
              ? "text-[2.375rem]"
              : grande
                ? "text-[1.75rem]"
                : "text-[1.05rem]"
          } ${animado ? "firma-nombre" : ""}`}
        >
          {NOMBRE}
        </span>
        {conFrase && (
          /// EL LEMA Y SU FILETE, EN SU PROPIA CAJA.
          ///
          /// La caja existe para UNA cosa: que el filete mida
          /// exactamente lo que mide el lema. En una columna flex
          /// centrada, esta caja se encoge hasta su hijo más ancho
          /// --el lema--, así que el `w-full` del filete resuelve
          /// contra esa anchura y los dos quedan iguales solos, a
          /// cualquier tamaño de letra y de ventana. Colgando el
          /// filete de la columna de la firma habría medido lo que
          /// mide el NOMBRE, que es otra cosa.
          <span className={apilado ? "flex flex-col items-center" : "contents"}>
            {/* NUNCA UNA RAYA ENTRE EL NOMBRE Y LA FRASE.

                Esa la pidió el cliente el 1 sep 2026 y la quitó
                el 11: «eliminar esas líneas». Con ella la firma
                eran tres piezas apiladas en un sitio donde solo
                hacen falta dos. El hueco que daba lo hace el `mt`
                de la frase, sin dibujar nada.

                EL 85 % Y NO EL 65 %, por contraste medido. La
                firma se pinta sobre el color de la marca en dos
                sitios --el panel del acceso y la barra-- y ahí el
                65 % dejaba la frase en 3,36:1 compuesto sobre el
                verde del gremio, por debajo del 4,5 que pide un
                texto de 13-16 px. Al 85 % da 4,6:1. Ojo: la
                clase sola no basta, porque el último fotograma de
                `firma-frase-posa` es el que manda. */}
            <span
              className={`leading-snug font-medium opacity-85 ${
                portada
                  ? "mt-2.5 text-[1rem]"
                  : grande
                    ? "mt-2 text-[13px]"
                    : "mt-1.5 text-[10.5px]"
              } ${animado ? "firma-frase" : ""}`}
            >
              {FRASE}
            </span>

            {/* Se traza desde el centro, que es lo que ya hacen
                `firma-linea` y `firma-linea-centro` en
                `globals.css`: estaban escritas desde la primera
                firma y llevaban sin usarse desde que se quitó la
                raya de arriba. */}
            {filete && apilado && (
              <span
                aria-hidden
                className={`mt-9 h-px w-full bg-current opacity-35 ${
                  animado ? "firma-linea firma-linea-centro" : ""
                }`}
              />
            )}
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * La línea legal: quién lo gestiona, el año y la versión.
 *
 * La versión va aquí y no en una constante del código porque
 * `/api/estado` la saca del `package.json` del backend: es la
 * que de verdad está corriendo, no la que alguien recordó
 * escribir. Y en pruebas trae el sufijo, así que la pantalla
 * dice sola en qué entorno está.
 */
export function PieDeConvoca({
  className,
  apilado = false,
}: {
  className?: string;
  /// En tres renglones en vez de uno, para el pie del acceso.
  ///
  /// Ahí la columna es estrecha y centrada, y el renglón único
  /// —«Gestionado por Grupo AE · © 2026, todos los derechos
  /// reservados · Convoca CRM 0.3.0»— partía por donde cabía,
  /// dejando la versión sola en una segunda línea. Además en esa
  /// pantalla el «gestionado por» ya lo dice el panel de al lado
  /// CON LOS LOGOS, así que aquí sobra y queda el año, la nota
  /// legal y la versión, cada uno en su renglón.
  apilado?: boolean;
}) {
  const estado = useEstado();
  const ano = estado ? new Date(estado.hora).getFullYear() : null;

  if (apilado) {
    return (
      /// 12,5 px y no 11: apilado, este pie solo se usa en el
      /// acceso, donde todo subió de escala. A 11 px quedaba como
      /// una nota al pie de una tabla.
      <div
        className={`flex flex-col gap-0.5 text-[0.78125rem] leading-relaxed opacity-65 ${
          className ?? ""
        }`}
      >
        {/* DOS FILAS Y NO TRES.
            Tres renglones cortos y centrados se leen como una
            columna de restos: «queda como todo apeñuzcado»
            (cliente, 12 sep 2026). Con el año arriba y la nota
            legal junto a la versión, separadas por un punto
            medio, son dos renglones que se leen de un golpe. */}
        <p>
          {ano ? `© ${ano} ` : ""}
          <strong className="font-semibold">Grupo AE</strong>
        </p>
        <p>
          Todos los derechos reservados
          {estado && (
            <>
              {" · "}
              <span className="font-mono">
                {NOMBRE} {estado.version}
              </span>
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    /// 12,5 px al 65 %, y las dos cosas por contraste medido.
    ///
    /// A 11 px y al 60 % esta linea daba 2,25:1 MEZCLADA sobre la
    /// tarjeta de las pantallas publicas --2,25, no 15,9 como
    /// dice `getComputedStyle`, que devuelve el token puro-- y
    /// 4,19:1 en el acceso. El minimo es 4,5 y al 65 % da 4,93.
    /// Subir solo el cuerpo no arreglaba nada: el fallo era toda
    /// la opacidad.
    <p className={`text-[0.78125rem] leading-relaxed opacity-65 ${className ?? ""}`}>
      Gestionado por <strong className="font-semibold">Grupo AE</strong>
      {ano ? ` · © ${ano}, todos los derechos reservados` : ""}
      {estado ? (
        <>
          {" · "}
          <span className="font-mono">{NOMBRE} {estado.version}</span>
        </>
      ) : null}
    </p>
  );
}
