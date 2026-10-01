"use client";

/** «Configuración notas»: el catálogo con que se clasifican las gestiones. */

/**
 * Lo pidió el cliente el 30 sep 2026, y hasta dónde ponerla:
 * «se me ocurre dejarlo en el mismo módulo (Inscripciones) como
 * (Configuración notas). Algo como plantillas pero no así, o sea es
 * como el ejemplo».
 *
 * «Algo como plantillas pero no así» es la frase que manda en esta
 * pantalla. Una plantilla de correo es un texto largo que se
 * redacta; esto son dos listas cortas de palabras, y pedirle a quien
 * las configura que abra un redactor por cada una sería copiar la
 * forma equivocada. Así que: dos niveles a la vista, y añadir es
 * teclear y pulsar Enter.
 *
 * NO HAY BOTÓN DE BORRAR, y es lo primero que alguien va a buscar.
 * Por eso cada fila dice cuántas notas la nombran: es la respuesta a
 * «¿por qué no puedo borrar esto?» puesta donde se hace la pregunta.
 */

import { useCallback, useState } from "react";

import {
  Aviso,
  Boton,
  CLASE_CONTROL,
} from "@/components/admin/marco-admin";
import { olvidarCatalogoDeNotas } from "@/components/admin/clasificacion-de-la-nota";
import { Bloque, Cargando } from "@/components/admin/piezas";
import { ErrorApi } from "@/lib/api";
import { useDatosVivos } from "@/lib/datos-vivos";
import {
  notasConfigApi,
  type CategoriaDeNota,
} from "@/lib/notas-config-api";

export default function PaginaConfiguracionNotas() {
  /// CON `useDatosVivos` Y NO CON UN `useEffect` A MANO. Pedir en el
  /// efecto y poner el estado ahí mismo es lo que el linter de React
  /// para en seco --cascada de renders-- y además este hook trae
  /// gratis lo que haría falta escribir dos veces: no pisar una
  /// petición en vuelo, y el refresco.
  ///
  /// Sin refresco automático (`intervaloMs` muy alto no, `activo`
  /// sí): un catálogo que se toca una vez al mes no necesita
  /// repreguntar cada treinta segundos, y recargarlo debajo de quien
  /// está tecleando un nombre es peor que no recargarlo.
  const vivos = useDatosVivos(
    useCallback(() => notasConfigApi.listar(), []),
    { intervaloMs: 10 * 60_000 },
  );
  const categorias = vivos.datos;

  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [nueva, setNueva] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function conError(accion: () => Promise<void>, hecho?: string) {
    setError(null);
    setExito(null);
    setGuardando(true);
    try {
      await accion();
      /// El catálogo que tienen cargado los desplegables del asesor
      /// deja de valer en cuanto esto cambia: si no se tira, quien
      /// tenga el panel abierto sigue viendo lo que se acaba de
      /// ocultar hasta que recargue la página.
      olvidarCatalogoDeNotas();
      vivos.refrescar();
      if (hecho) setExito(hecho);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!categorias) return <Cargando que="Cargando el catálogo…" />;

  const ofrecidas = categorias.filter((c) => !c.oculta);
  const ocultas = categorias.filter((c) => c.oculta);

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
      <header>
        <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">
          Configuración notas
        </h1>
        <p className="mt-1 max-w-3xl text-texto-suave">
          Con qué se clasifica una gestión. El asesor elige una categoría y una
          subcategoría, y además escribe lo que pasó: esto enmarca su texto, no
          lo sustituye.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {exito && <Aviso tipo="exito">{exito}</Aviso>}

      {/* La regla de la casa, dicha antes de que alguien busque el
          botón de borrar y no lo encuentre. */}
      <p className="rounded-lg border border-borde bg-superficie-alterna px-3 py-2 text-sm text-texto-suave">
        Aquí nada se elimina: una categoría se <strong>oculta</strong> y deja de
        ofrecerse al anotar, pero las notas que ya la nombran siguen
        leyéndose. Ocultar es reversible; borrar dejaría notas diciendo
        «categoría» sin que nadie pueda saber cuál.
      </p>

      <Bloque
        titulo="Añadir una categoría"
        descripcion="El primer desplegable que ve el asesor."
      >
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const nombre = nueva.trim();
            if (!nombre) return;
            void conError(async () => {
              await notasConfigApi.crearCategoria(nombre);
              setNueva("");
            }, `Categoría «${nombre}» creada.`);
          }}
        >
          <input
            className={`${CLASE_CONTROL} max-w-xs`}
            placeholder="No contactado"
            value={nueva}
            maxLength={80}
            onChange={(e) => setNueva(e.target.value)}
          />
          <Boton type="submit" disabled={!nueva.trim() || guardando}>
            Añadir categoría
          </Boton>
        </form>
      </Bloque>

      {ofrecidas.map((c) => (
        <FilaDeCategoria
          key={c.id}
          categoria={c}
          guardando={guardando}
          conError={conError}
        />
      ))}

      {ocultas.length > 0 && (
        <Bloque
          titulo="Ocultas"
          descripcion="Ya no se ofrecen al anotar. Siguen aquí porque hay notas que las nombran."
        >
          <div className="space-y-3">
            {ocultas.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-3 first:border-t-0 first:pt-0"
              >
                <div>
                  <p className="font-medium text-texto-suave">{c.nombre}</p>
                  <p className="text-sm text-texto-suave">
                    {c.subcategorias.length}{" "}
                    {c.subcategorias.length === 1
                      ? "subcategoría"
                      : "subcategorías"}
                    {" · "}
                    {contar(c.notas)}
                  </p>
                </div>
                <button
                  className="text-sm font-medium text-marca hover:underline disabled:opacity-50"
                  disabled={guardando}
                  onClick={() =>
                    void conError(
                      () =>
                        notasConfigApi
                          .actualizarCategoria(c.id, { oculta: false })
                          .then(() => undefined),
                      `«${c.nombre}» se vuelve a ofrecer.`,
                    )
                  }
                >
                  Volver a ofrecer
                </button>
              </div>
            ))}
          </div>
        </Bloque>
      )}
    </div>
  );
}

