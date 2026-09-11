"use client";

/** La portada: qué hay que hacer hoy y cómo va el mes. */

/// Aquí vivía el resumen de ocupación de Convoca: cupos
/// comprometidos con el SENA, cobertura territorial en un mapa y
/// reservas de aliados. Nada de eso existe en un CRM de ventas, así
/// que la pantalla se rehizo entera en vez de traducirle los
/// rótulos.
///
/// **Cinco bloques y en este orden**, que no es decorativo:
///
///  1. Lo que exige una acción HOY —quién está esperando respuesta—.
///  2. El dinero: lo abierto y lo esperado.
///  3. Cómo va el mes cerrado.
///  4. Dónde está atascado el embudo.
///  5. Qué campaña trae negocio, y qué se está enfriando.
///
/// El orden es de urgencia, no de importancia. Lo de arriba se mira
/// ahora; lo de abajo, una vez al día.
///
/// LA FORMA es una CABINA, no una página. Cuatro bandas a sangre que
/// se tocan y a las que separa una regla de 1 px; ni una tarjeta
/// flotando, ni una cabecera teñida, ni una sombra. El aire se gana
/// quitando alto muerto, no metiendo bloques: la primera fila de
/// datos se ve sin desplazar en 1440x900.
///
/// Y una sola cifra puede ser la más grande de la pantalla: la
/// plata que hay sobre la mesa. Nunca un conteo, nunca un
/// porcentaje. Si se entrecierran los ojos hasta que la pantalla se
/// desenfoca, lo primero que se ve tiene que ser dinero.

import { useCallback, useEffect, useState } from "react";

import { Aviso } from "@/components/admin/marco-admin";
import { Cargando } from "@/components/admin/piezas";
import { Apoyo, Banda } from "@/components/admin/piezas-de-venta";
import {
  Codigo,
  Dinero,
  Etapa,
  Porcentaje,
  Puerta,
  Reloj,
  relojEnTexto,
  Rotulo,
} from "@/components/admin/datos-del-negocio";
import { ErrorApi } from "@/lib/api";
import { oportunidadesApi, type ResumenDeVentas } from "@/lib/oportunidades-api";

/// Una semana quieta es el umbral de «se está enfriando», y el
/// reloj mide minutos: aquí se traduce una sola vez.
const MINUTOS_POR_DIA = 1_440;

export default function Portada() {
  const [datos, setDatos] = useState<ResumenDeVentas | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setDatos(await oportunidadesApi.resumen());
    } catch (e) {
      setError(
        e instanceof ErrorApi
          ? e.message
          : "No pudimos traer el resumen. Vuelva a intentarlo.",
      );
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (error) {
    return (
      <Banda sinRegla>
        <Aviso tipo="error">{error}</Aviso>
      </Banda>
    );
  }

  if (!datos) {
    return (
      <Banda sinRegla crece>
        <Cargando que="Trayendo el resumen…" />
      </Banda>
    );
  }

  return (
    /// `grow` para que la última banda pueda comerse el alto que
    /// sobre. Sin él, aprovechar mejor el ancho deja un palmo de
    /// fondo gris debajo de la última banda, y el marco de esta
    /// pantalla deja de parecerse al de las otras catorce.
    <div className="flex w-full grow flex-col">
      <Espera reloj={datos.reloj} />
      <FranjaDeDinero datos={datos} />

      {/*
        LOS TRES BLOQUES DE ABAJO SON UNA SOLA BANDA, Y A 1920 SON
        TRES COLUMNAS.

        «Dónde está el dinero» era una banda para él solo: cinco
        renglones topados en 720 px dentro de una franja de 1636, o
        sea 916 px de blanco al canto derecho. Y la de abajo ya
        repartía bien su ancho entre dos bloques. Cuando la lista
        es corta —cinco etapas, y siempre serán cinco— el sobrante
        no se gasta abriendo columna: se dedica a una segunda
        región útil, que aquí ya existía y estaba debajo.

        El orden se conserva y no es decorativo: dónde está
        atascado, qué campaña lo trae, qué se está enfriando. En
        vertical se leía de arriba abajo; en tres columnas se lee
        de izquierda a derecha, que es el mismo orden.

        380 · lo que sobre · 380: la del medio es la única que
        crece porque es la única con una tabla dentro, y su ancho
        natural son 806 px. Las otras dos son listas de un dato y
        su cifra.

        Y es consulta de CONTENEDOR: la barra lateral se pliega y
        la banda gana 180 px sin que la ventana cambie de tamaño.
        Lo que decide cuántas columnas caben es lo ancha que es la
        banda, que es lo que mide el ojo.
      */}
      <Banda sinRegla crece className="@container">
        <div className="grid gap-6 @[768px]:grid-cols-2 @[1600px]:grid-cols-[380px_minmax(0,1fr)_380px]">
          <Embudo porEtapa={datos.porEtapa} />
          <Campanas filas={datos.porCampana} />
          <Frias frias={datos.frias} cuantas={datos.cuantasFrias} />
        </div>
      </Banda>
    </div>
  );
}

