"use client";

/**
 * Reservas, unificadas: una fila por organización.
 *
 * «Hay una empresa que tiene 4 reservas en 4 AF» (cliente, 25 sep
 * 2026). El listado la enseñaba cuatro veces, y para saber qué había
 * apartado esa empresa tocaba buscar sus cuatro filas por toda la
 * tabla. Aquí la acción de formación deja de ser un VALOR de la fila
 * y pasa a ser una COLUMNA, y lo demás se consolida:
 *
 * EL JUEGO DE COLUMNAS ES EL MODELO QUE ENTREGÓ EL CLIENTE
 * (`reservas_colegios.xlsx`, hoja «Reservas», 30 sep 2026), en su
 * orden y con sus rótulos:
 *
 *   Fechas · NIT · Organización · Contacto · Correo del contacto ·
 *   Celular del contacto · Cargo del contacto · Estado ·
 *   Cupos reservados · leads recibidos · Cuantos inscritos ·
 *   Descartados · No contactable · Total lead gestionados ·
 *   Cupos pendientes · AF1…AFn
 *
 * Las de antes que no están en su modelo --Total reservas, Cupos
 * ocupados, Cupos sin persona, Cupos en espera, Reservas canceladas,
 * Entró por, Red asociada-- NO SE BORRAN: se quedan apagadas en el
 * panel de Columnas. Aquí nada se elimina, se oculta.
 *
 * OJO con «Cupos pendientes»: en su hoja es `cupos reservados −
 * leads recibidos`, que NO es lo que decía esa columna hasta hoy
 * --los cupos sin persona detrás--. Aquella se llama ahora «Cupos
 * sin persona» y sigue ahí.
 *
 * Las columnas AF las manda el servidor, no esta pantalla: solo se
 * saben mirando todas las reservas del recorte, y la tabla de al
 * lado pagina de a 200. Salen SOLO de las acciones donde alguien
 * reservó --en su modelo falta AF4 porque nadie reservó ahí-- y por
 * eso no hay ninguna lista de códigos escrita a mano.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";

import { Cajon, Dato } from "./cajon";
import { Desplegable } from "./desplegable";
import { Aviso } from "./marco-admin";
import { Cargando, Cifra } from "./piezas";
import { Tabla, type Columna } from "./tabla";
import { bonito, enMayusculas } from "@/lib/api";
import { ErrorApi } from "@/lib/api";
import {
  tablerosApi,
  type CeldaReserva,
  type CifrasDeLeads,
  type ColumnaAccion,
  type EstadoReserva,
  type FilaAgrupada,
  type ReservaEnCelda,
  type ReservasAgrupadas,
} from "@/lib/tableros-api";

const ETIQUETA_ESTADO: Record<EstadoReserva, { texto: string; clase: string }> = {
  CONFIRMADA: { texto: "Confirmada", clase: "text-exito" },
  LISTA_ESPERA: { texto: "En espera", clase: "text-aviso" },
  CANCELADA: { texto: "Cancelada", clase: "text-error" },
};

/// El orden en que se ofrecen al editar: de más a menos sitio.
const ESTADOS: EstadoReserva[] = ["CONFIRMADA", "LISTA_ESPERA", "CANCELADA"];

/**
 * Lo que pasó con los leads de una fila, resista o no el servidor.
 *
 * NO ES PRUDENCIA DE MÁS: en esta casa la forma se despliega sin lo
 * funcional --los commits de solo frontend se descartan-- así que
 * esta pantalla tiene que poder ir por delante del servidor que la
 * alimenta. Con un backend anterior a `CifrasDeLeads`, `fila.leads`
 * llega sin definir y leerle un campo tumba la tabla entera: seis
 * columnas en cero se entienden, una pantalla en blanco no.
 */
const leadsDe = (f: FilaAgrupada): CifrasDeLeads =>
  f.leads ?? {
    leadsRecibidos: 0,
    inscritos: 0,
    descartados: 0,
    noContactable: 0,
    totalLeadGestionados: 0,
    cuposPendientes: 0,
  };

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });

/**
 * Los días en que esta organización reservó, uno por renglón.
 *
 * ANTES ERA UN TRAMO --«22 de ago – 29 de ago de 26»--, y el cliente
 * lo devolvió: «no así, sino dentro de la celda como si fueran filas
 * individuales» (25 sep 2026). Tenía razón: un tramo dice entre qué
 * dos días pasó algo, pero no CUÁNDO ni CUÁNTAS VECES, y esta fila
 * junta varias reservas justamente para poder contarlas.
 *
 * Se agrupa por la fecha YA ESCRITA y no por el instante: dos
 * reservas del mismo día de Bogotá tienen instantes distintos, y
 * comparar el ISO cortado a diez letras las separaría en dos
 * renglones cada vez que una cae después de las 7 de la tarde.
 */
function diasDeLaFila(fila: FilaAgrupada): string[] {
  /// texto -> el instante más temprano con ese texto, que es por el
  /// que se ordenan.
  const dias = new Map<string, string>();
  for (const celda of Object.values(fila.porAccion)) {
    for (const r of celda.reservas) {
      const texto = fecha(r.creadoEn);
      const previo = dias.get(texto);
      if (previo === undefined || r.creadoEn < previo) dias.set(texto, r.creadoEn);
    }
  }
  if (dias.size === 0) return [fecha(fila.ultimaReserva)];
  return [...dias.entries()]
    .sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map(([texto]) => texto);
}

/**
 * Cómo se rotula una columna AF.
 *
 * El gremio solo se añade cuando hace falta: «AF1» se repite entre
 * convenios y no significa lo mismo, así que con los dos a la vista
 * dos columnas rotuladas «AF1» a secas serían indistinguibles. Con
 * un gremio solo, repetir su sigla en las ocho cabeceras es ruido.
 */
