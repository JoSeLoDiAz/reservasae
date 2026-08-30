"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Aviso, CLASE_CONTROL, Tarjeta } from "@/components/admin/marco-admin";
import { CajonLead } from "@/components/admin/cajon-lead";
import { IconoCerrar } from "@/components/admin/iconos";
import { Embudo } from "@/components/admin/secciones";
import { colorEtapa } from "@/components/admin/etapa";
import { columnasDeParticipante } from "@/components/admin/columnas-participante";
import { Tabla } from "@/components/admin/tabla";
import { ErrorApi } from "@/lib/api";
import { useFiltrosEnLaUrl } from "@/lib/filtros-en-la-url";
import {
  crmApi,
  type FilaParticipante,
  type Filtros,
  ETAPAS_DEL_EMBUDO,
  type Etapa,
  ETIQUETA_ETAPA,
  type Resumen,
} from "@/lib/crm-api";

/// La pinta del boton de «Descargar en Excel», para que los
/// tres de la barra se lean como hermanos.
const CLASE_BOTON =
  "rounded-xl bg-marca px-4 py-2 text-sm font-medium whitespace-nowrap " +
  "text-marca-texto no-underline transition hover:bg-marca-fuerte";

// el tablero reparte una carga entre nueve columnas
const POR_CARGA = 300;

/// Como se llama cada filtro en pantalla. Sin esto el chip
/// diria «accionFormacionId», que no le dice nada a nadie.
const ROTULO_FILTRO: Record<string, string> = {
  etapa: "Etapa",
  estado: "Datos",
  asesorId: "Asesor",
  accionFormacionId: "Acción",
  grupoId: "Grupo",
  departamentoSepId: "Departamento",
  buscar: "Busca",
};

/// El valor legible. Los ids se traducen contra el resumen,
/// que ya trae los nombres: sin eso el chip enseñaria un cuid.
function nombreDeFiltro(
  clave: string,
  valor: string,
  resumen: Resumen,
): string {
  if (clave === "etapa") return ETIQUETA_ETAPA[valor as Etapa] ?? valor;
  if (clave === "estado") return valor === "COMPLETO" ? "Completos" : "Parciales";
  if (clave === "asesorId") {
    return resumen.asesores.find((a) => a.id === valor)?.nombre ?? "Sin asignar";
  }
  if (clave === "accionFormacionId") {
    const a = resumen.acciones.find((x) => x.id === valor);
    return a ? a.codigo : valor;
  }
  if (clave === "departamentoSepId") {
    return (
      resumen.departamentos.find((d) => String(d.id) === valor)?.nombre ?? valor
    );
  }
  return valor;
}

