"use client";

/** Las cuentas: las empresas con las que hay o hubo negocio. */

/**
 * La lista de EMPRESAS, no de negocios. «Leads de empresas» lista
 * negocios —una empresa con tres cotizaciones sale tres veces—; aquí
 * cada empresa sale una vez, con lo que tiene abierto, lo ganado y lo
 * facturado, y lleva a su ficha.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { CLASE_CONTROL } from "@/components/admin/marco-admin";
import { Cargando } from "@/components/admin/piezas";
import { AvisoDeSeccion, CabeceraDePantalla, Seccion } from "@/components/admin/secciones";
import { Dinero } from "@/components/admin/datos-del-negocio";
import { ErrorApi } from "@/lib/api";
import { cuentasApi, type CuentaEnLista } from "@/lib/cuentas-api";

export default function PaginaCuentas() {
  const [filas, setFilas] = useState<CuentaEnLista[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");

  useEffect(() => {
    let vivo = true;
    /// Espera un momento al teclear: buscar en cada letra mandaría
    /// una consulta por pulsación.
    const t = setTimeout(() => {
      cuentasApi
        .listar(buscar)
        .then((r) => {
          if (vivo) {
            setFilas(r);
            setError(null);
          }
        })
        .catch((e) => {
          if (vivo) setError(e instanceof ErrorApi ? e.message : "No pudimos traer las empresas.");
        });
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [buscar]);

  return (
    <div className="flex min-h-0 grow flex-col">
      <CabeceraDePantalla
        titulo="Empresas"
        nota="Cada empresa una sola vez, con lo que tiene abierto, lo ganado y lo facturado. Ábrala para ver sus contactos y todos sus negocios."
      />
      {error && <AvisoDeSeccion color="var(--texto-suave)">{error}</AvisoDeSeccion>}
      <Seccion>
        <div className="px-6 pt-5 pb-6">
          <input
            type="search"
            aria-label="Buscar empresa"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por razón social o NIT"
            className={`${CLASE_CONTROL} max-w-md`}
          />
          {!filas && !error && (
            <div className="py-6">
              <Cargando que="Trayendo las empresas…" />
            </div>
          )}
          {filas && filas.length === 0 && (
            <p className="mt-4 text-[0.8125rem] text-texto-suave">
              {buscar ? "Ninguna empresa coincide con la búsqueda." : "Todavía no hay empresas con negocios."}
            </p>
          )}
          {filas && filas.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="tabla-datos w-full">
                <thead>
                  <tr>
                    <th className="text-left">Empresa</th>
                    <th className="text-left">NIT</th>
                    <th className="text-right">Negocios</th>
                    <th className="text-right">Cotizado abierto</th>
                    <th className="text-right">Ganado</th>
                    <th className="text-right">Facturado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/cuentas/${c.id}`} className="text-texto hover:underline">
                          {c.razonSocial}
                        </Link>
                        {c.contactoNombre && (
                          <span className="block text-[0.71875rem] text-texto-suave">{c.contactoNombre}</span>
                        )}
                      </td>
                      <td className="tabular-nums">
                        {c.nit}
                        {c.digitoVerificacion ? `-${c.digitoVerificacion}` : ""}
                      </td>
                      <td className="text-right tabular-nums">
                        {c.abiertos} de {c.negocios}
                      </td>
                      <td className="text-right"><Dinero valor={c.valorAbierto} /></td>
                      <td className="text-right"><Dinero valor={c.ganado} /></td>
                      <td className="text-right"><Dinero valor={c.facturado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Seccion>
    </div>
  );
}
