"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ErrorApi } from "@/lib/api";
import {
  crmApi,
  ETIQUETA_DATOS_EMPRESA,
  ETIQUETA_ETAPA,
  ETIQUETA_ORIGEN,
  type CatalogosSep,
  type Ficha,
  type FilaParticipante,
} from "@/lib/crm-api";

import { Cajon, Dato } from "./cajon";
import { Desplegable } from "./desplegable";
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
              className={`rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-60 ${
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
          {/* El desplegable de la casa, no un `<select>`.
              «No debe haber desplegables cuadrados, todos deben
              ser redondeados» (cliente, 1 oct 2026): la lista de
              un `<select>` la dibuja el sistema operativo y no
              hay CSS que entre ahi.

              `enPortal` porque esto vive dentro del cajon, cuyo
              cuerpo es `overflow-y-auto`: lo que sobresale de un
              contenedor con `overflow` se recorta, y la lista de
              asesores se cortaba contra el borde.

              El `min-w-52 flex-1` va en una envoltura y no en el
              control: el `Desplegable` ya es `w-full` dentro de
              lo que se le de. */}
          <div className="min-w-52 flex-1">
            <Desplegable
              enPortal
              etiquetaAria="Asesor"
              marcador="Sin asignar"
              valor={asesorId}
              alElegir={setAsesorId}
              opciones={[
                /// «Sin asignar» es un valor de verdad --quitarle el
                /// asesor a un lead es una accion-- y por eso si va
                /// en la lista, no solo de marcador.
                { valor: "", etiqueta: "Sin asignar" },
                ...asesores.map((a) => ({ valor: a.id, etiqueta: a.nombre })),
              ]}
            />
          </div>
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
  /// dejar vacios sin que el lead quede incompleta.
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
  const [lead, setFicha] = useState<Ficha | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosSep | null>(null);
  const [editando, setEditando] = useState(false);
  /// Con el lead a medias, ver los cuarenta campos para
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
    if (!lead) return;
    setError(null);
    setGuardando(true);
    try {
      // solo lo que cambio: mandar el resto pisaria con lo
      // mismo y ensuciaria el historial de cambios
      const antes = aBorrador(lead);
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
                if (lead) setBorrador(aBorrador(lead));
                setEditando(false);
              }}
              className="text-sm text-texto-suave underline"
            >
              Descartar
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <Boton onClick={() => setEditando(true)} disabled={!lead}>
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
            misma palabra: parecía que el lead se contradecía a
            sí misma. Son tres cosas distintas y ahora lo dicen.

            Y el color va en la letra, sin caja: es la misma
            regla que en la tabla, y tenerla distinta aquí haría
            que el mismo dato se viera de dos formas según por
            dónde se llegara. */}
        <dl className="grid grid-cols-3 gap-4">
          <div className="min-w-0">
            <dt className="text-[0.625rem] font-semibold tracking-[0.1em] text-texto-suave uppercase">
              Etapa
            </dt>
            <dd className="mt-0.5 truncate text-sm">
              <PildoraEtapa etapa={fila.etapa} />
            </dd>
          </div>

          <div className="min-w-0">
            <dt className="text-[0.625rem] font-semibold tracking-[0.1em] text-texto-suave uppercase">
              Canal de entrada
            </dt>
            <dd className="mt-0.5 truncate text-sm text-texto-suave">
              {ETIQUETA_ORIGEN[fila.origen]}
            </dd>
          </div>

          <div className="min-w-0">
            <dt className="text-[0.625rem] font-semibold tracking-[0.1em] text-texto-suave uppercase">
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
            o asignar asesor había que abrir el lead entera,
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
                  <div className="grid sm:grid-cols-2">
                    {campos.map((c) => {
                      /// LISTA Y «SÍ O NO» VAN EN `div`, NO EN `label`.
                      ///
                      /// Una etiqueta se ata al primer control ATABLE
                      /// que lleva dentro, y el disparador del
                      /// `Desplegable` es un `<button>`, que no lo es:
                      /// el `<label>` quedaria apuntando al vacio y el
                      /// clic en el rotulo no haria nada. Los que
                      /// siguen siendo `input` conservan su `label`,
                      /// que ahi si funciona, y el nombre del
                      /// desplegable va por `etiquetaAria`.
                      const conLista = c.tipo === "lista" || c.tipo === "si-no";
                      const Marco = conLista ? "div" : "label";
                      /// El mismo nombre que se ve, mas el «falta»: el
                      /// `aria-label` tiene que decir lo que dice la
                      /// pantalla, o el lector de pantalla y el ojo
                      /// cuentan cosas distintas.
                      const nombre =
                        c.exigido && !borrador[c.clave]
                          ? `${c.etiqueta} (falta)`
                          : c.etiqueta;

                      return (
                      <Marco
                        key={c.clave}
                        className={`block ${c.ancho ? "sm:col-span-2" : ""}`}
                      >
                        <span className="mb-1.5 block text-sm font-medium">
                          {c.etiqueta}
                          {c.exigido && !borrador[c.clave] && (
                            <span className="ml-1.5 text-aviso">falta</span>
                          )}
                        </span>

                        {/* `enPortal` en los dos: el cuerpo del cajon
                            es `overflow-y-auto`, y una lista de
                            treinta y tres departamentos abierta en un
                            campo de abajo se recortaba contra el
                            canto. */}
                        {c.tipo === "lista" ? (
                          <Desplegable
                            enPortal
                            etiquetaAria={nombre}
                            marcador="Sin definir"
                            valor={borrador[c.clave] ?? ""}
                            alElegir={(x) =>
                              setBorrador((b) => ({
                                ...b,
                                [c.clave]: x,
                                // cambiar de departamento invalida el municipio
                                ...(c.clave === "departamentoSepId"
                                  ? { municipioSepId: "" }
                                  : {}),
                              }))
                            }
                            opciones={[
                              /// «Sin definir» va en la lista porque es
                              /// un valor --`null` en el servidor-- y
                              /// hay que poder volver a el: un dato
                              /// puesto por error se deshace asi.
                              { valor: "", etiqueta: "Sin definir" },
                              ...opciones(c.clave).map((o) => ({
                                valor: String(o.id),
                                etiqueta: o.etiqueta,
                              })),
                            ]}
                          />
                        ) : c.tipo === "si-no" ? (
                          <Desplegable
                            enPortal
                            etiquetaAria={nombre}
                            marcador="Sin definir"
                            valor={borrador[c.clave] ?? ""}
                            alElegir={(x) =>
                              setBorrador((b) => ({ ...b, [c.clave]: x }))
                            }
                            opciones={[
                              { valor: "", etiqueta: "Sin definir" },
                              { valor: "SI", etiqueta: "Sí" },
                              { valor: "NO", etiqueta: "No" },
                            ]}
                          />
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
                      </Marco>
                      );
                    })}
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
            {/* El mismo rótulo que la columna: «Viene de la
                etapa». «Última etapa lead» al lado de «Etapa
                lead» se leía como la etapa de ahora. */}
            <Dato
              titulo="Viene de la etapa"
              valor={
                fila.etapaAnterior
                  ? ETIQUETA_ETAPA[fila.etapaAnterior]
                  : "No se ha movido"
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
            <Dato titulo="Cargo actual" valor={lead?.cargoEnEmpresa} />
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
