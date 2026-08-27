"use client";

/**
 * Logos y colores de un formulario, heredando de la general.
 *
 * Vive en un componente y no repetido en cada pantalla porque
 * el cálculo de «qué se aparta de la general» está AQUÍ, en el
 * cliente: el backend guarda literalmente lo que reciba. Dos
 * implementaciones del mismo diff acaban discrepando, y la que
 * se equivoque guardará las 37 claves y matará la herencia sin
 * que nada falle a la vista.
 *
 * Lo usan la apariencia de un formulario y la del gremio, que
 * es la de su formulario de marca.
 */

import { useState } from "react";

import { EditorColores } from "@/components/admin/editor-colores";
import { GestorLogos } from "@/components/admin/gestor-logos";
import { Aviso, Boton, Tarjeta } from "@/components/admin/marco-admin";
import { useMarca } from "@/components/marca-publica";
import { adminApi, type Logo, type Marca } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import type { ColoresTema, Esquema } from "@/lib/tema";

export type Propios = Record<Esquema, ColoresTema>;

const VACIO: Propios = { CLARO: {}, OSCURO: {} };

/** Solo lo que se aparta de la marca general. */
export function soloDiferencias(
  general: ColoresTema,
  propuesta: ColoresTema,
): ColoresTema {
  const salida: ColoresTema = {};
  for (const [clave, valor] of Object.entries(propuesta)) {
    if (general[clave] !== valor) salida[clave] = valor;
  }
  return salida;
}

export function AparienciaHeredada({
  formularioId,
  general,
  iniciales,
  tituloLogos,
  tituloColores,
  descripcionLogos,
}: {
  formularioId: string;
  /// La general: es el denominador de la herencia.
  general: Marca;
  iniciales: Propios;
  tituloLogos: string;
  tituloColores: string;
  descripcionLogos: string;
}) {
  const { recargar } = useMarca();
  const [propios, setPropios] = useState<Propios>(iniciales);
  const [pestana, setPestana] = useState<Esquema>("CLARO");
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  // lo que se ve = general + lo propio
  const temas: Propios = {
    CLARO: { ...general.temas.CLARO, ...propios.CLARO },
    OSCURO: { ...general.temas.OSCURO, ...propios.OSCURO },
  };

  const cuantos =
    Object.keys(propios.CLARO).length + Object.keys(propios.OSCURO).length;

  function cambiar(siguiente: Propios) {
    setPropios(siguiente);
    setGuardado(false);
  }

  async function guardar(que: Propios) {
    setError(null);
    setOcupado(true);
    try {
      await adminApi.aparienciaDeFormulario(formularioId, {
        coloresClaro: que.CLARO,
        coloresOscuro: que.OSCURO,
      });
      setPropios(que);
      setGuardado(true);
      /// El panel se repinta al instante.
      ///
      /// En el subdominio de un gremio, la marca del panel ES
      /// esta: sin recargar habria que refrescar a mano para
      /// ver lo que se acaba de guardar.
      await recargar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {guardado && !error && <Aviso tipo="exito">Cambios guardados.</Aviso>}

      <Tarjeta titulo={tituloLogos} descripcion={descripcionLogos}>
        <GestorLogos
          formularioId={formularioId}
          heredados={general.logos as Logo[]}
          alCambiar={() => void recargar()}
        />
      </Tarjeta>

      <Tarjeta
        titulo={tituloColores}
        descripcion="Lo que no cambie aquí sigue a la apariencia general, y cambiará con ella."
      >
        <EditorColores
          temas={temas}
          catalogo={general.catalogoColores}
          esquema={pestana}
          alCambiarEsquema={setPestana}
          alCambiarColor={(clave, valor) =>
            cambiar({
              ...propios,
              [pestana]: { ...propios[pestana], [clave]: valor },
            })
          }
          alReemplazarTemas={(nuevos) =>
            cambiar({
              CLARO: soloDiferencias(general.temas.CLARO, nuevos.CLARO),
              OSCURO: soloDiferencias(general.temas.OSCURO, nuevos.OSCURO),
            })
          }
          herencia={{
            sobreescritos: {
              CLARO: Object.keys(propios.CLARO),
              OSCURO: Object.keys(propios.OSCURO),
            },
            alHeredarClave: (esquema, clave) => {
              const copia = { ...propios[esquema] };
              delete copia[clave];
              cambiar({ ...propios, [esquema]: copia });
            },
            alHeredarTodo: () => cambiar(VACIO),
          }}
          acciones={
            <div className="flex flex-wrap items-center gap-3">
              <Boton
                type="button"
                disabled={ocupado}
                onClick={() => void guardar(propios)}
              >
                {ocupado ? "Guardando…" : "Guardar colores"}
              </Boton>

              {/* Aquí «restablecer» significa dejar de
                  sobreescribir, NO escribir los de fábrica: eso
                  ultimo cambiaría la paleta de todos. */}
              {cuantos > 0 && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void guardar(VACIO)}
                  className="text-sm font-medium text-marca underline disabled:opacity-50"
                >
                  Volver a la apariencia general
                </button>
              )}

              <span className="text-sm text-texto-suave">
                {cuantos === 0
                  ? "Todo heredado de la general."
                  : `${cuantos} ${cuantos === 1 ? "color propio" : "colores propios"}.`}
              </span>
            </div>
          }
        />
      </Tarjeta>
    </>
  );
}