/**
 * Arriba del dinero, siempre.
 *
 * Contestar dentro de los primeros cinco minutos multiplica por 21 la
 * probabilidad de calificar frente a esperar media hora, y el
 * promedio del mercado son 42 horas. Es la única cifra de esta
 * pantalla que se puede arreglar en el minuto siguiente a leerla.
 *
 * Era una tarjeta teñida entera de rosa con una curva de 14 px para
 * decir una cosa que cabe en un renglón. Ahora es un renglón, y lo
 * único caliente de la pantalla es el reloj de cada fila: el color
 * cálido dejó de ser decoración y pasó a significar «alguien está
 * esperando» y nada más.
 */
function Espera({ reloj }: { reloj: ResumenDeVentas["reloj"] }) {
  const hayUrgentes = reloj.pasadosDeCinco > 0;

  const mediana = reloj.medianaRespuesta !== null && (
    <span className="shrink-0 text-[0.71875rem] text-texto-suave">
      Mediana de respuesta:{" "}
      <span className="tabular-nums text-texto">
        {relojEnTexto(reloj.medianaRespuesta)}
      </span>
    </span>
  );

  if (reloj.esperando === 0) {
    return (
      <Banda>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="text-[0.8125rem] text-texto">
            Nadie esperando.{" "}
            <span className="text-texto-suave">
              Todo lo que entró tiene una primera respuesta.
            </span>
          </p>
          {mediana}
        </div>
      </Banda>
    );
  }

  return (
    <Banda>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-[0.8125rem] text-texto">
          <span className="font-semibold tabular-nums text-error">
            {reloj.esperando}
          </span>{" "}
          sin primera respuesta
          <span className="text-texto-suave">
            {" · "}
            {hayUrgentes
              ? `${reloj.pasadosDeCinco} pasan de cinco minutos`
              : "todavía dentro de los cinco minutos"}
          </span>
        </p>
        {mediana}
      </div>

      <ul className="mt-3 flex flex-col">
        {reloj.lista.map((e) => (
          <li
            key={e.id}
            className="flex items-baseline justify-between gap-4 border-t border-hairline py-2 first:border-0 first:pt-0"
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <Codigo>{e.codigo}</Codigo>
              <span className="truncate text-[0.8125rem] text-texto">
                {e.titulo}
              </span>
              {e.campana && <Puerta campana={e.campana} />}
            </span>
            {/* Sin primera respuesta: pasado el umbral no es «tarde»,
                es una alarma. Es el único rojo de la pantalla. */}
            <Reloj minutos={e.minutosEsperando} umbral={5} vencido />
          </li>
        ))}
      </ul>
    </Banda>
  );
}

