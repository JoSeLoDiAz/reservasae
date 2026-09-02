"use client";

/** La primera pantalla: cómo va la ocupación de los cupos. */

/**
 * SEIS bloques con una narrativa, y antes eran doce apilados
 * sin jerarquía.
 *
 * Esta pantalla se abre al entrar, se proyecta en reunión y se
 * exporta a PDF, y contesta UNA pregunta: ¿cómo va la ocupación
 * de los cupos comprometidos con el SENA? La cifra que la
 * contesta salía con el mismo peso que «tasa de cancelación»,
 * doce bloques más abajo.
 *
 * El orden es la respuesta: veredicto → cifras → dónde empujar
 * → territorio → composición → detalle.
 *
 * Lo que se quitó y por qué está en el comentario de cada
 * pieza; en corto: dos medidores que se contradecían (ahora un
 * termómetro), dos tablas de las mismas quince acciones (ahora
 * una), y la lista de «ubicaciones sin una sola reserva», que
 * es una cifra de la tira y se filtra en el detalle.
 */

import Link from "next/link";
import { useCallback, useState } from "react";

import { AccionesOcupacionRitmo } from "@/components/admin/acciones-ocupacion-ritmo";
import { BotonPdf, EncabezadoImpresion } from "@/components/admin/boton-pdf";
import {
  BarraAvance,
  BarrasAgrupadas,
  EtiquetaEstado,
  ListaBarras,
  n,
  SERIE,
} from "@/components/admin/graficos";
import {
  IndicadorActualizacion,
  SelloDeDatos,
} from "@/components/admin/indicador-actualizacion";
import { MapaColombia } from "@/components/admin/mapa-colombia";
import { Aviso, useAdmin } from "@/components/admin/marco-admin";
import { Bloque, Cargando, TarjetaCifra } from "@/components/admin/piezas";

import { VeredictoOcupacion } from "@/components/admin/veredicto-ocupacion";
import { bonito } from "@/lib/api";
import { useDatosVivos } from "@/lib/datos-vivos";
import {
  descargar,
  tablerosApi,
  type Analisis,
  type FilaUbicacion,
} from "@/lib/tableros-api";

const MODALIDAD: Record<string, string> = {
  PRESENCIAL: "Presencial",
  VIRTUAL: "Virtual",
  HIBRIDA: "Híbrido",
};

/// Las ciudades suman a su departamento para pintar el mapa.
///
/// `territorio` mezcla filas de departamento y de ciudad —así
/// las manda el catálogo del SEP—, y el mapa solo sabe de
/// departamentos: sin esto, los 45 cupos de Santa Marta no
/// pintan el Magdalena y el departamento se queda gris con
/// gente dentro.
const DEPARTAMENTO_DE: Record<string, string> = {
  "SANTA MARTA": "MAGDALENA",
  BOGOTÁ: "BOGOTA",
  CALI: "VALLE DEL CAUCA",
  POPAYÁN: "CAUCA",
  MEDELLÍN: "ANTIOQUIA",
  APARTADÓ: "ANTIOQUIA",
  CARTAGENA: "BOLÍVAR",
  CHÍA: "CUNDINAMARCA",
  LETICIA: "AMAZONAS",
  PEREIRA: "RISARALDA",
};

