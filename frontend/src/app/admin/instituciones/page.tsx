"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { n } from "@/components/admin/graficos";
import { IconoOrganizaciones } from "@/components/admin/iconos";
import { Aviso, CLASE_CONTROL } from "@/components/admin/marco-admin";
import { Pildora, Vacio } from "@/components/admin/piezas";
import { bonito, ErrorApi } from "@/lib/api";
import {
  ETIQUETA_CAMPO,
  ETIQUETA_CLASIFICACION,
  ETIQUETA_FUENTE,
  ETIQUETA_TAMANO,
  institucionesApi,
  type Institucion,
  type Listado,
  type ResumenInstituciones,
} from "@/lib/instituciones-api";

/// Lo que se espera antes de pedir. Un NIT son diez teclas:
/// sin esta pausa serian diez consultas para una busqueda.
const ESPERA_BUSQUEDA = 400;

/// La marca de lo sugerido: solo el color de la letra.
///
/// Es el mismo amarillo de aviso que usan la ficha y la bandeja
/// de propuestas: si aqui significara otra cosa, la persona
/// tendria que reaprender la pantalla. Sin recuadro ni pastilla
/// -- en una tabla, una pastilla por celda es mas ruido que dato.
const CLASE_SUGERIDO = "font-medium text-aviso";

/**
 * El maestro de organizaciones: una fila por NIT, con lo que
 * se sabe de cada una y si eso alcanza para reportarla.
 */
