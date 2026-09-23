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
import { fechaDeCalendario } from "@/lib/dia-de-calendario";
import Link from "next/link";

import { ErrorApi } from "@/lib/api";
import {
  crmApi,
  ETIQUETA_ETAPA,
  type CandidatosDeGrupo,
  type OfertaSinGrupo,
} from "@/lib/crm-api";
import { Aviso, Boton, Campo, useAdmin } from "@/components/admin/marco-admin";
import { Desplegable } from "@/components/admin/desplegable";
import {
  Bloque,
  BotonVolver,
  Encabezado,
  Esqueleto,
  Vacio,
} from "@/components/admin/piezas";

/// Cuántos se pueden marcar de una vez. El servidor lo vuelve a
/// comprobar; esto es para no dejar marcar de más y decirlo antes.
const TOPE = 300;

export default function AsignarGrupoPorLote() {
  /// LA PANTALLA ENTERA ES DE QUIEN ASIGNA. Un asesor que entre por
  /// la dirección ve la explicación, no el formulario: el servidor
  /// rechaza la llamada igual, y una pantalla que deja marcar
  /// cincuenta personas para después negarse es peor que no dejar
  /// entrar.
  const { admin } = useAdmin();
  const puedeAsignar = admin.puede?.asignarGrupo === true;
  const [ofertas, setOfertas] = useState<OfertaSinGrupo[] | null>(null);
  const [accionElegida, setAccionElegida] = useState<string>("");
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

  /// LA ACCIÓN, Y DENTRO SUS LUGARES. El servidor devuelve pares
  /// «acción × sede» sueltos, y eso obligaba a leer catorce filas con
  /// el mismo nombre de curso repetido para dar con ANTIOQUIA. Aquí se
  /// agrupan: primero el curso, después dónde.
  const porAccion = useMemo(() => {
    const mapa = new Map<
      string,
      { accion: string; sinGrupo: number; sedes: OfertaSinGrupo[] }
    >();
    for (const o of ofertas ?? []) {
      const ya = mapa.get(o.accion) ?? { accion: o.accion, sinGrupo: 0, sedes: [] };
      ya.sinGrupo += o.sinGrupo;
      ya.sedes.push(o);
      mapa.set(o.accion, ya);
    }
    /// Primero donde hay más gente esperando: es donde hay trabajo.
    return [...mapa.values()].sort((a, b) => b.sinGrupo - a.sinGrupo);
  }, [ofertas]);

  const sedes = useMemo(
    () => porAccion.find((a) => a.accion === accionElegida)?.sedes ?? [],
    [porAccion, accionElegida],
  );

  const celda = useMemo(
    () => abierta?.celdas.find((c) => c.coberturaId === destino) ?? null,
    [abierta, destino],
  );

  /// EL SOBRECUPO NO SE AVISA: NO SE DEJA ARMAR.
  ///
  /// Antes se marcaban cuarenta, se pulsaba, y el servidor recortaba y
  /// lo contaba después --trabajo perdido por quien lo marcó--. Ahora
  /// las casillas se apagan al llegar al cupo del grupo, así que lo que
  /// está marcado siempre cabe.
  const topeDeMarcado = celda ? Math.min(TOPE, celda.caben) : 0;

  /// Y «marcar todos» es todos LOS QUE HAY: con 18 esperando y 64
  /// cupos, marcar los 18 es haberlos marcado a todos.
  const marcablesAhora = Math.min(topeDeMarcado, lista?.candidatos.length ?? 0);

  function elegirAccion(valor: string) {
    setAccionElegida(valor);
    setAbierta(null);
    setLista(null);
    setMarcados([]);
    setDestino("");
    setHecho(null);
    setError(null);
    /// Un solo lugar: se abre solo. Hacer elegir cuando no hay nada
    /// que elegir es un paso que no decide nada --igual que el grupo
    /// único--.
    const suyas = porAccion.find((a) => a.accion === valor)?.sedes ?? [];
    if (suyas.length === 1) void abrir(suyas[0]);
  }

  async function asignar() {
    if (!celda) return;
    setCargando(true);
    setError(null);
    try {
      const r = await crmApi.asignarGrupoEnLote(celda.coberturaId, marcados);
      /// En palabras, y diciendo si queda trabajo: quien acaba de
      /// asignar necesita saber qué pasó y qué falta en esta sede.
      setHecho(
        `${r.asignadas} ${r.asignadas === 1 ? "persona quedó" : "personas quedaron"} en el grupo ${celda.numero}.` +
          (r.sinCupo ? ` ${r.sinCupo} no cupieron: el grupo se llenó.` : "") +
          (r.fuera ? ` ${r.fuera} ya no estaban disponibles.` : "") +
          ` En ese grupo caben ${r.cabenAhora} más.`,
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
    <div className="flex flex-col pt-3 pb-5">
      {/* LA SALIDA, FUERA DEL RECUADRO. Dentro competía con el título
          de la pantalla; aquí encima manda una sola cosa --volver-- y
          alineada al mismo canto que la cabecera. */}
      <div className="mx-4 mb-2">
        <BotonVolver href="/admin/participantes" texto="Gestión de leads" />
      </div>
      {/* LOS TRES PASOS, EN LA MISMA FILA DEL TÍTULO.
          «Esto debe ser para dumis: que el sistema se adapte a la
          persona» (cliente, 23 sep 2026), y el mismo día: «optimizar la
          visual, no ocupar mucho espacio». Estuvieron como tres
          tarjetas a lo ancho debajo del título: dos bandas apiladas que
          no ahorraban nada. Aquí van dentro de la cabecera, como
          píldoras, y no suman ni un píxel de alto: el que va en curso
          queda encendido, y con eso la pantalla dice qué sigue. */}
      <Encabezado titulo="Asignar grupo por lote" compacto>
        <ol className="flex flex-wrap items-center gap-1.5" aria-label="Los cuatro pasos">
          {[
            { n: 1, texto: "Elija la Acción de formación", activo: !accionElegida },
            { n: 2, texto: "Elija el departamento", activo: Boolean(accionElegida) && !abierta },
            { n: 3, texto: "Elija el grupo", activo: Boolean(abierta) && !celda },
            { n: 4, texto: "Seleccione los leads a asignar", activo: Boolean(celda) },
          ].map((p) => (
            <li
              key={p.n}
              aria-current={p.activo ? "step" : undefined}
              className={`flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1.5 text-[0.75rem] whitespace-nowrap ${
                p.activo
                  ? "border-marca bg-marca-suave font-semibold text-titulo"
                  : "border-borde text-texto-suave"
              }`}
            >
              <span
                className={`flex size-[18px] shrink-0 items-center justify-center rounded-full text-[0.625rem] font-bold tabular-nums ${
                  p.activo
                    ? "bg-marca text-marca-texto"
                    : "bg-superficie-alterna text-texto-suave"
                }`}
              >
                {p.n}
              </span>
              {p.texto}
            </li>
          ))}
        </ol>
      </Encabezado>

      {/* EL MISMO CANTO QUE EL TÍTULO. La cabecera trae su propio
          `mx-4`, así que con `px-4` en el contenedor quedaba 32 px
          adentro mientras el bloque de abajo iba a 16: el título más
          estrecho que su propia pantalla. El relleno lo pone este
          envoltorio, y los dos cantos coinciden. */}
      <div className="flex flex-col gap-3 px-4">
        {!puedeAsignar && (
        <Aviso tipo="error">
          Asignar el grupo lo hacen el analista y los administradores. Si hace falta mover
          a alguien de grupo, pídalo por su canal de siempre.
        </Aviso>
      )}

      {error && <Aviso tipo="error">{error}</Aviso>}
        {hecho && <Aviso tipo="exito">{hecho}</Aviso>}

        {!puedeAsignar ? null : ofertas === null ? (
          <Esqueleto />
        ) : ofertas.length === 0 ? (
          <Vacio titulo="Nadie inscrito está esperando grupo">
            Todos los inscritos ya tienen su cohorte. Los interesados y
            contactados no salen aquí a propósito: el grupo se asigna cuando la
            persona ya está dentro, y hasta entonces se le pone de a uno desde su
            lead.
          </Vacio>
        ) : (
          <Bloque sinRelleno>
            {/* EN CASCADA, COMO LA PLANTILLA DE EXCEL: acción, después
                departamento, después grupo, y al final las personas. «Algo
                así como para bobos» (cliente, 23 sep 2026).

                Antes era una lista de filas «curso + sede» mezcladas: para
                encontrar Antioquia en AF1 había que leer catorce filas, y
                el nombre del curso se repetía en todas. */}
            {/* PROPORCIÓN, NO ANCHOS FIJOS. Con `1fr` y dos columnas de
                260 px, en una pantalla ancha la acción se comía todo y los
                otros dos quedaban de juguete. En fracciones (2:1:1) los
                tres crecen juntos y la fila se lee como una sola pieza; la
                acción se queda con el doble porque su texto es el largo
                --«AF1 · GESTIÓN DE LA ATENCIÓN Y NEUROEDUCACIÓN…»--. */}
            <div className="grid gap-x-6 gap-y-4 border-b border-hairline px-7 py-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              {/* SIN NÚMERO EN EL RÓTULO. Los llevaba --«1 ·», «2 ·»-- y el
                cliente ya paró esa cifra en el embudo: «uno puede pensar
                que son datos de los leads» (23 sep 2026). El orden lo
                dicen las píldoras del encabezado, que para eso están. */}
            <Campo etiqueta="Acción de formación">
                <Desplegable
                  alto={34}
                  etiquetaAria="Acción de formación"
                  marcador="Elija la acción"
                  valor={accionElegida}
                  opciones={porAccion.map((a) => ({
                    valor: a.accion,
                    etiqueta: a.accion,
                    detalle: `${a.sinGrupo} ${a.sinGrupo === 1 ? "lead" : "leads"} sin grupo`,
                  }))}
                  alElegir={elegirAccion}
                />
              </Campo>

              <Campo etiqueta="Departamento o ciudad">
                <Desplegable
                  alto={34}
                  etiquetaAria="Departamento o ciudad"
                  marcador={accionElegida ? "Elija el lugar" : "Primero la acción"}
                  desactivado={sedes.length === 0}
                  valor={abierta?.ofertaId ?? ""}
                  opciones={sedes.map((o) => ({
                    valor: o.ofertaId,
                    etiqueta: o.sede,
                    detalle: `${o.sinGrupo} sin grupo · ${o.modalidad.toLowerCase()}`,
                  }))}
                  alElegir={(v) => {
                    const o = sedes.find((x) => x.ofertaId === v);
                    if (o) void abrir(o);
                  }}
                />
              </Campo>

              <Campo etiqueta="Grupo">
                <Desplegable
                  alto={34}
                  etiquetaAria="Grupo"
                  marcador={abierta ? "Elija el grupo" : "Primero el lugar"}
                  desactivado={!abierta || abierta.celdas.length === 0}
                  valor={destino}
                  /// EL CUPO, EN LA OPCIÓN: se elige el grupo mirando
                  /// cuántos caben, que es lo que evita el sobrecupo.
                  opciones={(abierta?.celdas ?? []).map((c) => ({
                    valor: c.coberturaId,
                    etiqueta: `Grupo ${c.numero}`,
                    /// El lleno se ve, pero no se puede elegir: esconderlo
                    /// haría pensar que ese grupo no existe.
                    desactivada: c.caben === 0,
                    detalle:
                      (c.caben === 0 ? "sin cupos" : `${c.caben} cupos libres de ${c.tope}`) +
                      (c.fechaInicio
                        ? ` · arranca ${fechaDeCalendario(c.fechaInicio, { dateStyle: "short" })}`
                        : " · sin fechas"),
                  }))}
                  alElegir={(v) => {
                    const c = abierta?.celdas.find((x) => x.coberturaId === v);
                    if (!c) return;
                    if (c.caben === 0) {
                      setError(`El grupo ${c.numero} no tiene cupos libres. Elija otro.`);
                      return;
                    }
                    setError(null);
                    setDestino(v);
                    /// Nunca más marcados que cupos: si venían 40 marcados y
                    /// el grupo nuevo tiene 12, se recortan aquí y no al
                    /// pulsar, que es cuando dolería.
                    setMarcados((antes) => antes.slice(0, c.caben));
                  }}
                />
              </Campo>
            </div>

            {/* SIN NADA ELEGIDO, QUE DIGA POR DÓNDE SE EMPIEZA. Antes
                quedaba media pantalla en blanco debajo de tres campos
                vacíos, y nada indicaba que la lista de gente sale al
                final. */}
            {!abierta && (
              <p className="px-7 py-4 text-[0.8125rem] text-texto-suave">
                Comience seleccionando la acción de formación, el departamento y
                el grupo. Luego podrá consultar los leads pendientes de
                asignación y los cupos disponibles.
              </p>
            )}

            {abierta && abierta.celdas.length === 0 && (
              <div className="px-7 py-4">
                <Aviso tipo="error">
                  Esta acción en {abierta.sede} no tiene ningún grupo en el
                  calendario, así que no hay a dónde asignar. Créelos en{" "}
                  <Link href="/admin/acciones/cronograma" className="underline">
                    Oferta formativa › Calendario
                  </Link>
                  .
                </Aviso>
              </div>
            )}

            {/* PASO 4. Sin grupo elegido no se pinta la lista: marcar gente
                sin saber a dónde va es lo que hacía dudar de todo. */}
            {abierta && abierta.celdas.length > 0 && (
              <div className="px-7 py-5">
                <p className="mb-3 text-[0.8125rem] font-medium text-titulo">
                  Seleccione los leads a asignar
                  {celda && (
                    <span className="ml-2 font-normal text-texto-suave">
                      {celda.caben} {celda.caben === 1 ? "cupo libre" : "cupos libres"} en el
                      grupo {celda.numero} · {marcados.length} seleccionados
                    </span>
                  )}
                </p>

                {!celda ? (
                  <p className="text-[0.8125rem] text-texto-suave">
                    Elija el grupo de arriba para ver a quién puede asignar.
                  </p>
                ) : cargando && !lista ? (
                  <Esqueleto />
                ) : lista ? (
                  <>
                    {lista.total >= 500 && (
                      /* No se calla que la lista está recortada: un recuento
                         que parece el total y no lo es es la peor clase de
                         cifra. */
                      <p className="mb-2 text-[0.78125rem] text-aviso">
                        Se muestran los 500 que llevan más esperando. Al asignar
                        estos, aparecerán los siguientes.
                      </p>
                    )}
                    {marcados.length >= celda.caben && lista.candidatos.length > celda.caben && (
                      <p className="mb-2 text-[0.78125rem] text-aviso">
                        El grupo {celda.numero} se llena con {celda.caben}: los demás quedan
                        esperando otro grupo.
                      </p>
                    )}

                    {lista.candidatos.length === 0 ? (
                      <Vacio titulo="Ya no queda ningún inscrito sin grupo en esta acción y lugar">
                        Elija otra acción arriba.
                      </Vacio>
                    ) : (
                      <div className="caja-scroll max-h-[28rem] overflow-y-auto rounded-lg border border-borde">
                        <table className="w-full text-[0.84375rem]">
                          <thead className="sticky top-0 bg-superficie-alterna text-left text-xs">
                            <tr>
                              {/* MARCAR TODOS EN SU SITIO: la casilla de la
                                  cabecera, como en cualquier tabla. Marca a
                                  cuantos quepan --nunca más que los cupos del
                                  grupo--, y queda marcada cuando ya no hay
                                  nadie más que marcar: con 18 esperando y 64
                                  cupos, marcar los 18 ES marcar todos, y
                                  compararlo contra el cupo la dejaba vacía
                                  después de haber marcado a todo el mundo. */}
                              <th className="w-10 px-3 py-2">
                                <input
                                  type="checkbox"
                                  aria-label={`Marcar a ${marcablesAhora}`}
                                  title={`Marcar a ${marcablesAhora}`}
                                  checked={marcados.length > 0 && marcados.length >= marcablesAhora}
                                  onChange={() =>
                                    setMarcados(
                                      marcados.length >= marcablesAhora
                                        ? []
                                        : lista.candidatos.slice(0, marcablesAhora).map((c) => c.id),
                                    )
                                  }
                                />
                              </th>
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
                              const lleno = !puesto && marcados.length >= topeDeMarcado;
                              return (
                                <tr
                                  key={c.id}
                                  className={`border-t border-borde hover:bg-superficie-alterna ${
                                    lleno ? "opacity-60" : ""
                                  }`}
                                >
                                  <td className="px-3 py-2">
                                    <input
                                      type="checkbox"
                                      checked={puesto}
                                      disabled={lleno}
                                      title={
                                        lleno
                                          ? `El grupo ${celda.numero} solo tiene ${celda.caben} cupos libres`
                                          : undefined
                                      }
                                      onChange={() =>
                                        setMarcados((antes) =>
                                          puesto
                                            ? antes.filter((x) => x !== c.id)
                                            : antes.length >= topeDeMarcado
                                              ? antes
                                              : [...antes, c.id],
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    {c.persona.primerNombre} {c.persona.primerApellido}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-xs tabular-nums">
                                    {c.persona.numeroDocumento}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-texto-suave">
                                    {ETIQUETA_ETAPA[c.etapa] ?? c.etapa}
                                  </td>
                                  <td className="px-3 py-2 text-xs tabular-nums text-texto-suave">
                                    {new Date(c.creadoEn).toLocaleDateString("es-CO")}
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

                    <div className="mt-3">
                      <Boton onClick={asignar} disabled={marcados.length === 0 || cargando}>
                        {cargando
                          ? "Asignando…"
                          : marcados.length === 0
                            ? "Seleccione al menos un lead"
                            : `Asignar ${marcados.length} ${
                                marcados.length === 1 ? "lead" : "leads"
                              } al grupo ${celda.numero}`}
                      </Boton>
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </Bloque>
        )}
      </div>
    </div>
  );
}
