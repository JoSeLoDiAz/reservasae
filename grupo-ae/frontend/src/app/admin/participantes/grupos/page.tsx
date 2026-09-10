"use client";

/** Asignar grupo a varias personas de una vez. */

/**
 * La preinscripción guarda la acción y la sede, pero NO el grupo. Y
 * sin grupo la ficha no entra al reporte del SENA. Con volumen de
 * pauta, eso es asignar cientos a mano.
 *
 * LA UNIDAD ES LA OFERTA, NO EL GRUPO, y es lo que la revisión
 * adversarial cambió del diseño inicial. Varias celdas comparten
 * oferta —AF1 × BOGOTÁ la sirven el Grupo 1 y el Grupo 2—, así que
 * abriendo grupo por grupo se verían LOS MISMOS candidatos dos
 * veces: dos líderes marcan a la misma gente y cada uno cree que se
 * la llevó.
 *
 * Así que se elige la oferta, sale UNA lista, y el grupo se elige
 * como destino al final. Es también lo que contesta de verdad la
 * pregunta del cliente: «si el grupo es en Bogotá, muéstrame los que
 * seleccionaron Bogotá».
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { ErrorApi } from "@/lib/api";
import {
  crmApi,
  ETIQUETA_ETAPA,
  type CandidatosDeGrupo,
  type CeldaDeGrupo,
  type OfertaSinGrupo,
} from "@/lib/crm-api";
import { Aviso, Boton } from "@/components/admin/marco-admin";
import { Bloque, Encabezado, Esqueleto, Vacio } from "@/components/admin/piezas";

/// Cuántos se pueden marcar de una vez. El servidor lo vuelve a
/// comprobar; esto es para no dejar marcar de más y decirlo antes.
const TOPE = 300;

export default function AsignarGrupoPorLote() {
  const [ofertas, setOfertas] = useState<OfertaSinGrupo[] | null>(null);
  const [abierta, setAbierta] = useState<OfertaSinGrupo | null>(null);
  const [lista, setLista] = useState<CandidatosDeGrupo | null>(null);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [destino, setDestino] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);

  const cargarOfertas = useCallback(async () => {
    try {
      const r = await crmApi.gruposPendientes();
      setOfertas(r.ofertas);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo cargar.");
      setOfertas([]);
    }
  }, []);

  useEffect(() => {
    void cargarOfertas();
  }, [cargarOfertas]);

  async function abrir(o: OfertaSinGrupo) {
    setAbierta(o);
    setLista(null);
    setMarcados([]);
    setHecho(null);
    setError(null);
    /// Una sola celda: se elige sola. Hacer elegir cuando no hay
    /// nada que elegir es un paso que no decide nada.
    setDestino(o.celdas.length === 1 ? o.celdas[0].coberturaId : "");
    setCargando(true);
    try {
      setLista(await crmApi.candidatosDeGrupo(o.ofertaId));
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo cargar.");
    } finally {
      setCargando(false);
    }
  }

  const celda = useMemo(
    () => abierta?.celdas.find((c) => c.coberturaId === destino) ?? null,
    [abierta, destino],
  );

  /// Los que no van a caber, contados ANTES de pulsar.
  ///
  /// El servidor recorta y lo dice, pero enterarse después de marcar
  /// cuarenta es hacerle perder el trabajo a quien lo marcó.
  const sobran = celda ? Math.max(0, marcados.length - celda.caben) : 0;

  async function asignar() {
    if (!celda) return;
    setCargando(true);
    setError(null);
    try {
      const r = await crmApi.asignarGrupoEnLote(celda.coberturaId, marcados);
      setHecho(
        `${r.asignadas} al grupo ${celda.numero}.` +
          (r.sinCupo ? ` ${r.sinCupo} no cupieron.` : "") +
          (r.fuera ? ` ${r.fuera} ya no estaban disponibles.` : "") +
          ` Caben ${r.cabenAhora} más.`,
      );
      setMarcados([]);
      await cargarOfertas();
      setLista(await crmApi.candidatosDeGrupo(abierta!.ofertaId));
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo asignar.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-6">
      <Link
        href="/admin/participantes"
        className="inline-flex items-center gap-1 text-[0.75rem] text-texto-suave transition hover:text-marca"
      >
        <span aria-hidden="true">&larr;</span> Gestión de leads
      </Link>

      <Encabezado
        titulo="Asignar grupo por lote"
        descripcion="Solo sale quien YA está inscrito y todavía no tiene cohorte: el grupo es lo último que se asigna, cuando la persona ya está dentro. Y sin él su ficha no entra al reporte del SENA."
      />

      {error && <Aviso tipo="error">{error}</Aviso>}
      {hecho && <Aviso tipo="exito">{hecho}</Aviso>}

      {ofertas === null ? (
        <Esqueleto />
      ) : ofertas.length === 0 ? (
        <Vacio titulo="Nadie inscrito está esperando grupo">
          Todos los inscritos ya tienen su cohorte. Los interesados y
          contactados no salen aquí a propósito: el grupo se asigna cuando la
          persona ya está dentro, y hasta entonces se le pone de a una desde su
          ficha.
        </Vacio>
      ) : (
        <Bloque
          titulo="Dónde hay inscritos esperando"
          descripcion="Una fila por curso y sede. El grupo se elige después: varios grupos pueden servir la misma sede, y se reparten el mismo montón."
        >
          <div className="flex flex-col gap-2">
            {ofertas.map((o) => (
              <button
                key={o.ofertaId}
                type="button"
                onClick={() => void abrir(o)}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5 text-left text-[0.84375rem] transition ${
                  abierta?.ofertaId === o.ofertaId
                    ? "border-marca bg-marca-suave"
                    : "border-borde bg-superficie hover:bg-superficie-alterna"
                }`}
              >
                <span className="font-medium">{o.accion}</span>
                <span className="text-texto-suave">
                  {o.sede} · {o.modalidad.toLowerCase()}
                </span>
                <span className="ml-auto tabular-nums font-medium text-marca">
                  {o.sinGrupo} {o.sinGrupo === 1 ? "inscrito" : "inscritos"} sin
                  grupo
                </span>
                <span className="text-xs text-texto-suave">
                  {/* Cuántos grupos la sirven. Si son dos, el
                      montón se reparte y conviene saberlo antes de
                      marcar. */}
                  {o.celdas.length === 0
                    ? "sin grupos en el cronograma"
                    : o.celdas.length === 1
                      ? "1 grupo"
                      : `${o.celdas.length} grupos`}
                </span>
              </button>
            ))}
          </div>
        </Bloque>
      )}

      {abierta && (
        <Bloque
          titulo={`${abierta.accion} · ${abierta.sede}`}
          descripcion="Marque a quién le toca y elija a qué grupo entra."
        >
          {abierta.celdas.length === 0 ? (
            /* Un bloque vacío dice POR QUÉ lo está, y qué hacer. */
            <Aviso tipo="error">
              Esta oferta no tiene ningún grupo en el cronograma, así que no hay
              a dónde asignar. Créelos en{" "}
              <Link href="/admin/cronograma" className="underline">
                Calendario
              </Link>
              .
            </Aviso>
          ) : (
            <>
              <div className="mb-4 flex flex-col gap-2">
                <span className="text-[0.78125rem] font-medium">
                  A qué grupo entran
                </span>
                {abierta.celdas.map((c) => (
                  <FilaDeCelda
                    key={c.coberturaId}
                    celda={c}
                    elegida={destino === c.coberturaId}
                    alElegir={() => setDestino(c.coberturaId)}
                  />
                ))}
              </div>

              {cargando && !lista ? (
                <Esqueleto />
              ) : lista ? (
                <>
                  <div className="mb-2 flex flex-wrap items-center gap-3 text-[0.78125rem]">
                    <button
                      type="button"
                      onClick={() =>
                        setMarcados(
                          marcados.length === lista.candidatos.length
                            ? []
                            : lista.candidatos.slice(0, TOPE).map((c) => c.id),
                        )
                      }
                      className="rounded-lg border border-campo-borde bg-campo px-3 py-1.5 font-medium"
                    >
                      {marcados.length === lista.candidatos.length
                        ? "Quitar la marca a todos"
                        : `Marcar ${Math.min(lista.candidatos.length, TOPE)}`}
                    </button>
                    <span className="tabular-nums text-texto-suave">
                      {marcados.length} de {lista.total} marcados
                    </span>
                    {lista.total >= 500 && (
                      /* No se calla que la lista está recortada: un
                         recuento que parece el total y no lo es es la
                         peor clase de cifra. */
                      <span className="text-aviso">
                        Se muestran los 500 que llevan más esperando. Al asignar
                        estos, aparecerán los siguientes.
                      </span>
                    )}
                    {sobran > 0 && celda && (
                      <span className="text-aviso">
                        En el grupo {celda.numero} solo caben {celda.caben}:{" "}
                        {sobran} se quedarán fuera.
                      </span>
                    )}
                  </div>

                  {lista.candidatos.length === 0 ? (
                    <Vacio titulo="Ya no queda ningún inscrito de esta oferta sin grupo">
                      Elija otra fila de arriba.
                    </Vacio>
                  ) : (
                    <div className="caja-scroll max-h-[28rem] overflow-y-auto rounded-lg border border-borde">
                      <table className="w-full text-[0.84375rem]">
                        <thead className="sticky top-0 bg-superficie-alterna text-left text-xs">
                          <tr>
                            <th className="w-10 px-3 py-2" />
                            <th className="px-3 py-2">Persona</th>
                            <th className="px-3 py-2">Documento</th>
                            <th className="px-3 py-2">Etapa</th>
                            <th className="px-3 py-2">Espera desde</th>
                            <th className="px-3 py-2">Asesor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lista.candidatos.map((c) => {
                            const puesto = marcados.includes(c.id);
                            return (
                              <tr
                                key={c.id}
                                className="border-t border-borde hover:bg-superficie-alterna"
                              >
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={puesto}
                                    onChange={() =>
                                      setMarcados((antes) =>
                                        puesto
                                          ? antes.filter((x) => x !== c.id)
                                          : antes.length >= TOPE
                                            ? antes
                                            : [...antes, c.id],
                                      )
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  {c.persona.primerNombre}{" "}
                                  {c.persona.primerApellido}
                                </td>
                                <td className="px-3 py-2 font-mono text-xs tabular-nums">
                                  {c.persona.numeroDocumento}
                                </td>
                                <td className="px-3 py-2 text-xs text-texto-suave">
                                  {ETIQUETA_ETAPA[c.etapa] ?? c.etapa}
                                </td>
                                <td className="px-3 py-2 text-xs tabular-nums text-texto-suave">
                                  {new Date(c.creadoEn).toLocaleDateString(
                                    "es-CO",
                                  )}
                                </td>
                                <td className="px-3 py-2 text-xs text-texto-suave">
                                  {c.asesor?.nombre ?? "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Boton
                      onClick={asignar}
                      disabled={!celda || marcados.length === 0 || cargando}
                    >
                      {cargando
                        ? "Asignando…"
                        : celda
                          ? `Asignar ${Math.min(marcados.length, celda.caben)} al grupo ${celda.numero}`
                          : "Elija un grupo"}
                    </Boton>
                    {!celda && abierta.celdas.length > 1 && (
                      <span className="text-xs text-texto-suave">
                        Esta sede la sirven {abierta.celdas.length} grupos: hay
                        que decir a cuál entran.
                      </span>
                    )}
                  </div>
                </>
              ) : null}
            </>
          )}
        </Bloque>
      )}
    </div>
  );
}

/// Una celda, con sus DOS números.
///
/// «Apuntados» y «sillas ocupadas» no son lo mismo: a la cohorte se
/// apunta gente desde INTERESADO, y solo consume aula quien está
/// inscrito. Con un solo número o se sobrevende o parece lleno lo
/// que está libre.
function FilaDeCelda({
  celda,
  elegida,
  alElegir,
}: {
  celda: CeldaDeGrupo;
  elegida: boolean;
  alElegir: () => void;
}) {
  const lleno = celda.caben === 0;
  return (
    <button
      type="button"
      onClick={alElegir}
      disabled={lleno}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-left text-[0.84375rem] transition disabled:opacity-60 ${
        elegida
          ? "border-marca bg-marca-suave"
          : "border-campo-borde bg-campo hover:bg-superficie-alterna"
      }`}
    >
      <span className="font-medium">Grupo {celda.numero}</span>
      <span className="text-xs text-texto-suave">
        {celda.fechaInicio
          ? `arranca el ${new Date(celda.fechaInicio).toLocaleDateString("es-CO")}`
          : "sin fechas todavía"}
        {celda.horario ? ` · ${celda.horario}` : ""}
      </span>
      <span className="ml-auto text-xs tabular-nums text-texto-suave">
        {celda.apuntados} apuntados de {celda.tope}
        {" · "}
        {celda.sillasOcupadas} en el aula
      </span>
      <span
        className={`text-xs font-medium tabular-nums ${
          lleno ? "text-error" : "text-exito"
        }`}
      >
        {lleno ? "sin sitio" : `caben ${celda.caben}`}
      </span>
    </button>
  );
}
