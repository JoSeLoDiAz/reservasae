"use client";

/**
 * Reservas, unificadas: una fila por organización.
 *
 * «Hay una empresa que tiene 4 reservas en 4 AF» (cliente, 25 sep
 * 2026). El listado la enseñaba cuatro veces, y para saber qué había
 * apartado esa empresa tocaba buscar sus cuatro filas por toda la
 * tabla. Aquí la acción de formación deja de ser un VALOR de la fila
 * y pasa a ser una COLUMNA, y lo demás se consolida:
 *
 *   Fechas · Organización · Contacto · AF1…AFn · Entró por ·
 *   Total reservas · Estado
 *
 * «Cupos» desaparece como columna porque las AF ya lo dicen celda a
 * celda; lo que queda arriba es el recuento, «Total reservas».
 *
 * Las columnas AF las manda el servidor, no esta pantalla: solo se
 * saben mirando todas las reservas del recorte, y la tabla de al
 * lado pagina de a 200.
 */

import { useCallback, useMemo, useState } from "react";

import { Cajon, Dato } from "./cajon";
import { Desplegable } from "./desplegable";
import { Aviso } from "./marco-admin";
import { Cargando, Cifra } from "./piezas";
import { Tabla, type Columna } from "./tabla";
import { bonito, enMayusculas } from "@/lib/api";
import { ErrorApi } from "@/lib/api";
import {
  tablerosApi,
  type CeldaReserva,
  type ColumnaAccion,
  type EstadoReserva,
  type FilaAgrupada,
  type ReservaEnCelda,
  type ReservasAgrupadas,
} from "@/lib/tableros-api";

const ETIQUETA_ESTADO: Record<EstadoReserva, { texto: string; clase: string }> = {
  CONFIRMADA: { texto: "Confirmada", clase: "text-exito" },
  LISTA_ESPERA: { texto: "En espera", clase: "text-aviso" },
  CANCELADA: { texto: "Cancelada", clase: "text-error" },
};

/// El orden en que se ofrecen al editar: de más a menos sitio.
const ESTADOS: EstadoReserva[] = ["CONFIRMADA", "LISTA_ESPERA", "CANCELADA"];

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });

const diaYMes = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });

/**
 * Las fechas de una organización, consolidadas.
 *
 * Reservó todo el mismo día -- que es lo normal, porque el
 * formulario deja apartar varias acciones de una sentada -- y se
 * enseña UNA fecha. Si volvió otro día, se enseña el tramo: dos
 * fechas sueltas separadas por una raya dicen «entre estas dos»,
 * que es lo que se quiere saber.
 */
function rangoDeFechas(fila: FilaAgrupada): string {
  const desde = new Date(fila.primeraReserva).toDateString();
  const hasta = new Date(fila.ultimaReserva).toDateString();
  if (desde === hasta) return fecha(fila.ultimaReserva);
  return `${diaYMes(fila.primeraReserva)} – ${fecha(fila.ultimaReserva)}`;
}

/**
 * Cómo se rotula una columna AF.
 *
 * El gremio solo se añade cuando hace falta: «AF1» se repite entre
 * convenios y no significa lo mismo, así que con los dos a la vista
 * dos columnas rotuladas «AF1» a secas serían indistinguibles. Con
 * un gremio solo, repetir su sigla en las ocho cabeceras es ruido.
 */
const tituloDeAccion = (a: ColumnaAccion) =>
  a.ambiguo && a.convenioSigla ? `${a.codigo} · ${a.convenioSigla}` : a.codigo;

/**
 * Lo que dice la celda de una AF.
 *
 * El número son los cupos, que es lo que se viene a saber; el color
 * y el tachado dicen en qué estado están. La palabra entera va en la
 * columna Estado y en el cajón: repetirla en ocho celdas dejaría la
 * fila ilegible.
 */
