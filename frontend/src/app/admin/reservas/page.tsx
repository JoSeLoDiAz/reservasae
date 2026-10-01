"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Cajon, Dato } from "@/components/admin/cajon";
import { Encabezado } from "@/components/admin/piezas";
import { ConfirmarBorrado } from "@/components/admin/confirmar-borrado";
import {
  ElegirConRotulo,
  FiltroDePeriodo,
  PERIODO_INICIAL,
  type Periodo,
  ventanaDe,
} from "@/components/admin/filtro-de-periodo";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import { Aviso, useAdmin } from "@/components/admin/marco-admin";
import { Cifra } from "@/components/admin/piezas";
import { ReservasUnificadas } from "@/components/admin/reservas-unificadas";
import { Tabla, type Columna } from "@/components/admin/tabla";
import { CarguePlantilla } from "@/components/admin/cargue-plantilla";
import { alcanza } from "@/lib/admin-api";
import { bonito, enMayusculas } from "@/lib/api";
import { useDatosVivos } from "@/lib/datos-vivos";
import {
  descargar,
  tablerosApi,
  type EstadoReserva,
  type FilaReserva,
  type PaginaReservas,
  type ReservasAgrupadas,
} from "@/lib/tableros-api";

const POR_VIAJE = 200;

/**
 * Cómo se miran las reservas: unificadas o una por una.
 *
 * «Unificar criterios» (cliente, 25 sep 2026) es lo que se abre por
 * omisión: una fila por organización, con las acciones de formación
 * como columnas. El listado de siempre --una fila por reserva-- se
 * queda al lado y no debajo: es el que lleva la descarga en Excel,
 * el cargue de plantilla y la respuesta de cada formulario, que no
 * caben en una fila consolidada.
 */
type Vista = "organizacion" | "reserva";

/// Dónde se recuerda cuál eligió. Va en el navegador y no en la
/// cuenta: es una preferencia de cómo mirar, no un permiso.
const LLAVE_VISTA = "convoca:reservas:vista";

const ETIQUETA_ESTADO: Record<EstadoReserva, { texto: string; clase: string }> = {
  CONFIRMADA: { texto: "Confirmada", clase: "text-exito" },
  LISTA_ESPERA: { texto: "En espera", clase: "text-aviso" },
  CANCELADA: { texto: "Cancelada", clase: "text-error" },
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });

