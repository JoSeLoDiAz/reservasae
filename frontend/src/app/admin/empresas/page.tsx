"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { n } from "@/components/admin/graficos";
import { Aviso } from "@/components/admin/marco-admin";
import { Tabla, type Columna } from "@/components/admin/tabla";
import { bonito, ErrorApi } from "@/lib/api";
import { descargar, tablerosApi, type FilaEmpresa } from "@/lib/tableros-api";

/** Cuántos cupos lleva cada organización. */
export default function PaginaEmpresas() {
  const [filas, setFilas] = useState<FilaEmpresa[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setFilas(await tablerosApi.empresas(""));
      setError(null);
    } catch (e) {
      setError((e as ErrorApi).message);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const totalCupos = filas?.reduce((s, f) => s + f.confirmados, 0) ?? 0;

  const columnas = useMemo<Columna<FilaEmpresa>[]>(
    () => [
      {
        clave: "nit",
        titulo: "NIT",
        fija: true,
        valor: (f) => f.nit,
        pinta: (f) => (
          <span className="whitespace-nowrap font-mono text-xs">
            {f.nit}
            {f.digitoVerificacion ? "-" + f.digitoVerificacion : ""}
          </span>
        ),
        filtro: "texto",
      },
      {
        clave: "razonSocial",
        titulo: "Organización",
        fija: true,
        valor: (f) => bonito(f.razonSocial),
        pinta: (f) => <span className="font-medium">{bonito(f.razonSocial)}</span>,
        filtro: "texto",
      },
      {
        clave: "gremio",
        titulo: "Gremio",
        valor: (f) =>
          f.redAsociada === "Otro" ? (f.redAsociadaOtra ?? "Otro") : (f.redAsociada ?? ""),
        filtro: "opciones",
      },
      {
        clave: "colaboradores",
        titulo: "Colaboradores",
        numerica: true,
        valor: (f) => f.numeroColaboradores,
        pinta: (f) =>
          f.numeroColaboradores ? n(f.numeroColaboradores) : <Guion />,
        filtro: "numero",
      },
      { clave: "reservas", titulo: "Reservas", numerica: true, valor: (f) => f.reservas, filtro: "numero" },
      {
        clave: "confirmados",
        titulo: "Confirmados",
        numerica: true,
        valor: (f) => f.confirmados,
        pinta: (f) => <span className="font-medium">{n(f.confirmados)}</span>,
        filtro: "numero",
      },
      {
        clave: "enEspera",
        titulo: "En espera",
        numerica: true,
        valor: (f) => f.enEspera,
        pinta: (f) =>
          f.enEspera > 0 ? <span className="text-aviso">{n(f.enEspera)}</span> : <Guion />,
        filtro: "numero",
      },
      {
        clave: "cursos",
        titulo: "Cursos",
        valor: (f) => f.cursos.join(", "),
        pinta: (f) => (
          <span className="font-mono text-xs text-texto-suave">{f.cursos.join(", ")}</span>
        ),
        filtro: "texto",
      },
      {
        clave: "f7",
        titulo: "Datos para el F7",
        valor: (f) => (f.faltaF7.length === 0 ? "Completa" : "Le faltan " + f.faltaF7.length),
        pinta: (f) =>
          f.faltaF7.length === 0 ? (
            <span className="text-exito">Completa</span>
          ) : (
            <span className="text-aviso" title={f.faltaF7.join(" · ")}>
              Le faltan {f.faltaF7.length}
            </span>
          ),
        filtro: "opciones",
      },
      // las del F7: existen, salen cuando las piden
      { clave: "departamento", titulo: "Departamento", aparte: true, valor: (f) => f.departamento, filtro: "opciones" },
      { clave: "municipio", titulo: "Municipio", aparte: true, valor: (f) => f.municipio, filtro: "opciones" },
      { clave: "direccion", titulo: "Dirección", aparte: true, valor: (f) => f.direccion, filtro: "texto" },
      { clave: "telefono", titulo: "Teléfono", aparte: true, valor: (f) => f.telefono, filtro: "texto" },
      { clave: "contactoNombre", titulo: "Persona de contacto", aparte: true, valor: (f) => f.contactoNombre, filtro: "texto" },
      { clave: "contactoCargo", titulo: "Su cargo", aparte: true, valor: (f) => f.contactoCargo, filtro: "texto" },
      { clave: "contactoCorreo", titulo: "Correo de contacto", aparte: true, valor: (f) => f.contactoCorreo, filtro: "texto" },
      { clave: "sector", titulo: "Sector económico", aparte: true, valor: (f) => f.sectorEconomico, filtro: "opciones" },
      { clave: "clasificacion", titulo: "Clasificación", aparte: true, valor: (f) => f.clasificacion, filtro: "opciones" },
      { clave: "trabajadores", titulo: "Trabajadores", aparte: true, numerica: true, valor: (f) => f.numeroTrabajadores, filtro: "numero" },
      {
        clave: "creadoEn",
        titulo: "Primera reserva",
        aparte: true,
        valor: (f) => f.creadoEn.slice(0, 10),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizaciones</h1>
          <p className="mt-1 text-texto-suave">
            {filas
              ? n(filas.length) + " organizaciones · " + n(totalCupos) + " cupos confirmados"
              : "Cargando…"}
          </p>
        </div>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <Tabla
        id="empresas"
        columnas={columnas}
        filas={filas}
        clave={(f) => f.id}
        vacio="Aparecerán en cuanto alguien reserve cupos desde un formulario."
        acciones={
          <button
            onClick={() => descargar("empresas", {})}
            className="rounded-xl bg-marca px-4 py-2 text-sm font-medium text-marca-texto transition hover:bg-marca-fuerte"
          >
            Descargar en Excel
          </button>
        }
      />
    </div>
  );
}

const Guion = () => <span className="text-texto-suave">—</span>;
