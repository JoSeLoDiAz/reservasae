"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Aviso } from "@/components/admin/marco-admin";
import { Cifra, Esqueleto, Vacio } from "@/components/admin/piezas";
import { Desplegable } from "@/components/admin/desplegable";
import { IconoFormacion } from "@/components/admin/iconos";
import { adminApi, type AccionAdmin } from "@/lib/admin-api";
import { bonito, ErrorApi } from "@/lib/api";

const MODALIDAD = {
  PRESENCIAL: "Presencial",
  VIRTUAL: "Virtual",
  HIBRIDA: "Híbrido",
} as const;

export default function PaginaAcciones() {
  const [acciones, setAcciones] = useState<AccionAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");
  const [gremio, setGremio] = useState("");
  const [publicacion, setPublicacion] = useState("");
  const [modalidad, setModalidad] = useState("");

  const cargar = useCallback(async () => {
    setAcciones(await adminApi.acciones());
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function alternar(accion: AccionAdmin) {
    setError(null);
    setOcupada(accion.id);
    try {
      await adminApi.publicarAccion(accion.id, !accion.visible);
      await cargar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupada(null);
    }
  }

  /// El mismo buscador que el cronograma: son las dos caras de
  /// la misma lista y se buscan igual.
  const sinTildes = (t: string) =>
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const aguja = sinTildes(buscar.trim());
  const todas = acciones ?? [];
  const visibles = todas.filter(
    (a) =>
      (!aguja || sinTildes(`${a.codigo} ${a.nombre} ${a.convenio}`).includes(aguja)) &&
      (!gremio || a.convenio === gremio) &&
      (!modalidad || a.modalidad === modalidad) &&
      (!publicacion ||
        (publicacion === "PUBLICADA" ? a.visible : !a.visible)),
  );

  const porConvenio = new Map<string, AccionAdmin[]>();
  for (const a of visibles) {
    porConvenio.set(a.convenio, [...(porConvenio.get(a.convenio) ?? []), a]);
  }

  const gremios = [...new Set(todas.map((a) => a.convenio))];
  const modalidades = [...new Set(todas.map((a) => a.modalidad))];
  const hayFiltro = Boolean(aguja || gremio || publicacion || modalidad);

  /// Las cifras cuentan lo que se esta VIENDO, como en el
  /// cronograma: si dijeran siempre el total, el filtro y la
  /// tarjeta contarian cosas distintas.
  const publicadas = visibles.filter((a) => a.visible).length;
  const ocupados = visibles.reduce((n, a) => n + a.cuposOcupados, 0);
  const tope = visibles.reduce((n, a) => n + a.cuposMaximos, 0);
  const deTotal = (n: number) => (hayFiltro ? `de ${n} en total` : null);

  function limpiar() {
    setBuscar("");
    setGremio("");
    setPublicacion("");
    setModalidad("");
  }

  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-6">
      <div className="no-imprimir">
        <h1 className="text-[1.125rem] font-bold tracking-[-0.02em] text-titulo">
          Acciones de formación
        </h1>
        <p className="mt-0.5 text-[0.78125rem] text-texto-suave">
          Publique u oculte cada acción. Ocultar no cancela nada: las reservas hechas
          siguen vivas y contando, la acción solo desaparece del sitio público.
        </p>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {!acciones ? (
        <Esqueleto conCifras filas={5} />
      ) : (
        <>
          <div className="no-imprimir flex flex-wrap gap-2.5">
            <Cifra
              etiqueta="Acciones de formación"
              valor={visibles.length}
              pie={deTotal(todas.length) ?? `en ${gremios.length} convenios`}
            />
            <Cifra
              etiqueta="Publicadas"
              valor={publicadas}
              color="var(--exito)"
              pie="se ven en el sitio público"
            />
            <Cifra
              etiqueta="Ocultas"
              valor={visibles.length - publicadas}
              color={
                visibles.length - publicadas > 0 ? "var(--aviso)" : "var(--titulo)"
              }
              pie={
                visibles.length - publicadas > 0
                  ? "no se pueden reservar"
                  : "ninguna está retirada"
              }
            />
            {/* Contra el TOPE de inscripcion, no contra la meta:
                son dos avances distintos y este es el del cupo. */}
            <Cifra
              etiqueta="Cupos ocupados"
              valor={ocupados}
              pie={`de ${tope.toLocaleString("es-CO")} disponibles`}
            />
          </div>

          <div className="no-imprimir flex flex-wrap items-center gap-2.5">
            <input
              className="h-[34px] min-w-[170px] flex-1 rounded-lg border border-campo-borde bg-campo-fondo px-3 text-[0.78125rem] outline-none transition focus:border-campo-foco"
              placeholder="Buscar por código, curso o convenio…"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />

            <div className="w-[190px]">
              <Desplegable
                alto={34}
                marcador="Convenios"
                valor={gremio}
                opciones={[
                  { valor: "", etiqueta: "Convenios" },
                  ...gremios.map((g) => ({
                    valor: g,
                    etiqueta: todas.find((a) => a.convenio === g)?.convenioSigla ?? g,
                    detalle: `${todas.filter((a) => a.convenio === g).length} acciones`,
                  })),
                ]}
                alElegir={setGremio}
              />
            </div>

            <div className="w-[180px]">
              <Desplegable
                alto={34}
                marcador="Publicación"
                valor={publicacion}
                opciones={[
                  { valor: "", etiqueta: "Publicación" },
                  {
                    valor: "PUBLICADA",
                    etiqueta: "Publicadas",
                    detalle: `${todas.filter((a) => a.visible).length} acciones`,
                  },
                  {
                    valor: "OCULTA",
                    etiqueta: "Ocultas",
                    detalle: `${todas.filter((a) => !a.visible).length} acciones`,
                  },
                ]}
                alElegir={setPublicacion}
              />
            </div>

            <div className="w-[180px]">
              <Desplegable
                alto={34}
                marcador="Modalidad"
                valor={modalidad}
                opciones={[
                  { valor: "", etiqueta: "Modalidad" },
                  ...modalidades.map((m) => ({
                    valor: m,
                    etiqueta: MODALIDAD[m as keyof typeof MODALIDAD] ?? m,
                    detalle: `${todas.filter((a) => a.modalidad === m).length} acciones`,
                  })),
                ]}
                alElegir={setModalidad}
              />
            </div>

            {hayFiltro && (
              <button
                type="button"
                onClick={limpiar}
                className="sin-aro inline-flex h-[34px] items-center rounded-lg border border-borde bg-superficie px-3.5 text-[0.78125rem] font-semibold whitespace-nowrap text-titulo transition hover:border-marca"
              >
                Quitar filtros
              </button>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="sin-aro inline-flex h-[34px] items-center rounded-lg border border-borde bg-superficie px-3.5 text-[0.78125rem] font-semibold whitespace-nowrap text-titulo transition hover:border-marca"
            >
              Exportar a PDF
            </button>
          </div>
        </>
      )}

      {/* Lo que sale en el PDF: el catálogo, sin los controles. */}
      {acciones && visibles.length > 0 && (
        <div className="solo-impresion holgada">
          <p className="titulo-impreso">
            Formación · {visibles.length} acciones · {publicadas} publicadas
          </p>
          {[...porConvenio.entries()].map(([convenio, lista]) => (
            <section key={convenio} className="bloque-de-accion">
              <h2 className="titulo-de-accion">
                {lista[0].convenioSigla ?? convenio} · /{convenio} ·{" "}
                {lista.filter((a) => a.visible).length} de {lista.length} publicadas
              </h2>
              <table className="tabla-datos w-full">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Acción de formación</th>
                    <th>Evento</th>
                    <th>Modalidad</th>
                    <th>Horas</th>
                    <th>Ubicaciones</th>
                    <th>Cupos</th>
                    <th>Publicación</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((a) => (
                    <tr key={a.id}>
                      <td>{a.codigo}</td>
                      <td className="envuelve">{bonito(a.nombre)}</td>
                      <td>{a.evento}</td>
                      <td>{MODALIDAD[a.modalidad]}</td>
                      <td className="tabular-nums">{a.horas ? `${a.horas} h` : "—"}</td>
                      <td className="tabular-nums">{a.ofertas}</td>
                      <td className="tabular-nums">
                        {a.cuposOcupados} de {a.cuposMaximos}
                      </td>
                      <td>{a.visible ? "Publicada" : "Oculta"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}

      {acciones && visibles.length === 0 && (
        <Vacio titulo="Sin resultados" icono={IconoFormacion}>
          Ninguna acción de formación coincide con los criterios aplicados. Pruebe con
          el código (AF8), parte del nombre o el convenio.
        </Vacio>
      )}

      <div className="no-imprimir overflow-hidden rounded-lg border border-borde bg-superficie">
      {[...porConvenio.entries()].map(([convenio, lista]) => (
        <div key={convenio} className="border-t border-borde first:border-t-0">
          {/* La misma cabecera que el cronograma: son las dos
              pantallas del mismo modulo y tienen que leerse igual. */}
          <h2 className="flex items-center justify-between gap-3 border-b border-borde bg-marca-suave px-7 py-2.5 text-[0.65625rem] font-bold tracking-[0.06em] text-marca uppercase">
            <span>{lista[0].convenioSigla ?? convenio}</span>
            <span className="tracking-normal text-texto-suave normal-case tabular-nums">
              {lista.filter((a) => a.visible).length} de {lista.length} publicadas
            </span>
          </h2>
          <div className="px-7">
          {/* La fila del redisenio: el CODIGO en su propia
              columna a la izquierda, el nombre, el detalle
              debajo, y a la derecha la barra de ocupacion con
              su cifra. El codigo iba metido en medio de la
              linea de detalle -- «AF1 · CURSO virtual · 40 h» --
              y ahi no sirve para buscar: uno recorre la columna
              de codigos con el dedo, no lee la frase. */}
          {/* Titulos de columna. Sin ellos la barra es una raya
              azul sin nombre: no se sabe si es ocupacion, avance
              o tiempo. */}
          <div className="flex flex-wrap items-center gap-x-4 border-b border-hairline py-2 text-[0.65625rem] font-bold tracking-[0.06em] text-texto-suave uppercase">
            <div className="w-[30px] shrink-0">AF</div>
            <div className="min-w-64 grow">Acción de formación</div>
            <div className="w-[130px] shrink-0">Ocupación</div>
            <div className="w-[132px] shrink-0">Cupos</div>
            <div className="flex items-center gap-3">
              <span className="w-[68px]">Estado</span>
              <span className="w-[62px]">Acción</span>
            </div>
          </div>

          <ul className="divide-y divide-hairline">
            {lista.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <div className="w-[30px] shrink-0 text-[0.65625rem] font-semibold tracking-[0.05em] text-texto-suave">
                  {a.codigo}
                </div>
                <div className="min-w-64 grow">
                  <Link
                    href={`/admin/acciones/${a.id}`}
                    className="text-[0.84375rem] leading-snug text-titulo no-underline hover:text-marca"
                  >
                    {bonito(a.nombre)}
                  </Link>
                  <p className="mt-0.5 text-[0.71875rem] text-texto-suave">
                    {a.evento} {MODALIDAD[a.modalidad].toLowerCase()}
                    {a.horas ? ` · ${a.horas} h` : ""} · {a.ofertas} ubicaciones
                  </p>
                </div>

                {/* Cuanto lleva lleno. La proporcion se ve, el
                    numero se lee: hacen falta los dos. */}
                <div className="h-2 w-[130px] shrink-0 overflow-hidden rounded-full bg-superficie-alterna">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-marca to-marca/40"
                    style={{
                      width: `${Math.min(100, a.cuposMaximos ? (a.cuposOcupados / a.cuposMaximos) * 100 : 0)}%`,
                    }}
                  />
                </div>
                <div className="w-[132px] shrink-0 text-[0.75rem] tabular-nums text-texto">
                  {a.cuposOcupados} de {a.cuposMaximos} cupos
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`w-[68px] text-[0.75rem] font-semibold whitespace-nowrap ${
                      a.visible ? "text-exito" : "text-texto-suave"
                    }`}
                  >
                    {a.visible ? "Publicada" : "Oculta"}
                  </span>
                  <button
                    onClick={() => alternar(a)}
                    disabled={ocupada === a.id}
                    className={`h-[30px] w-[62px] rounded-lg px-3 text-[0.75rem] font-semibold transition disabled:opacity-50 ${
                      a.visible
                        ? "border border-borde bg-superficie hover:bg-superficie-alterna"
                        : "bg-marca text-marca-texto hover:bg-marca-fuerte"
                    }`}
                  >
                    {ocupada === a.id ? "…" : a.visible ? "Ocultar" : "Publicar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
