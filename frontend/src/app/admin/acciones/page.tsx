"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Aviso, CLASE_CONTROL } from "@/components/admin/marco-admin";
import { Esqueleto, TarjetaCifra, Vacio } from "@/components/admin/piezas";
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
  const visibles = (acciones ?? []).filter(
    (a) => !aguja || sinTildes(`${a.codigo} ${a.nombre} ${a.convenio}`).includes(aguja),
  );

  const porConvenio = new Map<string, AccionAdmin[]>();
  for (const a of visibles) {
    porConvenio.set(a.convenio, [...(porConvenio.get(a.convenio) ?? []), a]);
  }

  const todas = acciones ?? [];
  const publicadas = todas.filter((a) => a.visible).length;
  const ocupados = todas.reduce((n, a) => n + a.cuposOcupados, 0);
  const tope = todas.reduce((n, a) => n + a.cuposMaximos, 0);

  return (
    <div>
      <header className="border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px]">
        <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">Formación</h1>
        <p className="mt-1 text-texto-suave">
          Publique u oculte cada acción. Ocultar no cancela nada: las reservas
          hechas siguen vivas y contando, la acción solo desaparece del sitio
          público.
        </p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {!acciones ? (
        <Esqueleto conCifras filas={5} />
      ) : (
        <>
          <div className="grid gap-px border-t border-b border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
            <TarjetaCifra
              etiqueta="Acciones"
              valor={todas.length}
              pie={`en ${porConvenio.size || 1} convenios`}
              icono={IconoFormacion}
            />
            <TarjetaCifra
              etiqueta="Publicadas"
              valor={publicadas}
              pie="visibles en el sitio público"
              tono="exito"
            />
            <TarjetaCifra
              etiqueta="Ocultas"
              valor={todas.length - publicadas}
              pie={
                todas.length - publicadas > 0
                  ? "no se pueden reservar"
                  : "ninguna está retirada"
              }
              tono={todas.length - publicadas > 0 ? "aviso" : "neutro"}
            />
            {/* Contra el TOPE de inscripcion, no contra la meta:
                son dos avances distintos y este es el del cupo. */}
            <TarjetaCifra
              etiqueta="Cupos ocupados"
              valor={ocupados}
              pie={`de ${tope.toLocaleString("es-CO")} disponibles`}
              tono="neutro"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-borde bg-superficie px-7 py-3">
            <input
              className={`${CLASE_CONTROL} max-w-sm`}
              placeholder="Buscar por código, curso o convenio…"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
            {buscar && (
              <button
                type="button"
                onClick={() => setBuscar("")}
                className="sin-aro text-[0.78125rem] text-texto-suave underline-offset-2 transition hover:text-marca hover:underline"
              >
                Quitar la búsqueda
              </button>
            )}
            <span className="ml-auto text-[0.78125rem] text-texto-suave tabular-nums">
              {visibles.length} de {todas.length} acciones
            </span>
          </div>
        </>
      )}

      {acciones && visibles.length === 0 && (
        <Vacio titulo="Ninguna formación coincide" icono={IconoFormacion}>
          Pruebe con el código (AF8), parte del nombre o el convenio.
        </Vacio>
      )}

      {[...porConvenio.entries()].map(([convenio, lista]) => (
        <div key={convenio}>
          {/* La misma cabecera que el cronograma: son las dos
              pantallas del mismo modulo y tienen que leerse igual. */}
          <h2 className="border-b border-hairline bg-superficie-alterna px-7 py-2 text-[0.65625rem] font-semibold tracking-[0.06em] text-marca uppercase">
            {lista[0].convenioSigla ?? convenio}
            <span className="ml-2 font-normal tracking-normal text-texto-suave normal-case">
              /{convenio} · {lista.filter((a) => a.visible).length} de {lista.length}{" "}
              publicadas
            </span>
          </h2>
          <div className="border-b border-borde bg-superficie px-7">
          {/* La fila del redisenio: el CODIGO en su propia
              columna a la izquierda, el nombre, el detalle
              debajo, y a la derecha la barra de ocupacion con
              su cifra. El codigo iba metido en medio de la
              linea de detalle -- «AF1 · CURSO virtual · 40 h» --
              y ahi no sirve para buscar: uno recorre la columna
              de codigos con el dedo, no lee la frase. */}
          <ul className="divide-y divide-hairline">
            {lista.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <div className="w-[30px] shrink-0 text-[0.65625rem] font-semibold tracking-[0.05em] text-texto-suave">
                  {a.codigo}
                </div>
                <div className="min-w-64 grow">
                  <Link
                    href={`/admin/acciones/${a.id}`}
                    className="text-[0.84375rem] font-semibold leading-snug text-titulo no-underline hover:text-marca"
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
                <div className="h-1 w-[130px] shrink-0 overflow-hidden rounded-full bg-superficie-alterna">
                  <div
                    className="h-full rounded-full bg-marca"
                    style={{
                      width: `${Math.min(100, a.cuposMaximos ? (a.cuposOcupados / a.cuposMaximos) * 100 : 0)}%`,
                    }}
                  />
                </div>
                <div className="w-[132px] shrink-0 text-right text-[0.75rem] tabular-nums text-texto">
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
                    className={`h-[30px] rounded-lg px-3 text-[0.75rem] font-semibold transition disabled:opacity-50 ${
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
  );
}