export default function PaginaParticipantes() {
  const [filas, setFilas] = useState<FilaParticipante[] | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(1);
  const [error, setError] = useState<string | null>(null);

  /// Lo que esta pantalla impone y nadie elige.
  ///
  /// Inscripciones acaba al marcar «Inscrito»: de ahí en
  /// adelante manda el seguimiento académico. No es un filtro
  /// de la persona, es lo que ESTA pantalla es, y por eso no
  /// viaja en la dirección ni sale como quitable.
  const FIJOS = useMemo<Filtros>(() => ({ tramo: "INSCRIPCION" }), []);

  const { filtros, puestos, cuantos, cambiar, limpiar } =
    useFiltrosEnLaUrl(FIJOS);

  const cargar = useCallback(async () => {
    const [listado, res] = await Promise.all([
      crmApi.listar({ ...filtros, pagina: 1, limite: POR_CARGA }),
      /// El resumen se pide SIN los filtros de la persona.
      ///
      /// Es la foto del conjunto —el embudo entero, cuántos van
      /// sin asesor—, y filtrarla haría que al pulsar «etapa:
      /// Contactado» el propio contador de Contactado pasara a
      /// ser el total. Los números de arriba tienen que seguir
      /// siendo el mapa mientras se mira un trozo.
      crmApi.resumen(FIJOS),
    ]);
    setFilas(listado.participantes);
    setTotal(listado.total);
    setPaginas(listado.paginas);
    setResumen(res);
  }, [filtros, FIJOS]);

  // por criterio: hacen falta todas
  const cargarTodas = useCallback(async () => {
    if (paginas <= 1) return;
    const resto = await Promise.all(
      Array.from({ length: paginas - 1 }, (_, i) =>
        crmApi.listar({ ...filtros, pagina: i + 2, limite: POR_CARGA }),
      ),
    );
    // por id: dos clics no duplican
    setFilas((f) => {
      const unicas = new Map((f ?? []).map((x) => [x.id, x]));
      for (const x of resto.flatMap((r) => r.participantes)) unicas.set(x.id, x);
      return [...unicas.values()];
    });
  }, [filtros, paginas]);

  useEffect(() => {
    void cargar().catch((e) => setError((e as ErrorApi).message));
  }, [cargar]);


  /// El ERROR va antes que el «Cargando…», y ese orden es el
  /// arreglo.
  ///
  /// Estaba al revés: si la petición fallaba, `filas` se
  /// quedaba en null y la pantalla decía «Cargando…» para
  /// siempre. El mensaje se guardaba en `error` y no llegaba a
  /// pintarse nunca, porque este `return` cortaba antes.
  ///
  /// Una pantalla que se queda cargando no se puede
  /// diagnosticar: no dice si el servidor está caído, si la
  /// sesión caducó o si hay un fallo de datos. Ahora lo dice.
  if (error && !filas) {
    return (
      <div>
        <Aviso tipo="error">
          <p className="font-medium">No se pudo cargar la lista</p>
          <p className="mt-1">{error}</p>
        </Aviso>
        <button
          onClick={() => {
            setError(null);
            void cargar().catch((e) => setError((e as ErrorApi).message));
          }}
          className={CLASE_BOTON}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!filas || !resumen) {
    return <p className="text-texto-suave">Cargando…</p>;
  }

  /// DOS preguntas distintas, y confundirlas es el fallo.
  ///
  /// `resumen.total` viene SIN los filtros de la persona, así
  /// que responde «¿hay alguien en el sistema?». `total` viene
  /// del listado, que sí está filtrado, y responde «¿queda
  /// alguien con lo que se pidió?».
  ///
  /// Con una sola variable, filtrar hasta cero enseñaba
  /// «todavía no hay nadie inscrito» —que dice que la base
  /// está vacía— y eso asusta de verdad a quien solo puso mal
  /// un filtro.
  const hayAlguien = resumen.total > 0;
  const hayResultados = total > 0;
  const hayFiltro = cuantos > 0;


  /// El relleno lateral lo pone la pantalla, no el
  /// marco: el contenedor dejo de ponerlo para que las
  /// bandas vayan a sangre, y sin esto la barra de
  /// busqueda y la paginacion quedaban pegadas al canto.
  return (
    <div className="flex min-h-0 grow flex-col gap-4 px-4 pt-4">
      {error && <Aviso tipo="error">{error}</Aviso>}

      {/* El embudo.

          El servidor ya manda este reparto en CADA carga de la
          lista, y hasta hoy no lo miraba nadie: se pagaba la
          consulta y se tiraba el resultado. Contesta la
          pregunta que se hace el lider al llegar -- «¿dónde se
          está atascando la gente?» --, y esa es de proporcion,
          asi que va en barra y no en seis cifras sueltas. */}

      {/* El orden es el del tablero de abajo: se filtra por lo
          que se esta mirando. El buscador no va aqui, va con la
          lista, que es donde se busca a una persona concreta. */}

      {!hayAlguien && (
        <Tarjeta
          titulo="Todavía no hay nadie inscrito"
          descripcion="Aquí van a aparecer las personas conforme se capturen."
        >
          <p className="text-sm text-texto-suave">
            El sistema hoy sabe cuántos cupos reservó cada empresa, pero no quiénes son.
            Ese es exactamente el hueco que cierra esta pantalla.
          </p>
        </Tarjeta>
      )}

      {hayAlguien && !hayResultados && (
        /// Hay gente, pero no con lo que se pidió. Se dice
        /// CUÁNTA hay detrás del filtro y se ofrece quitarlo:
        /// un vacío sin salida obliga a recargar a mano.
        <Tarjeta
          titulo="Nadie coincide con ese filtro"
          descripcion={
            hayFiltro
              ? `Hay ${resumen.total} personas en total. Quite algún filtro para verlas.`
              : "Pruebe de nuevo en un momento."
          }
        >
          {hayFiltro && (
            <button onClick={limpiar} className={CLASE_BOTON}>
              Quitar los filtros
            </button>
          )}
        </Tarjeta>
      )}

      {/* Los filtros puestos, a la vista y con su ✕.
          Antes «Quitar los filtros» solo aparecia cuando NO
          habia resultados: con el filtro puesto y filas en
          pantalla no habia forma de ver que estaba filtrado ni
          de quitarlo, y habia que adivinar donde se habia
          puesto. El hook ya devolvia `puestos` para esto -- lo
          dice su propio comentario -- y nunca se pinto. */}
      {cuantos > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {(Object.entries(puestos) as Array<[string, string]>).map(
            ([clave, valor]) => (
              <span
                key={clave}
                className="inline-flex items-center gap-1.5 rounded-full border border-marca/30 bg-marca-suave px-2.5 py-1 text-[0.71875rem]"
              >
                <span className="text-texto-suave">{ROTULO_FILTRO[clave] ?? clave}</span>
                <strong className="font-semibold">
                  {nombreDeFiltro(clave, valor, resumen)}
                </strong>
                <button
                  type="button"
                  onClick={() => cambiar({ [clave]: "" })}
                  aria-label={`Quitar el filtro de ${ROTULO_FILTRO[clave] ?? clave}`}
                  className="opacity-60 transition hover:opacity-100"
                >
                  <IconoCerrar tamano={12} />
                </button>
              </span>
            ),
          )}
          <button
            type="button"
            onClick={limpiar}
            className="text-[0.71875rem] text-texto-suave underline hover:text-texto"
          >
            Quitar todos
          </button>
        </div>
      )}

      {hayResultados && (
        <div className="flex min-h-0 grow flex-col">
          <ListaParticipantes
            filas={filas}
            total={total}
            asesores={resumen.asesores}
            resumen={
              hayAlguien ? (
                <div>
          {/* Solo las CINCO de leads.
              Salian tambien En formacion, Certificado, Retirado,
              No aprobo, Desertó y Abandonó, que son de Gestion
              Academica: el seguimiento del grupo, no el trabajo
              del asesor. Mezclarlas hacia que el embudo contara
              gente que esta pantalla ni siquiera lista.
              La lista es la misma que usa el filtro `tramo` de
              esta pantalla, asi que el total del embudo y el de
              la tabla salen iguales. */}
          <Embudo
            sinAsesor={resumen.sinAsesor}
            tramos={resumen.etapas
              .filter((e) => e.total > 0 && ETAPAS_DEL_EMBUDO.includes(e.etapa))
              .map((e) => ({
                etiqueta: ETIQUETA_ETAPA[e.etapa],
                total: e.total,
                color: colorEtapa(e.etapa),
              }))}
          />
                </div>
              ) : null
            }
            alCambiar={cargar}
            alCargarTodo={filas.length < total ? cargarTodas : undefined}
          />
        </div>
      )}

    </div>
  );
}

