"use client";

import Link from "next/link";
import { use, useCallback, useState } from "react";

import { BotonPdf, EncabezadoImpresion } from "@/components/admin/boton-pdf";

import {
  BarraAvance,
  EtiquetaEstado,
  ListaBarras,
  Medidor,
  n,
} from "@/components/admin/graficos";
import {
  IndicadorActualizacion,
  SelloDeDatos,
} from "@/components/admin/indicador-actualizacion";
import { Aviso } from "@/components/admin/marco-admin";
import { textoDeEstado } from "@/components/admin/ritmo";
import { Bloque, Cifra, Esqueleto } from "@/components/admin/piezas";
import { adminApi } from "@/lib/admin-api";
import { bonito, ErrorApi } from "@/lib/api";
import { useDatosVivos } from "@/lib/datos-vivos";
import { tablerosApi, type DetalleAccion } from "@/lib/tableros-api";

const MODALIDAD: Record<string, string> = {
  PRESENCIAL: "Presencial",
  VIRTUAL: "Virtual",
  HIBRIDA: "Híbrido",
};

const ESTADO: Record<string, { texto: string; clase: string }> = {
  CONFIRMADA: { texto: "Confirmada", clase: "text-exito" },
  LISTA_ESPERA: { texto: "En espera", clase: "text-aviso" },
  CANCELADA: { texto: "Cancelada", clase: "text-error" },
};

