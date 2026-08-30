"use client";

import { useCallback, useMemo } from "react";

import { columnasDeParticipante } from "@/components/admin/columnas-participante";
import { IndicadorActualizacion } from "@/components/admin/indicador-actualizacion";
import {
  AccionesDePagina,
  Aviso,
  Tarjeta,
} from "@/components/admin/marco-admin";
import { Esqueleto } from "@/components/admin/piezas";
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

  /// El relleno lateral lo pone la pantalla, no el
  /// marco: el contenedor dejo de ponerlo para que las
  /// bandas vayan a sangre, y sin esto la barra de
  /// busqueda y la paginacion quedaban pegadas al canto.
  return (
    <div className="flex min-h-0 grow flex-col gap-4 px-4 pt-4">
      {/* Entre la miga y la tabla no queda nada: el buscador
          de la propia tabla ya filtra, y tener dos cajas de
          búsqueda en la misma pantalla solo hace dudar de
          cuál sirve. El aviso sube a la barra de arriba, y
          solo si el servidor deja de contestar. */}
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

      {listado.participantes.length === 0 ? (
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
        <Tabla
          id="inscritos"
          columnas={columnas}
          filas={listado.participantes}
          clave={(f) => f.id}
          total={listado.total}
        />
      )}

    </div>
  );
}
