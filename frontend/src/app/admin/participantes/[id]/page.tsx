"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PildoraEtapa } from "@/components/admin/etapa";
import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  Tarjeta,
} from "@/components/admin/marco-admin";
import { ErrorApi } from "@/lib/api";
import {
  crmApi,
  ETAPAS_AVANCE,
  ETAPAS_SALIDA,
  ETIQUETA_CANAL,
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

  const cargar = useCallback(async () => {
    const ficha = await crmApi.obtener(id);
    setF(ficha);
    setOpciones(await crmApi.opciones(ficha.convenio.id));
  }, [id]);

  useEffect(() => {
    void cargar().catch((e) => setError((e as ErrorApi).message));
  }, [cargar]);

  async function conError(accion: () => Promise<void>) {
    setError(null);
    try {
      await accion();
      await cargar();
    } catch (e) {
      setError((e as ErrorApi).message);
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
          <h1 className="text-2xl font-semibold">{nombre}</h1>
          <p className="mt-1 font-mono text-sm text-texto-suave">
            {f.persona.documento}
          </p>
          <p className="mt-1 text-sm text-texto-suave">
            {f.convenio.sigla ?? f.convenio.nombre} · {ETIQUETA_ORIGEN[f.origen]}
            {f.asesor && ` · asesor: ${f.asesor.nombre}`}
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

      {f.faltantes.avisan.length > 0 && (
        <Aviso tipo="exito">
          <p className="font-medium">Se puede matricular, pero queda pendiente</p>
          <ul className="mt-2 list-inside list-disc">
            {f.faltantes.avisan.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Aviso>
      )}

      <Tarjeta titulo="Mover de etapa">
        <div className="flex flex-wrap gap-2">
          {[...ETAPAS_AVANCE, ...ETAPAS_SALIDA].map((e) => (
            <button
              key={e}
              disabled={e === f.etapa}
              onClick={() =>
                conError(async () => {
                  let motivo: string | undefined;
                  if (ETAPAS_SALIDA.includes(e)) {
                    const escrito = window.prompt(
                      `¿Por qué pasa a «${ETIQUETA_ETAPA[e]}»? Es obligatorio.`,
                    );
                    if (!escrito?.trim()) return;
                    motivo = escrito.trim();
                  }
                  await crmApi.cambiarEtapa(f.id, e as Etapa, motivo);
                })
              }
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

      <Asignacion ficha={f} opciones={opciones} alGuardar={conError} />

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

      <Tarjeta titulo="Notas" descripcion="No se borran: una corrección es otra nota.">
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              className={CLASE_CONTROL}
              placeholder="Qué pasó con esta persona"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
            <Boton
              disabled={!nota.trim()}
              onClick={() =>
                conError(async () => {
                  await crmApi.agregarNota(f.id, nota.trim());
                  setNota("");
                })
              }
            >
              Agregar
            </Boton>
          </div>

          {f.notas.length === 0 && (
            <p className="text-sm text-texto-suave">Todavía no hay notas.</p>
          )}

          {f.notas.map((n) => (
            <article key={n.id} className="border-t border-borde pt-3">
              <p className="text-sm">{n.texto}</p>
              <p className="mt-1 text-xs text-texto-suave">
                {n.autorNombre} · {fecha(n.creadoEn)}
              </p>
            </article>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Historial" descripcion="Cada movimiento, con su fecha y su motivo.">
        <ol className="space-y-2">
          {f.movimientos.map((m) => (
            <li key={m.id} className="text-sm">
              <span className="text-texto-suave">{fecha(m.creadoEn)}</span> —{" "}
              {m.etapaAntes ? `${ETIQUETA_ETAPA[m.etapaAntes]} → ` : "Alta en "}
              <strong>{ETIQUETA_ETAPA[m.etapaDespues]}</strong>
              {m.motivo && <span className="text-texto-suave"> · {m.motivo}</span>}
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
  alGuardar: (a: () => Promise<void>) => Promise<void>;
}) {
  const [ofertaId, setOfertaId] = useState(ficha.oferta?.id ?? "");
  const [coberturaId, setCoberturaId] = useState(ficha.cobertura?.id ?? "");

  if (!opciones) return null;

  const oferta = opciones.ofertas.find((o) => o.id === ofertaId);
  const grupos = oferta
    ? opciones.grupos.filter((g) => g.accionFormacionId === oferta.accionFormacionId)
    : [];

  return (
    <Tarjeta
      titulo="Acción de formación y grupo"
      descripcion="El grupo es lo que se reporta al SENA, y de sus fechas depende todo el seguimiento."
    >
      <div className="space-y-4">
        <Campo etiqueta="Acción de formación y ubicación">
          <select
            className={CLASE_CONTROL}
            value={ofertaId}
            onChange={(e) => {
              setOfertaId(e.target.value);
              setCoberturaId("");
            }}
          >
            <option value="">Sin asignar</option>
            {opciones.ofertas.map((o) => (
              <option key={o.id} value={o.id}>
                {o.etiqueta} · {o.ubicacion} · {o.disponibles} de {o.cupos} libres
                {!o.abierta ? " (cerrada)" : ""}
              </option>
            ))}
          </select>
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
            <select
              className={CLASE_CONTROL}
              value={coberturaId}
              onChange={(e) => setCoberturaId(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.etiqueta} · {g.ocupados} de {g.cupos}
                  {g.fechaInicio
                    ? ` · desde ${new Date(g.fechaInicio).toLocaleDateString("es-CO")}`
                    : " · sin fechas"}
                </option>
              ))}
            </select>
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
          onClick={() =>
            alGuardar(async () => {
              let motivo: string | undefined;
              if (oferta && oferta.disponibles === 0 && ofertaId !== ficha.oferta?.id) {
                const escrito = window.prompt(
                  `«${oferta.etiqueta}» no tiene cupos libres. ` +
                    "¿Por qué se coloca por encima del cupo? Queda registrado a su nombre.",
                );
                if (!escrito?.trim()) return;
                motivo = escrito.trim();
              }
              await crmApi.asignar(ficha.id, ofertaId, coberturaId || undefined, motivo);
            })
          }
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
  alGuardar: (a: () => Promise<void>) => Promise<void>;
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
          })
        }
      >
        Registrar la autorización
      </Boton>
    </div>
  );
}
