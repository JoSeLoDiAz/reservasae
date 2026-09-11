"use client";

import { useEffect, useState } from "react";

import { Bloque, BotonSuave, Cargando, Encabezado } from "@/components/admin/piezas";
import { Desplegable } from "@/components/admin/desplegable";
import { EditorColores } from "@/components/admin/editor-colores";
import {
  AparienciaHeredada,
  type Propios,
} from "@/components/admin/apariencia-heredada";
import { GestorLogos } from "@/components/admin/gestor-logos";
import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
} from "@/components/admin/marco-admin";
import { useMarca } from "@/components/marca-publica";
import {
  adminApi,
  type Marca,
  type MarcaDeGremio,
  type ModoPorDefecto,
} from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import { formulariosApi } from "@/lib/formularios-api";
import type { ColoresTema, Esquema } from "@/lib/tema";

const MODOS: Array<{ valor: ModoPorDefecto; etiqueta: string; ayuda: string }> = [
  {
    valor: "SISTEMA",
    etiqueta: "Según el dispositivo",
    ayuda: "Respeta la preferencia de quien entra. Es lo que espera la mayoría.",
  },
  { valor: "CLARO", etiqueta: "Siempre claro", ayuda: "Arranca en claro aunque el dispositivo pida oscuro." },
  { valor: "OSCURO", etiqueta: "Siempre oscuro", ayuda: "Arranca en oscuro aunque el dispositivo pida claro." },
];

