"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { n } from "@/components/admin/graficos";
import { Aviso } from "@/components/admin/marco-admin";
import { Tabla, type Columna } from "@/components/admin/tabla";
import { CarguePlantilla } from "@/components/admin/cargue-plantilla";
import { bonito, ErrorApi, enMayusculas } from "@/lib/api";
import {
  descargar,
  tablerosApi,
  type FilaEmpresa,
  type PaginaEmpresas,
} from "@/lib/tableros-api";

/** Cuántos cupos lleva cada organización. */
export default function PaginaEmpresas() {
  const [pagina, setPagina] = useState<PaginaEmpresas | null>(null);
  const [todas, setTodas] = useState<{ base: FilaEmpresa[]; filas: FilaEmpresa[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setPagina(await tablerosApi.empresas());
      setError(null);
    } catch (e) {
      setError((e as ErrorApi).message);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // el superset solo vale mientras su base siga vigente
  const filas =
    todas && todas.base === pagina?.filas ? todas.filas : (pagina?.filas ?? null);

  const cargarTodas = useCallback(async () => {
    if (!pagina) return;
    const resto = await Promise.all(
      Array.from({ length: pagina.paginas - 1 }, (_, i) =>
        tablerosApi.empresas({ pagina: i + 2, porPagina: pagina.porPagina }),
      ),
    );
    setTodas({ base: pagina.filas, filas: [...pagina.filas, ...resto.flatMap((p) => p.filas)] });
  }, [pagina]);


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
        valor: (f) => enMayusculas(f.razonSocial),
        pinta: (f) => <span className="font-medium">{enMayusculas(f.razonSocial)}</span>,
        filtro: "texto",
      },
      // De aqui abajo, todo `aparte`: la vista pedida es NIT
      // y Organizacion. No se borran -- siguen a un clic en
      // «Columnas», y el que las necesite las saca.
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
        pinta: (f) =>
          f.numeroColaboradores ? n(f.numeroColaboradores) : <Guion />,
        filtro: "numero",
      },
      { clave: "reservas", titulo: "Reservas", aparte: true, numerica: true, valor: (f) => f.reservas, filtro: "numero" },
      {
        clave: "confirmados",
        titulo: "Confirmados",
        aparte: true,
        numerica: true,
        valor: (f) => f.confirmados,
        pinta: (f) => <span className="font-medium">{n(f.confirmados)}</span>,
        filtro: "numero",
      },
      {
        clave: "enEspera",
        titulo: "En espera",
        aparte: true,
        numerica: true,
        valor: (f) => f.enEspera,
        pinta: (f) =>
          f.enEspera > 0 ? <span className="text-aviso">{n(f.enEspera)}</span> : <Guion />,
        filtro: "numero",
      },
      {
        clave: "cursos",
        titulo: "Cursos",
        aparte: true,
        valor: (f) => f.cursos.join(", "),
        pinta: (f) => (
          <span className="font-mono text-xs text-texto-suave">{f.cursos.join(", ")}</span>
        ),
        filtro: "texto",
      },
      {
        clave: "f7",
        titulo: "Datos para el F7",
        aparte: true,
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
      {/* sin encabezado: lo dice la miga de arriba, y el
          total va en el pie de la tabla */}

      {error && <Aviso tipo="error">{error}</Aviso>}

      <Tabla
        id="empresas"
        columnas={columnas}
        filas={filas}
        clave={(f) => f.id}
        total={pagina?.total}
        alCargarTodo={pagina && pagina.paginas > 1 ? cargarTodas : undefined}
        // ya trae la suya, del servidor y con todas las
        // columnas: la genérica bajaría solo las dos que
        // están a la vista
        sinDescarga
        vacio="Aparecerán en cuanto alguien reserve cupos desde un formulario."
        acciones={
          <>
            <button
              onClick={() => descargar("empresas", {})}
              className="rounded-xl bg-marca px-4 py-2 text-sm font-medium text-marca-texto transition hover:bg-marca-fuerte"
            >
              Descargar en Excel
            </button>
            <CarguePlantilla
              entidad="empresas"
              admiteNuevas
              alTerminar={() => window.location.reload()}
            />
          </>
        }
      />
    </div>
  );
}

const Guion = () => <span className="text-texto-suave">—</span>;
