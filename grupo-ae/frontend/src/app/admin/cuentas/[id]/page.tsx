"use client";

/** La ficha de una empresa: sus datos, su gente y todos sus negocios. */

/**
 * Lo que el asesor quiere tener delante antes de llamar a una empresa:
 * a quién llamar, qué se le ha cotizado, qué se ganó y qué se facturó.
 * Los datos de contacto se completan aquí mismo; el NIT y la razón
 * social no, porque vienen del RUES y la búsqueda por NIT depende de
 * ellos.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CLASE_CONTROL, useAdmin } from "@/components/admin/marco-admin";
import { Cargando } from "@/components/admin/piezas";
import { AvisoDeSeccion, CabeceraDePantalla, Seccion } from "@/components/admin/secciones";
import { Codigo, Dinero, Etapa, Rotulo } from "@/components/admin/datos-del-negocio";
import { ROTULO_ETAPA } from "@/components/admin/cajon-oportunidad";
import { alcanza } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import { cuentasApi, type CambioDeCuenta, type FichaDeCuenta } from "@/lib/cuentas-api";

const CAMPOS: Array<{ clave: keyof CambioDeCuenta; rotulo: string; tipo?: string }> = [
  { clave: "contactoNombre", rotulo: "Contacto principal" },
  { clave: "contactoCargo", rotulo: "Cargo" },
  { clave: "contactoCorreo", rotulo: "Correo del contacto", tipo: "email" },
  { clave: "telefono", rotulo: "Teléfono" },
  { clave: "direccion", rotulo: "Dirección" },
  { clave: "sectorEconomico", rotulo: "Sector" },
];

export default function FichaDeEmpresa() {
  const { id } = useParams<{ id: string }>();
  const { admin } = useAdmin();
  const puedeEditar =
    admin.rol === "SUPERADMIN" || alcanza(admin.permisos?.inscripciones, "ESCRIBIR");

  const [ficha, setFicha] = useState<FichaDeCuenta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setFicha(await cuentasApi.ficha(id));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No pudimos traer la empresa.");
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  async function guardar(campo: keyof CambioDeCuenta, valor: string) {
    setError(null);
    setGuardado(null);
    try {
      setFicha(await cuentasApi.actualizar(id, { [campo]: valor.trim() || null }));
      setGuardado("Cambio guardado.");
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No pudimos guardar el cambio.");
    }
  }

  if (!ficha) {
    return (
      <div className="flex min-h-0 grow flex-col">
        <CabeceraDePantalla titulo="Empresa" />
        {error ? (
          <AvisoDeSeccion color="var(--texto-suave)">{error}</AvisoDeSeccion>
        ) : (
          <Seccion>
            <div className="px-6 py-8">
              <Cargando que="Abriendo la empresa…" />
            </div>
          </Seccion>
        )}
      </div>
    );
  }

  const { empresa, cifras, contactos, negocios } = ficha;
  /// Lo que se edita sale siempre de la propia empresa, no de la
  /// lista de contactos: esa lista junta gente de varios sitios.
  const valorDe = (clave: keyof CambioDeCuenta): string => {
    const v = (empresa as Record<string, unknown>)[clave];
    return v === null || v === undefined ? "" : String(v);
  };

  return (
    <div className="flex min-h-0 grow flex-col">
      <CabeceraDePantalla
        titulo={empresa.razonSocial}
        nota={`NIT ${empresa.nit}${empresa.digitoVerificacion ? `-${empresa.digitoVerificacion}` : ""}${
          empresa.numeroColaboradores ? ` · ${empresa.numeroColaboradores} colaboradores` : ""
        }`}
        acciones={
          <Link href="/admin/cuentas" className="estado text-marca hover:underline">
            ← Todas las empresas
          </Link>
        }
      />
      {error && <AvisoDeSeccion color="var(--texto-suave)">{error}</AvisoDeSeccion>}
      {guardado && !error && <AvisoDeSeccion color="var(--exito)">{guardado}</AvisoDeSeccion>}

      <Seccion>
        <div className="grid gap-6 px-6 pt-5 pb-6 sm:grid-cols-4">
          <Cifra rotulo="Negocios abiertos" texto={`${cifras.abiertos} de ${cifras.negocios}`} />
          <Cifra rotulo="Cotizado abierto" valor={cifras.valorAbierto} />
          <Cifra rotulo="Ganado" valor={cifras.ganado} />
          <Cifra rotulo="Facturado" valor={cifras.facturado} />
        </div>
      </Seccion>

      <Seccion>
        <div className="grid gap-8 px-6 pt-5 pb-6 @container lg:grid-cols-2">
          <section>
            <Rotulo>A quién llamar</Rotulo>
            {contactos.length === 0 ? (
              <p className="mt-2 text-[0.8125rem] text-texto-suave">
                Sin contactos todavía. Escriba el contacto principal a la derecha.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col">
                {contactos.map((c, i) => (
                  <li key={c.id ?? `ficha-${i}`} className="border-t border-hairline py-2 first:border-0">
                    <span className="block text-[0.8125rem] text-texto">
                      {c.nombre}
                      {c.cargo ? <span className="text-texto-suave"> · {c.cargo}</span> : null}
                    </span>
                    <span className="block text-[0.71875rem] text-texto-suave">
                      {[c.correo, c.celular].filter(Boolean).join(" · ") || "Sin correo ni celular"}
                      {c.negocios > 0 ? ` · en ${c.negocios} ${c.negocios === 1 ? "negocio" : "negocios"}` : " · contacto de la ficha"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <Rotulo>Datos de la empresa</Rotulo>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {CAMPOS.map((c) => (
                <label key={c.clave} className="flex flex-col gap-1">
                  <span className="rotulo-bloque">{c.rotulo}</span>
                  {puedeEditar ? (
                    <input
                      type={c.tipo ?? "text"}
                      defaultValue={valorDe(c.clave)}
                      /// Se guarda al salir del campo, si cambió.
                      onBlur={(e) => {
                        if (e.target.value.trim() !== valorDe(c.clave)) void guardar(c.clave, e.target.value);
                      }}
                      className={CLASE_CONTROL}
                    />
                  ) : (
                    <span className="text-[0.8125rem] text-texto">{valorDe(c.clave) || "—"}</span>
                  )}
                </label>
              ))}
            </div>
          </section>
        </div>
      </Seccion>

      <Seccion>
        <div className="px-6 pt-5 pb-6">
          <Rotulo>Negocios</Rotulo>
          <div className="mt-3 overflow-x-auto">
            <table className="tabla-datos w-full">
              <thead>
                <tr>
                  <th className="text-left">Negocio</th>
                  <th className="text-left">Etapa</th>
                  <th className="text-left">Servicio</th>
                  <th className="text-right">Cotizado</th>
                  <th className="text-right">Facturado</th>
                  <th className="text-left">Asesor</th>
                </tr>
              </thead>
              <tbody>
                {negocios.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <Link
                        href={`/admin/embudo?abrir=${n.id}&embudo=${n.embudo}`}
                        className="text-texto hover:underline"
                      >
                        <Codigo>{n.codigo}</Codigo> {n.titulo}
                      </Link>
                    </td>
                    <td>
                      <Etapa etapa={n.etapa} rotulo={ROTULO_ETAPA[n.etapa]} />
                    </td>
                    <td className="text-texto-suave">
                      {n.servicio
                        ? `${n.cantidad ? `${n.cantidad} · ` : ""}${n.servicio.nombre}`
                        : "Sin servicio"}
                    </td>
                    <td className="text-right"><Dinero valor={n.valor} /></td>
                    <td className="text-right">
                      {n.valorFacturado === null ? (
                        <span className="text-texto-suave">—</span>
                      ) : (
                        <Dinero valor={n.valorFacturado} />
                      )}
                    </td>
                    <td className="text-texto-suave">{n.asesor?.nombre ?? "Sin asesor"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Seccion>
    </div>
  );
}

function Cifra({ rotulo, valor, texto }: { rotulo: string; valor?: number; texto?: string }) {
  return (
    <div>
      <Rotulo>{rotulo}</Rotulo>
      <p className="mt-1 text-[1.125rem] text-texto tabular-nums">
        {texto ?? <Dinero valor={valor ?? 0} />}
      </p>
    </div>
  );
}