export default function Tablero() {
  const { admin } = useAdmin();

  const vivos = useDatosVivos(
    useCallback(async () => {
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
    }, []),
  );

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Cargando que="Cargando el tablero…" />;

  const { resumen, acciones, analisis, ubicaciones, serie, proyeccion } =
    vivos.datos;

  /// En el refresco de cada 30 s NO se vacía el layout: se
  /// atenúa lo que hay. Vaciarlo da un salto de media pantalla
  /// cada medio minuto y se pierde de vista lo que uno estaba
  /// mirando —y esta pantalla se proyecta en reunión—.
  const atenuado = vivos.refrescando ? "opacity-45 pointer-events-none" : "";

  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-6">
      <EncabezadoImpresion titulo="Tablero de ocupación" />
      <SelloDeDatos actualizadoEn={vivos.actualizadoEn} />

      {/* ── 1 · Cabecera ── */}
      <header className="no-imprimir flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.125rem] font-bold tracking-[-0.02em] text-titulo">
            Hola, {admin.nombre.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-[0.78125rem] text-texto-suave">
            Ocupación de los cupos comprometidos con el SENA. Se actualiza sola
            cada 30 segundos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <IndicadorActualizacion
            actualizadoEn={vivos.actualizadoEn}
            refrescando={vivos.refrescando}
            desactualizado={vivos.desactualizado}
            alRefrescar={vivos.refrescar}
          />
          <BotonPdf etiqueta="PDF para reunión" />
          <button
            onClick={() => descargar("ocupacion")}
            className="h-[34px] rounded-lg border border-borde px-3.5 text-[0.78125rem] font-semibold transition hover:bg-superficie-alterna"
          >
            Descargar Excel
          </button>
          <Link
            href="/admin/reservas"
            className="inline-flex h-[34px] items-center rounded-lg border border-marca bg-marca px-3.5 text-[0.78125rem] font-semibold text-marca-texto transition hover:bg-marca-fuerte"
          >
            Ver reservas
          </Link>
        </div>
      </header>

      {/* La franja fina mientras llega el dato nuevo: la
          opacidad sola casi no se nota en una pantalla clara. */}
      {vivos.refrescando && (
        <div
          className="h-0.5 overflow-hidden rounded-full bg-superficie-alterna"
          aria-hidden
        >
          <div className="h-full w-1/3 animate-[recorrer_1.1s_ease-in-out_infinite] rounded-full bg-marca" />
        </div>
      )}

      <div
        className={`flex flex-col gap-3 transition-opacity ${atenuado}`}
        aria-busy={vivos.refrescando}
      >
        {/* ── 2 · El veredicto ── */}
        <VeredictoOcupacion
          resumen={resumen}
          serie={serie}
          proyeccion={proyeccion}
        />

        {/* ── 3 · Las cifras clave ──
            Seis, y fusionan dos tiras que estaban separadas.
            «Ubicaciones completas» se cayó: como cifra suelta era
            ruido, y su información vive mejor en el filtro
            «Ocultar las completas» del detalle. */}
        <div className="imprimible-bloque grid gap-px overflow-hidden rounded-lg border border-borde bg-hairline sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <TarjetaCifra
            compacta
            etiqueta="Cupos con dueño"
            valor={n(resumen.ocupados)}
            pie={`de ${n(resumen.cupos)} ofertados`}
          />
          <TarjetaCifra
            compacta
            etiqueta="Cupos libres"
            valor={n(resumen.disponibles)}
            tono="neutro"
          />
          <TarjetaCifra
            compacta
            etiqueta="Organizaciones"
            valor={n(resumen.empresas)}
            pie={`${resumen.cuposPorReserva.toFixed(1)} cupos por reserva`}
            tono="neutro"
          />
          <TarjetaCifra
            compacta
            etiqueta="En lista de espera"
            valor={n(resumen.enEspera)}
            tono={resumen.enEspera > 0 ? "aviso" : "neutro"}
          />
          <TarjetaCifra
            compacta
            etiqueta="Tasa de cancelación"
            valor={`${resumen.tasaCancelacion.toFixed(1)} %`}
            pie={`${n(resumen.canceladas)} de ${n(resumen.reservas)} reservas`}
            tono={resumen.tasaCancelacion > 10 ? "aviso" : "neutro"}
          />
          {/* La lista de «ubicaciones sin una sola reserva» era
              un bloque entero al final. Como cifra dice lo mismo,
              y el detalle de abajo permite ir a verlas. */}
          <TarjetaCifra
            compacta
            etiqueta="Sin ninguna reserva"
            valor={n(resumen.ofertasSinReservas)}
            pie="ubicaciones"
            tono={resumen.ofertasSinReservas > 0 ? "aviso" : "neutro"}
          />
        </div>

        {/* ── 4 · Dónde empujar ── */}
        <AccionesOcupacionRitmo acciones={acciones} proyeccion={proyeccion} />

        {/* ── 5 · Territorio ── */}
        <Territorio analisis={analisis} />

        {/* ── 6 · Composición ── */}
        <Composicion analisis={analisis} />

        {/* ── 7 · El detalle, plegado ──
            Sustituye a un Excel y el equipo la quiere a mano,
            pero 106 filas abiertas parten la pantalla en dos.
            Plegada cumple las dos cosas. */}
        <TablaUbicaciones filas={ubicaciones} />
      </div>
    </div>
  );
}

// ─────────────────────────── territorio ─────────────────────

