"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ConfirmarBorrado } from "@/components/admin/confirmar-borrado";
import {
  IconoBrecha,
  IconoCheck,
  IconoFormularios,
  IconoGuardar,
  IconoOrden,
  IconoOrganizaciones,
  IconoPerfil,
  IconoEnlace,
  IconoEscudo,
  IconoSobre,
} from "@/components/admin/iconos";
import { SelectorBuscable } from "@/components/admin/selector-buscable";
import { DatosSena } from "@/components/admin/datos-sena";
import { colorEtapa, PildoraEtapa } from "@/components/admin/etapa";
import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  EncabezadoSeccion,
  Tarjeta,
  useAdmin,
} from "@/components/admin/marco-admin";
import { HistoricoDeValores } from "@/components/admin/historico-valores";
import { BarraDeGestion } from "@/components/admin/barra-de-gestion";
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

/// Las cinco vistas de el lead, en el orden en que se usan:
/// primero lo que se corrige todos los dias, al final lo que se
/// consulta de tarde en tarde.
const PESTANAS = [
  { id: "datos", etiqueta: "Datos" },
  { id: "empresa", etiqueta: "Empresa" },
  { id: "notas", etiqueta: "Notas" },
  { id: "origen", etiqueta: "Origen" },
  { id: "historial", etiqueta: "Historial" },
] as const;

type Pestana = (typeof PESTANAS)[number]["id"];

const soloDia = (s: string) =>
  new Date(s).toLocaleDateString("es-CO", { dateStyle: "medium" });

