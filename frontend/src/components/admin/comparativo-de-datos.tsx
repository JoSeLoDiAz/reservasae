"use client";

/** Los mismos datos, dichos por la ficha, los leads y el RUI. */

/**
 * Lo miran tres perfiles distintos y tiene que servirles a los
 * tres: el asesor que va a corregir, el líder de sistemas que
 * revisa, y el coordinador de consulta que solo mira.
 *
 * Por eso la pantalla se lee sin instrucciones: una fila por
 * dato, una columna por quien lo dijo, y el botón solo donde hay
 * algo que hacer. Quien no puede escribir no ve botones y la
 * tabla se lee igual de bien.
 *
 * NADA SE APLICA SOLO, ni siquiera un hueco vacío. Traer por
 * nuestra cuenta un dato que llegó por un anuncio es decidir por
 * la persona sin que nadie lo mire.
 */

import { useCallback, useState } from "react";

import {
  comparativoApi,
  type Comparativo,
  type Dicho,
  type FilaComparada,
} from "@/lib/mesa-api";
import { ErrorApi } from "@/lib/api";
import { useDatosVivos } from "@/lib/datos-vivos";

import { Aviso, Boton } from "./marco-admin";

/// Cómo se lee un origen en la cabecera de su columna.
const COMO_LLEGO: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  LINKEDIN: "LinkedIn",
  REDES: "Redes",
  AUTOGESTION: "Se inscribió sola",
  REFERIDO: "Referido",
  EVENTO: "Evento",
  CORREO: "Correo",
  OTRO: "Otro",
};

function cuando(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  });
}

