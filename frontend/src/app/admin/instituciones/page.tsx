"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { IconoOrganizaciones } from "@/components/admin/iconos";
import { Aviso } from "@/components/admin/marco-admin";
import { Pildora, Vacio } from "@/components/admin/piezas";
import { Tabla, type Columna } from "@/components/admin/tabla";
import { CarguePlantilla } from "@/components/admin/cargue-plantilla";
import { bonito, ErrorApi, enMayusculas } from "@/lib/api";
import {
  ETIQUETA_CAMPO,
  ETIQUETA_CLASIFICACION,
  ETIQUETA_FUENTE,
  ETIQUETA_TAMANO,
  institucionesApi,
  type Institucion,
  type Listado,
} from "@/lib/instituciones-api";


/// La marca de lo sugerido: solo el color de la letra.
///
/// Es el mismo amarillo de aviso que usan la ficha y la bandeja
/// de propuestas: si aqui significara otra cosa, la persona
/// tendria que reaprender la pantalla. Sin recuadro ni pastilla
/// -- en una tabla, una pastilla por celda es mas ruido que dato.
const CLASE_SUGERIDO = "font-medium text-aviso";

/**
 * El maestro de organizaciones: una fila por NIT, con lo que
 * se sabe de cada una y si eso alcanza para reportarla.
 */
