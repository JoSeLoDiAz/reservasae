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
  ETIQUETA_RUI,
  type CanalContacto,
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

export default function PaginaFicha() {
  const { id } = useParams<{ id: string }>();
  const [f, setF] = useState<Ficha | null>(null);
  const [opciones, setOpciones] = useState<Opciones | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [canales, setCanales] = useState<CanalContacto[]>([]);
  const [borrando, setBorrando] = useState(false);
  const { admin } = useAdmin();
  const router = useRouter();
  const toast = useToast();
  const esSuperadmin = admin.rol === "SUPERADMIN";
  // sin permisos aun no se esconde nada
  const puedeEscribir =
    !admin.permisos || alcanza(admin.permisos.inscripciones, "ESCRIBIR");

  const cargar = useCallback(async () => {
    const ficha = await crmApi.obtener(id);
    setF(ficha);
    setOpciones(await crmApi.opciones(ficha.convenio.id));
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

  const autorizacion = f.persona.autorizaciones.find(
    (a) => a.politica.destinatario === "PARTICIPANTE" &&
      a.politica.convenioId === f.convenio.id,
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/participantes" className="text-sm underline">
          ← Volver a inscripciones
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{nombre}</h1>
          <p className="mt-1 font-mono text-sm text-texto-suave">
            {f.persona.documento}
          </p>
          <p className="mt-1 text-sm text-texto-suave">
            {f.convenio.sigla ?? f.convenio.nombre} · {ETIQUETA_ORIGEN[f.origen]}
          </p>
        </div>
        <PildoraEtapa etapa={f.etapa} />
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


      {/* Cada una en su tarjeta, y en este orden.
          
          La rejilla llena por filas, asi que el orden de aqui
          es: arriba «Mover de etapa» y «Asesor»; abajo
          «Accion de formacion» y «Validacion del nombre».
          A la izquierda lo que decide el asesor, a la derecha
          lo que tiene que mirar antes de decidir. */}
      {/* Sin `items-start`: las dos de cada fila se estiran
          a la mas alta.
          
          Con `items-start` cada una medía lo que midiera su
          contenido, así que quedaban desparejas y la fila se
          veía rota. La rejilla las empareja sola -- eso es lo
          que hace por defecto -- y yo se lo había quitado. */}
      <div className="grid gap-6 xl:grid-cols-2">
      <Tarjeta titulo="Mover de etapa">
        <div className="flex flex-wrap gap-2">
          {ETAPAS_A_MANO.map((e) => (
            <button
              key={e}
              disabled={e === f.etapa}
              onClick={() => {
                let motivo: string | undefined;
                if (ETAPAS_SALIDA.includes(e)) {
                  const escrito = window.prompt(
                    `¿Por qué pasa a «${ETIQUETA_ETAPA[e]}»? Es obligatorio.`,
                  );
                  if (!escrito?.trim()) return;
                  motivo = escrito.trim();
                }
                void conError(
                  async () => {
                    await crmApi.cambiarEtapa(f.id, e as Etapa, motivo);
                  },
                  `Ahora está en «${ETIQUETA_ETAPA[e]}».`,
                );
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                e === f.etapa
                  ? "border-marca bg-marca-suave font-medium text-marca"
                  : "border-borde hover:bg-superficie-alterna"
              }`}
            >
              {ETIQUETA_ETAPA[e]}
            </button>
          ))}
        </div>
      </Tarjeta>

      <Asesor ficha={f} opciones={opciones} alGuardar={conError} />
      <Asignacion ficha={f} opciones={opciones} alGuardar={conError} />
      <ValidacionRui ficha={f} alGuardar={conError} />
      </div>

      <PropuestaDelInteresadoCard ficha={f} alGuardar={conError} />

      <DatosSena ficha={f} alGuardar={conError} />

      <DatosDeLaEmpresa ficha={f} />

      {puedeEscribir && <EnlaceCompletar ficha={f} />}

      <Tarjeta
        titulo="Autorización de tratamiento de datos"
      >
        {autorizacion ? (
          <div className="space-y-3">
            <p className="text-sm">
              Autorizada el <strong>{fecha(autorizacion.otorgadaEn)}</strong> — versión{" "}
              {autorizacion.politica.version}. {ETIQUETA_CANAL[autorizacion.canal]}.
            </p>
            {puedeEscribir && <Revocar id={f.id} alGuardar={conError} />}
          </div>
        ) : (
          <RegistrarAutorizacion id={f.id} alGuardar={conError} />
        )}
      </Tarjeta>

      <Tarjeta
        titulo="Notas"
        descripcion="No se borran: una corrección es otra nota."
      >
        <div className="space-y-4">
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

            <div className="flex gap-3">
              <input
                className={CLASE_CONTROL}
                placeholder="Qué pasó con esta persona"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
              <Boton
                disabled={!nota.trim() || canales.length === 0}
                onClick={() =>
                  conError(async () => {
                    await crmApi.agregarNota(f.id, nota.trim(), canales);
                    setNota("");
                    setCanales([]);
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
                {n.autorNombre} · {fecha(n.creadoEn)}
              </p>
            </article>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Historial"
      >
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

function Asignacion({
  ficha,
  opciones,
  alGuardar,
}: {
  ficha: Ficha;
  opciones: Opciones | null;
  alGuardar: (a: () => Promise<void>, exito?: string) => Promise<void>;
}) {
  const [ofertaId, setOfertaId] = useState(ficha.oferta?.id ?? "");
  const [coberturaId, setCoberturaId] = useState(ficha.cobertura?.id ?? "");

  if (!opciones) return null;

  const oferta = opciones.ofertas.find((o) => o.id === ofertaId);
  const grupos = oferta
    ? opciones.grupos.filter((g) => g.accionFormacionId === oferta.accionFormacionId)
    : [];

  const gruposVisibles = grupos;

  return (
    <Tarjeta titulo="Acción de formación y grupo">
      <div className="space-y-4">
        <Campo etiqueta="">
          <SelectorBuscable
            valor={ofertaId}
            alElegir={(id) => {
              setOfertaId(id);
              setCoberturaId("");
            }}
            marcador="AF8, inteligencia artificial, Bolívar…"
            opciones={opciones.ofertas.map((o) => ({
              id: o.id,
              etiqueta: o.etiqueta,
              detalle: `${o.ubicacion} · ${o.disponibles} de ${o.cupos} libres${
                o.abierta ? "" : " · cerrada"
              }`,
              busca: o.ubicacion,
            }))}
          />
        </Campo>

        {oferta && (
          <Campo
            etiqueta="Grupo"
            ayuda={
              grupos.length === 0
                ? "Esta acción no tiene grupos cargados."
                : "Sin grupo con fechas no se puede matricular."
            }
          >
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
          </Campo>
        )}

        {ficha.sobrecupoMotivo && (
          <p className="text-sm text-texto-suave">
            Sobrecupo autorizado{ficha.sobrecupoPor && ` por ${ficha.sobrecupoPor.nombre}`}:{" "}
            {ficha.sobrecupoMotivo}
          </p>
        )}

        <Boton
          disabled={!ofertaId || (ofertaId === ficha.oferta?.id && coberturaId === (ficha.cobertura?.id ?? ""))}
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
          Guardar asignación
        </Boton>
      </div>
    </Tarjeta>
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
  const [seleccion, setSeleccion] = useState<{ id: string; campos: string[] } | null>(
    null,
  );

  const propuesta = datos ?? null;
  if (!propuesta || propuesta.campos.length === 0) return null;

  // por defecto entran todos: lo normal es aceptar
  const elegidos =
    seleccion?.id === propuesta.id
      ? seleccion.campos
      : propuesta.campos.map((c) => c.campo);

  const alternar = (campo: string) =>
    setSeleccion({
      id: propuesta.id,
      campos: elegidos.includes(campo)
        ? elegidos.filter((c) => c !== campo)
        : [...elegidos, campo],
    });

  return (
    <Tarjeta
      titulo="El interesado completó sus datos"
      descripcion="Usted ya había tocado esta ficha, así que nada se sobrescribió. Elija qué entra."
    >
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-suave">
                <th className="w-10 py-2" />
                <th className="py-2 pr-4">Campo</th>
                <th className="py-2 pr-4">Como está hoy</th>
                <th className="py-2">Lo que mandó</th>
              </tr>
            </thead>
            <tbody>
              {propuesta.campos.map((c) => (
                <tr key={c.campo} className="border-b border-borde last:border-0">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={elegidos.includes(c.campo)}
                      onChange={() => alternar(c.campo)}
                      aria-label={`Aceptar ${c.etiqueta}`}
                    />
                  </td>
                  <td className="py-2 pr-4 font-medium">{c.etiqueta}</td>
                  <td className="py-2 pr-4 text-texto-suave">{c.actual ?? "vacío"}</td>
                  <td className="py-2">{c.propuesto ?? "vacío"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2">
          <Boton
            disabled={elegidos.length === 0}
            onClick={() =>
              alGuardar(async () => {
                await crmApi.resolverPropuesta(ficha.id, elegidos);
                refrescar();
              }, `Se aceptaron ${elegidos.length} campo(s).`)
            }
          >
            Aceptar los marcados
          </Boton>

          <button
            type="button"
            onClick={() =>
              void alGuardar(async () => {
                await crmApi.resolverPropuesta(ficha.id, []);
                refrescar();
              }, "Se descartó lo que mandó el interesado.")
            }
            className="rounded-lg border border-borde px-3 py-1.5 text-sm hover:bg-superficie-alterna"
          >
            Descartar todo
          </button>
        </div>

        <p className="text-xs text-texto-suave">
          Decida lo que decida, queda registrado quién lo hizo y qué dejó entrar.
        </p>
      </div>
    </Tarjeta>
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
  const [asesorId, setAsesorId] = useState(ficha.asesor?.id ?? "");
  const [guardando, setGuardando] = useState(false);
  if (!opciones) return null;

  const cambiado = asesorId !== (ficha.asesor?.id ?? "");

  return (
    <Tarjeta titulo="Asesor">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 grow">
          <Campo etiqueta="">
            <select
              className={CLASE_CONTROL}
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
          </Campo>
        </div>

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

    </Tarjeta>
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
function DatosDeLaEmpresa({ ficha }: { ficha: Ficha }) {
  const e = ficha.empresa;

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
        ["Dirección", e.direccion],
        ["Teléfono", e.telefono],
        ["Departamento", e.departamentoSepId],
        ["Municipio", e.municipioSepId],
        ["Sector económico", e.sectorEconomico],
        ["Número de trabajadores", e.numeroTrabajadores],
        ["Persona de contacto", e.contactoNombre],
        ["Su cargo", e.contactoCargo],
        ["Su correo", e.contactoCorreo],
      ];

  return (
    /// El título nombra a la organización, no la etiqueta.
    ///
    /// «Su organización» no dice nada que la persona no sepa;
    /// la razón social sí, y de un vistazo. Para el
    /// independiente el título dice lo que es -- un RUT, no
    /// una empresa -- porque ahí lo que importa es la figura.
    <Tarjeta
      titulo={porSuCuenta ? "Independiente con RUT" : e.razonSocial}
    >
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        {CAMPOS.map(([nombre, valor]) => (
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

      <p className="mt-4 text-xs text-texto-suave">
        {porSuCuenta
          ? "Su cédula hace de RUT. No entra en Empresas registradas: ahí van organizaciones."
          : "Se corrigen en Empresas registradas, que es donde vive el dato."}
      </p>
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

  return (
    <div className="rounded-xl border border-borde bg-superficie-alterna p-4 text-sm">
      <p className="font-medium">Lo que le va a pedir</p>

      {empresa.length > 0 && (
        <div className="mt-2">
          <p className="text-texto-suave">
            <strong className="text-texto">Primero, de su organización:</strong>{" "}
            {empresa.join(", ")}.
          </p>
        </div>
      )}

      {persona.length > 0 && (
        <div className="mt-2">
          <p className="text-texto-suave">
            <strong className="text-texto">Después, lo suyo:</strong>{" "}
            {persona.join(", ")}.
          </p>
        </div>
      )}

      <p className="mt-3 text-xs text-texto-suave">
        Solo se le pregunta lo que falta. Lo que ya dio no se le vuelve a pedir.
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
        <div className="rounded-xl border border-exito/30 bg-exito-suave p-4 text-sm text-exito">
          <p className="font-medium">Datos completos — no aplica</p>
          <p className="mt-1">
            De ajustar los existentes, por favor comuníquese con el interesado
            para corroborar la información.
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

        <p className="text-sm text-texto-suave">
          <strong className="font-medium text-texto">Recomendación:</strong> enviar
          formulario vía WhatsApp o correo, recuerde no dictar la cédula por
          teléfono.
        </p>

        <div className="rounded-xl border border-aviso/30 bg-aviso-suave p-4 text-sm text-aviso">
          Cada enlace es de un solo uso y anula al anterior, al generar uno nuevo,
          el que ya recibió el interesado dejará de funcionar, antes de generarlo,
          revise su estado. Si el enlace enviado aún no ha sido abierto, no genere
          otro.
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