function Territorio({ analisis }: { analisis: Analisis }) {
  /// El mapa suma las ciudades a su departamento; el ranking de
  /// al lado NO, porque ahí la sede es la unidad con la que
  /// trabaja el equipo --«Santa Marta» es una sede, no medio
  /// Magdalena--.
  const porDepartamento = new Map<string, number>();
  for (const t of analisis.territorio) {
    const clave =
      t.tipo === "CIUDAD"
        ? (DEPARTAMENTO_DE[t.nombre.toUpperCase()] ?? t.nombre)
        : t.nombre;
    porDepartamento.set(clave, (porDepartamento.get(clave) ?? 0) + t.ocupados);
  }

  const mapa = [...porDepartamento.entries()].map(([nombre, total]) => ({
    nombre,
    total,
  }));

  const ranking = [...analisis.territorio]
    .sort((a, b) => b.ocupados - a.ocupados)
    .map((t) => ({
      clave: t.nombre,
      etiqueta: bonito(t.nombre),
      valor: t.ocupados,
      detalle: `de ${n(t.cupos)}`,
    }));

  const conc = analisis.concentracion;

  return (
    <Bloque
      titulo="Territorio"
      descripcion="Dónde están los cupos con dueño, y en cuántas manos."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Bloque plano titulo="En el mapa" descripcion="Por departamento">
          <MapaColombia datos={mapa} />
        </Bloque>

        <Bloque
          plano
          titulo="Cobertura territorial"
          descripcion="Departamento o sede, sumando todas las acciones"
        >
          <ListaBarras
            datos={ranking}
            maximoFilas={12}
            vacio="Todavía no hay reservas en ningún territorio."
          />
        </Bloque>
      </div>

      <div className="mt-6 border-t border-hairline pt-5">
        <Bloque
          plano
          titulo="Concentración"
          descripcion={
            conc.organizaciones > 0
              ? `Las 10 organizaciones con más cupos suman el ${conc.porcentajeDiezMayores
                  .toFixed(1)
                  .replace(".", ",")} % del total.`
              : "Cuánto se reparte la oferta entre organizaciones."
          }
        >
          <ListaBarras
            datos={conc.diezMayores.map((e) => ({
              clave: e.razonSocial,
              etiqueta: bonito(e.razonSocial),
              valor: e.cupos,
              detalle: `${e.porcentaje.toFixed(1).replace(".", ",")} %`,
            }))}
            vacio="Todavía no hay organizaciones con cupos."
          />

          {conc.porcentajeDiezMayores > 60 && conc.organizaciones > 10 && (
            <p className="mt-4 text-[0.78125rem] text-aviso">
              Diez organizaciones concentran más del 60 % de los cupos. Puede
              valer la pena revisar si la convocatoria está llegando lo bastante
              ancha.
            </p>
          )}
        </Bloque>
      </div>
    </Bloque>
  );
}

// ────────────────────────── composición ─────────────────────

function Composicion({ analisis }: { analisis: Analisis }) {
  const t = analisis.tamano;

  return (
    <Bloque
      titulo="De qué está hecha la demanda"
      descripcion="Modalidad, gremio y tamaño de quien reserva."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Bloque plano titulo="Por modalidad" descripcion="Ofertado contra reservado">
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
        </Bloque>

        <Bloque plano titulo="Por gremio" descripcion="Según lo declarado en el formulario">
          <ListaBarras
            datos={analisis.gremio.map((g) => ({
              clave: g.nombre,
              etiqueta: g.nombre,
              valor: g.cupos,
              detalle: `${g.empresas} org.`,
            }))}
            maximoFilas={8}
            vacio="Nadie ha declarado gremio todavía."
          />
        </Bloque>

        <Bloque
          plano
          titulo="Tamaño de la organización"
          descripcion="Decreto 957 de 2019: por ingresos y sector, que es el criterio del reporte"
        >
          {/* La cifra que los proyectos comprometen va aparte y
              ya sumada: para saber si se cumple, sumar tres
              barras a ojo no vale. */}
          <p className="mb-3 text-[0.78125rem]">
            <strong className="tabular-nums">{n(t.mipymes.empresas)}</strong>{" "}
            {t.mipymes.empresas === 1
              ? "organización es mipyme"
              : "organizaciones son mipymes"}
            , con <strong className="tabular-nums">{n(t.mipymes.cupos)}</strong>{" "}
            cupos.
          </p>

          <ListaBarras
            datos={t.filas.map((f) => ({
              clave: f.nombre,
              etiqueta: f.nombre,
              valor: f.cupos,
              detalle: `${f.empresas} org.`,
            }))}
            vacio="Sin datos de tamaño todavía."
          />

          {/* Decirlo no es un detalle: hasta que todas declaren
              su rango de ingresos, esta cifra mezcla dos
              criterios que NO dan lo mismo. Callarlo daría un
              recuento que parece exacto y no lo es. */}
          {(t.criterio.EMPLEADOS > 0 || t.criterio.SIN_DATO > 0) && (
            <p className="mt-3 text-[0.71875rem] leading-relaxed text-texto-suave">
              {t.criterio.DECRETO_957 > 0 && (
                <>{n(t.criterio.DECRETO_957)} clasificadas por su rango de ingresos. </>
              )}
              {t.criterio.EMPLEADOS > 0 && (
                <>
                  {n(t.criterio.EMPLEADOS)} por número de colaboradores, que es el
                  criterio viejo y puede dar otra talla.{" "}
                </>
              )}
              {t.criterio.SIN_DATO > 0 && (
                <>{n(t.criterio.SIN_DATO)} sin ningún dato de tamaño.</>
              )}
            </p>
          )}
        </Bloque>
      </div>
    </Bloque>
  );
}

// ─────────────────────────── el detalle ─────────────────────

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
    <Bloque
      plegable
      titulo={`Detalle por acción y ubicación (${filas.length})`}
      descripcion="La tabla que reemplaza al dashboard del Excel."
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

      {visibles.length === 0 ? (
        <p className="py-6 text-center text-sm text-texto-suave">
          Sin combinaciones con ese filtro.
        </p>
      ) : (
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
      )}
    </Bloque>
  );
}