function Celda({ celda }: { celda: CeldaReserva | undefined }) {
  if (!celda) {
    /// Ni un hueco en blanco ni un cero: no reservó esta acción, y un
    /// cero se lee como «reservó y le dieron ninguno».
    return <span className="text-texto-suave">·</span>;
  }

  const cupos =
    celda.estado === "CANCELADA" ? celda.cuposSolicitados : celda.cuposConfirmados;
  const enEspera = celda.estado !== "CANCELADA" && celda.cuposEnEspera > 0;

  /// Cada reserva se explica sola en el rótulo: con dos sedes hay
  /// dos, y el número de la celda es la suma de las dos.
  const detalle = celda.reservas
    .map(
      (r) =>
        `${ETIQUETA_ESTADO[r.estado].texto} · ${r.ubicacion} · ` +
        `${r.cuposConfirmados} de ${r.cuposSolicitados} · reservó el ${fecha(r.creadoEn)}`,
    )
    .join("\n");

  return (
    <span
      className={
        "whitespace-nowrap tabular-nums " +
        ETIQUETA_ESTADO[celda.estado].clase +
        (celda.estado === "CANCELADA" ? " line-through" : "")
      }
      title={detalle}
    >
      {cupos}
      {enEspera && <span className="text-aviso"> +{celda.cuposEnEspera}</span>}
      {/* Dos sedes en la misma acción. Sin esta marca, la celda
          enseña una suma que no cuadra con ninguna de las dos
          reservas y no dice de dónde sale. */}
      {celda.reservas.length > 1 && (
        <span className="text-texto-suave"> ×{celda.reservas.length}</span>
      )}
    </span>
  );
}

/**
 * La columna Estado: «AF1 Confirmada, AF2 Cancelada, AF3 Confirmada».
 *
 * Con todas en el mismo estado se dice una vez y se cuenta -- «las 4
 * confirmadas» --: cuatro líneas iguales no informan de nada y hacen
 * la fila cuatro veces más alta. La lista sale cuando hay mezcla,
 * que es justo cuando hace falta distinguirlas.
 */
