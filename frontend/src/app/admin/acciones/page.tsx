"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Aviso, Tarjeta } from "@/components/admin/marco-admin";
import { adminApi, type AccionAdmin } from "@/lib/admin-api";
import { bonito, ErrorApi } from "@/lib/api";

const MODALIDAD = {
  PRESENCIAL: "Presencial",
  VIRTUAL: "Virtual",
  HIBRIDA: "Híbrido",
} as const;

export default function PaginaAcciones() {
  const [acciones, setAcciones] = useState<AccionAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setAcciones(await adminApi.acciones());
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function alternar(accion: AccionAdmin) {
    setError(null);
    setOcupada(accion.id);
    try {
      await adminApi.publicarAccion(accion.id, !accion.visible);
      await cargar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupada(null);
    }
  }

  const porConvenio = new Map<string, AccionAdmin[]>();
  for (const a of acciones ?? []) {
    porConvenio.set(a.convenio, [...(porConvenio.get(a.convenio) ?? []), a]);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Formación</h1>
        <p className="mt-1 text-texto-suave">
          Publique u oculte cada acción. Ocultar no cancela nada: las reservas
          hechas siguen vivas y contando, la acción solo desaparece del sitio
          público.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {!acciones && <p className="text-texto-suave">Cargando…</p>}

      {[...porConvenio.entries()].map(([convenio, lista]) => (
        <Tarjeta
          key={convenio}
          titulo={lista[0].convenioSigla ?? convenio}
          descripcion={`/${convenio} · ${lista.filter((a) => a.visible).length} de ${lista.length} publicadas`}
        >
          <ul className="divide-y divide-borde">
            {lista.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-x-4 gap-y-3 py-4">
                <div className="min-w-64 grow">
                  <Link
                    href={`/admin/acciones/${a.id}`}
                    className="font-medium leading-snug hover:text-marca hover:underline"
                  >
                    {bonito(a.nombre)}
                  </Link>
                  <p className="mt-1 text-sm text-texto-suave">
                    {a.codigo} · {a.evento} {MODALIDAD[a.modalidad].toLowerCase()}
                    {a.horas ? ` · ${a.horas} h` : ""} · {a.ofertas} ubicaciones
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="text-texto-suave">
                      {a.cuposOcupados} de {a.cuposMaximos} cupos reservados
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      a.visible
                        ? "bg-exito-suave text-exito"
                        : "bg-fondo text-texto-suave"
                    }`}
                  >
                    {a.visible ? "Publicada" : "Oculta"}
                  </span>
                  <button
                    onClick={() => alternar(a)}
                    disabled={ocupada === a.id}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                      a.visible
                        ? "border border-borde hover:bg-fondo"
                        : "bg-marca text-marca-texto hover:bg-marca-fuerte"
                    }`}
                  >
                    {ocupada === a.id ? "…" : a.visible ? "Ocultar" : "Publicar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
      ))}
    </div>
  );
}
