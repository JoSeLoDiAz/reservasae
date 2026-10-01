"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Aviso, Boton, Tarjeta } from "@/components/admin/marco-admin";
import { bonito, ErrorApi } from "@/lib/api";
import {
  ETIQUETA_CAMPO,
  ETIQUETA_CLASIFICACION,
  ETIQUETA_FUENTE,
  ETIQUETA_TAMANO,
  institucionesApi,
  type ClasificacionEmpresa,
  type FuenteDato,
  type PropuestaPendiente,
  type TamanoEmpresa,
} from "@/lib/instituciones-api";

/// El color de la fuente no decora: dice el riesgo. WEB es la
/// unica que salio de una pagina cualquiera, asi que es la
/// unica en amarillo de aviso. RUES es oficial y va en verde;
/// la carga inicial y lo escrito a mano quedan neutras. Son las
/// mismas clases del listado y de la ficha: si aqui el amarillo
/// significara otra cosa, habria que reaprender la pantalla.
const ESTILO_FUENTE: Record<FuenteDato, string> = {
  WEB: "border-aviso/40 bg-aviso-suave font-semibold text-aviso",
  RUES: "border-exito/30 bg-exito-suave text-exito",
  CARGA: "border-borde bg-superficie-alterna text-texto-suave",
  HUMANO: "border-borde bg-superficie-alterna text-texto-suave",
};

/// Lo que hay que saber de esa fuente antes de marcar nada. Va
/// dentro de la tarjeta y no en una ayuda plegada: si hay que
/// ir a buscarlo, nadie lo lee y se acepta a ciegas.
const NOTA_FUENTE: Record<FuenteDato, string> = {
  WEB:
    "Sugerido, sin verificar. Lo sacó un buscador de una página pública y nadie lo ha " +
    "comprobado: mientras no se acepte aquí, nada de esto se reporta al SENA. Marque " +
    "solo lo que haya contrastado con la organización.",
  RUES:
    "Viene del RUES, que es fuente oficial. Aun así, en el registro queda únicamente lo " +
    "que usted marque.",
  CARGA:
    "Viene del archivo con el que se sembró el sistema. Nadie lo ha revisado desde " +
    "entonces, así que conviene contrastarlo antes de darlo por bueno.",
  HUMANO:
    "Lo escribió una persona y quedó como propuesta. Sigue haciendo falta que alguien " +
    "la acepte para que quede en el registro.",
};

/// El orden en que la ficha muestra los campos. La bandeja lo
/// repite para que la persona revise siempre en el mismo sitio,
/// aunque la consulta los haya encontrado en otro orden.
const ORDEN_CAMPOS = Object.keys(ETIQUETA_CAMPO);

function ordenarCampos(campos: Record<string, unknown>): string[] {
  const posicion = (clave: string) => {
    const i = ORDEN_CAMPOS.indexOf(clave);
    return i === -1 ? ORDEN_CAMPOS.length : i;
  };
  return Object.keys(campos).sort((a, b) => posicion(a) - posicion(b));
}

