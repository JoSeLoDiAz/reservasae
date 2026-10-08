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
 * DENTRO DE LA FILA, y van TRES SITIOS en quince dias. Nacio en el
 * `Cajon` lateral; el 25 sep el cliente lo bajo a una subtabla ---«que
 * salga una subtabla, o sea como Control de inscritos»---; y el 7 oct
 * Josse lo metio dentro de la propia fila: «que no es que al darle
 * clic en Juliet Herrera abajo me salga otra tabla, sino que me
 * despliegue dentro de la misma tabla donde esta Juliet».
 *
 * Las dos formas anteriores tenian su razon y las dos se quedaron
 * cortas por lo mismo ---la DISTANCIA---: en el cajon el nombre de la
 * accion caia en una columna de 110 px que lo partia letra a letra
 * («GESTIO N DE LA ATENCION Y NEUROEDU CACION»), y la subtabla de
 * debajo, con veinticinco asesores en pantalla, dejaba el desglose a
 * cinco pantallas de scroll de la fila que uno acababa de pulsar. Lo
 * que la fila da es el ancho de la pagina Y el sitio.
 *
 * ESTE COMPONENTE NO SABE DONDE ESTA, y asi se queda: recibe la fila
 * y pinta. Quien decide donde sale es `panel-asesores`, con el
 * `desplegado` de la `Tabla`. Por eso la mudanza costo una linea.
 */

import type { FilaDeAsesor } from "@/lib/crm-api";

import { n } from "./graficos";
import { Bloque } from "./piezas";

export function DesgloseDelAsesor({
  fila,
  alCerrar,
}: {
  fila: FilaDeAsesor;
  alCerrar: () => void;
}) {
  const porAccion = fila.porAccion ?? [];

  return (
    <Bloque
      sinRelleno
      partible
      titulo={`Acciones de ${fila.nombre}`}
      descripcion={
        <>
          {n(fila.carga.total)} {fila.carga.total === 1 ? "lead" : "leads"} en total
          {porAccion.length > 0 && (
            <>
              {" · "}
              {porAccion.length}{" "}
              {porAccion.length === 1 ? "acción de formación" : "acciones de formación"}
            </>
          )}
        </>
      }
      acciones={
        <button
          type="button"
          onClick={alCerrar}
          className="no-imprimir shrink-0 text-[0.75rem] font-medium text-marca underline underline-offset-2 hover:text-marca-fuerte"
        >
          Cerrar
        </button>
      }
    >
      {porAccion.length === 0 ? (
        /// PASA DE VERDAD y hay que decirlo con sus palabras: un
        /// backend sin reiniciar no manda `porAccion`, y una tabla
        /// vacía se lee como «este asesor no tiene nada».
        <p className="px-4 py-4 text-sm text-texto-suave">
          El servidor no está enviando el desglose por acción. Si acaba de actualizarse, hay que
          reiniciarlo.
        </p>
      ) : (
        <div className="caja-scroll overflow-x-auto">
          <table className="tabla-datos w-full">
            <thead>
              <tr>
                <th className="w-full">Acción de formación</th>
                <th className="text-right whitespace-nowrap">Leads</th>
                <th className="text-right whitespace-nowrap">Gestionados</th>
                {/* INSCRITOS Y DESCARTADOS, EN DOS COLUMNAS.
                    Iban sumados en una sola ---«Inscritos y
                    descartados»--- y los dos numeros ya viajaban por
                    separado: lo que la columna enseñaba era
                    `resueltos`, o sea la suma. Josse los pidio
                    separados el 7 oct ---«los leads asignados, los
                    gestionados, los inscritos, los descartados»--- y
                    tiene razon de sobra: diez inscritos y cero
                    descartados no es el mismo asesor que cero
                    inscritos y diez descartados, y sumados se leen
                    igual. */}
                <th className="text-right whitespace-nowrap">Inscritos</th>
                <th className="text-right whitespace-nowrap">Descartados</th>
                <th className="text-right whitespace-nowrap">Pendientes</th>
              </tr>
            </thead>
            <tbody>
              {porAccion.map((a) => (
                <tr key={a.accionFormacionId ?? "sin-accion"}>
                  {/* EL CÓDIGO Y EL NOMBRE: hay dos acciones con
                      código «AF1», y una columna de códigos deja dos
                      filas iguales sin poder distinguirlas. */}
                  <td className="font-medium">
                    {a.codigo ? (
                      <>
                        <span className="font-mono text-xs text-texto-suave">{a.codigo}</span>
                        {a.nombre && <span className="ml-2">{a.nombre}</span>}
                      </>
                    ) : (
                      <span className="text-texto-suave">Sin acción asignada</span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{n(a.total)}</td>
                  <td className="text-right tabular-nums">{n(a.gestionados)}</td>
                  <td className="text-right font-medium text-exito tabular-nums">
                    {n(a.inscritos)}
                  </td>
                  <td className="text-right tabular-nums">{n(a.descartados)}</td>
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
                  {n(porAccion.reduce((s, a) => s + a.inscritos, 0))}
                </td>
                <td className="text-right tabular-nums">
                  {n(porAccion.reduce((s, a) => s + a.descartados, 0))}
                </td>
                <td className="text-right tabular-nums">
                  {n(porAccion.reduce((s, a) => s + a.pendientes, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Bloque>
  );
}
