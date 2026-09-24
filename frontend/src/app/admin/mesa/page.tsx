"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ArreglarLead } from "@/components/admin/arreglar-lead";
import { GestionarLead } from "@/components/admin/gestionar-lead";
import { Desplegable } from "@/components/admin/desplegable";
import { Aviso, Boton, Campo, useAdmin } from "@/components/admin/marco-admin";
import { crmApi, type CatalogosSep } from "@/lib/crm-api";
import { Cifra, Encabezado, Vacio } from "@/components/admin/piezas";
import { useDatosVivos } from "@/lib/datos-vivos";
import { ErrorApi } from "@/lib/api";
import {
  ETIQUETA_ESTADO_LEAD,
  mesaApi,
  TONO_ESTADO_LEAD,
  TOPE_DEL_LOTE,
  type EstadoLead,
  type LeadDeLaMesa,
  type ListadoDeLaMesa,
  type ResultadoDelLote,
} from "@/lib/mesa-api";

/**
 * La mesa de entrada: lo que llegó por los webhooks.
 *
 * Existe porque sin ella los leads eran invisibles. Entraban, se
 * guardaban bien, y la única forma de verlos era abrir la base —
 * o sea que un lead de una pauta pagada podía morirse de viejo
 * sin que nadie supiera que estaba ahí.
 */

const CLASE_CAMPO =
  "rounded-lg border border-borde bg-campo px-3 py-1.5 text-sm " +
  "outline-none focus:ring-2 focus:ring-campo-foco";

/// La misma caja que el disparador del desplegable: mismos tokens de
/// fondo y borde, mismo cuerpo de letra y mismo alto. Dos controles
/// pegados en la misma barra con dos cajas distintas se leen como dos
/// piezas de sitios distintos.
const CLASE_BUSCADOR =
  "rounded-lg border border-campo-borde bg-campo-fondo px-3 text-[0.78125rem] " +
  "outline-none transition hover:border-marca/60 focus:border-marca";

const ESTADOS: EstadoLead[] = ["PENDIENTE", "CONVERTIDO", "DESCARTADO"];