export default function PaginaInstituciones() {
  const [listado, setListado] = useState<Listado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  /// Se traen TODAS de una, no de cincuenta en cincuenta.
  ///
  /// Son ciento setenta y cinco: caben de sobra. Y así el
  /// buscador de la tabla y sus filtros ven el listado
  /// completo, que es lo que permitió quitar la fila de
  /// filtros que había aquí arriba: buscar sobre media página
  /// cargada no encuentra lo que no se ha traído.

  useEffect(() => {
    let vigente = true;

    async function traer() {
      setCargando(true);
      try {
        const primera = await institucionesApi.listar({ pagina: 1 });
        if (!vigente) return;

        const paginas = Math.max(
          1,
          Math.ceil(primera.total / Math.max(1, primera.porPagina)),
        );

        // el resto en paralelo: cuatro peticiones cortas
        // tardan menos que una larga y no bloquean la primera
        const resto =
          paginas > 1
            ? await Promise.all(
                Array.from({ length: paginas - 1 }, (_, i) =>
                  institucionesApi.listar({ pagina: i + 2 }),
                ),
              )
            : [];
        if (!vigente) return;

        setListado({
          ...primera,
          instituciones: [
            ...primera.instituciones,
            ...resto.flatMap((p) => p.instituciones),
          ],
        });
        setError(null);
      } catch (e) {
        if (vigente) setError((e as ErrorApi).message);
      } finally {
        if (vigente) setCargando(false);
      }
    }

    void traer();
    return () => {
      vigente = false;
    };
  }, []);

  const filas = listado?.instituciones ?? [];

  const columnas = useMemo<Columna<Institucion>[]>(
    () => [
      {
        clave: "nit",
        titulo: "NIT",
        fija: true,
        valor: (f) => f.nit,
        pinta: (f) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {f.nit}
            {f.digitoDeclarado ? `-${f.digitoDeclarado}` : ""}
          </span>
        ),
        filtro: "texto",
      },
      {
        clave: "razonSocial",
        titulo: "Razón social",
        fija: true,
        valor: (f) => enMayusculas(f.razonSocial),
        pinta: (f) => (
          <>
            <Link
              href={`/admin/instituciones/${f.id}`}
              className="font-medium underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {enMayusculas(f.razonSocial)}
            </Link>
            {f.nombreComercial && (
              <span className="block truncate text-xs text-texto-suave">
                {bonito(f.nombreComercial)}
              </span>
            )}
          </>
        ),
        filtro: "texto",
      },
      {
        clave: "ciudad",
        titulo: "Ciudad",
        valor: (f) => (f.ciudadNombre ? bonito(f.ciudadNombre) : null),
        pinta: (f) => (
          <Dato
            institucion={f}
            campo="ciudadNombre"
            valor={f.ciudadNombre ? bonito(f.ciudadNombre) : null}
          />
        ),
        filtro: "opciones",
      },
      {
        clave: "tamano",
        titulo: "Tamaño",
        valor: (f) => (f.tamano ? ETIQUETA_TAMANO[f.tamano] : null),
        pinta: (f) => (
          <Dato
            institucion={f}
            campo="tamano"
            valor={f.tamano ? ETIQUETA_TAMANO[f.tamano] : null}
          />
        ),
        filtro: "opciones",
      },
      {
        clave: "clasificacion",
        titulo: "Clasificación",
        valor: (f) => (f.clasificacion ? ETIQUETA_CLASIFICACION[f.clasificacion] : null),
        pinta: (f) => (
          <Dato
            institucion={f}
            campo="clasificacion"
            valor={f.clasificacion ? ETIQUETA_CLASIFICACION[f.clasificacion] : null}
          />
        ),
        filtro: "opciones",
      },
      {
        clave: "estado",
        titulo: "Estado",
        /// El valor plano es lo que ordena y filtra; la
        /// insignia de color va aparte, en `pinta`.
        valor: (f) =>
          f.verificadaEn
            ? "Verificada"
            : f.falta.length > 0
              ? "Incompleta"
              : "Sin verificar",
        pinta: (f) => <Estado institucion={f} />,
        filtro: "opciones",
      },
      {
        /// Sustituye a la casilla «Solo incompletas». Como
        /// columna se puede filtrar, ordenar y ver de un
        /// vistazo cuántas faltan, que la casilla no dejaba.
        clave: "completitud",
        titulo: "Le falta",
        valor: (f) => (f.falta.length === 0 ? "Nada" : `${f.falta.length} datos`),
        pinta: (f) =>
          f.falta.length === 0 ? (
            <span className="text-exito">Nada</span>
          ) : (
            <span className="text-aviso" title={f.falta.join(" · ")}>
              {f.falta.length} datos
            </span>
          ),
        filtro: "opciones",
      },
      {
        /// Y esta a «Sugerido, sin verificar»: campos que
        /// trajo el buscador web y nadie ha confirmado.
        clave: "sugerido",
        titulo: "Sugerido sin confirmar",
        valor: (f) => (f.sinConfirmar.length > 0 ? "Sí" : "No"),
        pinta: (f) =>
          f.sinConfirmar.length > 0 ? (
            <span className={CLASE_SUGERIDO} title={f.sinConfirmar.join(" · ")}>
              {f.sinConfirmar.length} campos
            </span>
          ) : (
            <span className="text-texto-suave">—</span>
          ),
        filtro: "opciones",
      },
      {
        clave: "departamento",
        titulo: "Departamento",
        aparte: true,
        valor: (f) => (f.departamentoNombre ? bonito(f.departamentoNombre) : null),
        filtro: "opciones",
      },
      { clave: "direccion", titulo: "Dirección", aparte: true, valor: (f) => f.direccion, filtro: "texto" },
      { clave: "telefono", titulo: "Teléfono", aparte: true, valor: (f) => f.telefono, filtro: "texto" },
      { clave: "correo", titulo: "Correo", aparte: true, valor: (f) => f.correo, filtro: "texto" },
      { clave: "sector", titulo: "Sector económico", aparte: true, valor: (f) => f.sectorEconomico, filtro: "opciones" },
      { clave: "ciiu", titulo: "CIIU", aparte: true, valor: (f) => f.codigoCiiu, filtro: "texto" },
      { clave: "empleados", titulo: "Empleados", aparte: true, numerica: true, valor: (f) => f.numeroEmpleados, filtro: "numero" },
      { clave: "fuente", titulo: "Fuente", aparte: true, valor: (f) => f.fuente, filtro: "opciones" },
    ],
    [],
  );

  /// El relleno lateral lo pone la pantalla, no el
  /// marco: el contenedor dejo de ponerlo para que las
  /// bandas vayan a sangre, y sin esto la barra de
  /// busqueda y la paginacion quedaban pegadas al canto.
  return (
    <div className="flex min-h-0 grow flex-col">
      <header className="border-b border-borde bg-superficie px-7 pt-[26px] pb-[22px]">
        {/* sin título: lo dice la miga. La cifra se fue al
            lado del buscador, que es donde se mira cuando uno
            está filtrando */}
        <p className="text-sm text-texto-suave">
          El sistema proporciona estos datos como{" "}
          <span className={CLASE_SUGERIDO}>sugerencia automática</span> de empresas
          registradas, revise cuidadosamente cada campo del proceso de verificación
          y apruebe si son correctos o realice las correcciones que considere
          necesarias.
        </p>
      </header>

      <div className="flex min-h-0 grow flex-col gap-4 px-7 pt-4">
      {error && <Aviso tipo="error">{error}</Aviso>}

      {!listado && cargando && <p className="text-texto-suave">Cargando…</p>}

      {listado && filas.length === 0 && (
        <Vacio titulo="Todavía no hay organizaciones" icono={IconoOrganizaciones}>
          Estas filas salen del archivo con el que se sembró el sistema y de lo
          que averigua la consulta al RUES. Aparecen en cuanto entre el archivo o
          termine la primera consulta.
        </Vacio>
      )}

      {listado && filas.length > 0 && (
        <>
          {/* La misma tabla que Empresas aliadas: su barra
              trae Filtros, Columnas, Vistas y la descarga a
              Excel. Aquí había un `<table>` a mano que no
              tenía nada de eso, y cada pantalla con su propia
              tabla es una pantalla que se comporta distinto
              sin razón. */}
          <Tabla
            id="instituciones"
            columnas={columnas}
            filas={filas}
            clave={(f) => f.id}
            total={listado.total}
            vacio="No hay ninguna organización con esos filtros."
            acciones={
              <CarguePlantilla
                entidad="instituciones"
                admiteNuevas={false}
                alTerminar={() => window.location.reload()}
              />
            }
          />

        </>
      )}
      </div>
    </div>
  );
}