// las cifras de arriba
/** La lista, con columnas a elegir y asignación por lote. */
function ListaParticipantes({
  filas,
  total,
  asesores,
  resumen,
  alCambiar,
  alCargarTodo,
}: {
  filas: FilaParticipante[];
  total: number;
  asesores: Array<{ id: string; nombre: string }>;
  /// El embudo, ya montado. Viene hecho de la pantalla y no se
  /// arma aqui porque los datos que necesita -- el reparto por
  /// etapa, cuantos van sin asesor -- los tiene ella.
  resumen?: React.ReactNode;
  alCambiar: () => Promise<void>;
  alCargarTodo?: () => void;
}) {
  const [aviso, setAviso] = useState<string | null>(null);
  /// El lead abierto en el panel lateral. Se guarda la fila
  /// entera y no el id: el panel pinta al instante con lo que
  /// ya se trajo, y termina de llenarse cuando llega la ficha.
  const [abierto, setAbierto] = useState<FilaParticipante | null>(null);

  const columnas = useMemo(() => columnasDeParticipante(), []);

  return (
    <div className="flex min-h-0 grow flex-col gap-3">
      {aviso && <Aviso tipo="exito">{aviso}</Aviso>}

      {abierto && (
        <CajonLead
          fila={abierto}
          alCerrar={() => setAbierto(null)}
          alGuardar={() => void alCambiar()}
        />
      )}

      <Tabla
        /// El embudo va DEBAJO de la barra de botones, que es
        /// donde lo pone el prototipo: primero se decide qué se
        /// mira, y luego se resume lo que hay.
        resumen={resumen}
        id="participantes"
        columnas={columnas}
        filas={filas}
        clave={(f) => f.id}
        total={total}
        alClic={(f) => setAbierto(f)}
        alCargarTodo={alCargarTodo}
        /// Junto a «Descargar en Excel», y con su misma
        /// pinta. Como enlaces subrayados arriba se perdian
        /// entre las migas; son las dos acciones con las que
        /// se empieza el dia y merecen verse.
        acciones={
          <>
            <Link href="/admin/participantes/carga" className={CLASE_BOTON}>
              Cargar una lista
            </Link>
            <Link href="/admin/participantes/nuevo" className={CLASE_BOTON}>
              Inscribir a alguien
            </Link>
          </>
        }
        seleccion
        accionesLote={(ids, limpiar) => (
          <AsignarLote
            ids={ids}
            asesores={asesores}
            alTerminar={async (n) => {
              limpiar();
              setAviso(`${n} ${n === 1 ? "ficha" : "fichas"} con asesor nuevo.`);
              await alCambiar();
            }}
          />
        )}
      />
    </div>
  );
}

/** El desplegable de asesor sobre la selección. */
function AsignarLote({
  ids,
  asesores,
  alTerminar,
}: {
  ids: string[];
  asesores: Array<{ id: string; nombre: string }>;
  alTerminar: (cambiadas: number) => Promise<void>;
}) {
  const [trabajando, setTrabajando] = useState(false);

  async function asignar(asesorId: string | null) {
    setTrabajando(true);
    try {
      const r = await crmApi.asignarAsesorEnLote(ids, asesorId);
      await alTerminar(r.cambiadas);
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="whitespace-nowrap">Asignar a</span>
      <select
        disabled={trabajando}
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value;
          e.currentTarget.value = "";
          if (v === "") return;
          void asignar(v === "NADIE" ? null : v);
        }}
        className={`${CLASE_CONTROL} max-w-[13rem] py-1.5 text-sm`}
      >
        <option value="">Elija un asesor…</option>
        {asesores.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nombre}
          </option>
        ))}
        <option value="NADIE">— Quitarles el asesor —</option>
      </select>
    </label>
  );
}