export default function PaginaInstituciones() {
  const [resumen, setResumen] = useState<ResumenInstituciones | null>(null);
  const [listado, setListado] = useState<Listado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const [consulta, setConsulta] = useState("");
  const [buscada, setBuscada] = useState("");
  const [incompletas, setIncompletas] = useState(false);
  const [sinVerificar, setSinVerificar] = useState(false);
  /// Las que tienen algun campo traido por el buscador web
  /// y sin confirmar. Es la cola de trabajo de verdad.
  const [sugeridos, setSugeridos] = useState(false);
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    let vigente = true;

    async function contar() {
      try {
        const datos = await institucionesApi.resumen();
        if (vigente) setResumen(datos);
      } catch {
        /// El conteo no merece la franja roja de arriba ni borrar
        /// el error del listado, que es el que estorba de verdad.
        /// Sin el, las casillas quedan sin cifra -- que es la
        /// verdad -- y el resto de la pantalla sigue funcionando.
      }
    }

    void contar();
    return () => {
      vigente = false;
    };
  }, []);

  /// La busqueda espera a que la persona deje de escribir, y
  /// vuelve a la primera pagina: la tercera de la busqueda
  /// anterior no quiere decir nada en la nueva.
  useEffect(() => {
    if (consulta.trim() === buscada) return;
    const reloj = setTimeout(() => {
      setBuscada(consulta.trim());
      setPagina(1);
    }, ESPERA_BUSQUEDA);
    return () => clearTimeout(reloj);
  }, [consulta, buscada]);

  useEffect(() => {
    let vigente = true;

    async function traer() {
      setCargando(true);
      try {
        const datos = await institucionesApi.listar({
          buscar: buscada || undefined,
          incompletas,
          sinVerificar,
          sugeridos,
          pagina,
        });
        // una respuesta lenta de un filtro ya abandonado no manda
        if (!vigente) return;
        setListado(datos);
        setError(null);
      } catch (e) {
        if (vigente) setError((e as ErrorApi).message);
      } finally {
        if (vigente) setCargando(false);
      }
    }

    void traer();
    return () => {
      vigente = false;
    };
  }, [buscada, incompletas, sinVerificar, sugeridos, pagina]);

  /// Cualquier cambio de filtro devuelve a la pagina 1: seguir
  /// en la 4 sobre un listado que ahora tiene dos paginas deja
  /// la pantalla en blanco sin explicar por que.
  function filtrar(cambio: () => void) {
    cambio();
    setPagina(1);
  }

  const filas = listado?.instituciones ?? [];
  const paginas = listado
    ? Math.max(1, Math.ceil(listado.total / listado.porPagina))
    : 1;
  const paginaActual = listado?.pagina ?? pagina;
  const hayFiltro = buscada !== "" || incompletas || sinVerificar || sugeridos;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Empresas registradas
          {resumen && (
            <span className="ml-2 font-semibold tabular-nums text-texto-suave">
              ({n(resumen.total)})
            </span>
          )}
        </h1>

        <p className="mt-2 text-sm text-texto-suave">
          El sistema proporciona estos datos como{" "}
          <span className={CLASE_SUGERIDO}>sugerencia automática</span> de empresas
          registradas, revise cuidadosamente cada campo del proceso de verificación
          y apruebe si son correctos o realice las correcciones que considere
          necesarias según corresponda.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {/* Dentro de la caja, solo lo que se toca. El total del
          listado va fuera, debajo: un recuadro con borde se lee
          como «esto es un control». La unica cifra que entra es
          la de cada casilla, pegada a su etiqueta, porque dice
          cuanto trabajo destapa ese filtro antes de marcarlo. */}
      <div className="rounded-2xl border border-borde bg-superficie shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            filtrar(() => setBuscada(consulta.trim()));
          }}
          className="flex flex-wrap items-center gap-4 p-4"
        >
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar por razón social o por NIT"
          aria-label="Buscar por razón social o por NIT"
          className={`${CLASE_CONTROL} min-w-56 flex-1 sm:max-w-md`}
        />

        {/* a la derecha del todo: con la barra a pantalla
            completa, pegarlas al buscador deja un vacio enorme */}
        <div className="ml-auto flex flex-wrap items-center gap-5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={incompletas}
            onChange={(e) => filtrar(() => setIncompletas(e.target.checked))}
            className="size-4 accent-marca"
          />
          Solo incompletas
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sinVerificar}
            onChange={(e) => filtrar(() => setSinVerificar(e.target.checked))}
            className="size-4 accent-marca"
          />
          Solo sin verificar
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sugeridos}
            onChange={(e) => filtrar(() => setSugeridos(e.target.checked))}
            className="size-4 accent-marca"
          />
          <span className={CLASE_SUGERIDO}>Sugerido, sin verificar</span>
        </label>

        <span aria-live="polite" className="text-sm text-texto-suave">
          {cargando && listado ? "Buscando…" : ""}
        </span>
        </div>
        </form>
      </div>

      {!listado && cargando && <p className="text-texto-suave">Cargando…</p>}

      {listado && filas.length === 0 && (
        <Vacio
          titulo={
            hayFiltro
              ? "Ninguna organización coincide"
              : "Todavía no hay organizaciones"
          }
          icono={IconoOrganizaciones}
        >
          {hayFiltro
            ? "Pruebe con una parte del nombre, o con el NIT sin el dígito de verificación. También puede quitar los filtros."
            : "Estas filas salen del archivo con el que se sembró el sistema y de lo que averigua la consulta al RUES. Aparecen en cuanto entre el archivo o termine la primera consulta."}
        </Vacio>
      )}

      {/* Solo cuando hay filtro: sin el, la cifra ya esta
          arriba, al lado del titulo, y repetirla es ruido. */}
      {listado && filas.length > 0 && hayFiltro && (
        <p className="text-sm text-texto-suave">
          <strong className="font-semibold text-texto">{n(listado.total)}</strong>{" "}
          de {resumen ? n(resumen.total) : "…"} con los filtros puestos
        </p>
      )}

      {listado && filas.length > 0 && (
        <>
          <div className="caja-scroll overflow-x-auto rounded-2xl border border-borde bg-superficie shadow-sm">
            <table className="tabla-datos w-full text-sm">
              <thead>
                <tr>
                  <th>NIT</th>
                  <th>Razón social</th>
                  <th className="whitespace-nowrap">Ciudad</th>
                  <th className="whitespace-nowrap">Tamaño</th>
                  <th className="whitespace-nowrap">Clasificación</th>
                  <th className="whitespace-nowrap">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((institucion) => (
                  <tr key={institucion.id}>
                    <td className="font-mono text-xs whitespace-nowrap">
                      {institucion.nit}
                      {institucion.digitoDeclarado
                        ? `-${institucion.digitoDeclarado}`
                        : ""}
                    </td>

                    {/* se lleva el espacio que sobre: es lo
                        unico de largo variable de la fila */}
                    <td className="w-full">
                      <Link
                        href={`/admin/instituciones/${institucion.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {bonito(institucion.razonSocial)}
                      </Link>
                      {institucion.nombreComercial && (
                        <span className="block truncate text-xs text-texto-suave">
                          {bonito(institucion.nombreComercial)}
                        </span>
                      )}
                    </td>

                    <td>
                      <Dato
                        institucion={institucion}
                        campo="ciudadNombre"
                        valor={
                          institucion.ciudadNombre
                            ? bonito(institucion.ciudadNombre)
                            : null
                        }
                      />
                    </td>

                    <td>
                      <Dato
                        institucion={institucion}
                        campo="tamano"
                        valor={
                          institucion.tamano
                            ? ETIQUETA_TAMANO[institucion.tamano]
                            : null
                        }
                      />
                    </td>

                    <td>
                      <Dato
                        institucion={institucion}
                        campo="clasificacion"
                        valor={
                          institucion.clasificacion
                            ? ETIQUETA_CLASIFICACION[institucion.clasificacion]
                            : null
                        }
                      />
                    </td>

                    <td>
                      <Estado institucion={institucion} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texto-suave">
            <span className={CLASE_SUGERIDO}>Así se ve un dato sugerido</span>
            Lo trajo el buscador web de una página pública y nadie responde por él
            todavía: mientras no se confirme en la ficha, no llega al SENA. Los
            demás datos vienen del RUES, del archivo inicial o de alguien del
            equipo.
          </p>

          {listado.total > listado.porPagina && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-texto-suave">
                {n(listado.total)} organizaciones · página{" "}
                <span className="tabular-nums">{paginaActual}</span> de{" "}
                <span className="tabular-nums">{paginas}</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPagina(paginaActual - 1)}
                  disabled={paginaActual <= 1 || cargando}
                  className="rounded-xl border border-borde px-3 py-1.5 transition hover:bg-superficie-alterna disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPagina(paginaActual + 1)}
                  disabled={paginaActual >= paginas || cargando}
                  className="rounded-xl border border-borde px-3 py-1.5 transition hover:bg-superficie-alterna disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Una celda con su procedencia: lo que trajo el buscador web
 * se ve distinto de lo demas.
 */
function Dato({
  institucion,
  campo,
  valor,
}: {
  institucion: Institucion;
  campo: string;
  valor: string | null;
}) {
  if (!valor) return <span className="text-texto-suave">—</span>;

  /// Solo se resalta WEB. Pintar tambien RUES, CARGA y HUMANO
  /// llenaria la tabla de color y taparia lo unico que hay que
  /// mirar antes de reportar: lo que nadie ha confirmado.
  if (institucion.fuentePorCampo?.[campo] !== "WEB") return <span>{valor}</span>;

  /// El punto y el sello no son adorno: el color solo no separa
  /// lo sugerido de lo confirmado para quien no lo distingue, y
  /// esa separacion es lo unico que hace esta pantalla.
  return (
    <span
      className={CLASE_SUGERIDO}
      title={`${ETIQUETA_CAMPO[campo] ?? campo}: ${ETIQUETA_FUENTE.WEB}. Sugerido, sin verificar: no llega al SENA hasta que alguien lo confirme.`}
    >
      {valor}
      <span className="sr-only"> (sugerido, sin verificar)</span>
    </span>
  );
}

/** Si la fila puede reportarse al SENA y, si no, que se lo impide. */
function Estado({ institucion }: { institucion: Institucion }) {
  const { falta, sinConfirmar, reportable } = institucion;

  const etiquetar = (campos: string[]) =>
    campos.map((campo) => ETIQUETA_CAMPO[campo] ?? campo).join(" · ");

  if (falta.length === 0 && sinConfirmar.length === 0) {
    /// Sin huecos y sin nada pendiente de confirmar, lo unico
    /// que puede faltarle es que alguien la haya mirado.
    return reportable ? (
      <Pildora tono="exito">Lista para reportar</Pildora>
    ) : (
      <Pildora tono="aviso">
        <span title="Tiene todos los datos, pero nadie la ha verificado todavía.">
          Sin verificar
        </span>
      </Pildora>
    );
  }

  /// Las dos cosas se muestran juntas cuando pasan las dos: un
  /// hueco y un dato sin confirmar se arreglan distinto, y
  /// quedarse solo con el peor esconde la mitad del trabajo.
  return (
    <div className="flex flex-col items-start gap-1">
      {falta.length > 0 && (
        <Pildora tono="error">
          <span title={`Falta: ${etiquetar(falta)}`}>
            {falta.length === 1
              ? "Le falta 1 dato"
              : `Le faltan ${falta.length} datos`}
          </span>
        </Pildora>
      )}

      {sinConfirmar.length > 0 && (
        <Pildora tono="aviso">
          <span title={`Sin confirmar: ${etiquetar(sinConfirmar)}`}>
            {sinConfirmar.length === 1
              ? "1 dato sin confirmar"
              : `${sinConfirmar.length} datos sin confirmar`}
          </span>
        </Pildora>
      )}
    </div>
  );
}
