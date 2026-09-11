"use client";

import { useRouter } from "next/navigation";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import { ANCHO_FORMULARIO, BloqueDeBanda, Rotulo } from "@/components/admin/bloques";
import { EditorPregunta } from "@/components/admin/editor-pregunta";
import { EnlaceConCampana } from "@/components/admin/enlace-con-campana";
import { LoQueHaTraido } from "@/components/admin/leads-de-la-puerta";
import { Boton, Campo, CLASE_CONTROL } from "@/components/admin/marco-admin";
import { Esqueleto } from "@/components/admin/piezas";
import { AvisoDeSeccion, Seccion } from "@/components/admin/secciones";
import { ErrorApi } from "@/lib/api";
import { campanasApi } from "@/lib/campanas-api";
import { oportunidadesApi, type ResumenDeVentas } from "@/lib/oportunidades-api";
import {
  formulariosApi,
  TIPOS,
  type DefinicionCampoNucleo,
  type FormularioAdmin,
  type PreguntaAdmin,
  type TipoPregunta,
} from "@/lib/formularios-api";

export default function PaginaConstructor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [formulario, setFormulario] = useState<FormularioAdmin | null>(null);
  const [campos, setCampos] = useState<DefinicionCampoNucleo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  /// El embudo y las campañas de correo, para la tarjeta de la
  /// puerta. Si fallan no se dice nada: se viene aquí a armar el
  /// formulario, y un error rojo por una cifra de apoyo tapa lo
  /// que sí importa.
  const [resumen, setResumen] = useState<ResumenDeVentas | null>(null);
  const [campanas, setCampanas] = useState<string[]>([]);

  const cargar = useCallback(async () => {
    setFormulario(await formulariosApi.obtener(id));
  }, [id]);

  useEffect(() => {
    void cargar();
    void formulariosApi.camposNucleo().then(setCampos);
    void oportunidadesApi.resumen().then(setResumen).catch(() => undefined);
    void campanasApi
      .listar()
      .then((cs) => setCampanas([...new Set(cs.map((c) => c.nombre))]))
      .catch(() => undefined);
  }, [cargar]);

  /** Ejecuta una acción y reemplaza el formulario. */
  const router = useRouter();

  const accion = useCallback(async (fn: () => Promise<FormularioAdmin>) => {
    setError(null);
    setOcupado(true);
    try {
      setFormulario(await fn());
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }, []);

  if (!formulario) return <Esqueleto filas={5} />;

  const activas = formulario.preguntas.filter((p) => !p.archivada);
  const archivadas = formulario.preguntas.filter((p) => p.archivada);
  const usados = new Set(activas.map((p) => p.campoNucleo).filter(Boolean));
  const disponibles = campos.filter((c) => !usados.has(c.campo));

  return (
    <div>
      {/* La cabecera de la pantalla, con el mismo relleno y el
          mismo tamaño de título que las otras catorce: 21/700 y
          el enlace de vuelta encima. Iba a 24 px en semibold,
          que es un décimo tamaño de letra. */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-borde bg-superficie px-6 pt-3.5 pb-[22px]">
        <div className="min-w-0">
          <Link
            href="/admin/formularios"
            className="text-marca"
            style={{ fontSize: "0.8125rem" }}
          >
            ← Formularios
          </Link>
          <h1
            className="mt-2 font-bold text-titulo"
            style={{ fontSize: "1.3125rem", letterSpacing: "-0.02em" }}
          >
            {formulario.titulo}
          </h1>
          {/* El identificador es una LLAVE para buscar y pegar,
              no un dato: va en micro y apagado, y nunca compite
              con el nombre del formulario. */}
          <p
            className="mt-1 text-texto-suave tabular-nums"
            style={{ fontSize: "0.65625rem", letterSpacing: "0.02em" }}
          >
            /{formulario.slug}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {/* Navegar no es ejecutar: «Respuestas» y «Apariencia»
              llevan a otro sitio y van en la letra. Dos cajas
              con borde al lado del botón principal lo dejaban
              en empate con él. */}
          <Link
            href={`/admin/formularios/${id}/respuestas`}
            className="text-marca"
            style={{ fontSize: "0.71875rem" }}
          >
            Respuestas
          </Link>
          <Link
            href={`/admin/formularios/${id}/apariencia`}
            className="text-marca"
            style={{ fontSize: "0.71875rem" }}
          >
            Apariencia
          </Link>
          {/* El color va en la letra: sin caja, sin fondo y sin
              radio. Era la última píldora que quedaba de este
              par —la lista de formularios ya la había quitado—
              y dos pantallas del mismo objeto pintaban el mismo
              estado de dos maneras. */}
          <span
            className={formulario.publicado ? "text-exito" : "text-texto-suave"}
            style={{ fontSize: "0.8125rem", fontWeight: 600 }}
          >
            {formulario.publicado ? "Publicado" : "Borrador"}
          </span>
          <Boton
            type="button"
            disabled={ocupado || (!formulario.publicado && formulario.problemas.length > 0)}
            onClick={() =>
              accion(() =>
                formulariosApi.actualizar(id, { publicado: !formulario.publicado }),
              )
            }
          >
            {formulario.publicado ? "Despublicar" : "Publicar"}
          </Boton>

          {/* BORRAR. El backend lo permitía desde siempre y la
              pantalla no lo ofrecía: quien creaba un
              formulario por equivocación se quedaba con él
              para siempre, ocupando sitio en la lista.

              Solo si NO está publicado: despublicar primero es
              un paso a propósito, para que borrar nunca sea el
              primer clic sobre algo que está en la calle. Y si
              tiene respuestas, el servidor se niega y lo dice
              —el histórico no se tira por limpiar la lista. */}
          {!formulario.publicado && (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => {
                if (
                  !window.confirm(
                    `¿Borrar «${formulario.titulo}»?

` +
                      'Se va con sus secciones y sus preguntas, y no se ' +
                      'puede deshacer. Si ya tiene respuestas, el sistema ' +
                      'no lo va a dejar.',
                  )
                ) {
                  return;
                }
                void (async () => {
                  setOcupado(true);
                  try {
                    await formulariosApi.eliminar(id);
                    router.push("/admin/formularios");
                  } catch (e) {
                    setError((e as ErrorApi).message);
                    setOcupado(false);
                  }
                })();
              }}
              className="text-texto-suave disabled:opacity-50"
              style={{ fontSize: "0.71875rem" }}
            >
              Borrar
            </button>
          )}
        </div>
      </header>

      {error && <AvisoDeSeccion color="var(--texto-suave)">{error}</AvisoDeSeccion>}

      {/* LA PUERTA, ANTES QUE EL CONSTRUCTOR.

          Un formulario es dos cosas y hasta ahora esta pantalla
          solo enseñaba una: qué preguntas tiene. La otra —por
          dónde se reparte y cuántos negocios ha traído— es la
          que se mira para decidir si se sigue pagando el
          anuncio, y por eso va arriba del todo. */}
      <Seccion>
        <div className="@container px-6 pt-5 pb-6">
          <BloqueDeBanda
            rotulo="Por esta puerta"
            /* Sin nota cuando está publicado: el bloque enseña
               la cuenta y el enlace, y decir «lo que ha entrado
               y la dirección con la que se reparte» es ponerle
               nombre a lo que ya se está viendo. Cuando NO lo
               está sí hace falta, porque lo que se nota es una
               ausencia y no se puede adivinar por qué. */
            nota={
              formulario.publicado
                ? undefined
                : "Sin publicar no tiene dirección pública. Lo que ya entró se sigue contando."
            }
          >
            {/* EL ENLACE Y SU QR, AL LADO Y NO DEBAJO.

                Aquí el ancho sobrante SÍ tiene dueño. La cuenta
                de lo que entró es una tabla de cuatro columnas
                que se lee de arriba abajo; el enlace es un
                formulario de dos campos con un QR de 190 px al
                canto. Uno debajo del otro, a 1920 los dos
                estiraban lo suyo hasta el borde —el campo del
                anuncio medía 1190 px para escribir
                «meta-octubre» y el QR quedaba a 1400 px de su
                propia etiqueta— y la ficha se iba a dos
                pantallas de alto.

                Al lado, cada región mide lo que mide su
                contenido: 760 px es el enlace con su QR
                —540 + 28 + 190— y lo que quede es de la tabla,
                que es la que crece con cada anuncio nuevo.

                A partir de 1400 px de ESTA caja, no de la
                ventana: la barra lateral se pliega y la banda
                gana 180 px sin que la ventana cambie. Por
                debajo vuelven a apilarse, que con 640 px de
                ancho es lo correcto. */}
            <div
              className={`grid gap-x-8 gap-y-6 ${
                formulario.publicado
                  ? "@[1400px]:grid-cols-[minmax(0,1fr)_760px]"
                  : ""
              }`}
            >
              <div className="min-w-0">
                <LoQueHaTraido slug={formulario.slug} resumen={resumen} />
              </div>

              {formulario.publicado && (
                <div className="min-w-0 border-t border-hairline pt-5 @[1400px]:border-t-0 @[1400px]:border-l @[1400px]:border-l-hairline @[1400px]:pt-0 @[1400px]:pl-8">
                  {/* Su propio rótulo, que es lo que separa un
                      bloque del de al lado: sin él, los campos
                      del anuncio se leerían como una columna más
                      de la tabla de la izquierda. */}
                  <Rotulo className="mb-3">El enlace que se reparte</Rotulo>
                  <EnlaceConCampana
                    slug={formulario.slug}
                    ruta={`/${formulario.slug}`}
                    titulo={formulario.titulo}
                    campanas={campanas}
                  />
                </div>
              )}
            </div>
          </BloqueDeBanda>
        </div>
      </Seccion>

      {/* Recién creado, esto NO es una advertencia: es la lista
          de lo que hay que armar.

          Un formulario nuevo nace vacío, así que le faltan las
          nueve preguntas obligatorias siempre. Pintarlo en
          ámbar y decir «FALTA ESTO» le dice a quien acaba de
          crearlo que hizo algo mal, cuando lo único que pasa
          es que todavía no ha empezado.

          Con preguntas dentro sí es un aviso: ahí sí se
          intentó y quedó algo por fuera.

          Y SIN CAJA TEÑIDA, ni gris ni ámbar.

          `--aviso-suave` se usa en un solo sitio del panel —la
          franja de entorno de pruebas— y el ámbar significa una
          sola cosa: que alguien lleva esperando respuesta. Lo
          que falta para publicar no es una espera; es una lista,
          y se lee como una lista. */}
      {formulario.problemas.length > 0 && (
        <Seccion>
          <div
            className="max-w-[68ch] px-6 py-4"
            style={{ fontSize: "0.8125rem", lineHeight: 1.5 }}
          >
            {formulario.preguntas.length === 0 ? (
              <>
                <p className="text-titulo" style={{ fontWeight: 700 }}>
                  Este formulario todavía está vacío. Esto es lo que hay que
                  ponerle:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-texto-suave">
                  {formulario.problemas.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <p className="mt-3 text-texto-suave">
                  Se añaden abajo, con «Añadir pregunta» dentro de una sección. Lo
                  que escriba se guarda solo; publicar es aparte.
                </p>
              </>
            ) : (
              <>
                <p className="text-titulo" style={{ fontWeight: 700 }}>
                  Falta esto para poder publicar ({formulario.problemas.length}):
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-texto-suave">
                  {formulario.problemas.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Seccion>
      )}


      <DatosGenerales formulario={formulario} accion={accion} ocupado={ocupado} />

      {/* Secciones y sus preguntas */}
      {formulario.secciones.map((seccion, indice) => (
        <BloqueSeccion
          key={seccion.id}
          seccion={seccion}
          esPrimera={indice === 0}
          esUltima={indice === formulario.secciones.length - 1}
          formulario={formulario}
          campos={campos}
          disponibles={disponibles}
          ocupado={ocupado}
          accion={accion}
        />
      ))}

      {/* preguntas sin sección */}
      {activas.some((p) => !p.seccionId) && (
        <Seccion>
          <div className="px-6 pt-5 pb-6">
          <BloqueDeBanda
            rotulo="Sin sección"
            nota="Estas preguntas se muestran al final del formulario. Asígneles una sección para ordenarlas."
          >
          <div className="space-y-3">
            {activas
              .filter((p) => !p.seccionId)
              .map((p) => (
                <EditorPregunta
                  key={p.id}
                  pregunta={p}
                  formulario={formulario}
                  campos={campos}
                  ocupado={ocupado}
                  accion={accion}
                />
              ))}
          </div>
          </BloqueDeBanda>
          </div>
        </Seccion>
      )}

      <NuevaSeccion id={id} accion={accion} ocupado={ocupado} />

      {archivadas.length > 0 && (
        <Seccion>
          <div className="px-6 pt-5 pb-6">
          <BloqueDeBanda
            rotulo={`Archivadas (${archivadas.length})`}
            nota="No se muestran en el formulario, pero sus respuestas siguen guardadas."
          >
          <ul className="max-w-[720px] divide-y divide-hairline" style={{ fontSize: "0.8125rem" }}>
            {archivadas.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 py-[7px]">
                <span className="text-texto-suave">{p.etiqueta}</span>
                <button
                  onClick={() =>
                    accion(() => formulariosApi.actualizarPregunta(p.id, { archivada: false }))
                  }
                  className="text-marca"
                >
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
          </BloqueDeBanda>
          </div>
        </Seccion>
      )}
    </div>
  );
}

// bloques del constructor

function DatosGenerales({
  formulario,
  accion,
  ocupado,
}: {
  formulario: FormularioAdmin;
  accion: (fn: () => Promise<FormularioAdmin>) => Promise<void>;
  ocupado: boolean;
}) {
  const [titulo, setTitulo] = useState(formulario.titulo);
  const [descripcion, setDescripcion] = useState(formulario.descripcion ?? "");
  const [mensajeExito, setMensajeExito] = useState(formulario.mensajeExito ?? "");

  return (
    <Seccion>
      <div className="px-6 pt-5 pb-6">
      <BloqueDeBanda
        rotulo="Textos del formulario"
        nota={
        <>
          Son los que se leen en{" "}
          <Link
            href={`/${formulario.slug}`}
            target="_blank"
            className="text-marca tabular-nums"
          >
            /{formulario.slug}
          </Link>
          , no solo aquí dentro.
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void accion(() =>
            formulariosApi.actualizar(formulario.id, { titulo, descripcion, mensajeExito }),
          );
        }}
        className={`${ANCHO_FORMULARIO} space-y-4`}
      >
        <Campo etiqueta="Título" ayuda="El titular de la página pública.">
          <input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className={CLASE_CONTROL}
          />
        </Campo>
        <Campo etiqueta="Introducción" ayuda="Se muestra bajo el título, antes de las preguntas.">
          <textarea
            rows={3}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className={CLASE_CONTROL}
          />
        </Campo>
        <Campo
          etiqueta="Mensaje al terminar"
          ayuda="Lo que lee la persona tras enviar el formulario. Si lo deja vacío se usa el texto por defecto."
        >
          <textarea
            rows={2}
            value={mensajeExito}
            onChange={(e) => setMensajeExito(e.target.value)}
            className={CLASE_CONTROL}
          />
        </Campo>
        <Boton type="submit" disabled={ocupado}>
          Guardar textos
        </Boton>
      </form>
      </BloqueDeBanda>
      </div>
    </Seccion>
  );
}

function BloqueSeccion({
  seccion,
  esPrimera,
  esUltima,
  formulario,
  campos,
  disponibles,
  ocupado,
  accion,
}: {
  seccion: FormularioAdmin["secciones"][number];
  esPrimera: boolean;
  esUltima: boolean;
  formulario: FormularioAdmin;
  campos: DefinicionCampoNucleo[];
  disponibles: DefinicionCampoNucleo[];
  ocupado: boolean;
  accion: (fn: () => Promise<FormularioAdmin>) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(seccion.titulo);
  const [descripcion, setDescripcion] = useState(seccion.descripcion ?? "");

  const preguntas = formulario.preguntas
    .filter((p) => p.seccionId === seccion.id && !p.archivada)
    .sort((a, b) => a.orden - b.orden);

  function mover(direccion: -1 | 1) {
    const ids = formulario.secciones.map((s) => s.id);
    const desde = ids.indexOf(seccion.id);
    const hasta = desde + direccion;
    if (hasta < 0 || hasta >= ids.length) return;
    [ids[desde], ids[hasta]] = [ids[hasta], ids[desde]];
    void accion(() => formulariosApi.reordenarSecciones(formulario.id, ids));
  }

  return (
    <section className="border-b border-borde bg-superficie px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {editando ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void accion(() =>
                formulariosApi.actualizarSeccion(seccion.id, { titulo, descripcion }),
              ).then(() => setEditando(false));
            }}
            className="w-full space-y-3"
          >
            <input
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className={CLASE_CONTROL}
            />
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción (opcional)"
              className={CLASE_CONTROL}
            />
            <div className="flex gap-3">
              <Boton type="submit" disabled={ocupado}>
                Guardar
              </Boton>
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="text-texto-suave"
                style={{ fontSize: "0.71875rem" }}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <>
            <div>
              <h2 className="font-bold uppercase text-texto-suave" style={{ fontSize: "0.625rem", letterSpacing: "0.11em", lineHeight: 1.2 }}>
                {seccion.titulo}
              </h2>
              {seccion.descripcion && (
                <p className="mt-2 max-w-[68ch] text-texto-suave" style={{ fontSize: "0.71875rem" }}>
                  {seccion.descripcion}
                </p>
              )}
            </div>
            <div className="flex items-center gap-x-4" style={{ fontSize: "0.71875rem" }}>
              <button
                onClick={() => mover(-1)}
                disabled={esPrimera || ocupado}
                title="Subir sección"
                className="rounded-[6px] border border-borde px-2 py-[3px] text-texto-suave disabled:opacity-40"
              >
                ↑
              </button>
              <button
                onClick={() => mover(1)}
                disabled={esUltima || ocupado}
                title="Bajar sección"
                className="rounded-[6px] border border-borde px-2 py-[3px] text-texto-suave disabled:opacity-40"
              >
                ↓
              </button>
              <button onClick={() => setEditando(true)} className="text-marca">
                Editar
              </button>
              <button
                onClick={() => {
                  if (
                    !window.confirm(
                      "Se borra la sección. Sus preguntas NO se borran: quedan al final del formulario.",
                    )
                  )
                    return;
                  void accion(() => formulariosApi.eliminarSeccion(seccion.id));
                }}
                className="text-texto-suave"
              >
                Borrar
              </button>
            </div>
          </>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {preguntas.map((p) => (
          <EditorPregunta
            key={p.id}
            pregunta={p}
            formulario={formulario}
            campos={campos}
            ocupado={ocupado}
            accion={accion}
          />
        ))}
        {preguntas.length === 0 && (
          <p className="text-texto-suave" style={{ fontSize: "0.71875rem" }}>
            Esta sección no tiene preguntas todavía.
          </p>
        )}
      </div>

      <NuevaPregunta
        formularioId={formulario.id}
        seccionId={seccion.id}
        disponibles={disponibles}
        ocupado={ocupado}
        accion={accion}
      />
    </section>
  );
}

function NuevaPregunta({
  formularioId,
  seccionId,
  disponibles,
  ocupado,
  accion,
}: {
  formularioId: string;
  seccionId: string;
  disponibles: DefinicionCampoNucleo[];
  ocupado: boolean;
  accion: (fn: () => Promise<FormularioAdmin>) => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [etiqueta, setEtiqueta] = useState("");
  const [tipo, setTipo] = useState<TipoPregunta>("TEXTO_CORTO");
  const [campoNucleo, setCampoNucleo] = useState("");

  const definicion = disponibles.find((c) => c.campo === campoNucleo);

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="mt-4 w-full max-w-[720px] rounded-[6px] border border-dashed border-campo-borde py-2.5 text-texto-suave transition hover:border-marca hover:text-marca"
        style={{ fontSize: "0.71875rem" }}
      >
        + Añadir pregunta
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void accion(() =>
          formulariosApi.crearPregunta(formularioId, {
            etiqueta: etiqueta || definicion?.etiquetaSugerida || "Pregunta",
            tipo,
            seccionId,
            campoNucleo: campoNucleo ? (campoNucleo as never) : undefined,
          }),
        ).then(() => {
          setAbierto(false);
          setEtiqueta("");
          setCampoNucleo("");
          setTipo("TEXTO_CORTO");
        });
      }}
      className="mt-4 max-w-[720px] space-y-4 rounded-[6px] border border-borde p-4"
    >
      <Campo
        etiqueta="¿Es un campo que el sistema necesita?"
        ayuda={
          definicion?.descripcion ??
          "Los campos del sistema alimentan el lead (NIT, servicio de interés...). El resto son preguntas libres."
        }
      >
        <select
          value={campoNucleo}
          onChange={(e) => {
            setCampoNucleo(e.target.value);
            const d = disponibles.find((c) => c.campo === e.target.value);
            if (d) {
              setTipo(d.tipo);
              if (!etiqueta) setEtiqueta(d.etiquetaSugerida);
            }
          }}
          className={CLASE_CONTROL}
        >
          <option value="">No, es una pregunta libre</option>
          {disponibles.map((c) => (
            <option key={c.campo} value={c.campo}>
              {c.etiquetaSugerida}
              {c.obligatorioParaPublicar ? " (obligatorio)" : ""}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Pregunta">
        <input
          required
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
          className={CLASE_CONTROL}
        />
      </Campo>

      <Campo
        etiqueta="Tipo de respuesta"
        ayuda={
          definicion
            ? "Lo impone el campo del sistema: si no, dejaría de encajar con el dato al que va."
            : TIPOS.find((t) => t.valor === tipo)?.ayuda
        }
      >
        <select
          value={tipo}
          disabled={Boolean(definicion)}
          onChange={(e) => setTipo(e.target.value as TipoPregunta)}
          className={`${CLASE_CONTROL} disabled:opacity-60`}
        >
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </select>
      </Campo>

      <div className="flex gap-3">
        <Boton type="submit" disabled={ocupado}>
          Añadir
        </Boton>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-texto-suave"
                style={{ fontSize: "0.71875rem" }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function NuevaSeccion({
  id,
  accion,
  ocupado,
}: {
  id: string;
  accion: (fn: () => Promise<FormularioAdmin>) => Promise<void>;
  ocupado: boolean;
}) {
  const [titulo, setTitulo] = useState("");

  return (
    /// Una banda más, no una caja punteada flotando. La raya de
    /// abajo la separa de lo que sigue igual que a las demás.
    <Seccion>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void accion(() => formulariosApi.crearSeccion(id, { titulo })).then(() =>
            setTitulo(""),
          );
        }}
        className={`${ANCHO_FORMULARIO} flex flex-wrap items-end gap-3 px-6 py-4`}
      >
        <input
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título de una sección nueva"
          className={`${CLASE_CONTROL} sm:max-w-[320px]`}
        />
        <Boton type="submit" disabled={ocupado}>
          Añadir sección
        </Boton>
      </form>
    </Seccion>
  );
}
