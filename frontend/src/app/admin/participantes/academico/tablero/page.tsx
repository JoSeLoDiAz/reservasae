"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import {
  Anillo,
  BarraAvance,
  BarrasApiladas,
  Donut,
  n,
  TarjetaCifra,
  Tasa,
  Termometro,
  type Tono,
  type TramoTermometro,
} from "@/components/admin/graficos";
import { colorEtapa } from "@/components/admin/etapa";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import { Aviso, CLASE_CONTROL, Tarjeta, useAdmin } from "@/components/admin/marco-admin";
import { Esqueleto, Pildora, Vacio } from "@/components/admin/piezas";
import {
  crmApi,
  ETIQUETA_ETAPA,
  ETIQUETA_RANGO,
  type Etapa,
  type FilaAccionAula,
  type FilaAsesorAula,
  type FilaGrupoAula,
  type GrupoQueArranca,
  type GrupoVencido,
  type MetricasAula,
  type Rango,
  type TableroAcademico,
  type TramoParados,
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

/**
 * El reparto del aula, en el orden del embudo.
 *
 * Las seis suman exactamente `enAula`: «en formación» es lo
 * que le queda a `dentro` al quitarle los certificados, y
 * las otras cuatro son las salidas. Por eso el donut y las
 * barras apiladas cuadran con la cifra grande sin pedir
 * nada más al servidor.
 */
const REPARTO: Array<{ etapa: Etapa; de: (m: MetricasAula) => number }> = [
  { etapa: "EN_FORMACION", de: (m) => m.dentro - m.certificados },
  { etapa: "CERTIFICADO", de: (m) => m.certificados },
  { etapa: "DESERTO", de: (m) => m.desertaron },
  { etapa: "ABANDONO", de: (m) => m.abandonaron },
  { etapa: "RETIRADO", de: (m) => m.retirados },
  { etapa: "NO_APROBO", de: (m) => m.noAprobaron },
];

/** Las series del reparto, ya con su color. */
const SERIES_REPARTO = REPARTO.map((r) => ({
  nombre: ETIQUETA_ETAPA[r.etapa],
  color: colorEtapa(r.etapa),
}));

/**
 * Las seis del aula sumando el corte por acción.
 *
 * La cabecera no trae las cuatro salidas por separado, solo
 * su total. Se suman aquí desde `porAccion`, que es de donde
 * el servidor saca la cabecera, así que el donut cuadra con
 * la cifra grande por construcción.
 */
function repartoTotal(filas: FilaAccionAula[]): number[] {
  return REPARTO.map((r) => filas.reduce((suma, f) => suma + r.de(f), 0));
}

/** Las cuatro salidas del aula, en columnas. */
const SALIDAS = REPARTO.slice(2);

/** Porcentaje redondo, para la prosa. */
function porcentaje(fraccion: number): string {
  return `${Math.round(fraccion * 100)} %`;
}

/** Porcentaje con una decimal, para las tablas. */
function pct(fraccion: number): string {
  return `${(fraccion * 100).toFixed(1).replace(".", ",")} %`;
}

/** Certificados sobre los que pisaron el aula. */
function terminacionDe(m: MetricasAula): number {
  return m.enAula > 0 ? m.certificados / m.enAula : 0;
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

/** Cuántos días faltan, dicho en palabras. */
function cuando(dias: number): string {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "mañana";
  return `en ${n(dias)} días`;
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

/** Por carga; el «sin asignar», al final. */
function porCarga(a: FilaAsesorAula, b: FilaAsesorAula): number {
  if ((a.asesorId === null) !== (b.asesorId === null)) return a.asesorId === null ? 1 : -1;
  return b.enAula - a.enAula || a.nombre.localeCompare(b.nombre, "es");
}

// el comparador

/** Cuánto dura un periodo; `dias` null si varía. */
type Duracion = { texto: string; dias: number | null };

const DURACION: Record<Rango, Duracion> = {
  HOY: { texto: "1 día", dias: 1 },
  AYER: { texto: "1 día", dias: 1 },
  SEMANA: { texto: "7 días", dias: 7 },
  MES: { texto: "30 días", dias: 30 },
  MES_PASADO: { texto: "un mes natural, de 28 a 31 días", dias: null },
  TRIMESTRE: { texto: "90 días", dias: 90 },
  ANO: { texto: "12 meses", dias: null },
  TODO: { texto: "todo el histórico", dias: null },
  PERSONALIZADO: { texto: "las fechas elegidas", dias: null },
};

/** El personalizado incluye los dos días. */
function duracionDe(rango: Rango, desde: string, hasta: string): Duracion {
  if (rango !== "PERSONALIZADO") return DURACION[rango];
  // sin las dos fechas cae a «todo»
  if (!desde || !hasta || desde > hasta) return DURACION.TODO;
  const dias =
    Math.round(
      (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000,
    ) + 1;
  return { texto: `${n(dias)} ${dias === 1 ? "día" : "días"}`, dias };
}

/** Si el periodo recorta de verdad o abarca todo. */
function acota(rango: Rango, desde: string, hasta: string): boolean {
  if (rango === "TODO") return false;
  if (rango === "PERSONALIZADO") return Boolean(desde && hasta && desde <= hasta);
  return true;
}

/**
 * Si las dos ventanas miden distinto de largo.
 *
 * Comparar volumen entre un día y un mes no significa nada,
 * así que hay que decirlo en pantalla. Cuando los dos duran
 * un número fijo de días se comparan los días; cuando uno es
 * de largo variable —un mes natural, doce meses— se comparan
 * las descripciones, que es lo único cierto que se puede
 * afirmar sin rehacer aquí el calendario del servidor.
 */
function duranDistinto(a: Duracion, b: Duracion): boolean {
  if (a.dias !== null && b.dias !== null) return a.dias !== b.dias;
  return a.texto !== b.texto;
}

export default function PaginaTableroAcademico() {
  const { admin } = useAdmin();
  const [rango, setRango] = useState<Rango>("TODO");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  // vacío es «el periodo anterior»
  const [contra, setContra] = useState<Rango | "">("");
  const [contraDesde, setContraDesde] = useState("");
  const [contraHasta, setContraHasta] = useState("");

  const vivos = useDatosVivos<TableroAcademico>(
    useCallback(
      () =>
        crmApi.tableroAcademico({
          rango,
          desde: desde || undefined,
          hasta: hasta || undefined,
          contra: contra || undefined,
          contraDesde: contraDesde || undefined,
          contraHasta: contraHasta || undefined,
        }),
      [rango, desde, hasta, contra, contraDesde, contraHasta],
    ),
    { clave: `${rango}|${desde}|${hasta}|${contra}|${contraDesde}|${contraHasta}` },
  );

  const duracion = duracionDe(rango, desde, hasta);
  const duracionContra = contra ? duracionDe(contra, contraDesde, contraHasta) : null;
  const contraAcota = contra ? acota(contra, contraDesde, contraHasta) : true;

  return (
    <div>
      <header className="border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.3125rem] font-bold tracking-[-0.02em] text-titulo">Tablero académico</h1>
          <p className="mt-1 max-w-3xl text-texto-suave">
            Cómo va cada acción de formación, cada grupo y cada asesor, con la cola de
            trabajo delante. Persona a persona, quién va al día y quién no, está en{" "}
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

      <section className="no-imprimir border-b border-borde bg-superficie px-7 py-5">
        <div className="grid lg:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="periodo-aula">
              Periodo
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <select
                id="periodo-aula"
                className={`${CLASE_CONTROL} max-w-[14rem]`}
                value={rango}
                onChange={(e) => setRango(e.target.value as Rango)}
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
            <p className="mt-1.5 text-xs text-texto-suave">
              Dura {duracion.texto}.
              {rango === "PERSONALIZADO" && (!desde || !hasta) && (
                <span className="text-aviso">
                  {" "}
                  Faltan las dos fechas, así que se muestra todo.
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="contra-aula">
              Comparar con
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <select
                id="contra-aula"
                className={`${CLASE_CONTROL} max-w-[14rem]`}
                value={contra}
                onChange={(e) => setContra(e.target.value as Rango | "")}
              >
                <option value="">El periodo anterior</option>
                {RANGOS.map((r) => (
                  <option key={r} value={r}>
                    {ETIQUETA_RANGO[r]}
                  </option>
                ))}
              </select>

              {contra === "PERSONALIZADO" && (
                <>
                  <input
                    type="date"
                    className={`${CLASE_CONTROL} max-w-[11rem]`}
                    value={contraDesde}
                    max={contraHasta || undefined}
                    onChange={(e) => setContraDesde(e.target.value)}
                    aria-label="Comparar desde"
                  />
                  <span className="text-sm text-texto-suave">y</span>
                  <input
                    type="date"
                    className={`${CLASE_CONTROL} max-w-[11rem]`}
                    value={contraHasta}
                    min={contraDesde || undefined}
                    onChange={(e) => setContraHasta(e.target.value)}
                    aria-label="Comparar hasta"
                  />
                </>
              )}
            </div>
            <p className="mt-1.5 text-xs text-texto-suave">
              {contra && duracionContra
                ? `Dura ${duracionContra.texto}.`
                : "El mismo tramo del periodo anterior."}
            </p>
          </div>
        </div>

        {contra !== "" && !contraAcota && (
          <p className="mt-4 rounded-xl bg-aviso-suave px-3 py-2 text-xs text-aviso">
            El periodo de comparación no acota nada, así que no hay segunda ventana con la
            que medir: no se pinta ninguna variación.
          </p>
        )}

        {contra !== "" &&
          contraAcota &&
          duracionContra !== null &&
          duranDistinto(duracion, duracionContra) && (
            <p className="mt-4 rounded-xl bg-aviso-suave px-3 py-2 text-xs text-aviso">
              Los dos periodos no duran lo mismo: {duracion.texto} frente a{" "}
              {duracionContra.texto}. Las tasas se pueden comparar; los volúmenes no —una
              ventana más larga acumula más gente por durar más, no por ir mejor.
            </p>
          )}

        <p className="mt-4 text-xs text-texto-suave">
          El periodo escoge la <strong className="font-medium">cohorte</strong>: quienes
          entraron al aula dentro de él, no cuándo ocurrió el avance. Recorta por la{" "}
          <strong className="font-medium">primera vez que la persona pisó el aula</strong>,
          que queda anotada en su historial y ya no se reescribe; quien no tenga ese
          movimiento anotado se queda fuera, se elija el periodo que se elija: retirarse no
          cuenta como entrar, porque se puede salir desde inscrito sin haber pisado el aula
          nunca.
        </p>
      </section>

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

/** La pantalla entera con los datos ya cargados. */
function Cuerpo({ d, adminId }: { d: TableroAcademico; adminId: string }) {
  const minimo = porcentaje(d.minimoParaCertificar);
  // dentro = formación + certificados
  const enFormacion = d.dentro - d.certificados;
  const corte =
    d.ventana.desde && d.ventana.hasta
      ? `${fechaCorta(d.ventana.desde)} – ${fechaCorta(d.ventana.hasta)}`
      : "desde el principio";
  // solo si el backend trajo con qué
  const contra = d.anterior ? d.ventana.etiquetaAnterior : null;
  // con cohorte, cinco no comparan
  const maduranSinFlecha = d.anterior !== null && d.ventana.desde !== null;
  const tonoDesercion: Tono = d.salidas > 0 ? "aviso" : "bueno";
  const reparto = repartoTotal(d.porAccion);

  return (
    <div>
      {d.sinMedir > 0 && <AvisoMedibles d={d} />}

      <ColaDeTrabajo
        parados={d.paradosPorDias}
        vencidos={d.gruposVencidos}
        arrancan={d.gruposQueArrancan}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-lg font-semibold">La cohorte del periodo</h2>
          <p className="text-sm text-texto-suave">
            {corte}
            {d.anterior && (
              <>
                {" · se compara "}
                <strong className="font-medium text-texto">{d.ventana.etiqueta}</strong>
                {" con "}
                <strong className="font-medium text-texto">
                  {d.ventana.etiquetaAnterior}
                </strong>
              </>
            )}
          </p>
        </div>

        <div className="grid gap-px border-t border-b border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
          <TarjetaCifra
            titulo="En el aula"
            valor={d.total}
            detalle="pisaron el aula, salidas incluidas"
            delta={{ valor: d.variacion.total, contra }}
          />
          <TarjetaCifra
            titulo="Siguen dentro"
            valor={d.dentro}
            detalle="en formación o ya certificados"
            delta={{ valor: d.variacion.dentro, contra }}
          />
          <TarjetaCifra
            titulo="Certificados"
            valor={d.certificados}
            detalle="cerraron la formación aprobando"
            tono={d.certificados > 0 ? "exito" : "normal"}
            delta={{ valor: d.variacion.certificados, contra }}
          />
          <TarjetaCifra
            titulo="Salieron"
            valor={d.salidas}
            detalle="desertaron, abandonaron, se retiraron o no aprobaron"
            tono={d.salidas > 0 ? "aviso" : "normal"}
            delta={{ valor: d.variacion.salidas, contra, invertido: true }}
          />
        </div>

        {maduranSinFlecha && (
          <p className="text-xs text-texto-suave">
            Con un periodo elegido solo se comparan{" "}
            <strong className="font-medium">En el aula</strong>,{" "}
            <strong className="font-medium">Siguen dentro</strong> y{" "}
            <strong className="font-medium">Salieron</strong>. Los certificados, los
            listos, el avance, la terminación y la deserción no se comparan porque una
            cohorte recién entrada al aula no ha tenido tiempo de certificar, y medirla
            contra otra con un periodo entero más de aula daría una caída que no significa
            nada.
          </p>
        )}
      </section>

      {d.total === 0 ? (
        <Vacio titulo="Nadie en el aula todavía">
          Aquí aparece quien ya empezó la formación —en formación, certificados y quienes
          se fueron—, no los inscritos que aún no arrancan: esos se ven en Inscripciones.
          {d.ventana.desde &&
            " Y este periodo solo cuenta a quien entró al aula dentro de él: pruebe con uno más ancho."}
        </Vacio>
      ) : (
        <>
          <Tarjeta
            titulo="Las tasas del aula"
            descripcion="Cada una con su fracción debajo: sin el denominador, un porcentaje no se puede juzgar."
          >
            <div className="grid sm:grid-cols-2 lg:grid-cols-4">
              <Tasa
                titulo="Terminación"
                parte={d.certificados}
                total={d.total}
                tono="bueno"
                detalle="certificados"
              />
              <Tasa
                titulo="Deserción"
                parte={d.salidas}
                total={d.total}
                tono={tonoDesercion}
                detalle="aquí subir es malo"
              />
              <Tasa
                titulo="Cobertura de medición"
                parte={d.medibles}
                total={d.total}
                tono={d.sinMedir > 0 ? "aviso" : "bueno"}
                detalle="con actividades cargadas"
              />
              <Tasa
                titulo="Listos por certificar"
                parte={d.listos}
                total={enFormacion}
                detalle="de los que siguen en formación"
              />
            </div>

            <p className="mt-5 text-xs text-texto-suave">
              La terminación y la deserción van sobre los {n(d.total)} que pisaron el aula,
              salidas incluidas: sacar del denominador a quien se fue subiría el porcentaje
              justo por haber perdido gente. El avance medio no cabe en esta fila porque su
              denominador es otro —los {n(d.medibles)} medibles— y va en su propio anillo.
            </p>
          </Tarjeta>

          <div className="grid lg:grid-cols-2">
            <Tarjeta
              titulo="En qué acabó cada quien"
              descripcion="Las seis etapas del aula suman exactamente los que entraron."
            >
              <Donut
                datos={REPARTO.map((r, i) => ({
                  etiqueta: ETIQUETA_ETAPA[r.etapa],
                  valor: reparto[i],
                  color: colorEtapa(r.etapa),
                }))}
                tamano={168}
                centro={n(d.total)}
                detalleCentro="en el aula"
              />
            </Tarjeta>

            <Tarjeta
              titulo="Avance y trabajo pendiente"
              descripcion={`La media de lo obligatorio aprobado por todo el que pisó el aula, salidas incluidas.${
                d.sinMedir > 0
                  ? ` Calculada sobre ${n(d.medibles)} de ${n(d.total)}: al resto no se le puede medir.`
                  : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-6">
                <div className="text-center">
                  <Anillo
                    porcentaje={d.avanceMedio * 100}
                    tamano={168}
                    etiqueta="Avance medio"
                  />
                  <p className="mt-2 text-xs tabular-nums text-texto-suave">
                    {d.sinMedir > 0
                      ? `sobre ${n(d.medibles)} de ${n(d.total)}`
                      : `sobre los ${n(d.total)} del aula`}
                  </p>
                </div>

                <div className="min-w-52 grow">
                  <p className="text-3xl font-semibold tabular-nums text-titulo">
                    {n(d.listos)}
                  </p>
                  <p className="mt-1 text-sm text-texto-suave">
                    pendientes de certificar: siguen{" "}
                    <strong className="font-medium">en formación</strong> y ya aprobaron el{" "}
                    {minimo} o más de lo obligatorio. Es trabajo por hacer, no el recuento
                    de la cohorte: quien ya está certificado no cuenta aquí.
                  </p>
                  {d.sinMedir > 0 && (
                    <p className="mt-1 text-xs text-aviso">
                      {n(d.sinMedir)} sin actividades cargadas no pueden quedar listos: no
                      hay con qué comprobar que llegaron al {minimo}.
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

          <CortePorAccion d={d} minimo={minimo} />
          <CortePorGrupo d={d} minimo={minimo} />
          <CortePorAsesor d={d} minimo={minimo} adminId={adminId} />
        </>
      )}
    </div>
  );
}

/** Cuánta gente no se puede medir, y por qué. */
function AvisoMedibles({ d }: { d: TableroAcademico }) {
  const todas = d.sinMedir === d.total;

  return (
    <div className="rounded-2xl border border-aviso/30 bg-aviso-suave p-5 text-aviso">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {todas
              ? "Nadie del aula se puede medir todavía"
              : "Hay gente del aula que no se puede medir"}
          </p>
          <p className="mt-1.5 max-w-3xl text-sm">
            Su acción de formación no tiene actividades obligatorias publicadas, así que no
            hay contra qué contar lo que aprobaron. No entran en el avance medio ni pueden
            figurar como listas para certificar; sí siguen contando en el aula, en la
            terminación y en la deserción.
          </p>
          <p className="mt-1.5 max-w-3xl text-sm">
            Se resuelve cargando las actividades de cada acción de formación y
            publicándolas. Mientras el seguimiento no se alimente del LMS, hay que hacerlo
            a mano.
          </p>
        </div>

        <p className="shrink-0 text-right">
          <span className="block text-3xl font-semibold tabular-nums">
            {n(d.sinMedir)}
          </span>
          <span className="block text-xs">de {n(d.total)} en el aula</span>
        </p>
      </div>
    </div>
  );
}

// la cola de trabajo

/** Los tramos de parados, con su tono y su rótulo. */
const TRAMOS: Record<number, { etiqueta: string; tono: Tono }> = {
  0: { etiqueta: "Entró hace 0 a 7 días", tono: "bueno" },
  8: { etiqueta: "8 a 14 días", tono: "aviso" },
  15: { etiqueta: "15 a 30 días", tono: "malo" },
  31: { etiqueta: "Más de 30 días", tono: "malo" },
  [-1]: { etiqueta: "Nunca entró", tono: "malo" },
};

/** A quién hay que llamar hoy, antes que nada. */
function ColaDeTrabajo({
  parados,
  vencidos,
  arrancan,
}: {
  parados: TramoParados[];
  vencidos: GrupoVencido[];
  arrancan: GrupoQueArranca[];
}) {
  const tramos: TramoTermometro[] = parados.map((t) => ({
    etiqueta: TRAMOS[t.dias]?.etiqueta ?? `${n(t.dias)} días`,
    total: t.total,
    tono: TRAMOS[t.dias]?.tono ?? "normal",
  }));
  const enFormacion = parados.reduce((s, t) => s + t.total, 0);
  // 15 días o más, y los que nunca
  const urgentes = parados
    .filter((t) => t.dias === -1 || t.dias >= 15)
    .reduce((s, t) => s + t.total, 0);
  const sinCerrar = vencidos.reduce((s, g) => s + g.sinCerrar, 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold">La cola de trabajo</h2>
        <p className="text-sm text-texto-suave">
          No depende del periodo: es la foto de hoy, con todas las cohortes dentro.
        </p>
      </div>

      <Tarjeta
        titulo="Sin entrar al aula"
        descripcion="De los que siguen en formación, cuánto llevan sin abrir el aula. Es la lista de a quién llamar."
      >
        {enFormacion === 0 ? (
          <p className="py-6 text-center text-sm text-texto-suave">
            No hay nadie en formación ahora mismo, así que no hay a quién rescatar.
          </p>
        ) : (
          <>
            <Termometro tramos={tramos} />

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <Tasa
                titulo="Sin entrar hace 15 días o más, o nunca"
                parte={urgentes}
                total={enFormacion}
                tono={urgentes > 0 ? "malo" : "bueno"}
                detalle="de los que siguen en formación"
              />
              <p className="text-xs text-texto-suave">
                «Nunca entró» va aparte del tramo más alto a propósito: quien no encontró
                la puerta y quien la dejó de abrir son dos problemas distintos y se
                resuelven con dos llamadas distintas. Persona a persona, la lista está en{" "}
                <Link href="/admin/participantes/academico" className="underline">
                  Avance
                </Link>
                .
              </p>
            </div>
          </>
        )}
      </Tarjeta>

      <div className="grid lg:grid-cols-2">
        <Tarjeta
          titulo="Grupos vencidos con gente dentro"
          descripcion="La fecha de fin ya pasó y siguen con gente en formación: hay que cerrarlos o justificarlos."
        >
          {vencidos.length === 0 ? (
            <p className="py-6 text-center text-sm text-texto-suave">
              Ningún grupo pasado de fecha tiene gente en formación.
            </p>
          ) : (
            <>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-3xl font-semibold tabular-nums text-aviso">
                  {n(sinCerrar)}
                </span>
                <span className="text-sm text-texto-suave">
                  sin cerrar, repartidos en {n(vencidos.length)}{" "}
                  {vencidos.length === 1 ? "grupo" : "grupos"}
                </span>
              </p>

              <ul className="caja-scroll mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                {vencidos.map((g) => (
                  <li
                    key={`${g.codigo}-${g.numero}-${g.fin}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl bg-superficie-alterna px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {g.codigo} · Grupo {g.numero}
                      </span>
                      <span className="block text-xs text-texto-suave">
                        terminó el {fechaCorta(g.fin)} · {n(g.certificados)} de{" "}
                        {n(g.enAula)} certificados
                      </span>
                    </span>
                    <Pildora tono="aviso">{n(g.sinCerrar)} sin cerrar</Pildora>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Tarjeta>

        <Tarjeta
          titulo="Grupos que arrancan"
          descripcion="Los próximos 30 días, con cuánta gente lleva cada uno. Es la agenda de la semana."
        >
          {arrancan.length === 0 ? (
            <p className="py-6 text-center text-sm text-texto-suave">
              Ningún grupo empieza en los próximos 30 días. Un grupo sin fechas cargadas
              tampoco puede salir aquí.
            </p>
          ) : (
            <ul className="caja-scroll max-h-72 space-y-2 overflow-y-auto pr-1">
              {arrancan.map((g) => (
                <li
                  key={`${g.codigo}-${g.numero}-${g.inicio}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl bg-superficie-alterna px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {g.codigo} · Grupo {g.numero}
                    </span>
                    <span className="block text-xs text-texto-suave">
                      {fechaCorta(g.inicio)} · {n(g.inscritos)}{" "}
                      {g.inscritos === 1 ? "persona" : "personas"}
                    </span>
                  </span>
                  <Pildora tono={g.dias <= 7 ? "aviso" : "neutro"}>
                    {cuando(g.dias)}
                  </Pildora>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </section>
  );
}

// los tres cortes

/** Lo que hay que aclarar cuando falta por medir. */
function notaSinMedir(d: TableroAcademico): string {
  return d.sinMedir > 0
    ? " «Sin medir» no tiene actividades cargadas: no entra en el avance medio ni puede quedar listo."
    : "";
}

/** El reparto y el detalle de cada acción. */
function CortePorAccion({ d, minimo }: { d: TableroAcademico; minimo: string }) {
  const acciones = [...d.porAccion].sort(porCodigo);

  return (
    <Tarjeta
      titulo="Por acción de formación"
      descripcion={`Cómo va cada curso con la gente que ya pisó el aula.${notaSinMedir(d)}`}
    >
      <BarrasApiladas
        filas={acciones.map((a) => ({
          etiqueta: `${a.codigo} · ${a.nombre}`,
          valores: REPARTO.map((r) => r.de(a)),
          detalle: a.medibles > 0 ? `${pct(a.avanceMedio)} de avance` : "sin medir",
        }))}
        series={SERIES_REPARTO}
        escala="composicion"
        vacio="Nadie ha pisado el aula en este periodo."
      />

      <div className="mt-6">
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
      </div>
    </Tarjeta>
  );
}

/** El reparto real, con el calendario de cada grupo. */
function CortePorGrupo({ d, minimo }: { d: TableroAcademico; minimo: string }) {
  const grupos = [...d.porGrupo].sort(porNumeroDeGrupo);

  return (
    <Tarjeta
      titulo="Por grupo"
      descripcion={`El reparto real, con el calendario de cada grupo. Sin fechas no hay contra qué medir el ritmo.${notaSinMedir(d)}`}
    >
      <BarrasApiladas
        filas={grupos.map((g) => ({
          etiqueta: g.numero === null ? g.nombre : `${g.codigo} · Grupo ${g.numero}`,
          valores: REPARTO.map((r) => r.de(g)),
          detalle: g.medibles > 0 ? `${pct(g.avanceMedio)} de avance` : "sin medir",
        }))}
        series={SERIES_REPARTO}
        escala="composicion"
        maximoFilas={12}
        vacio="Nadie ha pisado el aula en este periodo."
      />

      <div className="mt-6">
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
      </div>
    </Tarjeta>
  );
}

/** De quién es cada quien en el aula. */
function CortePorAsesor({
  d,
  minimo,
  adminId,
}: {
  d: TableroAcademico;
  minimo: string;
  adminId: string;
}) {
  const asesores = [...d.porAsesor].sort(porCarga);
  const mio = asesores.find((a) => a.asesorId === adminId) ?? null;

  return (
    <Tarjeta
      titulo="Por asesor"
      descripcion={`Las cifras de cada fila son solo las de su gente.${notaSinMedir(d)}`}
    >
      {mio && (
        <p className="mb-5 rounded-xl bg-marca-suave px-3 py-2 text-sm">
          Tuyos: <strong className="tabular-nums">{n(mio.enAula)}</strong> en el aula,{" "}
          <strong className="tabular-nums">{pct(mio.avanceMedio)}</strong> de avance medio
          y <strong className="tabular-nums">{n(mio.certificados)}</strong>{" "}
          {mio.certificados === 1 ? "certificado" : "certificados"}.
          {mio.sinMedir > 0 && (
            <span className="text-aviso">
              {" "}
              El avance va sobre {n(mio.medibles)} de {n(mio.enAula)}: al resto no se le
              puede medir.
            </span>
          )}
        </p>
      )}

      <TablaCorte
        encabezado="Asesor"
        minimo={minimo}
        vacio="Nadie ha pisado el aula en este periodo."
        filas={asesores.map((a) => {
          const suyo = a.asesorId !== null && a.asesorId === adminId;
          return {
            clave: a.asesorId ?? "sin-asignar",
            metricas: a,
            aparte: a.asesorId === null,
            tuya: suyo,
            principal: (
              <span className="flex items-center gap-2">
                <span className={suyo ? "font-semibold" : "font-medium"}>{a.nombre}</span>
                {suyo && <Pildora tono="marca">tú</Pildora>}
              </span>
            ),
          };
        })}
      />
    </Tarjeta>
  );
}

// la tabla de los tres cortes

type FilaCorte = {
  clave: string;
  principal: React.ReactNode;
  metricas: MetricasAula;
  /** La de los que no tienen acción, grupo ni asesor. */
  aparte?: boolean;
  /** La del propio usuario, para destacarla. */
  tuya?: boolean;
};

/** El porcentaje de la fila y su denominador. */
function detalleAvance(m: MetricasAula): string {
  // null: abarca varias acciones
  if (m.actividades === null) {
    return `${pct(m.avanceMedio)} de lo obligatorio · varias acciones`;
  }
  const unidad = m.actividades === 1 ? "actividad" : "actividades";
  return `${pct(m.avanceMedio)} de ${n(m.actividades)} ${unidad}`;
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
              <th>Terminación</th>
              {SALIDAS.map((s) => (
                <th key={s.etapa}>{ETIQUETA_ETAPA[s.etapa]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.clave}
                className={
                  f.aparte ? "border-t-2 border-borde text-texto-suave italic" : undefined
                }
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
                <td className="tabular-nums">
                  {pct(terminacionDe(f.metricas))}
                  <span className="mt-1 block text-xs text-texto-suave">
                    {n(f.metricas.certificados)} de {n(f.metricas.enAula)}
                  </span>
                </td>
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
        certificarlos: los ya certificados no están ahí. «Terminación» son los
        certificados sobre todo el que pisó el aula, salidas incluidas.
      </p>
    </>
  );
}
