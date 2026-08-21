"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { Anillo, BarraAvance, n, TarjetaCifra } from "@/components/admin/graficos";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import { Aviso, CLASE_CONTROL, Tarjeta, useAdmin } from "@/components/admin/marco-admin";
import { Esqueleto, Pildora, Vacio } from "@/components/admin/piezas";
import {
  crmApi,
  ETIQUETA_ETAPA,
  ETIQUETA_RANGO,
  type Etapa,
  type FilaAccionAula,
  type FilaGrupoAula,
  type MetricasAula,
  type Rango,
  type TableroAcademico,
} from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

/** Los periodos que se ofrecen, en su orden. */
const RANGOS: Rango[] = [
  "HOY",
  "AYER",
  "SEMANA",
  "MES",
  "MES_PASADO",
  "TRIMESTRE",
  "ANO",
  "TODO",
  "PERSONALIZADO",
];

/** Las cuatro salidas del aula, en columnas. */
const SALIDAS: Array<{ etapa: Etapa; de: (m: MetricasAula) => number }> = [
  { etapa: "DESERTO", de: (m) => m.desertaron },
  { etapa: "ABANDONO", de: (m) => m.abandonaron },
  { etapa: "RETIRADO", de: (m) => m.retirados },
  { etapa: "NO_APROBO", de: (m) => m.noAprobaron },
];

function porcentaje(fraccion: number): string {
  return `${Math.round(fraccion * 100)} %`;
}

