"use client";

import { useCallback, useEffect, useState } from "react";

import { n } from "@/components/admin/graficos";
import { Aviso, CLASE_CONTROL, Tarjeta } from "@/components/admin/marco-admin";
import { bonito, ErrorApi } from "@/lib/api";
import { descargar, tablerosApi, type FilaEmpresa } from "@/lib/tableros-api";

/**
 * «Cuántos cupos lleva cada empresa» fue una petición explícita del cliente:
 * es la vista que responde de un vistazo quién está copando la oferta.
 */
export default function PaginaEmpresas() {
  const [filas, setFilas] = useState<FilaEmpresa[] | null>(null);
  const [buscar, setBuscar] = useState("");
  const [textoBuscado, setTextoBuscado] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setFilas(await tablerosApi.empresas(textoBuscado));
      setError(null);
    } catch (e) {
      setError((e as ErrorApi).message);
    }
  }, [textoBuscado]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const totalCupos = filas?.reduce((s, f) => s + f.confirmados, 0) ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Organizaciones</h1>
          <p className="mt-1 text-texto-suave">
            {filas
              ? `${n(filas.length)} organizaciones · ${n(totalCupos)} cupos confirmados`
              : "Cargando…"}
          </p>
        </div>
        <button
          onClick={() => descargar("empresas", { buscar: textoBuscado })}
          className="rounded-lg bg-marca px-4 py-2 text-sm font-medium text-marca-texto transition hover:bg-marca-fuerte"
        >
          Descargar en Excel
        </button>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <Tarjeta titulo="Cupos por organización" descripcion="Ordenadas por cupos confirmados.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTextoBuscado(buscar);
          }}
          className="mb-4 flex flex-wrap gap-3"
        >
          <input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Nombre o NIT"
            className={`${CLASE_CONTROL} min-w-56 flex-1 sm:max-w-md`}
          />
          <button
            type="submit"
            className="rounded-lg border border-borde px-5 py-2 text-sm font-medium hover:bg-superficie-alterna"
          >
            Buscar
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="tabla-datos text-sm">
            <thead>
              <tr>
                <th>NIT</th>
                <th>Organización</th>
                <th>Gremio</th>
                <th className="text-right">Colaboradores</th>
                <th className="text-right">Reservas</th>
                <th className="text-right">Confirmados</th>
                <th className="text-right">En espera</th>
                <th>Cursos</th>
              </tr>
            </thead>
            <tbody>
              {filas?.map((f) => (
                <tr key={f.id}>
                  <td className="whitespace-nowrap font-mono text-xs">
                    {f.nit}
                    {f.digitoVerificacion ? `-${f.digitoVerificacion}` : ""}
                  </td>
                  <td className="font-medium">{bonito(f.razonSocial)}</td>
                  <td className="whitespace-nowrap text-texto-suave">
                    {f.redAsociada === "Otro"
                      ? (f.redAsociadaOtra ?? "Otro")
                      : (f.redAsociada ?? "—")}
                  </td>
                  <td className="text-right tabular-nums text-texto-suave">
                    {f.numeroColaboradores ? n(f.numeroColaboradores) : "—"}
                  </td>
                  <td className="text-right tabular-nums">{f.reservas}</td>
                  <td className="text-right font-medium tabular-nums">{n(f.confirmados)}</td>
                  <td className="text-right tabular-nums">
                    {f.enEspera > 0 ? (
                      <span className="text-aviso">{n(f.enEspera)}</span>
                    ) : (
                      <span className="text-texto-suave">—</span>
                    )}
                  </td>
                  <td className="font-mono text-xs text-texto-suave">{f.cursos.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filas && filas.length === 0 && (
          <p className="py-8 text-center text-sm text-texto-suave">
            {textoBuscado
              ? "Ninguna organización coincide con la búsqueda."
              : "Todavía no hay organizaciones registradas."}
          </p>
        )}
      </Tarjeta>
    </div>
  );
}
