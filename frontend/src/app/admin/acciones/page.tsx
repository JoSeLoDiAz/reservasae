"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Aviso, Tarjeta } from "@/components/admin/marco-admin";
import { Esqueleto } from "@/components/admin/piezas";
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
    <div>
      <header className="border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px]">
        <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">Formación</h1>
        <p className="mt-1 text-texto-suave">
          Publique u oculte cada acción. Ocultar no cancela nada: las reservas
          hechas siguen vivas y contando, la acción solo desaparece del sitio
          público.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {!acciones && <Esqueleto filas={5} />}

      {[...porConvenio.entries()].map(([convenio, lista]) => (
        <Tarjeta
          key={convenio}
          titulo={lista[0].convenioSigla ?? convenio}
          descripcion={`/${convenio} · ${lista.filter((a) => a.visible).length} de ${lista.length} publicadas`}
        >
          {/* La fila del redisenio: el CODIGO en su propia
              columna a la izquierda, el nombre, el detalle
              debajo, y a la derecha la barra de ocupacion con
              su cifra. El codigo iba metido en medio de la
              linea de detalle -- «AF1 · CURSO virtual · 40 h» --
              y ahi no sirve para buscar: uno recorre la columna
              de codigos con el dedo, no lee la frase. */}
          <ul className="divide-y divide-hairline">
            {lista.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <div className="w-[30px] shrink-0 text-[0.65625rem] font-semibold tracking-[0.05em] text-texto-suave">
                  {a.codigo}
                </div>
                <div className="min-w-64 grow">
                  <Link
                    href={`/admin/acciones/${a.id}`}
                    className="text-[0.84375rem] font-semibold leading-snug text-titulo no-underline hover:text-marca"
                  >
                    {bonito(a.nombre)}
                  </Link>
                  <p className="mt-0.5 text-[0.71875rem] text-texto-suave">
                    {a.evento} {MODALIDAD[a.modalidad].toLowerCase()}
                    {a.horas ? ` · ${a.horas} h` : ""} · {a.ofertas} ubicaciones
                  </p>
                </div>

                {/* Cuanto lleva lleno. La proporcion se ve, el
                    numero se lee: hacen falta los dos. */}
                <div className="h-1 w-[130px] shrink-0 overflow-hidden rounded-full bg-superficie-alterna">
                  <div
                    className="h-full rounded-full bg-marca"
                    style={{
                      width: `${Math.min(100, a.cuposMaximos ? (a.cuposOcupados / a.cuposMaximos) * 100 : 0)}%`,
                    }}
                  />
                </div>
                <div className="w-[132px] shrink-0 text-right text-[0.75rem] tabular-nums text-texto">
                  {a.cuposOcupados} de {a.cuposMaximos} cupos
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`w-[68px] text-[0.75rem] font-semibold whitespace-nowrap ${
                      a.visible ? "text-exito" : "text-texto-suave"
                    }`}
                  >
                    {a.visible ? "Publicada" : "Oculta"}
                  </span>
                  <button
                    onClick={() => alternar(a)}
                    disabled={ocupada === a.id}
                    className={`h-[30px] rounded-lg px-3 text-[0.75rem] font-semibold transition disabled:opacity-50 ${
                      a.visible
                        ? "border border-borde bg-superficie hover:bg-superficie-alterna"
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
