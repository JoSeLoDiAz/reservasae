"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";

import { columnasDeParticipante } from "@/components/admin/columnas-participante";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import {
  AccionesDePagina,
  Aviso,
  Tarjeta,
} from "@/components/admin/marco-admin";
import { BotonVolver, Cifra, Encabezado, Esqueleto } from "@/components/admin/piezas";
import { Tabla } from "@/components/admin/tabla";
import { useDatosVivos } from "@/lib/datos-vivos";
import {
  crmApi,
  type Etapa,
  ETIQUETA_ETAPA,
  type Listado,
  type Resumen,
} from "@/lib/crm-api";

/// Solo Inscrito, y ya no se puede cambiar: la fila de
/// píldoras para elegir etapa se quitó porque tenía una sola.
/// En formación y Certificado se siguen en el académico,
/// contra el calendario de su grupo.
const ETAPA: Etapa = "INSCRITO";

type Datos = { listado: Listado; resumen: Resumen };

export default function PaginaInscritos() {
  const etapa = ETAPA;

  /// Sin búsqueda de página: el buscador se quitó y filtra el
  /// de la tabla, sobre lo que ya está cargado. Se traen 300,
  /// que es el tope del servidor; con más inscritos que eso,
  /// la tabla avisa en su pie que no los está mostrando todos.
  const cargar = useCallback(async (): Promise<Datos> => {
    const [listado, resumen] = await Promise.all([
      crmApi.listar({ etapa, pagina: 1, limite: 300 }),
      crmApi.resumen({}),
    ]);
    return { listado, resumen };
  }, [etapa]);

  const vivos = useDatosVivos<Datos>(cargar, { clave: etapa });
  const columnas = useMemo(() => columnasDeParticipante(), []);

  if (vivos.error) return <Aviso tipo="error">{vivos.error}</Aviso>;
  if (!vivos.datos) return <Esqueleto conCifras />;

  const { listado } = vivos.datos;
  const filas = listado.participantes;

  /// LO QUE FALTA, CONTADO DE LAS PROPIAS FILAS.
  ///
  /// La pantalla era una lista plana: ni una cifra, así que para saber
  /// a quién le falta grupo había que leer las veintidós filas a ojo.
  /// «Potencialicemos Inscritos por acción» (cliente, 23 sep 2026).
  ///
  /// Por acción ya no se filtra desde aquí --estuvo un desplegable con
  /// las cifras de cada una--: «lo quiero como Gestión de leads, o sea
  /// que Acción de formación se elimina» (mismo día). La acción sigue
  /// siendo una columna de la tabla, con su filtro de opciones, que es
  /// donde viven los demás filtros de la pantalla.
  const sinGrupo = filas.filter((f) => f.grupo === null).length;
  const sinAsesor = filas.filter((f) => !f.asesor).length;
  const incompletos = filas.filter((f) => f.datos !== "COMPLETOS").length;

  /// LOS QUE YA CUENTAN, la cifra que no había en ninguna parte y la
  /// que de verdad se persigue: el reporte al SENA pide grupo, y una
  /// persona a medias no se puede reportar. El pie dice «con grupo y
  /// datos completos» y no «listos» a secas, porque el archivo final lo
  /// revisa una persona y la tarjeta no puede prometer más de lo que el
  /// sistema comprueba.
  const listos = filas.filter((f) => f.grupo !== null && f.datos === "COMPLETOS").length;

  /// El servidor recorta en 300. Mientras no se pase, estas cifras SON
  /// el total; pasando de ahí se dice, porque una cifra que parece el
  /// total y no lo es engaña más que no ponerla.
  const recortado = listado.total > filas.length;

  return (
    /// Sin `pb`: la franja de abajo la pone la propia tabla --4 px--, y
    /// sumarle 16 aquí dejaba esta pantalla con el triple de aire que
    /// Gestión de leads o Reservas.
    <div className="flex min-h-0 grow flex-col pt-2">
      {/* LA SALIDA, PRIMERO. Esta pantalla dejó de estar en el menú
          (23 sep 2026): se llega desde Gestión de leads, y sin este
          botón no había por dónde volver --«¿cómo me regreso a Gestión
          de leads?»--. El mismo que en «Cargar una lista» y «Asignar
          grupo por lote». */}
      <div className="mx-4 mb-1.5">
        <BotonVolver href="/admin/participantes" texto="Gestión de leads" />
      </div>

      {/* El título en su recuadro, como en «Asignar grupo por lote»:
          «viste que el título [...] tiene como su burbuja» (cliente, 23
          sep 2026). Era un `h1` suelto sobre el fondo y al lado de la
          otra pantalla parecía de otro producto. */}
      <Encabezado titulo="Inscritos por acción" compacto />

      {/* De aquí abajo, el mismo canto que el recuadro del título: su
          `mx-4` contra este `px-4`. */}
      <div className="flex min-h-0 grow flex-col gap-3 px-4">
        {/* El aviso sube a la barra de arriba, y solo si el servidor
            deja de contestar. */}
        {vivos.desactualizado && (
          <AccionesDePagina>
            <IndicadorActualizacion
              actualizadoEn={vivos.actualizadoEn}
              refrescando={vivos.refrescando}
              desactualizado={vivos.desactualizado}
              alRefrescar={vivos.refrescar}
            />
          </AccionesDePagina>
        )}

        {filas.length === 0 ? (
          <Tarjeta
            titulo={`Nadie en «${ETIQUETA_ETAPA[etapa]}»`}
            descripcion="Se llega aquí cuando el asesor verifica los datos y lo marca como inscrito."
          >
            <p className="text-sm text-texto-suave">
              Matricular pide dos cosas: autorización del titular y oferta asignada. El grupo y
              sus fechas avisan, pero no bloquean.
            </p>
          </Tarjeta>
        ) : (
          <>
            {/* LAS CIFRAS, COMO EN GESTIÓN DE LEADS: tarjetas sueltas
                repartiéndose el mismo ancho que la tabla de abajo, sin
                caja que las envuelva y sin desplegable delante.

                Cada una dice de qué es y qué implica: «sin grupo» no es
                un defecto de datos, es gente que NO ENTRA en el reporte
                al SENA. */}
            <div className="flex flex-wrap items-stretch gap-2">
              <Cifra
                etiqueta="Inscritos"
                valor={listado.total}
                pie={recortado ? `lo pendiente, sobre los ${filas.length} cargados` : null}
              />
              <Cifra
                etiqueta="Listos para el SENA"
                valor={listos}
                pie="con grupo y datos completos"
                color={listos > 0 ? "var(--exito)" : undefined}
              />
              {/* La única que además LLEVA a algún sitio: quien la mira
                  quiere ponerles grupo, y eso era un renglón de texto
                  aparte que el cliente quitó. */}
              <Link
                href="/admin/participantes/grupos"
                className="flex min-w-[150px] flex-1 rounded-lg transition hover:opacity-90"
              >
                <Cifra
                  etiqueta="Sin grupo"
                  valor={sinGrupo}
                  pie={sinGrupo > 0 ? "no entran al SENA · asignar" : "todos con grupo"}
                  color={sinGrupo > 0 ? "var(--aviso)" : "var(--exito)"}
                />
              </Link>
              <Cifra
                etiqueta="Sin asesor"
                valor={sinAsesor}
                pie={sinAsesor > 0 ? "nadie responde por ellos" : "todos con asesor"}
                color={sinAsesor > 0 ? "var(--aviso)" : undefined}
              />
              <Cifra
                etiqueta="Datos a medias"
                valor={incompletos}
                pie={incompletos > 0 ? "falta algo de la persona" : "sin pendientes"}
                color={incompletos > 0 ? "var(--aviso)" : undefined}
              />
            </div>

            <Tabla
              id="inscritos"
              columnas={columnas}
              filas={filas}
              clave={(f) => f.id}
              total={listado.total}
            />
          </>
        )}
      </div>
    </div>
  );
}
