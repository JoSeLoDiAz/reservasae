"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { columnasDeParticipante } from "@/components/admin/columnas-participante";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import { Aviso, CLASE_CONTROL, Tarjeta } from "@/components/admin/marco-admin";
import { Esqueleto } from "@/components/admin/piezas";
import { Tabla } from "@/components/admin/tabla";
import { useDatosVivos } from "@/lib/datos-vivos";
import {
  crmApi,
  type Etapa,
  ETIQUETA_ETAPA,
  type Listado,
  type Resumen,
} from "@/lib/crm-api";

/// Ya tienen silla: el tramo entre captura y aula.
const ETAPAS: Etapa[] = ["MATRICULADO", "EN_FORMACION", "CERTIFICADO"];

type Datos = { listado: Listado; resumen: Resumen };

export default function PaginaInscritos() {
  const [etapa, setEtapa] = useState<Etapa>("MATRICULADO");
  const [buscar, setBuscar] = useState("");

  const cargar = useCallback(async (): Promise<Datos> => {
    const filtros = { etapa, buscar: buscar || undefined };
    const [listado, resumen] = await Promise.all([
      crmApi.listar({ ...filtros, pagina: 1, limite: 300 }),
      crmApi.resumen({ buscar: buscar || undefined }),
    ]);
    return { listado, resumen };
  }, [etapa, buscar]);

  const vivos = useDatosVivos<Datos>(cargar, { clave: `${etapa}|${buscar}` });
  const columnas = useMemo(() => columnasDeParticipante(), []);

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto conCifras />;

  const { listado, resumen } = vivos.datos;
  const cuenta = new Map(resumen.etapas.map((e) => [e.etapa, e.total]));
  const total = ETAPAS.reduce((s, e) => s + (cuenta.get(e) ?? 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inscritos</h1>
          <p className="mt-1 text-texto-suave">
            Quien ya tiene silla asignada. {total} en total.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <IndicadorActualizacion
            actualizadoEn={vivos.actualizadoEn}
            refrescando={vivos.refrescando}
            desactualizado={vivos.desactualizado}
            alRefrescar={vivos.refrescar}
          />
          <Link href="/admin/participantes/academico" className="underline">
            Seguimiento académico
          </Link>
        </div>
      </header>

      <p className="text-sm text-texto-suave">
        Es el tramo entre capturar el nombre y el aula: aquí la persona ya tiene oferta y
        grupo, y de aquí sale la matrícula que se reporta. Quien todavía no llegó está en{" "}
        <Link href="/admin/participantes" className="underline">
          Inscripciones
        </Link>
        .
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${CLASE_CONTROL} max-w-xs`}
          placeholder="Buscar por nombre, documento o correo"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <div className="flex rounded-lg border border-borde">
          {ETAPAS.map((e) => (
            <button
              key={e}
              onClick={() => setEtapa(e)}
              className={`px-4 py-2 text-sm ${
                etapa === e ? "bg-marca text-marca-texto" : "text-texto-suave"
              }`}
            >
              {ETIQUETA_ETAPA[e]}{" "}
              <span className="font-mono text-xs">({cuenta.get(e) ?? 0})</span>
            </button>
          ))}
        </div>
      </div>

      {listado.participantes.length === 0 ? (
        <Tarjeta
          titulo={`Nadie en «${ETIQUETA_ETAPA[etapa]}»`}
          descripcion="Se llega aquí matriculando desde la ficha de la persona."
        >
          <p className="text-sm text-texto-suave">
            Matricular pide dos cosas: autorización del titular y oferta asignada. El grupo y
            sus fechas avisan, pero no bloquean.
          </p>
        </Tarjeta>
      ) : (
        <Tabla
          id="inscritos"
          columnas={columnas}
          filas={listado.participantes}
          clave={(f) => f.id}
          total={listado.total}
        />
      )}

    </div>
  );
}
