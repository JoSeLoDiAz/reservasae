"use client";

import { useState } from "react";

import { api, bonito, ErrorApi, type ConsultaPorNit } from "@/lib/api";

type Fila = ConsultaPorNit["reservas"][number];

export function ConsultaReservas() {
  const [nit, setNit] = useState("");
  const [datos, setDatos] = useState<ConsultaPorNit | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscar(evento?: React.FormEvent) {
    evento?.preventDefault();
    setError(null);
    setBuscando(true);
    try {
      setDatos(await api.consultarPorNit(nit));
    } catch (e) {
      setError((e as ErrorApi).message);
      setDatos(null);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={buscar}
        className="rounded-xl border border-borde bg-superficie p-6"
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            NIT de la organización
          </span>
          <div className="flex flex-wrap gap-3">
            <input
              required
              value={nit}
              onChange={(e) => setNit(e.target.value)}
              placeholder="860505081"
              inputMode="numeric"
              className="min-w-48 flex-1 rounded-lg border border-campo-borde bg-campo-fondo px-3 py-2 outline-none focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25"
            />
            <button
              type="submit"
              disabled={buscando}
              className="rounded-lg bg-marca px-6 py-2 font-medium text-marca-texto hover:bg-marca-fuerte disabled:opacity-50"
            >
              {buscando ? "Buscando…" : "Consultar"}
            </button>
          </div>
        </label>
        {error && <p className="mt-3 text-sm text-error">{error}</p>}
      </form>

      {datos && !datos.empresa && (
        <p className="rounded-xl border border-borde bg-superficie p-6 text-texto-suave">
          No hay reservas registradas con ese NIT.
        </p>
      )}

      {datos?.empresa && (
        <section className="rounded-xl border border-borde bg-superficie p-6">
          <h2 className="text-lg font-medium">{bonito(datos.empresa.razonSocial)}</h2>
          <p className="text-sm text-texto-suave">
            NIT {datos.empresa.nit}
            {datos.empresa.digitoVerificacion
              ? `-${datos.empresa.digitoVerificacion}`
              : ""}{" "}
            · {datos.totalCupos} cupos confirmados en total
          </p>

          <ul className="mt-6 space-y-4">
            {datos.reservas.map((reserva) => (
              <TarjetaReserva
                key={reserva.id}
                reserva={reserva}
                nit={datos.empresa!.nit}
                alCambiar={buscar}
              />
            ))}
          </ul>

          {datos.reservas.length === 0 && (
            <p className="mt-4 text-texto-suave">Esta organización no tiene reservas.</p>
          )}
        </section>
      )}
    </div>
  );
}

const ESTADOS = {
  CONFIRMADA: { texto: "Confirmada", clase: "bg-exito-suave text-exito" },
  LISTA_ESPERA: { texto: "En lista de espera", clase: "bg-aviso-suave text-aviso" },
  CANCELADA: { texto: "Cancelada", clase: "bg-error-suave text-error" },
} as const;

function TarjetaReserva({
  reserva,
  nit,
  alCambiar,
}: {
  reserva: Fila;
  nit: string;
  alCambiar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [cantidad, setCantidad] = useState(String(reserva.cuposSolicitados));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelada = reserva.estado === "CANCELADA";
  const estado = ESTADOS[reserva.estado];

  async function guardar() {
    setError(null);
    setOcupado(true);
    try {
      await api.editarReserva(reserva.id, nit, Number(cantidad));
      setEditando(false);
      alCambiar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }

  async function cancelar() {
    // confirmación explícita antes de cancelar
    if (
      !window.confirm(
        "Al cancelar, los cupos se liberan de inmediato y pueden ser tomados por " +
          "otra organización. ¿Desea continuar?",
      )
    ) {
      return;
    }
    setError(null);
    setOcupado(true);
    try {
      await api.cancelarReserva(reserva.id, nit);
      alCambiar();
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <li className="rounded-lg border border-borde p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{bonito(reserva.oferta.accion.nombre)}</p>
          <p className="text-sm text-texto-suave">
            {bonito(reserva.oferta.ubicacion)} ·{" "}
            {reserva.oferta.modalidad === "PRESENCIAL" ? "Presencial" : "Virtual"}
            {reserva.oferta.accion.horas ? ` · ${reserva.oferta.accion.horas} h` : ""}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estado.clase}`}>
          {estado.texto}
        </span>
      </div>

      {!cancelada && (
        <p className="mt-3 text-sm">
          <strong>{reserva.cuposConfirmados}</strong> cupos confirmados
          {reserva.cuposEnEspera > 0 && (
            <> y {reserva.cuposEnEspera} en lista de espera</>
          )}
        </p>
      )}

      {editando ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="w-24 rounded-lg border border-borde px-3 py-1.5 outline-none focus:border-marca"
          />
          <button
            onClick={guardar}
            disabled={ocupado}
            className="rounded-lg bg-marca px-4 py-1.5 text-sm font-medium text-marca-texto hover:bg-marca-fuerte disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            onClick={() => {
              setEditando(false);
              setCantidad(String(reserva.cuposSolicitados));
              setError(null);
            }}
            className="text-sm text-texto-suave underline"
          >
            Cancelar cambio
          </button>
        </div>
      ) : (
        !cancelada && (
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <button
              onClick={() => setEditando(true)}
              className="font-medium text-marca underline"
            >
              Cambiar cantidad de cupos
            </button>
            <button onClick={cancelar} disabled={ocupado} className="text-error underline">
              Cancelar la reserva
            </button>
          </div>
        )
      )}

      {error && <p className="mt-3 text-sm text-error">{error}</p>}
    </li>
  );
}