/**
 * Una celda con su procedencia: lo que trajo el buscador web
 * se ve distinto de lo demas.
 */
function Dato({
  institucion,
  campo,
  valor,
}: {
  institucion: Institucion;
  campo: string;
  valor: string | null;
}) {
  if (!valor) return <span className="text-texto-suave">—</span>;

  /// Solo se resalta WEB. Pintar tambien RUES, CARGA y HUMANO
  /// llenaria la tabla de color y taparia lo unico que hay que
  /// mirar antes de reportar: lo que nadie ha confirmado.
  if (institucion.fuentePorCampo?.[campo] !== "WEB") return <span>{valor}</span>;

  /// El punto y el sello no son adorno: el color solo no separa
  /// lo sugerido de lo confirmado para quien no lo distingue, y
  /// esa separacion es lo unico que hace esta pantalla.
  return (
    <span
      className={CLASE_SUGERIDO}
      title={`${ETIQUETA_CAMPO[campo] ?? campo}: ${ETIQUETA_FUENTE.WEB}. Sugerido, sin verificar: no llega al SENA hasta que alguien lo confirme.`}
    >
      {valor}
      <span className="sr-only"> (sugerido, sin verificar)</span>
    </span>
  );
}

/** Si la fila puede reportarse al SENA y, si no, que se lo impide. */
function Estado({ institucion }: { institucion: Institucion }) {
  const { falta, sinConfirmar, reportable } = institucion;

  const etiquetar = (campos: string[]) =>
    campos.map((campo) => ETIQUETA_CAMPO[campo] ?? campo).join(" · ");

  if (falta.length === 0 && sinConfirmar.length === 0) {
    /// Sin huecos y sin nada pendiente de confirmar, lo unico
    /// que puede faltarle es que alguien la haya mirado.
    return reportable ? (
      <Pildora tono="exito">Lista para reportar</Pildora>
    ) : (
      <Pildora tono="aviso">
        <span title="Tiene todos los datos, pero nadie la ha verificado todavía.">
          Sin verificar
        </span>
      </Pildora>
    );
  }

  /// Las dos cosas se muestran juntas cuando pasan las dos: un
  /// hueco y un dato sin confirmar se arreglan distinto, y
  /// quedarse solo con el peor esconde la mitad del trabajo.
  return (
    <div className="flex flex-col items-start gap-1">
      {falta.length > 0 && (
        <Pildora tono="error">
          <span title={`Falta: ${etiquetar(falta)}`}>
            {falta.length === 1
              ? "Le falta 1 dato"
              : `Le faltan ${falta.length} datos`}
          </span>
        </Pildora>
      )}

      {sinConfirmar.length > 0 && (
        <Pildora tono="aviso">
          <span title={`Sin confirmar: ${etiquetar(sinConfirmar)}`}>
            {sinConfirmar.length === 1
              ? "1 dato sin confirmar"
              : `${sinConfirmar.length} datos sin confirmar`}
          </span>
        </Pildora>
      )}
    </div>
  );
}