/// Las dos cifras del embudo y las dos del mes, en una franja.
/// Cuatro números sin cuatro marcos: la separación la hacen los
/// espacios, no los bordes.
///
/// «Sobre la mesa» es la cifra de portada de esta pantalla —34 px,
/// y ninguna otra la iguala—. Las otras tres van a 20: entre la
/// primera y el pie de la última hay tres veces de diferencia, que
/// es lo que separa una pantalla con jerarquía de una plana.
function FranjaDeDinero({ datos }: { datos: ResumenDeVentas }) {
  const { pronostico, mes } = datos;
  return (
    <Banda>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Rotulo>Sobre la mesa</Rotulo>
          <p className="mt-1">
            <Dinero valor={pronostico.total} portada />
          </p>
          <Pie>{pronostico.cuantas} negocios abiertos</Pie>
        </div>

        <div>
          <Rotulo>Esperado</Rotulo>
          <p className="mt-1">
            {/* Apagado mientras las probabilidades sean del modelo y
                no de nuestros cierres: el gris dice «esto es un
                supuesto» sin obligar a leer la nota al pie. */}
            <Dinero
              valor={pronostico.ponderado}
              tamano="columna"
              supuesto={pronostico.probabilidadesEstimadas}
            />
          </p>
          <Pie>con probabilidades estimadas</Pie>
        </div>

        <div>
          <Rotulo>Ganado este mes</Rotulo>
          <p className="mt-1">
            <Dinero valor={mes.ganado} tamano="columna" ganado />
          </p>
          <Pie>{mes.ganadas === 1 ? "1 negocio" : `${mes.ganadas} negocios`}</Pie>
        </div>

        <div>
          <Rotulo>Efectividad del mes</Rotulo>
          <p className="mt-1">
            {/* Esta sí está medida sobre cierres reales: va en el
                color del dato, no en el del supuesto. */}
            <Porcentaje valor={mes.tasa} tamano="columna" />
          </p>
          <Pie>
            {mes.tasa === null
              ? "todavía no se cierra nada este mes"
              : `${mes.ganadas} ganados de ${mes.ganadas + mes.perdidas} cerrados`}
          </Pie>
        </div>
      </div>
    </Banda>
  );
}

function Pie({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-[0.71875rem] leading-[1.45] text-texto-suave">
      {children}
    </p>
  );
}

/**
 * Dónde está atascado el embudo.
 *
 * Llevaba una barra azul redondeada por etapa. Se fueron, y no por
 * gusto: decían exactamente lo mismo que la cifra de la derecha y le
 * quitaban el sitio, que en un tablero de trabajo es el recurso
 * escaso. Lo que ordena la lista ahora es la rampa de color de las
 * etapas —de gris a azul profundo, cuanto más oscuro más cerca del
 * dinero— y una columna de cifras tabulares alineadas a la derecha,
 * que se compara de un vistazo por el número de dígitos.
 */