export default function DetalleDeAccion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const vivos = useDatosVivos<DetalleAccion>(
    useCallback(() => tablerosApi.accion(id), [id]),
  );

  const datos = vivos.datos;
  const error = errorAccion ?? vivos.error;

  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!datos) return <Esqueleto conCifras />;

  async function alternarPublicacion() {
    if (!datos) return;
    setOcupado(true);
    try {
      await adminApi.publicarAccion(datos.id, !datos.visible);
      vivos.refrescar();
    } catch (e) {
      setErrorAccion((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }

  const topeSerie = Math.max(...datos.serie.map((s) => s.cupos), 1);

  const diaLargo = (t: string) => {
    const [a, m, d] = t.slice(0, 10).split("-").map(Number);
    return new Date(a, m - 1, d).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
    });
  };
  const diaCorto = (t: string) => {
    const [, m, d] = t.slice(0, 10).split("-");
    return `${d}/${m}`;
  };

  /// La serie trae SOLO los dias con movimiento. Ocho dias
  /// sueltos repartidos a lo ancho se leen como ocho periodos
  /// seguidos, y son ocho dias de sesenta: el hueco entre uno y
  /// otro es justo el dato. Se rellenan los dias vacios.
  const serieCompleta = (() => {
    if (datos.serie.length < 2) return datos.serie;
    const dia = (t: string) => {
      const [a, m, d] = t.slice(0, 10).split("-").map(Number);
      return Date.UTC(a, m - 1, d);
    };
    const conValor = new Map(datos.serie.map((x) => [x.dia.slice(0, 10), x.cupos]));
    const ordenados = datos.serie.map((x) => dia(x.dia)).sort((a, b) => a - b);
    const [desde, hasta] = [ordenados[0], ordenados[ordenados.length - 1]];
    const salida: Array<{ dia: string; cupos: number }> = [];
    for (let t = desde; t <= hasta; t += 86_400_000) {
      const clave = new Date(t).toISOString().slice(0, 10);
      salida.push({ dia: clave, cupos: conValor.get(clave) ?? 0 });
    }
    return salida;
  })();

  /// La media se calcula sobre los dias DIBUJADOS, huecos
  /// incluidos: sobre «los dias que hubo movimiento» saldria un
  /// ritmo inflado justo donde peor va.
  const mediaSerie = serieCompleta.length
    ? serieCompleta.reduce((t, d) => t + d.cupos, 0) / serieCompleta.length
    : 0;
  const mejorDia = serieCompleta.reduce<{ dia: string; cupos: number } | null>(
    (mejor, d) => (!mejor || d.cupos > mejor.cupos ? d : mejor),
    null,
  );

  /// Cual fue la ultima barra rotulada antes de `i`. Se usa para
  /// no pintar dos fechas pegadas: con 41 columnas de 20px, dos
  /// «01/07» seguidos se solapan y no se lee ninguno.
  const rotuladas: number[] = [];
  serieCompleta.forEach((d, i) => {
    if (d.cupos > 0 && (rotuladas.length === 0 || i - rotuladas[rotuladas.length - 1] >= 3)) {
      rotuladas.push(i);
    }
  });
  const ultimaRotulada = (i: number) => {
    const previas = rotuladas.filter((x) => x < i);
    return previas.length ? previas[previas.length - 1] : -99;
  };
  const activas = datos.reservas.filter((r) => r.estado !== "CANCELADA");

  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-6">
      <EncabezadoImpresion
        titulo={`${datos.codigo} · ${bonito(datos.nombre)}`}
        subtitulo={datos.convenio.sigla ?? datos.convenio.slug}
      />
      <SelloDeDatos actualizadoEn={vivos.actualizadoEn} />

      <header className="no-imprimir flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/admin/acciones"
            className="inline-flex items-center gap-1 text-[0.75rem] text-texto-suave transition hover:text-marca"
          >
            <span aria-hidden="true">&larr;</span> Formación
          </Link>
          <h1 className="mt-1.5 text-[1.125rem] font-bold leading-snug tracking-[-0.02em] text-titulo">
            {bonito(datos.nombre)}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.78125rem] text-texto-suave">
            <span className="font-mono text-[0.6875rem]">{datos.codigo}</span>
            <span>·</span>
            <span>{datos.convenio.sigla ?? datos.convenio.nombre}</span>
            <span>·</span>
            <span>
              {datos.evento} {MODALIDAD[datos.modalidad]?.toLowerCase()}
            </span>
            {datos.horas && (
              <>
                <span>·</span>
                <span>{datos.horas} horas</span>
              </>
            )}
            {/* El estado, DENTRO de la linea de datos: es un dato
                mas, como la modalidad o las horas. */}
            <span>·</span>
            <span
              className={`font-semibold ${
                datos.visible ? "text-exito" : "text-texto-suave"
              }`}
            >
              {datos.visible ? "Publicada" : "Oculta"}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <IndicadorActualizacion
            actualizadoEn={vivos.actualizadoEn}
            refrescando={vivos.refrescando}
            desactualizado={vivos.desactualizado}
            alRefrescar={vivos.refrescar}
          />
          <button
            onClick={alternarPublicacion}
            disabled={ocupado}
            className="sin-aro inline-flex h-[34px] items-center rounded-lg border border-borde bg-superficie px-3.5 text-[0.78125rem] font-semibold whitespace-nowrap text-titulo transition hover:border-marca disabled:opacity-50"
          >
            {datos.visible ? "Ocultar" : "Publicar"}
          </button>
          <BotonPdf />
        </div>
      </header>

      {/* Las tarjetas de Gestion de leads, sobre el fondo. */}
      <div className="no-imprimir flex flex-wrap gap-2.5">
        <Cifra
          etiqueta="Avance sobre la meta"
          valor={datos.ocupados}
          pie={`de ${n(datos.metaBase)} beneficiarios · ${datos.avanceMeta.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`}
        />
        <Cifra
          etiqueta="Cupos libres"
          valor={datos.disponibles}
          pie={`de ${n(datos.cupos)} del tope · ${datos.avance.toLocaleString("es-CO", { maximumFractionDigits: 1 })} % ocupado`}
        />
        <Cifra
          etiqueta="Organizaciones"
          valor={datos.organizaciones}
          pie={
            datos.enEspera > 0
              ? `han reservado · ${n(datos.enEspera)} en lista de espera`
              : "han reservado · nadie en lista de espera"
          }
        />
        <Cifra
          etiqueta="Ritmo"
          valor={datos.proyeccion.ritmoDiario}
          pie={`cupos al día · faltan ${n(datos.proyeccion.faltan)} para la meta`}
        />
      </div>

      {/* El orden lo manda lo que hay que ver primero:
          para que sirve el curso, como va, donde esta el cupo,
          quien reservo, y al final el plan del proyecto -- que no
          cambia y se consulta una vez. */}
      {datos.objetivo && (
        <div className="imprimible-bloque">
          <Bloque titulo="Objetivo de la acción" descripcion="Texto del proyecto, sin modificar.">
            <p className="text-sm leading-relaxed text-texto-suave">{datos.objetivo}</p>
          </Bloque>
        </div>
      )}

      <div className="imprimible-bloque">
          <Bloque
            titulo="Grupos programados"
            descripcion="Cómo reparte el proyecto los cupos entre grupos y territorios. Esta distribución no lleva contador propio: el cupo se descuenta contra la oferta."
          >
            {/* Filas, no ocho cajas con hueco entre ellas.
                Cada grupo iba en un recuadro con borde y radio,
                separados por 16px: ocho cajas apiladas es justo
                el lenguaje que este redisenio quita, y encima
                obligaba a bajar dos pantallas para ver los ocho.
                Ahora se separan por la raya, como todas las
                listas del panel. */}
            {/* En dos columnas: ocho grupos apilados obligaban a
                bajar dos pantallas para ver los ocho. */}
            <div className="-mx-7 grid md:grid-cols-2 md:divide-x md:divide-hairline">
              {datos.grupos.map((g) => (
                <div
                  key={g.numero}
                  className="border-t border-hairline px-7 py-3.5 first:border-t-0 md:[&:nth-child(2)]:border-t-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">
                      Grupo {g.numero}
                      <span className="ml-2 text-xs font-normal text-texto-suave">
                        {MODALIDAD[g.modalidad]}
                        {g.sede ? ` · ${bonito(g.sede)}` : ""}
                      </span>
                    </p>
                    <p className="text-sm tabular-nums text-texto-suave">
                      {n(g.cuposBase)} + 30 % = {n(g.cuposMaximos)}
                    </p>
                  </div>
                  {!g.fechaInicio && (
                    <p className="mt-1 text-xs text-aviso">Sin fecha asignada</p>
                  )}
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-suave">
                    {g.coberturas.map((c) => (
                      <li key={`${c.ubicacion}-${c.modalidad}`}>
                        {bonito(c.ubicacion)}{" "}
                        <span className="tabular-nums">{n(c.cuposMaximos)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Bloque>
      </div>

      {/* Un solo bloque de ritmo. Habia dos: la tira de barras
          y una tarjeta con las mismas cifras que ya estan arriba.

          Y la tira eran barras desnudas: sin escala, sin fechas y
          sin decir que es una barra. Una grafica que hay que
          adivinar no informa, decora. */}
      <Bloque
        titulo="Ritmo de inscripción"
        descripcion="Cada barra es un día. La altura son los cupos netos que entraron ese día, ya descontadas las ediciones y las cancelaciones."
      >
        {serieCompleta.length === 0 ? (
          <p className="text-[0.78125rem] text-texto-suave">
            Todavía no hay ningún movimiento que dibujar.
          </p>
        ) : (
          <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
            <div className="min-w-[280px] grow">
              <div className="flex gap-2">
                {/* La escala. Sin ella una barra alta no dice si
                    son tres cupos o trescientos. */}
                <div className="flex h-28 w-7 shrink-0 flex-col justify-between pt-4 text-right text-[0.65625rem] text-texto-suave tabular-nums">
                  <span>{n(topeSerie)}</span>
                  <span>{n(Math.round(topeSerie / 2))}</span>
                  <span>0</span>
                </div>

                <div className="min-w-0 grow">
                  <div className="relative h-28 border-b border-borde">
                    {/* la media, para leer cada dia contra ella */}
                    <div
                      className="absolute inset-x-0 border-t border-dashed border-texto-suave/45"
                      style={{ bottom: `${(mediaSerie / topeSerie) * 100}%` }}
                    />
                    <div className="flex h-full items-end gap-[2px]">
                      {serieCompleta.map((d, i) => {
                        /// La fecha solo bajo las barras con
                        /// movimiento, y saltando las que caen
                        /// muy juntas: 41 fechas seguidas se
                        /// pisan y no se lee ninguna.
                        const rotula = d.cupos > 0 && i - ultimaRotulada(i) >= 3;
                        return (
                          <div
                            key={d.dia}
                            title={`${diaLargo(d.dia)}: ${n(d.cupos)} cupos`}
                            className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
                          >
                            {d.cupos > 0 && (
                              <span className="absolute inset-x-0 -top-0.5 text-center text-[0.625rem] font-semibold text-titulo tabular-nums"
                                style={{ bottom: `calc(${(d.cupos / topeSerie) * 100}% + 2px)` }}
                              >
                                {n(d.cupos)}
                              </span>
                            )}
                            <div
                              className={
                                "w-full rounded-t transition " +
                                (d.cupos > 0
                                  ? "bg-gradient-to-t from-marca to-marca/40 group-hover:to-marca"
                                  : "bg-borde/70")
                              }
                              style={{
                                height: `${Math.max(2, (d.cupos / topeSerie) * 100)}%`,
                              }}
                            />
                            {rotula && (
                              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[0.625rem] whitespace-nowrap text-texto-suave tabular-nums">
                                {diaCorto(d.dia)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="mt-5 text-right text-[0.65625rem] text-texto-suave tabular-nums">
                    {serieCompleta.length} días · del {diaCorto(serieCompleta[0].dia)} al{" "}
                    {diaCorto(serieCompleta[serieCompleta.length - 1].dia)}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-w-[210px] max-w-sm space-y-2 text-[0.78125rem]">
              <p>
                <span className="font-semibold text-titulo tabular-nums">
                  {mediaSerie.toLocaleString("es-CO", { maximumFractionDigits: 1 })}
                </span>{" "}
                cupos al día de media
                <span className="text-texto-suave"> (la línea de puntos)</span>
              </p>
              <p>
                <span className="font-semibold text-titulo tabular-nums">
                  {n(mejorDia?.cupos ?? 0)}
                </span>{" "}
                el mejor día
                {mejorDia && (
                  <span className="text-texto-suave">, el {diaLargo(mejorDia.dia)}</span>
                )}
              </p>
              <p className="text-texto-suave">{textoDeEstado(datos.proyeccion)}</p>
              {datos.proyeccion.confianza === "BAJA" && (
                <p className="text-[0.71875rem] text-texto-suave">
                  Menos de una semana de historia: la estimación es floja.
                </p>
              )}
            </div>
          </div>
        )}
      </Bloque>

      {/* El detalle y el ranking, uno al lado del otro: son la
          misma pregunta -- donde esta el cupo -- respondida con
          numeros y con proporcion. */}
      <div className="grid gap-3 xl:grid-cols-2 xl:[grid-auto-rows:1fr]">
      <div className="imprimible-bloque">
        <Bloque
          estirado
          titulo="Detalle por ubicación"
          descripcion={`${datos.ofertas.length} ubicaciones. El cupo se descuenta contra estas filas.`}
        >
          <div className="caja-scroll tabla-fija h-full overflow-auto">
            <table className="tabla-datos text-sm">
              <thead>
                <tr>
                  <th>Ubicación</th>
                  <th className="text-right">Cupos</th>
                  <th className="text-right">Reservados</th>
                  <th className="text-right">Libres</th>
                  <th className="text-right">Espera</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {datos.ofertas.map((o) => (
                  <tr key={o.id}>
                    <td className="whitespace-nowrap font-medium">
                      {bonito(o.ubicacion)}
                      {o.tipoUbicacion === "CIUDAD" && o.departamento && (
                        <span className="ml-2 text-xs font-normal text-texto-suave">
                          {bonito(o.departamento)}
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{n(o.cupos)}</td>
                    <td className="text-right tabular-nums">{n(o.ocupados)}</td>
                    <td className="text-right tabular-nums">{n(o.disponibles)}</td>
                    <td className="text-right tabular-nums">
                      {o.enEspera > 0 ? (
                        <span className="text-aviso">{n(o.enEspera)}</span>
                      ) : (
                        <span className="text-texto-suave">—</span>
                      )}
                    </td>
                    <td>
                      <EtiquetaEstado estado={o.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Bloque>
      </div>
        <div className="imprimible-bloque">
          <Bloque
            estirado
            titulo="Ubicaciones con más reservas"
            descripcion="Ordenadas por cupos reservados, de mayor a menor."
          >
            <ListaBarras
              datos={datos.ofertas
                .filter((o) => o.ocupados > 0)
                .sort((a, b) => b.ocupados - a.ocupados)
                .map((o) => ({
                  etiqueta: bonito(o.ubicacion),
                  valor: o.ocupados,
                  detalle: `de ${n(o.cupos)}`,
                }))}
              vacio="Todavía no hay ninguna reserva en esta acción."
            />
          </Bloque>
        </div>
      </div>




      <div className="imprimible-bloque imprimible-salto">
        <Bloque
          titulo="Reservas"
          descripcion={`${activas.length} activas de ${datos.reservas.length} registradas.`}
        >
          <div className="caja-scroll max-h-[28rem] overflow-auto">
            <table className="tabla-datos text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th>Fecha</th>
                  <th>Organización</th>
                  <th>Contacto</th>
                  <th>Ubicación</th>
                  <th className="text-right">Cupos</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {datos.reservas.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-texto-suave">
                      {new Date(r.creadoEn).toLocaleDateString("es-CO", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td>
                      <p className="font-medium">{bonito(r.empresa)}</p>
                      <p className="font-mono text-xs text-texto-suave">{r.nit}</p>
                    </td>
                    <td>
                      <p>{r.contacto}</p>
                      <p className="text-xs text-texto-suave">{r.correo}</p>
                    </td>
                    <td className="whitespace-nowrap">{bonito(r.ubicacion)}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">
                      {r.cuposConfirmados}
                      {r.cuposEnEspera > 0 && (
                        <span className="text-aviso"> +{r.cuposEnEspera}</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`whitespace-nowrap text-[0.75rem] font-semibold ${ESTADO[r.estado].clase}`}
                      >
                        {ESTADO[r.estado].texto}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {datos.reservas.length === 0 && (
            <p className="py-8 text-center text-sm text-texto-suave">
              Nadie ha reservado en esta acción todavía.
            </p>
          )}
        </Bloque>
      </div>

    </div>
  );
}
