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
function fechaHora(valor: string | null): string {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
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

function pendientes(f: FilaParticipante): string {
  if (f.datos === "COMPLETOS") return "Sin pendientes";
  const n = cuantoFalta(f);
  /// Con `datos` en PARCIALES y las dos listas vacias, el backend
  /// es viejo y no manda la de la empresa: se dice que falta algo
  /// sin inventarse un numero.
  if (n === 0) return "Falta algún dato";
  return n === 1 ? "Falta 1" : `Faltan ${n}`;
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
      valor: (f) => f.creadoEn,
      /// SU CELDA DE FILTRO ESTABA VACÍA, y era lo único de la fila
      /// que lo estaba (cliente, 30 sep 2026: «es tener filtro como
      /// correo, de acuerdo a la captura»). Un hueco en medio de la
      /// fila se lee como que algo se rompió.
      filtro: "fecha",
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
      ancho: "120px",
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
      ancho: "96px",
      titulo: "Tipo documento",
      valor: (f) => f.tipoDocumento,
      filtro: "opciones",
    },
    {
      clave: "numeroDocumento",
      ancho: "128px",
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
      ancho: "104px",
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
      ancho: "116px",
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
      ancho: "104px",
      titulo: "Canal de entrada",
      valor: (f) => ETIQUETA_ORIGEN[f.origen],
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
      pinta: (f) => (
        <span className="block leading-tight">
          <span className="block">{fuenteDelFormulario(f)}</span>
          {f.campanaDeEntrada && (
            <span className="block truncate font-mono text-xs text-texto-suave">
              {f.campanaDeEntrada}
            </span>
          )}
        </span>
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
      ancho: "124px",
      titulo: "Viene de la etapa",
      valor: (f) => (f.etapaAnterior ? ETIQUETA_ETAPA[f.etapaAnterior] : "No se ha movido"),
      filtro: "opciones",
    },
    {
      clave: "cambios",
      ancho: "92px",
      titulo: "Cambios realizados",
      numerica: true,
      valor: (f) => f.cambios,
      filtro: "numero",
    },
    {
      clave: "datosEmpresa",
      ancho: "136px",
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
      ancho: "104px",
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
      ancho: "104px",
      titulo: "Antigüedad lead en días",
      numerica: true,
      valor: (f) => f.antiguedadDias,
      filtro: "numero",
    },
  ];
}
