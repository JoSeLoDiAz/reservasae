"use client";

/** El portafolio: lo que Grupo AE oferta al público. */

/**
 * Dos familias, EDUCACIÓN y EMPRESAS, con la lista TAL CUAL la mandó
 * la dirección el 17 sep 2026.
 *
 * Aquí se ve qué se vende y cuántos negocios lleva cada servicio, que
 * es la pregunta que el portafolio vino a contestar. Quien tiene
 * configuración con escritura puede además corregir el tipo y la
 * unidad, y ocultar lo que se deja de ofertar.
 *
 * OCULTAR Y NO BORRAR: un servicio que ya no se oferta sigue siendo lo
 * que se vendió en los negocios que lo llevan. Por eso no hay botón de
 * borrar, igual que en el resto del panel.
 */

import { useCallback, useEffect, useState } from "react";

import { Rotulo } from "@/components/admin/bloques";
import { CLASE_CONTROL, useAdmin } from "@/components/admin/marco-admin";
import { Cargando } from "@/components/admin/piezas";
import { AvisoDeSeccion, CabeceraDePantalla, Seccion } from "@/components/admin/secciones";
import { alcanza } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import {
  FAMILIAS,
  ROTULO_TIPO,
  serviciosApi,
  type Servicio,
  type TipoServicio,
} from "@/lib/servicios-api";

/// «1 activo», «2 activos»: el rótulo decía «1 ocultos».
const cuantos = (n: number, palabra: string) => `${n} ${palabra}${n === 1 ? "" : "s"}`;

export default function PaginaPortafolio() {
  const { admin } = useAdmin();
  const puedeEditar =
    admin.rol === "SUPERADMIN" || alcanza(admin.permisos?.configuracion, "ESCRIBIR");

  const [servicios, setServicios] = useState<Servicio[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  /// Guardar sin decirlo parecía que no guardaba (QA, 17 sep 2026).
  const [guardado, setGuardado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setServicios(await serviciosApi.todos());
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No pudimos traer el portafolio.");
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function cambiar(
    s: Servicio,
    cambios: Partial<Pick<Servicio, "tipo" | "unidad" | "visible">>,
  ) {
    setGuardando(s.id);
    setError(null);
    setGuardado(null);
    try {
      const nuevo = await serviciosApi.actualizar(s.id, cambios);
      setServicios((lista) =>
        (lista ?? []).map((x) => (x.id === s.id ? { ...x, ...nuevo, _count: x._count } : x)),
      );
      setGuardado(`Cambio guardado en «${s.nombre}».`);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No pudimos guardar el cambio.");
    } finally {
      setGuardando(null);
    }
  }

  const activos = servicios?.filter((s) => s.visible).length ?? 0;

  return (
    <div className="flex min-h-0 grow flex-col">
      <CabeceraDePantalla
        titulo="Portafolio de servicios"
        nota={
          servicios
            ? `Lo que se oferta al público: ${activos === 1 ? "1 servicio activo" : `${activos} servicios activos`} en dos familias. Cada negocio del embudo elige uno.`
            : "Lo que se oferta al público, en dos familias."
        }
      />

      {error && <AvisoDeSeccion color="var(--texto-suave)">{error}</AvisoDeSeccion>}
      {guardado && !error && <AvisoDeSeccion color="var(--exito)">{guardado}</AvisoDeSeccion>}

      {!servicios && !error && (
        <Seccion>
          <div className="px-6 py-8">
            <Cargando que="Trayendo el portafolio…" />
          </div>
        </Seccion>
      )}

      {servicios &&
        FAMILIAS.map((f) => {
          const suyos = servicios.filter((s) => s.familia === f.valor);
          return (
            <Seccion key={f.valor}>
              <div className="px-6 pt-5 pb-6">
                {/* Activos y ocultos por separado: decía «9 servicios»
                    aunque uno estuviera oculto. */}
                <Rotulo>
                  {f.rotulo} · {cuantos(suyos.filter((s) => s.visible).length, "activo")}
                  {suyos.some((s) => !s.visible)
                    ? ` · ${cuantos(suyos.filter((s) => !s.visible).length, "oculto")}`
                    : ""}
                </Rotulo>
                <div className="mt-3 overflow-x-auto">
                  <table className="tabla-datos w-full">
                    <thead>
                      <tr>
                        <th className="text-left">Servicio</th>
                        <th className="text-left">Tipo</th>
                        <th className="text-left">Se cuenta por</th>
                        <th className="text-right">Negocios</th>
                        <th className="text-left">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suyos.map((s) => (
                        <tr key={s.id} className={s.visible ? "" : "opacity-60"}>
                          <td className="text-texto">{s.nombre}</td>
                          <td>
                            {puedeEditar ? (
                              <select
                                aria-label={`Tipo de ${s.nombre}`}
                                value={s.tipo}
                                disabled={guardando === s.id}
                                onChange={(e) =>
                                  void cambiar(s, { tipo: e.target.value as TipoServicio })
                                }
                                className={`${CLASE_CONTROL} max-w-[11rem]`}
                              >
                                {Object.entries(ROTULO_TIPO).map(([v, r]) => (
                                  <option key={v} value={v}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              ROTULO_TIPO[s.tipo]
                            )}
                          </td>
                          <td>
                            {puedeEditar ? (
                              <input
                                aria-label={`Unidad de ${s.nombre}`}
                                defaultValue={s.unidad}
                                disabled={guardando === s.id}
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v && v !== s.unidad) void cambiar(s, { unidad: v });
                                  else e.target.value = s.unidad;
                                }}
                                className={`${CLASE_CONTROL} max-w-[9rem]`}
                              />
                            ) : (
                              s.unidad
                            )}
                          </td>
                          <td className="text-right tabular-nums">{s._count.oportunidades}</td>
                          <td>
                            {puedeEditar ? (
                              <button
                                type="button"
                                disabled={guardando === s.id}
                                onClick={() => void cambiar(s, { visible: !s.visible })}
                                className="estado text-marca underline-offset-2 hover:underline disabled:opacity-50"
                                title={
                                  s.visible
                                    ? "Dejar de ofertarlo. Los negocios que ya lo llevan no cambian."
                                    : "Volver a ofertarlo."
                                }
                              >
                                {s.visible ? "Activo · ocultar" : "Oculto · mostrar"}
                              </button>
                            ) : (
                              <span className="estado">{s.visible ? "Activo" : "Oculto"}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Seccion>
          );
        })}
    </div>
  );
}