function EstadoDeLaFila({
  fila,
  acciones,
}: {
  fila: FilaAgrupada;
  acciones: ColumnaAccion[];
}) {
  const suyas = acciones
    .filter((a) => fila.porAccion[a.accionFormacionId])
    .map((a) => ({ accion: a, celda: fila.porAccion[a.accionFormacionId] }));

  if (suyas.length === 0) return <span className="text-texto-suave">—</span>;

  const estados = new Set(suyas.map((s) => s.celda.estado));
  /// Una celda mixta --dos sedes de la misma acción en estados
  /// distintos-- no puede resumirse en una palabra: se abre la lista
  /// aunque las demás coincidan.
  if (estados.size === 1 && !suyas.some((s) => s.celda.mixta)) {
    const estado = ETIQUETA_ESTADO[suyas[0].celda.estado];
    /// Se cuentan RESERVAS y no columnas: con la misma acción en dos
    /// sedes, dos columnas son tres reservas, y la fila decía «3» en
    /// Total y «las 2» aquí al lado.
    const cuantas = suyas.reduce((t, s) => t + s.celda.reservas.length, 0);
    return (
      <span className={"whitespace-nowrap text-[0.75rem] font-semibold " + estado.clase}>
        {estado.texto}
        {cuantas > 1 && (
          <span className="font-normal text-texto-suave"> · las {cuantas}</span>
        )}
      </span>
    );
  }

  return (
    <span className="flex flex-col gap-0.5 text-[0.75rem]">
      {suyas.map(({ accion, celda }) => (
        <span key={accion.accionFormacionId} className="whitespace-nowrap">
          <span className="font-mono text-texto-suave">{accion.codigo}</span>{" "}
          {celda.mixta ? (
            /// Las dos sedes, cada una con la suya: decir solo
            /// «Confirmada» escondería la cancelada de al lado.
            celda.reservas.map((r, i) => (
              <span key={r.reservaId}>
                {i > 0 && <span className="text-texto-suave"> · </span>}
                <span className={"font-semibold " + ETIQUETA_ESTADO[r.estado].clase}>
                  {ETIQUETA_ESTADO[r.estado].texto}
                </span>
              </span>
            ))
          ) : (
            <span className={"font-semibold " + ETIQUETA_ESTADO[celda.estado].clase}>
              {ETIQUETA_ESTADO[celda.estado].texto}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

export function ReservasUnificadas({
  datos,
  puedeEditar,
  alRefrescar,
}: {
  datos: ReservasAgrupadas | null;
  puedeEditar: boolean;
  alRefrescar: () => void;
}) {
  const [abierta, setAbierta] = useState<FilaAgrupada | null>(null);

  const acciones = useMemo(() => datos?.acciones ?? [], [datos]);

  const columnas = useMemo<Columna<FilaAgrupada>[]>(() => {
    /// Las columnas AF se intercalan entre Formación y Entró por,
    /// que es donde estaba la de Formación que sustituyen.
    const deAcciones: Columna<FilaAgrupada>[] = acciones.map((a) => ({
      clave: "af:" + a.accionFormacionId,
      titulo: tituloDeAccion(a),
      numerica: true,
      filtro: "numero",
      /// Ordena y filtra por los cupos. Sin reserva va null y no
      /// cero: cero es un número que se ordena entre los demás, y
      /// «no reservó» no es «reservó cero».
      valor: (f) => {
        const celda = f.porAccion[a.accionFormacionId];
        if (!celda) return null;
        return celda.estado === "CANCELADA"
          ? celda.cuposSolicitados
          : celda.cuposConfirmados;
      },
      pinta: (f) => <Celda celda={f.porAccion[a.accionFormacionId]} />,
    }));

    return [
      {
        clave: "fechas",
        titulo: "Fechas",
        /// Ordena por la ÚLTIMA: es la que dice quién se movió hace
        /// poco. La primera va en el cajón.
        valor: (f) => f.ultimaReserva,
        pinta: (f) => (
          <span
            className="whitespace-nowrap text-texto-suave"
            title={
              f.primeraReserva === f.ultimaReserva
                ? undefined
                : `De ${fecha(f.primeraReserva)} a ${fecha(f.ultimaReserva)}`
            }
          >
            {rangoDeFechas(f)}
          </span>
        ),
      },
      {
        clave: "organizacion",
        titulo: "Organización",
        fija: true,
        valor: (f) => enMayusculas(f.razonSocial),
        pinta: (f) => (
          <>
            <p className="font-medium">{enMayusculas(f.razonSocial)}</p>
            <p className="font-mono text-xs text-texto-suave">
              {f.nit}
              {f.digitoVerificacion ? "-" + f.digitoVerificacion : ""}
            </p>
          </>
        ),
        filtro: "texto",
      },
      {
        clave: "nit",
        titulo: "NIT",
        aparte: true,
        valor: (f) => f.nit,
        filtro: "texto",
      },
      {
        clave: "contacto",
        titulo: "Contacto",
        /// Se buscan TODOS aunque solo se pinte el primero: si no,
        /// buscar a la segunda persona de una empresa no encontraba
        /// su fila aunque estuviera ahí.
        valor: (f) => f.contactos.map((c) => c.nombre + " " + c.correo).join(" "),
        pinta: (f) => {
          const primero = f.contactos[0];
          if (!primero) return <span className="text-texto-suave">—</span>;
          return (
            <>
              <p>
                {primero.nombre}
                {f.contactos.length > 1 && (
                  <span
                    className="text-texto-suave"
                    title={f.contactos
                      .slice(1)
                      .map((c) => `${c.nombre} (${c.codigos.join(", ")})`)
                      .join("\n")}
                  >
                    {" "}
                    +{f.contactos.length - 1}
                  </span>
                )}
              </p>
              <p className="text-xs text-texto-suave">{primero.correo}</p>
            </>
          );
        },
        filtro: "texto",
      },
      ...deAcciones,
      {
        clave: "entroPor",
        titulo: "Entró por",
        valor: (f) => f.formularios.map((x) => x.titulo).join(" "),
        pinta: (f) => {
          const primero = f.formularios[0];
          if (!primero) return <span className="text-xs text-texto-suave">—</span>;
          return (
            <>
              <p className="max-w-44 truncate text-sm" title={primero.titulo}>
                {primero.titulo}
                {f.formularios.length > 1 && (
                  <span className="text-texto-suave"> +{f.formularios.length - 1}</span>
                )}
              </p>
              <p className="font-mono text-xs text-texto-suave">/{primero.slug}</p>
            </>
          );
        },
        filtro: "opciones",
      },
      {
        clave: "total",
        titulo: "Total reservas",
        numerica: true,
        valor: (f) => f.totalReservas,
        pinta: (f) => (
          <span className="whitespace-nowrap tabular-nums">
            {f.totalReservas}
            {f.cuposConfirmados > 0 && (
              <span className="text-xs text-texto-suave"> · {f.cuposConfirmados} cupos</span>
            )}
          </span>
        ),
        filtro: "numero",
      },
      {
        clave: "estado",
        titulo: "Estado",
        /// El valor plano se filtra y se busca: lleva las palabras
        /// de todas, no solo las de la primera.
        valor: (f) =>
          [
            ...new Set(
              Object.values(f.porAccion)
                .flatMap((c) => c.reservas)
                .map((r) => ETIQUETA_ESTADO[r.estado].texto),
            ),
          ].join(", "),
        pinta: (f) => <EstadoDeLaFila fila={f} acciones={acciones} />,
        filtro: "opciones",
      },
      {
        clave: "cuposConfirmados",
        titulo: "Cupos apartados",
        aparte: true,
        numerica: true,
        valor: (f) => f.cuposConfirmados,
        filtro: "numero",
      },
      {
        clave: "cuposEspera",
        titulo: "En espera",
        aparte: true,
        numerica: true,
        valor: (f) => f.cuposEnEspera,
        filtro: "numero",
      },
      {
        clave: "canceladas",
        titulo: "Canceladas",
        aparte: true,
        numerica: true,
        valor: (f) => f.reservasCanceladas,
        filtro: "numero",
      },
      {
        clave: "gremio",
        titulo: "Gremio",
        aparte: true,
        valor: (f) =>
          f.redAsociada === "Otro" ? (f.redAsociadaOtra ?? "Otro") : (f.redAsociada ?? ""),
        filtro: "opciones",
      },
      {
        clave: "colaboradores",
        titulo: "Colaboradores",
        aparte: true,
        numerica: true,
        valor: (f) => f.numeroColaboradores,
        filtro: "numero",
      },
      {
        clave: "celular",
        titulo: "Celular",
        aparte: true,
        valor: (f) => f.contactos.map((c) => c.celular).filter(Boolean).join(", "),
        filtro: "texto",
      },
      {
        clave: "cargo",
        titulo: "Cargo",
        aparte: true,
        valor: (f) => f.contactos.map((c) => c.cargo).filter(Boolean).join(", "),
        filtro: "texto",
      },
    ];
  }, [acciones]);

  const filas = datos?.filas ?? null;
  const cargadas = filas ?? [];
  const cuposApartados = cargadas.reduce((t, f) => t + f.cuposConfirmados, 0);
  const cuposEnEspera = cargadas.reduce((t, f) => t + f.cuposEnEspera, 0);
  const reservas = cargadas.reduce((t, f) => t + f.totalReservas, 0);
  const canceladas = cargadas.reduce((t, f) => t + f.reservasCanceladas, 0);
  /// Cuántas apartaron más de una acción: es el dato que explica por
  /// qué esta pantalla existe.
  const conVarias = cargadas.filter((f) => f.totalReservas > 1).length;

  /// La fila abierta se vuelve a tomar de los datos vivos: si no, al
  /// cambiar un estado el cajón seguiría enseñando el de antes hasta
  /// cerrarlo y volver a abrirlo.
  const enElCajon = abierta
    ? (cargadas.find((f) => f.empresaId === abierta.empresaId) ?? abierta)
    : null;

  return (
    <>
      {cargadas.length > 0 && (
        <div className="flex flex-wrap items-stretch gap-2">
          <Cifra
            etiqueta="Organizaciones"
            valor={datos?.total ?? cargadas.length}
            pie={
              conVarias > 0
                ? `${conVarias} con más de una acción`
                : "una acción cada una"
            }
          />
          <Cifra etiqueta="Reservas" valor={reservas} pie="repartidas entre ellas" />
          <Cifra
            etiqueta="Cupos apartados"
            valor={cuposApartados}
            pie="en reservas confirmadas"
            color={cuposApartados > 0 ? "var(--exito)" : undefined}
          />
          <Cifra
            etiqueta="En espera"
            valor={cuposEnEspera}
            pie={cuposEnEspera > 0 ? "cupos sin sitio todavía" : "ninguno esperando"}
            color={cuposEnEspera > 0 ? "var(--aviso)" : undefined}
          />
          <Cifra
            etiqueta="Canceladas"
            valor={canceladas}
            pie={canceladas > 0 ? "sus cupos volvieron a la oferta" : "ninguna cancelada"}
            color={canceladas > 0 ? "var(--error)" : undefined}
          />
        </div>
      )}

      {datos?.truncado && (
        <Aviso tipo="error">
          Hay más organizaciones de las que caben en esta vista. Se están enseñando las{" "}
          {cargadas.length} con más cupos apartados; para verlas todas, use el listado por
          reserva o la descarga en Excel.
        </Aviso>
      )}

      {/* LA TABLA NO SE MONTA HASTA QUE LLEGAN LOS DATOS, y no es
          por estética.

          Las columnas AF salen del servidor, así que en el primer
          pintado no existen. La tabla guarda su juego de columnas en
          cuanto monta —para recordar cuáles se dejaron puestas— y las
          que aparecen DESPUÉS las trata como recién añadidas, que por
          diseño van al final. Resultado: Fechas, Organización,
          Contacto, Entró por, Total, Estado… y las ocho AF detrás,
          justo donde no sirven.

          Montándola ya con los datos, su primer juego de columnas es
          el completo y el orden es el declarado. Si más adelante
          alguien reserva una acción nueva, esa sí sale al final una
          vez, que es lo que la tabla quiere hacer. */}
      {datos === null ? (
        <Cargando que="Cargando las reservas…" />
      ) : (
        <Tabla
          id="reservas-unificadas"
          columnas={columnas}
          filas={filas}
          clave={(f) => f.empresaId}
          alClic={setAbierta}
          sinDescarga
          vacio="Aparecerán en cuanto alguien reserve desde un formulario."
        />
      )}

      {enElCajon && (
        <CajonDeLaOrganizacion
          fila={enElCajon}
          acciones={acciones}
          puedeEditar={puedeEditar}
          alCerrar={() => setAbierta(null)}
          alCambiar={alRefrescar}
        />
      )}
    </>
  );
}

/**
 * El cajón de una organización: sus datos y sus reservas, una por
 * acción, cada una con su estado editable.
 *
 * El estado se edita AQUÍ y no en la tabla porque es de la reserva,
 * no de la organización: una empresa con cuatro AF tiene cuatro
 * estados, y un control en la fila no sabría a cuál de los cuatro
 * le está hablando.
 */
function CajonDeLaOrganizacion({
  fila,
  acciones,
  puedeEditar,
  alCerrar,
  alCambiar,
}: {
  fila: FilaAgrupada;
  acciones: ColumnaAccion[];
  puedeEditar: boolean;
  alCerrar: () => void;
  alCambiar: () => void;
}) {
  const suyas = acciones
    .filter((a) => fila.porAccion[a.accionFormacionId])
    .map((a) => ({ accion: a, celda: fila.porAccion[a.accionFormacionId] }));

  return (
    <Cajon
      titulo={bonito(fila.razonSocial)}
      subtitulo={
        <>
          {fila.nit}
          {fila.digitoVerificacion ? "-" + fila.digitoVerificacion : ""} ·{" "}
          {fila.totalReservas === 1
            ? `reservó el ${fecha(fila.ultimaReserva)}`
            : `${fila.totalReservas} reservas, ${rangoDeFechas(fila)}`}
        </>
      }
      alCerrar={alCerrar}
    >
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Dato titulo="Cupos apartados" valor={String(fila.cuposConfirmados)} />
        <Dato
          titulo="En espera"
          valor={fila.cuposEnEspera > 0 ? String(fila.cuposEnEspera) : null}
        />
        <Dato
          titulo="Colaboradores"
          valor={fila.numeroColaboradores?.toString() ?? null}
        />
        <Dato
          titulo="Gremio"
          valor={
            fila.redAsociada === "Otro"
              ? "Otro: " + (fila.redAsociadaOtra ?? "sin especificar")
              : fila.redAsociada
          }
        />
      </dl>

      <h3 className="mt-7 text-sm font-semibold">
        {fila.contactos.length === 1 ? "Contacto" : "Contactos"}
      </h3>
      {/* Van todos y con sus acciones al lado: el contacto es de la
          reserva --«quien diligencia, distinto en cada curso»--, así
          que una empresa con cuatro AF puede traer cuatro personas, y
          enseñar solo la primera escondería a las otras tres. */}
      <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {fila.contactos.map((c) => (
          <Dato
            key={c.correo}
            titulo={
              fila.contactos.length > 1 ? `${c.nombre} · ${c.codigos.join(", ")}` : c.nombre
            }
            valor={
              <>
                <span className="block">{c.correo}</span>
                {c.celular && <span className="block text-texto-suave">{c.celular}</span>}
                {c.cargo && <span className="block text-texto-suave">{c.cargo}</span>}
              </>
            }
          />
        ))}
      </dl>

      <h3 className="mt-7 text-sm font-semibold">
        {fila.totalReservas === 1 ? "Su reserva" : `Sus ${fila.totalReservas} reservas`}
      </h3>
      {/* Una tarjeta por RESERVA y no por acción: la misma acción en
          dos sedes son dos reservas con su propio cupo y su propio
          estado, y un solo control no sabría a cuál de las dos le
          habla. El código de la acción se repite, que es justo lo que
          hay que ver. */}
      <div className="mt-3 flex flex-col gap-3">
        {suyas.flatMap(({ accion, celda }) =>
          celda.reservas.map((r) => (
            <ReservaDeLaAccion
              key={r.reservaId}
              accion={accion}
              reserva={r}
              puedeEditar={puedeEditar}
              alCambiar={alCambiar}
            />
          )),
        )}
      </div>
    </Cajon>
  );
}

/**
 * Una reserva dentro del cajón, con su estado editable.
 *
 * DE DÓNDE SALE «Confirmada / Cancelada», que es lo que preguntó el
 * cliente: hasta ahora, de ninguna mano. Lo decidía el cupo al
 * crearla --`confirmados > 0 ? CONFIRMADA : LISTA_ESPERA`-- y solo
 * se movía solo. Ahora se puede pedir, pero lo que queda lo siguen
 * decidiendo los cupos: confirmar sobre una oferta llena devuelve
 * «En espera» y se dice. Escribir la etiqueta a secas daría una
 * reserva confirmada sin cupo detrás, o sea cupos que no existen en
 * ninguna parte y que el informe del SENA sumaría igual.
 */
function ReservaDeLaAccion({
  accion,
  reserva,
  puedeEditar,
  alCambiar,
}: {
  accion: ColumnaAccion;
  reserva: ReservaEnCelda;
  puedeEditar: boolean;
  alCambiar: () => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const estado = ETIQUETA_ESTADO[reserva.estado];

  const cambiar = useCallback(
    async (pedido: string) => {
      if (pedido === reserva.estado) return;
      setError(null);
      setNota(null);
      setGuardando(true);
      try {
        const hecho = await tablerosApi.cambiarEstadoReserva(
          reserva.reservaId,
          pedido as EstadoReserva,
        );
        /// Se dice cuándo lo pedido y lo que quedó no coinciden: si
        /// no, el desplegable se queda en «Confirmada», la fila sale
        /// «En espera» y parece que no funcionó.
        if (hecho.recortado) {
          setNota(
            `No había cupos libres en ${accion.codigo}, así que quedó en espera con ` +
              `${hecho.cuposEnEspera} ${hecho.cuposEnEspera === 1 ? "cupo" : "cupos"}.`,
          );
        } else if (pedido === "CANCELADA") {
          setNota("Cancelada. Sus cupos volvieron a la oferta.");
        } else if (pedido === "CONFIRMADA") {
          setNota(
            `Confirmada con ${hecho.cuposConfirmados} ` +
              `${hecho.cuposConfirmados === 1 ? "cupo" : "cupos"}.`,
          );
        } else {
          setNota("Pasó a espera. Sus cupos volvieron a la oferta.");
        }
        alCambiar();
      } catch (e) {
        setError(
          e instanceof ErrorApi ? e.message : "No se pudo cambiar el estado.",
        );
      } finally {
        setGuardando(false);
      }
    },
    [accion.codigo, alCambiar, reserva.estado, reserva.reservaId],
  );

  return (
    <div className="rounded-[10px] border border-borde p-3">
      <p className="text-sm font-medium">
        <span className="font-mono text-xs text-texto-suave">{accion.codigo}</span>{" "}
        {bonito(accion.nombre)}
      </p>
      <p className="mt-0.5 text-xs text-texto-suave">
        {bonito(reserva.ubicacion)} · {reserva.modalidad.toLowerCase()} · reservó el{" "}
        {fecha(reserva.creadoEn)}
        {reserva.formulario && <> · por /{reserva.formulario.slug}</>}
      </p>

      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-3">
        <Dato titulo="Solicitados" valor={String(reserva.cuposSolicitados)} />
        <Dato titulo="Confirmados" valor={String(reserva.cuposConfirmados)} />
        <Dato
          titulo="En espera"
          valor={reserva.cuposEnEspera > 0 ? String(reserva.cuposEnEspera) : null}
        />
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[0.75rem] text-texto-suave">Estado</span>
        {puedeEditar ? (
          <Desplegable
            valor={reserva.estado}
            etiquetaAria={`Estado de la reserva en ${accion.codigo}`}
            desactivado={guardando}
            opciones={ESTADOS.map((e) => ({
              valor: e,
              etiqueta: ETIQUETA_ESTADO[e].texto,
              detalle:
                e === "CONFIRMADA"
                  ? "Toma los cupos que haya libres"
                  : e === "LISTA_ESPERA"
                    ? "Suelta sus cupos y espera turno"
                    : "Devuelve sus cupos a la oferta",
            }))}
            alElegir={cambiar}
          />
        ) : (
          <span className={"text-[0.75rem] font-semibold " + estado.clase}>
            {estado.texto}
          </span>
        )}
        {reserva.canceladaEn && reserva.estado === "CANCELADA" && (
          <span className="text-xs text-texto-suave">
            el {fecha(reserva.canceladaEn)}
          </span>
        )}
      </div>

      {nota && <p className="mt-2 text-xs text-texto-suave">{nota}</p>}
      {error && (
        <p className="mt-2 text-xs text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
