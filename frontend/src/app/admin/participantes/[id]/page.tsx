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

  // el aviso de arriba es el registro;
  // el toast lo ve quien esta al pie
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
      <ValidacionRui ficha={f} />
      </div>

      <PropuestaDelInteresadoCard ficha={f} alGuardar={conError} />

      {/* de a dos: cada una ocupaba una franja entera del ancho
          para tres botones, y obligaba a bajar por cosas que
          caben una al lado de la otra */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Asesor ficha={f} opciones={opciones} alGuardar={conError} />
        <Asignacion ficha={f} opciones={opciones} alGuardar={conError} />
      </div>

      <DatosSena ficha={f} alGuardar={conError} />

      {puedeEscribir && <EnlaceCompletar ficha={f} />}

      <Tarjeta
        titulo="Autorización de tratamiento de datos"
        descripcion="La empresa no puede autorizarla por ella: el titular del dato es la persona."
      >
        {autorizacion ? (
          <p className="text-sm">
            Autorizada el <strong>{fecha(autorizacion.otorgadaEn)}</strong> — versión{" "}
            {autorizacion.politica.version}. {ETIQUETA_CANAL[autorizacion.canal]}.
          </p>
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
              <span className="text-sm text-texto-suave">Por dónde:</span>
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
        descripcion="Cada movimiento, con su fecha, quién lo hizo y su motivo."
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
          descripcion="Es la misma persona: el documento la identifica en todo el sistema."
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
    <Tarjeta
      titulo="Acción de formación y grupo"
      descripcion="El grupo es lo que se reporta al SENA, y de sus fechas depende todo el seguimiento."
    >
      <div className="space-y-4">
        <Campo etiqueta="Acción de formación y ubicación">
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
function ValidacionRui({ ficha }: { ficha: Ficha }) {
  const [pidiendo, setPidiendo] = useState(false);

  const traer = useCallback(() => crmApi.estadoRui(ficha.id), [ficha.id]);
  const { datos: rui, refrescar } = useDatosVivos<ConsultaRui>(traer, {
    intervaloMs: 3000,
    activo: true,
  });

  if (!rui) return null;

  const esperando = rui.estado === "PENDIENTE" || rui.estado === "EN_CURSO";
  const delRui = rui.nombreEncontrado;

  return (
    <Tarjeta
      titulo="Validacion del nombre"
      descripcion="Lo que digito la persona contra lo que devuelve el RUI."
    >
      <div className="space-y-3">
        {/* mientras el detector sea el de mentira hay que
            decirlo aqui: un nombre inventado al lado de una
            cedula real se lee como si fuera verdadero */}
        {rui.simulado && (
          <Aviso tipo="error">
            <p className="font-medium">El RUI no está conectado</p>
            <p className="mt-1">
              Lo que aparece abajo lo genera un simulador, no la Ventanilla Social.
              No sirve para decidir nada. Se conecta el de verdad poniendo la URL y
              el token del RUI.
            </p>
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

        {!rui.simulado && rui.estado === "LISTA" && rui.nombreCoincide === false && (
          <Aviso tipo="error">
            Los dos nombres no coinciden. Revise cual se deja antes de
            inscribir.
          </Aviso>
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
    <Tarjeta
      titulo="Quién lo lleva"
      descripcion="El asesor responsable de contactar a esta persona y completar su ficha."
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 grow">
          <Campo etiqueta="Asesor asignado">
            <select
              className={CLASE_CONTROL}
              value={asesorId}
              onChange={(e) => setAsesorId(e.target.value)}
            >
              <option value="">Sin asignar — nadie lo está llamando</option>
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

      {!ficha.asesor && (
        <p className="mt-3 text-sm text-aviso">
          Sin asesor, esta persona no aparece en la carga de trabajo de nadie.
        </p>
      )}
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

  return (
    <Tarjeta
      titulo="Enlace para que complete sus datos"
      descripcion="Se le manda por WhatsApp o correo y ella misma llena su ficha, sin dictar la cédula por teléfono."
    >
      <div className="space-y-4">
        <LoQuePedira ficha={ficha} />

        <div className="rounded-xl border border-aviso/30 bg-aviso-suave p-4 text-sm text-aviso">
          <p className="font-medium">Cada enlace anula al anterior</p>
          <p className="mt-1">
            Es de un solo uso. En cuanto genere uno nuevo, el que ya mandó deja de
            servir: si ella todavía no lo ha abierto, no lo vuelva a generar.
          </p>
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
