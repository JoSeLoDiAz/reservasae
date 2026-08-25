"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AccionesDePagina, Aviso, CLASE_CONTROL, Tarjeta } from "@/components/admin/marco-admin";
import { CajonLead } from "@/components/admin/cajon-lead";
import { columnasDeParticipante } from "@/components/admin/columnas-participante";
import { Tabla } from "@/components/admin/tabla";
import { ErrorApi } from "@/lib/api";
import {
  crmApi,
  type FilaParticipante,
  type Filtros,
  type Resumen,
} from "@/lib/crm-api";

// el tablero reparte una carga entre nueve columnas
const POR_CARGA = 300;

export default function PaginaParticipantes() {
  const [filas, setFilas] = useState<FilaParticipante[] | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const filtros = useMemo<Filtros>(
    () => ({
      // Inscripciones acaba al marcar «Inscrito»: de ahi
      // en adelante manda el seguimiento academico
      tramo: "INSCRIPCION",
    }),
    [],
  );

  const cargar = useCallback(async () => {
    const [listado, res] = await Promise.all([
      crmApi.listar({ ...filtros, pagina: 1, limite: POR_CARGA }),
      crmApi.resumen(filtros),
    ]);
    setFilas(listado.participantes);
    setTotal(listado.total);
    setPaginas(listado.paginas);
    setResumen(res);
  }, [filtros]);

  // asignar por criterio necesita tenerlas todas
  const cargarTodas = useCallback(async () => {
    if (paginas <= 1) return;
    const resto = await Promise.all(
      Array.from({ length: paginas - 1 }, (_, i) =>
        crmApi.listar({ ...filtros, pagina: i + 2, limite: POR_CARGA }),
      ),
    );
    // por id: dos clics no pueden duplicar una fila
    setFilas((f) => {
      const unicas = new Map((f ?? []).map((x) => [x.id, x]));
      for (const x of resto.flatMap((r) => r.participantes)) unicas.set(x.id, x);
      return [...unicas.values()];
    });
  }, [filtros, paginas]);

  useEffect(() => {
    void cargar().catch((e) => setError((e as ErrorApi).message));
  }, [cargar]);


  if (!filas || !resumen) {
    return <p className="text-texto-suave">Cargando…</p>;
  }

  const hayAlguien = resumen.total > 0;
  const hayFiltro = false;


  return (
    <div className="flex min-h-0 grow flex-col gap-6">
      <AccionesDePagina>
        <Link href="/admin/participantes/academico" className="text-sm underline">
          Seguimiento académico
        </Link>
        <Link href="/admin/participantes/carga" className="text-sm underline">
          Cargar una lista
        </Link>
        <Link href="/admin/participantes/nuevo" className="text-sm underline">
          Inscribir a alguien
        </Link>
      </AccionesDePagina>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {/* El orden es el del tablero de abajo: se filtra por lo
          que se esta mirando. El buscador no va aqui, va con la
          lista, que es donde se busca a una persona concreta. */}

      {!hayAlguien && (
        <Tarjeta
          titulo={hayFiltro ? "Nadie coincide con ese filtro" : "Todavía no hay nadie inscrito"}
          descripcion={
            hayFiltro
              ? "Pruebe a quitar alguno."
              : "Aquí van a aparecer las personas conforme se capturen."
          }
        >
          <p className="text-sm text-texto-suave">
            El sistema hoy sabe cuántos cupos reservó cada empresa, pero no quiénes son.
            Ese es exactamente el hueco que cierra esta pantalla.
          </p>
        </Tarjeta>
      )}


      {hayAlguien && (
        <div className="flex min-h-0 grow flex-col">
          <ListaParticipantes
            filas={filas}
            total={total}
            asesores={resumen.asesores}
            alCambiar={cargar}
            alCargarTodo={filas.length < total ? cargarTodas : undefined}
          />
        </div>
      )}

    </div>
  );
}

// las cifras de arriba
/** La lista, con columnas a elegir y asignación por lote. */
function ListaParticipantes({
  filas,
  total,
  asesores,
  alCambiar,
  alCargarTodo,
}: {
  filas: FilaParticipante[];
  total: number;
  asesores: Array<{ id: string; nombre: string }>;
  alCambiar: () => Promise<void>;
  alCargarTodo?: () => void;
}) {
  const [aviso, setAviso] = useState<string | null>(null);
  /// El lead abierto en el panel lateral. Se guarda la fila
  /// entera y no el id: el panel pinta al instante con lo que
  /// ya se trajo, y termina de llenarse cuando llega la ficha.
  const [abierto, setAbierto] = useState<FilaParticipante | null>(null);

  const columnas = useMemo(() => columnasDeParticipante(), []);

  return (
    <div className="flex min-h-0 grow flex-col gap-3">
      {aviso && <Aviso tipo="exito">{aviso}</Aviso>}

      {abierto && (
        <CajonLead
          fila={abierto}
          alCerrar={() => setAbierto(null)}
          alGuardar={() => void alCambiar()}
        />
      )}

      <Tabla
        id="participantes"
        columnas={columnas}
        filas={filas}
        clave={(f) => f.id}
        total={total}
        alClic={(f) => setAbierto(f)}
        alCargarTodo={alCargarTodo}
        seleccion
        accionesLote={(ids, limpiar) => (
          <AsignarLote
            ids={ids}
            asesores={asesores}
            alTerminar={async (n) => {
              limpiar();
              setAviso(`${n} ${n === 1 ? "ficha" : "fichas"} con asesor nuevo.`);
              await alCambiar();
            }}
          />
        )}
      />
    </div>
  );
}

/** El desplegable de asesor sobre la selección. */
function AsignarLote({
  ids,
  asesores,
  alTerminar,
}: {
  ids: string[];
  asesores: Array<{ id: string; nombre: string }>;
  alTerminar: (cambiadas: number) => Promise<void>;
}) {
  const [trabajando, setTrabajando] = useState(false);

  async function asignar(asesorId: string | null) {
    setTrabajando(true);
    try {
      const r = await crmApi.asignarAsesorEnLote(ids, asesorId);
      await alTerminar(r.cambiadas);
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="whitespace-nowrap">Asignar a</span>
      <select
        disabled={trabajando}
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value;
          e.currentTarget.value = "";
          if (v === "") return;
          void asignar(v === "NADIE" ? null : v);
        }}
        className={`${CLASE_CONTROL} max-w-[13rem] py-1.5 text-sm`}
      >
        <option value="">Elija un asesor…</option>
        {asesores.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nombre}
          </option>
        ))}
        <option value="NADIE">— Quitarles el asesor —</option>
      </select>
    </label>
  );
}