function Embudo({ porEtapa }: { porEtapa: ResumenDeVentas["porEtapa"] }) {
  return (
    /// Con la banda ancha es la primera de tres columnas; con la
    /// banda estrecha se lleva el renglón entero y las otras dos
    /// van debajo.
    <section className="@[768px]:col-span-2 @[1600px]:col-span-1">
      <Rotulo titulo>Dónde está el dinero</Rotulo>
      <Apoyo>Lo abierto, por etapa. Los dos embudos sumados.</Apoyo>

      {/*
        Topa en 720 px, la misma medida que declara el sistema para
        un formulario, y solo hace falta cuando se lleva el renglón
        entero. No es una tabla de trabajo —no se ordena, no se
        pulsa, no se exporta—: son cinco renglones para contestar
        una pregunta. A sangre, la etapa quedaba a la izquierda del
        todo y su plata a 1.100 px de distancia, y para comparar dos
        cifras había que cruzar la pantalla dos veces.
      */}
      <ul className="mt-3 flex max-w-[720px] flex-col">
        {porEtapa.map((e) => (
          <li
            key={e.etapa}
            className="flex items-baseline justify-between gap-4 border-t border-hairline py-2 first:border-0"
          >
            <span className="flex items-baseline gap-2">
              <Etapa etapa={e.etapa} rotulo={e.rotulo} />
              <span className="text-[0.71875rem] tabular-nums text-texto-suave">
                {e.cuantas}
              </span>
            </span>
            <Dinero valor={e.total} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Qué campaña trae negocio.
 *
 * Es la pregunta que justifica el gasto en pauta, y la que casi
 * ningún CRM contesta bien: para contestarla hay que saber de qué
 * anuncio vino cada ficha, y eso solo se sabe si el lead entra solo,
 * con su origen puesto. Aquí entra así.
 */
function Campanas({ filas }: { filas: ResumenDeVentas["porCampana"] }) {
  return (
    <section>
      <Rotulo titulo>De dónde vienen</Rotulo>
      <Apoyo>Por campaña: cuántos trae y cuánto dinero mueve.</Apoyo>

      {filas.length === 0 ? (
        <p className="mt-3 text-[0.8125rem] text-texto-suave">
          Todavía no hay leads con campaña.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full">
            {/* La cabecera es un rótulo en versalita sobre blanco con
                una regla debajo. Sin fondo teñido: era la única
                tabla del panel con la cabecera pintada y eso la
                hacía pesar más que sus propios datos. */}
            <thead>
              <tr className="border-b border-borde text-left">
                <Cabecera>Campaña</Cabecera>
                <Cabecera derecha>Leads</Cabecera>
                <Cabecera derecha>Abierto</Cabecera>
                <Cabecera derecha>Ganado</Cabecera>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.campana} className="border-b border-hairline last:border-0">
                  <td className="py-2 pr-4">
                    <Puerta campana={f.campana} />
                  </td>
                  <td className="py-2 pr-4 text-right text-[0.8125rem] tabular-nums text-texto">
                    {f.cuantas}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <Dinero valor={f.abierto} />
                  </td>
                  <td className="py-2 text-right">
                    <Dinero valor={f.ganado} ganado />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Cabecera({
  children,
  derecha,
}: {
  children: React.ReactNode;
  derecha?: boolean;
}) {
  return (
    <th
      className={
        "pb-1 text-[0.625rem] leading-[1.2] font-bold tracking-[0.11em] text-texto-suave uppercase " +
        (derecha ? "pr-4 text-right last:pr-0" : "")
      }
    >
      {children}
    </th>
  );
}

/// Una oportunidad sin próximo paso es una oportunidad abandonada, y
/// el sistema tiene que poder decirlo antes de que se muera sola.
///
/// El ámbar de la derecha es un reloj: dice cuánto lleva quieta, no
/// que la etapa sea mala. Es el mismo ámbar y el mismo significado
/// que en el tablero, y no hay un tercer sitio donde salga.
function Frias({
  frias,
  cuantas,
}: {
  frias: ResumenDeVentas["frias"];
  cuantas: number;
}) {
  return (
    <section>
      <Rotulo titulo>Se están enfriando</Rotulo>
      <Apoyo>
        Abiertas que llevan más de una semana sin que nadie las toque.
      </Apoyo>

      {frias.length === 0 ? (
        <p className="mt-3 text-[0.8125rem] text-texto-suave">
          Ninguna. Todo lo abierto se ha movido esta semana.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {frias.map((f) => (
            <li
              key={f.id}
              className="flex items-baseline justify-between gap-4 border-t border-hairline py-2 first:border-0"
            >
              <span className="min-w-0">
                <span className="block truncate text-[0.8125rem] text-texto">
                  {f.titulo}
                </span>
                <span className="block truncate text-[0.71875rem] text-texto-suave">
                  {f.asesor?.nombre ?? "—"}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <Dinero valor={f.valor} />
                <Reloj
                  minutos={f.dias * MINUTOS_POR_DIA}
                  umbral={7 * MINUTOS_POR_DIA}
                />
              </span>
            </li>
          ))}
          {cuantas > frias.length && (
            <li className="pt-2 text-[0.65625rem] tracking-[0.02em] text-texto-suave">
              y {cuantas - frias.length} más.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
