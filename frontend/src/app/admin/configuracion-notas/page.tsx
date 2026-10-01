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
import { conPermiso } from "@/components/admin/puerta-de-pantalla";
import { ErrorApi } from "@/lib/api";
import { useDatosVivos } from "@/lib/datos-vivos";
import {
  notasConfigApi,
  type CategoriaDeNota,
} from "@/lib/notas-config-api";

/**
 * POR QUÉ AQUÍ NO SE PREGUNTA CÓMO CUENTA UNA CATEGORÍA.
 *
 * La pregunta existió, y el cliente la mandó fuera tres veces el
 * mismo día (30 sep 2026). Queda escrito para que a nadie se le
 * ocurra devolverla:
 *
 *   1. En el formulario de la nota había «Cómo salió» ---hablé / no
 *      contestó / el dato no sirve--- justo encima de «Clasificación».
 *      «Ese "Cómo salió" es la "Clasificación"». Se quitó, y el
 *      resultado se pasó a derivar de la categoría.
 *   2. Para poder derivarlo se puso la MISMA pregunta, con las MISMAS
 *      tres opciones, al crear la categoría, llamada «Significa».
 *      «¿Cómo así que QUÉ SIGNIFICA, coño? Para eso la categoría y
 *      subcategoría». Se quitó del formulario de crear.
 *   3. Quedó al editar una ya existente, como «Cuenta en los informes
 *      como». «¿Por qué putas este listado? Esto saldría de la
 *      ecuación». Fuera del todo.
 *
 * Y tiene razón las tres veces: LA CATEGORÍA ES LA CLASIFICACIÓN.
 * Mapearla a mano a otra lista de tres es la misma pregunta con otro
 * traje.
 *
 * QUÉ PASA AHORA. La columna `resultado` sigue en la base y las
 * cuatro categorías sembradas conservan la suya ---de ahí sale el
 * contador de «lleva N intentos sin respuesta»---. Una categoría
 * nueva nace sin ella, así que sus notas no entran en ese contador.
 *
 * LO QUE HAY QUE HACER PARA CERRARLO DE VERDAD, y está dicho al
 * cliente: que los informes cuenten por CATEGORÍA en vez de por ese
 * enum heredado. El día que eso esté, la columna sobra y se va con
 * ella el último rastro de la pregunta.
 *
 */

/// LA PUERTA, CON EL MISMO PAR `area`/`nivel` QUE DECLARA SU
/// ENTRADA EN `navegacion.ts`. Sin esto la pantalla cargaba entera
/// para quien no la puede usar y el no del servidor solo llegaba
/// al pulsar un botón (repaso de QA, 30 sep 2026).
export default conPermiso("configuracion", "ESCRIBIR", PaginaConfiguracionNotas);

