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
    "Viene del RUES, que es fuente oficial. Aun así, en la ficha queda únicamente lo " +
    "que usted marque.",
  CARGA:
    "Viene del archivo con el que se sembró el sistema. Nadie lo ha revisado desde " +
    "entonces, así que conviene contrastarlo antes de darlo por bueno.",
  HUMANO:
    "Lo escribió una persona y quedó como propuesta. Sigue haciendo falta que alguien " +
    "la acepte para que quede en la ficha.",
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
  const fecha = new Date(iso);
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
export default function PaginaPendientes() {
  const [propuestas, setPropuestas] = useState<PropuestaPendiente[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

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
    setError(null);
    setExito(mensaje);
  }

  const sugeridas = propuestas?.filter((p) => p.fuente === "WEB").length ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Por revisar</h1>
        <p className="mt-1 max-w-3xl text-texto-suave">
          Ninguna consulta automática escribe en la ficha de una organización: deja aquí
          una propuesta. Hasta que una persona no la acepte campo por campo, ese dato no
          se reporta al SENA. Lo que se marque queda en la ficha; lo que se deje sin
          marcar se descarta junto con la propuesta.
        </p>
      </header>

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

          <div className="space-y-5">
            {propuestas.map((propuesta) => (
              <TarjetaPropuesta
                key={propuesta.id}
                propuesta={propuesta}
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
            <p>
              Es lo normal por ahora: mientras las consultas al RUES y al buscador web no
              estén en funcionamiento, no hay quien proponga datos y esta bandeja no se
              llena sola.
            </p>
            <p>
              Cuando entren en funcionamiento, cada dato que encuentren llegará aquí como
              propuesta y quedará esperando a que una persona lo acepte. Hasta entonces
              los datos se corrigen a mano desde la ficha de cada{" "}
              <Link href="/admin/instituciones" className="underline">
                institución
              </Link>
              .
            </p>
          </div>
        </Tarjeta>
      )}
    </div>
  );
}

function TarjetaPropuesta({
  propuesta,
  alResolver,
  alFallar,
}: {
  propuesta: PropuestaPendiente;
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
      alResolver(`${aplicados} en la ficha de ${nombre}.${resto}`);
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
    <article
      className={`rounded-2xl border bg-superficie p-6 ${
        sugerida ? "border-aviso/40" : "border-borde"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">
            <Link
              href={`/admin/instituciones/${propuesta.institucion.id}`}
              className="underline decoration-borde underline-offset-4 hover:decoration-marca"
            >
              {nombre}
            </Link>
          </h2>
          <p className="mt-1 font-mono text-xs text-texto-suave">
            NIT {propuesta.institucion.nit}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${ESTILO_FUENTE[propuesta.fuente]}`}
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
            {sugerida ? "Sugerido, sin verificar" : ETIQUETA_FUENTE[propuesta.fuente]}
          </span>
          <span
            className="text-xs text-texto-suave"
            title={`Llegó el ${fechaLegible(propuesta.creadoEn)}`}
          >
            {espera(propuesta.creadoEn)}
          </span>
        </div>
      </header>

      <p
        className={`mt-4 text-sm ${
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
    </article>
  );
}
