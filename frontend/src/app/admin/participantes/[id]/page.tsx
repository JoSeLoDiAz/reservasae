"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ConfirmarBorrado } from "@/components/admin/confirmar-borrado";
import { IconoCheck } from "@/components/admin/iconos";
import { SelectorBuscable } from "@/components/admin/selector-buscable";
import { DatosSena } from "@/components/admin/datos-sena";
import { PildoraEtapa } from "@/components/admin/etapa";
import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  Tarjeta,
  useAdmin,
} from "@/components/admin/marco-admin";
import { HistoricoDeValores } from "@/components/admin/historico-valores";
import { EnviarCorreo } from "@/components/admin/enviar-correo";
import { RevisarPropuesta } from "@/components/admin/revisar-propuesta";
import { useToast } from "@/components/admin/toast";
import { alcanza } from "@/lib/admin-api";
import { useDatosVivos } from "@/lib/datos-vivos";
import { ErrorApi } from "@/lib/api";
import {
  CANALES,
  crmApi,
  ETAPAS_A_MANO,
  ETAPAS_SALIDA,
  ETIQUETA_CANAL,
  ETIQUETA_CANAL_CONTACTO,
  ETIQUETA_RESULTADO,
  RESULTADOS,
  TONO_RESULTADO,
  ETIQUETA_RUI,
  type CanalContacto,
  type ResultadoGestion,
  type ConsultaRui,
  type PropuestaDelInteresado,
  ETIQUETA_ETAPA,
  ETIQUETA_ORIGEN,
  type Canal,
  type Etapa,
  type Ficha,
  type Opciones,
} from "@/lib/crm-api";

const fecha = (s: string) =>
  new Date(s).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

const soloDia = (s: string) =>
  new Date(s).toLocaleDateString("es-CO", { dateStyle: "medium" });

/**
 * Un dato de identidad, con su etiqueta encima y pequeña.
 *
 * La cabecera anterior apilaba tres renglones de texto gris
 * sin decir qué era cada uno: había que deducir que
 * «1010316499» era el documento y que «ADECOPRIA» era el
 * gremio. En una ficha que se abre cien veces al día, deducir
 * cuesta más que leer.
 */
function Hecho({
  etiqueta,
  valor,
  mono,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.6875rem] font-semibold tracking-wider text-texto-suave uppercase">
        {etiqueta}
      </dt>
      <dd className={`mt-0.5 truncate text-sm ${mono ? "font-mono" : ""}`}>
        {valor}
      </dd>
    </div>
  );
}

/**
 * Un control de la barra de acción.
 *
 * Sustituye a `Tarjeta` en los tres de arriba, y esa es la
 * diferencia entre esto y lo de antes: tres tarjetas con
 * borde, sombra y 24px de aire dentro, para tres desplegables,
 * ocupaban media pantalla y dejaban a «Asesor» con 150px de
 * vacío porque la rejilla las estiraba a la más alta.
 *
 * Un CRM no pone cada control en su caja: pone la identidad
 * arriba y debajo una barra donde se actúa. Eso es lo que es.
 */