export default function PaginaMarca() {
  const { recargar } = useMarca();
  const [marca, setMarca] = useState<Marca | null>(null);
  /// Si se entro por la direccion de un gremio.
  ///
  /// Aqui manda porque lo que esta pantalla edita es la marca
  /// GENERAL, y eso desde la puerta de un gremio significaria
  /// cambiarsela a los dos.
  const [gremio, setGremio] = useState<{
    fijo: boolean;
    sigla: string | null;
    formularioId: string | null;
    /// La paleta propia del formulario que le da la cara.
    /// Solo las claves que difieren: es lo que la herencia
    /// necesita y lo unico que hay guardado.
    propios: Propios;
  } | null>(null);
  const [pestana, setPestana] = useState<Esquema>("CLARO");
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void adminApi.marca().then(setMarca);
    void adminApi
      .yo()
      .then(async (yo) => {
        if (!yo.gremioFijo) {
          setGremio({
            fijo: false,
            sigla: null,
            formularioId: null,
            propios: { CLARO: {}, OSCURO: {} },
          });
          return;
        }

        const suyos = await adminApi.marcaDeGremios().catch(() => []);
        const mio = suyos[0];
        const suId = mio?.formularioMarcaId ?? null;

        // su paleta no viene en marcaDeGremios
        const suyo = suId
          ? await formulariosApi.obtener(suId).catch(() => null)
          : null;

        setGremio({
          fijo: true,
          sigla: mio?.sigla ?? null,
          /// Sin su paleta leida, NO hay formulario que editar.
          ///
          /// Si la lectura falla y se pinta el editor con un
          /// objeto vacio, el primer Guardar borra los colores
          /// del gremio: "no se pudo leer" se habria disfrazado
          /// de "no tiene ninguno propio".
          formularioId: suyo ? suId : null,
          propios: {
            CLARO: suyo?.coloresClaro ?? {},
            OSCURO: suyo?.coloresOscuro ?? {},
          },
        });
      })
      .catch(() => setGremio(null));
  }, []);

  if (!marca) return <Cargando />;

  const catalogo = marca.catalogoColores;

  function cambiarCampo<C extends keyof Marca>(campo: C, valor: Marca[C]) {
    setMarca((p) => (p ? { ...p, [campo]: valor } : p));
    setGuardado(false);
  }

  function cambiarColor(clave: string, valor: string) {
    setMarca((p) =>
      p
        ? { ...p, temas: { ...p.temas, [pestana]: { ...p.temas[pestana], [clave]: valor } } }
        : p,
    );
    setGuardado(false);
  }

  // plantilla o derivacion: cambia todo
  function reemplazarTemas(temas: Record<Esquema, ColoresTema>) {
    setMarca((p) => (p ? { ...p, temas } : p));
    setGuardado(false);
  }

  async function conError(accion: () => Promise<Marca>) {
    setError(null);
    setGuardando(true);
    try {
      setMarca(await accion());
      setGuardado(true);
      // repintar el panel con los colores nuevos
      await recargar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex min-h-0 grow flex-col">
      <Encabezado
        titulo="Apariencia"
        descripcion={
          gremio?.fijo
            ? "Esta es la marca GENERAL, la que comparten todas las líneas de negocio. La de esta línea se edita en su formulario."
            : "Colores, textos y logo. Al guardar se aplican en todo el sistema, también en este panel."
        }
      />

      {(error || (guardado && !error)) && (
        <div className="banda">
          {error && <Aviso tipo="error">{error}</Aviso>}
          {guardado && !error && <Aviso tipo="exito">Cambios guardados.</Aviso>}
        </div>
      )}

      <MarcaDeCadaGremio />

      {gremio?.fijo ? (
        gremio.formularioId ? (
          /// El editor del gremio, aqui mismo.
          ///
          /// Es el MISMO componente que usa la apariencia del
          /// formulario, no una copia: el calculo de que se
          /// aparta de la general vive ahi dentro, y dos
          /// implementaciones del mismo diff acabarian
          /// guardando las 37 claves en una de las dos.
          <AparienciaHeredada
            key={gremio.formularioId}
            formularioId={gremio.formularioId}
            general={marca}
            iniciales={gremio.propios}
            tituloLogos={`Logos de ${gremio.sigla ?? "esta línea de negocio"}`}
            tituloColores={`Colores de ${gremio.sigla ?? "esta línea de negocio"}`}
            descripcionLogos="Hasta tres, uno por entidad. Sin ninguno propio se muestran los generales. SVG, PNG o WebP con fondo transparente, máximo 1 MB cada uno; se ven a 80 px de alto."
          />
        ) : (
          <Bloque titulo="La apariencia de esta línea de negocio">
            <AvisoDeGremio gremio={gremio} />
          </Bloque>
        )
      ) : (
        <Bloque
          titulo="Logos de la cabecera"
          descripcion="Hasta tres, uno por entidad. SVG, PNG o WebP con fondo transparente, máximo 1 MB cada uno. Se muestran a 80 px de alto, así que conviene entregarlos a 960 × 288 px o mayor, o en SVG. JPG no sirve: no tiene transparencia y deja un recuadro blanco."
        >
          <GestorLogos />
        </Bloque>
      )}

      {gremio?.fijo ? (
        <Bloque titulo="Textos y colores del sitio">
          <AvisoDeGremio gremio={gremio} />
        </Bloque>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void conError(() =>
              adminApi.actualizarMarca({
                nombreApp: marca.nombreApp,
                tituloPublico: marca.tituloPublico,
                subtituloPublico: marca.subtituloPublico,
                mensajeEncabezado: marca.mensajeEncabezado ?? "",
                piePagina: marca.piePagina ?? "",
                modoPorDefecto: marca.modoPorDefecto,
                permitirCambioDeModo: marca.permitirCambioDeModo,
              }),
            );
          }}
        >
          <Bloque titulo="Textos del sitio público">
            {/* Cinco campos de 1350 px de ancho para escribir
                el nombre de una aplicación. El formulario topa
                en 720 y cada caja mide lo que mide su dato. */}
            <div className="formulario">
              <div className="formulario-doble">
                <Campo etiqueta="Nombre de la aplicación" ayuda="Pestaña del navegador y encabezado.">
                  <input
                    required
                    value={marca.nombreApp}
                    onChange={(e) => cambiarCampo("nombreApp", e.target.value)}
                    className={CLASE_CONTROL + " ancho-nombre"}
                  />
                </Campo>

                <Campo etiqueta="Título principal">
                  <input
                    required
                    value={marca.tituloPublico}
                    onChange={(e) => cambiarCampo("tituloPublico", e.target.value)}
                    className={CLASE_CONTROL}
                  />
                </Campo>

                <div className="a-lo-ancho">
                  <Campo etiqueta="Texto de introducción">
                    <textarea
                      rows={3}
                      value={marca.subtituloPublico}
                      onChange={(e) => cambiarCampo("subtituloPublico", e.target.value)}
                      className={CLASE_CONTROL}
                    />
                  </Campo>
                </div>

                {/* Se enviaba en el submit y no tenía campo, así
                    que no había forma de ponerlo ni de quitarlo:
                    cada Guardar lo dejaba en cadena vacía. */}
                <div className="a-lo-ancho">
                  <Campo
                    etiqueta="Aviso destacado"
                    ayuda="Opcional. Sale en un recuadro sobre el formulario. Vacío, no sale nada."
                  >
                    <textarea
                      rows={2}
                      value={marca.mensajeEncabezado ?? ""}
                      onChange={(e) => cambiarCampo("mensajeEncabezado", e.target.value)}
                      className={CLASE_CONTROL}
                    />
                  </Campo>
                </div>

                <div className="a-lo-ancho">
                  <Campo etiqueta="Pie de página" ayuda="Opcional.">
                    <input
                      value={marca.piePagina ?? ""}
                      onChange={(e) => cambiarCampo("piePagina", e.target.value)}
                      className={CLASE_CONTROL}
                    />
                  </Campo>
                </div>
              </div>
            </div>
          </Bloque>

          <Bloque
            titulo="Modo claro y oscuro"
            descripcion="Qué ve quien entra por primera vez, y si puede cambiarlo."
          >
            <div className="formulario">
              {/* Sin el fondo azul claro en la opción elegida.
                  `--marca-suave` tiene dos sitios y solo dos: la
                  entrada activa de la barra lateral y la fila de
                  tabla bajo el ratón. Lo seleccionado se dice
                  con el borde y con la letra, que es donde va el
                  color en este panel. */}
              <div className="grid gap-3 sm:grid-cols-3">
                {MODOS.map((m) => {
                  const elegido = marca.modoPorDefecto === m.valor;
                  return (
                    <label
                      key={m.valor}
                      className={`rounded-plano cursor-pointer border p-3 transition ${
                        elegido ? "border-marca" : "border-borde hover:border-campo-borde"
                      }`}
                    >
                      <input
                        type="radio"
                        name="modo"
                        className="sr-only"
                        checked={elegido}
                        onChange={() => cambiarCampo("modoPorDefecto", m.valor)}
                      />
                      <p className={elegido ? "estado text-marca" : "dato"}>
                        {m.etiqueta}
                      </p>
                      <p className="secundario mt-1">{m.ayuda}</p>
                    </label>
                  );
                })}
              </div>

              <label className="dato mt-4 flex gap-3">
                <input
                  type="checkbox"
                  checked={marca.permitirCambioDeModo}
                  onChange={(e) => cambiarCampo("permitirCambioDeModo", e.target.checked)}
                  className="accent-[var(--marca)] mt-0.5 size-4 shrink-0"
                />
                <span>
                  Permitir que el visitante cambie entre claro y oscuro.
                  <span className="secundario mt-0.5 block">
                    Si lo desactiva desaparece el conmutador. Quítelo solo si hace
                    falta: para bastante gente el modo oscuro no es un gusto sino
                    una necesidad.
                  </span>
                </span>
              </label>

              <div className="border-hairline mt-6 border-t pt-4">
                <Boton type="submit" disabled={guardando}>
                  {guardando ? "Guardando…" : "Guardar textos y modo"}
                </Boton>
              </div>
            </div>
          </Bloque>

          <Bloque
            titulo="Colores"
            descripcion="Cada modo tiene su paleta completa. No basta con aclarar u oscurecer la otra: en modo oscuro un color de marca muy saturado deslumbra y hace vibrar los bordes del texto."
          >
            <EditorColores
              temas={marca.temas}
              catalogo={catalogo}
              esquema={pestana}
              alCambiarEsquema={setPestana}
              alCambiarColor={cambiarColor}
              alReemplazarTemas={reemplazarTemas}
              acciones={
                <div className="flex flex-wrap gap-3">
                  {/* los dos modos juntos: una plantilla cambia ambos */}
                  <Boton
                    type="button"
                    disabled={guardando}
                    onClick={() =>
                      conError(async () => {
                        await adminApi.actualizarTema("CLARO", marca.temas.CLARO);
                        return adminApi.actualizarTema("OSCURO", marca.temas.OSCURO);
                      })
                    }
                  >
                    {guardando ? "Guardando…" : "Guardar colores"}
                  </Boton>
                  <BotonSuave
                    type="button"
                    disabled={guardando}
                    onClick={() =>
                      conError(async () => {
                        await adminApi.restablecerTema("CLARO");
                        return adminApi.restablecerTema("OSCURO");
                      })
                    }
                  >
                    Restablecer los colores
                  </BotonSuave>
                </div>
              }
            />
          </Bloque>
        </form>
      )}
    </div>
  );
}

