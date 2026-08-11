"use client";

import Link from "next/link";
import { use, useCallback } from "react";

import { BotonPdf, EncabezadoImpresion } from "@/components/admin/boton-pdf";
import { BarraAvance, ListaBarras, n, TarjetaCifra } from "@/components/admin/graficos";
import {
  IndicadorActualizacion,
  SelloDeDatos,
} from "@/components/admin/indicador-actualizacion";
import { Aviso, Tarjeta } from "@/components/admin/marco-admin";
import { useDatosVivos } from "@/lib/datos-vivos";
import { tablerosApi, type InformeRespuestas, type PreguntaAgregada } from "@/lib/tableros-api";

export default function PaginaRespuestas({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const vivos = useDatosVivos<InformeRespuestas>(
    useCallback(() => tablerosApi.respuestas(id), [id]),
  );

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <p className="text-texto-suave">Cargando…</p>;

  const { formulario, totalReservas, preguntas } = vivos.datos;

  // ordenar de menor a mayor tasa
  const porTasa = [...preguntas]
    .sort((a, b) => a.tasaRespuesta - b.tasaRespuesta)
    .map((p) => ({
      etiqueta: p.etiqueta,
      valor: p.tasaRespuesta,
      detalle: `${n(p.respondidas)} de ${n(totalReservas)}`,
    }));

  return (
    <div className="space-y-6">
      <EncabezadoImpresion
        titulo={`Respuestas · ${formulario.titulo}`}
        subtitulo={`/${formulario.slug}`}
      />
      <SelloDeDatos actualizadoEn={vivos.actualizadoEn} />

      <header className="no-imprimir flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/admin/formularios/${id}`}
            className="text-sm text-marca hover:underline"
          >
            ← {formulario.titulo}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Respuestas</h1>
          <p className="mt-1 text-texto-suave">
            Qué contestó la gente, agregado. Sin nombres: la reserva es de la
            organización.
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
        <BotonPdf />
      </header>

      <div className="imprimible-bloque grid gap-4 sm:grid-cols-3">
        <TarjetaCifra titulo="Reservas del formulario" valor={totalReservas} />
        <TarjetaCifra titulo="Preguntas propias" valor={preguntas.length} />
        <TarjetaCifra
          titulo="Preguntas archivadas"
          valor={preguntas.filter((p) => p.archivada).length}
          detalle="Sus respuestas siguen contando."
        />
      </div>

      {preguntas.length === 0 ? (
        <Tarjeta titulo="Sin preguntas propias">
          <p className="text-sm text-texto-suave">
            Este formulario solo tiene campos del sistema (NIT, curso, cupos…),
            que ya salen en el informe de reservas. Cuando añada preguntas
            propias, sus respuestas se agregan aquí.
          </p>
        </Tarjeta>
      ) : (
        <>
          <Tarjeta
            titulo="Qué se contesta y qué no"
            descripcion="De menor a mayor. Una pregunta opcional que casi nadie responde sobra, o está mal formulada."
          >
            <ListaBarras datos={porTasa} sufijo=" %" />
          </Tarjeta>

          <div className="space-y-4">
            {preguntas.map((p) => (
              <BloquePregunta key={p.id} pregunta={p} totalReservas={totalReservas} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BloquePregunta({
  pregunta,
  totalReservas,
}: {
  pregunta: PreguntaAgregada;
  totalReservas: number;
}) {
  return (
    <Tarjeta
      titulo={pregunta.etiqueta}
      descripcion={
        <>
          {n(pregunta.respondidas)} de {n(totalReservas)} ({pregunta.tasaRespuesta} %)
          {pregunta.archivada && (
            <span className="ml-2 rounded-full bg-superficie-alterna px-2 py-0.5 text-xs">
              archivada
            </span>
          )}
        </>
      }
    >
      <div className="imprimible-bloque">
        {pregunta.opciones && (
          <ListaBarras
            datos={pregunta.opciones.map((o) => ({
              etiqueta: o.archivada ? `${o.etiqueta} (archivada)` : o.etiqueta,
              valor: o.veces,
              detalle: `${o.porcentaje} %`,
            }))}
            vacio="Nadie ha elegido ninguna opción todavía."
          />
        )}

        {pregunta.casilla && (
          <BarraAvance
            etiqueta="Marcaron que sí"
            valor={pregunta.casilla.si}
            maximo={pregunta.casilla.si + pregunta.casilla.no}
          />
        )}

        {pregunta.numero && (
          <div className="grid gap-4 sm:grid-cols-4">
            <TarjetaCifra titulo="Media" valor={pregunta.numero.media ?? "—"} />
            <TarjetaCifra titulo="Mediana" valor={pregunta.numero.mediana ?? "—"} />
            <TarjetaCifra titulo="Mínimo" valor={pregunta.numero.minimo ?? "—"} />
            <TarjetaCifra titulo="Máximo" valor={pregunta.numero.maximo ?? "—"} />
          </div>
        )}

        {pregunta.texto && (
          <>
            <p className="mb-2 text-sm text-texto-suave">
              Las {pregunta.texto.length} más recientes. El texto libre no se
              agrega: contar frases distintas da una lista de unos.
            </p>
            {pregunta.texto.length ? (
              <ul className="caja-scroll max-h-80 space-y-2 overflow-y-auto text-sm">
                {pregunta.texto.map((t, i) => (
                  <li key={i} className="rounded-lg bg-superficie-alterna p-3">
                    {t}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-texto-suave">
                Nadie ha escrito nada todavía.
              </p>
            )}
          </>
        )}
      </div>
    </Tarjeta>
  );
}
