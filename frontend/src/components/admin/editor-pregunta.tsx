"use client";

import { useState } from "react";

import { Boton, Campo, CLASE_CONTROL } from "@/components/admin/marco-admin";
import {
  ES_TEXTO,
  formulariosApi,
  LLEVA_OPCIONES,
  TIPOS,
  type DefinicionCampoNucleo,
  type FormularioAdmin,
  type PreguntaAdmin,
  type TipoPregunta,
} from "@/lib/formularios-api";

type Accion = (fn: () => Promise<FormularioAdmin>) => Promise<void>;

const ETIQUETA_TIPO = new Map(TIPOS.map((t) => [t.valor, t.etiqueta]));

export function EditorPregunta({
  pregunta,
  formulario,
  campos,
  ocupado,
  accion,
}: {
  pregunta: PreguntaAdmin;
  formulario: FormularioAdmin;
  campos: DefinicionCampoNucleo[];
  ocupado: boolean;
  accion: Accion;
}) {
  const [abierto, setAbierto] = useState(false);

  const definicion = campos.find((c) => c.campo === pregunta.campoNucleo);
  const esNucleo = Boolean(pregunta.campoNucleo);
  const conRespuestas = pregunta._count.respuestas > 0;

  function mover(direccion: -1 | 1) {
    // Se reordena la lista COMPLETA del formulario, no solo la de la sección:
    // el orden es único por formulario y así no se pisan entre secciones.
    const ids = formulario.preguntas
      .filter((p) => !p.archivada)
      .sort((a, b) => a.orden - b.orden)
      .map((p) => p.id);
    const desde = ids.indexOf(pregunta.id);
    const hasta = desde + direccion;
    if (hasta < 0 || hasta >= ids.length) return;
    [ids[desde], ids[hasta]] = [ids[hasta], ids[desde]];
    void accion(() => formulariosApi.reordenarPreguntas(formulario.id, ids));
  }

  return (
    <div className="rounded-lg border border-borde">
      <div className="flex flex-wrap items-start gap-3 p-4">
        <div className="min-w-0 grow">
          <p className="font-medium leading-snug">
            {pregunta.etiqueta}
            {pregunta.obligatoria && <span className="text-error"> *</span>}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texto-suave">
            <span>{ETIQUETA_TIPO.get(pregunta.tipo) ?? pregunta.tipo}</span>
            {esNucleo && (
              <span className="rounded bg-marca/10 px-1.5 py-0.5 font-medium text-marca">
                campo del sistema
              </span>
            )}
            {pregunta.opciones.filter((o) => !o.archivada).length > 0 && (
              <span>{pregunta.opciones.filter((o) => !o.archivada).length} opciones</span>
            )}
            {pregunta.dependeDePreguntaId && <span>condicional</span>}
            {conRespuestas && <span>{pregunta._count.respuestas} respuestas</span>}
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-sm">
          <button
            onClick={() => mover(-1)}
            disabled={ocupado}
            title="Subir"
            className="rounded border border-borde px-2 py-1 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            onClick={() => mover(1)}
            disabled={ocupado}
            title="Bajar"
            className="rounded border border-borde px-2 py-1 disabled:opacity-30"
          >
            ↓
          </button>
          <button onClick={() => setAbierto(!abierto)} className="text-marca underline">
            {abierto ? "Cerrar" : "Editar"}
          </button>
        </div>
      </div>

      {abierto && (
        <div className="border-t border-borde bg-fondo p-4">
          <Detalle
            pregunta={pregunta}
            formulario={formulario}
            definicion={definicion}
            ocupado={ocupado}
            accion={accion}
          />
        </div>
      )}
    </div>
  );
}