function fechaCorta(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** El calendario del grupo, o que no lo tiene. */
function fechasDe(inicio: string | null, fin: string | null): string {
  if (inicio && fin) return `del ${fechaCorta(inicio)} al ${fechaCorta(fin)}`;
  if (inicio) return `arranca el ${fechaCorta(inicio)}`;
  if (fin) return `termina el ${fechaCorta(fin)}`;
  return "sin fechas";
}

/** El código de la fila sin acción ni grupo. */
const SIN_DATO = "—";

/** AF1, AF2… AF10: por el número, no alfabético. */
function numeroDe(codigo: string): number {
  // la fila sin dato no tiene número
  if (codigo === SIN_DATO) return Number.MAX_SAFE_INTEGER;
  const hallado = /(\d+)/.exec(codigo);
  return hallado ? Number(hallado[1]) : 999;
}

// el codigo se repite entre convenios
function porCodigo(a: FilaAccionAula, b: FilaAccionAula): number {
  const paso = numeroDe(a.codigo) - numeroDe(b.codigo);
  return paso !== 0 ? paso : a.nombre.localeCompare(b.nombre, "es");
}

/** Por AF y número; el «sin grupo», al final. */
function porNumeroDeGrupo(a: FilaGrupoAula, b: FilaGrupoAula): number {
  // sin número, la resta da NaN
  if ((a.numero === null) !== (b.numero === null)) return a.numero === null ? 1 : -1;
  return porCodigo(a, b) || (a.numero ?? 0) - (b.numero ?? 0);
}

/** Flecha y porcentaje contra el periodo anterior. */
function Variacion({
  valor,
  contra,
  mejorSiBaja = false,
}: {
  valor: number | null;
  contra: string | null;
  mejorSiBaja?: boolean;
}) {
  // sin base no se pinta nada
  if (valor === null || contra === null) return null;

  const puntos = Math.round(valor * 100);
  if (puntos === 0) {
    return <p className="mt-1.5 text-xs text-texto-suave">igual que {contra}</p>;
  }

  const sube = puntos > 0;
  const bueno = sube !== mejorSiBaja;

  return (
    <p
      className={`mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-xs font-medium ${
        bueno ? "text-exito" : "text-error"
      }`}
    >
      <span aria-hidden>{sube ? "▲" : "▼"}</span>
      <span className="tabular-nums">
        {sube ? "+" : "−"}
        {Math.abs(puntos)} %
      </span>
      <span className="font-normal text-texto-suave">vs {contra}</span>
    </p>
  );
}

/** La misma tarjeta de cifra, con su variación. */
function TarjetaComparada({
  titulo,
  valor,
  sufijo,
  detalle,
  variacion,
  contra,
  mejorSiBaja,
}: {
  titulo: string;
  valor: number | string;
  sufijo?: string;
  detalle?: string;
  variacion: number | null;
  contra: string | null;
  mejorSiBaja?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-borde bg-superficie p-5 shadow-sm">
      <p className="text-sm text-texto-suave">{titulo}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-titulo">
        {typeof valor === "number" ? n(valor) : valor}
        {sufijo && <span className="ml-1 text-xl font-normal text-texto-suave">{sufijo}</span>}
      </p>
      {detalle && <p className="mt-1 text-xs text-texto-suave">{detalle}</p>}
      <Variacion valor={variacion} contra={contra} mejorSiBaja={mejorSiBaja} />
    </div>
  );
}

export default function PaginaTableroAcademico() {
  const { admin } = useAdmin();
  const [rango, setRango] = useState<Rango>("TODO");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const vivos = useDatosVivos<TableroAcademico>(
    useCallback(
      () => crmApi.tableroAcademico(rango, desde || undefined, hasta || undefined),
      [rango, desde, hasta],
    ),
    { clave: `${rango}|${desde}|${hasta}` },
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tablero académico</h1>
          <p className="mt-1 text-texto-suave">
            Cómo va cada acción de formación, cada grupo y cada asesor. Persona a
            persona, quién va al día y quién no, está en{" "}
            <Link href="/admin/participantes/academico" className="underline">
              Avance
            </Link>
            .
          </p>
        </div>
        <IndicadorActualizacion
          actualizadoEn={vivos.actualizadoEn}
          refrescando={vivos.refrescando}
          desactualizado={vivos.desactualizado}
          alRefrescar={vivos.refrescar}
        />
      </header>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className={`${CLASE_CONTROL} max-w-[14rem]`}
            value={rango}
            onChange={(e) => setRango(e.target.value as Rango)}
            aria-label="Periodo"
          >
            {RANGOS.map((r) => (
              <option key={r} value={r}>
                {ETIQUETA_RANGO[r]}
              </option>
            ))}
          </select>

          {rango === "PERSONALIZADO" && (
            <>
              <input
                type="date"
                className={`${CLASE_CONTROL} max-w-[11rem]`}
                value={desde}
                max={hasta || undefined}
                onChange={(e) => setDesde(e.target.value)}
                aria-label="Desde"
              />
              <span className="text-sm text-texto-suave">y</span>
              <input
                type="date"
                className={`${CLASE_CONTROL} max-w-[11rem]`}
                value={hasta}
                min={desde || undefined}
                onChange={(e) => setHasta(e.target.value)}
                aria-label="Hasta"
              />
            </>
          )}
        </div>

        <p className="mt-2 text-xs text-texto-suave">
          El periodo escoge la <strong className="font-medium">cohorte</strong>: quienes
          entraron al aula dentro de él. Recorta por la{" "}
          <strong className="font-medium">primera vez que la persona pisó el aula</strong>,
          que queda anotada en su historial y ya no se reescribe; quien no tenga ese
          movimiento anotado se queda fuera, se elija el periodo que se elija:
          retirarse no cuenta como entrar, porque se puede salir desde inscrito sin
          haber pisado el aula nunca.
          {rango === "PERSONALIZADO" && (!desde || !hasta) && (
            <span className="text-aviso"> Faltan las dos fechas, así que se muestra todo.</span>
          )}
        </p>
      </div>

      {vivos.error ? (
        <Aviso tipo="error">{vivos.error}</Aviso>
      ) : !vivos.datos ? (
        <Esqueleto conCifras />
      ) : (
        <Cuerpo d={vivos.datos} adminId={admin.id} />
      )}
    </div>
  );
}

/** Las cifras y los tres cortes del periodo elegido. */
function Cuerpo({ d, adminId }: { d: TableroAcademico; adminId: string }) {
  const minimo = porcentaje(d.minimoParaCertificar);
  // dentro = formación + certificados
  const enFormacion = d.dentro - d.certificados;
  const corte =
    d.ventana.desde && d.ventana.hasta
      ? `${fechaCorta(d.ventana.desde)} – ${fechaCorta(d.ventana.hasta)}`
      : "desde el principio";
  // solo si el backend trajo con que
  const contra = d.anterior ? d.ventana.etiquetaAnterior : null;

  const acciones = [...d.porAccion].sort(porCodigo);
  const grupos = [...d.porGrupo].sort(porNumeroDeGrupo);
  const mio = d.porAsesor.find((a) => a.asesorId === adminId) ?? null;
  // va en las tres descripciones
  const nota =
    d.sinMedir > 0
      ? " «Sin medir» no tiene actividades cargadas: no entra en el avance medio ni puede quedar listo."
      : "";

  return (
    <div className="space-y-6">
      {d.sinMedir > 0 && (
        <div className="rounded-xl border border-aviso/30 bg-aviso-suave p-4 text-aviso">
          <p className="text-sm font-semibold">
            {n(d.sinMedir)} de {n(d.total)}{" "}
            {d.sinMedir === 1
              ? "persona del aula no se puede medir"
              : "personas del aula no se pueden medir"}
          </p>
          <p className="mt-1.5 text-sm">
            Su acción de formación no tiene actividades obligatorias publicadas, así que
            no hay contra qué contar lo que aprobaron. No entran en el avance medio ni
            pueden figurar como listas para certificar; sí siguen contando en el aula, en
            la terminación y en la deserción.
          </p>
          <p className="mt-1.5 text-sm">
            Se resuelve cargando las actividades de cada acción de formación y
            publicándolas. Mientras el seguimiento no se alimente del LMS, hay que
            hacerlo a mano.
          </p>
        </div>
      )}

      <div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TarjetaComparada
            titulo="En el aula"
            valor={d.total}
            detalle={corte}
            variacion={d.variacion.total}
            contra={contra}
          />
          <TarjetaComparada
            titulo="Avance medio"
            valor={Math.round(d.avanceMedio * 100)}
            sufijo="%"
            detalle={
              d.sinMedir > 0
                ? `de lo obligatorio, sobre ${n(d.medibles)} de ${n(d.total)}`
                : "de lo obligatorio, aprobado"
            }
            variacion={d.variacion.avanceMedio}
            contra={contra}
          />
          <TarjetaComparada
            titulo="Terminación"
            valor={Math.round(d.terminacion * 100)}
            sufijo="%"
            detalle={`${n(d.certificados)} certificados de ${n(d.total)}`}
            variacion={d.variacion.terminacion}
            contra={contra}
          />
          <TarjetaComparada
            titulo="Deserción"
            valor={Math.round(d.desercion * 100)}
            sufijo="%"
            detalle={`${n(d.salidas)} salieron del aula`}
            variacion={d.variacion.desercion}
            contra={contra}
            mejorSiBaja
          />
        </div>

        {/* con periodo, tres no comparan */}
        {contra !== null && (
          <p className="mt-3 text-xs text-texto-suave">
            Con un periodo elegido, la flecha solo va en{" "}
            <strong className="font-medium">En el aula</strong>: el tamaño de la cohorte
            es lo único comparable. El avance, la terminación y la deserción no se
            comparan porque una cohorte recién entrada al aula no ha tenido tiempo de
            certificar, y medirla contra otra con un periodo entero más de aula daría una
            caída que no significa nada.
          </p>
        )}
      </div>

      {d.total === 0 ? (
        <Vacio titulo="Nadie en el aula todavía">
          Aquí aparece quien ya empezó la formación —en formación, certificados y quienes
          se fueron—, no los inscritos que aún no arrancan: esos se ven en Inscripciones.
          {d.ventana.desde &&
            " Y este periodo solo cuenta a quien entró al aula dentro de él: pruebe con uno más ancho."}
        </Vacio>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Tarjeta
                titulo="Avance del aula"
                descripcion={`La media de lo obligatorio aprobado por todo el que pisó el aula, salidas incluidas.${
                  d.sinMedir > 0
                    ? ` Calculada sobre ${n(d.medibles)} de ${n(d.total)}: al resto no se le puede medir.`
                    : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-center gap-8">
                  <div className="text-center">
                    <Anillo
                      porcentaje={d.avanceMedio * 100}
                      tamano={168}
                      etiqueta="Avance medio"
                    />
                    {d.sinMedir > 0 && (
                      <p className="mt-2 text-xs tabular-nums text-texto-suave">
                        sobre {n(d.medibles)} de {n(d.total)}
                      </p>
                    )}
                  </div>
                  <div className="min-w-52 grow">
                    <p className="text-3xl font-semibold tabular-nums text-titulo">
                      {n(d.listos)}
                    </p>
                    <p className="mt-1 text-sm text-texto-suave">
                      pendientes de certificar: siguen{" "}
                      <strong className="font-medium">en formación</strong> y ya aprobaron
                      el {minimo} o más de lo obligatorio. Es trabajo por hacer, no el
                      recuento de la cohorte: quien ya está certificado no cuenta aquí.
                    </p>
                    {d.sinMedir > 0 && (
                      <p className="mt-1 text-xs text-aviso">
                        {n(d.sinMedir)} sin actividades cargadas no cuentan como listos:
                        no hay con qué comprobar que llegaron al {minimo}.
                      </p>
                    )}
                    <div className="mt-4">
                      <BarraAvance
                        valor={d.listos}
                        maximo={enFormacion}
                        etiqueta="De los que siguen en formación"
                      />
                    </div>
                  </div>
                </div>
              </Tarjeta>
            </div>

            <div className="grid content-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <TarjetaCifra
                titulo="Siguen dentro"
                valor={d.dentro}
                detalle="en formación o ya certificados"
              />
              <TarjetaCifra
                titulo="Salieron"
                valor={d.salidas}
                detalle="desertaron, abandonaron, se retiraron o no aprobaron"
                tono={d.salidas > 0 ? "aviso" : "normal"}
              />
            </div>
          </div>

          <Tarjeta
            titulo="Por acción de formación"
            descripcion={`Cómo va cada curso con la gente que ya pisó el aula.${nota}`}
          >
            <TablaCorte
              encabezado="Acción"
              minimo={minimo}
              vacio="Nadie ha pisado el aula en este periodo."
              filas={acciones.map((a) => ({
                clave: `${a.codigo} ${a.nombre}`,
                metricas: a,
                aparte: a.codigo === SIN_DATO,
                principal: (
                  <>
                    <span className="font-medium">{a.codigo}</span>
                    <span
                      className="block max-w-xs truncate text-xs text-texto-suave"
                      title={a.nombre}
                    >
                      {a.nombre}
                    </span>
                  </>
                ),
              }))}
            />
          </Tarjeta>

          <Tarjeta
            titulo="Por grupo"
            descripcion={`El reparto real, con el calendario de cada grupo. Sin fechas no hay contra qué medir el ritmo.${nota}`}
          >
            <TablaCorte
              encabezado="Grupo"
              minimo={minimo}
              vacio="Nadie ha pisado el aula en este periodo."
              filas={grupos.map((g) => ({
                clave: `${g.codigo} ${g.nombre} ${g.numero ?? "sin-grupo"}`,
                metricas: g,
                aparte: g.numero === null,
                principal:
                  g.numero === null ? (
                    <>
                      <span className="font-medium">{g.nombre}</span>
                      <span className="block text-xs">
                        no es un grupo: son los que no tienen ninguno, y sin grupo no hay
                        calendario contra el que medir el ritmo
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium">
                        {g.codigo} · Grupo {g.numero}
                      </span>
                      <span
                        className={`block text-xs ${
                          g.inicio || g.fin ? "text-texto-suave" : "text-aviso"
                        }`}
                      >
                        {fechasDe(g.inicio, g.fin)}
                      </span>
                    </>
                  ),
              }))}
            />
          </Tarjeta>

          <Tarjeta
            titulo="Por asesor"
            descripcion={`De quién es cada quien en el aula: las cifras de cada fila son solo las de su gente.${nota}`}
          >
            {mio && (
              <p className="mb-4 rounded-xl bg-marca-suave px-3 py-2 text-sm">
                Tuyos: <strong className="tabular-nums">{n(mio.enAula)}</strong> en el
                aula,{" "}
                <strong className="tabular-nums">{porcentaje(mio.avanceMedio)}</strong> de
                avance medio y{" "}
                <strong className="tabular-nums">{n(mio.certificados)}</strong>{" "}
                {mio.certificados === 1 ? "certificado" : "certificados"}.
                {mio.sinMedir > 0 && (
                  <span className="text-aviso">
                    {" "}
                    El avance va sobre {n(mio.medibles)} de {n(mio.enAula)}: al resto no
                    se le puede medir.
                  </span>
                )}
              </p>
            )}

            <TablaCorte
              encabezado="Asesor"
              minimo={minimo}
              vacio="Nadie ha pisado el aula en este periodo."
              filas={d.porAsesor.map((a) => {
                const suyo = a.asesorId !== null && a.asesorId === adminId;
                return {
                  clave: a.asesorId ?? "sin-asignar",
                  metricas: a,
                  tuya: suyo,
                  principal: (
                    <span className="flex items-center gap-2">
                      <span className={suyo ? "font-semibold" : undefined}>{a.nombre}</span>
                      {suyo && <Pildora tono="marca">tú</Pildora>}
                    </span>
                  ),
                };
              })}
            />
          </Tarjeta>
        </>
      )}
    </div>
  );
}

type FilaCorte = {
  clave: string;
  principal: React.ReactNode;
  metricas: MetricasAula;
  /** La del propio usuario, para destacarla. */
  tuya?: boolean;
  /** La de los que no tienen acción ni grupo. */
  aparte?: boolean;
};

/** El porcentaje de la fila y su denominador. */
function detalleAvance(m: MetricasAula): string {
  // null: abarca varias acciones
  if (m.actividades === null) {
    return `${porcentaje(m.avanceMedio)} de lo obligatorio · varias acciones`;
  }
  const unidad = m.actividades === 1 ? "actividad" : "actividades";
  return `${porcentaje(m.avanceMedio)} de ${n(m.actividades)} ${unidad}`;
}

/** Los tres cortes miden lo mismo: una sola tabla. */
function TablaCorte({
  encabezado,
  filas,
  vacio,
  minimo,
}: {
  encabezado: string;
  filas: FilaCorte[];
  vacio: string;
  /** El mínimo para certificar, ya en porcentaje. */
  minimo: string;
}) {
  if (filas.length === 0) {
    return <p className="py-6 text-center text-sm text-texto-suave">{vacio}</p>;
  }

  // sobra si todo es medible
  const haySinMedir = filas.some((f) => f.metricas.sinMedir > 0);

  return (
    <>
      <div className="caja-scroll overflow-x-auto">
        <table className="tabla-datos">
          <thead>
            <tr>
              <th>{encabezado}</th>
              <th>En el aula</th>
              <th>Dentro</th>
              <th>Avance medio</th>
              {haySinMedir && <th>Sin medir</th>}
              <th>Listos</th>
              <th>Certificados</th>
              {SALIDAS.map((s) => (
                <th key={s.etapa}>{ETIQUETA_ETAPA[s.etapa]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.clave}
                className={f.aparte ? "border-t-2 border-borde text-texto-suave italic" : undefined}
                // en linea: la fila alterna gana
                style={f.tuya ? { background: "var(--marca-suave)" } : undefined}
              >
                <td>{f.principal}</td>
                <td className="tabular-nums">{n(f.metricas.enAula)}</td>
                <td className="tabular-nums">{n(f.metricas.dentro)}</td>
                <td className="min-w-40">
                  <BarraAvance
                    valor={Math.round(f.metricas.avanceMedio * 100)}
                    maximo={100}
                    compacta
                  />
                  {f.metricas.medibles === 0 ? (
                    <span className="mt-1 block text-xs text-aviso">
                      sin actividades cargadas
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs tabular-nums text-texto-suave">
                      {detalleAvance(f.metricas)}
                      {f.metricas.sinMedir > 0 &&
                        ` · sobre ${n(f.metricas.medibles)} de ${n(f.metricas.enAula)}`}
                    </span>
                  )}
                </td>
                {haySinMedir && (
                  <td className="tabular-nums">
                    {f.metricas.sinMedir === 0 ? (
                      <span className="text-texto-suave">—</span>
                    ) : (
                      <span className="text-aviso">{n(f.metricas.sinMedir)}</span>
                    )}
                  </td>
                )}
                <td className="tabular-nums">{n(f.metricas.listos)}</td>
                <td className="tabular-nums">{n(f.metricas.certificados)}</td>
                {SALIDAS.map((s) => (
                  <td key={s.etapa} className="tabular-nums">
                    {s.de(f.metricas) === 0 ? (
                      <span className="text-texto-suave">—</span>
                    ) : (
                      n(s.de(f.metricas))
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-texto-suave">
        «Dentro» son los que siguen: en formación o certificados. «Listos» siguen en
        formación y ya aprobaron el {minimo} o más de lo obligatorio, así que falta
        certificarlos: los ya certificados no están ahí.
      </p>
    </>
  );
}
