"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Encabezado } from "@/components/admin/piezas";
import { n } from "@/components/admin/graficos";
import { Aviso } from "@/components/admin/marco-admin";
import { Tabla, type Columna } from "@/components/admin/tabla";
import { conPermiso } from "@/components/admin/puerta-de-pantalla";
import { CarguePlantilla } from "@/components/admin/cargue-plantilla";
import { EditarEmpresa } from "@/components/admin/editar-empresa";
import { bonito, ErrorApi, enMayusculas } from "@/lib/api";
import {
  descargar,
  tablerosApi,
  type FilaEmpresa,
  type PaginaEmpresas,
} from "@/lib/tableros-api";

/** Cuántos cupos lleva cada organización. */
/// LA PUERTA, CON EL MISMO PAR `area`/`nivel` QUE DECLARA SU
/// ENTRADA EN `navegacion.ts`. Sin esto la pantalla cargaba entera
/// para quien no la puede usar y el no del servidor solo llegaba
/// al pulsar un botón (repaso de QA, 30 sep 2026).
export default conPermiso("reserva", "VER", PaginaEmpresas);

function PaginaEmpresas() {
  const [pagina, setPagina] = useState<PaginaEmpresas | null>(null);
  const [todas, setTodas] = useState<{ base: FilaEmpresa[]; filas: FilaEmpresa[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  /**
   * CUÁL SE ESTÁ CORRIGIENDO. Nula = ninguna.
   *
   * «Tener la opción de modificar los datos: NIT, razón social y
   * demás» (cliente, 28 sep 2026). Esta pantalla era de solo
   * lectura, así que un NIT mal digitado se quedaba mal para
   * siempre ---y con él las reservas y los leads de esa
   * organización---.
   */
  const [corrigiendo, setCorrigiendo] = useState<FilaEmpresa | null>(null);

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
        /**
         * NIT O RUT, Y SE DICE CUAL.
         *
         * «No entiendo por que el listado de empresas no trae los
         * RUT» (cliente, 2 oct 2026). Si los traia ---el dato esta
         * en la organizacion desde siempre--- pero la columna se
         * llamaba «NIT» a secas, asi que un RUT de persona natural
         * se leia como un NIT mal escrito.
         *
         * EN UNA SOLA TABLA y no en dos: son la misma pregunta
         * ---quien responde por la gente que se forma--- y partirla
         * obligaria a mirar en dos sitios, y a duplicar filtros,
         * descarga y cargue. Lo que faltaba era decir cual es cual.
         */
        clave: "nit",
        titulo: "NIT / RUT",
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
        /// Al lado de su numero, que es donde se lee. El filtro va
        /// por opciones para poder sacar solo los RUT de un clic.
        clave: "tipoDocumento",
        nueva: true,
        titulo: "Tipo",
        ancho: "92px",
        valor: (f) => f.tipoDocumento ?? "",
        pinta: (f) =>
          f.tipoDocumento ? (
            <span
              className={
                "rounded px-1.5 py-0.5 text-xs font-semibold " +
                (f.tipoDocumento === "RUT"
                  ? "bg-aviso-suave text-aviso"
                  : "bg-marca-suave text-marca")
              }
            >
              {f.tipoDocumento}
            </span>
          ) : (
            <span className="text-texto-suave">—</span>
          ),
        filtro: "opciones",
      },
      {
        clave: "razonSocial",
        titulo: "Organización",
        fija: true,
        valor: (f) => enMayusculas(f.razonSocial),
        pinta: (f) => <span className="font-medium">{enMayusculas(f.razonSocial)}</span>,
        filtro: "texto",
      },
      {
        /**
         * SU GENTE, Y NO SUS RESERVAS.
         *
         * Esta columna existe porque las organizaciones que entran
         * por el formulario ---las de RUT, entre ellas--- NO APARTAN
         * CUPOS: su gente se inscribe. Sin esta cuenta salian con
         * reservas, confirmados y en espera en cero, o sea como si
         * no fueran nadie, que es justo lo que se queria dejar de
         * hacer al empezar a enseñarlas.
         */
        clave: "inscritos",
        nueva: true,
        titulo: "Inscritos",
        ancho: "110px",
        numerica: true,
        valor: (f) => f.inscritos,
        pinta: (f) => (
          <span
            className={
              "tabular-nums " + (f.inscritos > 0 ? "font-semibold text-exito" : "")
            }
          >
            {f.inscritos}
          </span>
        ),
        filtro: "numero",
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
      /**
       * CORREGIR, EN SU PROPIA COLUMNA.
       *
       * Y no pulsando la fila entera, que sería lo natural: la tabla
       * compartida no tiene clic de fila, y añadírselo cambia una
       * pieza que usan trece pantallas para resolver una. Un botón
       * aquí no le toca el comportamiento a nadie más.
       *
       * `sinOrden` porque ordenar por un botón no significa nada.
       */
      {
        clave: "corregir",
        titulo: "",
        sinOrden: true,
        valor: () => "",
        pinta: (f) => (
          <button
            type="button"
            onClick={() => setCorrigiendo(f)}
            className="sin-aro text-[0.78125rem] font-semibold whitespace-nowrap text-marca underline-offset-2 transition hover:underline"
          >
            Corregir
          </button>
        ),
      },
    ],
    [],
  );

  /// El relleno lateral lo pone la pantalla, no el
  /// marco: el contenedor dejo de ponerlo para que las
  /// bandas vayan a sangre, y sin esto la barra de
  /// busqueda y la paginacion quedaban pegadas al canto.
  return (
    <div className="flex min-h-0 grow flex-col gap-4 px-4 pt-4 [&>header]:mx-0 [&>header]:mb-0">
      <Encabezado compacto titulo="Empresas aliadas y afiliadas" />
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
              className="inline-flex h-[34px] items-center rounded-lg border border-marca bg-marca px-3.5 text-[0.78125rem] font-semibold text-marca-texto transition hover:bg-marca-fuerte"
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

      {corrigiendo && (
        <EditarEmpresa
          empresa={corrigiendo}
          alCerrar={() => setCorrigiendo(null)}
          /// Se vuelve a pedir la página en vez de parchear la fila
          /// en memoria: al corregir un NIT cambian también las
          /// cuentas que el servidor calcula encima, y parchear
          /// media fila deja la otra media diciendo lo de antes.
          alGuardar={() => void cargar()}
        />
      )}
    </div>
  );
}

const Guion = () => <span className="text-texto-suave">—</span>;
