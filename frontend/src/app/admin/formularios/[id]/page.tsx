"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import { EditorPregunta } from "@/components/admin/editor-pregunta";
import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  Tarjeta,
} from "@/components/admin/marco-admin";
import { ErrorApi } from "@/lib/api";
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

  const cargar = useCallback(async () => {
    setFormulario(await formulariosApi.obtener(id));
  }, [id]);

  useEffect(() => {
    void cargar();
    void formulariosApi.camposNucleo().then(setCampos);
  }, [cargar]);

  /** Ejecuta una acción y reemplaza el formulario. */
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

  if (!formulario) return <p className="text-texto-suave">Cargando…</p>;

  const activas = formulario.preguntas.filter((p) => !p.archivada);
  const archivadas = formulario.preguntas.filter((p) => p.archivada);
  const usados = new Set(activas.map((p) => p.campoNucleo).filter(Boolean));
  const disponibles = campos.filter((c) => !usados.has(c.campo));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/formularios" className="text-sm text-marca hover:underline">
            ← Formularios
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{formulario.titulo}</h1>
          <p className="mt-1 font-mono text-sm text-texto-suave">/{formulario.slug}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/admin/formularios/${id}/respuestas`}
            className="rounded-lg border border-borde px-4 py-2 text-sm hover:bg-fondo"
          >
            Respuestas
          </Link>
          <Link
            href={`/admin/formularios/${id}/apariencia`}
            className="rounded-lg border border-borde px-4 py-2 text-sm hover:bg-fondo"
          >
            Apariencia
          </Link>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              formulario.publicado ? "bg-exito-suave text-exito" : "bg-fondo text-texto-suave"
            }`}
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
        </div>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {formulario.problemas.length > 0 && (
        <div className="rounded-lg border border-aviso/30 bg-aviso-suave p-4 text-sm text-aviso">
          <p className="font-medium">
            Falta esto para poder publicar ({formulario.problemas.length}):
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {formulario.problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
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
        <Tarjeta
          titulo="Sin sección"
          descripcion="Estas preguntas se muestran al final del formulario. Asígneles una sección para ordenarlas."
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
        </Tarjeta>
      )}

      <NuevaSeccion id={id} accion={accion} ocupado={ocupado} />

      {archivadas.length > 0 && (
        <Tarjeta
          titulo={`Archivadas (${archivadas.length})`}
          descripcion="No se muestran en el formulario, pero sus respuestas siguen guardadas."
        >
          <ul className="divide-y divide-borde text-sm">
            {archivadas.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 py-3">
                <span className="text-texto-suave">{p.etiqueta}</span>
                <button
                  onClick={() =>
                    accion(() => formulariosApi.actualizarPregunta(p.id, { archivada: false }))
                  }
                  className="text-marca underline"
                >
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </Tarjeta>
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
    <Tarjeta
      titulo="Textos del formulario"
      descripcion={
        <>
          Son los que se leen en{" "}
          <Link
            href={`/${formulario.slug}`}
            target="_blank"
            className="font-mono text-marca hover:underline"
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
        className="space-y-4"
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
          ayuda="Lo que lee la persona tras reservar. Si lo deja vacío se usa el texto por defecto."
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
    </Tarjeta>
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
    <section className="rounded-xl border border-borde bg-superficie p-6">
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
                className="text-sm text-texto-suave underline"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-medium">{seccion.titulo}</h2>
              {seccion.descripcion && (
                <p className="mt-1 text-sm text-texto-suave">{seccion.descripcion}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => mover(-1)}
                disabled={esPrimera || ocupado}
                title="Subir sección"
                className="rounded border border-borde px-2 py-1 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => mover(1)}
                disabled={esUltima || ocupado}
                title="Bajar sección"
                className="rounded border border-borde px-2 py-1 disabled:opacity-30"
              >
                ↓
              </button>
              <button onClick={() => setEditando(true)} className="text-marca underline">
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
                className="text-error underline"
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
          <p className="text-sm text-texto-suave">Esta sección no tiene preguntas todavía.</p>
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
        className="mt-4 w-full rounded-lg border border-dashed border-borde py-3 text-sm text-texto-suave transition hover:border-marca hover:text-marca"
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
      className="mt-4 space-y-4 rounded-lg border border-borde bg-fondo p-4"
    >
      <Campo
        etiqueta="¿Es un campo que el sistema necesita?"
        ayuda={
          definicion?.descripcion ??
          "Los campos del sistema alimentan la reserva (NIT, cupos, curso...). El resto son preguntas libres."
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
          className="text-sm text-texto-suave underline"
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void accion(() => formulariosApi.crearSeccion(id, { titulo })).then(() =>
          setTitulo(""),
        );
      }}
      className="flex flex-wrap gap-3 rounded-xl border border-dashed border-borde p-4"
    >
      <input
        required
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título de una sección nueva"
        className={`${CLASE_CONTROL} sm:max-w-md`}
      />
      <Boton type="submit" disabled={ocupado}>
        Añadir sección
      </Boton>
    </form>
  );
}