function Control({
  etiqueta,
  ancho = "",
  children,
}: {
  etiqueta: string;
  /// Cuántas de las doce columnas ocupa en la barra. Vacío
  /// para los que no viven en ella.
  ancho?: string;
  children: React.ReactNode;
}) {
  return (
    /// `min-w-0` para que un nombre de curso largo no ensanche
    /// su columna y descuadre las otras dos.
    <div className={`min-w-0 ${ancho}`}>
      <p className="text-[0.6875rem] font-semibold tracking-wider text-texto-suave uppercase">
        {etiqueta}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/**
 * Si el número se puede marcar. NO es la validación.
 *
 * La regla de qué celular sirve vive en `comun/celular.ts` del
 * servidor y ahí se queda: copiarla aquí serían dos verdades
 * sobre lo mismo. Esto responde otra pregunta —«¿pinto el botón
 * de llamar?»— y por eso puede ser más laxa: un fijo con
 * indicativo se marca igual aunque no sirva para el reporte.
 */
function marcable(celular: string | null): boolean {
  return (celular ?? "").replace(/\D/g, "").length >= 7;
}

export default function PaginaFicha() {
  const { id } = useParams<{ id: string }>();
  const [f, setF] = useState<Ficha | null>(null);
  const [opciones, setOpciones] = useState<Opciones | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [canales, setCanales] = useState<CanalContacto[]>([]);
  const [resultado, setResultado] = useState<ResultadoGestion | null>(null);
  const [borrando, setBorrando] = useState(false);
  const { admin, gremio: gremioElegido } = useAdmin();
  const router = useRouter();
  const toast = useToast();
  const esSuperadmin = admin.rol === "SUPERADMIN";
  // sin permisos aun no se esconde nada
  const puedeEscribir =
    !admin.permisos || alcanza(admin.permisos.inscripciones, "ESCRIBIR");

  const cargar = useCallback(async () => {
    const ficha = await crmApi.obtener(id);
    setF(ficha);
    setOpciones(await crmApi.opciones(ficha.convenio.id, ficha.id));
  }, [id]);

  useEffect(() => {
    void cargar().catch((e) => setError((e as ErrorApi).message));
  }, [cargar]);

  // el aviso queda; el toast se ve
  async function conError(accion: () => Promise<void>, exito = "Cambios guardados.") {
    setError(null);
    try {
      await accion();
      await cargar();
      toast.exito(exito);
    } catch (e) {
      const mensaje = (e as ErrorApi).message;
      setError(mensaje);
      toast.error(mensaje);
    }
  }

  if (!f) return <p className="text-texto-suave">{error ?? "Cargando…"}</p>;

  const nombre = [
    f.persona.primerNombre,
    f.persona.segundoNombre,
    f.persona.primerApellido,
    f.persona.segundoApellido,
  ]
    .filter(Boolean)
    .join(" ");


  /// La de este convenio, viva o revocada.
  ///
  /// Vienen ordenadas de la mas reciente a la mas antigua, asi
  /// que la primera es la que cuenta: si volvio a autorizar
  /// despues de revocar, manda la nueva.
  const suyas = f.persona.autorizaciones.filter(
    (a) =>
      a.politica.destinatario === "PARTICIPANTE" &&
      a.politica.convenioId === f.convenio.id,
  );
  const autorizacion = suyas.find((a) => !a.revocadaEn);
  const revocada = autorizacion ? null : suyas.find((a) => a.revocadaEn);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/participantes" className="text-sm underline">
          ← Volver a inscripciones
        </Link>
      </div>

      {/* LA CABECERA DE LA FICHA: quién es, y qué se le hace.
          Una sola pieza, no cinco cajas flotando.

          Arriba la identidad, con cada dato etiquetado. Debajo,
          pegada y dentro del mismo borde, la barra donde se
          actúa. Que compartan caja es lo que dice que la barra
          opera sobre ESTA persona — separadas, eran tres
          controles sueltos en la página. */}
      <header
        /// SIN `overflow-hidden`.
        ///
        /// Lo tenía para que el fondo de la barra no se saliera
        /// por las esquinas redondeadas. Con 4px de radio eso
        /// ya no se nota, y a cambio recortaba el desplegable
        /// de «Acción de formación» y el de «Grupo»: los dos
        /// son `SelectorBuscable`, que abre su lista DENTRO de
        /// la página, así que un ancestro con overflow se la
        /// come. El de «Asesor» no se enteraba porque es un
        /// `<select>` nativo y su lista la pinta el sistema
        /// operativo, por encima de todo.
        className="rounded-2xl border border-borde bg-superficie"
      >
        {/* Aquí hubo un filo de color, unas iniciales en un
            cuadro y un riel con el recorrido. Los tres fuera:
            eran adornos alrededor del dato, y el dato ya se
            dice solo. La etapa se lee en su color, a la
            derecha, y con eso basta. */}
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {nombre}
            </h1>

            {/* Los cuatro datos que identifican la ficha, en
                línea y etiquetados. `gap-x-8` y no un separador
                «·»: los puntos medios se leen como parte del
                dato cuando el valor ya trae puntuación. */}
            <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
              <Hecho etiqueta="Documento" valor={f.persona.documento} mono />
              {/* El gremio SOLO cuando se están mirando los
                  dos. Si arriba se eligió ADECOPRIA, toda la
                  pantalla es de ADECOPRIA y repetirlo en cada
                  ficha es gastar un hueco en decir algo que ya
                  está dicho. */}
              {!gremioElegido && (
                <Hecho
                  etiqueta="Gremio"
                  valor={f.convenio.sigla ?? f.convenio.nombre}
                />
              )}
              {/* «Entró por» y «En el sistema desde» se fueron
                  a «Control de cambios».

                  Los dos cuentan de dónde salió esta ficha y
                  cuándo, que es exactamente lo que esa tarjeta
                  narra —su primera línea ya es el alta—. En la
                  cabecera ocupaban el sitio de lo que sí se
                  mira al abrir: quién es y en qué punto va. */}
            </dl>
          </div>

          {/* La etapa, en su color y con su rótulo, alineada
              con los demás datos: es uno más, el que más pesa.
              Arriba a la derecha porque es lo primero que se
              busca al abrir una ficha. */}
          <div className="text-right">
            <p className="text-[0.6875rem] font-semibold tracking-wider text-texto-suave uppercase">
              Etapa
            </p>
            <p className="mt-0.5 text-sm">
              <PildoraEtapa etapa={f.etapa} />
            </p>
          </div>
        </div>

        {/* LA BARRA DE ACCIÓN.

            `items-start` a propósito, y es la corrección del
            fallo que se veía: sin él la rejilla estiraba las
            tres columnas a la más alta y «Asesor» —que solo
            tiene un desplegable y un botón— quedaba con un
            palmo de vacío debajo. Cada una mide lo suyo. */}
        {/* Anchos DESIGUALES a propósito, sobre doce columnas.

            Con cuatro iguales, «Mover de etapa» —que solo
            enseña una palabra— tenía el mismo sitio que
            «Acción de formación», cuyo nombre pasa de sesenta
            caracteres y salía cortado con puntos suspensivos.
            Simétrico no es que todo mida igual: es que cada
            uno mida lo que su contenido pide. */}
        <div className="grid items-start gap-x-6 gap-y-5 rounded-b-2xl border-t border-borde bg-superficie-alterna px-5 py-4 sm:px-6 md:grid-cols-2 xl:grid-cols-12">
          <MoverDeEtapa ficha={f} alGuardar={conError} />
          <Asesor ficha={f} opciones={opciones} alGuardar={conError} />
          <Asignacion ficha={f} opciones={opciones} alGuardar={conError} />
        </div>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {f.faltantes.bloquean.length > 0 && (
        <Aviso tipo="error">
          <p className="font-medium">Todavía no se puede matricular</p>
          <ul className="mt-2 list-inside list-disc">
            {f.faltantes.bloquean.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Aviso>
      )}


      {/* La propuesta va A LO ANCHO, y no dentro de una
          columna. Es una interrupción —alguien completó sus
          datos y hay que decidir qué se acepta—, y metida en
          una columna se lee como una tarjeta más de las diez.
          Aquí corta la página en dos y se ve. */}
      <PropuestaDelInteresadoCard ficha={f} alGuardar={conError} />

      {/* EL EXPEDIENTE, en dos columnas.

          IZQUIERDA — hasta dónde va. Los tres momentos por los
          que pasa una ficha, en el orden en que se llenan:
          quién es (¿el nombre es el de la cédula?), dónde
          trabaja, y qué le falta por darnos. Leída de arriba
          abajo dice sola en qué punto está.

          DERECHA — quién es, en datos. Es lo que el asesor
          tiene delante mientras habla por teléfono.

          `items-start` a propósito: estas dos NO se emparejan.
          Son dos pilas independientes y forzarlas a medir lo
          mismo abre un hueco debajo de la más corta. Es al
          revés que en la franja de arriba, donde las tres sí
          se estiran porque forman una sola barra. */}
      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <div className="space-y-6">
          <ValidacionRui ficha={f} alGuardar={conError} />
          <DatosDeLaEmpresa ficha={f} puedeEscribir={puedeEscribir} />
          {puedeEscribir && <EnlaceCompletar ficha={f} />}
        </div>

        <div className="space-y-6">
          <DatosSena ficha={f} alGuardar={conError} />
        </div>
      </div>

      {/* EL CORREO Y EL PERMISO, en pareja.

          El correo a la izquierda porque es lo que se hace, y
          la autorización a la derecha porque es lo que se
          consulta. Sin `items-start`: aquí las dos SÍ se
          estiran a la misma altura, que es lo que las hace
          parecer una pareja y no dos cajas sueltas de distinto
          tamaño. */}
      <div className="grid gap-6 lg:grid-cols-2">
      {puedeEscribir && (
        <Tarjeta
          titulo="Escribirle un correo"
          descripcion="Con una plantilla, que se llena sola con los datos de esta ficha."
        >
          <EnviarCorreo participanteId={f.id} />
        </Tarjeta>
      )}

      <Tarjeta
        titulo="Autorización de tratamiento de datos"
        insignia={autorizacion ? "Autorizada" : "Sin autorizar"}
      >
        {autorizacion ? (
          <div className="space-y-3">
            <p className="text-sm">
              Autorizada el <strong>{fecha(autorizacion.otorgadaEn)}</strong> — versión{" "}
              {autorizacion.politica.version}. {ETIQUETA_CANAL[autorizacion.canal]}.
            </p>
            {puedeEscribir && <Revocar id={f.id} alGuardar={conError} />}
          </div>
        ) : revocada ? (
          /* Decir que REVOCÓ, no que nunca autorizó. Son cosas
             distintas y la segunda invita a deshacer la
             primera sin saber que se está deshaciendo algo. */
          <div className="space-y-3">
            <Aviso tipo="error">
              Esta persona <strong>revocó</strong> su autorización el{" "}
              {fecha(revocada.revocadaEn!)}. Mientras siga revocada no se puede
              matricular ni entra en el reporte al SENA, y eso es lo correcto.
            </Aviso>
            <p className="text-sm text-texto-suave">
              Solo se vuelve a registrar si <strong>ella lo pide</strong>. Volver a
              marcarla por iniciativa nuestra deshace un derecho que ejerció.
            </p>
            <details className="text-sm">
              <summary className="cursor-pointer text-texto-suave underline">
                La persona pidió autorizar de nuevo
              </summary>
              <div className="mt-4">
                <RegistrarAutorizacion id={f.id} alGuardar={conError} />
              </div>
            </details>
          </div>
        ) : (
          <RegistrarAutorizacion id={f.id} alGuardar={conError} />
        )}
      </Tarjeta>

      </div>

      {/* Las notas van A LO ANCHO y solas.

          Antes compartían fila con la autorización, y es la
          única caja de esta pantalla donde se ESCRIBE de
          verdad: media pantalla dejaba el renglón de la nota
          tan corto que no cabía una frase entera. */}
      <Tarjeta
        titulo="Notas"
        descripcion="No se borran: una corrección es otra nota."
        insignia={`${f.notas.length}`}
      >
        <div className="space-y-4">
          {/* La cifra que hace útil todo lo de abajo.

              «Lleva 4 intentos y nunca se le ha logrado hablar»
              es una frase accionable; «tiene 4 notas» no lo es.
              Por eso se cuentan los intentos DESDE el último
              contacto y no desde siempre. */}
          {f.gestion.intentos > 0 && (
            <p className="text-sm">
              {f.gestion.ultimoContacto ? (
                <>
                  Se habló con ella el{" "}
                  <strong>{fecha(f.gestion.ultimoContacto)}</strong>
                  {f.gestion.sinContacto > 0 && (
                    <>
                      , y desde entonces{" "}
                      <strong>
                        {f.gestion.sinContacto}{" "}
                        {f.gestion.sinContacto === 1 ? "intento" : "intentos"}
                      </strong>{" "}
                      sin respuesta
                    </>
                  )}
                  .
                </>
              ) : (
                <span className="text-aviso">
                  <strong>
                    {f.gestion.intentos}{" "}
                    {f.gestion.intentos === 1 ? "intento" : "intentos"}
                  </strong>{" "}
                  y nunca se ha logrado hablar con ella.
                </span>
              )}
              {f.gestion.datoMalo > 0 && (
                <span className="text-error">
                  {" "}
                  El dato de contacto se reportó malo — pídaselo a la
                  organización.
                </span>
              )}
            </p>
          )}

          {/* MARCAR Y REGISTRAR, en ese orden.

              El botón hace dos cosas a la vez: abre el marcador
              y deja el formulario armado en «Llamada». Así,
              al colgar, registrar la gestión es marcar cómo
              salió y escribir un renglón — que es lo único que
              un asesor va a hacer de verdad entre llamada y
              llamada. */}
          {marcable(f.persona.celular) && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-borde bg-superficie-alterna px-3 py-2">
              <a
                href={`tel:${f.persona.celular}`}
                onClick={() => {
                  setCanales((antes) =>
                    antes.includes("LLAMADA") ? antes : [...antes, "LLAMADA"],
                  );
                }}
                className="rounded-lg border border-marca bg-marca-suave px-3 py-1.5 text-sm font-medium text-marca"
              >
                Llamar al {f.persona.celular}
              </a>
              <span className="text-xs text-texto-suave">
                Marca en el teléfono o el softphone de este equipo, y deja la
                nota lista en «Llamada».
              </span>
            </div>
          )}

          <div className="space-y-3">
            {/* el canal antes que el texto: primero por dónde */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-texto-suave">Vía:</span>
              {CANALES.map((c) => {
                const puesto = canales.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={puesto}
                    onClick={() =>
                      setCanales((antes) =>
                        antes.includes(c)
                          ? antes.filter((x) => x !== c)
                          : [...antes, c],
                      )
                    }
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      puesto
                        ? "border-marca bg-marca-suave font-medium text-marca"
                        : "border-borde hover:bg-superficie-alterna"
                    }`}
                  >
                    {ETIQUETA_CANAL_CONTACTO[c]}
                  </button>
                );
              })}
            </div>

            {/* Cómo salió, que es distinto de por dónde fue.

                Sin esto la nota dice que se intentó y no si se
                logró, y entonces «lleva cuatro intentos sin
                contestar» no se puede saber. */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-texto-suave">Cómo salió:</span>
              {RESULTADOS.map((r) => {
                const puesto = resultado === r;
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={puesto}
                    onClick={() => setResultado(puesto ? null : r)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      puesto
                        ? "border-marca bg-marca-suave font-medium text-marca"
                        : "border-borde hover:bg-superficie-alterna"
                    }`}
                  >
                    {ETIQUETA_RESULTADO[r]}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <input
                className={CLASE_CONTROL}
                placeholder="Qué pasó con esta persona"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
              <Boton
                disabled={!nota.trim() || canales.length === 0 || !resultado}
                onClick={() =>
                  conError(async () => {
                    await crmApi.agregarNota(
                      f.id,
                      nota.trim(),
                      canales,
                      resultado!,
                    );
                    setNota("");
                    setCanales([]);
                    setResultado(null);
                  }, "Nota agregada.")
                }
              >
                Agregar
              </Boton>
            </div>

            {canales.length === 0 && nota.trim() !== "" && (
              <p className="text-sm text-texto-suave">
                Marque por dónde fue la gestión. Sin eso no se puede medir qué
                canal funciona.
              </p>
            )}

            {canales.length > 0 && !resultado && nota.trim() !== "" && (
              <p className="text-sm text-texto-suave">
                Marque cómo salió. Es lo que separa «lo intenté» de «hablé con
                ella», y de eso sale a quién hay que insistirle.
              </p>
            )}
          </div>

          {f.notas.length === 0 && (
            <p className="text-sm text-texto-suave">Todavía no hay notas.</p>
          )}

          {f.notas.map((n) => (
            <article key={n.id} className="border-t border-borde pt-3">
              <p className="text-sm">{n.texto}</p>
              <p className="mt-1 text-xs text-texto-suave">
                {n.canales?.length
                  ? `${n.canales.map((c) => ETIQUETA_CANAL_CONTACTO[c]).join(" + ")} · `
                  : ""}
                {n.resultado && (
                  <span className={`font-medium ${TONO_RESULTADO[n.resultado]}`}>
                    {ETIQUETA_RESULTADO[n.resultado]}
                  </span>
                )}
                {n.resultado ? " · " : ""}
                {n.autorNombre} · {fecha(n.creadoEn)}
              </p>
            </article>
          ))}
        </div>
      </Tarjeta>

      {/* LOS DOS HISTORIALES, en pareja y plegados.

          A la izquierda, qué HIZO alguien. A la derecha, qué
          DECÍA el dato. Son dos preguntas distintas: la
          primera no sirve para deshacer —«Ana cambió el correo
          el martes» no dice cuál era— y la segunda no dice
          quién lo tocó. */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <Tarjeta
        titulo="Control de cambios"
        descripcion="De dónde salió esta ficha, y cada cambio de etapa."
        insignia={`${f.movimientos.length}`}
      >
        {/* De dónde viene y desde cuándo, encima de la lista.
            Es el encabezado de la historia: lo que había antes
            del primer movimiento. */}
        <dl className="mb-4 flex flex-wrap gap-x-8 gap-y-3 border-b border-borde pb-4">
          <Hecho etiqueta="Entró por" valor={ETIQUETA_ORIGEN[f.origen]} />
          <Hecho etiqueta="En el sistema desde" valor={soloDia(f.creadoEn)} />
        </dl>

        <ol className="space-y-2.5">
          {f.movimientos.map((m) => (
            <li key={m.id} className="text-sm">
              <span className="text-texto-suave">{fecha(m.creadoEn)}</span> —{" "}
              {m.etapaAntes === m.etapaDespues ? (
                // no cambio de etapa: fue otra cosa, y la nota
                // es la que dice cual
                <strong>{m.nota ?? "Se le hizo un cambio"}</strong>
              ) : (
                <>
                  {m.etapaAntes ? `${ETIQUETA_ETAPA[m.etapaAntes]} → ` : "Alta en "}
                  <strong>{ETIQUETA_ETAPA[m.etapaDespues]}</strong>
                </>
              )}
              {m.admin ? (
                <span className="text-texto-suave"> · por {m.admin.nombre}</span>
              ) : (
                <span className="text-texto-suave"> · por el sistema</span>
              )}
              {m.motivo && <span className="text-texto-suave"> · {m.motivo}</span>}
              {m.nota && m.etapaAntes !== m.etapaDespues && (
                <span className="text-texto-suave"> · {m.nota}</span>
              )}
            </li>
          ))}
        </ol>
      </Tarjeta>

      <Tarjeta
        titulo="Cambios realizados"
        descripcion="Cada dato que se corrigió, con su valor anterior."
      >
        <HistoricoDeValores
          participanteId={f.id}
          puedeEscribir={puedeEscribir}
        />
      </Tarjeta>
      </div>

      {f.persona.participaciones.length > 0 && (
        <Tarjeta
          titulo="Otros cursos de esta persona"
          descripcion="La misma persona, identificada por su documento. Solo se listan los de este gremio."
        >
          <ul className="space-y-1 text-sm">
            {f.persona.participaciones.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/participantes/${p.id}`} className="underline">
                  {p.accionFormacion
                    ? `${p.accionFormacion.codigo} · ${p.accionFormacion.nombre}`
                    : "Sin acción asignada"}
                </Link>{" "}
                <span className="text-texto-suave">
                  ({p.convenio.sigla} · {ETIQUETA_ETAPA[p.etapa]})
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {esSuperadmin && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => setBorrando(true)}
            className="text-sm text-error underline"
          >
            Quitar a esta persona del curso
          </button>
        </div>
      )}

      {borrando && (
        <ConfirmarBorrado
          titulo="Quitar del curso"
          palabra={f.persona.documento}
          etiquetaPalabra="Para confirmarlo, escriba el documento"
          descripcion={
            <>
              Se borra la participación de <strong>{nombre}</strong> en{" "}
              {f.accionFormacion?.codigo ?? "esta acción"}, con sus notas y su
              avance. <strong>La persona no se borra</strong>: si está inscrita en
              otro convenio, ahí sigue. Esto no se deshace.
            </>
          }
          alCerrar={() => setBorrando(false)}
          alConfirmar={async () => {
            await crmApi.borrarParticipacion(id);
            toast.exito(`${nombre} ya no está en este curso.`);
            router.replace("/admin/participantes");
          }}
        />
      )}
    </div>
  );
}

/**
 * Cambiar de etapa, en un desplegable.
 *
 * Eran once botones en fila. Se veían todos a la vez, que es
 * lo bueno de un botón, pero ocupaban el ancho entero de la
 * pantalla para una acción que se hace una vez cada varios
 * días — y por ese ancho «Acción de formación» tenía que irse
 * abajo, lejos de las otras dos decisiones.
 *
 * Lo que NO se pierde al cambiarlos por un desplegable: la
 * etapa actual sigue viéndose sin abrir nada (es el valor
 * seleccionado, y además está la píldora del encabezado), y
 * las etapas de salida siguen exigiendo motivo.
 *
 * Lo que se gana: las tres decisiones caben en una franja.
 */
function MoverDeEtapa({
  ficha,
  alGuardar,
}: {
  ficha: Ficha;
  alGuardar: (accion: () => Promise<void>, exito?: string) => Promise<void>;
}) {
  /// El desplegable NO se controla con estado propio.
  ///
  /// Su valor es siempre `ficha.etapa`. Así, si el cambio
  /// falla —o lo cancelan en el prompt del motivo— el
  /// desplegable vuelve solo a lo que de verdad hay guardado.
  /// Con estado propio se quedaría enseñando una etapa que no
  /// se llegó a grabar, que es la peor forma de mentir: la
  /// silenciosa.
  function mover(destino: Etapa) {
    if (destino === ficha.etapa) return;

    let motivo: string | undefined;
    if (ETAPAS_SALIDA.includes(destino)) {
      /// Las etapas de salida piden motivo SIEMPRE. Sacar a
      /// alguien de una convocatoria sin decir por qué deja
      /// una ficha que nadie sabe leer seis meses después.
      const escrito = window.prompt(
        `¿Por qué pasa a «${ETIQUETA_ETAPA[destino]}»? Es obligatorio.`,
      );
      if (!escrito?.trim()) return;
      motivo = escrito.trim();
    }

    void alGuardar(
      async () => {
        await crmApi.cambiarEtapa(ficha.id, destino, motivo);
      },
      `Ahora está en «${ETIQUETA_ETAPA[destino]}».`,
    );
  }

  /// La etapa de ahora puede NO ser de las que se mueven a
  /// mano: `ETAPAS_A_MANO` son cuatro, y una ficha puede estar
  /// en «En formación» o «Certificado», que las pone el
  /// sistema.
  ///
  /// Con los botones de antes eso no se notaba —ninguno salía
  /// marcado— pero un `select` con un `value` que no está
  /// entre sus opciones enseña la PRIMERA, y entonces la
  /// pantalla diría «Interesado» de alguien que está
  /// certificado. Por eso la etapa actual se añade como opción
  /// deshabilitada cuando no está en la lista: se ve la
  /// verdad, y no se puede volver a ella por error.
  const aMano = ETAPAS_A_MANO.includes(ficha.etapa)
    ? ETAPAS_A_MANO
    : [ficha.etapa, ...ETAPAS_A_MANO];

  return (
    /// Sin texto de ayuda debajo.
    ///
    /// Habia dos. Uno decia «las etapas de salida piden un
    /// motivo antes de guardar», que no significa nada para
    /// quien lo lee -- y ademas el sistema ya se lo pide en el
    /// momento, que es cuando sirve saberlo. El otro explicaba
    /// las etapas que pone el sistema, y eso se ve solo: salen
    /// deshabilitadas en la lista.
    ///
    /// Lo que quedaba era un parrafo debajo de un desplegable
    /// que descuadraba la barra. Va en `title`: quien lo
    /// necesite lo encuentra, y quien no, ve una barra limpia.
    <Control etiqueta="Mover de etapa" ancho="xl:col-span-2">
        <select
          className={CLASE_CONTROL}
          title={
            !ETAPAS_A_MANO.includes(ficha.etapa)
              ? `«${ETIQUETA_ETAPA[ficha.etapa]}» la pone el sistema: se puede salir de ella, pero no volver.`
              : undefined
          }
          value={ficha.etapa}
          onChange={(e) => mover(e.target.value as Etapa)}
        >
          {aMano.map((e) => (
            <option
              key={e}
              value={e}
              disabled={!ETAPAS_A_MANO.includes(e)}
            >
              {ETIQUETA_ETAPA[e]}
              {ETAPAS_SALIDA.includes(e) ? " · salida" : ""}
            </option>
          ))}
        </select>
    </Control>
  );
}

function Asignacion({
  ficha,
  opciones,
  alGuardar,
}: {
  ficha: Ficha;
  opciones: Opciones | null;
  alGuardar: (a: () => Promise<void>, exito?: string) => Promise<void>;
}) {
  /// Se guarda la ACCION elegida, no la oferta.
  ///
  /// La oferta —accion x sede— la deduce el servidor de donde
  /// vive la persona. El asesor elige un curso; que ese curso
  /// se dicte en Antioquia o en Santander no es una decision
  /// suya, y pedirsela era lo que hacia que AF1 saliera seis
  /// veces en la lista.
  /// `null` mientras nadie ha tocado nada, y entonces manda lo
  /// que ya tiene la ficha. Se deriva en vez de copiarse en un
  /// efecto: asi, cuando llegan las opciones tarde, la lista
  /// aparece con su valor ya puesto y no en blanco.
  const [elegida, setElegida] = useState<string | null>(null);
  const [coberturaId, setCoberturaId] = useState(ficha.cobertura?.id ?? "");

  if (!opciones) return null;

  const guardada = ficha.oferta
    ? (opciones.acciones.find((a) => a.ofertaId === ficha.oferta!.id)
        ?.accionFormacionId ?? "")
    : "";
  const accionId = elegida ?? guardada;
  const setAccionId = setElegida;

  const accion = opciones.acciones.find(
    (a) => a.accionFormacionId === accionId,
  );
  /// La oferta que le toca, ya resuelta por el servidor.
  const ofertaId = accion?.ofertaId ?? "";
  const oferta = accion?.cubre
    ? {
        accionFormacionId: accion.accionFormacionId,
        ubicacion: accion.ubicacion ?? "",
        disponibles: accion.disponibles,
        etiqueta: accion.etiqueta,
      }
    : undefined;
  /// Cuantos grupos se dejaron fuera por estar en otra parte,
  /// y donde vive la persona. Sin decirlo, una lista que se
  /// acorta sola parece un sistema roto.
  const fuera = opciones?.gruposFueraDeCobertura ?? 0;
  const donde =
    [opciones?.domicilio?.ciudad, opciones?.domicilio?.departamento]
      .filter(Boolean)
      .join(", ") || "su domicilio";

  /// Los grupos de LA OFERTA elegida: su acción Y su sede.
  ///
  /// Filtraba solo por `accionFormacionId`, y ese era el
  /// fallo: la misma acción se oferta en seis departamentos y
  /// todas esas ofertas comparten el mismo id de acción. Así
  /// que elegir «AF1 · BOGOTÁ D.C» sacaba también los grupos
  /// de Antioquia, Cauca, Córdoba, Huila y Santander — y se
  /// podía guardar una ficha con la oferta de Bogotá y un
  /// grupo de Santander, que no significa nada.
  ///
  /// Los VIRTUALES se quedan siempre: no se dictan en ningún
  /// sitio, así que la sede de la oferta no los descarta.
  const grupos = oferta
    ? opciones.grupos.filter(
        (g) =>
          g.accionFormacionId === oferta.accionFormacionId &&
          (g.modalidad === "VIRTUAL" || g.ubicacion === oferta.ubicacion),
      )
    : [];

  const gruposVisibles = grupos;

  return (
    /// DOS celdas de la rejilla, no una.
    ///
    /// Era una sola con los dos desplegables apilados, y por
    /// eso medía el doble que las otras: la fila entera se
    /// estiraba a su alto y dejaba un palmo de vacío debajo de
    /// «Mover de etapa» y de «Asesor». Un fragmento devuelve
    /// dos hijos y la rejilla los coloca uno al lado del otro.
    ///
    /// Y de paso se arregla el rótulo: decía «Acción de
    /// formación y grupo» encima de un desplegable que solo
    /// tiene la acción, con el grupo en otro campo debajo.
    <>
      <Control etiqueta="Acción de formación" ancho="xl:col-span-4">
        {/* UNA fila por acción, no una por acción×sede.

            Antes esta lista salía de `opciones.ofertas`, que es
            la tabla cruda: como AF1 se oferta en seis
            departamentos, AF1 aparecía seis veces y el asesor
            tenía que saber cuál le tocaba a esta persona. No es
            una decisión suya: la sede se deduce de dónde vive,
            y ahora la deduce el servidor.

            Las que NO llegan a su departamento salen igual, con
            su aviso. Esconderlas dejaría al asesor sin saber
            por qué falta un curso que sabe que existe. */}
        <SelectorBuscable
          valor={accionId}
          alElegir={(id) => {
            setAccionId(id);
            setCoberturaId("");
          }}
          marcador="AF8, inteligencia artificial…"
          opciones={opciones.acciones.map((a) => ({
            id: a.accionFormacionId,
            etiqueta: a.etiqueta,
            detalle: a.cubre
              ? `${a.ubicacion} · ${a.disponibles} de ${a.cupos} libres${
                  a.abierta ? "" : " · cerrada"
                }`
              : `Sin cobertura en ${donde} · se dicta en ${a.sedes} ${
                  a.sedes === 1 ? "sede" : "sedes"
                }`,
            busca: a.codigo,
          }))}
        />
      </Control>

      <Control etiqueta="Grupo" ancho="xl:col-span-3">
        {/* El grupo y su boton EN LINEA, igual que el asesor y
            el suyo. Es lo que hace que las cuatro columnas
            midan lo mismo: con el boton debajo, esta columna
            era mas alta que las otras tres y volvia el
            «espaciote».

            La lista ya viene recortada a los grupos que le
            sirven por donde vive. Eso se explicaba en un
            parrafo de dos renglones —«Solo los que le sirven
            por vivir en GALAN, SANTANDER. Se dejaron fuera
            39...»—, el texto mas largo de toda la barra. Va en
            `title`. */}
        <div
          className="flex items-center gap-2"
          title={
            oferta && fuera > 0
              ? `Solo los grupos que le sirven por vivir en ${donde}. Se dejaron fuera ${fuera} de otras ubicaciones.`
              : undefined
          }
        >
        {accion && !accion.cubre ? (
          /// SIN COBERTURA. Ni grupo ni guardar.
          ///
          /// Esta acción no llega a su departamento, así que no
          /// hay grupo que ofrecerle y no se le puede
          /// inscribir. Lo que sí hay es algo que hacer: darle
          /// las gracias. Decirlo aquí es lo que evita que la
          /// ficha se quede colgada esperando un cupo que no va
          /// a existir.
          <p className="grow text-sm text-aviso">
            No hay cobertura en {donde}. No se puede inscribir:
            corresponde escribirle un correo de agradecimiento.
          </p>
        ) : oferta ? (
          <div className="min-w-0 grow">
            <SelectorBuscable
              valor={coberturaId}
              alElegir={setCoberturaId}
              marcador="Número de grupo o ciudad…"
              opciones={gruposVisibles.map((g) => ({
                id: g.id,
                etiqueta: g.etiqueta,
                detalle: `${g.ocupados} de ${g.cupos}${
                  g.fechaInicio
                    ? ` · desde ${new Date(g.fechaInicio).toLocaleDateString("es-CO")}`
                    : " · sin fechas"
                }`,
              }))}
            />
          </div>
        ) : (
          /// Sin acción elegida no hay grupos que ofrecer, pero
          /// la celda se queda: si desapareciera, las otras
          /// tres se recolocarían al elegir una acción y la
          /// barra daría un salto.
          <p className="grow text-sm text-texto-suave">
            Elija primero una acción.
          </p>
        )}

        <Boton
          /// Sin cobertura NO se guarda. La regla vive también
          /// en el servidor —`asignar` la comprueba—, y esto es
          /// solo para no ofrecer un botón que va a fallar.
          title={
            ficha.sobrecupoMotivo
              ? `Sobrecupo autorizado${ficha.sobrecupoPor ? ` por ${ficha.sobrecupoPor.nombre}` : ""}: ${ficha.sobrecupoMotivo}`
              : undefined
          }
          disabled={
            !ofertaId ||
            accion?.cubre === false ||
            (ofertaId === ficha.oferta?.id &&
              coberturaId === (ficha.cobertura?.id ?? ""))
          }
          onClick={() => {
            let motivo: string | undefined;
            if (oferta && oferta.disponibles === 0 && ofertaId !== ficha.oferta?.id) {
              const escrito = window.prompt(
                `«${oferta.etiqueta}» no tiene cupos libres. ` +
                  "¿Por qué se coloca por encima del cupo? Queda registrado a su nombre.",
              );
              if (!escrito?.trim()) return;
              motivo = escrito.trim();
            }
            void alGuardar(
              async () => {
                await crmApi.asignar(ficha.id, ofertaId, coberturaId || undefined, motivo);
              },
              "Asignación guardada.",
            );
          }}
        >
          Guardar
        </Boton>
        </div>
      </Control>
    </>
  );
}

/**
 * Revocar la autorización, cuando la persona lo pide.
 *
 * Va plegado detrás de un enlace y no como un botón a la vista:
 * es lo contrario de lo que se hace todo el día y no debe estar
 * a un clic de distancia. Y cuando se abre, el aviso dice qué
 * pasa después, porque el asesor va a tener que explicárselo a
 * quien está al teléfono.
 */
function Revocar({
  id,
  alGuardar,
}: {
  id: string;
  alGuardar: (a: () => Promise<void>, exito?: string) => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [canal, setCanal] = useState<Canal>("VERBAL_ASESOR");
  const [motivo, setMotivo] = useState("");

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-sm text-texto-suave underline hover:text-error"
      >
        La persona pidió revocar su autorización
      </button>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-error/30 bg-error-suave p-4">
      <Aviso tipo="error">
        Al revocar, esta persona <strong>sale del reporte al SENA</strong> y no se podrá
        matricular. La autorización no se borra: queda con su fecha de inicio y su fecha
        de revocación, que es lo que hay que poder demostrar.
      </Aviso>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Por dónde lo pidió">
          <select
            className={CLASE_CONTROL}
            value={canal}
            onChange={(e) => setCanal(e.target.value as Canal)}
          >
            {Object.entries(ETIQUETA_CANAL).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Qué dijo" ayuda="Queda en el historial de la ficha.">
          <input
            className={CLASE_CONTROL}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ya no quiere recibir información"
          />
        </Campo>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Boton
          disabled={motivo.trim().length === 0}
          onClick={() =>
            alGuardar(async () => {
              await crmApi.revocarAutorizacion(id, canal, motivo.trim());
            }, "Autorización revocada.")
          }
        >
          Revocar la autorización
        </Boton>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-sm text-texto-suave underline"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function RegistrarAutorizacion({
  id,
  alGuardar,
}: {
  id: string;
  alGuardar: (a: () => Promise<void>, exito?: string) => Promise<void>;
}) {
  const [canal, setCanal] = useState<Canal>("VERBAL_ASESOR");
  const [evidencia, setEvidencia] = useState("");

  return (
    <div className="space-y-4">
      <Aviso tipo="error">
        Esta persona todavía no ha autorizado el tratamiento de sus datos. Sin eso no se
        puede matricular ni incluir en el reporte al SENA.
      </Aviso>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Cómo lo autorizó">
          <select
            className={CLASE_CONTROL}
            value={canal}
            onChange={(e) => setCanal(e.target.value as Canal)}
          >
            {Object.entries(ETIQUETA_CANAL).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Dónde quedó la prueba" ayuda="Acta, correo, archivo, grabación…">
          <input
            className={CLASE_CONTROL}
            value={evidencia}
            onChange={(e) => setEvidencia(e.target.value)}
            placeholder="Correo del 14 de agosto"
          />
        </Campo>
      </div>

      <Boton
        onClick={() =>
          alGuardar(async () => {
            await crmApi.autorizar(id, canal, evidencia.trim() || undefined);
          }, "Autorización registrada.")
        }
      >
        Registrar la autorización
      </Boton>
    </div>
  );
}

/** Quién lleva este lead. Sin dueño, nadie llama. */
/// Lo que devolvio el RUI contra lo que tecleo la persona.
/// Se refresca solo mientras espera y para cuando resuelve:
/// el asesor no recarga ni cuenta segundos, y una ficha ya
/// resuelta no sigue preguntando cada tres segundos.
function ValidacionRui({
  ficha,
  alGuardar,
}: {
  ficha: Ficha;
  alGuardar: (accion: () => Promise<void>, exito?: string) => Promise<void>;
}) {
  const [pidiendo, setPidiendo] = useState(false);
  const [tomando, setTomando] = useState(false);
  /// Dijo «No»: se queda con el que digitó y la pregunta
  /// deja de estorbar. No se guarda nada -- no hay nada que
  /// cambiar -- pero tampoco se le vuelve a preguntar cada
  /// vez que abre la ficha.
  const [decidido, setDecidido] = useState(false);

  const traer = useCallback(() => crmApi.estadoRui(ficha.id), [ficha.id]);
  const { datos: rui, refrescar } = useDatosVivos<ConsultaRui>(traer, {
    intervaloMs: 3000,
    activo: true,
  });

  if (!rui) return null;

  const esperando = rui.estado === "PENDIENTE" || rui.estado === "EN_CURSO";
  const delRui = rui.nombreEncontrado;

  /// Una cédula inventada le pertenece a alguien de verdad.
  /// Consultarla le pide al Estado la identidad de una persona
  /// que no pidió nada. Aquí no se ofrece el botón siquiera:
  /// no se puede hacer clic en algo que no debería pasar.
  if (rui.esDePrueba) {
    return (
      <Tarjeta titulo="Validación del nombre">
        <div className="rounded-xl border border-borde bg-superficie-alterna p-4 text-sm">
          <p className="font-medium">No se consulta: es un dato de prueba</p>
          <p className="mt-1 text-texto-suave">
            Esta cédula la inventó la siembra de prueba, pero el número le
            pertenece a una persona real. Consultarla le pediría al Estado la
            identidad de alguien que no pidió nada.
          </p>
        </div>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo="Validación del nombre">
      <div className="space-y-3">
        {/* mientras el detector sea el de mentira hay que
            decirlo aqui: un nombre inventado al lado de una
            cedula real se lee como si fuera verdadero */}
        {rui.simulado && (
          <Aviso tipo="error">
            <p className="font-medium">Esta respuesta no vino del RUI</p>
            <p className="mt-1">
              Lo que aparece abajo lo generó un simulador, no la Ventanilla
              Social. No sirve para decidir nada, y por eso no se ofrece dejar
              este nombre en la ficha.
            </p>
            {/* El motivo lo manda el servidor. Aquí estaba escrito
                a mano —«se enciende con RUI_PROVEEDOR=VENTANILLA»—
                y desde que hay más de una razón para simular, ese
                texto mandaba a arreglar algo que ya estaba bien:
                uno leía que faltaba una variable que sí tenía
                puesta, y la pregunta de qué nombre dejar
                desaparecía sin explicación. */}
            {rui.motivoSimulado && (
              <p className="mt-2 text-sm">{rui.motivoSimulado}</p>
            )}
          </Aviso>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-lg px-2.5 py-1 text-sm font-medium ${
              rui.simulado
                ? "bg-superficie-alterna text-texto-suave"
                : rui.estado === "LISTA" && rui.nombreCoincide
                  ? "bg-marca-suave text-marca"
                  : rui.estado === "LISTA"
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                    : "bg-superficie-alterna text-texto-suave"
            }`}
          >
            {rui.simulado ? "Simulación" : ETIQUETA_RUI[rui.estado]}
          </span>

          {esperando && rui.porDelante !== null && rui.porDelante > 0 && (
            <span className="text-sm text-texto-suave">
              {rui.porDelante} por delante en la cola
            </span>
          )}

          <button
            type="button"
            disabled={pidiendo || esperando}
            onClick={() => {
              setPidiendo(true);
              void crmApi
                .reconsultarRui(ficha.id)
                .catch(() => undefined)
                .finally(() => {
                  setPidiendo(false);
                  refrescar();
                });
            }}
            className="rounded-lg border border-borde px-3 py-1 text-sm hover:bg-superficie-alterna disabled:opacity-50"
          >
            Volver a consultar
          </button>
        </div>

        {delRui && (
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-texto-suave">
                Como lo digito
              </dt>
              <dd className="text-sm">{rui.nombreTecleado ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-texto-suave">
                Como lo encontro el RUI
              </dt>
              <dd className="text-sm font-medium">{delRui}</dd>
            </div>
          </dl>
        )}

        {!rui.simulado &&
          !decidido &&
          rui.estado === "LISTA" &&
          rui.nombreCoincide === false && (
          <div className="rounded-xl border border-error/30 bg-error-suave p-4 text-sm">
            <p className="text-error">
              Los dos nombres no coinciden. Hay que decidir cuál se deja antes de
              inscribir.
            </p>

            {/* La decisión, con un botón. Antes la ficha
                enseñaba la diferencia y ahí lo dejaba: el
                asesor tenía que ir a teclear el nombre bueno
                a mano, campo por campo, mirándolo aquí.

                Solo se ofrece en una dirección. Del RUI viene
                el nombre legal, que es el que el SENA espera
                en el F7; pisar el RUI con lo que tecleó una
                persona no tendría sentido, porque el RUI no es
                nuestro para corregirlo. */}
            {/* Pregunta y dos respuestas, en vez de un botón
                suelto: «Dejar el del RUI» no decía qué pasaba
                si uno no lo pulsaba. Así las dos salidas están
                a la vista y ninguna es la de no hacer nada. */}
            <p className="mt-3 text-sm text-texto">¿Deja el nombre del RUI?</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={tomando}
                onClick={() => {
                  setTomando(true);
                  void crmApi
                    .tomarNombreDelRui(ficha.id)
                    .then(() =>
                      alGuardar(async () => undefined, "Se dejó el nombre del RUI."),
                    )
                    .catch(() => undefined)
                    .finally(() => setTomando(false));
                }}
                className="rounded-lg border border-marca bg-marca px-4 py-1.5 text-sm font-medium text-marca-texto transition hover:bg-marca-fuerte disabled:opacity-50"
              >
                {tomando ? "Guardando…" : "Sí"}
              </button>
              <button
                type="button"
                disabled={tomando}
                onClick={() => setDecidido(true)}
                className="rounded-lg border border-borde px-4 py-1.5 text-sm transition hover:bg-superficie-alterna disabled:opacity-50"
              >
                No
              </button>
            </div>
          </div>
        )}

        {rui.estado === "SIN_RESULTADO" && (
          <p className="text-sm text-texto-suave">
            El documento no aparece en el RUI. Verifiquelo con la persona.
          </p>
        )}
      </div>
    </Tarjeta>
  );
}


/// Lo que mando el interesado por su enlace cuando el asesor
/// ya habia tocado la ficha. No se pisa nada solo: el asesor
/// ve las dos versiones y elige cuales entran.
function PropuestaDelInteresadoCard({
  ficha,
  alGuardar,
}: {
  ficha: Ficha;
  alGuardar: (accion: () => Promise<void>, exito?: string) => Promise<void>;
}) {
  const traer = useCallback(() => crmApi.propuesta(ficha.id), [ficha.id]);
  const { datos, refrescar } = useDatosVivos<PropuestaDelInteresado | null>(traer, {
    intervaloMs: 60_000,
  });

  /// La seleccion se guarda junto al id de la propuesta a
  /// la que pertenece. Asi se deriva en el render en vez de
  /// copiarla con un efecto, y si llega una propuesta nueva
  /// la seleccion vieja no se le queda pegada.
  const [abierto, setAbierto] = useState(false);

  const propuesta = datos ?? null;
  if (!propuesta || propuesta.campos.length === 0) return null;

  return (
    <>
      {/* Un aviso corto que ABRE la decision, no la decision
          entera metida entre otras diez tarjetas.

          Antes esto era una tabla mas de la ficha, con scroll,
          y se resolvia sin mirar. Es una decision sobre los
          datos de una persona: merece que uno se detenga. */}
      <div className="rounded-2xl border border-aviso/40 bg-aviso-suave p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-medium text-aviso">
              El interesado completó sus datos
            </p>
            <p className="mt-1 text-sm text-aviso">
              Usted ya había tocado esta ficha, así que nada se sobrescribió.{" "}
              {propuesta.campos.length}{" "}
              {propuesta.campos.length === 1 ? "dato espera" : "datos esperan"} su
              decisión.
            </p>
          </div>
          <Boton onClick={() => setAbierto(true)}>
            Revisar {propuesta.campos.length}{" "}
            {propuesta.campos.length === 1 ? "dato" : "datos"}
          </Boton>
        </div>
      </div>

      {abierto && (
        <RevisarPropuesta
          propuesta={propuesta}
          alCerrar={() => setAbierto(false)}
          alResolver={async (campos) => {
            await alGuardar(async () => {
              await crmApi.resolverPropuesta(ficha.id, campos);
              refrescar();
            }, campos.length === 0
              ? "No se cambió ningún dato."
              : `Se cambiaron ${campos.length} ${campos.length === 1 ? "dato" : "datos"}.`);
          }}
        />
      )}
    </>
  );
}

function Asesor({
  ficha,
  opciones,
  alGuardar,
}: {
  ficha: Ficha;
  opciones: Opciones | null;
  alGuardar: (a: () => Promise<void>, exito?: string) => Promise<void>;
}) {
  const { admin } = useAdmin();
  const [asesorId, setAsesorId] = useState(ficha.asesor?.id ?? "");
  const [guardando, setGuardando] = useState(false);
  if (!opciones) return null;

  /// A quien NO reparte fichas no se le enseña esta tarjeta.
  ///
  /// Un gestor de inscripciones ES un asesor: las suyas las
  /// trabaja, no las reparte. Enseñarle un desplegable que el
  /// servidor va a rechazar es ofrecerle un error.
  ///
  /// Pero se le dice de quién es la ficha, porque eso sí le
  /// sirve: es la diferencia entre esconder y ocultar.
  if (!admin.puede?.repartirFichas) {
    return ficha.asesor ? (
      <Control etiqueta="Asesor" ancho="xl:col-span-3">
        <p className="text-sm" title="Repartir fichas lo hace un líder.">
          {ficha.asesor.nombre}
        </p>
      </Control>
    ) : null;
  }

  const cambiado = asesorId !== (ficha.asesor?.id ?? "");

  return (
    <Control etiqueta="Asesor" ancho="xl:col-span-3">
      {/* `min-w-0` en el desplegable: sin el, un nombre largo
          empuja al boton fuera de la columna. */}
      <div className="flex items-center gap-2">
        <select
          className={`${CLASE_CONTROL} min-w-0 grow`}
          value={asesorId}
          onChange={(e) => setAsesorId(e.target.value)}
        >
          <option value="">Sin asignar</option>
          {opciones.asesores.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>

        <Boton
          type="button"
          disabled={!cambiado || guardando}
          onClick={async () => {
            setGuardando(true);
            await alGuardar(
              async () => {
                await crmApi.actualizar(ficha.id, { asesorId: asesorId || null });
              },
              asesorId ? "Asesor asignado." : "Se quitó el asesor.",
            );
            setGuardando(false);
          }}
        >
          {guardando ? "Guardando…" : "Asignar"}
        </Boton>
      </div>
    </Control>
  );
}

/**
 * Los datos de su organización, los trece.
 *
 * El formulario largo se los pregunta a la persona y la ficha
 * no enseñaba ninguno: el asesor veía «le falta la empresa»
 * sin poder mirar qué había contestado ya. Aquí están todos,
 * incluidos los que llegan vacíos -- ver el hueco es la mitad
 * del trabajo.
 *
 * Solo de lectura. Se corrigen desde Empresas registradas,
 * que es donde vive el dato: editarlos en dos sitios es
 * garantizar que un día no coincidan.
 */
function DatosDeLaEmpresa({
  ficha,
  puedeEscribir,
}: {
  ficha: Ficha;
  puedeEscribir: boolean;
}) {
  const e = ficha.empresa;
  const fichaId = ficha.id;

  if (!e) {
    return (
      <Tarjeta titulo="Su organización">
        <p className="text-sm text-texto-suave">Todavía no tiene organización.</p>
      </Tarjeta>
    );
  }

  /// Trabaja por su cuenta: su cédula es su RUT.
  ///
  /// No tiene jefe directo ni número de trabajadores, y
  /// pedírselos es pedirle que se invente a alguien. Tampoco
  /// se crea en Empresas registradas: ahí van organizaciones,
  /// y esto es una persona.
  const porSuCuenta = ficha.trabajaPorSuCuenta;

  /// Del independiente, su casa y su celular.
  ///
  /// No tiene sede ni conmutador: su domicilio es el de su
  /// unidad económica. Si la empresa ya los trae escritos
  /// mandan esos; si no, se leen los de la persona en vez de
  /// pintar «Falta» sobre un dato que sí existe dos tarjetas
  /// más arriba.
  const CAMPOS: Array<[string, string | number | null]> = porSuCuenta
    ? [
        ["RUT (su cédula)", e.nit],
        ["A nombre de", e.razonSocial],
        ["Dirección", e.direccion ?? ficha.persona.direccion],
        ["Teléfono", e.telefono ?? ficha.persona.celular],
        ["Sector económico", e.sectorEconomico],
      ]
    : [
        ["NIT", e.digitoVerificacion ? `${e.nit}-${e.digitoVerificacion}` : e.nit],
        ["Razón social", e.razonSocial],
      ];

  /// Los tres que el ASESOR puede conseguir llamando.
  ///
  /// Son los mismos que pide el enlace de completar datos: se
  /// los sabe el empleado. Van aparte porque antes esta
  /// tarjeta los mezclaba con los del maestro de empresas y
  /// salían once «Falta» seguidos, sin decir cuáles eran suyos
  /// ni qué pasaba si no los conseguía.
  const DEL_ASESOR: Array<[string, unknown]> = porSuCuenta
    ? []
    : [
        ["Persona de contacto", e.contactoNombre],
        ["Su cargo", e.contactoCargo],
        ["Su correo", e.contactoCorreo],
      ];

  /// Los seis del analista —dirección, teléfono,
  /// departamento, municipio, sector, número de trabajadores—
  /// ya no se listan aquí. Se ven y se corrigen en Empresas
  /// registradas, que es de quien son.

  const faltanDelAsesor = DEL_ASESOR.filter(
    ([, v]) => v === null || v === "",
  ).length;

  return (
    /// El título dice QUÉ ES la tarjeta, no cómo se llama la
    /// empresa.
    ///
    /// Estuvo un tiempo titulada con la razón social, y era un
    /// error de orientación: en una columna de tres tarjetas,
    /// «SOLUCIONES INTEGRALES DEL CARIBE S.A.S.» no le dice a
    /// nadie que ahí dentro está el NIT. La razón social sigue
    /// estando, dos renglones más abajo, que es donde se lee
    /// como dato y no como rótulo.
    <Tarjeta
      titulo={porSuCuenta ? "Independiente con RUT" : "Datos de empresa"}
      insignia={
        faltanDelAsesor > 0 ? `Faltan ${faltanDelAsesor} suyos` : "Completa"
      }
    >
      <Campos campos={CAMPOS} />

      {DEL_ASESOR.length > 0 && (
        /// Sin encabezado y sin explicación.
        ///
        /// Aquí decía «Lo que usted puede preguntarle — se los
        /// sabe el empleado». Sobra: quien abre esta ficha ya
        /// sabe qué le toca a él y qué al analista, y un
        /// párrafo que se lo recuerda cada vez es ruido que
        /// tapa los datos. Una línea separa y basta.
        <div className="mt-5 border-t border-borde pt-4">
          {/* EDITABLES desde aquí.

              Antes había que ir a «Empresas registradas» —que
              un gestor de inscripciones no tiene—, así que el
              asesor llamaba, conseguía el dato, y no tenía
              dónde ponerlo. Se quedaba en un papel. */}
          <ContactoDeLaEmpresa
            participanteId={fichaId}
            valores={{
              contactoNombre: (e.contactoNombre ?? "") as string,
              contactoCargo: (e.contactoCargo ?? "") as string,
              contactoCorreo: (e.contactoCorreo ?? "") as string,
            }}
            puedeEscribir={puedeEscribir}
          />
        </div>
      )}

      {/* Aquí iban los seis campos del analista, plegados, y
          debajo una nota de cuatro renglones sobre el F7.

          Los dos fuera. Quien inscribe se encarga de tres
          datos —contacto, cargo, correo— y ya lo sabe; el
          resto le llenaba la tarjeta de cosas que no persigue
          y la dejaba mucho más alta que «Datos del
          interesado», que es con la que tiene que emparejar.

          No se pierde nada: esos campos se ven y se corrigen
          en Empresas registradas, que es de quien son. */}
    </Tarjeta>
  );
}

/** Copia al portapapeles, con respaldo donde no exista. */
async function copiarTexto(texto: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(texto);
    return;
  }

  // sin https no hay portapapeles
  const caja = document.createElement("textarea");
  caja.value = texto;
  caja.setAttribute("readonly", "");
  caja.style.position = "fixed";
  caja.style.opacity = "0";
  document.body.appendChild(caja);
  caja.select();
  const listo = document.execCommand("copy");
  document.body.removeChild(caja);
  if (!listo) throw new Error("El navegador no dejó copiar.");
}

/**
 * El enlace de un solo uso para que la persona llene su propia
 * ficha. Sin esto solo lo tiene quien se autoinscribió: a los
 * leads creados a mano o venidos de una reserva no había forma
 * de mandárselo.
 */
/**
 * Que le va a pedir el enlace, hoy.
 *
 * La empresa va primero porque el formulario largo la pide
 * primero, y porque sin ella su ficha no entra en el F7 por
 * mas completo que este lo suyo. Si no falta nada, se dice:
 * mandar un enlace que no pide nada solo confunde.
 */
function LoQuePedira({ ficha }: { ficha: Ficha }) {
  const empresa = ficha.faltaDeLaEmpresa;
  const persona = ficha.faltaDeLaPersona;

  if (empresa.length === 0 && persona.length === 0) {
    return (
      <div className="rounded-xl border border-exito/30 bg-exito-suave p-4 text-sm text-exito">
        <p className="font-medium">No le falta nada</p>
        <p className="mt-1">
          Su ficha y la de su organización están completas. El enlace no le va a
          preguntar nada.
        </p>
      </div>
    );
  }

  /// Aquí se decía solo CUÁNTOS, a propósito: «el asesor no va
  /// a preguntarlos él, los pregunta el formulario».
  ///
  /// Esa razón resultó falsa dos veces el mismo día. El
  /// municipio faltaba y el enlace NO lo preguntaba, así que
  /// mandar otro no cambiaba nada; y el sector económico lo
  /// trae la consulta al RUES, que si está apagada no lo trae
  /// nunca. En los dos casos el contador se quedaba clavado y
  /// no había forma de saber por qué.
  ///
  /// Decir cuáles es lo que separa «hay que reenviar el
  /// enlace» de «esto no se arregla reenviando nada».
  const cuantos = empresa.length + persona.length;

  return (
    <div className="rounded-xl border border-borde bg-superficie-alterna p-4 text-sm">
      <p className="font-medium">
        {cuantos === 1 ? "Le falta un dato" : `Le faltan ${cuantos} datos`}
      </p>

      {persona.length > 0 && (
        <p className="mt-2">
          <span className="text-texto-suave">De ella: </span>
          {persona.join(", ")}.
        </p>
      )}

      {empresa.length > 0 && (
        <p className="mt-1">
          <span className="text-texto-suave">De su organización: </span>
          {empresa.join(", ")}.
        </p>
      )}

      {empresa.includes("sector económico") && (
        <p className="mt-2 text-aviso">
          El <strong>sector económico</strong> no se lo pregunta el enlace a
          quien tiene vínculo laboral: lo trae la consulta al RUES por el NIT.
          Si no llega, se pone a mano desde la organización.
        </p>
      )}

      <p className="mt-2 text-texto-suave">
        Solo se pregunta los datos pendientes. Lo que ya dio no se le vuelve a
        pedir.
      </p>
    </div>
  );
}

/**
 * En qué anda el último enlace que se mandó.
 *
 * Es lo que hace verdad la frase «antes de generar otro,
 * revise su estado». Antes esa instrucción le pedía al asesor
 * una respuesta que el sistema no guardaba en ninguna parte:
 * no había forma de saber si lo habían abierto.
 */
function EstadoDelEnlace({ estado }: { estado: Ficha["enlace"] }) {
  if (!estado) return null;

  const CUENTO = {
    SIN_ABRIR: {
      texto: "El enlace que se mandó todavía no lo han abierto. No genere otro.",
      clase: "border-aviso/30 bg-aviso-suave text-aviso",
    },
    ABIERTO: {
      texto: "Ya lo abrieron, pero no lo terminaron.",
      clase: "border-borde bg-superficie-alterna text-texto",
    },
    COMPLETADO: {
      texto: "Lo completaron.",
      clase: "border-exito/30 bg-exito-suave text-exito",
    },
    ANULADO: {
      texto: "Se anuló al generar uno nuevo.",
      clase: "border-borde bg-superficie-alterna text-texto-suave",
    },
    CADUCADO: {
      texto: "Caducó sin que lo usaran.",
      clase: "border-borde bg-superficie-alterna text-texto-suave",
    },
  }[estado.estado];

  return (
    <div className={`rounded-xl border p-3 text-sm ${CUENTO.clase}`}>
      <p>{CUENTO.texto}</p>
      <p className="mt-1 text-xs opacity-75">
        Se generó el {fecha(estado.creadoEn)}
        {estado.emitidoPor ? `, por ${estado.emitidoPor}` : ""}
        {estado.abiertoEn ? ` · abierto el ${fecha(estado.abiertoEn)}` : ""}
        {estado.usadoEn ? ` · completado el ${fecha(estado.usadoEn)}` : ""}.
      </p>
    </div>
  );
}

function EnlaceCompletar({ ficha }: { ficha: Ficha }) {
  const toast = useToast();
  const [enlace, setEnlace] = useState<
    { url: string; expiraEn: string; dias: number } | null
  >(null);
  const [emitiendo, setEmitiendo] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // autoinscrito: ya tuvo uno
  const yaHubo = enlace !== null || ficha.origen === "AUTOGESTION";

  async function generar() {
    setEmitiendo(true);
    try {
      const { token, expiraEn } = await crmApi.emitirEnlace(ficha.id);
      // los dias se cuentan al emitirlo
      const dias = Math.max(
        0,
        Math.ceil((new Date(expiraEn).getTime() - Date.now()) / 86_400_000),
      );
      setEnlace({ url: `${window.location.origin}/completar/${token}`, expiraEn, dias });
      setCopiado(false);
      toast.exito(
        yaHubo ? "Enlace nuevo listo. El anterior ya no sirve." : "Enlace generado.",
      );
    } catch (e) {
      toast.error((e as ErrorApi).message);
    } finally {
      setEmitiendo(false);
    }
  }

  async function copiar() {
    if (!enlace) return;
    try {
      await copiarTexto(enlace.url);
      setCopiado(true);
      toast.exito("Enlace copiado.");
    } catch {
      setCopiado(false);
      toast.error("No se pudo copiar. Selecciónelo y cópielo a mano.");
    }
  }

  /// Si no le falta nada, no hay enlace que mandar.
  ///
  /// Generarlo igual manda a la persona a un formulario que
  /// no le va a preguntar nada, y de paso anula el que tuviera
  /// abierto. Aqui se corta antes.
  const noLeFalta =
    ficha.faltaDeLaEmpresa.length === 0 && ficha.faltaDeLaPersona.length === 0;

  if (noLeFalta) {
    return (
      <Tarjeta titulo="Enlace para que complete sus datos">
        {/* Sin botón, y dicho con todas las letras.

            Ya no se ofrecía generar —eso estaba bien—, pero la
            tarjeta no explicaba POR QUÉ, y quedaba la duda de
            si faltaba pulsar algo. Generar uno aquí sería
            mandar a la persona a un formulario que no le va a
            preguntar nada, y de paso anular el que tuviera
            abierto. */}
        <div className="rounded-xl border border-exito/30 bg-exito-suave p-4 text-sm text-exito">
          <p className="font-medium">No le falta ningún dato</p>
          <p className="mt-1">
            Ya no se genera ningún enlace: no habría nada que preguntarle. Si
            necesita corregir algo de lo que ya dio, llámela y cámbielo aquí
            mismo.
          </p>
        </div>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo="Enlace para que complete sus datos">
      <div className="space-y-4">
        <LoQuePedira ficha={ficha} />

        <EstadoDelEnlace estado={ficha.enlace} />

        {/* UNA sola caja, no dos.

            Eran un párrafo suelto de «Recomendación» y debajo
            un aviso de cuatro renglones que repetía la mitad.
            Las dos dicen lo mismo —cómo mandarlo y qué pasa si
            se genera otro—, así que van juntas y en corto: un
            aviso que hay que leer dos veces no se lee ninguna. */}
        <div className="rounded-xl border border-aviso/30 bg-aviso-suave p-4 text-sm text-aviso">
          <strong className="font-medium">Recomendaciones:</strong> envíe el
          formulario por WhatsApp o correo, nunca dicte la cédula por teléfono.
          Recuerde que cada enlace es de un solo uso y anula al anterior.
        </div>

        {enlace && (
          <div className="space-y-3">
            <Campo etiqueta="Enlace">
              <input
                readOnly
                value={enlace.url}
                onFocus={(e) => e.currentTarget.select()}
                className={`${CLASE_CONTROL} font-mono text-xs`}
              />
            </Campo>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={copiar}
                className="inline-flex items-center gap-2 rounded-lg border border-borde px-3 py-1.5 text-sm hover:bg-superficie-alterna"
              >
                {copiado && <IconoCheck tamano={15} />}
                {copiado ? "Copiado" : "Copiar enlace"}
              </button>

              <p className="text-sm text-texto-suave">
                Caduca en {enlace.dias} {enlace.dias === 1 ? "día" : "días"} — el{" "}
                {fecha(enlace.expiraEn)}.
              </p>
            </div>
          </div>
        )}

        <Boton type="button" onClick={generar} disabled={emitiendo}>
          {emitiendo ? "Generando…" : yaHubo ? "Generar uno nuevo" : "Generar enlace"}
        </Boton>
      </div>
    </Tarjeta>
  );
}

/// La rejilla de etiqueta y valor, con «Falta» donde no hay.
///
/// Sale tres veces en la tarjeta de la empresa —lo fijo, lo
/// del asesor y lo del analista— y antes era una sola lista
/// corrida de once. El «Falta» va en color de aviso y no de
/// error a propósito: que falte un dato de la empresa no
/// impide inscribir a nadie.
function Campos({ campos }: { campos: Array<[string, unknown]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
      {campos.map(([nombre, valor]) => (
        <div key={nombre}>
          <dt className="text-xs tracking-wide text-texto-suave uppercase">
            {nombre}
          </dt>
          <dd className="text-sm">
            {valor === null || valor === "" ? (
              <span className="text-aviso">Falta</span>
            ) : (
              String(valor)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Los tres del jefe directo, escribibles desde la ficha.
 *
 * Antes esta tarjeta era de solo lectura y decía «se corrigen
 * en Empresas registradas». Pero un gestor de inscripciones no
 * tiene esa pantalla: llamaba, conseguía el dato, y no tenía
 * dónde ponerlo.
 *
 * Solo estos tres. La razón social no está aquí a propósito:
 * la valida el código contra el registro, y escribirla a mano
 * es volver a abrir lo que se cerró en la ruta pública, donde
 * cualquiera con un NIT le cambiaba el nombre a una empresa.
 */
function ContactoDeLaEmpresa({
  participanteId,
  valores,
  puedeEscribir,
}: {
  participanteId: string;
  valores: {
    contactoNombre: string;
    contactoCargo: string;
    contactoCorreo: string;
  };
  puedeEscribir: boolean;
}) {
  const toast = useToast();
  const [v, setV] = useState(valores);
  const [guardando, setGuardando] = useState(false);

  const cambiado =
    v.contactoNombre !== valores.contactoNombre ||
    v.contactoCargo !== valores.contactoCargo ||
    v.contactoCorreo !== valores.contactoCorreo;

  if (!puedeEscribir) return <Campos campos={Object.entries(valores)} />;

  const CAMPOS: Array<[keyof typeof v, string]> = [
    ["contactoNombre", "Persona de contacto"],
    ["contactoCargo", "Su cargo"],
    ["contactoCorreo", "Su correo"],
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {CAMPOS.map(([clave, etiqueta]) => (
          <label key={clave} className="block">
            <span className="mb-1 block text-xs tracking-wide text-texto-suave uppercase">
              {etiqueta}
            </span>
            <input
              className={CLASE_CONTROL}
              value={v[clave]}
              onChange={(ev) => setV({ ...v, [clave]: ev.target.value })}
              type={clave === "contactoCorreo" ? "email" : "text"}
            />
          </label>
        ))}
      </div>

      {cambiado && (
        <Boton
          disabled={guardando}
          onClick={() => {
            setGuardando(true);
            void crmApi
              .guardarContactoEmpresa(participanteId, v)
              .then(() => {
                toast.exito("Guardado. Queda registrado quién lo puso.");
                window.location.reload();
              })
              .catch((e) => {
                toast.error((e as ErrorApi).message);
                setGuardando(false);
              });
          }}
        >
          {guardando ? "Guardando…" : "Guardar los tres"}
        </Boton>
      )}
    </div>
  );
}
