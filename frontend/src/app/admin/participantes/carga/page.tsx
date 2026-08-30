"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  Tarjeta,
} from "@/components/admin/marco-admin";
import { adminApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import { crmApi, type OpcionOferta } from "@/lib/crm-api";

type Estado = "NUEVA" | "PERSONA_CONOCIDA" | "REPETIDA" | "DESCARTADA";

type FilaPrevia = {
  linea: number;
  tipoDocumentoSepId: number;
  sigla: string;
  numeroDocumento: string;
  primerNombre: string;
  primerApellido: string;
  correo: string | null;
  celular: string | null;
  problemas: string[];
  estado: Estado;
};

type Previa = {
  total: number;
  creables: number;
  descartadas: number;
  repetidas: number;
  conocidas: number;
  filas: FilaPrevia[];
};

const ETIQUETA_ESTADO: Record<Estado, string> = {
  NUEVA: "Se crea",
  PERSONA_CONOCIDA: "Ya está en el sistema",
  REPETIDA: "Repetida aquí",
  DESCARTADA: "No se crea",
};

export default function PaginaCarga() {
  const router = useRouter();
  const [convenios, setConvenios] = useState<
    Array<{ id: string; nombre: string; sigla: string | null }>
  >([]);
  const [ofertas, setOfertas] = useState<OpcionOferta[]>([]);
  const [convenioId, setConvenioId] = useState("");
  const [ofertaId, setOfertaId] = useState("");
  const [texto, setTexto] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void adminApi
      .convenios()
      .then((l) => {
        const activos = l.filter((c) => c.activo);
        setConvenios(activos);
        if (activos.length === 1) setConvenioId(activos[0].id);
      })
      .catch((e) => setError((e as ErrorApi).message));
  }, []);

  useEffect(() => {
    if (!convenioId) return;
    void crmApi
      .opciones(convenioId)
      .then((o) => setOfertas(o.ofertas))
      .catch(() => setOfertas([]));
  }, [convenioId]);

  async function conError(accion: () => Promise<void>) {
    setError(null);
    setOcupado(true);
    try {
      await accion();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div>
      <div>
        <Link href="/admin/participantes" className="text-sm underline">
          ← Volver a inscripciones
        </Link>
      </div>

      <header className="border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px]">
        <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">Cargar una lista</h1>
        <p className="mt-1 text-texto-suave">
          Copie las celdas desde el Excel que le mandó la empresa y péguelas aquí. Verá
          qué va a pasar antes de confirmar nada.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <Tarjeta
        titulo="Dónde van"
        descripcion="La acción de formación es opcional: si no la sabe todavía, se asigna después desde cada ficha."
      >
        <div className="grid sm:grid-cols-2">
          <Campo etiqueta="Convenio">
            <select
              className={CLASE_CONTROL}
              value={convenioId}
              onChange={(e) => {
                setConvenioId(e.target.value);
                setOfertaId("");
                setPrevia(null);
              }}
            >
              <option value="">Elija uno</option>
              {convenios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.sigla ?? c.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Acción de formación">
            <select
              className={CLASE_CONTROL}
              value={ofertaId}
              onChange={(e) => {
                setOfertaId(e.target.value);
                setPrevia(null);
              }}
              disabled={!convenioId}
            >
              <option value="">Sin asignar por ahora</option>
              {ofertas.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.etiqueta} · {o.ubicacion} · {o.disponibles} libres
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="La lista"
        descripcion="Ocho columnas, en este orden. Si la primera fila son títulos, se salta sola."
      >
        <div className="space-y-3">
          <p className="rounded-md bg-superficie-alterna p-3 font-mono text-xs">
            tipo · documento · primer nombre · segundo nombre · primer apellido ·
            segundo apellido · correo · celular
          </p>

          <textarea
            className={`${CLASE_CONTROL} min-h-56 font-mono text-sm`}
            placeholder={
              "CC\t1019456782\tLaura\tCamila\tGómez\tRojas\tlaura@empresa.com\t3001234567"
            }
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setPrevia(null);
            }}
          />

          <Boton
            disabled={!convenioId || !texto.trim() || ocupado}
            onClick={() =>
              conError(async () => {
                setPrevia(
                  (await (
                    await fetch("/api/admin/participantes/carga/previsualizar", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        convenioId,
                        ofertaId: ofertaId || undefined,
                        texto,
                      }),
                    })
                  ).json()) as Previa,
                );
              })
            }
          >
            {ocupado ? "Revisando…" : "Ver qué va a pasar"}
          </Boton>
        </div>
      </Tarjeta>

      {previa && (
        <Tarjeta
          titulo={`${previa.total} filas leídas`}
          descripcion={`Se crearían ${previa.creables}. ${previa.conocidas} ya existen como persona, ${previa.repetidas} vienen repetidas y ${previa.descartadas} no se pueden crear.`}
        >
          <div className="space-y-4">
            <div className="caja-scroll max-h-96 overflow-auto">
              <table className="tabla-datos">
                <thead>
                  <tr>
                    <th>Línea</th>
                    <th>Documento</th>
                    <th>Nombre</th>
                    <th>Contacto</th>
                    <th>Qué pasa</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.filas.map((f) => (
                    <tr key={f.linea}>
                      <td>{f.linea}</td>
                      <td className="font-mono text-sm">
                        {f.sigla} {f.numeroDocumento || "—"}
                      </td>
                      <td>
                        {f.primerNombre} {f.primerApellido}
                      </td>
                      <td className="text-sm">{f.correo ?? f.celular ?? "—"}</td>
                      <td>
                        <p
                          className={
                            f.estado === "DESCARTADA" || f.estado === "REPETIDA"
                              ? "font-medium text-error"
                              : ""
                          }
                        >
                          {ETIQUETA_ESTADO[f.estado]}
                        </p>
                        {f.problemas.map((p) => (
                          <p key={p} className="text-xs text-texto-suave">
                            {p}
                          </p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previa.creables > 0 ? (
              <Boton
                disabled={ocupado}
                onClick={() =>
                  conError(async () => {
                    const r = await fetch("/api/admin/participantes/carga/confirmar", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        convenioId,
                        ofertaId: ofertaId || undefined,
                        texto,
                      }),
                    });
                    const res = (await r.json()) as {
                      creados: number;
                      fallos: Array<{ linea: number; motivo: string }>;
                    };
                    if (res.fallos?.length) {
                      setError(
                        `Se crearon ${res.creados}. Fallaron ${res.fallos.length}: ` +
                          res.fallos
                            .slice(0, 3)
                            .map((x) => `línea ${x.linea} (${x.motivo})`)
                            .join("; "),
                      );
                      return;
                    }
                    router.push("/admin/participantes");
                  })
                }
              >
                {ocupado ? "Creando…" : `Crear ${previa.creables} participantes`}
              </Boton>
            ) : (
              <Aviso tipo="error">
                Ninguna fila se puede crear. Corrija la lista y vuelva a pegarla.
              </Aviso>
            )}
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
