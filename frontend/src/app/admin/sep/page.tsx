"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Aviso, Boton } from "@/components/admin/marco-admin";
import { Desplegable } from "@/components/admin/desplegable";
import { n } from "@/components/admin/graficos";
import { Bloque, BotonSuave, TarjetaCifra } from "@/components/admin/piezas";
import { adminApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import {
  descargarSep,
  sepApi,
  type Alistamiento,
  type AlistamientoF7,
} from "@/lib/sep-api";

type Convenio = { id: string; nombre: string; sigla: string | null; activo: boolean };

export default function PaginaSep() {
  const [convenios, setConvenios] = useState<Convenio[] | null>(null);
  const [convenioId, setConvenioId] = useState("");
  const [datos, setDatos] = useState<Alistamiento | null>(null);
  const [f7, setF7] = useState<AlistamientoF7 | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void adminApi
      .convenios()
      .then((lista) => {
        const activos = lista.filter((c) => c.activo);
        setConvenios(activos);
        if (activos.length > 0) setConvenioId(activos[0].id);
      })
      .catch((e) => setError((e as ErrorApi).message));
  }, []);

  const cargar = useCallback(async () => {
    if (!convenioId) return;
    setError(null);
    try {
      /// Los dos a la vez: el F7 va por organizacion y su
      /// cifra no se puede deducir de la de personas.
      const [personas, empresas] = await Promise.all([
        sepApi.alistamiento(convenioId),
        sepApi.alistamientoF7(convenioId),
      ]);
      setDatos(personas);
      setF7(empresas);
    } catch (e) {
      setDatos(null);
      setF7(null);
      setError((e as ErrorApi).message);
    }
  }, [convenioId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    /// La misma cáscara que el resto del panel.
    ///
    /// Esta pantalla se había quedado con una cabecera de banda
    /// propia --con borde, fondo y `px-7`-- y el cuerpo pegado a
    /// los bordes sin separación entre piezas: al lado de
    /// Resumen o Control se veía de otra aplicación. Ahora usa
    /// la cabecera plana, el mismo margen y bloques con tarjeta,
    /// que es como se leen las demás hojas.
    <div className="flex flex-col gap-3 px-4 pt-3 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.125rem] font-bold tracking-[-0.02em] text-titulo">
            Reportes al SENA
          </h1>
          <p className="mt-0.5 text-[0.78125rem] text-texto-suave">
            Quién entra en el archivo y quién no, antes de generarlo.
          </p>
        </div>

        {/* El convenio, en la cabecera: enmarca la pantalla
            entera --un archivo por convenio-- y no es un filtro
            que se cambie mientras se lee. */}
        <div className="min-w-0">
          <p className="mb-1.5 text-[0.625rem] font-bold tracking-[0.08em] uppercase text-texto-suave">
            Convenio
          </p>
          <div className="min-w-[13rem]">
            <Desplegable
              alto={34}
              etiquetaAria="Convenio"
              valor={convenioId}
              opciones={(convenios ?? []).map((c) => ({
                valor: c.id,
                etiqueta: c.sigla ?? c.nombre,
              }))}
              alElegir={setConvenioId}
            />
          </div>
          <p className="mt-1.5 max-w-xs text-[0.71875rem] text-texto-suave">
            Un archivo por convenio: el SEP nunca ha visto uno con los dos.
          </p>
        </div>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {datos && (
        <>
          {/* Las dos cifras, en la misma tira que usa Resumen. */}
          <div className="imprimible-bloque grid gap-px overflow-hidden rounded-lg border border-borde bg-hairline sm:grid-cols-2">
            <TarjetaCifra
              compacta
              etiqueta="Entran en el archivo"
              valor={n(datos.listos)}
            />
            <TarjetaCifra
              compacta
              etiqueta="Se quedan fuera"
              valor={n(datos.noListos)}
              tono={datos.noListos > 0 ? "aviso" : "neutro"}
            />
          </div>

          <Bloque
            titulo="Descargar"
            descripcion="El de control es para revisar y pasar; el del SEP es el que se sube. Las filas que no están listas no salen con huecos: van en una segunda hoja, con su motivo."
          >
            <div className="flex flex-wrap gap-3">
              <Boton
                disabled={datos.listos === 0}
                onClick={() => descargarSep(convenioId, "uso-directo")}
              >
                Reporte de control
              </Boton>
              <Boton
                disabled={datos.listos === 0}
                onClick={() => descargarSep(convenioId, "cargue-sep")}
              >
                Reporte al SEP
              </Boton>
              <BotonSuave
                disabled={f7 !== null && f7.listos === 0}
                onClick={() => descargarSep(convenioId, "f7")}
              >
                F7 · empresas
                {f7 && ` (${f7.listos})`}
              </BotonSuave>
            </div>

            <p className="mt-3 text-sm text-texto-suave">
              El <strong>F7</strong> va por organización, no por persona: una fila
              es una empresa dentro de una acción, con cuántos de los suyos se
              están formando. Sus datos los llena la propia persona desde el
              enlace de completado.
            </p>
            {datos.listos === 0 && (
              <p className="mt-3 text-sm text-texto-suave">
                Nadie está listo todavía: no tiene sentido bajar un archivo vacío.
              </p>
            )}
            {f7 && (
              <p className="mt-3 text-sm text-texto-suave">
                {f7.listos === 0
                  ? `Ninguna organización está lista para el F7${
                      f7.noListos > 0
                        ? `: hay ${f7.noListos} a las que les falta algún dato.`
                        : " todavía."
                    }`
                  : `${f7.listos} ${
                      f7.listos === 1 ? "organización entra" : "organizaciones entran"
                    } en el F7${
                      f7.noListos > 0 ? ` y ${f7.noListos} se quedan fuera.` : "."
                    }`}
              </p>
            )}
          </Bloque>

          {datos.motivos.length > 0 && (
            <Bloque
              titulo="Por qué no entran"
              descripcion="Ordenado por cuánta gente arregla cada cosa."
            >
              <div className="space-y-2">
                {datos.motivos.map((m) => (
                  <div
                    key={m.motivo}
                    className="grid grid-cols-[1fr_3rem] items-center gap-3 text-sm"
                  >
                    <span>{m.motivo}</span>
                    <span className="text-right font-mono text-texto-suave">{m.total}</span>
                  </div>
                ))}
              </div>
            </Bloque>
          )}

          {/* La lista, en su bloque y partible: era una tabla
              suelta al pie de la página, sin título y sin caja,
              y se leía como el pie de la tarjeta de arriba en
              vez de como lo que es --quiénes son los que se
              quedan fuera--. */}
          {datos.personas.length > 0 && (
            <Bloque
              partible
              sinRelleno
              titulo={`Quiénes se quedan fuera (${n(datos.personas.length)})`}
              descripcion="Una fila por participación: quien está en dos acciones sale dos veces."
            >
            <div className="caja-scroll overflow-x-auto">
              <table className="tabla-datos">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Nombre</th>
                    <th>Formación</th>
                    <th>Etapa</th>
                    <th>Qué le falta</th>
                  </tr>
                </thead>
                <tbody>
                  {/* La llave es la PARTICIPACIÓN, no la
                      persona: quien está inscrito en dos
                      acciones sale dos veces, y son dos filas
                      distintas con dos cosas que arreglar. La
                      columna «Formación» está justo para que
                      no parezcan la misma repetida. */}
                  {datos.personas.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono text-sm">{p.documento}</td>
                      <td>{p.nombre}</td>
                      <td className="text-sm text-texto-suave">
                        {p.accion ?? "—"}
                      </td>
                      <td className="text-sm">{p.etapa}</td>
                      <td className="text-sm">{p.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-7 py-3 text-[0.78125rem] text-texto-suave">
                Se arreglan desde el lead de cada persona, en{" "}
                <Link href="/admin/inscritos" className="underline">
                  Inscritos
                </Link>
                .
              </p>
            </div>
            </Bloque>
          )}
        </>
      )}
    </div>
  );
}