const tituloDeAccion = (a: ColumnaAccion) =>
  a.ambiguo && a.convenioSigla ? `${a.codigo} · ${a.convenioSigla}` : a.codigo;

/**
 * Los datos de contacto de una fila, en un solo texto.
 *
 * LOS SEPARADORES SON LOS DEL CLIENTE, no los que escribe
 * `join(", ")` por omisión: celulares y correos con « / », cargos con
 * « ; » (hoja «Reservas», fila 6). No es capricho: un cargo puede
 * llevar una barra dentro --«Directora Pedagógica y de
 * Bilingüismo»-- y con barras no se vería dónde acaba uno.
 *
 * Los vacíos se caen: una empresa con dos contactos de los que uno
 * no dejó celular enseñaba «3194173564 / », que se lee como un dato
 * a medio escribir.
 */
function juntarValores(
  valores: Array<string | null | undefined>,
  separador = " / ",
): string {
  return valores.filter((v): v is string => !!v?.trim()).join(separador);
}

/**
 * Lo mismo, pintado.
 *
 * Va aparte del valor plano --que es el que ordena, filtra y se
 * busca-- para poder decir «—» cuando no hay ninguno: una celda en
 * blanco no distingue «no lo dejó» de «la columna está rota».
 */
function ListaDeContacto({
  valores,
  separador = " / ",
}: {
  valores: Array<string | null | undefined>;
  separador?: string;
}) {
  const texto = juntarValores(valores, separador);
  if (!texto) return <span className="text-texto-suave">—</span>;
  return <span>{texto}</span>;
}

/**
 * Lo que dice la celda de una AF.
 *
 * El número son los cupos, que es lo que se viene a saber; el color
 * y el tachado dicen en qué estado están. La palabra entera va en la
 * columna Estado y en el cajón: repetirla en ocho celdas dejaría la
 * fila ilegible.
 */
function Celda({ celda }: { celda: CeldaReserva | undefined }) {
  if (!celda) {
    /// Ni un hueco en blanco ni un cero: no reservó esta acción, y un
    /// cero se lee como «reservó y le dieron ninguno».
    return <span className="text-texto-suave">·</span>;
  }

  const cancelada = celda.estado === "CANCELADA";
  const cupos = cancelada ? celda.cuposSolicitados : celda.cuposConfirmados;
  const enEspera = !cancelada && celda.cuposEnEspera > 0;

  /// Cada reserva se explica sola en el rótulo: con dos sedes hay
  /// dos, y el número de la celda es la suma de las dos.
  const detalle = celda.reservas
    .map(
      (r) =>
        `${ETIQUETA_ESTADO[r.estado].texto} · ${r.ubicacion} · ` +
        `${r.conNombre} de ${r.cuposConfirmados} cupos con persona · ` +
        `reservó el ${fecha(r.creadoEn)}`,
    )
    .join("\n");

  return (
    <span
      className={
        "whitespace-nowrap tabular-nums " +
        ETIQUETA_ESTADO[celda.estado].clase +
        (celda.estado === "CANCELADA" ? " line-through" : "")
      }
      title={detalle}
    >
      {/* «2 de 16» Y NO «16» A SECAS (cliente, 25 sep 2026: «que esto
          se sepa de qué AF»). Las columnas «Cupos ocupados» y «Cupos
          pendientes» son el total de la fila --que es lo que una
          columna de fila debe decir-- y no había dónde ver de qué
          acción salía cada parte.

          CON LA PALABRA «de» Y NO CON UN PUNTO DEL MEDIO. Aquí sí es
          una razón --los dos números son cupos de la misma acción--, y
          es por escribirla con un punto que «2 · 30 cupos» se leyó
          como «2 de 30» cuando no lo era.

          La cancelada se queda con su cifra sola y tachada: sus cupos
          volvieron a la oferta, así que no hay ninguno ocupado del que
          hablar. */}
      {cancelada ? (
        cupos
      ) : (
        <>
          <span className={celda.conNombre > 0 ? "font-semibold" : "text-texto-suave"}>
            {celda.conNombre}
          </span>
          <span className="text-texto-suave"> de {cupos}</span>
        </>
      )}
      {enEspera && <span className="text-aviso"> +{celda.cuposEnEspera}</span>}
      {/* Dos sedes en la misma acción. Sin esta marca, la celda
          enseña una suma que no cuadra con ninguna de las dos
          reservas y no dice de dónde sale. */}
      {celda.reservas.length > 1 && (
        <span className="text-texto-suave"> ×{celda.reservas.length}</span>
      )}
    </span>
  );
}

/**
 * La columna Estado: «Confirmada las 6», o la lista si hay mezcla.
 *
 * Con todas en el mismo estado se dice una vez y se cuenta: cuatro
 * líneas iguales no informan de nada y hacen la fila cuatro veces
 * más alta. La lista sale cuando hay mezcla, que es justo cuando
 * hace falta distinguirlas.
 *
 * EL NÚMERO SON ACCIONES DE FORMACIÓN, no reservas, y ESO ESTÁ
 * PENDIENTE DE QUE EL CLIENTE LO CONFIRME. Su hoja dice «Confirmada
 * las 6», «Confirmada las 5», «Confirmada las 2» y «Confirmada» a
 * secas, sin explicar el número; la lectura acordada aquí es «en
 * cuántas acciones de formación tiene reserva esta organización», y
 * «Confirmada» a secas es una sola. Se calcula --no se teclea--, así
 * que si él lee otra cosa en ese número, se cambia esta cuenta y
 * nada más.
 *
 * Con la otra lectura posible --RESERVAS en vez de acciones-- la
 * cifra no es la misma: la misma acción en dos sedes son dos
 * reservas y UNA acción, y hasta hoy esta columna contaba reservas.
 */