export function ComparativoDeDatos({
  participanteId,
  puedeEscribir,
  alAplicar,
}: {
  participanteId: string;
  /// Sin esto no se pintan botones. El coordinador de consulta
  /// tiene que poder revisarlo entero sin poder tocar nada.
  puedeEscribir: boolean;
  /// Guarda un campo en la ficha. Lo hace quien la pinta, que es
  /// quien ya tiene el PATCH y sabe recargar lo suyo.
  alAplicar: (clave: string, valor: string | number | null) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState<string | null>(null);

  const cargar = useCallback(
    () => comparativoApi.de(participanteId),
    [participanteId],
  );
  const { datos, refrescar } = useDatosVivos<Comparativo>(cargar, {
    /// No se refresca solo: se está leyendo y comparando, y que
    /// las columnas cambien debajo del cursor mientras alguien
    /// decide es peor que tener el dato de hace un minuto.
    activo: false,
  });

  async function aplicar(fila: FilaComparada, d: Dicho) {
    if (!fila.clave) return;
    setAplicando(fila.campo);
    try {
      await alAplicar(fila.clave, d.valor);
      refrescar();
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo guardar.");
    } finally {
      setAplicando(null);
    }
  }

  if (!datos) return null;

  /// Si no hay más fuentes, no hay nada que comparar.
  if (datos.fuentes.length === 0 && !datos.rui) return null;

  return (
    <section className="space-y-3 rounded-xl border border-borde p-5">
      <div>
        <h3 className="font-semibold">De dónde salen estos datos</h3>
        <p className="mt-0.5 text-sm text-texto-suave">
          {/* Se dice qué hay antes de enseñar la tabla: quien la
              abre y no tiene nada que decidir se ahorra leerla. */}
          {datos.discrepan === 0 && datos.faltan === 0
            ? "Todo lo que dijo por otros medios coincide con la ficha."
            : [
                datos.faltan > 0 &&
                  `${datos.faltan} ${datos.faltan === 1 ? "dato falta" : "datos faltan"} en la ficha y ${datos.faltan === 1 ? "está" : "están"} en otro lado`,
                datos.discrepan > 0 &&
                  `${datos.discrepan} ${datos.discrepan === 1 ? "no coincide" : "no coinciden"}`,
              ]
                .filter(Boolean)
                .join(" · ")}
        </p>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="caja-scroll overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs tracking-wide text-texto-suave uppercase">
            <tr>
              <th className="py-2 pr-4 font-medium">Dato</th>
              <th className="py-2 pr-4 font-medium">En la ficha</th>
              {datos.fuentes.map((f) => (
                <th key={f.id} className="py-2 pr-4 font-medium">
                  {COMO_LLEGO[f.origen] ?? f.origen}
                  <span className="block text-[10px] normal-case opacity-70">
                    {cuando(f.recibidoEn)}
                  </span>
                </th>
              ))}
              {datos.rui && (
                <th className="py-2 pr-4 font-medium">
                  RUI
                  {/* Que sea del simulador se dice SIEMPRE: una
                      respuesta inventada que parece del Estado es
                      peor que no tener ninguna. */}
                  <span className="block text-[10px] normal-case opacity-70">
                    {datos.rui.simulado ? "simulado" : "del registro"}
                  </span>
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {datos.filas.map((f) => (
              <tr
                key={f.campo}
                className="border-t border-borde align-top"
              >
                <td className="py-2.5 pr-4">
                  <div className="font-medium">{f.etiqueta}</div>
                  {/* El estado en palabras, no en color: un
                      estado que solo se distingue por el color no
                      se distingue bajo daltonismo. */}
                  {f.falta && (
                    <div className="text-xs text-aviso">falta en la ficha</div>
                  )}
                  {f.discrepa && (
                    <div className="text-xs text-error">no coinciden</div>
                  )}
                </td>

                <td className="py-2.5 pr-4">
                  {f.ficha.texto ?? (
                    <span className="text-texto-suave">—</span>
                  )}
                </td>

                {f.leads.map((d) => (
                  <Celda
                    key={d.deQuien}
                    dicho={d}
                    fila={f}
                    puede={puedeEscribir && Boolean(f.clave)}
                    ocupado={aplicando === f.campo}
                    alAplicar={() => aplicar(f, d)}
                  />
                ))}

                {datos.rui && (
                  <Celda
                    dicho={f.rui ?? { valor: null, texto: null }}
                    fila={f}
                    /// Del RUI solo se trae, y solo el nombre: es
                    /// el registro legal del Estado, no es nuestro
                    /// para corregirlo.
                    puede={puedeEscribir && Boolean(f.clave) && Boolean(f.rui)}
                    ocupado={aplicando === f.campo}
                    alAplicar={() => f.rui && aplicar(f, f.rui)}
                  />
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-texto-suave">
        {/* Se dice por qué no se rellena solo. Un sistema que
            pudiendo hacerlo no lo hace parece roto si no explica
            que es a propósito. */}
        Nada se copia solo: lo que llegó por otro medio se queda como está
        hasta que alguien lo traiga. El documento no se cambia desde aquí.
      </p>
    </section>
  );
}

/// Una celda: el valor, y el botón solo si hay algo que traer.
function Celda({
  dicho,
  fila,
  puede,
  ocupado,
  alAplicar,
}: {
  dicho: Dicho;
  fila: FilaComparada;
  puede: boolean;
  ocupado: boolean;
  alAplicar: () => void;
}) {
  const vacia = dicho.valor === null || dicho.valor === "";
  const igual =
    !vacia &&
    String(dicho.valor ?? "").trim().toLowerCase() ===
      String(fila.ficha.valor ?? "").trim().toLowerCase();

  return (
    <td className="py-2.5 pr-4">
      {vacia ? (
        <span className="text-texto-suave">—</span>
      ) : (
        <>
          <div className={igual ? "text-texto-suave" : "font-medium"}>
            {dicho.texto}
          </div>
          {/* Sin botón cuando ya dice lo mismo: un botón que no
              cambia nada invita a pulsarlo para averiguar qué
              hace. */}
          {!igual && puede && (
            <Boton
              onClick={alAplicar}
              disabled={ocupado}
              className="mt-1 !h-[26px] !px-2 !text-[11px]"
            >
              {ocupado ? "Guardando…" : "Traer este"}
            </Boton>
          )}
        </>
      )}
    </td>
  );
}