/// «3 notas la nombran» y no «3»: el número suelto no explica por
/// qué no hay botón de borrar, que es lo que está haciendo aquí.
function contar(n: number): string {
  if (n === 0) return "ninguna nota la nombra todavía";
  return n === 1 ? "1 nota la nombra" : `${n} notas la nombran`;
}

function FilaDeCategoria({
  categoria,
  guardando,
  conError,
}: {
  categoria: CategoriaDeNota;
  guardando: boolean;
  conError: (accion: () => Promise<void>, hecho?: string) => Promise<void>;
}) {
  const [nueva, setNueva] = useState("");
  const ofrecidas = categoria.subcategorias.filter((s) => !s.oculta);
  const ocultas = categoria.subcategorias.filter((s) => s.oculta);

  return (
    <Bloque titulo={categoria.nombre} descripcion={contar(categoria.notas)}>
      <div className="space-y-4">
        <div className="space-y-2">
          {ofrecidas.length === 0 && (
            /* Un bloque vacío dice POR QUÉ lo está. */
            <p className="text-sm text-texto-suave">
              Sin subcategorías: el segundo desplegable le va a salir apagado al
              asesor. Añada al menos una.
            </p>
          )}

          {ofrecidas.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borde px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{s.nombre}</p>
                <p className="text-xs text-texto-suave">{contar(s.notas)}</p>
              </div>
              <button
                className="text-sm text-texto-suave hover:underline disabled:opacity-50"
                disabled={guardando}
                onClick={() =>
                  void conError(
                    () =>
                      notasConfigApi
                        .actualizarSubcategoria(s.id, { oculta: true })
                        .then(() => undefined),
                    `«${s.nombre}» ya no se ofrece.`,
                  )
                }
              >
                Ocultar
              </button>
            </div>
          ))}

          {ocultas.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-borde px-3 py-2"
            >
              <div>
                <p className="text-sm text-texto-suave">
                  {s.nombre} · oculta
                </p>
                <p className="text-xs text-texto-suave">{contar(s.notas)}</p>
              </div>
              <button
                className="text-sm font-medium text-marca hover:underline disabled:opacity-50"
                disabled={guardando}
                onClick={() =>
                  void conError(
                    () =>
                      notasConfigApi
                        .actualizarSubcategoria(s.id, { oculta: false })
                        .then(() => undefined),
                    `«${s.nombre}» se vuelve a ofrecer.`,
                  )
                }
              >
                Volver a ofrecer
              </button>
            </div>
          ))}
        </div>

        <form
          className="flex flex-wrap items-center gap-3 border-t border-borde pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const nombre = nueva.trim();
            if (!nombre) return;
            void conError(async () => {
              await notasConfigApi.crearSubcategoria(categoria.id, nombre);
              setNueva("");
            }, `«${nombre}» añadida a «${categoria.nombre}».`);
          }}
        >
          <input
            className={`${CLASE_CONTROL} max-w-xs`}
            placeholder="Sin respuesta"
            value={nueva}
            maxLength={80}
            onChange={(e) => setNueva(e.target.value)}
          />
          <Boton type="submit" disabled={!nueva.trim() || guardando}>
            Añadir subcategoría
          </Boton>
          <button
            type="button"
            className="ml-auto text-sm text-texto-suave hover:underline disabled:opacity-50"
            disabled={guardando}
            onClick={() =>
              void conError(
                () =>
                  notasConfigApi
                    .actualizarCategoria(categoria.id, { oculta: true })
                    .then(() => undefined),
                `«${categoria.nombre}» ya no se ofrece.`,
              )
            }
          >
            Ocultar la categoría
          </button>
        </form>
      </div>
    </Bloque>
  );
}
