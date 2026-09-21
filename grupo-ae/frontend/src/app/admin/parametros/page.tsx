"use client";

/** Los parámetros del tablero: las reglas con las que el Resumen se arma. */

/**
 * ESTA PANTALLA EXISTE PARA QUE NO HAGA FALTA UN DESPLIEGUE.
 *
 * El compromiso de respuesta, el umbral de bananeo, los días para
 * considerar fría una oportunidad y la probabilidad de cada etapa
 * estaban escritos en el código. Cada vez que la dirección quería mover
 * un número había que tocar el backend, compilar y subir.
 *
 * Lo que se ve aquí es lo que el tablero usa para calcular: el reloj de
 * la portada, las señales del embudo y el pronóstico. Se cambia un
 * número y el Resumen cambia en la siguiente carga.
 *
 * DE FÁBRICA no quiere decir vacío: quiere decir que lo pone el código,
 * que es lo que había antes de esta pantalla. Volver a fábrica borra el
 * valor guardado en vez de copiar el del código, para que esa etapa siga
 * al cálculo del día en que las probabilidades se saquen del histórico.
 */

import { useCallback, useEffect, useState } from "react";

import { Rotulo } from "@/components/admin/bloques";
import { CLASE_CONTROL, useAdmin } from "@/components/admin/marco-admin";
import { Cargando } from "@/components/admin/piezas";
import { AvisoDeSeccion, CabeceraDePantalla, Seccion } from "@/components/admin/secciones";
import { alcanza } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import type { EtapaOportunidad, TipoEmbudo } from "@/lib/oportunidades-api";
import {
  enTiempo,
  parametrosApi,
  type CambioDeParametros,
  type Parametros,
} from "@/lib/parametros-api";

const EMBUDOS: Array<{ valor: TipoEmbudo; rotulo: string; para: string }> = [
  { valor: "EMPRESA", rotulo: "Empresas", para: "Negocios con una organización detrás." },
  { valor: "PERSONA", rotulo: "Personas", para: "Quien escribe por su cuenta." },
];