export default function PaginaReservas() {
  const [todas, setTodas] = useState<{ base: FilaReserva[]; filas: FilaReserva[] } | null>(
    null,
  );
  const [abierta, setAbierta] = useState<FilaReserva | null>(null);
  const { admin } = useAdmin();

  /**
   * EL PERIODO, AQUÍ TODAVÍA SIN RECORTAR.
   *
   * El control es el mismo de los demás tableros ---uno solo y no
   * cinco--- pero esta pantalla no cuelga del CRM: come de
   * `/admin/tableros/reservas` y `/reservas-agrupadas`, que reciben
   * `FiltrosReservas` (buscar, estado, convenio, accionId, formulario)
   * y NO la ventana de fechas. `llegoDesde`/`llegoHasta` viven en el
   * `Filtros` del CRM, que es otro objeto y otro servicio.
   *
   * Se pinta igual, y debajo se dice que aún no recorta. Mandarle las
   * dos fechas al servidor sería peor: las ignoraría en silencio y la
   * tabla se quedaría igual mientras el control asegura un periodo ---
   * exactamente el «filtros que no funcionan» del que se quejó el
   * cliente. Para que recorte de verdad hace falta que
   * `FiltrosReservas` acepte las fechas y `donde()` las lleve a
   * `creadoEn gte/lt`, que es servidor y no se toca desde aquí.
   */
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_INICIAL);

  /// Arranca en la unificada y se corrige en el primer pintado con lo
  /// que guardó la última vez. Leer `localStorage` durante el render
  /// deja el servidor y el navegador pintando cosas distintas.
  const [vista, setVista] = useState<Vista>("organizacion");
  // localStorage no existe en el servidor: leerlo en el estado
  // inicial rompe la hidratación. Es el mismo trato que le da la
  // tabla a su tamaño de página.
  useEffect(() => {
    try {
      const guardada = window.localStorage.getItem(LLAVE_VISTA);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (guardada === "reserva" || guardada === "organizacion") setVista(guardada);
    } catch {
      // en ventana privada localStorage puede fallar
    }
  }, []);

  const elegirVista = useCallback((cual: Vista) => {
    setVista(cual);
    try {
      window.localStorage.setItem(LLAVE_VISTA, cual);
    } catch {
      // que no se recuerde no es motivo para no cambiarla
    }
  }, []);

  /// Cada vista refresca solo mientras se está mirando. Las dos a la
  /// vez serían el doble de viajes cada treinta segundos para pintar
  /// una sola tabla.
  const vivos = useDatosVivos<PaginaReservas>(
    useCallback(
      () =>
        tablerosApi.reservas({
          pagina: 1,
          porPagina: POR_VIAJE,
          ...ventanaDe(periodo),
        }),
      [periodo],
    ),
    {
      activo: vista === "reserva",
      /// La clave LLEVA EL PERIODO: es lo que le dice que la pregunta
      /// es otra y hay que volver a preguntar YA. Ver arriba.
      clave: `reservas-${JSON.stringify(periodo)}`,
    },
  );

  /// La unificada trae lo suyo del servidor: agrupar en el navegador
  /// sobre una página de 200 parte en dos a la empresa cuyas AF caen
  /// en páginas distintas, y el error no se ve.
  const agrupadas = useDatosVivos<ReservasAgrupadas>(
    /// LA MISMA VENTANA QUE LA LISTA. Si el agrupado no la llevara,
    /// las dos vistas de esta pantalla ---«Por reserva» y «Por
    /// organización»--- contestarían distinto al mismo filtro.
    useCallback(() => tablerosApi.reservasAgrupadas(ventanaDe(periodo)), [periodo]),
    {
      activo: vista === "organizacion",
      clave: `reservas-agrupadas-${JSON.stringify(periodo)}`,
    },
  );

  const puedeEditarEstado =
    !admin.permisos || alcanza(admin.permisos.reserva, "ESCRIBIR");

  const datos = vivos.datos;

  // el superset solo vale mientras su base siga vigente:
  // al refrescar cada 30 s se cae solo, sin efecto que
  // lo limpie ni riesgo de ensenar paginas rancias
  const filas =
    todas && todas.base === datos?.filas ? todas.filas : (datos?.filas ?? null);

  const cargarTodas = useCallback(async () => {
    if (!datos) return;
    const resto = await Promise.all(
      Array.from({ length: datos.paginas - 1 }, (_, i) =>
        tablerosApi.reservas({
          pagina: i + 2,
          porPagina: POR_VIAJE,
          ...ventanaDe(periodo),
        }),
      ),
    );
    setTodas({ base: datos.filas, filas: [...datos.filas, ...resto.flatMap((p) => p.filas)] });
  }, [datos]);

  const columnas = useMemo<Columna<FilaReserva>[]>(
    () => [
      {
        clave: "fecha",
        titulo: "Fecha",
        valor: (r) => r.creadoEn,
        pinta: (r) => <span className="whitespace-nowrap text-texto-suave">{fecha(r.creadoEn)}</span>,
      },
      {
        clave: "empresa",
        titulo: "Organización",
        fija: true,
        valor: (r) => enMayusculas(r.empresa.razonSocial),
        pinta: (r) => (
          <>
            <p className="font-medium">{enMayusculas(r.empresa.razonSocial)}</p>
            <p className="font-mono text-xs text-texto-suave">
              {r.empresa.nit}
              {r.empresa.digitoVerificacion ? "-" + r.empresa.digitoVerificacion : ""}
            </p>
          </>
        ),
        filtro: "texto",
      },
      { clave: "nit", titulo: "NIT", aparte: true, valor: (r) => r.empresa.nit, filtro: "texto" },
      {
        clave: "contacto",
        titulo: "Contacto",
        valor: (r) => r.contacto.nombre + " " + r.contacto.correo,
        pinta: (r) => (
          <>
            <p>{r.contacto.nombre}</p>
            <p className="text-xs text-texto-suave">{r.contacto.correo}</p>
          </>
        ),
        filtro: "texto",
      },
      {
        clave: "formacion",
        titulo: "Formación",
        valor: (r) => r.oferta.codigo + " " + bonito(r.oferta.accion),
        pinta: (r) => (
          <>
            <p className="max-w-72 truncate" title={bonito(r.oferta.accion)}>
              <span className="font-mono text-xs text-texto-suave">{r.oferta.codigo}</span>{" "}
              {bonito(r.oferta.accion)}
            </p>
            <p className="text-xs text-texto-suave">{bonito(r.oferta.ubicacion)}</p>
          </>
        ),
        filtro: "texto",
      },
      { clave: "codigo", titulo: "Código", aparte: true, valor: (r) => r.oferta.codigo, filtro: "opciones" },
      {
        clave: "ubicacion",
        titulo: "Ubicación",
        aparte: true,
        valor: (r) => bonito(r.oferta.ubicacion),
        filtro: "opciones",
      },
      { clave: "modalidad", titulo: "Modalidad", aparte: true, valor: (r) => r.oferta.modalidad, filtro: "opciones" },
      {
        clave: "convenio",
        titulo: "Convenio",
        aparte: true,
        valor: (r) => r.oferta.convenioSigla ?? r.oferta.convenio,
        filtro: "opciones",
      },
      {
        clave: "entroPor",
        titulo: "Entró por",
        valor: (r) => r.formulario?.titulo ?? "",
        pinta: (r) =>
          r.formulario ? (
            <>
              <p className="max-w-44 truncate text-sm" title={r.formulario.titulo}>
                {r.formulario.titulo}
              </p>
              <p className="font-mono text-xs text-texto-suave">/{r.formulario.slug}</p>
            </>
          ) : (
            <span className="text-xs text-texto-suave">—</span>
          ),
        filtro: "opciones",
      },
      {
        clave: "cupos",
        titulo: "Cupos",
        numerica: true,
        valor: (r) => r.cuposConfirmados,
        pinta: (r) => (
          <span className="whitespace-nowrap">
            {r.cuposConfirmados}
            {r.cuposEnEspera > 0 && <span className="text-aviso"> +{r.cuposEnEspera}</span>}
          </span>
        ),
        filtro: "numero",
      },
      {
        clave: "espera",
        titulo: "En espera",
        aparte: true,
        numerica: true,
        valor: (r) => r.cuposEnEspera,
        filtro: "numero",
      },
      {
        clave: "solicitados",
        titulo: "Solicitados",
        aparte: true,
        numerica: true,
        valor: (r) => r.cuposSolicitados,
        filtro: "numero",
      },
      {
        clave: "estado",
        titulo: "Estado",
        valor: (r) => ETIQUETA_ESTADO[r.estado].texto,
        pinta: (r) => (
          <span
            className={
              "whitespace-nowrap text-[0.75rem] font-semibold " +
              ETIQUETA_ESTADO[r.estado].clase
            }
          >
            {ETIQUETA_ESTADO[r.estado].texto}
          </span>
        ),
        filtro: "opciones",
      },
      {
        clave: "gremio",
        titulo: "Gremio",
        aparte: true,
        valor: (r) =>
          r.empresa.redAsociada === "Otro"
            ? (r.empresa.redAsociadaOtra ?? "Otro")
            : (r.empresa.redAsociada ?? ""),
        filtro: "opciones",
      },
      {
        clave: "colaboradores",
        titulo: "Colaboradores",
        aparte: true,
        numerica: true,
        valor: (r) => r.empresa.numeroColaboradores,
        filtro: "numero",
      },
      { clave: "celular", titulo: "Celular", aparte: true, valor: (r) => r.contacto.celular, filtro: "texto" },
      { clave: "cargo", titulo: "Cargo", aparte: true, valor: (r) => r.contacto.cargo, filtro: "texto" },
    ],
    [],
  );

  /// LO QUE DICEN LAS TARJETAS.
  ///
  /// «Cupos apartados» cuenta solo los de las CONFIRMADAS: los de una
  /// cancelada volvieron a la oferta y sumarlos daría cupos que no
  /// están apartados en ninguna parte. Y «en espera» cuenta reservas
  /// --no cupos-- porque es lo que se gestiona: una reserva en espera
  /// se atiende entera cuando se abre un grupo. Sus cupos van en el
  /// pie, que es donde se consultan.
  const cargadas = filas ?? [];
  const confirmadas = cargadas.filter((f) => f.estado === "CONFIRMADA");
  const cuposApartados = confirmadas.reduce((t, f) => t + f.cuposConfirmados, 0);
  const enEspera = cargadas.filter((f) => f.estado === "LISTA_ESPERA").length;
  const cuposEnEspera = cargadas.reduce((t, f) => t + f.cuposEnEspera, 0);
  const canceladas = cargadas.filter((f) => f.estado === "CANCELADA").length;
  const organizaciones = new Set(cargadas.map((f) => f.empresa.nit)).size;

  /// El relleno lateral lo pone la pantalla, no el
  /// marco: el contenedor dejo de ponerlo para que las
  /// bandas vayan a sangre, y sin esto la barra de
  /// busqueda y la paginacion quedaban pegadas al canto.
  const mirando = vista === "organizacion" ? agrupadas : vivos;

  /**
   * La descarga y el cargue, UNA VEZ Y PARA LAS DOS VISTAS.
   *
   * «Debemos tener los mismos botones en las dos vistas» (cliente, 25
   * sep 2026). Estaban escritos dentro de la tabla de «Por reserva»,
   * que es donde nacieron, y al pasar a «Por organización»
   * desaparecían. No hay razón: la plantilla que se carga no depende
   * de cómo esté agrupada la pantalla.
   *
   * LO QUE SÍ DEPENDE ES EL FICHERO QUE BAJA (cliente, 30 sep 2026:
   * la descarga de «Por organización» tiene que salir igual que su
   * modelo). Hasta hoy el botón bajaba el mismo Excel en las dos
   * vistas --una fila por reserva, otras columnas y otros rótulos--,
   * así que desde «Por organización» bajaba una tabla que no era la
   * que se estaba mirando. Ahora cada vista baja lo suyo: la
   * unificada, la hoja del modelo con sus veintiuna columnas y sus
   * dos fórmulas de Excel; el listado, el fichero de siempre con las
   * respuestas de cada formulario, que no caben en una fila
   * consolidada.
   *
   * Y LA DESCARGA LLEVA EL PERIODO. La unificada se recorta por
   * `creadoEn` en el servidor: sin la ventana, el fichero traería
   * organizaciones que la pantalla no está enseñando.
   *
   * Lo que refresca al terminar el cargue es la vista QUE SE ESTÁ
   * MIRANDO, no siempre el listado por reserva: subir un fichero
   * desde «Por organización» y ver la tabla igual que antes se lee
   * como que el cargue no funcionó.
   */
  const botones = (
    <>
      <button
        onClick={() =>
          vista === "organizacion"
            ? descargar("reservas-por-organizacion", ventanaDe(periodo))
            : descargar("reservas", {})
        }
        /// La medida de la barra de la tabla, la misma que
        /// los dos de `CarguePlantilla` que vienen detrás:
        /// 32 de alto, radio 9, relleno 13.
        className="inline-flex h-[32px] items-center rounded-[9px] bg-marca px-[13px] text-[0.78125rem] font-semibold text-marca-texto transition hover:bg-marca-fuerte sin-aro"
      >
        Descargar en Excel
      </button>
      <CarguePlantilla
        entidad="reservas"
        admiteNuevas={false}
        alTerminar={() => mirando.refrescar()}
      />
    </>
  );

  return (
    <div className="flex min-h-0 grow flex-col gap-3 px-4 pt-3">
      {/* LAS DOS VISTAS Y EL PERIODO, EN LA MISMA FILA.

          «En reservas esto debe ir al lado derecho, para quitar esa
          fila y ganar espacio» (cliente, 30 sep 2026). El periodo se
          comía un renglón entero él solo, debajo de las dos vistas, y
          las dos cosas contestan lo mismo: qué se mira. */}
      {/* CON TÍTULO: «¿y no veo el título de reservas? Como Gestión y
          Seguimiento de reservas» (cliente, 1 oct 2026). Era la única
          pantalla del panel que empezaba directamente en los
          controles, y sin cabecera no se sabía qué se está mirando.

          Las dos vistas, EN DESPLEGABLE y con rótulo, al lado del
          periodo: «esto igual desplegable al lado de Periodo, pero con
          título» (cliente, 1 oct 2026). */}
      <Encabezado compacto titulo="Gestión y seguimiento de reservas">
        <ElegirConRotulo
          rotulo="Cómo se mira"
          valor={vista}
          opciones={[
            { valor: "organizacion", etiqueta: "Por organización" },
            { valor: "reserva", etiqueta: "Por reserva" },
          ]}
          alElegir={(v) => elegirVista(v as Vista)}
          ancho="10.5rem"
        />
        <FiltroDePeriodo periodo={periodo} alCambiar={setPeriodo} />
      </Encabezado>

      {/* Sin título ni conteo: lo dice la miga, y la cifra
          va en el pie de la tabla. El aviso solo aparece si
          el servidor deja de contestar; el resto del tiempo
          aquí no hay nada, y por eso no lleva envoltorio: uno
          vacío dejaría un hueco por nada. */}
      {mirando.desactualizado && (
        <IndicadorActualizacion
          actualizadoEn={mirando.actualizadoEn}
          refrescando={mirando.refrescando}
          desactualizado={mirando.desactualizado}
          alRefrescar={mirando.refrescar}
        />
      )}

      {mirando.error && <Aviso tipo="error">{mirando.error}</Aviso>}

      {vista === "organizacion" && (
        <ReservasUnificadas
          datos={agrupadas.datos}
          puedeEditar={puedeEditarEstado}
          alRefrescar={agrupadas.refrescar}
          botones={botones}
        />
      )}

      {/* LAS CIFRAS, COMO EN GESTIÓN DE LEADS. «No veo tarjetas en
          reservas como lo tiene Gestión de leads» (cliente, 23 sep
          2026): la pantalla era la tabla a secas, y lo que se viene a
          saber de un vistazo --cuántos cupos hay apartados, cuánto está
          esperando-- había que sumarlo a mano columna por columna.

          Se cuentan de las filas cargadas, no del servidor, y por eso
          la primera dice sobre cuántas: la tabla trae 200 por viaje y
          con más reservas que eso una cifra que parece el total no lo
          sería. */}
      {vista === "reserva" && cargadas.length > 0 && (
        <div className="flex flex-wrap items-stretch gap-2">
          {/* LAS MISMAS CINCO, EN EL MISMO ORDEN Y CON LAS MISMAS
              PALABRAS QUE «Por organización».

              «¿Por qué tengo diferencias en los valores?» (cliente, 25
              sep 2026): una vista decía «En espera 1» y la otra
              «Cupos en espera 6». Las dos tenían razón --1 reserva que
              lleva 6 cupos-- y ninguna lo decía: la misma etiqueta
              contaba reservas aquí y cupos allá. Dos cifras distintas
              bajo la misma palabra, en la misma pantalla, a un clic
              una de otra.

              Manda la unidad de al lado: si la tarjeta vecina dice
              «Cupos apartados», esta cuenta CUPOS, y las reservas van
              al pie. */}
          <Cifra
            etiqueta="Organizaciones"
            valor={organizaciones}
            pie="con al menos una reserva"
          />
          <Cifra
            etiqueta="Reservas"
            valor={datos?.total ?? cargadas.length}
            pie={
              datos && datos.total > cargadas.length
                ? `contado sobre las ${cargadas.length} cargadas`
                : "confirmadas, en espera y canceladas"
            }
          />
          <Cifra
            etiqueta="Cupos apartados"
            valor={cuposApartados}
            pie="en reservas confirmadas"
            color={cuposApartados > 0 ? "var(--exito)" : undefined}
          />
          <Cifra
            etiqueta="Cupos en espera"
            valor={cuposEnEspera}
            pie={
              enEspera > 0
                ? `en ${enEspera} ${enEspera === 1 ? "reserva" : "reservas"}`
                : "ninguno esperando"
            }
            color={cuposEnEspera > 0 ? "var(--aviso)" : undefined}
          />
          <Cifra
            etiqueta="Reservas canceladas"
            valor={canceladas}
            pie={canceladas > 0 ? "sus cupos volvieron a la oferta" : "ninguna cancelada"}
            color={canceladas > 0 ? "var(--error)" : undefined}
          />
        </div>
      )}

      {vista === "reserva" && (
        <Tabla
          id="reservas"
          columnas={columnas}
          filas={filas}
          clave={(r) => r.id}
          total={datos?.total}
          alCargarTodo={datos && datos.paginas > 1 ? cargarTodas : undefined}
          alClic={setAbierta}
          // ya trae la suya, del servidor y con todas las filas
          sinDescarga
          vacio="Aparecerán en cuanto alguien reserve desde un formulario."
          acciones={botones}
        />
      )}

      {abierta && (
        <PanelReserva
          reserva={abierta}
          esSuperadmin={admin.rol === "SUPERADMIN"}
          alCerrar={() => setAbierta(null)}
          alBorrar={() => {
            setAbierta(null);
            vivos.refrescar();
          }}
        />
      )}
    </div>
  );
}

