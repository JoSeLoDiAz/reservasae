import Link from "next/link";

import {
  ETIQUETA_DATOS_EMPRESA,
  ETIQUETA_ETAPA,
  ETIQUETA_ORIGEN,
  fuenteDelFormulario,
  type FilaParticipante,
} from "@/lib/crm-api";

import { PildoraEtapa } from "./etapa";
import type { Columna } from "./tabla";

/// Fecha y hora, no solo fecha: dos leads del mismo dia se
/// ordenan mal si la hora no viaja, y saber a que hora entro
/// es lo que deja medir en cuanto se reacciono.
/// EN HORA DE BOGOTÁ, Y NO EN LA DEL NAVEGADOR.
///
/// Antes no decía `timeZone`, así que cada quien veía la fecha en
/// la zona de su equipo. Con todo el mundo en Colombia eso no se
/// nota, y por eso duró; basta un portátil con la zona cambiada
/// ---o un día de viaje--- para que dos personas lean horas
/// distintas de la misma ficha y una de las dos decida mal.
///
/// El negocio es colombiano y el reporte al SENA también, así que
/// la hora de la casa es la de Bogotá, dicha y no supuesta.
function fechaHora(valor: string | null): string {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * LA MISMA FECHA, PERO PARA ORDENAR Y PARA EL EXCEL.
 *
 * EL FALLO QUE ARREGLA, que lo encontró el cliente el 25 sep 2026
 * creyendo que fallaba el filtro «Hoy»: el archivo se arma con
 * `valor` y la pantalla con `pinta`, y solo `pinta` traducía la
 * hora. `valor` devolvía la fecha CRUDA, que viene en UTC.
 *
 * Son CINCO HORAS de desfase. Todo lead que entre entre las 7 de
 * la noche y medianoche salía en el Excel con la fecha del DÍA
 * SIGUIENTE, mientras la pantalla lo enseñaba bien. Cualquier
 * conteo por día, corte de mes o informe armado desde ese archivo
 * traía esas filas corridas un día, y quien lo comparaba con la
 * pantalla creía que una de las dos mentía.
 *
 * «2026-09-24 19:48» y no el formato de la pantalla, porque este
 * valor TAMBIÉN ES EL QUE ORDENA la columna. De año a minuto se
 * ordena solo como texto; «24/09/26, 7:48 p. m.» pondría todos los
 * días 1 juntos.
 */
function fechaOrdenable(valor: string | null): string {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";

  /// Por partes y no con `toLocaleString`: ningún `locale` da
  /// «AAAA-MM-DD HH:mm» de una pieza, y armarlo a mano es lo que
  /// garantiza que el orden sea el de siempre.
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((a, x) => {
      a[x.type] = x.value;
      return a;
    }, {});

  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/// El color va en la LETRA. Sin fondo, sin borde, sin
/// subrayado: en una tabla de 400 filas, 400 rectangulos de
/// color compiten con los datos en vez de ordenarlos, y el
/// subrayado se lee como un enlace que no lleva a ninguna
/// parte.
const TONO_EMPRESA: Record<FilaParticipante["datosEmpresa"], string> = {
  SIN: "text-texto-suave",
  PARCIAL: "text-aviso",
  COMPLETA: "text-exito",
};

/// Cuantos datos le faltan a la ficha, escrito bien.
///
/// «Faltan 1» no lo dice nadie. Y va en UNA funcion porque se
/// escribe en dos sitios -- el valor que se ordena y exporta,
/// y lo que se pinta -- y con dos copias una se queda en
/// plural el dia que se toque la otra.
///
/// SUMA LAS DOS LISTAS, y no es un detalle: desde el 24 sep 2026
/// `datos` mira tambien la organizacion, asi que contando solo la
/// de la persona una ficha a la que solo le falta el jefe directo
/// imprimia «Faltan 0» en ambar -- el panel diciendo que falta
/// algo y que son cero cosas, en la misma celda.
function cuantoFalta(f: FilaParticipante): number {
  return f.faltaDeLaPersona.length + (f.faltaDeLaEmpresa?.length ?? 0);
}

/**
 * Lo que falta, DICIENDO PARA QUÉ.
 *
 * «Tengo personas inscritas y realmente no falta ningún dato»
 * (cliente, 5 oct 2026). Tenía razón, y la causa son dos listas
 * distintas que esta celda enseñaba como una sola.
 *
 * La compuerta para inscribir pide tres cosas ---curso con sede, un
 * contacto y la autorización de datos--- y NO pide la organización
 * ni los campos del SEP. Esta columna cuenta justo eso otro. Así que
 * alguien se inscribe, se forma, se CERTIFICA, y la celda le sigue
 * diciendo «Falta 1»: se le reprocha lo que nunca se le exigió para
 * entrar. Medido: 18 de 18 inscritas y 24 de 24 certificadas.
 *
 * No se deja de contar ---esos datos sí hacen falta para el SENA y
 * perderlos de vista sería peor--- se dice PARA QUÉ faltan.
 */
function pendientes(f: FilaParticipante): string {
  if (f.datos === "COMPLETOS") return "Sin pendientes";
  const n = cuantoFalta(f);
  /// Con `datos` en PARCIALES y las dos listas vacias, el backend
  /// es viejo y no manda la de la empresa: se dice que falta algo
  /// sin inventarse un numero.
  if (n === 0) return "Falta algún dato";
  /// Quien ya entró no tiene NADA pendiente para entrar.
  const paraQue = f.paraQueFalta === "REPORTE" ? " para el SENA" : "";
  return n === 1 ? `Falta 1${paraQue}` : `Faltan ${n}${paraQue}`;
}

/// Lo que falta, diciendo DE QUIEN es cada cosa.
///
/// Enumerarlo todo seguido dejaba al asesor sin saber si el
/// «correo» que falta es el de la persona o el del jefe directo,
/// que se consiguen de formas distintas.
function detalleDeLoQueFalta(f: FilaParticipante): string {
  if (f.datos === "COMPLETOS") {
    return "No le falta ningún dato, ni suyo ni de su organización.";
  }
  const partes: string[] = [];
  if (f.faltaDeLaPersona.length > 0) {
    partes.push(`De ella: ${f.faltaDeLaPersona.join(", ")}`);
  }
  if (f.faltaDeLaEmpresa?.length) {
    partes.push(`De su organización: ${f.faltaDeLaEmpresa.join(", ")}`);
  }
  return partes.join(" · ") || "Le falta algún dato.";
}

/// Los cuatro estados de importación, y son CUATRO a propósito.
///
/// Con `filtro: "opciones"` el valor TIENE que ser de cardinalidad
/// baja: el desplegable saca sus opciones de los datos, así que
/// poner ahí el nombre del archivo daría una opción por carga
/// --cien opciones y ninguna que agrupe-- que es justo lo contrario
/// de poder pedir «los que entraron por archivo». El archivo se
/// enseña en la celda y en el título; lo que se filtra es el estado.
///
/// «Importado sin registro» no es un caso de laboratorio: el
/// histórico de cargas (`CargaDeParticipantes`) es POSTERIOR a las
/// primeras importaciones, y hay fichas con `origenLead =
/// IMPORTACION` sin `cargaId`. Decir de ellas «No importado» es
/// mentir; decir «Importado de archivo» es inventarse el archivo.
type EstadoDeImportacion =
  | "No importado"
  | "Importado de archivo"
  | "Importado pegado"
  | "Importado sin registro";

function estadoDeImportacion(f: FilaParticipante): EstadoDeImportacion {
  const carga = f.carga ?? null;
  if (carga) {
    return carga.origen === "PEGADO"
      ? "Importado pegado"
      : "Importado de archivo";
  }
  if (f.origenLead === "IMPORTACION") return "Importado sin registro";
  return "No importado";
}

/// El color va en la LETRA y SOLO cuando dice algo.
///
/// La mayoría de las filas no vino de un archivo: cuatrocientas
/// etiquetas de color para decir «aquí no pasó nada» tapan a las
/// pocas que sí hay que mirar. En ámbar van las dos que piden algo
/// --la carga que dejó filas fallidas y la que no consta--, y en
/// verde la importación que salió limpia.
function tonoDeImportacion(f: FilaParticipante): string {
  const estado = estadoDeImportacion(f);
  if (estado === "No importado") return "text-texto-suave";
  if (estado === "Importado sin registro") return "text-aviso";
  return (f.carga?.fallidos ?? 0) > 0 ? "text-aviso" : "text-exito";
}

/// De qué archivo vino, cuándo, quién la hizo y cómo salió.
///
/// Los recuentos son DE LA CARGA y así se escriben: «120 filas, 118
/// nuevas» no es un dato de esta persona, y leído como suyo haría
/// pensar que la ficha se importó ciento veinte veces.
function detalleDeLaImportacion(f: FilaParticipante): string {
  const carga = f.carga ?? null;
  if (!carga) {
    return f.origenLead === "IMPORTACION"
      ? "Entró por una importación anterior al histórico de cargas: no consta de qué archivo vino."
      : "No vino de un archivo: entró por el formulario público, por una reserva de empresa o la escribió un asesor.";
  }
  const resumen =
    `Esa carga: ${carga.filas} filas, ${carga.creados} nuevas, ` +
    `${carga.yaExistian} ya estaban` +
    (carga.fallidos > 0 ? `, ${carga.fallidos} fallaron` : "");
  return [
    carga.nombreArchivo ?? "Tabla pegada a mano",
    `${fechaHora(carga.creadoEn)} · ${carga.autor}`,
    resumen,
  ].join(" · ");
}

/**
 * Las columnas de un lead, en un solo sitio.
 *
 * Las usan Inscripciones e Inscritos: son la misma fila
 * mirada en dos momentos del proceso. Definirlas dos veces
 * garantiza que se separen a la primera que se toque una.
 *
 * Estan todas: la persona elige cuales ve desde el selector
 * de columnas. `aparte` solo decide cuales vienen marcadas
 * de entrada, no cuales existen.
 */
export function columnasDeParticipante(): Columna<FilaParticipante>[] {
  return [
    {
      clave: "creadoEn",
      ancho: "148px",
      titulo: "Fecha de creación",
      /// CRUDA, que es lo que necesitan el filtro y el orden: el
      /// filtro hace `new Date(valor)` y de ahí saca el día de
      /// Bogotá. Lo que va al archivo es `exporta`, abajo.
      valor: (f) => f.creadoEn,
      /// SU CELDA DE FILTRO ESTABA VACÍA, y era lo único de la fila
      /// que lo estaba (cliente, 30 sep 2026: «es tener filtro como
      /// correo, de acuerdo a la captura»). Un hueco en medio de la
      /// fila se lee como que algo se rompió.
      filtro: "fecha",
      /// Y EN EL ARCHIVO, YA EN HORA DE BOGOTÁ. El porqué largo está
      /// en `fechaOrdenable`: el Excel salía cinco horas corrido.
      exporta: (f) => fechaOrdenable(f.creadoEn),
      pinta: (f) => (
        <span className="whitespace-nowrap font-mono text-xs">
          {fechaHora(f.creadoEn)}
        </span>
      ),
    },
    {
      clave: "correo",
      ancho: "215px",
      titulo: "Correo",
      valor: (f) => f.correo,
      filtro: "texto",
    },
    {
      clave: "celular",
      ancho: "176px",
      titulo: "Número de teléfono",
      valor: (f) => f.celular,
      filtro: "texto",
    },
    {
      clave: "nombre",
      ancho: "205px",
      titulo: "Nombre completo",
      fija: true,
      valor: (f) => f.nombre,
      pinta: (f) => (
        <Link
          href={"/admin/participantes/" + f.id}
          // sin esto el clic sigue subiendo a la fila y abre
          // ADEMAS el cajon lateral: dos cosas de un clic
          onClick={(e) => e.stopPropagation()}
          className="underline"
        >
          {f.nombre}
        </Link>
      ),
      filtro: "texto",
    },
    {
      clave: "tipoDocumento",
      ancho: "152px",
      titulo: "Tipo documento",
      valor: (f) => f.tipoDocumento,
      filtro: "opciones",
    },
    {
      clave: "numeroDocumento",
      ancho: "176px",
      titulo: "Número documento",
      valor: (f) => f.numeroDocumento,
      pinta: (f) => <span className="font-mono text-sm">{f.numeroDocumento}</span>,
      filtro: "texto",
    },
    {
      clave: "departamento",
      ancho: "128px",
      titulo: "Departamento",
      valor: (f) => f.departamento,
      filtro: "opciones",
    },
    {
      clave: "municipio",
      ancho: "124px",
      titulo: "Municipio",
      valor: (f) => f.municipio,
      filtro: "opciones",
    },
    {
      /// Solo el codigo. El nombre completo pasa de sesenta
      /// caracteres y una fila con eso deja de leerse.
      clave: "accionCodigo",
      ancho: "208px",
      titulo: "Acción formación interés",
      valor: (f) => f.accionCodigo,
      pinta: (f) =>
        f.accionCodigo ? (
          <span title={f.accion ?? undefined} className="font-mono text-sm">
            {f.accionCodigo}
          </span>
        ) : null,
      filtro: "opciones",
    },
    {
      /// Al lado de la acción, que es de donde cuelga: «Grupo 1»
      /// solo tiene sentido sabiendo de qué acción es, y así se
      /// leen las dos de una pasada.
      clave: "grupo",
      /// 124 Y NO 78: UNA COLUMNA TIENE QUE DAR PARA SU PROPIO FILTRO.
      ///
      /// Con el título ya en una línea la cabecera quedó pareja, pero
      /// esta seguía tan estrecha que su desplegable salía como «T…» y
      /// «Sin grupo» partía en dos renglones dentro de la celda. Un
      /// filtro que está pero no se puede leer no sirve de nada.
      ancho: "124px",
      titulo: "Grupo",
      valor: (f) => f.grupo,
      pinta: (f) =>
        f.grupo === null ? (
          /// Se dice, no se deja en blanco: sin grupo la persona
          /// no entra en el reporte al SENA, y una celda vacía
          /// se lee como que el dato no se pidió.
          <span className="text-[0.75rem] text-texto-suave">Sin grupo</span>
        ) : (
          <span className="tabular-nums">Grupo {f.grupo}</span>
        ),
      filtro: "opciones",
    },
    {
      clave: "asesor",
      ancho: "126px",
      titulo: "Asesor",
      valor: (f) => f.asesor?.nombre ?? "Sin asignar",
      filtro: "opciones",
    },
    {
      clave: "etapa",
      ancho: "124px",
      titulo: "Etapa lead",
      valor: (f) => ETIQUETA_ETAPA[f.etapa],
      pinta: (f) => <PildoraEtapa etapa={f.etapa} />,
      filtro: "opciones",
    },
    {
      clave: "datos",
      ancho: "160px",
      /// «Datos pendientes» y no «Estado de los datos».
      ///
      /// Esta columna decía «Datos completos / Datos
      /// parciales» y la de al lado dice «Etapa: Datos
      /// completos». Con las mismas dos palabras para dos
      /// cosas distintas, ver «Datos completos» en una y
      /// «Datos parciales» en la otra parecía una
      /// contradicción del sistema, y no lo era:
      ///
      ///   · la ETAPA la mueve una persona;
      ///   · esto lo CALCULA `completitud.ts` mirando si están
      ///     el correo, el celular, la fecha de nacimiento, el
      ///     género, el estrato, el departamento, el municipio
      ///     y la dirección.
      ///
      /// Se puede estar en la etapa «Datos completos» y
      /// deberle datos al SENA. Ahora se dice CUÁNTOS faltan,
      /// que además es accionable: «Faltan 4» le dice al asesor
      /// que hay algo que pedir; «Datos parciales» no.
      titulo: "Datos pendientes",
      /// «Falta 1» y no «Faltan 1». Una sola función para los
      /// dos sitios donde se escribe —el valor que se ordena y
      /// exporta, y lo que se pinta— porque tenerlo dos veces
      /// es como uno de los dos se queda en plural.
      valor: (f) => pendientes(f),
      pinta: (f) => (
        <span
          title={detalleDeLoQueFalta(f)}
          /// El color va en la LETRA, sin caja y sin subrayado.
          ///
          /// Sin caja porque en una tabla de 400 filas, 400
          /// rectángulos de color compiten con los datos en vez
          /// de ordenarlos. Y sin subrayado porque en una tabla
          /// el texto subrayado se lee como un enlace, y este
          /// no lleva a ninguna parte: se confundiría con las
          /// columnas que sí son pulsables.
          className={`font-medium whitespace-nowrap ${
            f.datos === "COMPLETOS" ? "text-exito" : "text-aviso"
          }`}
        >
          {pendientes(f)}
        </span>
      ),
      filtro: "opciones",
    },
    {
      /// La clave NO cambia: es lo que guarda el selector de
      /// columnas, y renombrarla borra la columna de la vista
      /// de quien ya eligió las suyas.
      clave: "origenLead",
      ancho: "160px",
      titulo: "Canal de entrada",
      valor: (f) => ETIQUETA_ORIGEN[f.origen],
      filtro: "opciones",
    },
    {
      /// POR QUÉ FORMULARIO ENTRÓ, que no es lo mismo que por qué
      /// canal. Va pegada a «Fuente formulario» porque se leen
      /// juntas: el canal dice cómo llegó y esta, a qué llegó.
      clave: "formularioDeEntrada",
      nueva: true,
      ancho: "190px",
      titulo: "Formulario",
      valor: (f) => f.formularioDeEntrada ?? "",
      pinta: (f) =>
        f.formularioDeEntrada ? (
          <span className="block truncate">{f.formularioDeEntrada}</span>
        ) : (
          <span className="text-texto-suave">—</span>
        ),
      filtro: "opciones",
    },
    {
      /**
       * Y POR QUÉ ENLACE, que es otra pregunta que el formulario.
       *
       * «Si o sí el sistema debe decirme de qué link de formulario
       * entró, porque es imposible que no se pueda, o sea es una
       * falacia» (cliente, 5 oct 2026). No era una falacia: el dato
       * llegaba en el formulario público y se tiraba. Desde el 5 oct
       * se guarda en la ficha, sin condiciones.
       *
       * EL MISMO FORMULARIO SE REPARTE POR VARIOS ENLACES ---uno por
       * campaña, uno por gremio--- así que «cuántos trajo este
       * enlace» no se contesta con la columna de al lado. Por eso son
       * dos y van juntas.
       *
       * La raya es de las fichas anteriores a esa fecha: no se les
       * inventa de dónde vinieron.
       */
      clave: "enlaceDeEntrada",
      nueva: true,
      ancho: "160px",
      titulo: "Enlace de entrada",
      valor: (f) => f.enlaceDeEntrada ?? "",
      pinta: (f) =>
        f.enlaceDeEntrada ? (
          <span className="block truncate font-mono text-xs">
            {f.enlaceDeEntrada}
          </span>
        ) : (
          <span className="text-texto-suave">—</span>
        ),
      filtro: "opciones",
    },
    {
      /// El filtro va por la fuente y no por la campaña: con
      /// cada mailing un nombre nuevo, filtrar por nombre daria
      /// una opcion por envio y ninguna por «Mailing».
      clave: "fuenteFormulario",
      /// Llegó el 18 sep 2026, con selecciones ya guardadas.
      nueva: true,
      ancho: "150px",
      titulo: "Fuente formulario",
      valor: (f) => fuenteDelFormulario(f),
      /**
       * SOLO EL CANAL. La campaña iba de subtítulo aquí debajo y se
       * salió a su propia columna el 6 oct 2026, por esto:
       *
       * «¿Creo que se debe separar, ejemplo el Eduteka, para otra
       * columna, porque no tengo opción de saber qué formulario?»
       * (cliente). Y tenía razón en la lectura: viendo «Orgánico /
       * eduteka» encima de un «Formulario: Preinscripción pública», lo
       * que parece es que «eduteka» ES el formulario. No lo es: es la
       * campaña que atribuyó el lead, y son tres preguntas distintas
       * ---por qué canal, por qué campaña, a qué formulario--- que
       * ahora son tres columnas.
       *
       * Pegadas a propósito, en ese orden: se leen juntas.
       */
      pinta: (f) => <span className="block">{fuenteDelFormulario(f)}</span>,
      filtro: "opciones",
    },
    {
      /// LA CAMPAÑA, en su propia columna desde el 6 oct 2026.
      ///
      /// En monoespaciada y pequeña, como estaba de subtítulo: son
      /// marcas tecleadas en un enlace ---«eduteka», «lanzamiento-oct»---
      /// y no nombres, así que se leen letra a letra.
      clave: "campanaDeEntrada",
      nueva: true,
      ancho: "150px",
      titulo: "Campaña",
      valor: (f) => f.campanaDeEntrada ?? "",
      pinta: (f) =>
        f.campanaDeEntrada ? (
          <span className="block truncate font-mono text-xs">
            {f.campanaDeEntrada}
          </span>
        ) : (
          <span className="text-texto-suave">—</span>
        ),
      filtro: "opciones",
    },
    {
      /// Punto 2.0 del cliente: «visibilidad del estado de
      /// importación en Gestión de leads». Hoy, cargado un archivo,
      /// la tabla no decía de qué carga venía cada lead ni cómo le
      /// fue, y eso solo se podía reconstruir abriendo el histórico
      /// de Carga de participantes y comparando a mano.
      ///
      /// VA PEGADA A «Fuente formulario» y «Canal de entrada», que
      /// son las otras dos de procedencia: las tres contestan de
      /// dónde salió la ficha, y leerlas juntas es lo que separa un
      /// lead que se ganó de uno que se subió en una lista.
      clave: "importacion",
      /// Llegó el 1 oct 2026, con selecciones ya guardadas.
      nueva: true,
      ancho: "190px",
      titulo: "Estado de importación",
      valor: (f) => estadoDeImportacion(f),
      pinta: (f) => (
        <span
          className="block leading-tight"
          title={detalleDeLaImportacion(f)}
        >
          <span className={`block font-medium ${tonoDeImportacion(f)}`}>
            {estadoDeImportacion(f)}
          </span>
          {f.carga && (
            /// El archivo debajo, en mono y recortado: es lo que
            /// de verdad se pregunta --«¿este vino en la lista de
            /// ayer?»-- y la fecha al lado desempata las dos
            /// cargas del mismo archivo.
            <span className="block truncate font-mono text-xs text-texto-suave">
              {f.carga.nombreArchivo ?? "pegado"} ·{" "}
              {fechaHora(f.carga.creadoEn)}
            </span>
          )}
        </span>
      ),
      filtro: "opciones",
    },
    {
      clave: "ultimaActividad",
      ancho: "140px",
      titulo: "Última actividad",
      valor: (f) => f.ultimaActividad,
      filtro: "fecha",
      exporta: (f) => fechaOrdenable(f.ultimaActividad),
      pinta: (f) => (
        <span className="whitespace-nowrap font-mono text-xs">
          {fechaHora(f.ultimaActividad)}
        </span>
      ),
    },
    {
      /// De donde viene, no donde esta: sirve para ver por
      /// que camino llego a la etapa de hoy.
      ///
      /// SE LLAMABA «Última etapa lead» Y CONFUNDIA (20 sep 2026):
      /// al lado de «Etapa lead» se leia como «la etapa mas
      /// reciente», asi que una ficha en «Datos completos» que
      /// venia de «Interesado» parecia decir las dos cosas a la
      /// vez. «Viene de» dice de donde, no donde esta. La clave NO
      /// cambia: la guarda el selector de columnas, y renombrarla
      /// borraria la columna de quien ya eligio las suyas.
      clave: "etapaAnterior",
      ancho: "160px",
      titulo: "Viene de la etapa",
      valor: (f) => (f.etapaAnterior ? ETIQUETA_ETAPA[f.etapaAnterior] : "No se ha movido"),
      filtro: "opciones",
    },
    {
      clave: "cambios",
      ancho: "172px",
      titulo: "Cambios realizados",
      numerica: true,
      valor: (f) => f.cambios,
      filtro: "numero",
    },
    {
      /**
       * EL NIT DE LA ORGANIZACIÓN.
       *
       * Va ANTES que el nombre y que «Datos de empresa» porque es la
       * llave: es lo que se busca, lo que se pega en el reporte y lo
       * que distingue a dos colegios que se llaman parecido.
       */
      clave: "empresaNit",
      nueva: true,
      ancho: "140px",
      titulo: "NIT empresa",
      valor: (f) => f.empresaNit ?? "",
      pinta: (f) =>
        f.empresaNit ? (
          <span className="whitespace-nowrap font-mono text-xs">
            {f.empresaNit}
          </span>
        ) : (
          <span className="text-texto-suave">—</span>
        ),
      filtro: "texto",
    },
    {
      /// El nombre, al lado de su NIT. Separados y no en una sola
      /// celda: se filtran por cosas distintas ---el NIT exacto, el
      /// nombre por un trozo--- y juntos no se puede.
      clave: "empresaNombre",
      nueva: true,
      ancho: "230px",
      titulo: "Empresa",
      valor: (f) => f.empresaNombre ?? "",
      pinta: (f) =>
        f.empresaNombre ? (
          <span className="block truncate">{f.empresaNombre}</span>
        ) : (
          <span className="text-texto-suave">—</span>
        ),
      filtro: "texto",
    },
    {
      clave: "datosEmpresa",
      ancho: "164px",
      titulo: "Datos de empresa",
      valor: (f) => ETIQUETA_DATOS_EMPRESA[f.datosEmpresa],
      pinta: (f) => (
        <span
          className={`font-medium whitespace-nowrap ${TONO_EMPRESA[f.datosEmpresa]}`}
        >
          {ETIQUETA_DATOS_EMPRESA[f.datosEmpresa]}
        </span>
      ),
      filtro: "opciones",
    },
    {
      clave: "notas",
      /// Lo mismo que «Grupo»: su filtro es una caja de número y a 72
      /// px el texto de ayuda ---«>10, 3-8…»--- salía cortado.
      ancho: "112px",
      titulo: "Notas",
      numerica: true,
      valor: (f) => f.notas,
      filtro: "numero",
    },
    {
      /// Vacia = nunca se le ha logrado hablar, y esa es la
      /// lista de a quien insistirle. Es distinta de "sin
      /// notas": a esta ya se le intento y no contesto.
      clave: "ultimoContacto",
      ancho: "140px",
      titulo: "Último contacto",
      valor: (f) => f.ultimoContacto ?? "",
      /// Las tres de fecha llevan el mismo filtro: dejar una sola con
      /// él sería volver a dejar huecos en la fila.
      filtro: "fecha",
      exporta: (f) => fechaOrdenable(f.ultimoContacto),
      pinta: (f) =>
        f.ultimoContacto ? (
          <span className="whitespace-nowrap font-mono text-xs">
            {fechaHora(f.ultimoContacto)}
          </span>
        ) : (
          <span className="text-xs text-aviso">Nunca</span>
        ),
    },
    {
      /// El de SIEMPRE y no el de desde el ultimo contacto, que
      /// si da el lead. Para lo que sirve la columna —a quien
      /// no se ha logrado contactar— las dos coinciden.
      clave: "sinRespuesta",
      ancho: "190px",
      titulo: "Intentos sin respuesta",
      numerica: true,
      valor: (f) => f.sinRespuesta,
      filtro: "numero",
    },
    {
      clave: "gremio",
      ancho: "124px",
      titulo: "Gremio",
      valor: (f) => f.gremio,
      filtro: "opciones",
    },
    {
      clave: "antiguedadDias",
      ancho: "204px",
      titulo: "Antigüedad lead en días",
      numerica: true,
      valor: (f) => f.antiguedadDias,
      filtro: "numero",
    },
  ];
}