function PaginaConfiguracionNotas() {
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
  /// Por qué nombre filtrar la lista.
  ///
  /// Lo pidió el cliente el 30 sep 2026: «¿Organiza eso? O sea, si
  /// tengo 10, ¿cómo voy a bajar hasta ver el último?». Plegar las
  /// categorías arregla el bajar; esto arregla el BUSCAR, que es la
  /// otra mitad de la pregunta. Solo aparece cuando hay suficientes
  /// para que buscar gane a mirar: con cuatro, un buscador es un
  /// control de más en una pantalla que se toca una vez al mes.
  const [filtro, setFiltro] = useState("");

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

  /// El umbral del buscador: siete en adelante. Con seis o menos la
  /// lista plegada entra de un vistazo y el buscador sobra.
  const conBuscador = ofrecidas.length > 6;
  const aguja = filtro.trim().toLocaleLowerCase("es");
  const visibles =
    conBuscador && aguja
      ? ofrecidas.filter((c) => c.nombre.toLocaleLowerCase("es").includes(aguja))
      : ofrecidas;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
      <header>
        <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">
          Configuración notas
        </h1>
        <p className="mt-1 text-texto-suave">
          Con qué se clasifica una gestión. El asesor elige una categoría y una
          subcategoría, y además escribe lo que pasó: esto enmarca su texto, no
          lo sustituye.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {exito && <Aviso tipo="exito">{exito}</Aviso>}

      {/* UNA LÍNEA, NO UN PÁRRAFO.

          Estaba en cuatro renglones explicando por qué no hay botón de
          borrar, con su «sin que nadie pueda saber cuál». El cliente lo
          leyó y contestó «el léxico» (30 sep 2026). Tiene razón: quien
          abre esta pantalla quiere ver sus categorías, no una lección.
          Lo que hay que decir cabe en una línea; el porqué vive en el
          código, que es donde sirve. */}
      <p className="text-sm text-texto-suave">
        Nada se elimina: una categoría se <strong>oculta</strong> y deja de
        ofrecerse, pero las notas que ya la nombran siguen leyéndose.
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

      {/* EL BUSCADOR, solo de siete en adelante. Ver `conBuscador`. */}
      {conBuscador && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            className={`${CLASE_CONTROL} max-w-xs`}
            placeholder="Buscar una categoría por nombre"
            aria-label="Buscar una categoría por nombre"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
          <p className="text-sm text-texto-suave">
            {aguja
              ? `${visibles.length} de ${ofrecidas.length}`
              : `${ofrecidas.length} categorías se ofrecen`}
          </p>
        </div>
      )}

      {/* Un bloque vacío dice POR QUÉ lo está: aquí la lista no está
          vacía, está filtrada, y decirlo evita que alguien crea que
          se le borró algo en una pantalla donde nada se borra. */}
      {conBuscador && aguja && visibles.length === 0 && (
        <p className="rounded-lg border border-borde bg-superficie-alterna px-3 py-2 text-sm text-texto-suave">
          Ninguna categoría se llama así. Las ocultas no se buscan: están
          listadas abajo.
        </p>
      )}

      {visibles.map((c) => (
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
                    {contarSub(c.subcategorias.length)}
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

/// Cuántas subcategorías tiene, para el renglón de la puerta.
///
/// Con la lista plegada (30 sep 2026) ese renglón es TODO lo que se
/// ve de una categoría cerrada, así que tiene que contestar solo
/// «¿la abro?». «Sin subcategorías» es la respuesta más útil de las
/// tres: esa es la que está a medio configurar.
function contarSub(n: number): string {
  if (n === 0) return "sin subcategorías";
  return n === 1 ? "1 subcategoría" : `${n} subcategorías`;
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
    /**
     * PLEGADA, Y CERRADA DE NACIMIENTO.
     *
     * Lo pidió el cliente el 30 sep 2026, textual: «¿Organiza eso?
     * O sea, si tengo 10, ¿cómo voy a bajar hasta ver el último?».
     * Antes cada categoría se pintaba entera y abierta, con todas sus
     * subcategorías y un «Ocultar» por cada una: con las cuatro
     * sembradas ya había que bajar mucho, y con diez no se podía
     * abarcar.
     *
     * Con `Bloque plegable` y no con un `useState` propio: esta casa
     * ya tenía la pieza --el mismo desplegable que él pidió el 27 sep
     * para una leyenda que «ocupaba mucho espacio»-- y es un
     * `<details>`, así que el abierto/cerrado lo guarda el navegador.
     * Eso importa aquí: al ocultar una subcategoría la lista se
     * refresca, y con el estado en React la categoría se cerraría
     * sola en las narices de quien la está editando.
     *
     * En el renglón de la puerta va lo que se necesita para decidir
     * si abrirla: cuántas subcategorías tiene, cuántas notas la
     * nombran y --si no cuenta en los informes-- el aviso, porque esa
     * es justo la que hay que abrir.
     */
    <Bloque
      plegable
      titulo={categoria.nombre}
      descripcion={
        <>
          {contarSub(categoria.subcategorias.length)}
          {" · "}
          {contar(categoria.notas)}
        </>
      }
    >
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
                Dejar de ofrecer
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
