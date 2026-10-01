"use client";

/** Los dos desplegables con que el asesor clasifica una gestión. */

/**
 * «Su categoría y su subcategoría más lo que coloque el asesor»
 * (cliente, 30 sep 2026). El texto libre NO se toca: esto va al
 * lado, no en su lugar.
 *
 * UN SOLO COMPONENTE PARA LOS TRES SITIOS donde se anota --la ficha,
 * el cajón del aula y la mesa de entrada-- y no por ahorrar
 * líneas: las tres escriben en la MISMA tabla por el mismo DTO, así
 * que si una ofreciera otra cosa habría dos ideas de qué es una
 * gestión clasificada. Es el mismo criterio con el que
 * `GestionarLead` copió la forma de la ficha, y está escrito en su
 * cabecera.
 *
 * LA SUBCATEGORÍA SE FILTRA POR LA CATEGORÍA, y al cambiar la
 * categoría se BORRA la que hubiera. Dejarla puesta es el defecto
 * que vuelve el informe mentira sin que nada falle: «No contactado ›
 * Interesado» se guardaría tan bien como cualquier otra pareja. El
 * servidor lo rechaza igual --`exigirClasificacion`--, pero
 * enterarse al pulsar Guardar es perder la nota escrita.
 */

import { useEffect, useState } from "react";

import { Desplegable } from "./desplegable";
import {
  notasConfigApi,
  type CategoriaDeNota,
} from "@/lib/notas-config-api";

/** Lo que el asesor eligió, listo para mandar con la nota. */
export type ClasificacionElegida = {
  categoriaId: string | null;
  subcategoriaId: string | null;
};

export const SIN_CLASIFICAR: ClasificacionElegida = {
  categoriaId: null,
  subcategoriaId: null,
};

/**
 * El catálogo que se puede ofrecer, cargado una vez.
 *
 * EN MEMORIA Y COMPARTIDO entre los tres sitios: el cajón del aula
 * se abre y se cierra decenas de veces en una jornada, y pedir el
 * catálogo en cada apertura son decenas de viajes para traer lo
 * mismo. No es `localStorage`: el catálogo cambia desde otra
 * pantalla y una copia en disco sobreviviría a la sesión ofreciendo
 * algo que ya se ocultó.
 */
let cache: CategoriaDeNota[] | null = null;
let enVuelo: Promise<CategoriaDeNota[]> | null = null;

/** Tira el catálogo guardado. La usa «Configuración notas» al tocarlo. */
export function olvidarCatalogoDeNotas() {
  cache = null;
  enVuelo = null;
}

function traerCatalogo(): Promise<CategoriaDeNota[]> {
  if (cache) return Promise.resolve(cache);
  /// Una sola petición aunque los tres sitios pregunten a la vez.
  enVuelo ??= notasConfigApi
    .ofrecidas()
    .then((c) => {
      cache = c;
      return c;
    })
    .catch((e: unknown) => {
      /// Se suelta el vuelo para que el siguiente lo reintente: si
      /// se quedara pegado, un fallo de red dejaría los
      /// desplegables vacíos hasta recargar la página.
      enVuelo = null;
      throw e;
    });
  return enVuelo;
}

/**
 * El catálogo y lo elegido, para quien pinta el formulario.
 *
 * Devuelve `elegida` ya listo para mandar al servidor y `limpiar`
 * para después de guardar.
 */
