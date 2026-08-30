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
import { Aviso, Tarjeta } from "@/components/admin/marco-admin";
import { textoDeEstado } from "@/components/admin/ritmo";
import { Esqueleto } from "@/components/admin/piezas";
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
  CONFIRMADA: { texto: "Confirmada", clase: "bg-exito-suave text-exito" },
  LISTA_ESPERA: { texto: "En espera", clase: "bg-aviso-suave text-aviso" },
  CANCELADA: { texto: "Cancelada", clase: "bg-error-suave text-error" },
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
  const activas = datos.reservas.filter((r) => r.estado !== "CANCELADA");

  return (
    <div>
      <EncabezadoImpresion
        titulo={`${datos.codigo} · ${bonito(datos.nombre)}`}
        subtitulo={datos.convenio.sigla ?? datos.convenio.slug}
      />
      <SelloDeDatos actualizadoEn={vivos.actualizadoEn} />

      <header className="border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px] no-imprimir flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin/acciones" className="text-sm text-marca hover:underline">
            ← Formación
          </Link>
          <h1 className="mt-2 text-2xl font-semibold leading-snug">{bonito(datos.nombre)}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-texto-suave">
            <span className="font-mono text-xs">{datos.codigo}</span>
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

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              datos.visible ? "bg-exito-suave text-exito" : "bg-superficie-alterna text-texto-suave"
            }`}
          >
            {datos.visible ? "Publicada" : "Oculta"}
          </span>
          <button
            onClick={alternarPublicacion}
            disabled={ocupado}
            className="rounded-xl border border-borde px-4 py-2 text-sm font-medium hover:bg-superficie-alterna disabled:opacity-50"
          >
            {datos.visible ? "Ocultar" : "Publicar"}
          </button>
          <BotonPdf />
        </div>
      </header>

      <div className="imprimible-bloque grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Avance sobre la meta" descripcion="Lo comprometido en el proyecto.">
          <Medidor
            porcentaje={datos.avanceMeta}
            color="var(--exito)"
            cifra={datos.ocupados}
            detalle={`de ${n(datos.metaBase)} beneficiarios`}
            etiqueta="Avance sobre la meta"
          />
        </Tarjeta>

        <Tarjeta titulo="Ocupación del tope" descripcion="Meta más 30 % por deserción.">
          <Medidor
            porcentaje={datos.avance}
            cifra={datos.disponibles}
            detalle={`cupos libres de ${n(datos.cupos)}`}
            etiqueta="Ocupación del tope"
          />
        </Tarjeta>

        <Tarjeta titulo="Quién ha reservado">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-3xl font-semibold tabular-nums">{datos.organizaciones}</p>
              <p className="mt-1 text-xs text-texto-suave">organizaciones</p>
            </div>
            <div>
              <p
                className={`text-3xl font-semibold tabular-nums ${
                  datos.enEspera > 0 ? "text-aviso" : ""
                }`}
              >
                {n(datos.enEspera)}
              </p>
              <p className="mt-1 text-xs text-texto-suave">en lista de espera</p>
            </div>
          </div>
          {datos.serie.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-texto-suave">
                Ritmo · últimos 60 días
              </p>
              <div className="flex h-12 items-end gap-[2px]">
                {datos.serie.map((s) => (
                  <div
                    key={s.dia}
                    title={`${s.dia}: ${n(s.cupos)} cupos`}
                    className="min-h-0.5 flex-1 rounded-t bg-marca"
                    style={{ height: `${(s.cupos / topeSerie) * 100}%` }}
                  />
                ))}
              </div>
            </div>
          )}
        </Tarjeta>
      </div>

      <Tarjeta
        titulo="Ritmo de esta acción"
        descripcion="Cupos netos por día de los últimos 14, descontando ediciones y cancelaciones."
      >
        <div className="grid sm:grid-cols-3">
          <div>
            <p className="text-3xl font-semibold tabular-nums">
              {datos.proyeccion.ritmoDiario.toLocaleString("es-CO", {
                maximumFractionDigits: 1,
              })}
            </p>
            <p className="mt-1 text-xs text-texto-suave">cupos al día</p>
          </div>
          <div>
            <p className="text-3xl font-semibold tabular-nums">{n(datos.proyeccion.faltan)}</p>
            <p className="mt-1 text-xs text-texto-suave">faltan para la meta</p>
          </div>
          <div>
            <p className="text-sm">{textoDeEstado(datos.proyeccion)}</p>
            {datos.proyeccion.confianza === "BAJA" && (
              <p className="mt-1 text-xs text-texto-suave">
                Menos de una semana de historia: la estimación es floja.
              </p>
            )}
          </div>
        </div>
      </Tarjeta>

      <div className="imprimible-bloque">
        <Tarjeta
          titulo="Oferta por ubicación"
          descripcion={`${datos.ofertas.length} ubicaciones. Es contra estas filas que se descuenta el cupo.`}
        >
          <div className="overflow-x-auto">
            <table className="tabla-datos text-sm">
              <thead>
                <tr>
                  <th>Ubicación</th>
                  <th>Modalidad</th>
                  <th className="text-right">Cupos</th>
                  <th className="text-right">Reservados</th>
                  <th className="text-right">Libres</th>
                  <th className="text-right">Espera</th>
                  <th className="min-w-32">Avance</th>
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
                    <td className="whitespace-nowrap text-texto-suave">
                      {MODALIDAD[o.modalidad]}
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
                      <BarraAvance valor={o.ocupados} maximo={o.cupos} compacta />
                    </td>
                    <td>
                      <EtiquetaEstado estado={o.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.2fr]">
        <div className="imprimible-bloque">
          <Tarjeta
            titulo="Grupos comprometidos"
            descripcion="El plan del proyecto: cuántas cohortes y con qué reparto. No llevan contador propio."
          >
            <div className="space-y-4">
              {datos.grupos.map((g) => (
                <div key={g.numero} className="rounded-lg border border-borde p-3">
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
          </Tarjeta>
        </div>

        <div className="imprimible-bloque">
          <Tarjeta
            titulo="Dónde se está llenando"
            descripcion="Cupos reservados por ubicación, ordenados."
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
          </Tarjeta>
        </div>
      </div>

      <div className="imprimible-bloque imprimible-salto">
        <Tarjeta
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
                        className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO[r.estado].clase}`}
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
        </Tarjeta>
      </div>

      {datos.objetivo && (
        <div className="imprimible-bloque">
          <Tarjeta titulo="Objetivo de la acción" descripcion="Tal como está en el proyecto.">
            <p className="text-sm leading-relaxed text-texto-suave">{datos.objetivo}</p>
          </Tarjeta>
        </div>
      )}
    </div>
  );
}