function cuando(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PaginaMesa() {
  const { admin } = useAdmin();
  /// Quien REPARTE elige asesor; quien no, se las queda.
  ///
  /// Es la misma linea que ya separa a quien puede pasarle fichas
  /// a otro. Un asesor que convierte acaba de decidir que las
  /// atiende el: pedirle que se elija a si mismo no decide nada.
  const reparte = Boolean(admin?.puede?.repartirFichas);
  const [datos, setDatos] = useState<ListadoDeLaMesa | null>(null);
  const [error, setError] = useState<string | null>(null);
  /// Por defecto SOLO lo pendiente, que es lo que la mesa es.
  ///
  /// Un lead convertido ya no se atiende aqui: tiene ficha y vive
  /// en Gestion de leads. Dejarlo en la lista obliga a leerlo
  /// cada vez para descartarlo, y con cientos convertidos la
  /// pantalla deja de servir para lo unico que sirve -- ver a
  /// quien falta por atender.
  const [estado, setEstado] = useState<string>("PENDIENTE");
  const [buscar, setBuscar] = useState("");
  /// Lo que de verdad se manda: consultar en cada tecla sería
  /// una petición por letra.
  const [buscado, setBuscado] = useState("");

  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [convirtiendo, setConvirtiendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDelLote | null>(null);
  /// Descartar tiene su propio dialogo, no comparte el de
  /// convertir: son dos decisiones opuestas y un dialogo que
  /// hiciera las dos invita a pulsar la que no era.
  const [descartando, setDescartando] = useState(false);
  const [motivo, setMotivo] = useState("");
  /// Cual se esta arreglando. Null: ninguno.
  const [arreglando, setArreglando] = useState<LeadDeLaMesa | null>(null);
  /// Cual se esta gestionando -- la llamada.
  const [gestionando, setGestionando] = useState<LeadDeLaMesa | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosSep | null>(null);
  /// La pagina. Con 392 leads, sin esto solo se ven 50 y los
  /// otros 342 son invisibles salvo buscando.
  const [pagina, setPagina] = useState(1);
  /// A quién se le asignan. NO se rellena solo con quien está
  /// mirando: en un lote de cien, el que importa casi nunca es el
  /// que va a llamar. Que empiece vacío obliga a elegir.
  const [asesorId, setAsesorId] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setBuscado(buscar), 350);
    return () => clearTimeout(t);
  }, [buscar]);

  useEffect(() => {
    void crmApi.catalogos().then(setCatalogos).catch(() => setCatalogos(null));
  }, []);

  /// Volver a la 1 al filtrar. Sin esto, filtrar estando en la
  /// pagina 4 deja una lista vacia que parece que no hay nada.
  useEffect(() => {
    setPagina(1);
  }, [estado, buscado]);

  const cargar = useCallback(async () => {
    try {
      setDatos(
        await mesaApi.listar({
          estado: estado || undefined,
          buscar: buscado,
          pagina,
        }),
      );
      setError(null);
    } catch (e) {
      /// Un fallo NO vacía la pantalla: con el refresco cada 30 s,
      /// convertir un parpadeo de red en pantalla en blanco borra
      /// la lista cada vez que la conexión tose.
      setError(e instanceof ErrorApi ? e.message : "No se pudo cargar la mesa.");
    }
  }, [estado, buscado, pagina]);

  /// Cada 10 s, no cada 30.
  ///
  /// Aqui trabajan varios asesores a la vez sobre la misma lista:
  /// uno filtra por su accion de formacion, marca veinte y los
  /// convierte. Con 30 s, otro estaria mirando durante medio
  /// minuto leads que ya tienen dueño, los marcaria, y al
  /// convertir se llevaria un «ya se atendio» por cada uno.
  useDatosVivos(cargar, { intervaloMs: 10_000 });

  const leads = useMemo(() => datos?.leads ?? [], [datos]);

  /// Los que se pueden convertir, DE ESTA PÁGINA.
  ///
  /// La distinción importa: seleccionar «todos» viendo 50 de 392
  /// y convertir 392 sería hacer algo que nadie pidió, y decir
  /// 392 habiendo convertido 50 sería mentir sobre lo que pasó.
  const listos = useMemo(() => leads.filter((l) => l.falta.length === 0), [leads]);

  /// Solo los marcados que siguen estando y siguen listos.
  ///
  /// La lista se refresca sola cada 30 s: sin esto, un lead que
  /// alguien más convirtió mientras tanto seguiría contando.
  const seleccionados = useMemo(
    () => listos.filter((l) => marcados.has(l.id)).map((l) => l.id),
    [listos, marcados],
  );

  const pasaDelTope = seleccionados.length > TOPE_DEL_LOTE;

  function alternar(id: string) {
    setMarcados((antes) => {
      const nuevo = new Set(antes);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  function marcarTodosLosListos() {
    if (seleccionados.length === listos.length) setMarcados(new Set());
    else setMarcados(new Set(listos.slice(0, TOPE_DEL_LOTE).map((l) => l.id)));
  }

  async function convertir() {
    setConvirtiendo(true);
    try {
      const r = await mesaApi.convertirLote(seleccionados, reparte ? asesorId : undefined);
      setResultado(r);
      setMarcados(new Set());
      setConfirmando(false);
      /// El asesor NO se limpia: repartir un lote es hacer varias
      /// tandas seguidas, y volver a elegir cada vez es fricción.
      /// Cambiarlo es un clic cuando toca el siguiente.
      await cargar();
    } catch (e) {
      setError(
        e instanceof ErrorApi ? e.message : "No se pudieron convertir los leads.",
      );
      setConfirmando(false);
    } finally {
      setConvirtiendo(false);
    }
  }

  async function descartar() {
    setConvirtiendo(true);
    try {
      const r = await mesaApi.descartarLote(seleccionados, motivo);
      setResultado({
        pedidos: r.pedidos,
        convertidos: 0,
        conAutorizacion: 0,
        sinAutorizacion: 0,
        fallaron: 0,
        fuera: r.sinTocar,
        problemas: [],
      });
      setMarcados(new Set());
      setDescartando(false);
      setMotivo("");
      await cargar();
    } catch (e) {
      setError(
        e instanceof ErrorApi ? e.message : "No se pudieron descartar.",
      );
    } finally {
      setConvirtiendo(false);
    }
  }

  const r = datos?.resumen ?? {};
  /// Cuántos de los marcados van a quedar sin autorización.
  const sinAutorizar = listos.filter(
    (l) => marcados.has(l.id) && !l.autorizoAlRegistrarse,
  ).length;

  return (
    /// LA FRANJA DE ARRIBA, COMO EN LAS DEMÁS: `pt-4`. Sin ella el
    /// recuadro del título quedaba pegado a la barra del menú (0 px,
    /// medido el 22 sep 2026) mientras las otras pantallas dejan 16.
    <div className="pt-4">
      {/* `descripcionAncha`: el apoyo tiene tope de 760 px por omisión
          --una línea muy larga se lee peor-- y aquí eso lo partía en dos
          renglones cortos con media pantalla vacía al lado: «ajusta para
          que el texto no quede cortado, sino a lo largo» (cliente, 23
          sep 2026). */}
      <Encabezado
        titulo="Mesa de entrada"
        descripcionAncha
        descripcion="Lo que llega por los webhooks: la pauta de Meta y el orquestador de correos. Todavía no están en Gestión de leads — alguien los revisa y los convierte, y ahí entran como Interesados."
      />

      {/* `px-4` y no `px-7`: el mismo canto que el recuadro del título
          (`mx-4`). Con 28 px las cifras y la tabla quedaban 12 px más
          adentro que el título de su propia pantalla. */}
      <section className="space-y-3 px-4 pt-1 pb-4">
        {error && <Aviso tipo="error">{error}</Aviso>}

        {resultado && (
          <Aviso tipo={resultado.fallaron ? "error" : "exito"}>
            <div className="font-semibold">
              {resultado.convertidos} de {resultado.pedidos}{" "}
              {resultado.convertidos === 1 ? "quedó" : "quedaron"} en Gestión de
              leads, en Interesado.
            </div>
            {resultado.sinAutorizacion > 0 && (
              /// Decirlo es la mitad del trabajo: sin esto,
              /// «convertí 40» parecería que las 40 pueden
              /// matricularse, y no pueden.
              <div className="mt-1 text-sm">
                {resultado.sinAutorizacion} sin autorización de datos: no
                llegaron por un formulario, así que hay que pedírsela antes de
                poder matricularlos o reportarlos.
              </div>
            )}
            {resultado.fuera > 0 && (
              <div className="mt-1 text-sm">
                {resultado.fuera} no son de este gremio y no se tocaron.
              </div>
            )}
            {resultado.problemas.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-sm">
                {resultado.problemas.slice(0, 8).map((p) => (
                  <li key={p.leadId}>
                    <span className="font-medium">{p.nombre}</span> — {p.porque}
                  </li>
                ))}
                {resultado.problemas.length > 8 && (
                  <li>y {resultado.problemas.length - 8} más.</li>
                )}
              </ul>
            )}
            <button
              className="mt-2 text-sm font-medium underline"
              onClick={() => setResultado(null)}
            >
              Entendido
            </button>
          </Aviso>
        )}

        <div className="flex flex-wrap gap-3">
          <Cifra
            etiqueta="Sin atender"
            valor={r.PENDIENTE ?? 0}
            pie="esperan que alguien los revise"
            color="var(--aviso)"
          />
          <Cifra
            etiqueta="Convertidos"
            valor={r.CONVERTIDO ?? 0}
            pie="en Gestión de leads"
            color="var(--exito)"
          />
          <Cifra etiqueta="Descartados" valor={r.DESCARTADO ?? 0} />
        </div>

        {/* EL FILTRO MANDA, EL BUSCADOR ACOMPAÑA. Iba al revés: el
            buscador se estiraba a todo lo ancho --1.400 px para escribir
            un documento-- y el filtro quedaba de refilón al final,
            cuando es el que decide QUÉ lista se está mirando: «reduce el
            ancho de ese de búsqueda y dale más protagonismo a Sin
            atender» (cliente, 23 sep 2026). */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="w-[min(260px,100%)]">
            <Campo
              etiqueta="Qué lista ve"
              /// El recuento, debajo del filtro y no al final de la
              /// barra: describe la lista que ese filtro acaba de
              /// elegir, y ahí libera el canto derecho para el buscador.
              ayuda={
                datos
                  ? `${datos.total} ${datos.total === 1 ? "lead" : "leads"}${
                      datos.paginas > 1 ? ` · viendo ${leads.length}` : ""
                    }`
                  : undefined
              }
            >
          {/* EL DESPLEGABLE DE LA CASA, no el del sistema operativo.
              «Revisa los desplegables, deben ser elegantes como [el de]
              Asignar grupo por lote» (cliente, 23 sep 2026). Un
              `<select>` nativo abre la lista que dibuja Windows --cuadro
              cuadrado y azul de sistema-- y ninguna regla de CSS llega
              ahí; el nuestro pinta su propia lista. */}
              <Desplegable
                alto={38}
                etiquetaAria="Estado del lead"
                marcador="Todos, incluidos los ya atendidos"
                valor={estado}
                opciones={[
                  { valor: "", etiqueta: "Todos, incluidos los ya atendidos" },
                  ...ESTADOS.map((s) => ({ valor: s, etiqueta: ETIQUETA_ESTADO_LEAD[s] })),
                ]}
                alElegir={setEstado}
              />
            </Campo>
          </div>

          {/* HASTA EL CANTO DERECHO, Y CON LA MISMA CAJA QUE EL FILTRO.
              Estuvo con tope de 820 px y el recuento detrás, así que
              quedaba un hueco muerto a la derecha; y llevaba otro fondo
              y otro cuerpo de letra que el desplegable de al lado, así
              que los dos controles de la misma barra no se veían de la
              misma familia: «que vaya hasta la esquina derecha, y esto
              como blanco como Qué lista ve para que los tamaños se vean
              iguales» (cliente, 23 sep 2026). */}
          {/* Con su rótulo, como el filtro: dos controles pegados, uno
              rotulado y el otro no, se desalinean solos --el que no lo
              lleva sube o baja según lo que tenga debajo el otro--. */}
          <div className="min-w-[320px] flex-1">
            <Campo etiqueta="Buscar">
              <input
                style={{ height: 38 }}
                className={CLASE_BUSCADOR + " w-full"}
                placeholder="Documento, nombre, correo o celular"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
              />
            </Campo>
          </div>
        </div>

        {seleccionados.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-marca/30 bg-marca-suave px-4 py-3">
            <span className="text-sm font-semibold">
              {seleccionados.length} seleccionado
              {seleccionados.length === 1 ? "" : "s"}
            </span>
            {sinAutorizar > 0 && (
              <span className="text-sm text-aviso">
                {sinAutorizar} sin autorización de datos
              </span>
            )}
            {pasaDelTope && (
              <span className="text-sm text-error">
                Máximo {TOPE_DEL_LOTE} por vez
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <button
                className="text-sm font-medium text-texto-suave hover:underline"
                onClick={() => setMarcados(new Set())}
              >
                Quitar la selección
              </button>
              {/* Descartar es un ENLACE y convertir un boton.

                  Los dos son acciones, pero solo una es la que se
                  hace noventa veces de cada cien. Dos botones
                  iguales al lado obligan a leer cual es cual cada
                  vez, y aqui se pulsa rapido. */}
              <button
                className="text-sm font-medium text-texto-suave hover:text-error hover:underline"
                onClick={() => setDescartando(true)}
              >
                Descartar
              </button>
              <Boton onClick={() => setConfirmando(true)} disabled={pasaDelTope}>
                Convertir a Interesado
              </Boton>
            </div>
          </div>
        )}

        {confirmando && (
          <div className="space-y-3 rounded-xl border border-borde bg-superficie-2 p-5">
            <div className="font-semibold">
              Va a pasar {seleccionados.length} lead
              {seleccionados.length === 1 ? "" : "s"} a Gestión de leads.
            </div>
            <ul className="space-y-1 text-sm text-texto-suave">
              <li>
                Nacen en <strong>Interesado</strong>, con el curso que pidieron.
              </li>
              <li>
                Les falta la <strong>sede</strong>: sale de dónde viva cada
                persona, y eso el lead no lo trae. Se completa después, en
                Gestión de leads.
              </li>
              <li>
                {seleccionados.length - sinAutorizar} autorizaron al llenar el
                formulario: se les deja la constancia con su propio registro
                como prueba.
              </li>
              {sinAutorizar > 0 && (
                <li className="text-aviso">
                  {sinAutorizar} no llegaron por un formulario, así que no
                  consta que autorizaran. Pasan igual a Gestión de leads, pero no se podrán
                  matricular ni reportar hasta que alguien les pida la
                  autorización.
                </li>
              )}
            </ul>
            {!reparte && (
              <p className="text-sm">
                Quedan asignados <strong>a usted</strong>.
              </p>
            )}

            {reparte && (
            <div className="space-y-1">
              <label
                className="block text-sm font-medium"
                htmlFor="asesor-del-lote"
              >
                ¿Quién los va a atender?
              </label>
              <div className="w-full max-w-sm">
                <Desplegable
                  id="asesor-del-lote"
                  alto={38}
                  etiquetaAria="Asesor para el lote"
                  marcador="Elija un asesor…"
                  valor={asesorId}
                  opciones={(datos?.asesores ?? []).map((a) => ({
                    valor: a.id,
                    etiqueta: a.nombre,
                  }))}
                  alElegir={setAsesorId}
                />
              </div>
              <p className="text-xs text-texto-suave">
                Se les asigna a esta persona. Puede hacer varias tandas: veinte
                para una, diez para otra.
              </p>
            </div>
            )}

            <div className="flex gap-2">
              <Boton onClick={convertir} disabled={convirtiendo || (reparte && !asesorId)}>
                {convirtiendo ? "Convirtiendo…" : "Sí, convertirlos"}
              </Boton>
              <button
                className="text-sm font-medium text-texto-suave hover:underline"
                onClick={() => setConfirmando(false)}
                disabled={convirtiendo}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {descartando && (
          <div className="space-y-3 rounded-xl border border-error/30 bg-error-suave p-5">
            <div className="font-semibold text-error">
              Va a descartar {seleccionados.length} lead
              {seleccionados.length === 1 ? "" : "s"}.
            </div>
            <p className="text-sm">
              No se borran: salen de la mesa y quedan con su motivo. Un lead
              descartado sigue siendo la prueba de que alguien llegó y de que
              se decidió no atenderlo.
            </p>
            <div className="space-y-1">
              <label className="block text-sm font-medium" htmlFor="motivo">
                ¿Por qué se descartan?
              </label>
              <input
                id="motivo"
                className={CLASE_CAMPO + " w-full max-w-md"}
                placeholder="Número equivocado, no le interesa, duplicado…"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              {/* Obligatorio, como el motivo de una etapa de
                  salida: pedirlo opcional es no pedirlo, y sin el
                  la mesa se vacia y nadie puede decir por que se
                  descarto a nadie. */}
              <p className="text-xs text-texto-suave">
                Queda escrito con su nombre. Es lo que se responde cuando
                alguien pregunta por qué no le llamaron.
              </p>
            </div>
            <div className="flex gap-2">
              <Boton
                onClick={descartar}
                disabled={convirtiendo || !motivo.trim()}
              >
                {convirtiendo ? "Descartando…" : "Sí, descartarlos"}
              </Boton>
              <button
                className="text-sm font-medium text-texto-suave hover:underline"
                onClick={() => setDescartando(false)}
                disabled={convirtiendo}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {datos && leads.length === 0 ? (
          <Vacio titulo="No hay leads que mostrar">
            {buscado || estado
              ? "Con esos filtros no aparece ninguno."
              : "Cuando entre uno por el webhook, aparece aquí."}
          </Vacio>
        ) : (
          <div className="caja-scroll overflow-x-auto rounded-xl border border-borde">
            <table className="w-full min-w-[1060px] text-sm">
              <thead className="bg-tabla-cabecera text-left text-xs tracking-wide text-texto-suave uppercase">
                <tr>
                  <th className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar los que están listos"
                      checked={
                        listos.length > 0 && seleccionados.length === listos.length
                      }
                      disabled={listos.length === 0}
                      onChange={marcarTodosLosListos}
                    />
                  </th>
                  <th className="px-4 py-2.5 font-medium">Persona</th>
                  <th className="px-4 py-2.5 font-medium">Contacto</th>
                  <th className="px-4 py-2.5 font-medium">Entró por</th>
                  <th className="px-4 py-2.5 font-medium">Qué pidió</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium">Llegó</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l: LeadDeLaMesa) => (
                  <tr key={l.id} className="border-t border-borde align-top">
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={"Seleccionar a " + l.nombre}
                        checked={marcados.has(l.id)}
                        disabled={l.falta.length > 0}
                        onChange={() => alternar(l.id)}
                      />
                    </td>

                    <td className="px-4 py-2.5">
                      <div className="font-medium">{l.nombre}</div>
                      <div className="text-xs text-texto-suave">
                        {l.documento ?? "sin documento"} · {l.gremio}
                      </div>
                      {/* Un lead que no se puede marcar y no dice
                          por qué es un lead que alguien va a dar
                          por perdido. */}
                      {l.falta.length > 0 && l.estado === "PENDIENTE" && (
                        <div className="mt-0.5 text-xs text-aviso">
                          Le falta {l.falta.join(", ")}
                        </div>
                      )}
                      {/* Arreglar está en TODAS las pendientes, no
                          solo en las que les falta algo: también se
                          corrige un correo mal escrito que no
                          impide convertir pero sí llamar. */}
                      {l.estado === "PENDIENTE" && (
                        <div className="mt-0.5 flex flex-wrap gap-3">
                          <button
                            className="text-xs font-medium text-marca hover:underline"
                            onClick={() => setArreglando(l)}
                          >
                            Arreglar
                          </button>
                          {/* Gestionar sale SIEMPRE que siga en la
                              mesa, tenga documento o no: es
                              justamente el lead sin cédula el que
                              hay que llamar para conseguirla.

                              Si no se puede contactar, el cajón lo
                              dice con su motivo. Esconder el botón
                              dejaría un lead mudo que nadie sabe
                              por qué no se toca. */}
                          <button
                            className="text-xs font-medium text-marca hover:underline"
                            onClick={() => setGestionando(l)}
                          >
                            {l.gestiones > 0
                              ? `Gestionar (${l.gestiones})`
                              : "Gestionar"}
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-2.5">
                      <div>{l.celular ?? "—"}</div>
                      <div className="text-xs text-texto-suave">
                        {l.correo ?? "—"}
                      </div>
                    </td>

                    <td className="px-4 py-2.5">
                      <div>{l.origen}</div>
                      {/* De qué SISTEMA vino, que no es lo mismo que
                          por qué red: uno es el canal y el otro
                          quién nos lo entregó. */}
                      <div className="text-xs text-texto-suave">{l.porDonde}</div>
                      {!l.autorizoAlRegistrarse && l.estado === "PENDIENTE" && (
                        <div className="text-xs text-texto-suave">
                          sin autorización
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-2.5">
                      {/* Lo que dijo y lo que se resolvió, separados:
                          si el curso no sale, se ve enseguida que el
                          texto no nombró ninguno del catálogo. */}
                      {l.curso ? (
                        <div className="font-medium">{l.curso}</div>
                      ) : (
                        <div className="text-aviso">Sin curso reconocido</div>
                      )}
                      {/* LA SEDE, resuelta ya aquí.

                          Al convertir, `sedeQueLeToca` la deduce de
                          dónde vive y la ficha nace con ella. Pero la
                          mesa no la enseñaba, así que se convertía a
                          ciegas: no se sabía si iba a nacer pudiendo
                          matricularse o si el departamento de esa
                          persona no tiene ese curso.

                          Null con curso puesto NO es un dato que
                          falte: es que no hay sede que le sirva, y
                          eso se arregla escribiéndole, no
                          convirtiéndola. */}
                      {l.curso &&
                        (l.sede ? (
                          <div className="text-xs text-texto-suave">
                            Sede: {l.sede}
                          </div>
                        ) : (
                          <div className="text-xs text-aviso">
                            Ninguna sede de este curso llega a donde vive
                          </div>
                        ))}
                      {l.pidio && (
                        <div className="text-xs text-texto-suave">{l.pidio}</div>
                      )}
                    </td>

                    <td className="px-4 py-2.5">
                      <span className={"font-medium " + TONO_ESTADO_LEAD[l.estado]}>
                        {ETIQUETA_ESTADO_LEAD[l.estado]}
                      </span>
                      {l.motivo && (
                        <div className="mt-0.5 text-xs text-texto-suave">
                          {l.motivo}
                        </div>
                      )}
                      {l.participanteId && (
                        <Link
                          href={"/admin/participantes/" + l.participanteId}
                          className="mt-0.5 block text-xs font-medium text-marca hover:underline"
                        >
                          Ver en Gestión de leads
                        </Link>
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-xs whitespace-nowrap text-texto-suave">
                      {cuando(l.recibidoEn)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Pasar de página. Con 392 leads y 50 por página, sin
            esto los otros 342 son invisibles salvo buscando. */}
        {datos && datos.paginas > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm">
            <button
              className="rounded-lg border border-borde px-3 py-1 disabled:opacity-40"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1}
            >
              Anterior
            </button>
            <span className="text-texto-suave">
              Página {datos.pagina} de {datos.paginas}
            </span>
            <button
              className="rounded-lg border border-borde px-3 py-1 disabled:opacity-40"
              onClick={() => setPagina((p) => Math.min(datos.paginas, p + 1))}
              disabled={pagina >= datos.paginas}
            >
              Siguiente
            </button>
          </div>
        )}
      </section>

      {arreglando && (
        <ArreglarLead
          lead={arreglando}
          cursos={datos?.cursos ?? []}
          catalogos={catalogos}
          alCerrar={() => setArreglando(null)}
          alGuardado={cargar}
        />
      )}

      {gestionando && (
        <GestionarLead
          lead={gestionando}
          alCerrar={() => setGestionando(null)}
          alGuardado={cargar}
        />
      )}
    </div>
  );
}
