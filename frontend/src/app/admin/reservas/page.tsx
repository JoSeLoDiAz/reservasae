"use client";

import { useCallback, useEffect, useState } from "react";

import { n } from "@/components/admin/graficos";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import { ConfirmarBorrado } from "@/components/admin/confirmar-borrado";
import { Aviso, CLASE_CONTROL, Tarjeta, useAdmin } from "@/components/admin/marco-admin";
import { adminApi } from "@/lib/admin-api";
import { bonito } from "@/lib/api";
import { useDatosVivos } from "@/lib/datos-vivos";
import {
  descargar,
  tablerosApi,
  type EstadoReserva,
  type FilaFormulario,
  type FilaReserva,
  type PaginaReservas,
} from "@/lib/tableros-api";

const ESTADOS: Array<{ valor: EstadoReserva | ""; etiqueta: string }> = [
  { valor: "", etiqueta: "Todos los estados" },
  { valor: "CONFIRMADA", etiqueta: "Confirmadas" },
  { valor: "LISTA_ESPERA", etiqueta: "En lista de espera" },
  { valor: "CANCELADA", etiqueta: "Canceladas" },
];

const ETIQUETA_ESTADO: Record<EstadoReserva, { texto: string; clase: string }> = {
  CONFIRMADA: { texto: "Confirmada", clase: "bg-exito-suave text-exito" },
  LISTA_ESPERA: { texto: "En espera", clase: "bg-aviso-suave text-aviso" },
  CANCELADA: { texto: "Cancelada", clase: "bg-error-suave text-error" },
};

export default function PaginaReservas() {
  const [convenios, setConvenios] = useState<Array<{ slug: string; sigla: string | null }>>([]);

  const [buscar, setBuscar] = useState("");
  const [textoBuscado, setTextoBuscado] = useState("");
  const [estado, setEstado] = useState<EstadoReserva | "">("");
  const [convenio, setConvenio] = useState("");
  const [formularios, setFormularios] = useState<FilaFormulario[]>([]);
  const [formulario, setFormulario] = useState("");
  const [pagina, setPagina] = useState(1);

  const filtros = { buscar: textoBuscado, estado, convenio, formulario, pagina };

  // el temporizador usa siempre los filtros vigentes
  const vivos = useDatosVivos<PaginaReservas>(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useCallback(
      () => tablerosApi.reservas(filtros),
      [textoBuscado, estado, convenio, formulario, pagina],
    ),
  );

  const datos = vivos.datos;
  const error = vivos.error;
  const cargando = vivos.refrescando;
  const { admin } = useAdmin();

  useEffect(() => {
    void adminApi.convenios().then(setConvenios);
    void tablerosApi.formularios().then(setFormularios);
  }, []);

  function buscarAhora(evento: React.FormEvent) {
    evento.preventDefault();
    setPagina(1);
    setTextoBuscado(buscar);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reservas</h1>
          <p className="mt-1 text-texto-suave">
            {datos ? `${n(datos.total)} registros` : "Cargando…"}
          </p>
          <div className="mt-3">
            <IndicadorActualizacion
              actualizadoEn={vivos.actualizadoEn}
              refrescando={vivos.refrescando}
              desactualizado={vivos.desactualizado}
              alRefrescar={vivos.refrescar}
            />
          </div>
        </div>
        <button
          onClick={() => descargar("reservas", filtros)}
          className="rounded-xl bg-marca px-4 py-2 text-sm font-medium text-marca-texto transition hover:bg-marca-fuerte"
        >
          Descargar en Excel
        </button>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <Tarjeta titulo="Filtros">
        <form onSubmit={buscarAhora} className="flex flex-wrap gap-3">
          <input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Nombre, correo, organización o NIT"
            className={`${CLASE_CONTROL} min-w-56 flex-1`}
          />
          <select
            value={estado}
            onChange={(e) => {
              setPagina(1);
              setEstado(e.target.value as EstadoReserva | "");
            }}
            className={`${CLASE_CONTROL} sm:w-52`}
          >
            {ESTADOS.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.etiqueta}
              </option>
            ))}
          </select>
          <select
            value={convenio}
            onChange={(e) => {
              setPagina(1);
              setConvenio(e.target.value);
            }}
            className={`${CLASE_CONTROL} sm:w-52`}
          >
            <option value="">Todos los convenios</option>
            {convenios.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.sigla ?? c.slug}
              </option>
            ))}
          </select>
          <select
            value={formulario}
            onChange={(e) => {
              setPagina(1);
              setFormulario(e.target.value);
            }}
            className={`${CLASE_CONTROL} sm:w-56`}
          >
            <option value="">Todos los formularios</option>
            {formularios
              .filter((f) => f.slug)
              .map((f) => (
                <option key={f.slug} value={f.slug}>
                  {f.titulo} ({f.reservas})
                </option>
              ))}
          </select>
          <button
            type="submit"
            className="rounded-xl border border-borde px-5 py-2 text-sm font-medium hover:bg-superficie-alterna"
          >
            Buscar
          </button>
        </form>
      </Tarjeta>

      <Tarjeta titulo="Listado">
        {cargando && !datos && <p className="text-texto-suave">Cargando…</p>}

        <div className="overflow-x-auto">
          <table className="tabla-datos text-sm">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Organización</th>
                <th>Contacto</th>
                <th>Formación</th>
                <th>Entró por</th>
                <th className="text-right">Cupos</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {datos?.filas.map((r) => (
                <Fila
                  key={r.id}
                  reserva={r}
                  esSuperadmin={admin.rol === "SUPERADMIN"}
                  alBorrar={vivos.refrescar}
                />
              ))}
            </tbody>
          </table>
        </div>

        {datos && datos.filas.length === 0 && (
          <p className="py-8 text-center text-sm text-texto-suave">
            No hay reservas que coincidan con estos filtros.
          </p>
        )}

        {datos && datos.paginas > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-texto-suave">
              Página {datos.pagina} de {datos.paginas}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagina((p) => Math.max(p - 1, 1))}
                disabled={datos.pagina <= 1 || cargando}
                className="rounded-lg border border-borde px-4 py-1.5 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() => setPagina((p) => Math.min(p + 1, datos.paginas))}
                disabled={datos.pagina >= datos.paginas || cargando}
                className="rounded-lg border border-borde px-4 py-1.5 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

