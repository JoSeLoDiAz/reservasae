"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Aviso, Boton, CLASE_CONTROL, Tarjeta } from "@/components/admin/marco-admin";
import { adminApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import { descargarSep, sepApi, type Alistamiento } from "@/lib/sep-api";

type Convenio = { id: string; nombre: string; sigla: string | null; activo: boolean };

export default function PaginaSep() {
  const [convenios, setConvenios] = useState<Convenio[] | null>(null);
  const [convenioId, setConvenioId] = useState("");
  const [datos, setDatos] = useState<Alistamiento | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void adminApi
      .convenios()
      .then((lista) => {
        const activos = lista.filter((c) => c.activo);
        setConvenios(activos);
        if (activos.length > 0) setConvenioId(activos[0].id);
      })
      .catch((e) => setError((e as ErrorApi).message));
  }, []);

  const cargar = useCallback(async () => {
    if (!convenioId) return;
    setError(null);
    try {
      setDatos(await sepApi.alistamiento(convenioId));
    } catch (e) {
      setDatos(null);
      setError((e as ErrorApi).message);
    }
  }, [convenioId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Reportes al SENA</h1>
        <p className="mt-1 text-texto-suave">
          Quién entra en el archivo y quién no, antes de generarlo.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="flex flex-wrap items-center gap-3">
        <select
          className={`${CLASE_CONTROL} max-w-sm`}
          value={convenioId}
          onChange={(e) => setConvenioId(e.target.value)}
          aria-label="Convenio"
        >
          {(convenios ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.sigla ?? c.nombre}
            </option>
          ))}
        </select>
        <span className="text-sm text-texto-suave">
          Un archivo por convenio: el SEP nunca ha visto uno con los dos.
        </span>
      </div>

      {datos && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-exito/30 bg-exito-suave p-5">
              <p className="text-sm font-medium text-exito">Entran en el archivo</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-exito">
                {datos.listos}
              </p>
            </div>
            <div className="rounded-2xl border border-aviso/30 bg-aviso-suave p-5">
              <p className="text-sm font-medium text-aviso">Se quedan fuera</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-aviso">
                {datos.noListos}
              </p>
            </div>
          </div>

          <Tarjeta
            titulo="Descargar"
            descripcion="El de control es para revisar y pasar; el del SEP es el que se sube. Las filas que no están listas no salen con huecos: van en una segunda hoja, con su motivo."
          >
            <div className="flex flex-wrap gap-3">
              <Boton
                disabled={datos.listos === 0}
                onClick={() => descargarSep(convenioId, "uso-directo")}
              >
                Reporte de control
              </Boton>
              <Boton
                disabled={datos.listos === 0}
                onClick={() => descargarSep(convenioId, "cargue-sep")}
              >
                Reporte al SEP
              </Boton>
            </div>
            {datos.listos === 0 && (
              <p className="mt-3 text-sm text-texto-suave">
                Nadie está listo todavía: no tiene sentido bajar un archivo vacío.
              </p>
            )}
          </Tarjeta>

          {datos.motivos.length > 0 && (
            <Tarjeta
              titulo="Por qué no entran"
              descripcion="Ordenado por cuánta gente arregla cada cosa."
            >
              <div className="space-y-2">
                {datos.motivos.map((m) => (
                  <div
                    key={m.motivo}
                    className="grid grid-cols-[1fr_3rem] items-center gap-3 text-sm"
                  >
                    <span>{m.motivo}</span>
                    <span className="text-right font-mono text-texto-suave">{m.total}</span>
                  </div>
                ))}
              </div>
            </Tarjeta>
          )}

          {datos.personas.length > 0 && (
            <div className="caja-scroll overflow-x-auto">
              <table className="tabla-datos">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Nombre</th>
                    <th>Etapa</th>
                    <th>Qué le falta</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.personas.map((p) => (
                    <tr key={p.documento + p.nombre}>
                      <td className="font-mono text-sm">{p.documento}</td>
                      <td>{p.nombre}</td>
                      <td className="text-sm">{p.etapa}</td>
                      <td className="text-sm">{p.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-sm text-texto-suave">
                Se arreglan desde la ficha de cada persona, en{" "}
                <Link href="/admin/inscritos" className="underline">
                  Inscritos
                </Link>
                .
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
