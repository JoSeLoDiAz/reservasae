"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  Tarjeta,
} from "@/components/admin/marco-admin";
import { adminApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import { pedir } from "@/lib/pedir";
import {
  crmApi,
  historicoDeCargas,
  type CargaDelHistorico,
  type OpcionOferta,
} from "@/lib/crm-api";
import { Desplegable } from "@/components/admin/desplegable";
import { BotonVolver } from "@/components/admin/piezas";

type Estado = "NUEVA" | "PERSONA_CONOCIDA" | "REPETIDA" | "DESCARTADA";

type FilaPrevia = {
  linea: number;
  /// La acción y el grupo que le tocan por lo que dice su fila.
  accionEtiqueta?: string | null;
  grupo?: string | null;
  tipoDocumentoSepId: number;
  sigla: string;
  numeroDocumento: string;
  primerNombre: string;
  primerApellido: string;
  correo: string | null;
  celular: string | null;
  problemas: string[];
  estado: Estado;
};

/// Los datos de la organización, como se escriben (y como vienen de la
/// hoja «Organización» del archivo).
type DatosOrganizacion = {
  nit: string;
  razonSocial: string;
  jefeNombre: string;
  jefeCargo: string;
  jefeCorreo: string;
};

const ORGANIZACION_VACIA: DatosOrganizacion = {
  nit: "",
  razonSocial: "",
  jefeNombre: "",
  jefeCargo: "",
  jefeCorreo: "",
};

/// Lo que el servidor contesta de la organización al validar.
type OrganizacionPrevia = {
  nit: string;
  digitoVerificacion: string | null;
  razonSocial: string;
  existe: boolean;
  jefeNombre: string | null;
  jefeCargo: string | null;
  jefeCorreo: string | null;
  problemas: string[];
  avisos: string[];
  /// Una por grupo: la lista puede traer gente de varias acciones.
  reservas: Array<{
    grupo: string;
    cupos: number;
    enEspera: number;
    personasYaVinculadas: number;
  }>;
  sinReservaPorque: "SIN_ACCION" | "ORGANIZACION_NUEVA" | "NO_RESERVO_AQUI" | null;
};

type Previa = {
  total: number;
  creables: number;
  descartadas: number;
  repetidas: number;
  conocidas: number;
  filas: FilaPrevia[];
  organizacion?: OrganizacionPrevia | null;
};

const ETIQUETA_ESTADO: Record<Estado, string> = {
  NUEVA: "Se importará",
  PERSONA_CONOCIDA: "Ya registrada en el sistema",
  REPETIDA: "Duplicada en el archivo",
  DESCARTADA: "No se importará",
};

export default function PaginaCarga() {
  const router = useRouter();
  const [convenios, setConvenios] = useState<
    Array<{ id: string; nombre: string; sigla: string | null }>
  >([]);
  const [ofertas, setOfertas] = useState<OpcionOferta[]>([]);
  const [convenioId, setConvenioId] = useState("");
  const [accionId, setAccionId] = useState("");
  const [ofertaId, setOfertaId] = useState("");
  const [texto, setTexto] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [deArchivo, setDeArchivo] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [historico, setHistorico] = useState<CargaDelHistorico[] | null>(null);
  const [falloHistorico, setFalloHistorico] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  /// Si toda la lista es de una organización --por ejemplo, la de su
  /// reserva de cupos--. «Debe tener la opción de si es una importación
  /// de una reserva de cupos, porque masivamente se deben colocar los
  /// datos de la empresa» (cliente, 22 sep 2026).
  const [deOrganizacion, setDeOrganizacion] = useState(false);
  const [organizacion, setOrganizacion] = useState<DatosOrganizacion>(ORGANIZACION_VACIA);
  const selector = useRef<HTMLInputElement>(null);

  const faltaOrganizacion =
    deOrganizacion && (!organizacion.nit.trim() || !organizacion.razonSocial.trim());
  /// Lo que viaja al servidor: nada si la carga no es de una organización.
  const cuerpoDeOrganizacion = deOrganizacion ? { organizacion } : {};

  function cambiarOrganizacion(campo: keyof DatosOrganizacion, valor: string) {
    setOrganizacion((o) => ({ ...o, [campo]: valor }));
    setPrevia(null);
  }

  useEffect(() => {
    void adminApi
      .convenios()
      .then((l) => {
        const activos = l.filter((c) => c.activo);
        setConvenios(activos);
        if (activos.length === 1) setConvenioId(activos[0].id);
      })
      .catch((e) => setError((e as ErrorApi).message));
  }, []);

  /// El desplegable ensenaba `ofertas` en crudo, y una oferta es
  /// accion x sede: AF1 salia seis veces, una por departamento.
  /// Se elige el CURSO, y la sede solo cuando hay mas de una.
  const acciones = useMemo(() => {
    const m = new Map<string, { id: string; etiqueta: string; sedes: OpcionOferta[] }>();
    for (const o of ofertas) {
      const y = m.get(o.accionFormacionId);
      if (y) y.sedes.push(o);
      else m.set(o.accionFormacionId, { id: o.accionFormacionId, etiqueta: o.etiqueta, sedes: [o] });
    }
    return [...m.values()];
  }, [ofertas]);

  const sedes = acciones.find((a) => a.id === accionId)?.sedes ?? [];

  /// Con una sola sede no hay nada que elegir: se fija sola. Un
  /// desplegable de una sola opcion es un paso que no decide nada.
  useEffect(() => {
    if (sedes.length === 1) setOfertaId(sedes[0].id);
    else if (!sedes.some((o) => o.id === ofertaId)) setOfertaId("");
  }, [accionId, sedes, ofertaId]);

  const verHistorico = useCallback(() => {
    void historicoDeCargas(convenioId || undefined)
      .then((h) => {
        setHistorico(h);
        setFalloHistorico(null);
      })
      .catch((e) => {
        setHistorico([]);
        setFalloHistorico((e as ErrorApi).message);
      });
  }, [convenioId]);

  useEffect(verHistorico, [verHistorico]);

  useEffect(() => {
    if (!convenioId) return;
    void crmApi
      .opciones(convenioId)
      .then((o) => setOfertas(o.ofertas))
      .catch(() => setOfertas([]));
  }, [convenioId]);

  /// El archivo se vuelve el MISMO texto que se pegaria y cae en
  /// la misma caja. Asi hay un solo lector de filas, y se ve lo
  /// que trajo el archivo antes de confirmar nada.
  async function leerArchivo(f: File | null | undefined) {
    if (!f) return;
    await conError(async () => {
      const cuerpo = new FormData();
      cuerpo.append("archivo", f);
      const d = await pedir<{
        texto?: string;
        filas?: number;
        organizacion?: Partial<DatosOrganizacion> | null;
      }>("/admin/participantes/carga/archivo", { method: "POST", body: cuerpo });
      setTexto(d.texto ?? "");
      /// Si el archivo trae la hoja «Organización» llena, la carga ES de
      /// una organización: se marca sola y se llenan sus campos, que
      /// quedan a la vista para revisarlos antes de validar.
      if (d.organizacion) {
        setDeOrganizacion(true);
        setOrganizacion({ ...ORGANIZACION_VACIA, ...d.organizacion });
      }
      setNombreArchivo(f.name);
      setDeArchivo(`${f.name} · ${d.filas} ${d.filas === 1 ? "fila" : "filas"}`);
      setPrevia(null);
    });
  }

  async function conError(accion: () => Promise<void>) {
    setError(null);
    setOcupado(true);
    try {
      await accion();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="pb-10">
      {/* La salida, fuera del recuadro y con pinta de botón: igual que
          en «Asignar grupo por lote» (cliente, 23 sep 2026). */}
      <div className="px-7 pt-3 pb-2">
        <BotonVolver href="/admin/participantes" texto="Gestión de leads" />
      </div>
      <header className="border-b border-borde bg-superficie px-7 pt-[18px] pb-[22px]">
        <h1 className="mt-1 text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">
          Importar participantes
        </h1>
        <p className="mt-1 text-texto-suave">
          Cargue el archivo remitido por la organización, o pegue los datos desde una hoja
          de cálculo. El sistema valida cada registro y presenta el resultado antes de
          crear nada.
        </p>
      </header>

      {error && (
        <div className="px-7 pt-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}

      <Tarjeta
        titulo="Paso 1 · Destino de los registros"
        descripcion="Determina a qué convenio quedan asociados los participantes. La acción de formación puede asignarse ahora o más adelante, desde cada lead."
      >
        <div
          className={
            "grid gap-x-7 gap-y-4 " +
            (sedes.length > 1
              ? "lg:grid-cols-[280px_minmax(0,1fr)_270px]"
              : "lg:grid-cols-[280px_minmax(0,1fr)]")
          }
        >
          <Campo etiqueta="Convenio">
            <Desplegable
              marcador="Seleccione un convenio"
              valor={convenioId}
              opciones={convenios.map((c) => ({
                valor: c.id,
                etiqueta: c.sigla ?? c.nombre,
                detalle: c.sigla ? c.nombre : undefined,
              }))}
              alElegir={(v) => {
                setConvenioId(v);
                setAccionId("");
                setOfertaId("");
                setPrevia(null);
              }}
            />
          </Campo>

          <Campo etiqueta="Acción de formación">
            <Desplegable
              marcador="Sin asignar por el momento"
              valor={accionId}
              desactivado={!convenioId}
              opciones={[
                { valor: "", etiqueta: "Sin asignar por el momento" },
                ...acciones.map((a) => ({
                  valor: a.id,
                  etiqueta: a.etiqueta,
                  detalle:
                    a.sedes.length === 1
                      ? `Grupo único · ${a.sedes[0].ubicacion} · ${a.sedes[0].disponibles} cupos`
                      : `${a.sedes.length} grupos`,
                })),
              ]}
              alElegir={(v) => {
                setAccionId(v);
                setPrevia(null);
              }}
            />
          </Campo>

          {sedes.length > 1 && (
            <Campo etiqueta="Grupo">
              <Desplegable
                marcador="Seleccione el grupo"
                valor={ofertaId}
                opciones={sedes.map((o) => ({
                  valor: o.id,
                  etiqueta: o.ubicacion,
                  detalle: `${o.disponibles} cupos disponibles`,
                }))}
                alElegir={(v) => {
                  setOfertaId(v);
                  setPrevia(null);
                }}
              />
            </Campo>
          )}
        </div>

        {accionId && sedes.length === 1 && (
          <p className="mt-3 text-[0.78125rem] text-texto-suave">
            Esta acción tiene un solo grupo, en {sedes[0].ubicacion}, con{" "}
            {sedes[0].disponibles} cupos disponibles.
          </p>
        )}

        {/* LA ORGANIZACIÓN, UNA VEZ PARA TODA LA LISTA. Sin esto cada
            lead nacía sin empresa: no se podía pasar a Inscrito y su
            cupo no contaba en la reserva. */}
        <fieldset className="mt-5 border-t border-hairline pt-4">
          <legend className="sr-only">Organización de la lista</legend>
          <p className="text-[0.8125rem] font-semibold text-titulo">
            ¿Toda la lista es de una misma organización?
          </p>
          <p className="mt-0.5 text-[0.75rem] text-texto-suave">
            Por ejemplo, las personas de una reserva de cupos. Sus datos se ponen una
            sola vez y quedan en todos los participantes de la carga.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2" role="radiogroup">
            {[
              { valor: false, etiqueta: "No, son personas sueltas" },
              { valor: true, etiqueta: "Sí, de una organización" },
            ].map((o) => (
              <button
                key={String(o.valor)}
                type="button"
                role="radio"
                aria-checked={deOrganizacion === o.valor}
                onClick={() => {
                  setDeOrganizacion(o.valor);
                  setPrevia(null);
                }}
                className={
                  "sin-aro inline-flex h-[32px] items-center rounded-[9px] border px-[13px] text-[0.78125rem] font-semibold transition " +
                  (deOrganizacion === o.valor
                    ? "border-marca bg-marca-suave text-marca"
                    : "border-campo-borde bg-superficie text-titulo hover:border-marca")
                }
              >
                {o.etiqueta}
              </button>
            ))}
          </div>

          {deOrganizacion && (
            <div className="mt-4 grid gap-x-7 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
              <Campo etiqueta="NIT">
                <input
                  className={CLASE_CONTROL}
                  inputMode="numeric"
                  placeholder="900123456-8"
                  value={organizacion.nit}
                  onChange={(e) => cambiarOrganizacion("nit", e.target.value)}
                />
              </Campo>
              <div className="xl:col-span-2">
              <Campo etiqueta="Razón social">
                <input
                  className={CLASE_CONTROL}
                  value={organizacion.razonSocial}
                  onChange={(e) => cambiarOrganizacion("razonSocial", e.target.value)}
                />
              </Campo>
              </div>
              <Campo etiqueta="Nombre del jefe inmediato">
                <input
                  className={CLASE_CONTROL}
                  value={organizacion.jefeNombre}
                  onChange={(e) => cambiarOrganizacion("jefeNombre", e.target.value)}
                />
              </Campo>
              <Campo etiqueta="Cargo del jefe inmediato">
                <input
                  className={CLASE_CONTROL}
                  value={organizacion.jefeCargo}
                  onChange={(e) => cambiarOrganizacion("jefeCargo", e.target.value)}
                />
              </Campo>
              <div className="md:col-span-2 xl:col-span-1">
                <Campo etiqueta="Correo del jefe inmediato">
                  <input
                    className={CLASE_CONTROL}
                    type="email"
                    value={organizacion.jefeCorreo}
                    onChange={(e) => cambiarOrganizacion("jefeCorreo", e.target.value)}
                  />
                </Campo>
              </div>
              <p className="text-[0.75rem] leading-relaxed text-texto-suave md:col-span-2 xl:col-span-3">
                NIT y razón social son obligatorios. Si la organización reservó cupos en
                la acción elegida, las personas quedan dentro de su reserva y cuentan
                como cupos con nombre.
              </p>
            </div>
          )}
        </fieldset>
      </Tarjeta>

      <Tarjeta
        titulo="Paso 2 · Origen de los datos"
        descripcion="Se admiten archivos .xlsx y .csv. Lo mejor es la plantilla: cada columna se reconoce por su título, así que el orden da igual, y trae sus listas para elegir la acción, el departamento y la ciudad. Su segunda hoja, «Organización», llena sola los datos de la empresa."
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-borde bg-superficie-alterna px-4 py-3">
            {/* LO MÍNIMO Y LO DEMÁS, por separado: pedir las diecinueve
                columnas espantaría a quien solo quiere pegar una lista
                de nombres, y no hacen falta. */}
            <p className="text-[0.78125rem] text-texto-suave">
              <span className="font-semibold text-titulo">Lo mínimo de cada persona:</span>{" "}
              tipo y número de documento, primer nombre, primer apellido, y correo o celular.
            </p>
            <p className="mt-1 text-[0.78125rem] text-texto-suave">
              <span className="font-semibold text-titulo">Y si vienen, se guardan:</span>{" "}
              acción de formación de interés · departamento · ciudad o municipio · segundo
              nombre · segundo apellido · fecha de nacimiento · género · barrio · dirección ·
              estrato · cargo · nivel ocupacional · si se ha beneficiado antes.
            </p>
            <p className="mt-1 text-[0.78125rem] text-texto-suave">
              Con la acción de formación en el archivo, cada persona queda en el grupo que
              llega a su ciudad; lo que se elija arriba solo se usa para las filas que no la
              traigan.
            </p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setEncima(true);
            }}
            onDragLeave={() => setEncima(false)}
            onDrop={(e) => {
              e.preventDefault();
              setEncima(false);
              void leerArchivo(e.dataTransfer.files?.[0]);
            }}
            className={
              "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-dashed px-5 py-4 transition " +
              (encima ? "border-marca bg-marca-suave" : "border-campo-borde bg-campo-fondo")
            }
          >
            <input
              ref={selector}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                void leerArchivo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={ocupado}
              onClick={() => selector.current?.click()}
              className="sin-aro inline-flex h-[32px] items-center rounded-[9px] bg-marca px-[13px] text-[0.78125rem] font-semibold whitespace-nowrap text-marca-texto transition hover:bg-marca-fuerte disabled:cursor-not-allowed disabled:bg-campo-borde disabled:text-texto-suave"
            >
              {ocupado ? "Leyendo el archivo…" : "Seleccionar archivo"}
            </button>

            <a
              /// LA PLANTILLA ES DEL CONVENIO ELEGIDO: sus listas traen
              /// las acciones de ese convenio y los departamentos donde
              /// se dicta cada una.
              href={`/api/admin/participantes/carga/plantilla?convenioId=${convenioId}`}
              aria-disabled={!convenioId}
              className="sin-aro inline-flex h-[32px] items-center rounded-[9px] border border-campo-borde bg-superficie px-[13px] text-[0.78125rem] font-semibold whitespace-nowrap text-titulo no-underline transition hover:border-marca"
            >
              Descargar plantilla
            </a>

            <span className="text-[0.78125rem] text-texto-suave">
              {deArchivo
                ? `Archivo procesado: ${deArchivo}. Verifique el contenido antes de continuar.`
                : "También puede arrastrar el archivo hasta aquí."}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-[0.78125rem] font-semibold text-titulo">
              Datos por procesar
            </p>
            <textarea
              className={`${CLASE_CONTROL} min-h-56 font-mono text-[0.78125rem] leading-relaxed`}
              placeholder="Pegue aquí las celdas copiadas de la hoja de cálculo, o cargue el archivo con el botón de arriba."
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setDeArchivo(null);
                setNombreArchivo(null);
                setPrevia(null);
              }}
            />
          </div>

          <div className="pt-1">
            <Boton
              disabled={!convenioId || !texto.trim() || ocupado || faltaOrganizacion}
              onClick={() =>
                conError(async () => {
                  setPrevia(
                    await pedir<Previa>(
                      "/admin/participantes/carga/previsualizar",
                      {
                        method: "POST",
                        body: JSON.stringify({
                          convenioId,
                          ofertaId: ofertaId || undefined,
                          texto,
                          ...cuerpoDeOrganizacion,
                        }),
                      },
                    ),
                  );
                })
              }
            >
              {ocupado ? "Validando…" : "Validar registros"}
            </Boton>
            {faltaOrganizacion && (
              <p className="mt-2 text-[0.75rem] text-texto-suave">
                Falta el NIT o la razón social de la organización (Paso 1).
              </p>
            )}
          </div>
        </div>
      </Tarjeta>

      {previa && (
        <Tarjeta
          titulo={`Paso 3 · Validación de ${previa.total} ${previa.total === 1 ? "registro" : "registros"}`}
          descripcion={`${previa.creables} se importarán. ${previa.conocidas} corresponden a personas ya registradas, ${previa.repetidas} están duplicadas en el archivo y ${previa.descartadas} no cumplen los requisitos mínimos.`}
        >
          <div className="space-y-5">
            {previa.organizacion && <ResumenDeOrganizacion o={previa.organizacion} />}

            <div className="caja-scroll max-h-96 overflow-auto rounded-lg border border-borde">
              <table className="tabla-datos">
                <thead>
                  <tr>
                    <th>Línea</th>
                    <th>Documento</th>
                    <th>Nombre</th>
                    <th>Contacto</th>
                    {/* DÓNDE VA A QUEDAR, antes de crear nada: es lo que
                        el archivo decide por fila y lo que nadie puede
                        comprobar después de un tirón. */}
                    <th>Acción y grupo</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.filas.map((f) => (
                    <tr key={f.linea}>
                      <td className="tabular-nums">{f.linea}</td>
                      <td className="font-mono">
                        {f.sigla} {f.numeroDocumento || "—"}
                      </td>
                      <td>
                        {f.primerNombre} {f.primerApellido}
                      </td>
                      <td>{f.correo ?? f.celular ?? "—"}</td>
                      <td>
                        {f.accionEtiqueta ? (
                          <>
                            <p>{f.accionEtiqueta}</p>
                            <p className="text-xs text-texto-suave">
                              {f.grupo ? `Grupo de ${f.grupo}` : "Sin grupo todavía"}
                            </p>
                          </>
                        ) : (
                          <span className="text-texto-suave">Lo elegido arriba</span>
                        )}
                      </td>
                      <td>
                        <p
                          className={
                            f.estado === "DESCARTADA" || f.estado === "REPETIDA"
                              ? "font-semibold text-error"
                              : ""
                          }
                        >
                          {ETIQUETA_ESTADO[f.estado]}
                        </p>
                        {f.problemas.map((p) => (
                          <p key={p} className="text-xs text-texto-suave">
                            {p}
                          </p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previa.creables > 0 ? (
              <Boton
                disabled={ocupado || Boolean(previa.organizacion?.problemas.length)}
                onClick={() =>
                  conError(async () => {
                    const res = await pedir<{
                      creados: number;
                      fallos: Array<{ linea: number; motivo: string }>;
                    }>("/admin/participantes/carga/confirmar", {
                      method: "POST",
                      body: JSON.stringify({
                        convenioId,
                        ofertaId: ofertaId || undefined,
                        texto,
                        origenDeCarga: nombreArchivo ? "ARCHIVO" : "PEGADO",
                        nombreArchivo: nombreArchivo ?? undefined,
                        ...cuerpoDeOrganizacion,
                      }),
                    });
                    verHistorico();
                    if (res.fallos?.length) {
                      setError(
                        `Se importaron ${res.creados} registros. ${res.fallos.length} no se pudieron crear: ` +
                          res.fallos
                            .slice(0, 3)
                            .map((x) => `línea ${x.linea} (${x.motivo})`)
                            .join("; "),
                      );
                      return;
                    }
                    router.push("/admin/participantes");
                  })
                }
              >
                {ocupado
                  ? "Importando…"
                  : `Importar ${previa.creables} ${previa.creables === 1 ? "participante" : "participantes"}`}
              </Boton>
            ) : (
              <Aviso tipo="error">
                Ningún registro del archivo cumple los requisitos mínimos. Corrija los
                datos y vuelva a cargarlos.
              </Aviso>
            )}
          </div>
        </Tarjeta>
      )}

      <Tarjeta
        titulo="Historial de importaciones"
        descripcion="Cada carga confirmada queda registrada con su responsable, su origen y su resultado. Se conservan las cien más recientes del ámbito."
      >
        {historico === null ? (
          <p className="text-[0.78125rem] text-texto-suave">Consultando…</p>
        ) : falloHistorico ? (
          <Aviso tipo="error">
            No se pudo consultar el historial: {falloHistorico}. Mientras esto falle,
            confirmar una importación también fallará, porque el registro se escribe
            antes de crear a nadie.
          </Aviso>
        ) : historico.length === 0 ? (
          <p className="text-[0.78125rem] text-texto-suave">
            Todavía no se ha registrado ninguna importación en este ámbito. La primera
            que confirme aparecerá aquí.
          </p>
        ) : (
          <div className="caja-scroll max-h-80 overflow-auto rounded-lg border border-borde">
            <table className="tabla-datos">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Responsable</th>
                  <th>Origen</th>
                  <th>Convenio</th>
                  <th>Acción de formación</th>
                  <th>Registros</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap tabular-nums">
                      {new Date(c.creadoEn).toLocaleString("es-CO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td>{c.autor}</td>
                    <td>
                      {c.origen === "ARCHIVO" ? (
                        <>
                          Archivo
                          {c.nombreArchivo && (
                            <span className="block text-xs text-texto-suave">
                              {c.nombreArchivo}
                            </span>
                          )}
                        </>
                      ) : (
                        "Pegado"
                      )}
                    </td>
                    <td>{c.convenio}</td>
                    <td>{c.destino ?? "Sin asignar"}</td>
                    <td className="tabular-nums">{c.filas}</td>
                    <td>
                      <span className="font-semibold text-exito tabular-nums">
                        {c.creados} importados
                      </span>
                      {/* Lo que NO entro se dice y no se calla: un
                          historico que solo cuenta los aciertos no
                          sirve para reconstruir que paso. */}
                      {(c.yaExistian > 0 ||
                        c.duplicados > 0 ||
                        c.descartados > 0 ||
                        c.fallidos > 0) && (
                        <span className="block text-xs text-texto-suave tabular-nums">
                          {[
                            c.yaExistian > 0 && `${c.yaExistian} ya existían`,
                            c.duplicados > 0 && `${c.duplicados} duplicados`,
                            c.descartados > 0 && `${c.descartados} descartados`,
                            c.fallidos > 0 && `${c.fallidos} con error`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

/**
 * Qué va a pasar con la organización, dicho ANTES de importar.
 *
 * Lo que más importa decir es si las personas entran en la reserva:
 * es lo que hace que sus cupos cuenten como «con nombre». Sin reserva
 * igual quedan con su organización, que es lo que pide Inscrito.
 */
function ResumenDeOrganizacion({ o }: { o: OrganizacionPrevia }) {
  const jefe = [o.jefeNombre, o.jefeCargo, o.jefeCorreo].filter(Boolean).join(" · ");
  const dondeQuedan =
    o.reservas.length > 0
      ? `${
          o.reservas.length === 1 ? "Tiene una reserva" : `Tiene ${o.reservas.length} reservas`
        } en los grupos de esta lista: ${o.reservas
          .map(
            (r) =>
              `${r.grupo}, ${r.cupos} ${r.cupos === 1 ? "cupo" : "cupos"}${
                r.enEspera > 0 ? ` y ${r.enEspera} en espera` : ""
              }, con ${r.personasYaVinculadas} ${
                r.personasYaVinculadas === 1 ? "persona ya vinculada" : "personas ya vinculadas"
              }`,
          )
          .join("; ")}. Las personas de esta carga entran en esas reservas.`
      : o.sinReservaPorque === "SIN_ACCION"
        ? "Ninguna fila quedó con grupo, así que no se busca reserva: las personas quedan vinculadas a la organización."
        : o.sinReservaPorque === "ORGANIZACION_NUEVA"
          ? "La organización no está en el CRM: se crea con estos datos. No tiene reserva, así que las personas quedan vinculadas a ella sin ocupar cupos reservados."
          : "La organización no reservó cupos en estos grupos: las personas quedan vinculadas a ella sin ocupar cupos reservados.";

  return (
    <div className="rounded-lg border border-borde bg-superficie-alterna px-4 py-3 text-[0.78125rem]">
      <p className="font-semibold text-titulo">
        {o.razonSocial || "Organización sin nombre"}
        {o.nit && (
          <span className="ml-2 font-normal text-texto-suave tabular-nums">
            NIT {o.nit}
            {o.digitoVerificacion ? `-${o.digitoVerificacion}` : ""}
          </span>
        )}
        <span className="ml-2 font-normal text-texto-suave">
          {o.existe ? "· ya está en el CRM" : "· nueva"}
        </span>
      </p>
      <p className="mt-1 text-texto">
        <span className="text-texto-suave">Jefe inmediato: </span>
        {jefe || "sin datos"}
      </p>
      <p className="mt-1 text-texto">{dondeQuedan}</p>
      {o.problemas.map((p) => (
        <p key={p} className="mt-1 font-semibold text-error">
          {p}
        </p>
      ))}
      {o.avisos.map((a) => (
        <p key={a} className="mt-1 text-aviso">
          {a}
        </p>
      ))}
    </div>
  );
}