export default function PaginaParametros() {
  const { admin } = useAdmin();
  const puedeEditar =
    admin.rol === "SUPERADMIN" || alcanza(admin.permisos?.configuracion, "ESCRIBIR");

  const [p, setP] = useState<Parametros | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setP(await parametrosApi.ver());
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No pudimos traer los parámetros.");
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /// Todo guarda igual: se manda el cambio, se recibe el estado
  /// completo y se pinta lo que contestó el servidor. Nada de
  /// adivinar el resultado en la pantalla: si el servidor recorta un
  /// valor fuera de rango, aquí se ve el recorte.
  async function guardar(cambios: CambioDeParametros, dicho: string) {
    setGuardando(true);
    setError(null);
    setGuardado(null);
    try {
      setP(await parametrosApi.actualizar(cambios));
      setGuardado(dicho);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No pudimos guardar el cambio.");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarProbabilidad(
    embudo: TipoEmbudo,
    etapa: EtapaOportunidad,
    rotulo: string,
    porcentaje: number,
  ) {
    setGuardando(true);
    setError(null);
    setGuardado(null);
    try {
      setP(await parametrosApi.fijarProbabilidad(embudo, etapa, porcentaje));
      setGuardado(`«${rotulo}» quedó en ${porcentaje} %.`);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No pudimos guardar el cambio.");
    } finally {
      setGuardando(false);
    }
  }

  async function volverDeFabrica(
    embudo: TipoEmbudo,
    etapa: EtapaOportunidad,
    rotulo: string,
  ) {
    setGuardando(true);
    setError(null);
    setGuardado(null);
    try {
      setP(await parametrosApi.volverDeFabrica(embudo, etapa));
      setGuardado(`«${rotulo}» volvió al valor de fábrica.`);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No pudimos guardar el cambio.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex min-h-0 grow flex-col">
      <CabeceraDePantalla
        titulo="Parámetros del tablero"
        nota="Las reglas con las que el Resumen se arma: el compromiso de respuesta, las señales del embudo y la probabilidad de cada etapa. Se cambian aquí, sin tocar el código."
      />

      {error && <AvisoDeSeccion color="var(--texto-suave)">{error}</AvisoDeSeccion>}
      {guardado && !error && (
        <AvisoDeSeccion color="var(--exito)">{guardado}</AvisoDeSeccion>
      )}

      {!p && !error && (
        <Seccion>
          <div className="px-6 py-8">
            <Cargando que="Trayendo los parámetros…" />
          </div>
        </Seccion>
      )}

      {p && (
        <>
          <Seccion>
            <div className="px-6 pt-5 pb-6">
              <Rotulo>Compromiso de primera respuesta</Rotulo>
              <p className="mt-2 max-w-[60ch] text-[0.8125rem] text-texto-suave">
                Cuánto nos comprometemos a tardar en contestar por primera vez. Es
                contra esto que la portada cuenta cuántos negocios se pasaron del
                tiempo. No es el mismo en los dos embudos a propósito: quien pregunta
                por WhatsApp no espera un día.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {EMBUDOS.map((e) => (
                  <Campo
                    key={e.valor}
                    titulo={`${e.rotulo} · ${enTiempo(p.ans[e.valor])}`}
                    nota={e.para}
                    unidad="minutos"
                    valor={p.ans[e.valor]}
                    editable={puedeEditar}
                    ocupado={guardando}
                    alGuardar={(v) =>
                      guardar(
                        e.valor === "PERSONA"
                          ? { ansPersonaMinutos: v }
                          : { ansEmpresaMinutos: v },
                        `El compromiso en ${e.rotulo.toLowerCase()} quedó en ${enTiempo(v)}.`,
                      )
                    }
                  />
                ))}
              </div>
            </div>
          </Seccion>

          <Seccion>
            <div className="px-6 pt-5 pb-6">
              <Rotulo>Señales de que un negocio se está pudriendo</Rotulo>
              <p className="mt-2 max-w-[60ch] text-[0.8125rem] text-texto-suave">
                <b className="font-semibold text-texto">Bananeo</b>: lo trabajamos una
                y otra vez y no se mueve de etapa. Se cuenta por gestiones hechas, no
                por días.{" "}
                <b className="font-semibold text-texto">Fría</b>: nadie la ha tocado en
                todo ese tiempo.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {EMBUDOS.map((e) => (
                  <Campo
                    key={e.valor}
                    titulo={`Bananeo · ${e.rotulo}`}
                    nota="Gestiones hechas en la misma etapa."
                    unidad="gestiones"
                    valor={p.bananeo[e.valor]}
                    editable={puedeEditar}
                    ocupado={guardando}
                    alGuardar={(v) =>
                      guardar(
                        e.valor === "PERSONA"
                          ? { bananeoPersona: v }
                          : { bananeoEmpresa: v },
                        `El bananeo en ${e.rotulo.toLowerCase()} quedó en ${v} gestiones.`,
                      )
                    }
                  />
                ))}
                <Campo
                  titulo="Oportunidad fría"
                  nota="Días sin que nadie la toque."
                  unidad="días"
                  valor={p.diasParaFria}
                  editable={puedeEditar}
                  ocupado={guardando}
                  alGuardar={(v) =>
                    guardar({ diasParaFria: v }, `Se considera fría a los ${v} días.`)
                  }
                />
              </div>
            </div>
          </Seccion>

          {EMBUDOS.map((e) => {
            const suyas = p.probabilidades.filter((x) => x.embudo === e.valor);
            return (
              <Seccion key={e.valor}>
                <div className="px-6 pt-5 pb-6">
                  <Rotulo>Probabilidad por etapa · {e.rotulo}</Rotulo>
                  <p className="mt-2 max-w-[60ch] text-[0.8125rem] text-texto-suave">
                    Cuánto vale estar en cada etapa. Con esto se calcula el pronóstico:
                    valor del negocio por su probabilidad. Las de fábrica son
                    estimadas; se corrigen aquí y, el día que haya cierres suficientes,
                    se calcularán con el histórico.
                  </p>

                  <div className="mt-3 overflow-x-auto">
                    <table className="tabla-datos w-full">
                      <thead>
                        <tr>
                          <th className="text-left">Etapa</th>
                          <th className="text-left">Probabilidad</th>
                          <th className="text-left">Origen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suyas.map((x) => (
                          <tr key={`${x.embudo}-${x.etapa}`}>
                            <td className="text-texto">{x.rotulo}</td>
                            <td>
                              {puedeEditar ? (
                                <span className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    aria-label={`Probabilidad de ${x.rotulo} en ${e.rotulo}`}
                                    defaultValue={x.porcentaje}
                                    disabled={guardando}
                                    onBlur={(ev) => {
                                      const v = Number(ev.target.value);
                                      if (
                                        Number.isInteger(v) &&
                                        v >= 0 &&
                                        v <= 100 &&
                                        v !== x.porcentaje
                                      ) {
                                        void guardarProbabilidad(
                                          x.embudo,
                                          x.etapa,
                                          x.rotulo,
                                          v,
                                        );
                                      } else {
                                        ev.target.value = String(x.porcentaje);
                                      }
                                    }}
                                    className={`${CLASE_CONTROL} max-w-[5.5rem] tabular-nums`}
                                  />
                                  <span className="estado text-texto-suave">%</span>
                                </span>
                              ) : (
                                <span className="tabular-nums">{x.porcentaje} %</span>
                              )}
                            </td>
                            <td>
                              {x.deFabrica ? (
                                <span className="estado text-texto-suave">
                                  De fábrica
                                </span>
                              ) : puedeEditar ? (
                                <button
                                  type="button"
                                  disabled={guardando}
                                  onClick={() =>
                                    void volverDeFabrica(x.embudo, x.etapa, x.rotulo)
                                  }
                                  className="estado text-marca underline-offset-2 hover:underline disabled:opacity-50"
                                  title="Borra el valor guardado y vuelve al del sistema."
                                >
                                  Ajustada · volver a fábrica
                                </button>
                              ) : (
                                <span className="estado">Ajustada</span>
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

          {!puedeEditar && (
            <AvisoDeSeccion color="var(--texto-suave)">
              Puede ver los parámetros, pero cambiarlos es de Configuración con
              escritura: mover un umbral cambia el tablero de toda la empresa.
            </AvisoDeSeccion>
          )}
        </>
      )}
    </div>
  );
}

/** Un umbral: número, unidad y para qué sirve. */
function Campo({
  titulo,
  nota,
  unidad,
  valor,
  editable,
  ocupado,
  alGuardar,
}: {
  titulo: string;
  nota: string;
  unidad: string;
  valor: number;
  editable: boolean;
  ocupado: boolean;
  alGuardar: (valor: number) => void;
}) {
  return (
    <div className="rounded-lg border border-hairline px-4 py-3">
      <p className="text-[0.8125rem] font-semibold text-texto">{titulo}</p>
      <p className="mt-0.5 text-[0.75rem] text-texto-suave">{nota}</p>
      <span className="mt-2 flex items-center gap-2">
        {editable ? (
          <input
            type="number"
            aria-label={titulo}
            defaultValue={valor}
            disabled={ocupado}
            /// Se guarda al salir del campo y no en cada tecla: con
            /// `onChange` un «15» manda primero un «1», y el servidor
            /// lo guardaría.
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isInteger(v) && v > 0 && v !== valor) alGuardar(v);
              else e.target.value = String(valor);
            }}
            className={`${CLASE_CONTROL} max-w-[6.5rem] tabular-nums`}
          />
        ) : (
          <span className="text-[0.9375rem] tabular-nums text-texto">{valor}</span>
        )}
        <span className="estado text-texto-suave">{unidad}</span>
      </span>
    </div>
  );
}
