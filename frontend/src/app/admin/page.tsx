"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { BotonPdf, EncabezadoImpresion } from "@/components/admin/boton-pdf";
import {
  BarraAvance,
  BarrasAgrupadas,
  BarrasPorDia,
  EtiquetaEstado,
  ListaBarras,
  Medidor,
  n,
  SERIE,
} from "@/components/admin/graficos";
import {
  IndicadorActualizacion,
  SelloDeDatos,
} from "@/components/admin/indicador-actualizacion";
import { Aviso, Tarjeta, useAdmin } from "@/components/admin/marco-admin";
import { BloqueRitmo, TablaRitmo } from "@/components/admin/ritmo";
import { bonito } from "@/lib/api";
import { useDatosVivos } from "@/lib/datos-vivos";
import {
  descargar,
  tablerosApi,
  type Analisis,
  type FilaAccion,
  type FilaUbicacion,
  type Resumen,
} from "@/lib/tableros-api";

const MODALIDAD: Record<string, string> = {
  PRESENCIAL: "Presencial",
  VIRTUAL: "Virtual",
  HIBRIDA: "Híbrido",
};

export default function Tablero() {
  const { admin } = useAdmin();

  const vivos = useDatosVivos(
    useCallback(
      async () => {
        const [resumen, acciones, analisis, ubicaciones, serie, proyeccion] =
          await Promise.all([
            tablerosApi.resumen(),
            tablerosApi.acciones(),
            tablerosApi.analisis(),
            tablerosApi.ubicaciones(),
            tablerosApi.serie(30),
            tablerosApi.proyeccion(14),
          ]);
        return { resumen, acciones, analisis, ubicaciones, serie, proyeccion };
      },
      [],
    ),
  );

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <p className="text-texto-suave">Cargando…</p>;

  const { resumen, acciones, analisis, ubicaciones, serie, proyeccion } = vivos.datos;

  const porConvenio = new Map<string, FilaAccion[]>();
  for (const a of acciones) {
    porConvenio.set(a.convenio, [...(porConvenio.get(a.convenio) ?? []), a]);
  }

  const completas = ubicaciones.filter((u) => u.estado === "COMPLETO").length;
  const ultimos = ubicaciones.filter((u) => u.estado === "ULTIMOS_CUPOS").length;

  return (
    <div className="space-y-6">
      <EncabezadoImpresion titulo="Tablero de ocupación" />
      <SelloDeDatos actualizadoEn={vivos.actualizadoEn} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="no-imprimir">
          <h1 className="text-2xl font-semibold">Hola, {admin.nombre.split(" ")[0]}</h1>
          <p className="mt-1 text-texto-suave">
            Ocupación de cupos. Se actualiza sola cada 30 segundos.
          </p>
          <div className="mt-3">
            <IndicadorActualizacion
              actualizadoEn={vivos.actualizadoEn}
              refrescando={vivos.refrescando}
              desactualizado={vivos.desactualizado}
              alRefrescar={vivos.refrescar}
            />
          </div>
        </div>
        <div className="no-imprimir flex flex-wrap gap-2 text-sm">
          <BotonPdf etiqueta="PDF para reunión" />
          <button
            onClick={() => descargar("ocupacion")}
            className="rounded-lg border border-borde px-4 py-2 font-medium transition hover:bg-superficie-alterna"
          >
            Descargar Excel
          </button>
          <Link
            href="/admin/reservas"
            className="rounded-lg bg-marca px-4 py-2 font-medium text-marca-texto transition hover:bg-marca-fuerte"
          >
            Ver reservas
          </Link>
        </div>
      </header>

      {/* dos lecturas del avance */}
      <div className="imprimible-bloque grid gap-4 lg:grid-cols-3">
        <Tarjeta
          titulo="Avance sobre la meta"
          descripcion="Contra lo comprometido en los proyectos, sin el sobrecupo."
        >
          <Medidor
            porcentaje={resumen.avanceMeta}
            color="var(--exito)"
            cifra={resumen.ocupados}
            detalle={`de ${n(resumen.metaBase)} beneficiarios comprometidos`}
            etiqueta="Avance sobre la meta"
          />
        </Tarjeta>

        <Tarjeta
          titulo="Ocupación del tope"
          descripcion="El tope de inscripción es la meta más 30 % por deserción."
        >
          <Medidor
            porcentaje={resumen.avance}
            cifra={resumen.disponibles}
            detalle={`cupos libres de ${n(resumen.cupos)}`}
            etiqueta="Ocupación del tope"
          />
        </Tarjeta>

        <Tarjeta
          titulo="Organizaciones"
          descripcion="Cuántas han reservado y cuánto concentran las diez mayores."
        >
          <Medidor
            porcentaje={analisis.concentracion.porcentajeDiezMayores}
            color={SERIE.dos}
            cifra={resumen.empresas}
            detalle={`${resumen.cuposPorReserva} cupos por reserva · ${n(resumen.enEspera)} en espera`}
            etiqueta="Concentración en las diez mayores"
          />
        </Tarjeta>
      </div>

      <BloqueRitmo informe={proyeccion} />

      <Alertas
        resumen={resumen}
        completas={completas}
        ultimos={ultimos}
        sinReservas={analisis.sinReservas}
      />

      <TablaRitmo acciones={proyeccion.acciones} />

      <Tarjeta
        titulo="Avance por acción de formación"
        descripcion="Cupos reservados sobre el tope de inscripción. Pulse una acción para ver su detalle."
      >
        <div className="imprimible-bloque space-y-7">
          {[...porConvenio.entries()].map(([convenio, lista]) => (
            <div key={convenio}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-texto-suave">
                {lista[0].convenioSigla ?? convenio}
              </p>
              <div className="space-y-4">
                {lista.map((a) => (
                  <div key={a.id}>
                    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                      <Link href={`/admin/acciones/${a.id}`} className="text-sm hover:text-marca">
                        <span className="font-mono text-xs text-texto-suave">{a.codigo}</span>{" "}
                        <span className="hover:underline">{bonito(a.nombre)}</span>
                        {!a.visible && (
                          <span className="ml-2 rounded bg-superficie-alterna px-1.5 py-0.5 text-[10px] text-texto-suave">
                            sin publicar
                          </span>
                        )}
                      </Link>
                      <span className="flex items-center gap-2">
                        <span className="text-sm tabular-nums text-texto-suave">
                          {n(a.ocupados)} / {n(a.cupos)}
                        </span>
                        <EtiquetaEstado estado={a.estado} />
                      </span>
                    </div>
                    <BarraAvance valor={a.ocupados} maximo={a.cupos} compacta />
                    {a.enEspera > 0 && (
                      <p className="mt-1 text-xs text-aviso">
                        {n(a.enEspera)} en lista de espera
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Tarjeta>

      <div className="imprimible-bloque grid gap-6 lg:grid-cols-2">
        <Tarjeta
          titulo="Cobertura territorial"
          descripcion="Cupos reservados en cada departamento o sede, sumando todas las acciones."
        >
          <ListaBarras
            datos={analisis.territorio.map((t) => ({
              etiqueta: bonito(t.nombre),
              valor: t.ocupados,
              detalle: `de ${n(t.cupos)}`,
            }))}
            maximoFilas={12}
            vacio="Todavía no hay reservas en ningún territorio."
          />
        </Tarjeta>

        <Tarjeta
          titulo="Concentración"
          descripcion={
            analisis.concentracion.organizaciones > 0
              ? `Las 10 organizaciones con más cupos suman el ${analisis.concentracion.porcentajeDiezMayores
                  .toFixed(1)
                  .replace(".", ",")} % del total.`
              : "Cuánto se reparte la oferta entre organizaciones."
          }
        >
          <ListaBarras
            datos={analisis.concentracion.diezMayores.map((e) => ({
              etiqueta: bonito(e.razonSocial),
              valor: e.cupos,
              detalle: `${e.porcentaje.toFixed(1).replace(".", ",")} %`,
            }))}
            vacio="Todavía no hay organizaciones con cupos."
          />
          {analisis.concentracion.porcentajeDiezMayores > 60 &&
            analisis.concentracion.organizaciones > 10 && (
              <p className="mt-4 rounded-lg bg-aviso-suave p-3 text-sm text-aviso">
                Diez organizaciones concentran más del 60 % de los cupos. Puede
                valer la pena revisar si la convocatoria está llegando lo
                bastante ancha.
              </p>
            )}
        </Tarjeta>
      </div>

      <div className="imprimible-bloque grid gap-6 lg:grid-cols-3">
        <Tarjeta titulo="Ofertado contra reservado" descripcion="Por modalidad.">
          <BarrasAgrupadas
            categorias={analisis.modalidad.map((m) => ({
              etiqueta: MODALIDAD[m.nombre] ?? m.nombre,
              valores: [m.cupos, m.ocupados],
            }))}
            series={[
              { nombre: "Ofertados", color: SERIE.uno },
              { nombre: "Reservados", color: SERIE.dos },
            ]}
          />
        </Tarjeta>

        <Tarjeta titulo="Por gremio" descripcion="Cupos según lo declarado en el formulario.">
          <ListaBarras
            datos={analisis.gremio.map((g) => ({
              etiqueta: g.nombre,
              valor: g.cupos,
              detalle: `${g.empresas} org.`,
            }))}
            maximoFilas={8}
            vacio="Nadie ha declarado gremio todavía."
          />
        </Tarjeta>

        <Tarjeta
          titulo="Tamaño de la organización"
          descripcion="Clasificación de la Ley 590 por número de colaboradores."
        >
          <ListaBarras
            datos={analisis.tamano.map((t) => ({
              etiqueta: t.nombre,
              valor: t.cupos,
              detalle: `${t.empresas} org.`,
            }))}
            vacio="Sin datos de tamaño todavía."
          />
        </Tarjeta>
      </div>

      <TablaUbicaciones filas={ubicaciones} />

      {/* ritmo de reservas, al final */}
      <Tarjeta
        titulo="Ritmo de reservas"
        descripcion="Cupos confirmados por día en los últimos 30 días."
      >
        <BarrasPorDia datos={serie} />
      </Tarjeta>
    </div>
  );
}

/** Qué está lleno y dónde no llegó nadie. */
function Alertas({
  resumen,
  completas,
  ultimos,
  sinReservas,
}: {
  resumen: Resumen;
  completas: number;
  ultimos: number;
  sinReservas: Analisis["sinReservas"];
}) {
  const [abierto, setAbierto] = useState(false);

  if (resumen.accionesPublicadas === 0) {
    return (
      <Aviso tipo="error">
        <p className="font-medium">No hay ninguna acción publicada.</p>
        <p className="mt-1">
          El sitio público no muestra oferta y nadie puede reservar.{" "}
          <Link href="/admin/acciones" className="underline">
            Publicar formación
          </Link>
        </p>
      </Aviso>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-borde bg-superficie p-5">
        <p className="text-sm text-texto-suave">Ubicaciones completas</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {completas}
          {ultimos > 0 && (
            <span className="ml-2 text-sm font-normal text-aviso">
              +{ultimos} con últimos cupos
            </span>
          )}
        </p>
      </div>

      <div className="rounded-xl border border-borde bg-superficie p-5">
        <p className="text-sm text-texto-suave">Tasa de cancelación</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {resumen.tasaCancelacion.toFixed(1).replace(".", ",")}
          <span className="text-base font-normal text-texto-suave"> %</span>
        </p>
        <p className="mt-1 text-xs text-texto-suave">
          {n(resumen.canceladas)} de {n(resumen.reservas + resumen.canceladas)} reservas
        </p>
      </div>

      <div className="rounded-xl border border-borde bg-superficie p-5">
        <p className="text-sm text-texto-suave">Sin ninguna reserva</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {sinReservas.length}
          <span className="ml-1 text-sm font-normal text-texto-suave">ubicaciones</span>
        </p>
        {sinReservas.length > 0 && (
          <button
            onClick={() => setAbierto(!abierto)}
            className="mt-1 text-xs text-marca underline"
          >
            {abierto ? "Ocultar" : "Ver cuáles"}
          </button>
        )}
      </div>

      {abierto && sinReservas.length > 0 && (
        <div className="sm:col-span-3">
          <Tarjeta
            titulo="Ubicaciones sin una sola reserva"
            descripcion="Ordenadas por cupos desaprovechados. Es donde la convocatoria todavía no ha llegado."
          >
            <div className="overflow-x-auto">
              <table className="tabla-datos text-sm">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Acción</th>
                    <th>Ubicación</th>
                    <th>Modalidad</th>
                    <th className="text-right">Cupos libres</th>
                  </tr>
                </thead>
                <tbody>
                  {sinReservas.map((o) => (
                    <tr key={o.id}>
                      <td className="whitespace-nowrap font-mono text-xs">{o.codigo}</td>
                      <td className="max-w-72 truncate" title={bonito(o.accion)}>
                        {bonito(o.accion)}
                      </td>
                      <td className="whitespace-nowrap">{bonito(o.ubicacion)}</td>
                      <td className="whitespace-nowrap text-texto-suave">
                        {MODALIDAD[o.modalidad] ?? o.modalidad}
                      </td>
                      <td className="text-right tabular-nums">{n(o.cupos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        </div>
      )}
    </div>
  );
}

function TablaUbicaciones({ filas }: { filas: FilaUbicacion[] }) {
  const [soloConCupo, setSoloConCupo] = useState(false);
  const [buscar, setBuscar] = useState("");

  const visibles = filas
    .filter((f) => (soloConCupo ? f.estado !== "COMPLETO" : true))
    .filter((f) =>
      buscar.trim()
        ? `${f.codigo} ${f.accion} ${f.ubicacion}`
            .toLowerCase()
            .includes(buscar.trim().toLowerCase())
        : true,
    );

  return (
    <Tarjeta
      titulo="Detalle por acción y ubicación"
      descripcion={`${filas.length} combinaciones. Es la tabla que reemplaza al dashboard del Excel.`}
    >
      <div className="no-imprimir mb-4 flex flex-wrap items-center gap-4">
        <input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Filtrar por código, acción o ubicación"
          className="min-w-56 flex-1 rounded-lg border border-campo-borde bg-campo-fondo px-3 py-2 text-sm outline-none focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25 sm:max-w-md"
        />
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={soloConCupo}
            onChange={(e) => setSoloConCupo(e.target.checked)}
            className="size-4 accent-[var(--marca)]"
          />
          Ocultar las completas
        </label>
      </div>

      <div className="caja-scroll max-h-[32rem] overflow-auto">
        <table className="tabla-datos text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              <th>Convenio</th>
              <th>Código</th>
              <th>Ubicación</th>
              <th className="text-right">Cupos</th>
              <th className="text-right">Reservados</th>
              <th className="text-right">Libres</th>
              <th className="min-w-32">Avance</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.id}>
                <td className="whitespace-nowrap text-texto-suave">
                  {f.convenioSigla ?? f.convenio}
                </td>
                <td className="whitespace-nowrap font-mono text-xs">{f.codigo}</td>
                <td className="whitespace-nowrap">
                  {bonito(f.ubicacion)}
                  <span className="ml-2 text-xs text-texto-suave">
                    {f.modalidad === "PRESENCIAL" ? "presencial" : "virtual"}
                  </span>
                </td>
                <td className="text-right tabular-nums">{n(f.cupos)}</td>
                <td className="text-right tabular-nums">{n(f.ocupados)}</td>
                <td className="text-right tabular-nums">{n(f.disponibles)}</td>
                <td>
                  <BarraAvance valor={f.ocupados} maximo={f.cupos} compacta />
                </td>
                <td>
                  <EtiquetaEstado estado={f.estado} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visibles.length === 0 && (
        <p className="py-6 text-center text-sm text-texto-suave">
          Ninguna combinación coincide con el filtro.
        </p>
      )}
    </Tarjeta>
  );
}
