"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Aviso } from "@/components/admin/marco-admin";
import { Cifra, Encabezado, Vacio } from "@/components/admin/piezas";
import { useDatosVivos } from "@/lib/datos-vivos";
import { ErrorApi } from "@/lib/api";
import {
  ETIQUETA_ESTADO_LEAD,
  mesaApi,
  TONO_ESTADO_LEAD,
  type EstadoLead,
  type ListadoDeLaMesa,
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
  const [datos, setDatos] = useState<ListadoDeLaMesa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState("");
  const [buscar, setBuscar] = useState("");
  /// Lo que de verdad se manda: consultar en cada tecla sería
  /// una petición por letra.
  const [buscado, setBuscado] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setBuscado(buscar), 350);
    return () => clearTimeout(t);
  }, [buscar]);

  const cargar = useCallback(async () => {
    try {
      setDatos(
        await mesaApi.listar({ estado: estado || undefined, buscar: buscado }),
      );
      setError(null);
    } catch (e) {
      /// Un fallo NO vacía la pantalla: con el refresco cada 30 s,
      /// convertir un parpadeo de red en pantalla en blanco borra
      /// la lista cada vez que la conexión tose.
      setError(e instanceof ErrorApi ? e.message : "No se pudo cargar la mesa.");
    }
  }, [estado, buscado]);

  useDatosVivos(cargar);

  const r = datos?.resumen ?? {};

  return (
    <>
      <Encabezado
        titulo="Mesa de entrada"
        descripcion="Lo que llega por los webhooks: la pauta de Meta y el orquestador de correos. Todavía no son fichas — un lead de un anuncio no trae autorización de datos — así que alguien los llama y los convierte."
      />

      <section className="space-y-5 px-7 py-6">
        {error && <Aviso tipo="error">{error}</Aviso>}

        <div className="flex flex-wrap gap-3">
          <Cifra
            etiqueta="Sin atender"
            valor={r.PENDIENTE ?? 0}
            pie="esperan que alguien los llame"
            color="var(--aviso)"
          />
          <Cifra
            etiqueta="Ya son ficha"
            valor={r.CONVERTIDO ?? 0}
            color="var(--exito)"
          />
          <Cifra etiqueta="Descartados" valor={r.DESCARTADO ?? 0} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            className={CLASE_CAMPO + " min-w-[280px] flex-1"}
            placeholder="Documento, nombre, correo o celular"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
          <select
            className={CLASE_CAMPO}
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((s) => (
              <option key={s} value={s}>
                {ETIQUETA_ESTADO_LEAD[s]}
              </option>
            ))}
          </select>
          {datos && (
            <span className="text-sm text-texto-suave">
              {datos.total} {datos.total === 1 ? "lead" : "leads"}
            </span>
          )}
        </div>

        {datos && datos.leads.length === 0 ? (
          <Vacio titulo="No hay leads que mostrar">
            {buscado || estado
              ? "Con esos filtros no aparece ninguno."
              : "Cuando entre uno por el webhook, aparece aquí."}
          </Vacio>
        ) : (
          <div className="caja-scroll overflow-x-auto rounded-xl border border-borde">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-tabla-cabecera text-left text-xs tracking-wide text-texto-suave uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Persona</th>
                  <th className="px-4 py-2.5 font-medium">Contacto</th>
                  <th className="px-4 py-2.5 font-medium">Entró por</th>
                  <th className="px-4 py-2.5 font-medium">Qué pidió</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium">Llegó</th>
                </tr>
              </thead>
              <tbody>
                {(datos?.leads ?? []).map((l) => (
                  <tr key={l.id} className="border-t border-borde align-top">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{l.nombre}</div>
                      <div className="text-xs text-texto-suave">
                        {l.documento ?? "sin documento"} · {l.gremio}
                      </div>
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
                          Ver la ficha
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
      </section>
    </>
  );
}
