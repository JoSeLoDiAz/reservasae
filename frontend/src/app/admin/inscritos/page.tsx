"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { columnasDeParticipante } from "@/components/admin/columnas-participante";
import {
  FiltroDePeriodo,
  PERIODO_INICIAL,
  ventanaDe,
  type Periodo,
} from "@/components/admin/filtro-de-periodo";
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

  /// EL PERIODO, COMPARTIDO CON LOS DEMÁS TABLEROS. «En todos los
  /// tableros debo tener filtros» (cliente, 27 sep 2026). Aquí recorta
  /// de verdad: `crmApi.listar` y `crmApi.resumen` reciben `Filtros`, y
  /// el servidor ya traduce `llegoDesde`/`llegoHasta` a `creadoEn`.
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_INICIAL);

  /// Sin búsqueda de página: el buscador se quitó y filtra el
  /// de la tabla, sobre lo que ya está cargado. Se traen 300,
  /// que es el tope del servidor; con más inscritos que eso,
  /// la tabla avisa en su pie que no los está mostrando todos.
  const cargar = useCallback(async (): Promise<Datos> => {
    /// La misma ventana para el listado y para el resumen: dos recortes
    /// distintos en la misma pantalla es cómo nacen las cifras que no
    /// cuadran con la tabla que tienen debajo.
    const ventana = ventanaDe(periodo);
    const [listado, resumen] = await Promise.all([
      crmApi.listar({ etapa, pagina: 1, limite: 300, ...ventana }),
      crmApi.resumen({ ...ventana }),
    ]);
    return { listado, resumen };
  }, [etapa, periodo]);

  /// La `clave` es lo que hace que cambiar el periodo pida YA: la
  /// función de carga vive en una ref y por sí sola no dispara nada.
  const vivos = useDatosVivos<Datos>(cargar, {
    clave: `${etapa}|${periodo.rango}|${periodo.desde}|${periodo.hasta}`,
  });
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
      /// `pb-2`: LA LÍNEA DE RESPETO DE ABAJO. Estaba en cero y la barra
      /// de desplazamiento horizontal de la tabla acababa tocando el pie
      /// ---«la línea de respeto» (cliente, 1 oct 2026)---. Medido en las
      /// nueve pantallas del panel: pasaba en Gestión de leads, Reservas,
      /// Inscritos y Seguimiento del aula, que son justo las cuatro que
      /// recorren en horizontal. Ocho píxeles despegan la barra sin que
      /// vuelva a sobrar aire.
      <div className="flex min-h-0 grow flex-col gap-3 px-4 pb-2">
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

        {/* EL PERIODO, ANTES DE LAS CIFRAS Y SIEMPRE VISIBLE ---también
            cuando el recorte deja la lista en cero---: si se escondiera
            con la tabla, quien acabara de elegir «Ayer» y no viera a
            nadie no tendría dónde volver a «Desde el principio». Es el
            único filtro de pantalla que hay aquí; los demás viven en las
            columnas de la tabla. */}
        <FiltroDePeriodo periodo={periodo} alCambiar={setPeriodo} />

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
