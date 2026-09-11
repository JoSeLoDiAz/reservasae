"use client";

/** La lista de un embudo: los negocios, en fila y con sus filtros. */

/// El tablero contesta «dónde va cada uno»; esta lista contesta
/// «cuáles son» — que es la que se ordena por valor, se filtra por
/// asesor y se baja a Excel. Son la misma información y hacen
/// falta las dos: nadie prioriza el mes mirando tarjetas sueltas.
///
/// Se alimenta del mismo endpoint del tablero y aplana las
/// columnas. Un endpoint aparte para esto sería una segunda
/// consulta que puede discrepar de la primera, y dos cifras
/// distintas para lo mismo es como se pierde la confianza en un
/// panel.
///
/// Cómo se escribe cada dato —el dinero, la fecha, el reloj, la
/// etapa, la puerta— no se decide aquí: está en
/// `datos-del-negocio.tsx` y es el mismo contrato que usa el
/// cajón. Una fecha escrita de otra manera en esta pantalla haría
/// que pareciera de otro producto.
///
/// EL ANCHO, que sí se decide aquí: ocho columnas fijas y UNA que
/// absorbe. Las fijas miden lo que mide su DATO —`$ 999.999.999`
/// a 13 px tabular son 104 px, y con el relleno 128—, nunca lo
/// que mide su rótulo. La lista llegaba al canto derecho, sí,
/// pero repartiendo el sobrante entre las nueve: a 1920 la etapa
/// se iba a 199 px para escribir «Calificado» y el código a 131
/// para once caracteres. Eso no es aprovechar el ancho, es el
/// mismo hueco de la fila vieja partido en nueve charcos.
///
/// Y a partir de 1600 px de LISTA —de lista y no de ventana: la
/// barra lateral se pliega y la banda gana 180 px sin que la
/// ventana cambie— entran «Campaña» y «Cierre esperado», que a
/// 1440 no caben. El sobrante se gasta abriendo columna, no
/// ensanchando la que hay.

import { useCallback, useEffect, useState } from "react";

import { Cargando, Encabezado } from "@/components/admin/piezas";
import { CajonOportunidad } from "@/components/admin/cajon-oportunidad";
import { Columna, Tabla } from "@/components/admin/tabla";
import {
  Cliente,
  Codigo,
  Dinero,
  Persona,
  Etapa,
  Fecha,
  Puerta,
  Reloj,
  Rotulo,
} from "@/components/admin/datos-del-negocio";
import { ErrorApi } from "@/lib/api";
import {
  oportunidadesApi,
  type OportunidadEnTablero,
  type TipoEmbudo,
} from "@/lib/oportunidades-api";

type Fila = OportunidadEnTablero & { etapaRotulo: string };

/// Una semana quieta es el umbral de «esto lleva parado», el
/// mismo del Resumen y el de la ficha del tablero. El reloj mide
/// minutos: aquí se traduce una sola vez.
const UMBRAL_QUIETA = 7 * 24 * 60;

