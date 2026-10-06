"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { Aviso, Boton, useAdmin } from "@/components/admin/marco-admin";
import { Bloque, Encabezado, Esqueleto, Vacio } from "@/components/admin/piezas";
import { alcanza } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import { crmApi, type ConversacionEnEspera } from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

/**
 * LA BANDEJA DE CONVERSACIONES DE LUCID.
 *
 * «No está llegando las conversaciones de Lucid; dice que llega 200
 * pero no queda» (cliente, 5 oct 2026).
 *
 * Llegaban, y se guardaban. Lo que pasaba es que cuando el número no
 * casa con nadie del gremio ---o casa con más de uno--- la
 * conversación queda en espera, y NINGUNA pantalla del CRM leía esa
 * tabla. Guardado donde nadie lo ve es indistinguible de perdido; y a
 * los 60 días las sin dueño se borran solas, así que acababa siéndolo.
 *
 * Esta pantalla es la cola de trabajo: lo que espera dueño, y el botón
 * para pegarlo. Las pegadas no salen ---esas ya están en su ficha--- y
 * por eso una bandeja vacía es la buena noticia, no un error.
 */
export default function Conversaciones() {
  const { admin } = useAdmin();
  /// Pegar ESCRIBE. Quien solo puede ver la cola la ve entera, pero
  /// sin botones: esconderle la pantalla sería peor, porque entonces
  /// no sabría que hay conversaciones esperando.
  /// Igual que en BBDD Leads: sin permisos cargados se da por bueno
  /// ---el servidor manda de todas formas--- para no esconder botones
  /// mientras llega la respuesta de quien soy.
  const puedePegar =
    !admin?.permisos || alcanza(admin.permisos.inscripciones, "ESCRIBIR");

  const cargar = useCallback(() => crmApi.conversacionesEnEspera(), []);
  const vivos = useDatosVivos<ConversacionEnEspera[]>(cargar, {
    clave: "conversaciones-en-espera",
  });

  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  /// Cuál se está pegando, para no pulsar dos veces el mismo botón.
  const [pegando, setPegando] = useState<string | null>(null);

  async function pegar(
    c: ConversacionEnEspera,
    destino: { participanteId?: string; leadId?: string },
    aQuien: string,
  ) {
    setPegando(c.id);
    setError(null);
    setExito(null);
    try {
      await crmApi.pegarConversacion(c.id, destino);
      setExito(`La conversación quedó como nota en ${aQuien}.`);
      /// Y se vuelve a pedir la cola: la que se pegó ya no está en
      /// espera, y dejarla en pantalla haría pulsar otra vez.
      vivos.refrescar();
    } catch (e) {
      setError(
        e instanceof ErrorApi ? e.message : "No se pudo pegar la conversación.",
      );
    } finally {
      setPegando(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Encabezado
        titulo="Conversaciones de WhatsApp"
        descripcion={
          <>
            Lo que mandó Lucid y el sistema no pudo pegar solo: números que no
            son de nadie del gremio, o que son de más de una persona. Pegarla
            deja la conversación como nota en su ficha o en su lead.{" "}
            <strong>
              Las que sí se pegaron solas no salen aquí: están en la ficha de
              cada quien.
            </strong>
          </>
        }
      />

      {error && <Aviso tipo="error">{error}</Aviso>}
      {exito && <Aviso tipo="exito">{exito}</Aviso>}

      {vivos.error && <Aviso tipo="error">{vivos.error}</Aviso>}
      {!vivos.datos && !vivos.error && <Esqueleto />}

      {vivos.datos && vivos.datos.length === 0 && (
        <Vacio titulo="No hay conversaciones esperando dueño">
          Todo lo que mandó Lucid quedó pegado en su ficha o en su lead. Si
          esperaba ver algo aquí, revise en Sistemas que la integración tenga su
          llave.
        </Vacio>
      )}

      {vivos.datos && vivos.datos.length > 0 && (
        <Bloque
          titulo={`${vivos.datos.length} esperando`}
          descripcion="Las que tocan a más de una persona van primero: esas ya traen a quién pegarlas."
        >
          <div className="flex flex-col gap-3">
            {vivos.datos.map((c) => (
              <Fila
                key={c.id}
                c={c}
                puedePegar={puedePegar}
                pegando={pegando === c.id}
                alPegar={pegar}
              />
            ))}
          </div>
        </Bloque>
      )}
    </div>
  );
}

/// Una conversación con sus botones. Fuera del componente de arriba
/// para que escribir en el buscador de una no vuelva a pintar las cien.
function Fila({
  c,
  puedePegar,
  pegando,
  alPegar,
}: {
  c: ConversacionEnEspera;
  puedePegar: boolean;
  pegando: boolean;
  alPegar: (
    c: ConversacionEnEspera,
    destino: { participanteId?: string; leadId?: string },
    aQuien: string,
  ) => Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-borde p-3">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-texto-suave">
        <span
          className="rounded-md px-2 py-0.5 font-semibold"
          style={{
            background:
              c.estado === "AMBIGUA"
                ? "color-mix(in oklab, var(--aviso) 18%, transparent)"
                : "color-mix(in oklab, var(--texto-suave) 12%, transparent)",
          }}
        >
          {c.estado === "AMBIGUA" ? "Toca a varios" : "Número de nadie"}
        </span>
        <span className="font-mono">{c.celular}</span>
        {c.convenioSigla && <span>· {c.convenioSigla}</span>}
        <span>
          {/* El rótulo cambia según de quién sea la fecha: decir
              «ocurrió» de la hora en que nos llegó sería inventarlo. */}
          · {c.cuandoEsDeLucid ? "ocurrió" : "nos llegó"}{" "}
          {new Date(c.cuando).toLocaleString("es-CO", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      </div>

      <p className="mt-2 text-[13px] whitespace-pre-wrap">{c.resumen}</p>

      {c.candidatos.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-texto-suave">Pegar a:</span>
          {c.candidatos.map((k) => (
            <Boton
              key={`${k.tipo}-${k.id}`}
              disabled={!puedePegar || pegando}
              onClick={() =>
                alPegar(
                  c,
                  k.tipo === "FICHA"
                    ? { participanteId: k.id }
                    : { leadId: k.id },
                  k.nombre ?? (k.tipo === "FICHA" ? "esa ficha" : "ese lead"),
                )
              }
            >
              {k.nombre ?? k.id}
              {k.documento ? ` · ${k.documento}` : ""}
              {k.tipo === "LEAD" ? " (lead)" : ""}
            </Boton>
          ))}
        </div>
      ) : (
        <BuscarAQuien
          c={c}
          puedePegar={puedePegar}
          pegando={pegando}
          alPegar={alPegar}
        />
      )}
    </div>
  );
}

/**
 * CUANDO EL NÚMERO NO ES DE NADIE, hay que buscar a la persona.
 *
 * Se busca entre las fichas con el mismo buscador de Gestión de leads
 * ---documento, nombre, correo--- porque el celular ya se sabe que no
 * casa: si casara, la conversación no estaría aquí. Lo normal es que la
 * persona escriba desde otro número, y entonces se la encuentra por su
 * cédula.
 */
function BuscarAQuien({
  c,
  puedePegar,
  pegando,
  alPegar,
}: {
  c: ConversacionEnEspera;
  puedePegar: boolean;
  pegando: boolean;
  alPegar: (
    c: ConversacionEnEspera,
    destino: { participanteId?: string; leadId?: string },
    aQuien: string,
  ) => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [encontradas, setEncontradas] = useState<
    Array<{ id: string; nombre: string; documento: string; etapa: string }>
  | null>(null);

  async function buscar() {
    const q = texto.trim();
    /// Dos letras no buscan nada útil y traen media base.
    if (q.length < 3) {
      setFallo("Escriba al menos tres caracteres: un documento o un nombre.");
      return;
    }
    setBuscando(true);
    setFallo(null);
    try {
      const r = await crmApi.listar({ buscar: q, limite: 8 });
      setEncontradas(
        r.participantes.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          documento: p.documento,
          etapa: p.etapa,
        })),
      );
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : "No se pudo buscar.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void buscar();
          }}
          placeholder="Documento o nombre de la persona"
          disabled={!puedePegar}
          className="h-[32px] min-w-0 flex-[1_1_220px] rounded-[9px] border border-campo-borde bg-campo px-3 text-[12.5px]"
        />
        <Boton onClick={() => void buscar()} disabled={!puedePegar || buscando}>
          {buscando ? "Buscando…" : "Buscar"}
        </Boton>
        {/* Y la salida de emergencia: si no está en el CRM, la
            conversación es de alguien que no tiene ficha todavía. */}
        <Link
          href={`/admin/participantes?buscar=${encodeURIComponent(c.celular)}`}
          className="text-[12px] underline"
        >
          Ver en Gestión de leads
        </Link>
      </div>

      {fallo && <p className="text-[12px] text-error">{fallo}</p>}

      {encontradas && encontradas.length === 0 && (
        <p className="text-[12px] text-texto-suave">
          Nadie coincide. Esa persona todavía no tiene ficha: si hay que
          crearla, se crea en Gestión de leads y luego se vuelve aquí.
        </p>
      )}

      {encontradas && encontradas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {encontradas.map((p) => (
            <Boton
              key={p.id}
              disabled={!puedePegar || pegando}
              onClick={() => alPegar(c, { participanteId: p.id }, p.nombre)}
            >
              {p.nombre} · {p.documento}
            </Boton>
          ))}
        </div>
      )}
    </div>
  );
}
