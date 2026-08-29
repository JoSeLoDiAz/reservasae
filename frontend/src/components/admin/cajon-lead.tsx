"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ErrorApi } from "@/lib/api";
import {
  crmApi,
  ETIQUETA_DATOS_EMPRESA,
  ETIQUETA_ETAPA,
  ETIQUETA_ORIGEN_LEAD,
  type CatalogosSep,
  type Ficha,
  type FilaParticipante,
} from "@/lib/crm-api";

import { Cajon, Dato } from "./cajon";
import { PildoraEtapa } from "./etapa";
import { Aviso, Boton, CLASE_CONTROL } from "./marco-admin";

/**
 * Mover de etapa y asignar asesor, sin salir de la tabla.
 *
 * Son las dos decisiones que se toman mirando una lista. Todo
 * lo demás -- la validación del RUI, la organización, el
 * enlace, el historial -- necesita más sitio del que hay aquí
 * y vive en el lead completo, a un clic.
 */
function Acciones({
  fila,
  alHecho,
}: {
  fila: FilaParticipante;
  alHecho: () => void;
}) {
  const [etapa, setEtapa] = useState(fila.etapa);
  const [asesorId, setAsesorId] = useState(fila.asesor?.id ?? "");
  const [asesores, setAsesores] = useState<Array<{ id: string; nombre: string }>>([]);
  const [ocupado, setOcupado] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);

  useEffect(() => {
    void crmApi
      .resumen({})
      .then((r) => setAsesores(r.asesores.map((a) => ({ id: a.id, nombre: a.nombre }))))
      .catch(() => undefined);
  }, []);

  async function conError(accion: () => Promise<void>) {
    setOcupado(true);
    setProblema(null);
    try {
      await accion();
      alHecho();
    } catch (e) {
      // el backend explica por qué: cupos, grupo, empresa...
      setProblema((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-borde bg-superficie-alterna p-4">
      {problema && <Aviso tipo="error">{problema}</Aviso>}

      <div>
        <span className="mb-2 block text-xs font-semibold tracking-[0.06em] text-texto-suave uppercase">
          Mover de etapa
        </span>
        <div className="flex flex-wrap gap-2">
          {(["INTERESADO", "CONTACTADO", "INSCRITO", "PERDIDO"] as const).map((e) => (
            <button
              key={e}
              type="button"
              disabled={e === etapa || ocupado}
              onClick={() => {
                let motivo: string | undefined;
                if (e === "PERDIDO") {
                  const escrito = window.prompt(
                    "¿Por qué pasa a «No interesado»? Es obligatorio.",
                  );
                  if (!escrito?.trim()) return;
                  motivo = escrito.trim();
                }
                void conError(async () => {
                  await crmApi.cambiarEtapa(fila.id, e, motivo);
                  setEtapa(e);
                });
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm disabled:opacity-60 ${
                e === etapa
                  ? "border-marca bg-marca-suave font-medium text-marca"
                  : "border-borde bg-superficie hover:bg-superficie-alterna"
              }`}
            >
              {ETIQUETA_ETAPA[e]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-xs font-semibold tracking-[0.06em] text-texto-suave uppercase">
          Asesor
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={asesorId}
            onChange={(e) => setAsesorId(e.target.value)}
            className={`${CLASE_CONTROL} min-w-52 flex-1`}
          >
            <option value="">Sin asignar</option>
            {asesores.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
          <Boton
            onClick={() =>
              void conError(async () => {
                await crmApi.actualizar(fila.id, { asesorId: asesorId || null });
              })
            }
            disabled={ocupado || asesorId === (fila.asesor?.id ?? "")}
          >
            Asignar
          </Boton>
        </div>
      </div>
    </div>
  );
}

type Tipo = "texto" | "correo" | "tel" | "fecha" | "numero" | "lista" | "si-no";

type Campo = {
  clave: string;
  etiqueta: string;
  tipo: Tipo;
  /// Si cuenta para «datos completos». Los que no, se pueden
  /// dejar vacios sin que la ficha quede incompleta.
  exigido?: boolean;
  ancho?: boolean;
};

/// El mismo orden del formulario que llena la persona: quien
/// atiende por telefono va leyendo en el orden en que ella lo
/// respondio, no en un orden inventado aqui.
const GRUPOS: Array<{ titulo: string; campos: Campo[] }> = [
  {
    titulo: "Identificación",
    campos: [
      { clave: "primerNombre", etiqueta: "Primer nombre", tipo: "texto", exigido: true },
      { clave: "segundoNombre", etiqueta: "Segundo nombre", tipo: "texto" },
      { clave: "primerApellido", etiqueta: "Primer apellido", tipo: "texto", exigido: true },
      { clave: "segundoApellido", etiqueta: "Segundo apellido", tipo: "texto" },
      { clave: "generoSepId", etiqueta: "Género", tipo: "lista", exigido: true },
      { clave: "fechaNacimiento", etiqueta: "Fecha de nacimiento", tipo: "fecha", exigido: true },
    ],
  },
  {
    titulo: "Contacto",
    campos: [
      { clave: "correo", etiqueta: "Correo", tipo: "correo", exigido: true },
      { clave: "celular", etiqueta: "Celular", tipo: "tel", exigido: true },
    ],
  },
  {
    titulo: "Domicilio",
    campos: [
      { clave: "departamentoSepId", etiqueta: "Departamento", tipo: "lista", exigido: true },
      { clave: "municipioSepId", etiqueta: "Municipio", tipo: "lista", exigido: true },
      { clave: "barrio", etiqueta: "Barrio o vereda", tipo: "texto", exigido: true },
      { clave: "direccion", etiqueta: "Dirección", tipo: "texto", exigido: true, ancho: true },
      { clave: "estrato", etiqueta: "Estrato", tipo: "numero", exigido: true },
    ],
  },
  {
    titulo: "Ocupación",
    campos: [
      { clave: "cargoEnEmpresa", etiqueta: "Cargo actual", tipo: "texto", ancho: true },
      {
        clave: "nivelOcupacionalSepId",
        etiqueta: "Nivel ocupacional",
        tipo: "lista",
        exigido: true,
      },
      { clave: "nivelEducativo", etiqueta: "Nivel educativo", tipo: "texto" },
      {
        clave: "beneficiarioPrevio",
        etiqueta: "¿Se benefició antes?",
        tipo: "si-no",
      },
    ],
  },
];

const TODOS = GRUPOS.flatMap((g) => g.campos);

function fechaHora(valor: string | null): string {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/// Lo que hay hoy, como texto de formulario. Un select vacio
/// y un input vacio se escriben igual: "".
function aBorrador(f: Ficha): Record<string, string> {
  const p = f.persona;
  return {
    primerNombre: p.primerNombre ?? "",
    segundoNombre: p.segundoNombre ?? "",
    primerApellido: p.primerApellido ?? "",
    segundoApellido: p.segundoApellido ?? "",
    generoSepId: p.generoSepId ? String(p.generoSepId) : "",
    fechaNacimiento: p.fechaNacimiento ? p.fechaNacimiento.slice(0, 10) : "",
    correo: p.correo ?? "",
    celular: p.celular ?? "",
    departamentoSepId: p.departamentoSepId ? String(p.departamentoSepId) : "",
    municipioSepId: p.municipioSepId ? String(p.municipioSepId) : "",
    barrio: p.barrio ?? "",
    direccion: p.direccion ?? "",
    estrato: p.estrato !== null && p.estrato !== undefined ? String(p.estrato) : "",
    cargoEnEmpresa: f.cargoEnEmpresa ?? "",
    nivelOcupacionalSepId: f.nivelOcupacionalSepId ? String(f.nivelOcupacionalSepId) : "",
    nivelEducativo: "",
    beneficiarioPrevio:
      f.beneficiarioPrevio === null || f.beneficiarioPrevio === undefined
        ? ""
        : f.beneficiarioPrevio
          ? "SI"
          : "NO",
  };
}

/**
 * El lead, entero y editable, sin salir de la tabla.
 *
 * Abre con lo que ya trae la fila para que se vea al
 * instante, y termina de llenarse cuando llega la ficha: si
 * esperara, cada clic dejaria el panel en blanco medio
 * segundo.
 */
export function CajonLead({
  fila,
  alCerrar,
  alGuardar,
}: {
  fila: FilaParticipante;
  alCerrar: () => void;
  /** Para que la tabla se entere de que cambió. */
  alGuardar: () => void;
}) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosSep | null>(null);
  const [editando, setEditando] = useState(false);
  /// Con la ficha a medias, ver los cuarenta campos para
  /// encontrar los cinco que faltan es perder el tiempo.
  const [soloFalta, setSoloFalta] = useState(false);
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const traer = useCallback(async () => {
    try {
      const [f, c] = await Promise.all([crmApi.obtener(fila.id), crmApi.catalogos()]);
      setFicha(f);
      setCatalogos(c);
      setBorrador(aBorrador(f));
    } catch (e) {
      setError((e as ErrorApi).message);
    }
  }, [fila.id]);

  useEffect(() => {
    void traer();
  }, [traer]);

  /// Los municipios del departamento elegido, y solo esos.
  const municipios = useMemo(() => {
    const dep = Number(borrador.departamentoSepId);
    if (!catalogos || !dep) return [];
    return catalogos.municipios.filter((m) => m[1] === dep);
  }, [catalogos, borrador.departamentoSepId]);

  const vacios = TODOS.filter((c) => c.exigido && !borrador[c.clave]);

  function opciones(clave: string): Array<{ id: number; etiqueta: string }> {
    if (!catalogos) return [];
    if (clave === "generoSepId") return catalogos.generos;
    if (clave === "nivelOcupacionalSepId") return catalogos.nivelesOcupacionales;
    if (clave === "departamentoSepId") return catalogos.departamentos;
    if (clave === "municipioSepId")
      return municipios.map((m) => ({ id: m[0], etiqueta: m[2] }));
    return [];
  }

  async function guardar() {
    if (!ficha) return;
    setError(null);
    setGuardando(true);
    try {
      // solo lo que cambio: mandar el resto pisaria con lo
      // mismo y ensuciaria el historial de cambios
      const antes = aBorrador(ficha);
      const cambios: Record<string, unknown> = {};

      for (const c of TODOS) {
        const nuevo = borrador[c.clave] ?? "";
        if (nuevo === antes[c.clave]) continue;
        if (c.tipo === "lista" || c.tipo === "numero") {
          cambios[c.clave] = nuevo === "" ? null : Number(nuevo);
        } else if (c.tipo === "si-no") {
          cambios[c.clave] = nuevo === "" ? undefined : nuevo === "SI";
        } else {
          cambios[c.clave] = nuevo;
        }
      }

      if (Object.keys(cambios).length === 0) {
        setEditando(false);
        return;
      }

      await crmApi.actualizar(fila.id, cambios);
      await traer();
      setEditando(false);
      setExito("Los cambios quedaron guardados.");
      alGuardar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Cajon
      titulo={fila.nombre}
      subtitulo={
        <>
          {fila.tipoDocumento} {fila.numeroDocumento} · entró el {fechaHora(fila.creadoEn)}
        </>
      }
      alCerrar={alCerrar}
      pie={
        editando ? (
          <div className="flex flex-wrap items-center gap-3">
            <Boton onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Boton>
            <button
              type="button"
              onClick={() => {
                if (ficha) setBorrador(aBorrador(ficha));
                setEditando(false);
              }}
              className="text-sm text-texto-suave underline"
            >
              Descartar
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <Boton onClick={() => setEditando(true)} disabled={!ficha}>
              Editar datos
            </Boton>
            <a
              href={`/admin/participantes/${fila.id}`}
              className="text-sm text-marca underline"
            >
              Abrir lead completo
            </a>
          </div>
        )
      }
    >
      <div className="space-y-5">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {exito && <Aviso tipo="exito">{exito}</Aviso>}

        {/* CON RÓTULO cada uno.

            Eran tres valores sueltos en fila —«Datos completos
            · Importación · Datos parciales»— sin decir qué era
            cada cual, y encima dos de ellos empezaban por la
            misma palabra: parecía que la ficha se contradecía a
            sí misma. Son tres cosas distintas y ahora lo dicen.

            Y el color va en la letra, sin caja: es la misma
            regla que en la tabla, y tenerla distinta aquí haría
            que el mismo dato se viera de dos formas según por
            dónde se llegara. */}
        <dl className="grid grid-cols-3 gap-4">
          <div className="min-w-0">
            <dt className="text-[0.6875rem] font-semibold tracking-wider text-texto-suave uppercase">
              Etapa
            </dt>
            <dd className="mt-0.5 truncate text-sm">
              <PildoraEtapa etapa={fila.etapa} />
            </dd>
          </div>

          <div className="min-w-0">
            <dt className="text-[0.6875rem] font-semibold tracking-wider text-texto-suave uppercase">
              Origen
            </dt>
            <dd className="mt-0.5 truncate text-sm text-texto-suave">
              {ETIQUETA_ORIGEN_LEAD[fila.origenLead]}
            </dd>
          </div>

          <div className="min-w-0">
            <dt className="text-[0.6875rem] font-semibold tracking-wider text-texto-suave uppercase">
              Datos pendientes
            </dt>
            <dd
              className={`mt-0.5 truncate text-sm font-medium ${
                fila.datos === "COMPLETOS" ? "text-exito" : "text-aviso"
              }`}
            >
              {fila.datos === "COMPLETOS"
                ? "Sin pendientes"
                : fila.faltaDeLaPersona.length === 1
                  ? "Falta 1"
                  : `Faltan ${fila.faltaDeLaPersona.length}`}
            </dd>
          </div>
        </dl>

        {/* Las mismas acciones que en el lead completo.
            
            Antes esto solo enseñaba datos: para mover de etapa
            o asignar asesor había que abrir la ficha entera,
            perder la tabla y volver. Son las dos decisiones que
            se toman mirando una lista, y ahora se toman aquí. */}
        {!editando && <Acciones fila={fila} alHecho={alGuardar} />}

        {editando ? (
          <>
            {vacios.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borde bg-superficie-alterna px-4 py-3 text-sm">
                <span>
                  Le faltan{" "}
                  <strong>
                    {vacios.length} {vacios.length === 1 ? "dato" : "datos"}
                  </strong>{" "}
                  para quedar completo.
                </span>
                <button
                  type="button"
                  onClick={() => setSoloFalta(!soloFalta)}
                  className="text-marca underline"
                >
                  {soloFalta ? "Ver todos los campos" : "Ver solo lo que falta"}
                </button>
              </div>
            )}

            {GRUPOS.map((g) => {
              const campos = soloFalta
                ? g.campos.filter((c) => c.exigido && !borrador[c.clave])
                : g.campos;
              if (campos.length === 0) return null;

              return (
                <section key={g.titulo}>
                  <h3 className="mb-2 text-sm font-semibold tracking-[0.06em] text-texto-suave uppercase">
                    {g.titulo}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {campos.map((c) => (
                      <label
                        key={c.clave}
                        className={`block ${c.ancho ? "sm:col-span-2" : ""}`}
                      >
                        <span className="mb-1.5 block text-sm font-medium">
                          {c.etiqueta}
                          {c.exigido && !borrador[c.clave] && (
                            <span className="ml-1.5 text-aviso">falta</span>
                          )}
                        </span>

                        {c.tipo === "lista" ? (
                          <select
                            value={borrador[c.clave] ?? ""}
                            onChange={(e) =>
                              setBorrador((b) => ({
                                ...b,
                                [c.clave]: e.target.value,
                                // cambiar de departamento invalida el municipio
                                ...(c.clave === "departamentoSepId"
                                  ? { municipioSepId: "" }
                                  : {}),
                              }))
                            }
                            className={CLASE_CONTROL}
                          >
                            <option value="">Sin definir</option>
                            {opciones(c.clave).map((o) => (
                              <option key={o.id} value={String(o.id)}>
                                {o.etiqueta}
                              </option>
                            ))}
                          </select>
                        ) : c.tipo === "si-no" ? (
                          <select
                            value={borrador[c.clave] ?? ""}
                            onChange={(e) =>
                              setBorrador((b) => ({ ...b, [c.clave]: e.target.value }))
                            }
                            className={CLASE_CONTROL}
                          >
                            <option value="">Sin definir</option>
                            <option value="SI">Sí</option>
                            <option value="NO">No</option>
                          </select>
                        ) : (
                          <input
                            type={
                              c.tipo === "correo"
                                ? "email"
                                : c.tipo === "fecha"
                                  ? "date"
                                  : c.tipo === "numero"
                                    ? "number"
                                    : c.tipo === "tel"
                                      ? "tel"
                                      : "text"
                            }
                            value={borrador[c.clave] ?? ""}
                            onChange={(e) =>
                              setBorrador((b) => ({ ...b, [c.clave]: e.target.value }))
                            }
                            className={CLASE_CONTROL}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato titulo="Correo" valor={fila.correo} />
            <Dato titulo="Número de teléfono" valor={fila.celular} />
            <Dato titulo="Tipo documento" valor={fila.tipoDocumento} />
            <Dato titulo="Número documento" valor={fila.numeroDocumento} />
            <Dato titulo="Departamento" valor={fila.departamento} />
            <Dato titulo="Municipio" valor={fila.municipio} />
            <Dato
              titulo="Acción formación interés"
              valor={fila.accion ?? fila.accionCodigo}
            />
            <Dato titulo="Gremio" valor={fila.gremio} />
            <Dato titulo="Asesor" valor={fila.asesor?.nombre ?? "Sin asignar"} />
            <Dato titulo="Etapa lead" valor={ETIQUETA_ETAPA[fila.etapa]} />
            <Dato
              titulo="Última etapa lead"
              valor={
                fila.etapaAnterior ? ETIQUETA_ETAPA[fila.etapaAnterior] : "Sin cambios"
              }
            />
            <Dato titulo="Última actividad" valor={fechaHora(fila.ultimaActividad)} />
            <Dato titulo="Cambios realizados" valor={String(fila.cambios)} />
            <Dato
              titulo="Datos de empresa"
              valor={ETIQUETA_DATOS_EMPRESA[fila.datosEmpresa]}
            />
            <Dato titulo="Notas" valor={String(fila.notas)} />
            <Dato titulo="Antigüedad lead en días" valor={String(fila.antiguedadDias)} />
            <Dato titulo="Cargo actual" valor={ficha?.cargoEnEmpresa} />
          </dl>
        )}

        {!editando && fila.datos === "PARCIALES" && fila.faltaDeLaPersona.length > 0 && (
          <div className="rounded-xl border border-borde bg-superficie-alterna p-4 text-sm">
            <p className="font-medium">Le falta por diligenciar</p>
            <p className="mt-1 text-texto-suave">{fila.faltaDeLaPersona.join(", ")}.</p>
          </div>
        )}
      </div>
    </Cajon>
  );
}
