"use client";

import { useCallback, useMemo, useState } from "react";

import { Cajon, Dato } from "@/components/admin/cajon";
import { ConfirmarBorrado } from "@/components/admin/confirmar-borrado";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import { Aviso, useAdmin } from "@/components/admin/marco-admin";
import { Tabla, type Columna } from "@/components/admin/tabla";
import { CarguePlantilla } from "@/components/admin/cargue-plantilla";
import { bonito, enMayusculas } from "@/lib/api";
import { useDatosVivos } from "@/lib/datos-vivos";
import {
  descargar,
  tablerosApi,
  type EstadoReserva,
  type FilaReserva,
  type PaginaReservas,
} from "@/lib/tableros-api";

const POR_VIAJE = 200;

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

  const vivos = useDatosVivos<PaginaReservas>(
    useCallback(() => tablerosApi.reservas({ pagina: 1, porPagina: POR_VIAJE }), []),
  );

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
        tablerosApi.reservas({ pagina: i + 2, porPagina: POR_VIAJE }),
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

  /// El relleno lateral lo pone la pantalla, no el
  /// marco: el contenedor dejo de ponerlo para que las
  /// bandas vayan a sangre, y sin esto la barra de
  /// busqueda y la paginacion quedaban pegadas al canto.
  return (
    <div className="flex min-h-0 grow flex-col gap-4 px-4 pt-4">
      {/* Sin título ni conteo: lo dice la miga, y la cifra
          va en el pie de la tabla. El aviso solo aparece si
          el servidor deja de contestar; el resto del tiempo
          aquí no hay nada, y por eso no lleva envoltorio: uno
          vacío dejaría un hueco por nada. */}
      {vivos.desactualizado && (
        <IndicadorActualizacion
          actualizadoEn={vivos.actualizadoEn}
          refrescando={vivos.refrescando}
          desactualizado={vivos.desactualizado}
          alRefrescar={vivos.refrescar}
        />
      )}

      {vivos.error && <Aviso tipo="error">{vivos.error}</Aviso>}

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
        acciones={
          <>
            <button
              onClick={() => descargar("reservas", {})}
              className="inline-flex h-[34px] items-center rounded-lg border border-marca bg-marca px-3.5 text-[0.78125rem] font-semibold text-marca-texto transition hover:bg-marca-fuerte"
            >
              Descargar en Excel
            </button>
            <CarguePlantilla
              entidad="reservas"
              admiteNuevas={false}
              alTerminar={() => vivos.refrescar()}
            />
          </>
        }
      />

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