/**
 * Las dos formas de mirar las reservas.
 *
 * Dos enlaces y no un desplegable: son dos, se leen de un vistazo y
 * cuál está puesta se ve sin abrir nada. Van en `rem` y sin alto
 * fijo, para que la banda crezca con la letra cuando el panel sube
 * al 140 %.
 */
function ElegirVista({
  vista,
  alElegir,
}: {
  vista: Vista;
  alElegir: (cual: Vista) => void;
}) {
  const opciones: Array<{ valor: Vista; texto: string; explica: string }> = [
    {
      valor: "organizacion",
      texto: "Por organización",
      explica: "Una fila por empresa, con las acciones de formación como columnas",
    },
    {
      valor: "reserva",
      texto: "Por reserva",
      explica: "Una fila por reserva, con la descarga en Excel y el cargue de plantilla",
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Cómo mirar las reservas"
      className="flex flex-wrap items-center gap-1"
    >
      {opciones.map((o) => {
        const puesta = o.valor === vista;
        return (
          <button
            key={o.valor}
            role="tab"
            aria-selected={puesta}
            title={o.explica}
            onClick={() => alElegir(o.valor)}
            className={
              "rounded-[9px] border px-[13px] py-[0.4em] text-[0.78125rem] transition " +
              (puesta
                ? "border-marca font-semibold text-marca"
                : "border-borde text-texto-suave hover:text-texto")
            }
          >
            {o.texto}
          </button>
        );
      })}
    </div>
  );
}

function PanelReserva({
  reserva,
  esSuperadmin,
  alCerrar,
  alBorrar,
}: {
  reserva: FilaReserva;
  esSuperadmin: boolean;
  alCerrar: () => void;
  alBorrar: () => void;
}) {
  const [borrando, setBorrando] = useState(false);
  const estado = ETIQUETA_ESTADO[reserva.estado];

  return (
    <Cajon
      titulo={bonito(reserva.empresa.razonSocial)}
      subtitulo={
        <>
          {reserva.empresa.nit}
          {reserva.empresa.digitoVerificacion ? "-" + reserva.empresa.digitoVerificacion : ""} ·
          reservó el {fecha(reserva.creadoEn)}
        </>
      }
      alCerrar={alCerrar}
      pie={
        esSuperadmin ? (
          <button onClick={() => setBorrando(true)} className="text-sm text-error underline">
            Borrar esta reserva
          </button>
        ) : undefined
      }
    >
      <span
        className={
          "inline-block text-[0.75rem] font-semibold " + estado.clase
        }
      >
        {estado.texto}
      </span>

      <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Dato
          titulo="Formación"
          valor={
            <>
              <span className="font-mono text-xs text-texto-suave">{reserva.oferta.codigo}</span>{" "}
              {bonito(reserva.oferta.accion)}
            </>
          }
        />
        <Dato titulo="Ubicación" valor={bonito(reserva.oferta.ubicacion)} />
        <Dato titulo="Modalidad" valor={reserva.oferta.modalidad.toLowerCase()} />
        <Dato
          titulo="Convenio"
          valor={reserva.oferta.convenioSigla ?? reserva.oferta.convenio}
        />
        <Dato titulo="Cupos solicitados" valor={String(reserva.cuposSolicitados)} />
        <Dato titulo="Confirmados" valor={String(reserva.cuposConfirmados)} />
        <Dato
          titulo="En espera"
          valor={reserva.cuposEnEspera > 0 ? String(reserva.cuposEnEspera) : null}
        />
        <Dato titulo="Contacto" valor={reserva.contacto.nombre} />
        <Dato titulo="Correo" valor={reserva.contacto.correo} />
        <Dato titulo="Celular" valor={reserva.contacto.celular} />
        <Dato titulo="Cargo" valor={reserva.contacto.cargo} />
        <Dato
          titulo="Colaboradores"
          valor={reserva.empresa.numeroColaboradores?.toString() ?? null}
        />
        <Dato
          titulo="Gremio"
          valor={
            reserva.empresa.redAsociada === "Otro"
              ? "Otro: " + (reserva.empresa.redAsociadaOtra ?? "sin especificar")
              : reserva.empresa.redAsociada
          }
        />
        <Dato
          titulo="Entró por"
          valor={reserva.formulario ? "/" + reserva.formulario.slug : null}
        />
        <Dato
          titulo="Cancelada"
          valor={
            reserva.canceladaEn ? new Date(reserva.canceladaEn).toLocaleString("es-CO") : null
          }
        />
      </dl>

      {reserva.respuestas.length > 0 && (
        <>
          <h3 className="mt-7 text-sm font-semibold">Lo que respondió en el formulario</h3>
          <dl className="mt-3 space-y-3">
            {reserva.respuestas.map((r) => (
              <Dato key={r.pregunta} titulo={r.pregunta} valor={r.valor} />
            ))}
          </dl>
        </>
      )}

      {borrando && (
        <ConfirmarBorrado
          titulo="Borrar la reserva"
          palabra={reserva.empresa.nit}
          etiquetaPalabra="Para confirmarlo, escriba el NIT"
          descripcion={
            <>
              Se borran <strong>{bonito(reserva.empresa.razonSocial)}</strong> y sus{" "}
              {reserva.cuposConfirmados} cupos en {reserva.oferta.codigo}{" "}
              {bonito(reserva.oferta.ubicacion)}. Los cupos vuelven a la oferta. La
              reserva no se borra: queda como cancelada, con su historial. Esto no se
              deshace.
            </>
          }
          alCerrar={() => setBorrando(false)}
          alConfirmar={async () => {
            await tablerosApi.cancelarReserva(reserva.id);
            setBorrando(false);
            alBorrar();
          }}
        />
      )}
    </Cajon>
  );
}