export function ListaDeOportunidades({
  embudo,
  titulo,
  descripcion,
}: {
  embudo: TipoEmbudo;
  titulo: string;
  descripcion: string;
}) {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [resumen, setResumen] = useState({ total: 0, ponderado: 0, abiertas: 0 });
  const [error, setError] = useState<string | null>(null);
  /// Cual esta abierta de lado. Null: ninguna.
  const [abierta, setAbierta] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const t = await oportunidadesApi.tablero(embudo);
      setFilas(
        t.columnas.flatMap((c) =>
          c.oportunidades.map((o) => ({ ...o, etapaRotulo: c.rotulo })),
        ),
      );
      setResumen({
        total: t.pronostico.total,
        ponderado: t.pronostico.ponderado,
        abiertas: t.pronostico.cuantas,
      });
    } catch (e) {
      setError(
        e instanceof ErrorApi
          ? e.message
          : "No pudimos traer los leads. Vuelva a intentarlo.",
      );
    }
  }, [embudo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const columnas: Columna<Fila>[] = [
    {
      clave: "codigo",
      titulo: "Código",
      valor: (f) => f.codigo,
      fija: true,
      /// Micro y apagado: es una llave para buscar y para pegar en
      /// un WhatsApp, no un dato. Nunca compite con el nombre del
      /// negocio, que es la columna de al lado.
      pinta: (f) => <Codigo codigo={f.codigo} />,
      /// `OP-DEMO-003` a 10,5 tabular son 76 px; con los 12 de
      /// relleno a cada lado, 100.
      ancho: "100px",
    },
    {
      clave: "titulo",
      titulo: "Qué se vende",
      valor: (f) => f.titulo,
      /// ABSORBE, y es la única que lo hace.
      ///
      /// El sobrante repartido entre las nueve dejaba la etapa en
      /// 199 px para escribir «Calificado», la plata en 157 para
      /// doce dígitos y el código en 131 para once caracteres:
      /// cada dato en mitad de su propio charco de aire, que es el
      /// hueco de la fila vieja repartido en porciones. Lo que
      /// sobra va entero aquí, que es el único dato de la fila que
      /// de verdad crece: el nombre del negocio.
      ///
      /// Un renglón, y el texto entero en el `title`. Con dos, una
      /// fila medía 51 px y la de al lado 34: una lista con dos
      /// alturas deja de escanearse, porque el ojo necesita un
      /// paso constante para bajar por una columna.
      absorbe: true,
      pinta: (f) => (
        <span className="block truncate" title={f.titulo}>
          {f.titulo}
        </span>
      ),
      /// Su mínimo, no su ancho: por debajo de esto se desplaza la
      /// banda.
      ancho: "240px",
    },
    {
      clave: "deQuien",
      titulo: embudo === "EMPRESA" ? "Empresa" : "Persona",
      valor: (f) => f.deQuien ?? "",
      pinta: (f) => (
        <span className="block truncate" title={f.deQuien ?? undefined}>
          <Cliente nombre={f.deQuien} />
        </span>
      ),
      /// «Constructora Vía Verde S.A.» entera son 190 px con su
      /// relleno. Una persona se escribe más corto que una razón
      /// social, y la columna mide lo que mide su dato.
      ancho: embudo === "EMPRESA" ? "192px" : "168px",
    },
    {
      clave: "etapa",
      titulo: "Etapa",
      valor: (f) => f.etapaRotulo,
      filtro: "opciones",
      /// Punto del color de su etapa y el rótulo del mismo color,
      /// sin caja. 144 px: cabe «Propuesta enviada» con su punto y
      /// ni uno más. Fija a propósito —y por eso no absorbe—: si
      /// el rótulo no arranca siempre en la misma x, la rampa de
      /// color deja de leerse en vertical y vuelve a ser un
      /// arcoíris.
      pinta: (f) => <Etapa etapa={f.etapa} rotulo={f.etapaRotulo} />,
      ancho: "144px",
    },
    {
      clave: "valor",
      titulo: "Valor",
      valor: (f) => f.valor,
      numerica: true,
      /// `$ 999.999.999` a 13 px tabular son 104 px; con el
      /// relleno, 128. Es el techo del ticket de Grupo AE por unos
      /// cuantos negocios, y no hay decimales nunca.
      pinta: (f) => <Dinero valor={f.valor} />,
      ancho: "128px",
    },
    {
      clave: "asesor",
      titulo: "Dueño",
      valor: (f) => f.asesor?.nombre ?? "",
      filtro: "opciones",
      /// Una raya, y no «Sin dueño» en rojo.
      ///
      /// Estaban los dos rojos de la pantalla juntos —«Sin dueño»
      /// y «Sin contestar»— y solo uno es urgente. El rojo de este
      /// panel dice UNA cosa: que alguien lleva esperando. Un
      /// negocio sin asesor se ve igual filtrando por esta
      /// columna, que es como se reparte de verdad.
      pinta: (f) => <Persona nombre={f.asesor?.nombre} />,
      ancho: "120px",
    },
    {
      clave: "campana",
      titulo: "Campaña",
      valor: (f) => f.campana ?? "",
      filtro: "opciones",
      /// Solo con la lista ancha, y no es relleno: «empresas/Meta
      /// · Seguridad industrial» son 252 px enteros, y por debajo
      /// de eso se recorta justo por donde se distingue un anuncio
      /// de otro. A 1440 se ve filtrando por ella; a 1920 hay
      /// sitio para tenerla siempre delante.
      desde: 1600,
      pinta: (f) => (
        <span className="block truncate" title={f.campana ?? undefined}>
          <Puerta campana={f.campana} />
        </span>
      ),
      ancho: "252px",
    },
    {
      clave: "respuesta",
      titulo: "1.ª respuesta",
      valor: (f) => f.minutosPrimeraRespuesta ?? -1,
      numerica: true,
      /// El único color caliente de la pantalla. Cinco minutos en
      /// personas, veinticuatro horas en empresas: el umbral lo
      /// pone el embudo porque las dos cadencias no se parecen.
      pinta: (f) => <Reloj minutos={f.minutosPrimeraRespuesta} embudo={embudo} />,
      /// Cabe «Sin contestar», que es lo más largo que escribe.
      ancho: "112px",
    },
    {
      clave: "quieta",
      titulo: "Sin tocar",
      valor: (f) =>
        Math.floor((Date.now() - new Date(f.ultimoToqueEn).getTime()) / 86_400_000),
      numerica: true,
      /// Un negocio que lleva días sin que lo toquen también es
      /// alguien esperando, así que se pinta con el mismo reloj.
      ///
      /// Pero NO con el umbral del embudo: quieto tiene su propia
      /// paciencia. Con el del embudo —veinticuatro horas en
      /// empresas— toda fila que no se tocó ayer sale en ámbar, y
      /// una columna entera en ámbar deja de querer decir nada. El
      /// ámbar de este panel dice que alguien lleva esperando, y
      /// una semana es lo que este producto llama esperar: es el
      /// mismo umbral que usan «Se están enfriando» del Resumen y
      /// el reloj de la ficha del tablero.
      ///
      /// Y va pegada a «1.ª respuesta» a propósito: lo que este
      /// producto pierde no es por precio, es por silencio. Las
      /// dos leídas en vertical son la lista de lo que lleva
      /// quieto, que es la pregunta con la que se arma el día.
      pinta: (f) => (
        <Reloj
          minutos={Math.floor(
            (Date.now() - new Date(f.ultimoToqueEn).getTime()) / 60_000,
          )}
          umbral={UMBRAL_QUIETA}
        />
      ),
      ancho: "96px",
    },
    {
      clave: "cierre",
      titulo: "Cierre esperado",
      valor: (f) => f.cierreEsperado ?? "",
      /// `25 oct 2026` son 78 px: la columna de fecha mide 100.
      /// Solo con la lista ancha: es la única de las tres de
      /// tiempo que mira hacia adelante, y las dos que miran hacia
      /// atrás son las que hay que ver todos los días.
      desde: 1600,
      pinta: (f) => <Fecha iso={f.cierreEsperado} />,
      ancho: "100px",
    },
  ];

  return (
    <div className="flex min-h-0 grow flex-col">
      {/* La misma banda de cabecera que el resto del panel, para
          que las quince pantallas se lean como un solo producto.
          Lo que cambia aquí es lo que va a la derecha: la plata.

          Una sola cifra de la pantalla puede ir a 34 px, y siempre
          es dinero — nunca un conteo, nunca un porcentaje, nunca
          una fecha. Es lo que separa el panel de una empresa que
          vende del panel de administración de cualquier cosa. */}
      <Encabezado titulo={titulo} descripcion={descripcion}>
        {/* Mientras no hayan llegado los datos no se enseña la
            cifra. Un «— » de 34 px durante medio segundo dice que
            no hay plata sobre la mesa, y eso no es que falte el
            dato: es una afirmación, y es falsa. */}
        {filas !== null && (
          <div className="text-right">
            <Rotulo>Sobre la mesa</Rotulo>
            <span className="mt-1 block">
              <Dinero valor={resumen.total} portada />
            </span>
            <p className="secundario mt-1">
              {resumen.abiertas} abiertos ·{" "}
              <Dinero valor={resumen.ponderado} /> esperado
            </p>
          </div>
        )}
      </Encabezado>

      {/* Una banda mas, la del trabajo. El panel entero tiene un
          solo contenedor -- la banda -- y esta pantalla son dos:
          el titulo y la tabla. Antes eran tres sistemas de caja
          conviviendo y el marco cambiaba segun la pantalla. */}
      <div className="banda flex min-h-0 grow flex-col">
        {/* Sin tarjeta teñida de rosa y sin rojo.
            El rojo de este panel significa una sola cosa —que
            alguien lleva esperando respuesta— y un fallo del
            servidor no es eso. Peso 600, que es el peso del
            resultado de algo, y el mensaje tal cual lo manda el
            servidor: dice QUÉ falta, que es lo que sirve. */}
        {error && <p className="estado mb-3">{error}</p>}

        {filas === null ? (
          <Cargando que="Trayendo los leads…" />
        ) : (
          <Tabla
            id={`leads-${embudo.toLowerCase()}`}
            columnas={columnas}
            filas={filas}
            clave={(f) => f.id}
            alClic={(f) => setAbierta(f.id)}
            vacio={
              <p>
                Todavía no hay leads en este embudo. Entran solos por los
                formularios publicados y por los anuncios conectados.
              </p>
            }
          />
        )}
      </div>

      <CajonOportunidad
        id={abierta}
        alCerrar={() => setAbierta(null)}
        alCambiar={cargar}
      />
    </div>
  );
}