function fechaLegible(iso: string): string {
  /// A MEDIODÍA Y NO A MEDIANOCHE.
  ///
  /// `new Date("1998-04-12")` es medianoche UTC, que en Colombia son
  /// las siete de la tarde del 11: la tarjeta decía «11 de abril» de
  /// una propuesta que trae el 12. Poniéndolo a mediodía, ninguna
  /// zona horaria del mundo lo mueve de día.
  const soloDia = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const fecha = soloDia ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** El valor propuesto, escrito como se lee en la ficha. */
function textoValor(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "(vacío)";
  if (campo === "tamano") {
    return ETIQUETA_TAMANO[valor as TamanoEmpresa] ?? String(valor);
  }
  if (campo === "clasificacion") {
    return ETIQUETA_CLASIFICACION[valor as ClasificacionEmpresa] ?? String(valor);
  }
  if (campo === "fechaFundacion") return fechaLegible(String(valor));
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

/// Cuanto lleva esperando, en dias: es la unidad en la que se
/// mide el atraso de una bandeja de revision. La fecha exacta
/// queda en el title, para quien la necesite.
function espera(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (Number.isNaN(dias)) return "sin fecha";
  if (dias <= 0) return "llegó hoy";
  if (dias === 1) return "espera desde ayer";
  if (dias < 31) return `espera hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "espera hace un mes" : `espera hace ${meses} meses`;
}

/** La bandeja de lo que averiguo una consulta y nadie ha revisado. */
/**
 * Las propuestas del buscador web, esperando que alguien las acepte.
 *
 * Era una pagina huerfana: no estaba en el menu y solo se llegaba
 * escribiendo la URL, asi que las propuestas se quedaban ahi sin que
 * nadie supiera que existian. Ahora es la pestania «Por revisar» del
 * banco de empresas, que es donde se buscan.
 */
export function PropuestasPendientes() {
  const [propuestas, setPropuestas] = useState<PropuestaPendiente[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  /// Qué propuestas están marcadas para resolver en lote. Son
  /// propuestas enteras, no campos: en lote no se eligen campos.
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [enLote, setEnLote] = useState<"descartar" | "aceptar" | null>(null);
  /// El lote de aceptar no se dispara al primer clic: primero se
  /// dice en voz alta que entran TODOS los campos.
  const [confirmarAceptar, setConfirmarAceptar] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setPropuestas(await institucionesApi.pendientes());
      setError(null);
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /// Al resolver una se quita de la lista en vez de recargar:
  /// la bandeja se revisa de arriba abajo y volver a pedirla
  /// devolveria a la persona al principio, perdiendo por donde
  /// iba y moviendo de sitio lo que tenia bajo el cursor.
  function quitar(id: string, mensaje: string) {
    setPropuestas((previas) => (previas ?? []).filter((p) => p.id !== id));
    setSeleccion((previa) => previa.filter((s) => s !== id));
    setError(null);
    setExito(mensaje);
  }

  function alternarSeleccion(id: string) {
    setSeleccion((previa) =>
      previa.includes(id) ? previa.filter((s) => s !== id) : [...previa, id],
    );
    setConfirmarAceptar(false);
  }

  const sugeridas = propuestas?.filter((p) => p.fuente === "WEB").length ?? 0;
  const hay = propuestas?.length ?? 0;
  const todasSeleccionadas = hay > 0 && seleccion.length === hay;

  /// Resuelve de golpe lo marcado. Lo que se resolvió se quita
  /// de la lista; si alguna falló se dice cuántas y se queda,
  /// porque seguir viéndola es la única forma de arreglarla.
  async function resolverLote(modo: "descartar" | "aceptar") {
    if (seleccion.length === 0) return;
    const ids = [...seleccion];
    setEnLote(modo);
    try {
      if (modo === "descartar") {
        const r = await institucionesApi.descartarPropuestas(ids);
        setPropuestas((previas) => (previas ?? []).filter((p) => !ids.includes(p.id)));
        setSeleccion([]);
        setError(null);
        setExito(
          `${r.descartadas === 1 ? "1 propuesta descartada" : `${r.descartadas} propuestas descartadas`}. ` +
            "No se modificó ningún dato, y lo descartado no volverá a proponerse." +
            (r.yaResueltas > 0
              ? ` (${r.yaResueltas} ya las había resuelto alguien.)`
              : ""),
        );
      } else {
        const r = await institucionesApi.aceptarPropuestas(ids);
        const fallidas = r.fallidas.map((f) => f.id);
        setPropuestas((previas) =>
          (previas ?? []).filter((p) => !ids.includes(p.id) || fallidas.includes(p.id)),
        );
        setSeleccion(fallidas);
        setExito(
          `${r.aceptadas === 1 ? "Se aceptó 1 propuesta" : `Se aceptaron ${r.aceptadas} propuestas`} y ` +
            `${r.aplicados === 1 ? "entró 1 dato" : `entraron ${r.aplicados} datos`} en el registro. ` +
            "La organización NO queda verificada por esto: lo del buscador sigue sin comprobar.",
        );
        setError(
          r.fallidas.length === 0
            ? null
            : `${r.fallidas.length} no se pudieron aplicar y siguen aquí: ${r.fallidas[0].motivo}`,
        );
      }
    } catch (e) {
      setExito(null);
      setError((e as ErrorApi).message);
    } finally {
      setEnLote(null);
      setConfirmarAceptar(false);
    }
  }

  return (
    /// EL MARGEN LATERAL VA AQUÍ, UNA VEZ, y no en cada hijo: lo
    /// llevaba solo el encabezado y el resto salía pegado al borde.
    <div className="px-4">
      {/* SIN LA EXPLICACIÓN DE ARRIBA: «esto se elimina» (cliente, 1
          oct 2026). Eran cuatro renglones en una tarjeta propia para
          decir una regla que la pantalla ya enseña ---cada campo con su
          casilla, y nada se aplica sin marcarlo---. */}
      {error && (
        <Aviso tipo="error">
          <p>{error}</p>
          <button onClick={() => void cargar()} className="mt-2 underline">
            Reintentar
          </button>
        </Aviso>
      )}

      {exito && <Aviso tipo="exito">{exito}</Aviso>}

      {cargando && <p className="text-texto-suave">Cargando…</p>}

      {!cargando && propuestas && propuestas.length > 0 && (
        <>
          <p className="text-sm text-texto-suave">
            {propuestas.length === 1
              ? "1 propuesta esperando."
              : `${propuestas.length} propuestas esperando, de la más antigua a la más reciente.`}
            {sugeridas > 0 &&
              (sugeridas === 1
                ? " Una la trajo el buscador web: es la que conviene revisar con más cuidado."
                : ` ${sugeridas} las trajo el buscador web: son las que conviene revisar con más cuidado.`)}
          </p>

          {/* La barra de lote: es la salida de una bandeja atascada.
              Resolver de a una cuesta entre dos y siete clics, así que
              con 45 esperando son cientos. Va arriba y fija en el
              flujo, no al final de la lista, porque si hay que bajar
              45 tarjetas para encontrarla no sirve de nada. */}
          <div className="mt-3 rounded-2xl border border-borde bg-superficie-alterna px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={todasSeleccionadas}
                  onChange={() =>
                    setSeleccion(todasSeleccionadas ? [] : propuestas.map((p) => p.id))
                  }
                  disabled={enLote !== null}
                  className="h-4 w-4 accent-marca"
                />
                {todasSeleccionadas
                  ? "Quitar la selección"
                  : `Seleccionar las ${hay} que esperan`}
              </label>

              <span className="text-sm text-texto-suave">
                {seleccion.length === 0
                  ? "Marque propuestas para resolverlas de una sola vez."
                  : `${seleccion.length} seleccionada${seleccion.length === 1 ? "" : "s"}.`}
              </span>

              <div className="ml-auto flex flex-wrap items-center gap-3">
                <button
                  onClick={() => void resolverLote("descartar")}
                  disabled={seleccion.length === 0 || enLote !== null}
                  className="inline-flex items-center justify-center rounded-xl border border-borde px-5 py-2.5 text-sm font-medium text-error transition hover:bg-error-suave disabled:opacity-50"
                >
                  {enLote === "descartar"
                    ? "Descartando…"
                    : seleccion.length === 0
                      ? "Descartar las seleccionadas"
                      : `Descartar ${seleccion.length === 1 ? "la seleccionada" : `las ${seleccion.length} seleccionadas`}`}
                </button>

                <Boton
                  onClick={() => setConfirmarAceptar(true)}
                  disabled={seleccion.length === 0 || enLote !== null || confirmarAceptar}
                >
                  {enLote === "aceptar"
                    ? "Aceptando…"
                    : seleccion.length === 0
                      ? "Aceptar las seleccionadas"
                      : `Aceptar ${seleccion.length === 1 ? "la seleccionada" : `las ${seleccion.length} seleccionadas`}`}
                </Boton>
              </div>
            </div>

            {/* Aceptar en lote NO pregunta campo por campo: entra todo.
                Decirlo después de hacerlo no sirve, así que el aviso se
                interpone entre el clic y la llamada. */}
            {confirmarAceptar && (
              <div className="mt-3 rounded-xl border border-aviso/40 bg-aviso-suave p-3 text-sm text-aviso">
                <p>
                  Aceptar en lote deja entrar <strong>todos los campos</strong> de{" "}
                  {seleccion.length === 1
                    ? "la propuesta seleccionada"
                    : `las ${seleccion.length} propuestas seleccionadas`}
                  , sin elegir uno por uno. Lo
                  que venga del buscador web entrará marcado como sugerido y la
                  organización <strong>no</strong> quedará verificada por ello. Si quiere
                  escoger campos, hágalo propuesta por propuesta.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    onClick={() => void resolverLote("aceptar")}
                    disabled={enLote !== null}
                    className="inline-flex items-center justify-center rounded-xl border border-aviso/50 px-5 py-2.5 text-sm font-medium transition hover:bg-superficie disabled:opacity-50"
                  >
                    Sí, aceptar todos los campos de{" "}
                    {seleccion.length === 1 ? "la propuesta" : `las ${seleccion.length}`}
                  </button>
                  <button
                    onClick={() => setConfirmarAceptar(false)}
                    className="text-sm underline"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* COMO LISTADO, NO COMO TARJETAS: «ajústala para que se vea
              como Por revisar en listado, y los datos, y en Ver algo
              parecido a las notas» (cliente, 1 oct 2026). Eran tarjetas
              de seiscientos píxeles de alto, una debajo de otra, y para
              comparar dos propuestas había que recorrer la pantalla.
              Con cabecera y columnas se ve de un vistazo cuál es de
              quién, de dónde salió y cuánto lleva esperando; el detalle
              ---los campos con sus casillas--- se abre en su sitio,
              igual que una categoría en Configuración notas. */}
          <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
            <div
              className={
                "grid grid-cols-[1.75rem_minmax(14rem,1fr)_9rem_11rem_8rem_4rem] items-center gap-3 px-4" +
                " border-b border-borde bg-superficie-alterna py-2 text-[0.625rem] font-bold tracking-[0.08em] uppercase text-texto-suave"
              }
            >
              <span />
              <span>Organización</span>
              <span>NIT</span>
              <span>Procedencia</span>
              <span>Esperando</span>
              <span className="text-right">Ver</span>
            </div>
            {propuestas.map((propuesta) => (
              <TarjetaPropuesta
                key={propuesta.id}
                propuesta={propuesta}
                seleccionada={seleccion.includes(propuesta.id)}
                alSeleccionar={() => alternarSeleccion(propuesta.id)}
                bloqueada={enLote !== null}
                alResolver={(mensaje) => quitar(propuesta.id, mensaje)}
                alFallar={(mensaje) => {
                  setExito(null);
                  setError(mensaje);
                }}
              />
            ))}
          </div>
        </>
      )}

      {!cargando && propuestas && propuestas.length === 0 && (
        <Tarjeta
          titulo="No hay nada por revisar"
          descripcion="La bandeja está vacía, y no se debe a una falla."
        >
          <div className="max-w-3xl space-y-3 text-sm text-texto-suave">
            {/* El texto decía que el buscador web «no está en
                funcionamiento». Lleva tiempo encendido: era justo esta
                pantalla la que se llenaba. Afirmar lo contrario hacía
                creer que una bandeja con 45 propuestas era un error del
                sistema y no trabajo esperando. */}
            <p>
              Significa que no queda nada pendiente de decidir: cada propuesta que
              llegó se aceptó o se descartó. Y lo que se descartó no vuelve a
              proponerse, así que la bandeja no se rellena sola con lo ya rechazado.
            </p>
            <p>
              Cuando una consulta al buscador web o al RUES encuentre un dato nuevo,
              llegará aquí como propuesta y esperará a que una persona lo acepte campo
              por campo. Mientras tanto, los datos se corrigen a mano desde el registro
              de cada institución.
            </p>
          </div>
        </Tarjeta>
      )}
    </div>
  );
}

function TarjetaPropuesta({
  propuesta,
  seleccionada,
  alSeleccionar,
  bloqueada,
  alResolver,
  alFallar,
}: {
  propuesta: PropuestaPendiente;
  seleccionada: boolean;
  alSeleccionar: () => void;
  /// Hay un lote en marcha: esta tarjeta puede estar dentro.
  bloqueada: boolean;
  alResolver: (mensaje: string) => void;
  alFallar: (mensaje: string) => void;
}) {
  const campos = ordenarCampos(propuesta.campos);
  const sugerida = propuesta.fuente === "WEB";
  const nombre = bonito(propuesta.institucion.razonSocial);

  /// Lo del buscador nace SIN marcar: si llegara marcado, un
  /// clic distraido en «Aplicar» lo dejaria en la ficha, que es
  /// justo lo que la regla prohibe. Lo demas nace marcado
  /// porque ya paso por una fuente oficial o por una persona.
  const [marcados, setMarcados] = useState<string[]>(() => (sugerida ? [] : campos));
  const [trabajando, setTrabajando] = useState<"aplicar" | "descartar" | null>(null);

  const todosMarcados = marcados.length === campos.length;

  function alternar(campo: string) {
    setMarcados((previos) =>
      previos.includes(campo) ? previos.filter((c) => c !== campo) : [...previos, campo],
    );
  }

  async function resolver(modo: "aplicar" | "descartar") {
    setTrabajando(modo);
    try {
      // descartar es aplicar nada: el backend la cierra igual
      const elegidos = modo === "descartar" ? [] : marcados;
      const resultado = await institucionesApi.aplicarPropuesta(propuesta.id, elegidos);

      if (modo === "descartar") {
        alResolver(`Propuesta descartada. No se modificó ningún dato de ${nombre}.`);
        return;
      }

      const aplicados =
        resultado.aplicados === 1
          ? "Se guardó 1 dato"
          : `Se guardaron ${resultado.aplicados} datos`;
      const resto =
        resultado.descartados === 0
          ? ""
          : resultado.descartados === 1
            ? " El otro se descartó."
            : ` Los otros ${resultado.descartados} se descartaron.`;
      alResolver(`${aplicados} en el registro de ${nombre}.${resto}`);
    } catch (e) {
      /// La tarjeta se queda: la propuesta no se resolvio y
      /// quitarla haria creer que el dato ya esta aplicado.
      setTrabajando(null);
      alFallar((e as ErrorApi).message);
    }
  }

  /// El borde amarillo va en la tarjeta entera, no solo en la
  /// pildora: la bandeja se recorre de lejos y una etiqueta
  /// pequena en la esquina no separa lo sugerido de lo oficial
  /// hasta que ya se esta leyendo la tarjeta. Es el mismo borde
  /// que marca la propuesta del buscador en la ficha.
  return (
    <details className="group border-t border-hairline first:border-t-0">
      <summary
        className={
          "grid grid-cols-[1.75rem_minmax(14rem,1fr)_9rem_11rem_8rem_4rem] items-center gap-3 px-4" +
          " sin-aro cursor-pointer list-none py-2.5 text-[0.8125rem] select-none hover:bg-superficie-alterna"
        }
      >
        {/* La marca de la propuesta entera, para el lote. Es distinta de
            las de dentro, que eligen campos: esta dice «esta propuesta
            va en el montón».

            `stopPropagation` y `preventDefault`: va DENTRO del
            `<summary>`, así que sin esto marcar la casilla abriría y
            cerraría la fila de paso. */}
        <input
          type="checkbox"
          checked={seleccionada}
          onChange={alSeleccionar}
          onClick={(e) => e.stopPropagation()}
          disabled={trabajando !== null || bloqueada}
          aria-label={`Seleccionar la propuesta de ${nombre}`}
          className="h-4 w-4 shrink-0 accent-marca"
        />
        <span className="truncate font-medium text-titulo" title={nombre}>
          {nombre}
        </span>
        <span className="font-mono text-[0.75rem] text-texto-suave">
          {propuesta.institucion.nit}
        </span>
        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium ${ESTILO_FUENTE[propuesta.fuente]}`}
          title={
            sugerida
              ? "Lo sacó un buscador de una página pública. Es una sugerencia: no se reporta al SENA hasta que alguien la compruebe."
              : `Procedencia: ${ETIQUETA_FUENTE[propuesta.fuente]}.`
          }
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full bg-current ${sugerida ? "" : "opacity-50"}`}
          />
          {sugerida ? "Sin verificar" : ETIQUETA_FUENTE[propuesta.fuente]}
        </span>
        <span
          className="text-texto-suave"
          title={`Llegó el ${fechaLegible(propuesta.creadoEn)}`}
        >
          {espera(propuesta.creadoEn)}
        </span>
        <span className="text-right font-medium text-marca">
          <span className="group-open:hidden">Ver</span>
          <span className="hidden group-open:inline">Cerrar</span>
        </span>
      </summary>

      <div className="border-t border-hairline px-4 pt-3 pb-4">
      <p className="text-[0.8125rem]">
        <Link
          href={`/admin/instituciones/${propuesta.institucion.id}`}
          className="font-medium text-marca underline decoration-borde underline-offset-4 hover:decoration-marca"
        >
          Abrir el registro de {nombre}
        </Link>
      </p>

      <p
        className={`mt-3 text-sm ${
          sugerida
            ? "rounded-xl border border-aviso/30 bg-aviso-suave p-3 text-aviso"
            : "text-texto-suave"
        }`}
      >
        {NOTA_FUENTE[propuesta.fuente]}
      </p>

      <ul className="mt-4 space-y-1.5">
        {campos.map((campo) => {
          const marcado = marcados.includes(campo);
          return (
            <li key={campo}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                  marcado
                    ? "border-marca/40 bg-marca-suave"
                    : "border-borde bg-superficie-alterna"
                }`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => alternar(campo)}
                  disabled={trabajando !== null}
                  className="mt-1 h-4 w-4 shrink-0 accent-marca"
                />
                <span className="min-w-0">
                  <span className="block text-xs text-texto-suave">
                    {ETIQUETA_CAMPO[campo] ?? campo}
                  </span>
                  <span className="block break-words">
                    {textoValor(campo, propuesta.campos[campo])}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 text-right">
        <button
          onClick={() => setMarcados(todosMarcados ? [] : campos)}
          disabled={trabajando !== null}
          className="text-sm text-texto-suave underline disabled:opacity-50"
        >
          {todosMarcados ? "Quitar todas las marcas" : "Marcar todos los campos"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-borde pt-4">
        <Boton
          onClick={() => void resolver("aplicar")}
          disabled={marcados.length === 0 || trabajando !== null}
        >
          {trabajando === "aplicar"
            ? "Aplicando…"
            : `Aplicar lo marcado (${marcados.length} de ${campos.length})`}
        </Boton>

        <button
          onClick={() => void resolver("descartar")}
          disabled={trabajando !== null}
          className="inline-flex items-center justify-center rounded-xl border border-borde px-5 py-2.5 text-sm font-medium text-error transition hover:bg-error-suave disabled:opacity-50"
        >
          {trabajando === "descartar" ? "Descartando…" : "Descartar todo"}
        </button>

        {marcados.length === 0 && trabajando === null && (
          <p className="text-sm text-texto-suave">
            Sin nada marcado no hay qué aplicar. Si nada de esto sirve, descártelo.
          </p>
        )}
      </div>
      </div>
    </details>
  );
}
