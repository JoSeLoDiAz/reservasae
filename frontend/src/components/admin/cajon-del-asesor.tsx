"use client";

/**
 * EL DESGLOSE DE UN ASESOR, ACCIÓN POR ACCIÓN.
 *
 * «Con al menos dos métricas, y como la tablita que cuando uno da
 * clic sale el desglose detallado» (cliente, 23 sep 2026).
 *
 * La tabla de fuera responde «¿quién va mal?»; esta responde la
 * siguiente, que es «¿dónde?». Un asesor con cuarenta pendientes
 * repartidos entre seis acciones no tiene el mismo problema que uno
 * con cuarenta en una sola: al primero se le ayuda con tiempo, al
 * segundo hay que quitarle esa acción.
 *
 * POR ACCIÓN Y NO POR GRUPO, y el porqué viene del servidor
 * (`asesores-datos.ts`): lo que aprieta a un asesor es la fecha de
 * cierre, y esa es de la acción ---el cierre más próximo de sus
 * grupos---. Por grupo salen filas de uno o dos leads y ninguna
 * responde dónde se le está acumulando.
 *
 * CON EL `Cajon` DE LA CASA, el mismo que abre un lead y el mismo del
 * aula: lateral, 672 px, con velo, bloqueo de desplazamiento y
 * Escape. No se inventa un panel nuevo para la tercera pantalla que
 * necesita lo mismo.
 */

import { Cajon } from "@/components/admin/cajon";
import type { FilaDeAsesor } from "@/lib/crm-api";

import { n } from "./graficos";

export function CajonDelAsesor({
  fila,
  alCerrar,
}: {
  fila: FilaDeAsesor;
  alCerrar: () => void;
}) {
  const porAccion = fila.porAccion ?? [];

  return (
    <Cajon
      titulo={fila.nombre}
      subtitulo={
        <>
          {n(fila.carga.total)} {fila.carga.total === 1 ? "lead" : "leads"} en total
          {porAccion.length > 0 && (
            <>
              {" · "}
              {porAccion.length}{" "}
              {porAccion.length === 1
                ? "acción de formación"
                : "acciones de formación"}
            </>
          )}
        </>
      }
      alCerrar={alCerrar}
    >
      <section>
        <h3 className="text-xs font-semibold tracking-[0.08em] text-texto-suave uppercase">
          Dónde se le está acumulando
        </h3>
        <p className="mt-1 text-[0.75rem] leading-snug text-texto-suave">
          Sus leads repartidos por acción de formación, con los de más
          pendientes arriba.
        </p>

        {porAccion.length === 0 ? (
          /// PASA DE VERDAD y hay que decirlo con sus palabras: un
          /// backend sin reiniciar no manda `porAccion`, y una tabla
          /// vacía se lee como «este asesor no tiene nada».
          <p className="mt-4 rounded-lg bg-superficie-alterna px-3.5 py-3 text-sm text-texto-suave">
            El servidor no está enviando el desglose por acción. Si acaba de
            actualizarse, hay que reiniciarlo.
          </p>
        ) : (
          <div className="caja-scroll mt-3 overflow-x-auto">
            <table className="tabla-datos w-full">
              <thead>
                <tr>
                  <th className="w-full">Acción de formación</th>
                  <th className="text-right whitespace-nowrap">Leads</th>
                  <th className="text-right whitespace-nowrap">Gestionados</th>
                  <th className="text-right whitespace-nowrap">
                    Inscritos y descartados
                  </th>
                  <th className="text-right whitespace-nowrap">Pendientes</th>
                </tr>
              </thead>
              <tbody>
                {porAccion.map((a) => (
                  <tr key={a.accionFormacionId ?? "sin-accion"}>
                    {/* EL CÓDIGO Y EL NOMBRE: hay dos acciones con
                        código «AF1», y una columna de códigos deja
                        dos filas iguales sin poder distinguirlas. */}
                    <td className="font-medium">
                      {a.codigo ? (
                        <>
                          <span className="font-mono text-xs text-texto-suave">
                            {a.codigo}
                          </span>
                          {a.nombre && <span className="ml-2">{a.nombre}</span>}
                        </>
                      ) : (
                        <span className="text-texto-suave">Sin acción asignada</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{n(a.total)}</td>
                    <td className="text-right tabular-nums">{n(a.gestionados)}</td>
                    <td className="text-right font-medium text-exito tabular-nums">
                      {n(a.resueltos)}
                    </td>
                    {/* EL PENDIENTE EN ROJO, que es a lo que se viene:
                        con cinco columnas de números, el que decide
                        tiene que saltar a la vista sin leerlas todas. */}
                    <td
                      className={
                        "text-right font-semibold tabular-nums " +
                        (a.pendientes > 0 ? "text-error" : "")
                      }
                    >
                      {n(a.pendientes)}
                    </td>
                  </tr>
                ))}
                {/* EL TOTAL SE SUMA DE ESTAS FILAS y no se toma de
                    `fila.carga`: si algún día las dos cuentas
                    discreparan, aquí se ve. Tomarlo de fuera taparía
                    justo el fallo que esta tabla serviría para
                    encontrar. */}
                <tr className="border-t-2 border-borde font-semibold">
                  <td>Total</td>
                  <td className="text-right tabular-nums">
                    {n(porAccion.reduce((s, a) => s + a.total, 0))}
                  </td>
                  <td className="text-right tabular-nums">
                    {n(porAccion.reduce((s, a) => s + a.gestionados, 0))}
                  </td>
                  <td className="text-right tabular-nums">
                    {n(porAccion.reduce((s, a) => s + a.resueltos, 0))}
                  </td>
                  <td className="text-right tabular-nums">
                    {n(porAccion.reduce((s, a) => s + a.pendientes, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Cajon>
  );
}