/**
 * Un dato de identidad, con su etiqueta encima y pequeña.
 *
 * La cabecera anterior apilaba tres renglones de texto gris
 * sin decir qué era cada uno: había que deducir que
 * «1010316499» era el documento y que «ADECOPRIA» era el
 * gremio. En un lead que se abre cien veces al día, deducir
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
      <dt className="text-[0.625rem] font-semibold tracking-[0.1em] text-texto-suave uppercase">
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
      <p className="text-[0.625rem] font-semibold tracking-[0.1em] text-texto-suave uppercase">
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
  /// La pestaña abierta. Arranca en «Datos» porque es a lo que
  /// se entra nueve de cada diez veces.
  const [pestana, setPestana] = useState<Pestana>("datos");
  const { admin, gremio: gremioElegido } = useAdmin();
  const router = useRouter();
  const toast = useToast();
  const esSuperadmin = admin.rol === "SUPERADMIN";
  // sin permisos aun no se esconde nada
  const puedeEscribir =
    !admin.permisos || alcanza(admin.permisos.inscripciones, "ESCRIBIR");

  const cargar = useCallback(async () => {
    const lead = await crmApi.obtener(id);
    setF(lead);
    setOpciones(await crmApi.opciones(lead.convenio.id, lead.id));
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
  /// Dos letras: la del nombre y la del primer apellido. Tres
  /// en un circulo de 48px se leen como una palabra rara.
  const iniciales =
    `${f.persona.primerNombre?.[0] ?? ""}${f.persona.primerApellido?.[0] ?? ""}`
      .toLocaleUpperCase("es-CO") || "?";

  const suyas = f.persona.autorizaciones.filter(
    (a) =>
      a.politica.destinatario === "PARTICIPANTE" &&
      a.politica.convenioId === f.convenio.id,
  );
  const autorizacion = suyas.find((a) => !a.revocadaEn);
  const revocada = autorizacion ? null : suyas.find((a) => a.revocadaEn);

  /// Igual que el diseno en todo MENOS el ancho: el diseno lo
  /// fija en 1240px centrado y aqui ocupa lo que haya. Es la
  /// unica desviacion, y es la que se pidio.
  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-6">
      <div>
        <Link
          href="/admin/participantes"
          className="inline-flex items-center gap-1 text-[0.75rem] text-texto-suave transition hover:text-marca"
        >
          <span aria-hidden="true">&larr;</span> Gestión de leads
        </Link>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {f.faltantes.bloquean.length > 0 && (
        <div>
          <Aviso tipo="error">
            <p className="font-medium">Todavía no se puede matricular</p>
            <ul className="mt-2 list-inside list-disc">
              {f.faltantes.bloquean.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </Aviso>
        </div>
      )}

      {/* La propuesta va FUERA de la tarjeta y a lo ancho: es una
          interrupción —alguien completó sus datos y hay que
          decidir— y dentro de una pestaña no se vería hasta que
          alguien entrara en ella. */}
      <PropuestaDelInteresadoCard lead={f} alGuardar={conError} />

      {/* UNA SOLA TARJETA con todo dentro, en tres franjas: quién
          es, qué se le hace, y el expediente. Antes eran once
          tarjetas sueltas flotando en la página. */}
      {/* Bandas, no una tarjeta flotante.
          Era un bloque con radio 18 y una sombra larga, en medio
          de una pagina que ya no tiene tarjetas. */}
      <section className="overflow-hidden rounded-lg border border-borde bg-superficie">
        {/* ── 1. IDENTIDAD ────────────────────────────────── */}
        <div
          style={{
            background: "var(--superficie)",
            borderBottom: "1px solid var(--borde)",
            padding: "16px 28px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              flex: "0 0 44px",
              borderRadius: "50%",
              background: "var(--marca-suave)",
              color: "var(--marca)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "0.90625rem",
            }}
          >
            {iniciales}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontWeight: 700,
                fontSize: "1.4375rem",
                lineHeight: 1.15,
                letterSpacing: "-.022em",
                color: "var(--titulo)",
              }}
            >
              {nombre}
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
                fontSize: "0.75rem",
                color: "var(--texto-suave)",
                flexWrap: "wrap",
              }}
            >
              <span>{f.persona.documento}</span>
              <span aria-hidden style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--texto-suave)", opacity: 0.6 }} />
              <span>En sistema desde {soloDia(f.creadoEn)}</span>
              <span aria-hidden style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--texto-suave)", opacity: 0.6 }} />
              <span>{ETIQUETA_ORIGEN[f.origen]}</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span
              style={{
                fontWeight: 600,
                fontSize: "0.625rem",
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--texto-suave)",
              }}
            >
              Etapa actual
            </span>
            {/* El valor en el color de su etapa, sin pildora ni
                punto: el color va en la letra. */}
            <span
              style={{
                marginTop: 3,
                fontSize: "0.90625rem",
                fontWeight: 700,
                color: colorEtapa(f.etapa),
              }}
            >
              {ETIQUETA_ETAPA[f.etapa]}
            </span>
          </div>
        </div>

        {/* ── 2. BARRA DE GESTIÓN ─────────────────────────────
            Oscura y pegada a la identidad: es lo único de esta
            pantalla que CAMBIA el estado, y separarla del resto es
            lo que la hace encontrable sin buscarla.

            Los colores salen de tokens y no van fijos: en modo
            oscuro una barra casi negra se perdería contra el
            fondo. */}
        <BarraDeGestion
          lead={f}
          opciones={opciones}
          puedeRepartir={Boolean(admin.puede?.repartirFichas)}
          alGuardar={conError}
        />

        {/* ── 3. CUERPO: pestañas y acciones ──────────────── */}
        <div
          style={{
            display: "flex",
            gap: 22,
            padding: "24px 28px 30px",
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 520 }}>
            {/* Las pestañas cortan once tarjetas en cinco vistas.
                El asesor abre el lead para UNA cosa —corregir un
                dato, mirar el historial— y antes tenía que recorrer
                la página entera para dar con ella. */}
            {/* Texto subrayado, no un grupo de pildoras.
                Era una caja gris con cinco botones blancos
                dentro, y eso mete un tercer fondo justo encima
                del expediente. En el redisenio la pestania
                activa se marca con una raya de 2px debajo y el
                color de marca: pesa menos y se lee igual.

                La raya va como `box-shadow: inset` y no como
                `border-bottom` para que no mueva el texto un
                pixel al activarse. */}
            <div
              role="tablist"
              aria-label="Secciones de el lead"
              style={{
                display: "flex",
                gap: 24,
                flexWrap: "wrap",
                borderBottom: "1px solid var(--borde)",
                marginBottom: 20,
              }}
            >
              {PESTANAS.map((p) => {
                const activa = pestana === p.id;
                return (
                  <button
                    key={p.id}
                    role="tab"
                    aria-selected={activa}
                    onClick={() => setPestana(p.id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: "12px 0",
                      fontWeight: 600,
                      fontSize: "0.8125rem",
                      cursor: "pointer",
                      color: activa ? "var(--marca)" : "var(--texto-suave)",
                      boxShadow: activa ? "inset 0 -2px var(--marca)" : "none",
                    }}
                  >
                    {p.etiqueta}
                  </button>
                );
              })}
            </div>

            {pestana === "datos" && <DatosSena lead={f} alGuardar={conError} />}

            {pestana === "empresa" && (
              <DatosDeLaEmpresa lead={f} puedeEscribir={puedeEscribir} />
            )}

            {pestana === "notas" && (
              <>
                <Tarjeta
                  titulo=""
                  encabezado={
                    <EncabezadoSeccion
                      icono={<IconoFormularios tamano={18} />}
                      titulo="Notas"
                      descripcion="Las notas no se eliminan; cada corrección se registra como una nueva entrada."
                    />
                  }
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

              </>
            )}

            {pestana === "origen" && (
              <Tarjeta
                titulo=""
                encabezado={
                  <EncabezadoSeccion
                    icono={<IconoBrecha tamano={18} />}
                    titulo="Origen y verificación del lead"
                    descripcion="De dónde proviene el lead y verificaciones realizadas."
                  />
                }
              >
                <div className="space-y-5">
                  <dl className="grid sm:grid-cols-2">
                    <div className="rounded border border-borde bg-superficie-alterna p-3.5">
                      <dt className="text-[0.625rem] font-semibold tracking-[0.1em] text-texto-suave uppercase">
                        Origen del lead
                      </dt>
                      <dd className="mt-1 text-sm font-semibold">
                        {ETIQUETA_ORIGEN[f.origen]}
                      </dd>
                    </div>
                    <div className="rounded border border-borde bg-superficie-alterna p-3.5">
                      <dt className="text-[0.625rem] font-semibold tracking-[0.1em] text-texto-suave uppercase">
                        Fecha de registro
                      </dt>
                      <dd className="mt-1 text-sm font-semibold">
                        {soloDia(f.creadoEn)}
                      </dd>
                    </div>
                  </dl>

                </div>
              </Tarjeta>
            )}

            {pestana === "historial" && (
              <>
                <div className="grid gap-4">
                <Tarjeta
                  titulo=""
                  encabezado={
                    <EncabezadoSeccion
                      icono={<IconoOrden tamano={18} />}
                      titulo="Control de cambios"
                      descripcion="Origen del registro y trazabilidad de los cambios de etapa."
                    />
                  }
                >
                  {/* De dónde viene y desde cuándo, encima de la lista.
                      Es el encabezado de la historia: lo que había antes
                      del primer movimiento. */}
                  <dl className="mb-4 flex flex-wrap gap-x-8 gap-y-3 border-b border-borde pb-4">
                    <Hecho etiqueta="Entró por" valor={ETIQUETA_ORIGEN[f.origen]} />
                    <Hecho etiqueta="En el sistema desde" valor={soloDia(f.creadoEn)} />
                  </dl>

                  {/* EL TIMELINE del diseño: una línea de 2px que
                      corre por detrás y un nodo hueco de 11px con
                      borde verde por cada movimiento.

                      La línea va de `top:6px` a `bottom:6px` y no
                      de borde a borde: así arranca y termina EN el
                      primer y el último nodo en vez de sobresalir
                      por arriba y por abajo. */}
                  <div style={{ position: "relative", paddingLeft: 22 }}>
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: 5,
                        top: 6,
                        bottom: 6,
                        width: 2,
                        background: "var(--borde)",
                      }}
                    />
                    {f.movimientos.map((m) => (
                      <div key={m.id} style={{ position: "relative", padding: "0 0 18px" }}>
                        <span
                          aria-hidden
                          style={{
                            position: "absolute",
                            left: -22,
                            top: 3,
                            width: 11,
                            height: 11,
                            borderRadius: "50%",
                            background: "var(--superficie)",
                            border: "2.5px solid var(--marca)",
                          }}
                        />
                        <div style={{ fontSize: 13.5, color: "var(--texto)" }}>
                          <span style={{ color: "var(--texto-suave)" }}>{fecha(m.creadoEn)} —</span>{" "}
                          {m.etapaAntes === m.etapaDespues ? (
                            <b>{m.nota ?? "Se le hizo un cambio"}</b>
                          ) : (
                            <>
                              {m.etapaAntes
                                ? `${ETIQUETA_ETAPA[m.etapaAntes]} → `
                                : "Alta en "}
                              <b>{ETIQUETA_ETAPA[m.etapaDespues]}</b>
                            </>
                          )}
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--texto-suave)", marginTop: 2 }}>
                          {m.admin ? `por ${m.admin.nombre}` : "por el sistema"}
                          {m.motivo ? ` · ${m.motivo}` : ""}
                          {m.nota && m.etapaAntes !== m.etapaDespues
                            ? ` · ${m.nota}`
                            : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </Tarjeta>

                <Tarjeta
                  titulo=""
                  encabezado={
                    <EncabezadoSeccion
                      icono={<IconoGuardar tamano={18} />}
                      titulo="Cambios realizados"
                      descripcion="Registro de correcciones con su valor anterior."
                    />
                  }
                >
                  <HistoricoDeValores
                    participanteId={f.id}
                    puedeEscribir={puedeEscribir}
                  />
                </Tarjeta>
                </div>
              </>
            )}
          </div>

          {/* EL PANEL DE ACCIONES: lo que se HACE con esta persona,
              siempre a la vista y sin depender de la pestaña que
              esté abierta. Antes el correo y el enlace estaban al
              final de la página, debajo de todo lo que se lee. */}
          {/* EL PANEL DE ACCIONES: lo que se HACE con esta
              persona. UNA sola tarjeta con bloques separados por
              lineas, no cuatro tarjetas sueltas: son la misma
              caja de herramientas y verlas juntas es lo que hace
              que se encuentren. */}
          <aside style={{ width: 370, flex: "none" }}>
            <div
              style={{
                background: "var(--superficie)",
                border: "1px solid var(--borde)",
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "16px 18px",
                  borderBottom: "1px solid var(--hairline)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {/* Sin icono.
                    El circulo negro con el rayo era el unico
                    icono con fondo que quedaba en el lead, y
                    despues de quitar los cinco circulos verdes
                    se quedaba solo: un adorno que no distingue
                    nada, porque «Acciones» ya lo dice. */}
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.90625rem", color: "var(--titulo)" }}>
                    Acciones
                  </div>
                  <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>
                    Contacto y solicitud de información.
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                {/* ── AUTORIZACIÓN DE DATOS ── */}
                <div style={E.bloque}>
                  <div style={E.rotuloFila}>
                    <span style={E.circuloVerde}>
                      <IconoEscudo tamano={15} />
                    </span>
                    <span style={E.rotulo}>AUTORIZACIÓN DE DATOS</span>
                  </div>

                  {autorizacion ? (
                    <>
                      <div style={E.ficha}>
                        <FilaFicha
                          clave="Estado"
                          valor={`Autorizada (v${autorizacion.politica.version})`}
                        />
                        <FilaFicha clave="Fecha" valor={fecha(autorizacion.otorgadaEn)} />
                        <FilaFicha
                          clave="Modalidad"
                          valor={ETIQUETA_CANAL[autorizacion.canal]}
                        />
                      </div>
                      <div style={E.parrafo}>
                        Si el interesado solicita revocar su autorización, regístrelo
                        aquí para dejar constancia.
                      </div>
                      {puedeEscribir && <Revocar id={f.id} alGuardar={conError} />}
                    </>
                  ) : revocada ? (
                    <>
                      <div style={E.parrafo}>
                        Esta persona <strong>revocó</strong> su autorización el{" "}
                        {fecha(revocada.revocadaEn!)}. Mientras siga revocada no se
                        puede matricular ni entra en el reporte al SENA.
                      </div>
                      <details style={{ fontSize: 12.5 }}>
                        <summary style={{ cursor: "pointer", color: "var(--texto-suave)" }}>
                          La persona pidió autorizar de nuevo
                        </summary>
                        <div style={{ marginTop: 10 }}>
                          <RegistrarAutorizacion id={f.id} alGuardar={conError} />
                        </div>
                      </details>
                    </>
                  ) : (
                    <RegistrarAutorizacion id={f.id} alGuardar={conError} />
                  )}
                </div>

                {puedeEscribir && (
                  <>
                    <div style={E.raya} />

                    {/* ── ESCRIBIRLE UN CORREO ── */}
                    <div style={E.bloque}>
                      <div style={E.rotuloFila}>
                        <span style={E.circuloVerde}>
                          <IconoSobre tamano={15} />
                        </span>
                        <span style={E.rotulo}>ESCRIBIRLE UN CORREO</span>
                      </div>
                      <div style={E.parrafo}>
                        El asistente genera un borrador con el nombre, la empresa y el
                        estado actual del registro. Revíselo antes de enviarlo.
                      </div>
                      <EnviarCorreo participanteId={f.id} />
                    </div>

                    <div style={E.raya} />

                    {/* ── ENLACE PARA QUE COMPLETE SUS DATOS ── */}
                    <div style={E.bloque}>
                      <div style={E.rotuloFila}>
                        <span style={E.circuloVerde}>
                          <IconoEnlace tamano={15} />
                        </span>
                        <span style={E.rotulo}>ENLACE PARA QUE COMPLETE SUS DATOS</span>
                      </div>
                      <div style={E.parrafo}>
                        Genera un enlace personalizado para que el interesado complete
                        los campos pendientes. Compártalo por WhatsApp o correo; no
                        dicte el documento por teléfono. Cada enlace es de un solo uso
                        y anula el anterior.
                      </div>
                      <EnlaceCompletar lead={f} />
                    </div>
                  </>
                )}

                <div style={E.raya} />

                {/* ── VALIDACIÓN DEL NOMBRE ── */}
                <div style={{ ...E.bloque, gap: 8 }}>
                  <div style={E.rotuloFila}>
                    <span style={E.rotulo}>VALIDACIÓN DEL NOMBRE</span>
                  </div>
                  <ValidacionRui lead={f} alGuardar={conError} />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Los otros cursos de la MISMA persona, fuera de la
          tarjeta: no son de este lead, son un puente a otras. */}
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


/// El encabezado de un bloque del panel de acciones: circulo
/// verde palido con su icono y el rotulo en mayusculas.
function BloqueAccion({
  icono,
  titulo,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-borde px-4 py-5 first:border-t-0">
      {/* Sin el circulo verde, y en el azul de marca.
          Es el mismo criterio que en los rotulos de grupo del
          expediente: bajando por el panel salian tres circulos
          verdes que no distinguian nada, y el verde no es color
          de marca. El icono se queda, pero suelto. */}
      <p className="flex items-center gap-2 text-[0.625rem] font-semibold tracking-[0.1em] text-marca uppercase">
        <span aria-hidden className="shrink-0">
          {icono}
        </span>
        {titulo}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/// Un lead de datos del panel: fondo suave y filas de
/// clave a la izquierda, valor a la derecha.
function FichaDeDatos({ filas }: { filas: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="rounded-xl border border-borde bg-superficie-alterna p-3.5">
      {filas.map(([clave, valor]) => (
        <div
          key={clave}
          className="flex items-baseline justify-between gap-4 py-1 text-[0.8125rem]"
        >
          <dt className="shrink-0 text-texto-suave">{clave}</dt>
          <dd className="min-w-0 truncate text-right font-semibold">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/// Un lead con rotulo encima, como «ULTIMO ENLACE GENERADO».
function FichaConRotulo({
  rotulo,
  filas,
}: {
  rotulo: string;
  filas: Array<[string, React.ReactNode]>;
}) {
  return (
    <div className="mt-3 rounded-xl border border-borde bg-superficie-alterna p-3.5">
      <p className="text-[0.625rem] font-semibold tracking-[0.1em] text-texto-suave uppercase">
        {rotulo}
      </p>
      <dl className="mt-2">
        {filas.map(([clave, valor]) => (
          <div
            key={clave}
            className="flex items-baseline justify-between gap-4 py-1 text-[0.8125rem]"
          >
            <dt className="shrink-0 text-texto-suave">{clave}</dt>
            <dd className="min-w-0 truncate text-right font-semibold">{valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}


/// Los estilos del rail de acciones, copiados del archivo de
/// diseno uno por uno. Van en un objeto y no repartidos por el
/// JSX para que se puedan comparar de un vistazo contra el
/// original, que es como se comprueba que estan IGUALES.
const E = {
  bloque: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  rotuloFila: { display: "flex", alignItems: "center", gap: 9 },
  /// El icono suelto, sin circulo de color.
  ///
  /// Eran tres circulos verdes bajando por el panel de
  /// acciones, uno por bloque. No distinguian nada -- el rotulo
  /// ya dice de que es el bloque -- y el verde no es color de
  /// marca. Se conserva el nombre `circuloVerde` porque lo usan
  /// tres sitios y renombrarlo no cambia nada de lo que se ve.
  circuloVerde: {
    color: "var(--marca)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "none",
  },
  /// El circulo invertido, y el icono en `--superficie`, NO en
  /// blanco fijo.
  ///
  /// `--titulo` en modo oscuro es casi blanco, asi que con el
  /// icono en `#fff` era blanco sobre blanco: el circulo
  /// aparecia vacio. Con `--superficie` el icono es siempre lo
  /// contrario del relleno, en los dos temas.
  /// El rotulo de grupo: azul de marca y versalita, igual que
  /// `RotuloDeGrupo`. Iba en verde de acento, que no es color
  /// de marca.
  rotulo: {
    fontWeight: 600,
    fontSize: "0.625rem",
    letterSpacing: ".1em",
    textTransform: "uppercase" as const,
    color: "var(--marca)",
  },
  parrafo: { fontSize: 12.5, color: "var(--texto-suave)", lineHeight: 1.5 },
  raya: { height: 1, background: "var(--superficie-alterna)" },
  ficha: {
    background: "var(--superficie)",
    border: "1px solid var(--hairline)",
    borderRadius: 12,
    padding: 14,
    display: "flex",
    flexDirection: "column" as const,
    gap: 9,
  },
  /// Los tres botones del rail, tal cual el diseno.
  /// Azul de marca (DECISIONES 10), y por token: un hex a
  /// mano no sabe que existe el modo oscuro.
  botonVerde: {
    background: "var(--marca)",
    color: "var(--marca-texto)",
    border: "none",
    borderRadius: 11,
    padding: 13,
    fontWeight: 600, fontSize: 14,
    cursor: "pointer",
    width: "100%",
  },
  botonContorno: {
    background: "var(--superficie)",
    color: "var(--titulo)",
    border: "1.5px solid var(--campo-borde)",
    borderRadius: 11,
    padding: 13,
    fontWeight: 600, fontSize: 14,
    cursor: "pointer",
    width: "100%",
  },
  botonRojo: {
    background: "var(--superficie)",
    color: "var(--error)",
    border: "1.5px solid var(--error)",
    borderRadius: 11,
    padding: 12,
    fontWeight: 600, fontSize: 13.5,
    cursor: "pointer",
    width: "100%",
  },
} as const;

/// Una fila de la ficha: clave gris a la izquierda, valor en
/// negrita a la derecha.
function FilaFicha({ clave, valor }: { clave: string; valor: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        fontSize: 12.5,
      }}
    >
      <span style={{ color: "var(--texto-suave)" }}>{clave}</span>
      <span style={{ color: "var(--texto)", fontWeight: 600 }}>{valor}</span>
    </div>
  );
}


/// El estado del enlace, dicho como en el diseño: una frase
/// corta, no el nombre del enum.
const ESTADO_ENLACE: Record<string, string> = {
  SIN_ABRIR: "Sin abrir",
  ABIERTO: "Abierto, sin completar",
  COMPLETADO: "Completado",
  ANULADO: "Anulado por uno nuevo",
  CADUCADO: "Caducado sin usar",
};

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
  lead,
  alGuardar,
}: {
  lead: Ficha;
  alGuardar: (accion: () => Promise<void>, exito?: string) => Promise<void>;
}) {
  /// El desplegable NO se controla con estado propio.
  ///
  /// Su valor es siempre `lead.etapa`. Así, si el cambio
  /// falla —o lo cancelan en el prompt del motivo— el
  /// desplegable vuelve solo a lo que de verdad hay guardado.
  /// Con estado propio se quedaría enseñando una etapa que no
  /// se llegó a grabar, que es la peor forma de mentir: la
  /// silenciosa.
  function mover(destino: Etapa) {
    if (destino === lead.etapa) return;

    let motivo: string | undefined;
    if (ETAPAS_SALIDA.includes(destino)) {
      /// Las etapas de salida piden motivo SIEMPRE. Sacar a
      /// alguien de una convocatoria sin decir por qué deja
      /// un lead que nadie sabe leer seis meses después.
      const escrito = window.prompt(
        `¿Por qué pasa a «${ETIQUETA_ETAPA[destino]}»? Es obligatorio.`,
      );
      if (!escrito?.trim()) return;
      motivo = escrito.trim();
    }

    void alGuardar(
      async () => {
        await crmApi.cambiarEtapa(lead.id, destino, motivo);
      },
      `Ahora está en «${ETIQUETA_ETAPA[destino]}».`,
    );
  }

  /// La etapa de ahora puede NO ser de las que se mueven a
  /// mano: `ETAPAS_A_MANO` son cuatro, y un lead puede estar
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
  const aMano = ETAPAS_A_MANO.includes(lead.etapa)
    ? ETAPAS_A_MANO
    : [lead.etapa, ...ETAPAS_A_MANO];

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
            !ETAPAS_A_MANO.includes(lead.etapa)
              ? `«${ETIQUETA_ETAPA[lead.etapa]}» la pone el sistema: se puede salir de ella, pero no volver.`
              : undefined
          }
          value={lead.etapa}
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
  lead,
  opciones,
  alGuardar,
}: {
  lead: Ficha;
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
  /// que ya tiene el lead. Se deriva en vez de copiarse en un
  /// efecto: asi, cuando llegan las opciones tarde, la lista
  /// aparece con su valor ya puesto y no en blanco.
  const [elegida, setElegida] = useState<string | null>(null);
  const [coberturaId, setCoberturaId] = useState(lead.cobertura?.id ?? "");

  if (!opciones) return null;

  const guardada = lead.oferta
    ? (opciones.acciones.find((a) => a.ofertaId === lead.oferta!.id)
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
  /// podía guardar un lead con la oferta de Bogotá y un
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
          /// lead se quede colgada esperando un cupo que no va
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
            lead.sobrecupoMotivo
              ? `Sobrecupo autorizado${lead.sobrecupoPor ? ` por ${lead.sobrecupoPor.nombre}` : ""}: ${lead.sobrecupoMotivo}`
              : undefined
          }
          disabled={
            !ofertaId ||
            accion?.cubre === false ||
            (ofertaId === lead.oferta?.id &&
              coberturaId === (lead.cobertura?.id ?? ""))
          }
          onClick={() => {
            let motivo: string | undefined;
            if (oferta && oferta.disponibles === 0 && ofertaId !== lead.oferta?.id) {
              const escrito = window.prompt(
                `«${oferta.etiqueta}» no tiene cupos libres. ` +
                  "¿Por qué se coloca por encima del cupo? Queda registrado a su nombre.",
              );
              if (!escrito?.trim()) return;
              motivo = escrito.trim();
            }
            void alGuardar(
              async () => {
                await crmApi.asignar(lead.id, ofertaId, coberturaId || undefined, motivo);
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
      <button type="button" onClick={() => setAbierto(true)} style={E.botonRojo}>
        Revocar autorización
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

      <div className="grid sm:grid-cols-2">
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

        <Campo etiqueta="Qué dijo" ayuda="Queda en el historial de el lead.">
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
      {/* Punto y texto, no una caja rosa.
          `Aviso` pinta un recuadro con borde y radio, y aqui va
          dentro de un panel de 370px: el recuadro dentro del
          panel dentro de el lead son tres marcos anidados. */}
      <p className="flex items-baseline gap-2.5 text-[0.78125rem] leading-relaxed text-texto">
        <span
          aria-hidden
          className="mt-[1px] h-[7px] w-[7px] shrink-0 rounded-full bg-error"
        />
        <span>
          Esta persona todavía no ha autorizado el tratamiento de sus datos. Sin
          eso no se puede matricular ni incluir en el reporte al SENA.
        </span>
      </p>

      {/* En UNA columna. A dos, dentro de un panel de 370px,
          cada campo se quedaba en 170 y el desplegable cortaba
          su propio texto: «Lo autorizó de viva». */}
      <div className="space-y-3">
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
        className="w-full"
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
/// el asesor no recarga ni cuenta segundos, y un lead ya
/// resuelta no sigue preguntando cada tres segundos.
function ValidacionRui({
  lead,
  alGuardar,
}: {
  lead: Ficha;
  alGuardar: (accion: () => Promise<void>, exito?: string) => Promise<void>;
}) {
  const [pidiendo, setPidiendo] = useState(false);
  const [tomando, setTomando] = useState(false);
  /// Dijo «No»: se queda con el que digitó y la pregunta
  /// deja de estorbar. No se guarda nada -- no hay nada que
  /// cambiar -- pero tampoco se le vuelve a preguntar cada
  /// vez que abre el lead.
  const [decidido, setDecidido] = useState(false);

  const traer = useCallback(() => crmApi.estadoRui(lead.id), [lead.id]);
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
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--texto)" }}>
          Consulta no realizada
        </div>
        {/* Una linea y no un parrafo de cuatro: el motivo de
            fondo —que la cedula es inventada pero el numero le
            pertenece a alguien real— esta escrito en el codigo,
            que es donde hace falta para no quitarlo sin saber. */}
        <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 2 }}>
          Documento de prueba: no se consulta ante el RUI.
        </div>
      </div>
    );
  }

  return (
    <div>
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
              este nombre en el lead.
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
                .reconsultarRui(lead.id)
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
          <dl className="grid sm:grid-cols-2">
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

            {/* La decisión, con un botón. Antes el lead
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
                    .tomarNombreDelRui(lead.id)
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
    </div>
  );
}


/// Lo que mando el interesado por su enlace cuando el asesor
/// ya habia tocado el lead. No se pisa nada solo: el asesor
/// ve las dos versiones y elige cuales entran.
function PropuestaDelInteresadoCard({
  lead,
  alGuardar,
}: {
  lead: Ficha;
  alGuardar: (accion: () => Promise<void>, exito?: string) => Promise<void>;
}) {
  const traer = useCallback(() => crmApi.propuesta(lead.id), [lead.id]);
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

          Antes esto era una tabla mas de el lead, con scroll,
          y se resolvia sin mirar. Es una decision sobre los
          datos de una persona: merece que uno se detenga. */}
      <div className="rounded-2xl border border-aviso/40 bg-aviso-suave p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-medium text-aviso">
              El interesado completó sus datos
            </p>
            <p className="mt-1 text-sm text-aviso">
              Usted ya había tocado este lead, así que nada se sobrescribió.{" "}
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
              await crmApi.resolverPropuesta(lead.id, campos);
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
  lead,
  opciones,
  alGuardar,
}: {
  lead: Ficha;
  opciones: Opciones | null;
  alGuardar: (a: () => Promise<void>, exito?: string) => Promise<void>;
}) {
  const { admin } = useAdmin();
  const [asesorId, setAsesorId] = useState(lead.asesor?.id ?? "");
  const [guardando, setGuardando] = useState(false);
  if (!opciones) return null;

  /// A quien NO reparte leads no se le enseña esta tarjeta.
  ///
  /// Un gestor de inscripciones ES un asesor: las suyas las
  /// trabaja, no las reparte. Enseñarle un desplegable que el
  /// servidor va a rechazar es ofrecerle un error.
  ///
  /// Pero se le dice de quién es el lead, porque eso sí le
  /// sirve: es la diferencia entre esconder y ocultar.
  if (!admin.puede?.repartirFichas) {
    return lead.asesor ? (
      <Control etiqueta="Asesor" ancho="xl:col-span-3">
        <p className="text-sm" title="Repartir leads lo hace un líder.">
          {lead.asesor.nombre}
        </p>
      </Control>
    ) : null;
  }

  const cambiado = asesorId !== (lead.asesor?.id ?? "");

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
                await crmApi.actualizar(lead.id, { asesorId: asesorId || null });
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
 * El formulario largo se los pregunta a la persona y el lead
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
  lead,
  puedeEscribir,
}: {
  lead: Ficha;
  puedeEscribir: boolean;
}) {
  const e = lead.empresa;
  const fichaId = lead.id;

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
  const porSuCuenta = lead.trabajaPorSuCuenta;

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
        ["Dirección", e.direccion ?? lead.persona.direccion],
        ["Teléfono", e.telefono ?? lead.persona.celular],
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
    <Tarjeta titulo="">
      {/* El encabezado del diseno: circulo de icono, titulo,
          subtitulo. Va dentro y no como `titulo` de la Tarjeta
          porque esa no sabe pintar el circulo. */}
      <EncabezadoSeccion
        icono={<IconoOrganizaciones tamano={18} />}
        titulo={porSuCuenta ? "Independiente con RUT" : "Datos de empresa"}
        descripcion="Información de la empresa asociada al lead."
        accion={
          <span
            style={{
              fontSize: 12.5,
              color: faltanDelAsesor > 0 ? "var(--aviso)" : "var(--exito)",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {faltanDelAsesor > 0 ? `Faltan ${faltanDelAsesor} suyos` : "Completa"}
          </span>
        }
      />

      <div style={{ marginTop: 16 }}>
        <Campos campos={CAMPOS} />
      </div>

      {DEL_ASESOR.length > 0 && (
        /// Sin encabezado y sin explicación.
        ///
        /// Aquí decía «Lo que usted puede preguntarle — se los
        /// sabe el empleado». Sobra: quien abre este lead ya
        /// sabe qué le toca a él y qué al analista, y un
        /// párrafo que se lo recuerda cada vez es ruido que
        /// tapa los datos. Una línea separa y basta.
        <div className="mt-5 border-t border-borde pt-4">
          <p
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              marginBottom: 12,
            }}
          >
            {/* Sin circulo verde, como los demas rotulos de
                grupo del expediente. Este se me quedo suelto
                porque va escrito a mano y no por
                `RotuloDeGrupo`. */}
            <span
              style={{
                fontWeight: 600,
                fontSize: "0.625rem",
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--marca)",
              }}
            >
              Persona de contacto en la empresa
            </span>
          </p>
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
 * lead. Sin esto solo lo tiene quien se autoinscribió: a los
 * leads creados a mano o venidos de una reserva no había forma
 * de mandárselo.
 */
/**
 * Que le va a pedir el enlace, hoy.
 *
 * La empresa va primero porque el formulario largo la pide
 * primero, y porque sin ella su lead no entra en el F7 por
 * mas completo que este lo suyo. Si no falta nada, se dice:
 * mandar un enlace que no pide nada solo confunde.
 */
function LoQuePedira({ lead }: { lead: Ficha }) {
  const empresa = lead.faltaDeLaEmpresa;
  const persona = lead.faltaDeLaPersona;

  if (empresa.length === 0 && persona.length === 0) {
    return (
      <div className="rounded-xl border border-exito/30 bg-exito-suave p-4 text-sm text-exito">
        <p className="font-medium">No le falta nada</p>
        <p className="mt-1">
          Su lead y la de su organización están completas. El enlace no le va a
          preguntar nada.
        </p>
      </div>
    );
  }

  /// Cuántos datos son, sin decir cuáles.
  ///
  /// Aquí se listaban uno por uno, en dos párrafos —«Primero,
  /// de su organización: nombre del jefe directo, cargo del
  /// jefe directo, correo del jefe directo. Después, lo suyo:
  /// un celular que sea un número.»—, y esa lista no le sirve
  /// a nadie: el asesor no va a preguntarlos él, los pregunta
  /// el formulario. Lo único que necesita saber antes de
  /// mandar el enlace es que hay algo que pedir.
  const cuantos = empresa.length + persona.length;

  return (
    <div className="rounded-xl border border-borde bg-superficie-alterna p-4 text-sm">
      <p className="font-medium">
        {cuantos === 1 ? "Le falta un dato" : `Le faltan ${cuantos} datos`}
      </p>
      <p className="mt-1 text-texto-suave">
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

function EnlaceCompletar({ lead }: { lead: Ficha }) {
  const toast = useToast();
  const [enlace, setEnlace] = useState<{ url: string } | null>(null);
  const [emitiendo, setEmitiendo] = useState(false);
  const [copiado, setCopiado] = useState(false);

  /// Cuántos datos le va a pedir. Es el mismo número que sale
  /// en el lead de abajo y el que decide si hay enlace que
  /// generar, así que se cuenta una vez.
  const pendientes =
    lead.faltaDeLaEmpresa.length + lead.faltaDeLaPersona.length;

  // autoinscrito: ya tuvo uno
  const yaHubo = enlace !== null || lead.origen === "AUTOGESTION";

  async function generar() {
    setEmitiendo(true);
    try {
      const { token } = await crmApi.emitirEnlace(lead.id);
      setEnlace({ url: `${window.location.origin}/completar/${token}` });
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

  /// Si no le falta nada, no hay enlace que mandar: generarlo
  /// llevaría a la persona a un formulario que no le pregunta
  /// nada y anularía el que tuviera abierto.
  if (pendientes === 0) {
    return (
      <div style={{ fontSize: 12.5, color: "var(--texto-suave)", lineHeight: 1.5 }}>
        No le falta ningún dato, así que no se genera ningún enlace. Si hay algo
        que corregir, llámela y cámbielo aquí mismo.
      </div>
    );
  }

  /// El párrafo que explica el enlace NO va aquí: lo pone el
  /// bloque del raíl, encima. En el diseño sale una sola vez,
  /// entre el rótulo y el botón.
  return (
    <>
      <button
        type="button"
        onClick={generar}
        disabled={emitiendo}
        style={{ ...E.botonContorno, opacity: emitiendo ? 0.55 : 1 }}
      >
        {emitiendo ? "Generando…" : yaHubo ? "Generar uno nuevo" : "Generar enlace"}
      </button>

      {/* El enlace recién generado, para copiarlo. No está en
          el diseño —allí el botón no hace nada— pero sin esto
          lo generado no sale de la pantalla. */}
      {enlace && (
        <div style={{ ...E.ficha, marginTop: 10 }}>
          <input
            readOnly
            value={enlace.url}
            aria-label="Enlace para que complete sus datos"
            onFocus={(e) => e.currentTarget.select()}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid var(--campo-borde)",
              background: "var(--superficie)",
              borderRadius: 9,
              padding: "9px 12px",
              fontSize: 13,
              color: "var(--titulo)",
            }}
          />
          <button
            type="button"
            onClick={copiar}
            style={{
              background: "var(--superficie)",
              color: "var(--titulo)",
              border: "1.5px solid var(--campo-borde)",
              borderRadius: 10,
              padding: "8px 14px",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              alignSelf: "flex-start",
            }}
          >
            {copiado ? "Copiado" : "Copiar enlace"}
          </button>
        </div>
      )}

      {/* LA FICHA DEL ÚLTIMO ENLACE, tal como el diseño:
          rótulo pequeño arriba y cuatro filas clave/valor. */}
      {lead.enlace && (
        <div style={{ ...E.ficha, marginTop: 10 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: ".1em",
              color: "var(--texto-suave)",
              marginBottom: 2,
            }}
          >
            ÚLTIMO ENLACE GENERADO
          </div>
          <FilaFicha clave="Estado" valor={ESTADO_ENLACE[lead.enlace.estado]} />
          <FilaFicha clave="Datos pendientes" valor={String(pendientes)} />
          <FilaFicha clave="Generado" valor={fecha(lead.enlace.creadoEn)} />
          <FilaFicha clave="Por" valor={lead.enlace.emitidoPor ?? "—"} />
        </div>
      )}
    </>
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
    <dl className="grid gap-x-6 gap-y-3.5 sm:grid-cols-3">
      {campos.map(([nombre, valor]) => (
        <div key={nombre}>
          {/* El rotulo de un CAMPO va en capitalizacion normal.
              Iba en versalita, igual que los rotulos de GRUPO,
              y con los dos iguales la pestania Empresa se leia
              como una lista de titulos sin datos. En «Datos»
              siempre fue asi; aqui se habia quedado distinto. */}
          <dt className="text-[0.71875rem] text-texto-suave">{nombre}</dt>
          <dd className="text-[0.84375rem]">
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
 * Los tres del jefe directo, escribibles desde el lead.
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
      <div className="grid sm:grid-cols-3">
        {CAMPOS.map(([clave, etiqueta]) => (
          <label key={clave} className="block">
            <span className="mb-1 block text-[0.71875rem] text-texto-suave">
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
