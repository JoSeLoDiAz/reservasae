"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { TarjetaCifra } from "@/components/admin/graficos";
import { Aviso, Tarjeta } from "@/components/admin/marco-admin";
import { ErrorApi } from "@/lib/api";

type Brecha = {
  confirmados: number;
  nombres: number;
  brecha: number;
  porAccion: Array<{
    etiqueta: string;
    convenio: string;
    confirmados: number;
    nombres: number;
    brecha: number;
  }>;
  empresas: Array<{
    reservaId: string;
    empresa: { id: string; nit: string; razonSocial: string };
    contacto: string;
    correo: string;
    celular: string | null;
    accion: string;
    ubicacion: string;
    confirmados: number;
    nombres: number;
    faltan: number;
    diasDesdeReserva: number;
  }>;
  empresasTotal: number;
};

export default function PaginaBrecha() {
  const [d, setD] = useState<Brecha | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/participantes/brecha")
      .then(async (r) => {
        if (!r.ok) throw new ErrorApi(r.status, "No se pudo cargar la brecha.", null);
        setD(await r.json());
      })
      .catch((e) => setError((e as ErrorApi).message));
  }, []);

  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!d) return <p className="text-texto-suave">Cargando…</p>;

  const cubierto = d.confirmados > 0 ? Math.round((d.nombres / d.confirmados) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Brecha de nombres</h1>
          <p className="mt-1 text-texto-suave">
            Cupos que una empresa ya reservó y para los que todavía no hay una persona.
          </p>
        </div>
        <Link href="/admin/participantes" className="text-sm underline">
          Ir a inscripciones →
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <TarjetaCifra titulo="Cupos confirmados" valor={d.confirmados} />
        <TarjetaCifra
          titulo="Con nombre"
          valor={d.nombres}
          detalle={`${cubierto} % del total`}
          tono={cubierto >= 80 ? "exito" : "normal"}
        />
        <TarjetaCifra
          titulo="Sin nombre"
          valor={d.brecha}
          detalle="a esto hay que ponerle cara"
          tono={d.brecha > 0 ? "aviso" : "exito"}
        />
      </div>

      {d.brecha === 0 && d.confirmados > 0 && (
        <Aviso tipo="exito">
          Todos los cupos reservados tienen a alguien detrás. Es raro y es buena señal.
        </Aviso>
      )}

      {d.confirmados === 0 && (
        <Tarjeta
          titulo="Todavía no hay cupos reservados"
          descripcion="La brecha aparece cuando las empresas empiecen a reservar."
        >
          <p className="text-sm text-texto-suave">
            Ninguna acción de formación está publicada, así que nadie ha podido reservar
            aún.
          </p>
        </Tarjeta>
      )}

      {d.porAccion.length > 0 && (
        <Tarjeta
          titulo="Por acción de formación"
          descripcion="Dónde se concentra el hueco."
        >
          <div className="caja-scroll overflow-x-auto">
            <table className="tabla-datos">
              <thead>
                <tr>
                  <th>Acción</th>
                  <th>Convenio</th>
                  <th>Confirmados</th>
                  <th>Con nombre</th>
                  <th>Faltan</th>
                </tr>
              </thead>
              <tbody>
                {d.porAccion.map((a) => (
                  <tr key={a.etiqueta}>
                    <td>{a.etiqueta}</td>
                    <td>{a.convenio}</td>
                    <td>{a.confirmados}</td>
                    <td>{a.nombres}</td>
                    <td className={a.brecha > 0 ? "font-medium text-aviso" : ""}>
                      {a.brecha}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}

      {d.empresas.length > 0 && (
        <Tarjeta
          titulo="A quién llamar"
          descripcion={`${d.empresasTotal} reservas esperan nombres. Primero las que más deben.`}
        >
          <div className="caja-scroll overflow-x-auto">
            <table className="tabla-datos">
              <thead>
                <tr>
                  <th>Organización</th>
                  <th>Contacto</th>
                  <th>Acción</th>
                  <th>Ubicación</th>
                  <th>Faltan</th>
                  <th>Días</th>
                </tr>
              </thead>
              <tbody>
                {d.empresas.map((e) => (
                  <tr key={e.reservaId}>
                    <td>
                      <p className="font-medium">{e.empresa.razonSocial}</p>
                      <p className="font-mono text-xs text-texto-suave">
                        {e.empresa.nit}
                      </p>
                    </td>
                    <td>
                      <p>{e.contacto}</p>
                      <p className="text-xs text-texto-suave">{e.correo}</p>
                      {e.celular && (
                        <p className="text-xs text-texto-suave">{e.celular}</p>
                      )}
                    </td>
                    <td>{e.accion}</td>
                    <td>{e.ubicacion}</td>
                    <td className="font-medium">
                      {e.faltan} de {e.confirmados}
                    </td>
                    <td>{e.diasDesdeReserva}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {d.empresasTotal > d.empresas.length && (
            <p className="mt-3 text-sm text-texto-suave">
              Mostrando las {d.empresas.length} que más deben, de {d.empresasTotal}.
            </p>
          )}
        </Tarjeta>
      )}
    </div>
  );
}