function EstadoDeLaFila({
  fila,
  acciones,
}: {
  fila: FilaAgrupada;
  acciones: ColumnaAccion[];
}) {
  const suyas = acciones
    .filter((a) => fila.porAccion[a.accionFormacionId])
    .map((a) => ({ accion: a, celda: fila.porAccion[a.accionFormacionId] }));

  if (suyas.length === 0) return <span className="text-texto-suave">—</span>;

  const estados = new Set(suyas.map((s) => s.celda.estado));
  /// Una celda mixta --dos sedes de la misma acción en estados
  /// distintos-- no puede resumirse en una palabra: se abre la lista
  /// aunque las demás coincidan.
  if (estados.size === 1 && !suyas.some((s) => s.celda.mixta)) {
    const estado = ETIQUETA_ESTADO[suyas[0].celda.estado];
    /// ACCIONES Y NO RESERVAS: es la lectura acordada del «las 6»
    /// de su hoja, y por eso se cuentan las columnas con celda --una
    /// por acción-- y no las reservas de dentro. La misma acción en
    /// dos sedes son dos reservas y UNA acción.
    const cuantas = suyas.length;
    return (
      <span className={"whitespace-nowrap text-[0.75rem] font-semibold " + estado.clase}>
        {estado.texto}
        {cuantas > 1 && (
          /* «Confirmada las 6», SIN EL PUNTO DEL MEDIO: es como lo
             escribió el cliente en su hoja, y esta columna se coteja
             contra ella. El punto separaba dos cosas distintas; aquí
             no hay dos cosas, hay una frase. */
          <span className="font-normal text-texto-suave"> las {cuantas}</span>
        )}
      </span>
    );
  }

  return (
    <span className="flex flex-col gap-0.5 text-[0.75rem]">
      {suyas.map(({ accion, celda }) => (
        <span key={accion.accionFormacionId} className="whitespace-nowrap">
          <span className="font-mono text-texto-suave">{accion.codigo}</span>{" "}
          {celda.mixta ? (
            /// Las dos sedes, cada una con la suya: decir solo
            /// «Confirmada» escondería la cancelada de al lado.
            celda.reservas.map((r, i) => (
              <span key={r.reservaId}>
                {i > 0 && <span className="text-texto-suave"> · </span>}
                <span className={"font-semibold " + ETIQUETA_ESTADO[r.estado].clase}>
                  {ETIQUETA_ESTADO[r.estado].texto}
                </span>
              </span>
            ))
          ) : (
            <span className={"font-semibold " + ETIQUETA_ESTADO[celda.estado].clase}>
              {ETIQUETA_ESTADO[celda.estado].texto}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

export function ReservasUnificadas({
  datos,
  puedeEditar,
  alRefrescar,
  botones,
}: {
  datos: ReservasAgrupadas | null;
  puedeEditar: boolean;
  alRefrescar: () => void;
  /**
   * La descarga y el cargue, que son de la PANTALLA y no de la vista.
   *
   * «Debemos tener los mismos botones en las dos vistas» (cliente, 25
   * sep 2026). Vivían solo en «Por reserva» porque allí nacieron, y
   * al cambiar de vista desaparecían: el Excel que descargan es el
   * mismo fichero --una fila por reserva, del servidor-- y la
   * plantilla que cargan también, así que no había nada que
   * justificara que solo se pudieran usar desde una de las dos.
   *
   * Se reciben y no se construyen aquí para que sean LOS MISMOS y no
   * dos copias que se separan a la primera: los arma la pantalla, una
   * vez, y se los pasa a las dos.
   */
  botones?: ReactNode;
}) {
  const [abierta, setAbierta] = useState<FilaAgrupada | null>(null);

  const acciones = useMemo(() => datos?.acciones ?? [], [datos]);

  const columnas = useMemo<Columna<FilaAgrupada>[]>(() => {
    /// Las columnas AF se intercalan entre Formación y Entró por,
    /// que es donde estaba la de Formación que sustituyen.
    const deAcciones: Columna<FilaAgrupada>[] = acciones.map((a) => ({
      clave: "af:" + a.accionFormacionId,
      titulo: tituloDeAccion(a),
      numerica: true,
      filtro: "numero",
      /// Ordena y filtra por los cupos. Sin reserva va null y no
      /// cero: cero es un número que se ordena entre los demás, y
      /// «no reservó» no es «reservó cero».
      valor: (f) => {
        const celda = f.porAccion[a.accionFormacionId];
        if (!celda) return null;
        return celda.estado === "CANCELADA"
          ? celda.cuposSolicitados
          : celda.cuposConfirmados;
      },
      pinta: (f) => <Celda celda={f.porAccion[a.accionFormacionId]} />,
    }));

    return [
      {
        clave: "fechas",
        titulo: "Fechas",
        ancho: "190px",
        /// Ordena por la ÚLTIMA: es la que dice quién se movió hace
        /// poco. La primera va en el cajón.
        valor: (f) => f.ultimaReserva,
        /// SEPARADAS POR « / » Y NO UNA POR RENGLÓN. Estuvieron en
        /// renglones desde el 25 sep, y el modelo que entregó el
        /// cliente las trae en una sola línea --«07 de sept de 26 /
        /// 14 de sept de 26», su fila 8--. Con veintiuna columnas una
        /// fila de tres renglones triplica el alto de la tabla, que
        /// es justo lo que su modelo viene a arreglar.
        pinta: (f) => (
          <span className="text-texto-suave">{diasDeLaFila(f).join(" / ")}</span>
        ),
      },
      {
        clave: "nit",
        titulo: "NIT",
        ancho: "130px",
        valor: (f) => f.nit,
        pinta: (f) => (
          <span className="font-mono text-xs whitespace-nowrap text-texto-suave">
            {f.nit}
            {f.digitoVerificacion ? "-" + f.digitoVerificacion : ""}
          </span>
        ),
        filtro: "texto",
      },
      {
        clave: "organizacion",
        titulo: "Organización",
        fija: true,
        ancho: "280px",
        /// SIN EL NIT DEBAJO. Va en su propia columna, justo antes, y
        /// repetido en las dos era el mismo dato dos veces en la
        /// misma fila.
        valor: (f) => enMayusculas(f.razonSocial),
        pinta: (f) => <p className="font-medium">{enMayusculas(f.razonSocial)}</p>,
        filtro: "texto",
      },
      {
        clave: "contacto",
        titulo: "Contacto",
        ancho: "200px",
        /// Se buscan TODOS aunque solo se pinte el primero: si no,
        /// buscar a la segunda persona de una empresa no encontraba
        /// su fila aunque estuviera ahí.
        valor: (f) => f.contactos.map((c) => c.nombre + " " + c.correo).join(" "),
        /// SOLO EL NOMBRE: el correo tiene ahora su propia columna, y
        /// repetirlo debajo era el mismo dato dos veces en la fila.
        ///
        /// El resto de personas se cuenta ENTRE PARÉNTESIS --«(+1)»--
        /// porque así lo escribió el cliente en su hoja (filas 6, 8,
        /// 14 y 15). Sin ellos, «Ana Jaramillo +1» se lee como parte
        /// del nombre.
        pinta: (f) => {
          const primero = f.contactos[0];
          if (!primero) return <span className="text-texto-suave">—</span>;
          return (
            <p>
              {primero.nombre}
              {f.contactos.length > 1 && (
                <span
                  className="text-texto-suave"
                  title={f.contactos
                    .slice(1)
                    .map((c) => `${c.nombre} (${c.codigos.join(", ")})`)
                    .join("\n")}
                >
                  {" "}
                  (+{f.contactos.length - 1})
                </span>
              )}
            </p>
          );
        },
        filtro: "texto",
      },
      {
        clave: "correo",
        /// «DEL CONTACTO» EN EL RÓTULO, como sus dos vecinas: en el
        /// panel de Columnas salen sueltas, y ahí «Correo» a secas no
        /// dice de quién es.
        titulo: "Correo del contacto",
        ancho: "250px",
        valor: (f) => juntarValores(f.contactos.map((c) => c.correo)),
        pinta: (f) => <ListaDeContacto valores={f.contactos.map((c) => c.correo)} />,
        filtro: "texto",
      },
      {
        clave: "celular",
        titulo: "Celular del contacto",
        ancho: "190px",
        /// CON « / », como en su hoja (fila 6: «3194173564 /
        /// 3177912435»). Iba con coma, que es lo que escribe
        /// `join(", ")` por omisión y no lo que él entregó.
        valor: (f) => juntarValores(f.contactos.map((c) => c.celular)),
        pinta: (f) => (
          <span className="font-mono text-xs tabular-nums">
            <ListaDeContacto valores={f.contactos.map((c) => c.celular)} />
          </span>
        ),
        filtro: "texto",
      },
      {
        clave: "cargo",
        titulo: "Cargo del contacto",
        ancho: "250px",
        /// CON « ; » Y NO CON « / », y la diferencia es del cliente:
        /// un cargo puede llevar una barra dentro --«Directora
        /// Pedagógica y de Bilingüismo»-- y entonces no se sabría
        /// dónde acaba uno. Su hoja separa los cargos con punto y
        /// coma (fila 6) y los celulares con barra.
        valor: (f) => juntarValores(f.contactos.map((c) => c.cargo), " ; "),
        pinta: (f) => (
          <ListaDeContacto
            valores={f.contactos.map((c) => c.cargo)}
            separador=" ; "
          />
        ),
        filtro: "texto",
      },
      {
        clave: "estado",
        titulo: "Estado",
        ancho: "170px",
        /// El valor plano se filtra y se busca: lleva las palabras
        /// de todas, no solo las de la primera.
        valor: (f) =>
          [
            ...new Set(
              Object.values(f.porAccion)
                .flatMap((c) => c.reservas)
                .map((r) => ETIQUETA_ESTADO[r.estado].texto),
            ),
          ].join(", "),
        pinta: (f) => <EstadoDeLaFila fila={f} acciones={acciones} />,
        filtro: "opciones",
      },
      {
        clave: "cuposConfirmados",
        /// EL RÓTULO SE COPIA LETRA POR LETRA del Seguimiento de
        /// Control de Reservas: dos nombres para la misma cifra en
        /// dos pantallas que se miran seguidas es lo que hace dudar
        /// de las dos. Y es también el de su hoja.
        titulo: "Cupos reservados",
        ancho: "150px",
        numerica: true,
        valor: (f) => f.cuposConfirmados,
        filtro: "numero",
      },
      /* ── LA MITAD DERECHA DE SU MODELO ───────────────────────────
         De los cupos que apartó, cuántas personas aparecieron y qué
         se hizo con ellas. Las seis vienen CALCULADAS del servidor
         --`fila.leads`--, incluidas las dos que en su hoja son
         fórmulas: ver `CifrasDeLeads`.

         «Descartados» y «No contactable» están PENDIENTES de su
         fuente definitiva --las categorías de nota que otro proceso
         está construyendo-- y el criterio de hoy vive en un solo
         sitio del servidor. Aquí no se calcula nada: calculándolo,
         habría que cambiarlo en dos. */
      {
        clave: "leadsRecibidos",
        /// En minúscula, como en su hoja. La cabecera va en versalita
        /// por CSS, así que en pantalla se lee igual que las demás, y
        /// dejar su palabra tal cual es lo que permite cotejar esta
        /// tabla con el fichero que entregó.
        titulo: "leads recibidos",
        ancho: "150px",
        numerica: true,
        valor: (f) => leadsDe(f).leadsRecibidos,
        filtro: "numero",
      },
      {
        clave: "inscritos",
        /// «Cuantos inscritos», sin tilde: es como lo escribió él.
        titulo: "Cuantos inscritos",
        ancho: "165px",
        numerica: true,
        valor: (f) => leadsDe(f).inscritos,
        /// En verde, como «Cupos ocupados» en el Seguimiento: es la
        /// cifra buena de la fila y así se lee de un barrido.
        pinta: (f) => (
          <span
            className={`tabular-nums ${
              leadsDe(f).inscritos > 0 ? "font-semibold text-exito" : ""
            }`}
          >
            {leadsDe(f).inscritos}
          </span>
        ),
        filtro: "numero",
      },
      {
        clave: "descartados",
        titulo: "Descartados",
        ancho: "135px",
        numerica: true,
        valor: (f) => leadsDe(f).descartados,
        filtro: "numero",
      },
      {
        clave: "noContactable",
        titulo: "No contactable",
        ancho: "155px",
        numerica: true,
        valor: (f) => leadsDe(f).noContactable,
        filtro: "numero",
      },
      {
        clave: "totalGestionados",
        titulo: "Total lead gestionados",
        ancho: "200px",
        numerica: true,
        /// `inscritos + descartados + noContactable`, sumado en el
        /// servidor. En su hoja es `=K2+L2+M2`.
        valor: (f) => leadsDe(f).totalLeadGestionados,
        filtro: "numero",
      },
      {
        clave: "cuposPendientes",
        /// «Cupos pendientes» ES AHORA LA FÓRMULA DE SU HOJA
        /// --`cupos reservados − leads recibidos`-- y no los cupos
        /// sin persona, que es lo que decía hasta hoy. Aquella sigue
        /// estando, rebautizada «Cupos sin persona» y guardada en el
        /// panel de Columnas: son dos preguntas distintas y el nombre
        /// solo puede ser de una.
        titulo: "Cupos pendientes",
        ancho: "155px",
        numerica: true,
        valor: (f) => leadsDe(f).cuposPendientes,
        pinta: (f) => (
          <span
            className={`tabular-nums ${leadsDe(f).cuposPendientes > 0 ? "text-error" : ""}`}
          >
            {leadsDe(f).cuposPendientes}
          </span>
        ),
        filtro: "numero",
      },
      ...deAcciones,
      /* ── LAS QUE NO ESTÁN EN SU MODELO ──────────────────────────
         Se quedan, apagadas, en el panel de Columnas. Ninguna se
         borra: son cifras que alguien ya usaba --el Seguimiento se
         lee contra ellas-- y aquí nada se elimina, se oculta. Quien
         las quiera, las enciende. */
      {
        clave: "total",
        titulo: "Total reservas",
        aparte: true,
        ancho: "155px",
        numerica: true,
        valor: (f) => f.totalReservas,
        filtro: "numero",
      },
      {
        clave: "cuposOcupados",
        titulo: "Cupos ocupados",
        aparte: true,
        ancho: "155px",
        numerica: true,
        valor: (f) => f.conNombre,
        pinta: (f) => (
          <span
            className={`tabular-nums ${f.conNombre > 0 ? "font-semibold text-exito" : ""}`}
          >
            {f.conNombre}
          </span>
        ),
        filtro: "numero",
      },
      {
        clave: "sinPersona",
        /// SE LLAMABA «Cupos pendientes» y hubo que rebautizarla: el
        /// cliente usa ese nombre para otra resta (ver arriba). Ésta
        /// es la de siempre --cupos confirmados sin nadie detrás-- y
        /// la que alimenta el semáforo del plazo del Seguimiento.
        titulo: "Cupos sin persona",
        aparte: true,
        ancho: "175px",
        numerica: true,
        valor: (f) => f.sinNombre,
        pinta: (f) => (
          <span className={`tabular-nums ${f.sinNombre > 0 ? "text-error" : ""}`}>
            {f.sinNombre}
          </span>
        ),
        filtro: "numero",
      },
      {
        clave: "cuposEspera",
        titulo: "Cupos en espera",
        aparte: true,
        ancho: "165px",
        numerica: true,
        valor: (f) => f.cuposEnEspera,
        filtro: "numero",
      },
      {
        clave: "canceladas",
        /// «RESERVAS» Y NO «CUPOS», y no es un detalle: esta cifra
        /// cuenta reservas canceladas, no los cupos que llevaban.
        titulo: "Reservas canceladas",
        aparte: true,
        ancho: "200px",
        numerica: true,
        valor: (f) => f.reservasCanceladas,
        filtro: "numero",
      },
      {
        clave: "entroPor",
        titulo: "Entró por",
        aparte: true,
        ancho: "190px",
        valor: (f) => f.formularios.map((x) => x.titulo).join(" "),
        pinta: (f) => {
          const primero = f.formularios[0];
          if (!primero) return <span className="text-xs text-texto-suave">—</span>;
          return (
            <>
              <p className="max-w-44 truncate text-sm" title={primero.titulo}>
                {primero.titulo}
                {f.formularios.length > 1 && (
                  <span className="text-texto-suave"> +{f.formularios.length - 1}</span>
                )}
              </p>
              <p className="font-mono text-xs text-texto-suave">/{primero.slug}</p>
            </>
          );
        },
        filtro: "opciones",
      },
      {
        clave: "gremio",
        /// NO ES EL GREMIO DE LA RESERVA --ese es el del filtro de
        /// arriba-- sino la casilla «¿a qué red está asociada?» que
        /// la propia empresa marcó en el formulario. Llamándola
        /// «Gremio» parecía que el filtro no funcionaba: con
        /// ADECOPRIA puesto, la columna decía BRITCHAM (cliente, 25
        /// sep 2026).
        titulo: "Red asociada",
        aparte: true,
        ancho: "175px",
        valor: (f) =>
          f.redAsociada === "Otro" ? (f.redAsociadaOtra ?? "Otro") : (f.redAsociada ?? ""),
        filtro: "opciones",
      },
    ];
  }, [acciones]);

  const filas = datos?.filas ?? null;
  const cargadas = filas ?? [];
  const cuposApartados = cargadas.reduce((t, f) => t + f.cuposConfirmados, 0);
  const cuposEnEspera = cargadas.reduce((t, f) => t + f.cuposEnEspera, 0);
  const reservas = cargadas.reduce((t, f) => t + f.totalReservas, 0);
  const canceladas = cargadas.reduce((t, f) => t + f.reservasCanceladas, 0);
  /// Cuántas reservas están esperando, para el pie de su tarjeta. Se
  /// cuentan reservas y no filas: una organización puede tener una
  /// acción confirmada y otra en espera.
  /// LAS RESERVAS QUE APORTAN ESOS CUPOS, no solo las que están en
  /// estado de espera: la tarjeta sumaba cupos de siete reservas y el
  /// pie decía «en 2 reservas», porque contaba únicamente las
  /// LISTA_ESPERA. Un pie que no cuadra con su cifra hace dudar de la
  /// cifra.
  const reservasEnEspera = cargadas.reduce(
    (t, f) =>
      t +
      Object.values(f.porAccion).reduce(
        (n, c) => n + c.reservas.filter((r) => r.cuposEnEspera > 0).length,
        0,
      ),
    0,
  );
  /// Cuántas apartaron más de una acción: es el dato que explica por
  /// qué esta pantalla existe.
  /// CUENTA ACCIONES, NO RESERVAS, que es lo que dice el rótulo.
  ///
  /// Contaba `totalReservas > 1` y el pie decía «con más de una
  /// acción»: dos reservas en la MISMA acción ---la misma empresa que
  /// aparta cupos dos veces para el mismo curso--- se contaban como
  /// dos acciones. Decía 24 donde la base dice 22.
  const conVarias = cargadas.filter(
    (f) => Object.keys(f.porAccion).length > 1,
  ).length;

  /// La fila abierta se vuelve a tomar de los datos vivos: si no, al
  /// cambiar un estado el cajón seguiría enseñando el de antes hasta
  /// cerrarlo y volver a abrirlo.
  const enElCajon = abierta
    ? (cargadas.find((f) => f.empresaId === abierta.empresaId) ?? abierta)
    : null;

  return (
    <>
      {cargadas.length > 0 && (
        <div className="flex flex-wrap items-stretch gap-2">
          <Cifra
            etiqueta="Organizaciones"
            valor={datos?.total ?? cargadas.length}
            pie={
              conVarias > 0
                ? `${conVarias} con más de una acción`
                : "una acción cada una"
            }
          />
          <Cifra etiqueta="Reservas" valor={reservas} pie="repartidas entre ellas" />
          <Cifra
            etiqueta="Cupos apartados"
            valor={cuposApartados}
            pie="en reservas confirmadas"
            color={cuposApartados > 0 ? "var(--exito)" : undefined}
          />
          <Cifra
            etiqueta="Cupos en espera"
            valor={cuposEnEspera}
            /// EL MISMO PIE QUE LA OTRA VISTA. La tarjeta cuenta
            /// cupos y el pie dice en cuántas reservas están: así
            /// las dos cifras que el cliente vio distintas --6 y
            /// 1-- salen juntas y se entiende que no se
            /// contradicen.
            pie={
              reservasEnEspera > 0
                ? `en ${reservasEnEspera} ${reservasEnEspera === 1 ? "reserva" : "reservas"}`
                : "ninguno esperando"
            }
            color={cuposEnEspera > 0 ? "var(--aviso)" : undefined}
          />
          <Cifra
            etiqueta="Reservas canceladas"
            valor={canceladas}
            pie={canceladas > 0 ? "sus cupos volvieron a la oferta" : "ninguna cancelada"}
            color={canceladas > 0 ? "var(--error)" : undefined}
          />
        </div>
      )}

      {datos?.truncado && (
        <Aviso tipo="error">
          Hay más organizaciones de las que caben en esta vista. Se están enseñando las{" "}
          {cargadas.length} con más cupos apartados; para verlas todas, use el listado por
          reserva o la descarga en Excel.
        </Aviso>
      )}

      {/* LA TABLA NO SE MONTA HASTA QUE LLEGAN LOS DATOS, y no es
          por estética.

          Las columnas AF salen del servidor, así que en el primer
          pintado no existen. La tabla guarda su juego de columnas en
          cuanto monta —para recordar cuáles se dejaron puestas— y las
          que aparecen DESPUÉS las trata como recién añadidas, que por
          diseño van al final. Resultado: Fechas, Organización,
          Contacto, Entró por, Total, Estado… y las ocho AF detrás,
          justo donde no sirven.

          Montándola ya con los datos, su primer juego de columnas es
          el completo y el orden es el declarado. Si más adelante
          alguien reserva una acción nueva, esa sí sale al final una
          vez, que es lo que la tabla quiere hacer. */}
      {datos === null ? (
        <Cargando que="Cargando las reservas…" />
      ) : (
        <Tabla
          /// EL «-2» NO ES CAPRICHO. La tabla guarda en el navegador
          /// qué columnas se dejaron puestas Y EN QUÉ ORDEN, y lo
          /// guardado reemplaza a lo de por defecto: quien ya hubiera
          /// tocado el panel de Columnas seguiría viendo el orden
          /// viejo por mucho que aquí se declare otro. Cambiando la
          /// llave, todo el mundo empieza por el orden nuevo.
          /// EL NOMBRE CAMBIA, Y ESO ES EL ARREGLO (cliente, 30 sep
          /// 2026: «por organización no está la tabla como te indiqué
          /// en el documento»).
          ///
          /// La tabla guarda en el navegador QUÉ columnas se ven y EN
          /// QUÉ ORDEN. Quien ya había usado esta pantalla tenía
          /// guardado el orden viejo, así que las quince columnas
          /// nuevas del modelo le salían AÑADIDAS AL FINAL ---él vio
          /// la tabla empezando por «AF7» y «Entró por»--- en vez de
          /// en el orden de su hoja. El modelo estaba bien; lo que
          /// mandaba era lo guardado.
          ///
          /// Cambiar el nombre hace que todos empiecen de cero con el
          /// orden declarado. Lo que cada quien hubiera acomodado se
          /// queda bajo el nombre viejo, sin estorbar: no se pierde,
          /// se jubila. Es el precio de rehacer una tabla entera, y es
          /// barato comparado con que nadie vea el modelo que pidió.
          id="reservas-por-organizacion-modelo"
          columnas={columnas}
          filas={filas}
          clave={(f) => f.empresaId}
          alClic={setAbierta}
          sinDescarga
          acciones={botones}
          vacio="Aparecerán en cuanto alguien reserve desde un formulario."
        />
      )}

      {enElCajon && (
        <CajonDeLaOrganizacion
          fila={enElCajon}
          acciones={acciones}
          puedeEditar={puedeEditar}
          alCerrar={() => setAbierta(null)}
          alCambiar={alRefrescar}
        />
      )}
    </>
  );
}

/**
 * El cajón de una organización: sus datos y sus reservas, una por
 * acción, cada una con su estado editable.
 *
 * El estado se edita AQUÍ y no en la tabla porque es de la reserva,
 * no de la organización: una empresa con cuatro AF tiene cuatro
 * estados, y un control en la fila no sabría a cuál de los cuatro
 * le está hablando.
 */
function CajonDeLaOrganizacion({
  fila,
  acciones,
  puedeEditar,
  alCerrar,
  alCambiar,
}: {
  fila: FilaAgrupada;
  acciones: ColumnaAccion[];
  puedeEditar: boolean;
  alCerrar: () => void;
  alCambiar: () => void;
}) {
  const suyas = acciones
    .filter((a) => fila.porAccion[a.accionFormacionId])
    .map((a) => ({ accion: a, celda: fila.porAccion[a.accionFormacionId] }));

  return (
    <Cajon
      titulo={bonito(fila.razonSocial)}
      subtitulo={
        <>
          {fila.nit}
          {fila.digitoVerificacion ? "-" + fila.digitoVerificacion : ""} ·{" "}
          {fila.totalReservas === 1
            ? `reservó el ${fecha(fila.ultimaReserva)}`
            : `${fila.totalReservas} reservas, ${diasDeLaFila(fila).join(" · ")}`}
        </>
      }
      alCerrar={alCerrar}
    >
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Dato titulo="Cupos reservados" valor={String(fila.cuposConfirmados)} />
        <Dato titulo="Cupos ocupados" valor={String(fila.conNombre)} />
        {/* EL MISMO NOMBRE QUE EN LA TABLA. «Cupos pendientes» es
            ahora la resta de su hoja --cupos menos leads-- y esta es
            la de siempre; con el nombre viejo, el cajón y la columna
            dirían cifras distintas bajo el mismo rótulo. */}
        <Dato
          titulo="Cupos sin persona"
          valor={String(fila.sinNombre)}
          pie={fila.sinNombre > 0 ? "cupos que siguen sin nombre" : undefined}
        />
        <Dato
          titulo="Cupos pendientes"
          valor={String(leadsDe(fila).cuposPendientes)}
          pie="cupos reservados menos leads recibidos"
        />
        <Dato titulo="leads recibidos" valor={String(leadsDe(fila).leadsRecibidos)} />
        <Dato
          titulo="Total lead gestionados"
          valor={String(leadsDe(fila).totalLeadGestionados)}
          /// El desglose en el pie y no en tres datos más: es la
          /// suma de los tres y leerla al lado es lo que explica de
          /// dónde sale.
          pie={`${leadsDe(fila).inscritos} inscritos · ${leadsDe(fila).descartados} descartados · ${leadsDe(fila).noContactable} no contactables`}
        />
        <Dato
          titulo="Cupos en espera"
          valor={fila.cuposEnEspera > 0 ? String(fila.cuposEnEspera) : null}
        />
        <Dato
          titulo="Colaboradores"
          valor={fila.numeroColaboradores?.toString() ?? null}
        />
        <Dato
          titulo="Red asociada"
          valor={
            fila.redAsociada === "Otro"
              ? "Otro: " + (fila.redAsociadaOtra ?? "sin especificar")
              : fila.redAsociada
          }
        />
      </dl>

      <h3 className="mt-7 text-sm font-semibold">
        {fila.contactos.length === 1 ? "Contacto" : "Contactos"}
      </h3>
      {/* Van todos y con sus acciones al lado: el contacto es de la
          reserva --«quien diligencia, distinto en cada curso»--, así
          que una empresa con cuatro AF puede traer cuatro personas, y
          enseñar solo la primera escondería a las otras tres. */}
      <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {fila.contactos.map((c) => (
          <Dato
            key={c.correo}
            titulo={
              fila.contactos.length > 1 ? `${c.nombre} · ${c.codigos.join(", ")}` : c.nombre
            }
            valor={
              <>
                <span className="block">{c.correo}</span>
                {c.celular && <span className="block text-texto-suave">{c.celular}</span>}
                {c.cargo && <span className="block text-texto-suave">{c.cargo}</span>}
              </>
            }
          />
        ))}
      </dl>

      <h3 className="mt-7 text-sm font-semibold">
        {fila.totalReservas === 1 ? "Su reserva" : `Sus ${fila.totalReservas} reservas`}
      </h3>
      {/* Una tarjeta por RESERVA y no por acción: la misma acción en
          dos sedes son dos reservas con su propio cupo y su propio
          estado, y un solo control no sabría a cuál de las dos le
          habla. El código de la acción se repite, que es justo lo que
          hay que ver. */}
      <div className="mt-3 flex flex-col gap-3">
        {suyas.flatMap(({ accion, celda }) =>
          celda.reservas.map((r) => (
            <ReservaDeLaAccion
              key={r.reservaId}
              accion={accion}
              reserva={r}
              puedeEditar={puedeEditar}
              alCambiar={alCambiar}
            />
          )),
        )}
      </div>
    </Cajon>
  );
}

/**
 * Una reserva dentro del cajón, con su estado editable.
 *
 * DE DÓNDE SALE «Confirmada / Cancelada», que es lo que preguntó el
 * cliente: hasta ahora, de ninguna mano. Lo decidía el cupo al
 * crearla --`confirmados > 0 ? CONFIRMADA : LISTA_ESPERA`-- y solo
 * se movía solo. Ahora se puede pedir, pero lo que queda lo siguen
 * decidiendo los cupos: confirmar sobre una oferta llena devuelve
 * «En espera» y se dice. Escribir la etiqueta a secas daría una
 * reserva confirmada sin cupo detrás, o sea cupos que no existen en
 * ninguna parte y que el informe del SENA sumaría igual.
 */
function ReservaDeLaAccion({
  accion,
  reserva,
  puedeEditar,
  alCambiar,
}: {
  accion: ColumnaAccion;
  reserva: ReservaEnCelda;
  puedeEditar: boolean;
  alCambiar: () => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const estado = ETIQUETA_ESTADO[reserva.estado];

  const cambiar = useCallback(
    async (pedido: string) => {
      if (pedido === reserva.estado) return;
      setError(null);
      setNota(null);
      setGuardando(true);
      try {
        const hecho = await tablerosApi.cambiarEstadoReserva(
          reserva.reservaId,
          pedido as EstadoReserva,
        );
        /// Se dice cuándo lo pedido y lo que quedó no coinciden: si
        /// no, el desplegable se queda en «Confirmada», la fila sale
        /// «En espera» y parece que no funcionó.
        if (hecho.recortado) {
          setNota(
            `No había cupos libres en ${accion.codigo}, así que quedó en espera con ` +
              `${hecho.cuposEnEspera} ${hecho.cuposEnEspera === 1 ? "cupo" : "cupos"}.`,
          );
        } else if (pedido === "CANCELADA") {
          setNota("Cancelada. Sus cupos volvieron a la oferta.");
        } else if (pedido === "CONFIRMADA") {
          setNota(
            `Confirmada con ${hecho.cuposConfirmados} ` +
              `${hecho.cuposConfirmados === 1 ? "cupo" : "cupos"}.`,
          );
        } else {
          setNota("Pasó a espera. Sus cupos volvieron a la oferta.");
        }
        alCambiar();
      } catch (e) {
        setError(
          e instanceof ErrorApi ? e.message : "No se pudo cambiar el estado.",
        );
      } finally {
        setGuardando(false);
      }
    },
    [accion.codigo, alCambiar, reserva.estado, reserva.reservaId],
  );

  return (
    <div className="rounded-[10px] border border-borde p-3">
      <p className="text-sm font-medium">
        <span className="font-mono text-xs text-texto-suave">{accion.codigo}</span>{" "}
        {bonito(accion.nombre)}
      </p>
      <p className="mt-0.5 text-xs text-texto-suave">
        {bonito(reserva.ubicacion)} · {reserva.modalidad.toLowerCase()} · reservó el{" "}
        {fecha(reserva.creadoEn)}
        {reserva.formulario && <> · por /{reserva.formulario.slug}</>}
      </p>

      {/* CINCO Y NO TRES. Esta tarjeta ya lleva su acción en la
          cabecera, así que es donde «de qué AF» se responde entero sin
          que la tabla crezca: aquí los ocupados y los pendientes son
          los de ESA acción en ESA sede.

          Sin el prefijo «Cupos» que sí llevan las columnas: dentro de
          la tarjeta las cinco cifras son cupos de la misma reserva, y
          repetir la palabra cinco veces es ruido. */}
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-3">
        <Dato titulo="Solicitados" valor={String(reserva.cuposSolicitados)} />
        <Dato titulo="Confirmados" valor={String(reserva.cuposConfirmados)} />
        <Dato
          titulo="En espera"
          valor={reserva.cuposEnEspera > 0 ? String(reserva.cuposEnEspera) : null}
        />
        <Dato titulo="Ocupados" valor={String(reserva.conNombre)} />
        <Dato
          titulo="Pendientes"
          valor={String(reserva.sinNombre)}
          pie={reserva.sinNombre > 0 ? "sin nombre todavía" : undefined}
        />
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[0.75rem] text-texto-suave">Estado</span>
        {puedeEditar ? (
          <Desplegable
            valor={reserva.estado}
            etiquetaAria={`Estado de la reserva en ${accion.codigo}`}
            desactivado={guardando}
            opciones={ESTADOS.map((e) => ({
              valor: e,
              etiqueta: ETIQUETA_ESTADO[e].texto,
              detalle:
                e === "CONFIRMADA"
                  ? "Toma los cupos que haya libres"
                  : e === "LISTA_ESPERA"
                    ? "Suelta sus cupos y espera turno"
                    : "Devuelve sus cupos a la oferta",
            }))}
            alElegir={cambiar}
          />
        ) : (
          <span className={"text-[0.75rem] font-semibold " + estado.clase}>
            {estado.texto}
          </span>
        )}
        {reserva.canceladaEn && reserva.estado === "CANCELADA" && (
          <span className="text-xs text-texto-suave">
            el {fecha(reserva.canceladaEn)}
          </span>
        )}
      </div>

      {nota && <p className="mt-2 text-xs text-texto-suave">{nota}</p>}
      {error && (
        <p className="mt-2 text-xs text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