/**
 * De qué formulario sale la marca de cada gremio.
 *
 * La apariencia solo existe a nivel de formulario, así que hay
 * que decir cuál de ellos le da su cara al subdominio. Va aquí
 * y no en la apariencia de cada formulario porque es una
 * decisión del gremio: hace falta ver los dos a la vez para
 * saber cuál está puesto.
 */
function MarcaDeCadaGremio() {
  const { recargar } = useMarca();
  const [gremios, setGremios] = useState<MarcaDeGremio[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    void adminApi
      .marcaDeGremios()
      .then(setGremios)
      /// Un no aquí solo quiere decir que esta cuenta no es
      /// superadmin: la tarjeta desaparece y no estorba.
      .catch(() => setGremios([]));
  }, []);

  if (!gremios || gremios.length === 0) return null;

  async function elegir(convenioId: string, formularioId: string) {
    setError(null);
    setOcupado(convenioId);
    try {
      setGremios(
        await adminApi.fijarMarcaDeGremio(convenioId, formularioId || null),
      );
      // el panel se repinta con la marca nueva
      await recargar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Bloque titulo="La cara de cada línea de negocio">
      {error && (
        <div className="mb-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}

      {/* LA BAJADA VA AL LADO DE LA TABLA, NO ENCIMA.

          Era la `descripcion` del bloque: cinco renglones de
          prosa topados en 68 ch, encima de una tabla de 888 px,
          y a la derecha de las dos, setecientos píxeles de papel.
          Sin desplazar, esta pantalla usaba el 46 % del ancho a
          1920 —y el 98 % contando lo de abajo, que es justo la
          cifra que escondía el fallo: el hueco estaba donde el
          dueño mira primero.

          La prosa sigue topando en 68 ch, que es lo correcto. Lo
          que cambia es dónde vive: al lado de lo que explica, que
          es la respuesta b) de la regla de lista. Y de paso la
          tabla —que es lo que se viene a mirar— sube ochenta
          píxeles.

          480 px es el tope de la prosa; 360 en la banda de 1440,
          que son unos 48 caracteres y sigue siendo una columna que
          se lee. Por debajo de 1100 se apila como antes: ahí ya no
          es una columna, es un renglón partido. */}
      <div className="@container">
        <div className="grid gap-x-10 gap-y-4 @[1100px]:grid-cols-[minmax(0,1fr)_360px] @[1400px]:grid-cols-[minmax(0,1fr)_480px]">
          {/* EN COLUMNAS, no apilado.

              Cada línea apilaba cinco renglones --sigla, dirección,
              rótulo del campo, desplegable y una ayuda idéntica a la
              de la otra-- dentro de los 720 px de un formulario, con
              mil de blanco al lado. Y esto no es un formulario: es
              una lista de dos filas con un ajuste cada una, y lo que
              se viene a mirar es CUÁL está puesto en cada línea, que
              es una comparación entre filas.

              Con tres columnas, la sigla, la dirección y el
              formulario quedan una debajo de otra, el rótulo se
              escribe UNA vez arriba y la ayuda --que era la misma
              palabra por palabra en las dos-- se dice una vez en
              la bajada del bloque. */}
          <div className="max-w-[960px]">
            <div className={`${REJILLA_LINEAS} border-borde border-b pb-2`}>
              <div className="rotulo-bloque">Línea de negocio</div>
              <div className="rotulo-bloque">Entra por</div>
              <div className="rotulo-bloque">Formulario que le da la marca</div>
            </div>

            {gremios.map((g) => (
              <div
                key={g.id}
                className={`${REJILLA_LINEAS} border-hairline items-center border-b py-3 last:border-b-0`}
              >
                <div className="dato min-w-0 truncate" title={g.nombre}>
                  {g.sigla ?? g.nombre}
                </div>

                <div className="micro min-w-0 truncate" title={g.direccion}>
                  {g.direccion}
                </div>

                {g.formularios.length === 0 ? (
                  <p className="secundario">
                    Todavía no tiene formularios, así que usa la marca general.
                  </p>
                ) : (
                  /* El desplegable de la casa, no el del sistema
                     operativo: el nativo se pinta distinto en cada
                     navegador y en tema oscuro abre una lista
                     blanca. Y aquí gana además que el «(borrador)»
                     quepa como segunda línea en vez de arrastrarse
                     detrás del título. */
                  <Desplegable
                    valor={g.formularioMarcaId ?? ""}
                    desactivado={ocupado === g.id}
                    etiquetaAria={`Formulario que le da la marca a ${g.sigla ?? g.nombre}`}
                    alElegir={(v) => void elegir(g.id, v)}
                    opciones={[
                      { valor: "", etiqueta: "La marca general" },
                      ...g.formularios.map((f) => ({
                        valor: f.id,
                        etiqueta: f.titulo,
                        detalle: f.publicado ? undefined : "En borrador",
                      })),
                    ]}
                  />
                )}
              </div>
            ))}
          </div>

          <p className="secundario prosa">
            Cada línea de negocio entra por su propia dirección, y allí el sitio
            sale con los colores y los logos de uno de sus formularios. Aquí se
            elige cuál. Sin elegir ninguna, esa línea usa la marca general de
            abajo. Vale también uno en borrador: publicar al público y elegir la
            paleta del panel son dos decisiones distintas.
          </p>
        </div>
      </div>
    </Bloque>
  );
}

/// La sigla mide lo que mide una sigla, la dirección lo que mide
/// un subdominio y el desplegable los 360 de `ancho-correo`, que
/// es lo que mide el título de un formulario. Ninguna de las
/// tres se estira hasta el canto: esto es un ajuste, no una
/// tabla de trabajo.
const REJILLA_LINEAS =
  "grid grid-cols-[minmax(120px,200px)_minmax(160px,280px)_minmax(240px,360px)] items-baseline gap-x-6 gap-y-2";

/**
 * Por la puerta de un gremio, esto no se edita aquí.
 *
 * Lo que estos bloques escriben es la marca general -- una
 * sola fila de `marca`, una sola de `temas` y los logos con
 * `formularioId = null` -- así que editarla desde la dirección
 * de un gremio se la cambiaría a los dos. Eso es exactamente
 * el fallo que reportó el cliente: un logo subido entrando por
 * una línea de negocio salía también en la otra.
 *
 * No lleva enlace a ninguna parte: la apariencia del gremio ya
 * está en esta misma pantalla, arriba. Un enlace que se va a
 * otro sitio para hacer lo que se puede hacer aquí es peor que
 * ninguno.
 *
 * Sin la tarjeta teñida de amarillo ni la gris: el color va en
 * la letra, y el ámbar es el reloj de quien espera respuesta.
 */
function AvisoDeGremio({
  gremio,
}: {
  gremio: { sigla: string | null; formularioId: string | null };
}) {
  const nombre = gremio.sigla ?? "esta línea de negocio";

  if (!gremio.formularioId) {
    return (
      <div className="prosa">
        <p className="estado text-titulo">
          {nombre} todavía no tiene una cara propia.
        </p>
        <p className="dato mt-1">
          Elija arriba de qué formulario sale su marca. Hasta entonces usa la
          general, y lo que se cambie aquí lo verían todas las líneas de negocio.
        </p>
      </div>
    );
  }

  return (
    <p className="dato prosa">
      Esto es lo general, lo que comparten todas las líneas de negocio, y por eso
      no se edita desde aquí. Lo de {nombre} está arriba.
    </p>
  );
}