function Fila({
  reserva,
  esSuperadmin,
  alBorrar,
}: {
  reserva: FilaReserva;
  esSuperadmin: boolean;
  alBorrar: () => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const estado = ETIQUETA_ESTADO[reserva.estado];

  return (
    <>
      <tr>
        <td className="whitespace-nowrap text-texto-suave">
          {new Date(reserva.creadoEn).toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "short",
            year: "2-digit",
          })}
        </td>
        <td>
          <p className="font-medium">{bonito(reserva.empresa.razonSocial)}</p>
          <p className="font-mono text-xs text-texto-suave">
            {reserva.empresa.nit}
            {reserva.empresa.digitoVerificacion
              ? `-${reserva.empresa.digitoVerificacion}`
              : ""}
          </p>
        </td>
        <td>
          <p>{reserva.contacto.nombre}</p>
          <p className="text-xs text-texto-suave">{reserva.contacto.correo}</p>
        </td>
        <td>
          <p className="max-w-72 truncate" title={bonito(reserva.oferta.accion)}>
            <span className="font-mono text-xs text-texto-suave">{reserva.oferta.codigo}</span>{" "}
            {bonito(reserva.oferta.accion)}
          </p>
          <p className="text-xs text-texto-suave">{bonito(reserva.oferta.ubicacion)}</p>
        </td>
        <td>
          {reserva.formulario ? (
            <>
              <p className="max-w-44 truncate text-sm" title={reserva.formulario.titulo}>
                {reserva.formulario.titulo}
              </p>
              <p className="font-mono text-xs text-texto-suave">/{reserva.formulario.slug}</p>
            </>
          ) : (
            <span className="text-xs text-texto-suave">—</span>
          )}
        </td>
        <td className="whitespace-nowrap text-right tabular-nums">
          {reserva.cuposConfirmados}
          {reserva.cuposEnEspera > 0 && (
            <span className="text-aviso"> +{reserva.cuposEnEspera}</span>
          )}
        </td>
        <td>
          <span
            className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${estado.clase}`}
          >
            {estado.texto}
          </span>
        </td>
        <td>
          <button
            onClick={() => setAbierta(!abierta)}
            className="whitespace-nowrap text-marca underline"
          >
            {abierta ? "Ocultar" : "Detalle"}
          </button>
        </td>
      </tr>

      {abierta && (
        <tr>
          <td colSpan={8} className="bg-superficie-alterna">
            <dl className="grid gap-x-8 gap-y-3 p-2 sm:grid-cols-2 lg:grid-cols-3">
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
                    ? `Otro: ${reserva.empresa.redAsociadaOtra ?? "sin especificar"}`
                    : reserva.empresa.redAsociada
                }
              />
              <Dato titulo="Cupos solicitados" valor={String(reserva.cuposSolicitados)} />
              <Dato
                titulo="Cancelada"
                valor={
                  reserva.canceladaEn
                    ? new Date(reserva.canceladaEn).toLocaleString("es-CO")
                    : null
                }
              />
              {reserva.respuestas.map((r) => (
                <Dato key={r.pregunta} titulo={r.pregunta} valor={r.valor} />
              ))}
            </dl>

            {esSuperadmin && (
              <div className="flex justify-end px-2 pb-3">
                <button
                  onClick={() => setBorrando(true)}
                  className="text-sm text-error underline"
                >
                  Borrar esta reserva
                </button>
              </div>
            )}
          </td>
        </tr>
      )}

      {borrando && (
        <tr>
          <td>
            <ConfirmarBorrado
              titulo="Borrar la reserva"
              palabra={reserva.empresa.nit}
              etiquetaPalabra="Para confirmarlo, escriba el NIT"
              descripcion={
                <>
                  Se borran <strong>{bonito(reserva.empresa.razonSocial)}</strong> y sus{" "}
                  {reserva.cuposConfirmados} cupos en {reserva.oferta.codigo}{" "}
                  {bonito(reserva.oferta.ubicacion)}. Los cupos vuelven a la oferta.
                  Si la organización se queda sin ninguna otra reserva, se borra también.
                  Esto no se deshace.
                </>
              }
              alCerrar={() => setBorrando(false)}
              alConfirmar={async () => {
                await tablerosApi.borrarReserva(reserva.id);
                setBorrando(false);
                alBorrar();
              }}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <dt className="text-xs text-texto-suave">{titulo}</dt>
      <dd>{valor}</dd>
    </div>
  );
}
