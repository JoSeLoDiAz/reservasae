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
 * El orden es la respuesta: veredicto, cifras, dónde empujar,
 * territorio, quién concentra.
 *
 * Lo que se quitó y por qué está en el comentario de cada
 * pieza; en corto: dos medidores que se contradecían (ahora un
 * termómetro), dos tablas de las mismas quince acciones (ahora
 * una), y la lista de «ubicaciones sin una sola reserva», que
 * es una cifra de la tira.
 *
 * En la revisión de Mauricio se cayeron dos bloques más:
 *
 *   - «De qué está hecha la demanda» entero. De sus tres
 *     piezas solo se miraba «Por modalidad», que subió al
 *     veredicto; «Por gremio» y «Tamaño de la organización» no
 *     se usaban para decidir nada desde aquí.
 *   - «Detalle por acción y ubicación». Era una tabla de 106
 *     filas que repetía lo que ya vive dentro de cada acción
 *     --«Grupos programados» y «Detalle por ubicación», en
 *     `/admin/acciones/[id]`--. El camino es pulsar la acción,
 *     no arrastrar la tabla entera hasta aquí.
 *
 * Y «Concentración» salió de «Territorio» a bloque propio con
 * el nombre que usa el equipo: son las reservas de aliados y
 * afiliados, no una nota al pie del mapa.
 */

import Link from "next/link";
import { useCallback } from "react";

import { AccionesOcupacionRitmo } from "@/components/admin/acciones-ocupacion-ritmo";
import { BotonPdf, EncabezadoImpresion } from "@/components/admin/boton-pdf";
import { ListaBarras, n } from "@/components/admin/graficos";
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
import { tablerosApi, type Analisis } from "@/lib/tableros-api";

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
      /// `ubicaciones()` ya no se pide: era la fuente del
      /// «Detalle por acción y ubicación», que se quitó. Una
      /// consulta menos cada treinta segundos.
      const [resumen, acciones, analisis, serie, proyeccion] = await Promise.all([
        tablerosApi.resumen(),
        tablerosApi.acciones(),
        tablerosApi.analisis(),
        tablerosApi.serie(30),
        tablerosApi.proyeccion(14),
      ]);
      return { resumen, acciones, analisis, serie, proyeccion };
    }, []),
  );

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Cargando que="Cargando el tablero…" />;

  const { resumen, acciones, analisis, serie, proyeccion } = vivos.datos;

  /// En el refresco de cada 30 s NO se vacía el layout: se
  /// atenúa lo que hay. Vaciarlo da un salto de media pantalla
  /// cada medio minuto y se pierde de vista lo que uno estaba
  /// mirando —y esta pantalla se proyecta en reunión—.
  const atenuado = vivos.refrescando ? "opacity-45 pointer-events-none" : "";

  return (
    <div className="resumen-impreso flex flex-col gap-3 px-4 pt-3 pb-6">
      <EncabezadoImpresion
        titulo="Resumen de ocupación"
        subtitulo="Cupos comprometidos con el SENA"
      />
      <SelloDeDatos actualizadoEn={vivos.actualizadoEn} />

      {/* 1 - Cabecera */}
      <header className="no-imprimir flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.125rem] font-bold tracking-[-0.02em] text-titulo">
            Hola, {admin.nombre.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-[0.78125rem] text-texto-suave">
            Resumen de ocupación de los cupos comprometidos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <IndicadorActualizacion
            actualizadoEn={vivos.actualizadoEn}
            refrescando={vivos.refrescando}
            desactualizado={vivos.desactualizado}
            alRefrescar={vivos.refrescar}
          />
          {/* Sin «Descargar Excel».

              Esta pantalla es el informe: se proyecta en
              reunión y se lleva en PDF. El Excel era la
              tercera forma de sacar lo mismo --y la que nadie
              usaba-- al lado de la que sí. La exportación de
              ocupación sigue viva en la API por si hace falta
              devolverla. */}
          <BotonPdf etiqueta="PDF para reunión" />
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
        {/* 2 - El veredicto */}
        <VeredictoOcupacion
          resumen={resumen}
          serie={serie}
          proyeccion={proyeccion}
          analisis={analisis}
        />

        {/* 3 - Las cifras clave.
            Seis, y fusionan dos tiras que estaban separadas.
            «Ubicaciones completas» se cayó: como cifra suelta
            era ruido. */}
        <div className="imprimible-bloque imprimible-cifras grid gap-px overflow-hidden rounded-lg border border-borde bg-hairline sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
              un bloque entero al final. Como cifra dice lo mismo. */}
          <TarjetaCifra
            compacta
            etiqueta="Sin ninguna reserva"
            valor={n(resumen.ofertasSinReservas)}
            pie="ubicaciones"
            tono={resumen.ofertasSinReservas > 0 ? "aviso" : "neutro"}
          />
        </div>

        {/* 4 - Dónde empujar */}
        <AccionesOcupacionRitmo acciones={acciones} proyeccion={proyeccion} />

        {/* 5 - Territorio */}
        <Territorio analisis={analisis} />

        {/* 6 - Quién concentra los cupos */}
        <ReservasDeAliados analisis={analisis} />
      </div>
    </div>
  );
}

// territorio

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

  return (
    <Bloque partible titulo="Territorio" descripcion="Dónde están los cupos con dueño.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Bloque plano titulo="En el mapa" descripcion="Por departamento">
          <div className="mapa-en-papel">
            <MapaColombia datos={mapa} />
          </div>
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
    </Bloque>
  );
}

// aliados y afiliados

/**
 * En cuántas manos están los cupos.
 *
 * Era «Concentración», un sub-bloque colgado del final de
 * «Territorio», y ahí se leía como una nota al pie del mapa
 * cuando es otra pregunta: no DÓNDE están los cupos, sino
 * QUIÉN los tiene. Aparte, y con el nombre que usa el equipo.
 */
function ReservasDeAliados({ analisis }: { analisis: Analisis }) {
  const conc = analisis.concentracion;

  return (
    <Bloque
      partible
      titulo="Reservas de Aliados y Afiliados"
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
          Diez organizaciones concentran más del 60 % de los cupos. Puede valer
          la pena revisar si la convocatoria está llegando lo bastante ancha.
        </p>
      )}
    </Bloque>
  );
}