export function useClasificacionDeNota() {
  const [categorias, setCategorias] = useState<CategoriaDeNota[] | null>(cache);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [subcategoriaId, setSubcategoriaId] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void traerCatalogo()
      .then((c) => {
        if (vivo) setCategorias(c);
      })
      .catch(() => {
        /// Se traga a propósito: si el catálogo no carga, lo que NO
        /// puede pasar es que el asesor no pueda escribir su nota.
        /// Los desplegables no se pintan y el texto libre sigue
        /// funcionando, que es como se anotaba antes de esto.
        if (vivo) setCategorias([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  function elegirCategoria(id: string | null) {
    setCategoriaId(id);
    /// Al cambiar de categoría se cae la subcategoría. Ver la
    /// cabecera: dejarla puesta es el defecto que no se ve.
    setSubcategoriaId(null);
  }

  function limpiar() {
    setCategoriaId(null);
    setSubcategoriaId(null);
  }

  const categoria = categorias?.find((c) => c.id === categoriaId) ?? null;

  /// LA CATEGORÍA ES OBLIGATORIA, Y SOLO SI HAY CATÁLOGO.
  ///
  /// Decidido el 30 sep 2026, cuando se quitaron los tres botones de
  /// «Cómo salió» de los dos sitios donde se anota: eran la misma
  /// pregunta que la clasificación. Antes NO se podía guardar sin
  /// elegir «cómo salió», y esa exigencia no se puede perder --de
  /// ella salía el `resultado`, y de él los informes y la cuenta de
  /// intentos sin respuesta--. Así que la hereda la categoría, que
  /// es quien declara el resultado ahora. Una nota sin categoría se
  /// guardaría sin resultado y no contaría en ningún informe: es
  /// justo lo que no queremos que pase por descuido.
  ///
  /// La SUBCATEGORÍA sigue siendo opcional, a propósito: no todas
  /// las categorías tienen, y de ella no cuelga ningún dato
  /// derivado.
  ///
  /// «Solo si hay catálogo» no es un atajo: si la petición del
  /// catálogo falla, `ClasificacionDeLaNota` no se pinta --está en
  /// su cabecera-- y exigirla igual dejaría al asesor con un botón
  /// apagado y nada que pulsar para encenderlo. Sin catálogo se
  /// anota como antes del catálogo: texto libre y sin resultado.
  const obligatoria = (categorias?.length ?? 0) > 0;

  return {
    categorias: categorias ?? [],
    cargando: categorias === null,
    obligatoria,
    /// Lo que mira el botón de guardar en los tres sitios. Uno solo,
    /// para que no haya tres ideas de cuándo está lista una nota.
    completa: !obligatoria || categoriaId !== null,
    categoriaId,
    subcategoriaId,
    elegirCategoria,
    elegirSubcategoria: setSubcategoriaId,
    limpiar,
    /// Las subcategorías de la elegida, y solo esas.
    subcategorias: categoria?.subcategorias ?? [],
    elegida: { categoriaId, subcategoriaId } as ClasificacionElegida,
  };
}

/**
 * Los dos desplegables.
 *
 * El segundo sale APAGADO mientras no haya categoría, con su propio
 * marcador diciendo por qué. Esconderlo haría que la fila salte de
 * uno a dos controles cada vez que alguien elige, y una pantalla que
 * se recoloca sola bajo el cursor es una pantalla en la que se pulsa
 * lo que no se quería.
 */
export function ClasificacionDeLaNota({
  estado,
  alto = 32,
  subrayado,
}: {
  estado: ReturnType<typeof useClasificacionDeNota>;
  alto?: number;
  subrayado?: boolean;
}) {
  /// Sin catálogo no hay nada que ofrecer, y un desplegable vacío no
  /// dice nada: se anota como antes, con el texto libre.
  if (!estado.cargando && estado.categorias.length === 0) return null;

  const sinSubcategorias =
    estado.categoriaId !== null && estado.subcategorias.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-[11.5rem]">
        <Desplegable
          alto={alto}
          subrayado={subrayado}
          etiquetaAria="Categoría de la gestión"
          marcador="Categoría…"
          desactivado={estado.cargando}
          valor={estado.categoriaId ?? ""}
          alElegir={(v) => estado.elegirCategoria(v || null)}
          opciones={estado.categorias.map((c) => ({
            valor: c.id,
            etiqueta: c.nombre,
          }))}
        />
      </div>

      <div className="w-[12.5rem]">
        <Desplegable
          alto={alto}
          subrayado={subrayado}
          etiquetaAria="Subcategoría de la gestión"
          marcador={
            estado.categoriaId
              ? sinSubcategorias
                ? "Sin subcategorías"
                : "Subcategoría…"
              : "Elija la categoría"
          }
          desactivado={!estado.categoriaId || sinSubcategorias}
          valor={estado.subcategoriaId ?? ""}
          alElegir={(v) => estado.elegirSubcategoria(v || null)}
          opciones={estado.subcategorias.map((s) => ({
            valor: s.id,
            etiqueta: s.nombre,
          }))}
        />
      </div>
    </div>
  );
}