function Detalle({
  pregunta,
  formulario,
  definicion,
  ocupado,
  accion,
}: {
  pregunta: PreguntaAdmin;
  formulario: FormularioAdmin;
  definicion?: DefinicionCampoNucleo;
  ocupado: boolean;
  accion: Accion;
}) {
  const [datos, setDatos] = useState({
    etiqueta: pregunta.etiqueta,
    ayuda: pregunta.ayuda ?? "",
    marcador: pregunta.marcador ?? "",
    tipo: pregunta.tipo,
    obligatoria: pregunta.obligatoria,
    seccionId: pregunta.seccionId ?? "",
    minimo: pregunta.minimo?.toString() ?? "",
    maximo: pregunta.maximo?.toString() ?? "",
    largoMinimo: pregunta.largoMinimo?.toString() ?? "",
    largoMaximo: pregunta.largoMaximo?.toString() ?? "",
    dependeDePreguntaId: pregunta.dependeDePreguntaId ?? "",
    dependeDeValor: pregunta.dependeDeValor ?? "",
  });

  const esNucleo = Boolean(pregunta.campoNucleo);
  const obligatorioFijo = definicion?.obligatorioParaPublicar ?? false;
  const conRespuestas = pregunta._count.respuestas > 0;
  const controlEspecial = definicion?.controlEspecial ?? null;

  function cambiar<C extends keyof typeof datos>(campo: C, valor: (typeof datos)[C]) {
    setDatos((p) => ({ ...p, [campo]: valor }));
  }

  const numero = (v: string) => (v.trim() === "" ? null : Number(v));

  /** Candidatas a condicionar esta: las que van antes y tienen opciones. */
  const madres = formulario.preguntas.filter(
    (p) =>
      p.id !== pregunta.id &&
      !p.archivada &&
      p.orden < pregunta.orden &&
      LLEVA_OPCIONES.includes(p.tipo),
  );
  const madre = madres.find((p) => p.id === datos.dependeDePreguntaId);

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void accion(() =>
            formulariosApi.actualizarPregunta(pregunta.id, {
              etiqueta: datos.etiqueta,
              ayuda: datos.ayuda,
              marcador: datos.marcador,
              tipo: esNucleo ? undefined : datos.tipo,
              obligatoria: obligatorioFijo ? undefined : datos.obligatoria,
              seccionId: datos.seccionId,
              minimo: numero(datos.minimo),
              maximo: numero(datos.maximo),
              largoMinimo: numero(datos.largoMinimo),
              largoMaximo: numero(datos.largoMaximo),
              dependeDePreguntaId: datos.dependeDePreguntaId || null,
              dependeDeValor: datos.dependeDeValor || null,
            }),
          );
        }}
        className="space-y-4"
      >
        <Campo etiqueta="Pregunta">
          <input
            required
            value={datos.etiqueta}
            onChange={(e) => cambiar("etiqueta", e.target.value)}
            className={CLASE_CONTROL}
          />
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Texto de ayuda" ayuda="Se muestra en pequeño bajo el campo.">
            <input
              value={datos.ayuda}
              onChange={(e) => cambiar("ayuda", e.target.value)}
              className={CLASE_CONTROL}
            />
          </Campo>
          <Campo etiqueta="Texto de ejemplo" ayuda="Aparece en gris dentro del campo vacío.">
            <input
              value={datos.marcador}
              onChange={(e) => cambiar("marcador", e.target.value)}
              className={CLASE_CONTROL}
            />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Tipo de respuesta"
            ayuda={
              esNucleo
                ? "Lo impone el campo del sistema."
                : conRespuestas
                  ? `Bloqueado: ya hay ${pregunta._count.respuestas} respuestas. Archive esta pregunta y cree otra.`
                  : undefined
            }
          >
            <select
              value={datos.tipo}
              disabled={esNucleo || conRespuestas}
              onChange={(e) => cambiar("tipo", e.target.value as TipoPregunta)}
              className={`${CLASE_CONTROL} disabled:opacity-60`}
            >
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Sección">
            <select
              value={datos.seccionId}
              onChange={(e) => cambiar("seccionId", e.target.value)}
              className={CLASE_CONTROL}
            >
              <option value="">Sin sección</option>
              {formulario.secciones.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.titulo}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <label className="flex gap-3 text-sm">
          <input
            type="checkbox"
            checked={obligatorioFijo || datos.obligatoria}
            disabled={obligatorioFijo}
            onChange={(e) => cambiar("obligatoria", e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--marca)] disabled:opacity-60"
          />
          <span>
            Obligatoria
            {obligatorioFijo && (
              <span className="block text-texto-suave">
                Este campo del sistema no puede ser opcional.
              </span>
            )}
          </span>
        </label>

        {datos.tipo === "NUMERO" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Valor mínimo">
              <input
                type="number"
                value={datos.minimo}
                onChange={(e) => cambiar("minimo", e.target.value)}
                className={CLASE_CONTROL}
              />
            </Campo>
            <Campo etiqueta="Valor máximo">
              <input
                type="number"
                value={datos.maximo}
                onChange={(e) => cambiar("maximo", e.target.value)}
                className={CLASE_CONTROL}
              />
            </Campo>
          </div>
        )}

        {ES_TEXTO.includes(datos.tipo) && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Mínimo de caracteres">
              <input
                type="number"
                min={0}
                value={datos.largoMinimo}
                onChange={(e) => cambiar("largoMinimo", e.target.value)}
                className={CLASE_CONTROL}
              />
            </Campo>
            <Campo etiqueta="Máximo de caracteres">
              <input
                type="number"
                min={1}
                value={datos.largoMaximo}
                onChange={(e) => cambiar("largoMaximo", e.target.value)}
                className={CLASE_CONTROL}
              />
            </Campo>
          </div>
        )}

        <div className="rounded-lg border border-borde bg-superficie p-4">
          <p className="text-sm font-medium">Mostrar solo si…</p>
          <p className="mt-1 text-xs text-texto-suave">
            Deja la pregunta oculta hasta que otra tenga cierto valor. Es lo que
            permite el clásico «Otro → ¿cuál?».
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select
              value={datos.dependeDePreguntaId}
              onChange={(e) => {
                cambiar("dependeDePreguntaId", e.target.value);
                cambiar("dependeDeValor", "");
              }}
              className={CLASE_CONTROL}
            >
              <option value="">Mostrar siempre</option>
              {madres.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.etiqueta.slice(0, 60)}
                </option>
              ))}
            </select>

            <select
              value={datos.dependeDeValor}
              disabled={!madre}
              onChange={(e) => cambiar("dependeDeValor", e.target.value)}
              className={`${CLASE_CONTROL} disabled:opacity-60`}
            >
              <option value="">…responde</option>
              {madre?.opciones
                .filter((o) => !o.archivada)
                .map((o) => (
                  <option key={o.id} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
            </select>
          </div>
          {madres.length === 0 && (
            <p className="mt-2 text-xs text-texto-suave">
              No hay ninguna pregunta de opciones antes de esta.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Boton type="submit" disabled={ocupado}>
            Guardar pregunta
          </Boton>
          {!esNucleo && (
            <button
              type="button"
              onClick={() =>
                accion(() => formulariosApi.actualizarPregunta(pregunta.id, { archivada: true }))
              }
              className="text-sm text-error underline"
            >
              Archivar
            </button>
          )}
          {esNucleo && (
            <span className="text-xs text-texto-suave">
              Los campos del sistema no se pueden archivar: sin ellos no se puede
              crear la reserva.
            </span>
          )}
        </div>
      </form>

      {LLEVA_OPCIONES.includes(datos.tipo) && !controlEspecial && (
        <Opciones pregunta={pregunta} ocupado={ocupado} accion={accion} />
      )}

      {controlEspecial && (
        <p className="rounded-lg border border-borde bg-superficie p-3 text-xs text-texto-suave">
          Las opciones de este campo salen del catálogo publicado y se calculan
          solas; aquí solo se cambian la etiqueta y la ayuda.
        </p>
      )}
    </div>
  );
}

function Opciones({
  pregunta,
  ocupado,
  accion,
}: {
  pregunta: PreguntaAdmin;
  ocupado: boolean;
  accion: Accion;
}) {
  const [nueva, setNueva] = useState("");
  const activas = pregunta.opciones.filter((o) => !o.archivada);
  const archivadas = pregunta.opciones.filter((o) => o.archivada);

  function mover(indice: number, direccion: -1 | 1) {
    const ids = activas.map((o) => o.id);
    const hasta = indice + direccion;
    if (hasta < 0 || hasta >= ids.length) return;
    [ids[indice], ids[hasta]] = [ids[hasta], ids[indice]];
    void accion(() => formulariosApi.reordenarOpciones(pregunta.id, ids));
  }

  return (
    <div className="rounded-lg border border-borde bg-superficie p-4">
      <p className="text-sm font-medium">Opciones</p>

      <ul className="mt-3 divide-y divide-borde">
        {activas.map((opcion, indice) => (
          <li key={opcion.id} className="flex items-center gap-2 py-2 text-sm">
            <span className="grow">{opcion.etiqueta}</span>
            <button
              onClick={() => mover(indice, -1)}
              disabled={indice === 0 || ocupado}
              className="rounded border border-borde px-1.5 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              onClick={() => mover(indice, 1)}
              disabled={indice === activas.length - 1 || ocupado}
              className="rounded border border-borde px-1.5 disabled:opacity-30"
            >
              ↓
            </button>
            <button
              onClick={() => accion(() => formulariosApi.eliminarOpcion(opcion.id))}
              className="text-error underline"
            >
              Quitar
            </button>
          </li>
        ))}
        {activas.length === 0 && (
          <li className="py-2 text-sm text-aviso">
            Sin opciones el desplegable sale vacío y bloquea el envío.
          </li>
        )}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void accion(() => formulariosApi.crearOpcion(pregunta.id, { etiqueta: nueva })).then(
            () => setNueva(""),
          );
        }}
        className="mt-3 flex gap-2"
      >
        <input
          required
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          placeholder="Nueva opción"
          className={CLASE_CONTROL}
        />
        <Boton type="submit" disabled={ocupado}>
          Añadir
        </Boton>
      </form>

      {archivadas.length > 0 && (
        <div className="mt-3 text-xs text-texto-suave">
          <p>
            {archivadas.length} opciones archivadas: ya alguien las eligió, así que
            no se borran para no dejar sus respuestas apuntando a la nada.
          </p>
          <ul className="mt-1 space-y-1">
            {archivadas.map((o) => (
              <li key={o.id} className="flex items-center gap-2">
                <span className="line-through">{o.etiqueta}</span>
                <button
                  onClick={() =>
                    accion(() => formulariosApi.actualizarOpcion(o.id, { archivada: false }))
                  }
                  className="text-marca underline"
                >
                  restaurar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
