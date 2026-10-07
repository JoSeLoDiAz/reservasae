import Link from "next/link";

import {
  ETIQUETA_ESTADO_LEAD,
  COLOR_ESTADO_LEAD,
  type EstadoLead,
  type LeadDeLaMesa,
} from "@/lib/mesa-api";

import type { Columna } from "./tabla";

/**
 * LAS COLUMNAS DE UN LEAD, PARA LA TABLA DE LA CASA.
 *
 * «¿Pero queda como la visual de Gestión de leads?» (cliente, 6 oct
 * 2026), preguntado tres veces, y la respuesta era que no: BBDD Leads
 * y la Mesa pintaban a mano una tabla de seis columnas fijas, sin
 * elegir columnas, sin filtros por columna, sin vistas guardadas, sin
 * ordenar y sin Excel. Gestión de leads usa `Tabla`, que trae las seis
 * cosas.
 *
 * Esto es lo que faltaba para que las dos pantallas puedan usarla: un
 * lead no es una ficha ---no tiene etapa, ni avance, ni empresa--- así
 * que necesita sus propias columnas.
 *
 * NO SE COPIAN LAS DE PARTICIPANTE. Se parecen, y por eso hay que
 * decirlo: media docena de aquellas columnas pedirían datos que un
 * lead no tiene, y una columna que siempre sale en raya ocupa sitio y
 * enseña a no mirar la tabla.
 */

/// En hora de BOGOTÁ y no en la del navegador, por lo mismo que en
/// `columnas-participante`: basta un portátil con la zona cambiada
/// para que dos personas lean horas distintas del mismo lead y una de
/// las dos decida mal.
function fechaHora(valor: string | null): string {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * LA MISMA FECHA PARA ORDENAR Y PARA EL EXCEL.
 *
 * Es la lección que costó un día entero en la otra tabla: el archivo
 * se arma con `valor` y la pantalla con `pinta`, y si solo `pinta`
 * traduce la hora, todo lo que entre entre las 7 de la noche y
 * medianoche sale en el Excel con la fecha del día siguiente.
 */
function paraOrdenar(valor: string | null): string {
  if (!valor) return "";
  const d = new Date(valor);
  const bogota = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  return bogota.toISOString().replace("T", " ").slice(0, 16);
}

const raya = <span className="text-texto-suave">—</span>;

/// Lo que se enseña cuando un dato no vino. Función y no constante
/// porque React pide una clave distinta por celda.
const oRaya = (v: string | null | undefined) =>
  v ? <span className="block truncate">{v}</span> : raya;

export function columnasDeLead(): Array<Columna<LeadDeLaMesa>> {
  return [
    {
      clave: "nombre",
      titulo: "Nombre",
      ancho: "210px",
      /// FIJA al desplazar, igual que en Gestión de leads: con veinte
      /// columnas, perder de vista de quién es la fila obliga a volver
      /// al principio en cada salto.
      fija: true,
      valor: (l) => l.nombre,
      pinta: (l) => <span className="font-medium">{l.nombre}</span>,
      filtro: "texto",
    },
    {
      clave: "documento",
      titulo: "Documento",
      ancho: "150px",
      valor: (l) => l.documento ?? "",
      pinta: (l) => oRaya(l.documento),
      filtro: "texto",
    },
    {
      clave: "correo",
      titulo: "Correo",
      ancho: "215px",
      valor: (l) => l.correo ?? "",
      pinta: (l) => oRaya(l.correo),
      filtro: "texto",
    },
    {
      clave: "celular",
      titulo: "Celular",
      ancho: "140px",
      valor: (l) => l.celular ?? "",
      pinta: (l) => oRaya(l.celular),
      filtro: "texto",
    },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "126px",
      valor: (l) => ETIQUETA_ESTADO_LEAD[l.estado],
      pinta: (l) => (
        <span
          className="rounded-md px-2 py-0.5 text-xs font-semibold"
          style={{
            background: `color-mix(in oklab, ${COLOR_ESTADO_LEAD[l.estado]} 16%, transparent)`,
            color: COLOR_ESTADO_LEAD[l.estado],
          }}
        >
          {ETIQUETA_ESTADO_LEAD[l.estado]}
        </span>
      ),
      filtro: "opciones",
    },
    {
      /**
       * QUÉ LE FALTA PARA PODER SER FICHA, y lo dice el servidor.
       *
       * Es la columna que contesta «¿por qué no puedo convertir a
       * esta?» sin abrir el cajón. Calcularlo aquí sería una segunda
       * verdad: se encendería en un lead que el servidor va a
       * rechazar.
       */
      clave: "falta",
      titulo: "Le falta",
      ancho: "190px",
      valor: (l) => l.falta.join(", "),
      pinta: (l) =>
        l.falta.length === 0 ? (
          <span className="text-exito">Listo</span>
        ) : (
          <span className="block truncate text-aviso">
            {l.falta.join(", ")}
          </span>
        ),
      filtro: "opciones",
    },
    {
      clave: "asesor",
      titulo: "Asesor",
      ancho: "160px",
      valor: (l) => l.asesor?.nombre ?? "",
      pinta: (l) =>
        l.asesor ? (
          <span className="block truncate">{l.asesor.nombre}</span>
        ) : (
          <span className="text-texto-suave">Sin asignar</span>
        ),
      filtro: "opciones",
    },
    {
      clave: "curso",
      titulo: "Acción de formación",
      ancho: "200px",
      valor: (l) => l.curso ?? "",
      pinta: (l) => oRaya(l.curso),
      filtro: "opciones",
    },
    {
      /// LO QUE PIDIÓ EN SUS PALABRAS, que no es lo mismo que el
      /// curso: el curso es lo que se reconoció del catálogo, y esto
      /// es lo que la persona escribió. Cuando no casan, la respuesta
      /// está aquí.
      clave: "pidio",
      titulo: "Qué pidió",
      ancho: "200px",
      valor: (l) => l.pidio ?? "",
      pinta: (l) => oRaya(l.pidio),
      filtro: "texto",
    },
    {
      /**
       * DÓNDE VIVE. Dos columnas y no una, porque filtran distinto:
       * el departamento es con lo que se reparte el trabajo entre
       * asesoras, y la ciudad es lo que decide si le queda cerca.
       *
       * «Si tengo departamento no queda ni nada» (cliente, 7 oct
       * 2026): el dato se cargaba y no tenía dónde salir.
       *
       * Van ANTES de la sede a propósito: la sede se DEDUCE de
       * aquí, así que leer «CESAR → sin cobertura» explica solo lo
       * que de otro modo parece un fallo.
       */
      clave: "departamento",
      titulo: "Departamento",
      ancho: "160px",
      valor: (l) => l.departamento ?? "",
      pinta: (l) => oRaya(l.departamento),
      filtro: "opciones",
    },
    {
      clave: "ciudad",
      titulo: "Ciudad o municipio",
      ancho: "170px",
      valor: (l) => l.ciudad ?? "",
      pinta: (l) => oRaya(l.ciudad),
      filtro: "opciones",
    },
    {
      clave: "sede",
      titulo: "Sede que le tocaría",
      ancho: "170px",
      valor: (l) => l.sede ?? "",
      pinta: (l) =>
        l.sede ? (
          <span className="block truncate">{l.sede}</span>
        ) : (
          /// Null NO es «no se sabe»: es que su departamento no tiene
          /// ese curso, así que no se la puede inscribir. Decirlo
          /// ahorra el viaje de intentarlo.
          <span className="text-aviso">Sin cobertura</span>
        ),
      filtro: "opciones",
    },
    {
      clave: "gremio",
      titulo: "Gremio",
      ancho: "124px",
      valor: (l) => l.gremio,
      filtro: "opciones",
    },
    {
      clave: "origen",
      titulo: "Origen",
      ancho: "150px",
      valor: (l) => l.origen,
      filtro: "opciones",
    },
    {
      /// POR DÓNDE ENTRÓ: el sistema que lo mandó. Separa lo que
      /// llegó solo de lo que se subió en un archivo, que es la
      /// pregunta de BBDD Leads.
      clave: "porDonde",
      titulo: "Entró por",
      ancho: "150px",
      valor: (l) => l.porDonde,
      filtro: "opciones",
    },
    {
      clave: "gestiones",
      titulo: "Gestiones",
      ancho: "104px",
      numerica: true,
      valor: (l) => l.gestiones,
    },
    {
      clave: "ultimaGestionEn",
      titulo: "Última gestión",
      ancho: "160px",
      valor: (l) => paraOrdenar(l.ultimaGestionEn),
      pinta: (l) => <span className="tabular-nums">{fechaHora(l.ultimaGestionEn)}</span>,
    },
    {
      clave: "recibidoEn",
      titulo: "Cargada",
      ancho: "160px",
      valor: (l) => paraOrdenar(l.recibidoEn),
      pinta: (l) => <span className="tabular-nums">{fechaHora(l.recibidoEn)}</span>,
    },
    {
      /**
       * SI SE LE PUEDE ESCRIBIR O LLAMAR. La regla vive en el
       * servidor y esto solo la pinta: `POST /notas` la vuelve a
       * aplicar, así que una columna optimista no deja contactar a
       * nadie que no se pueda.
       */
      clave: "puedoContactar",
      titulo: "Se le puede contactar",
      ancho: "160px",
      valor: (l) =>
        l.puedoContactar === "SI"
          ? "Sí"
          : l.puedoContactar === "REVOCO"
            ? "Revocó"
            : "Ya tiene ficha",
      pinta: (l) =>
        l.puedoContactar === "SI" ? (
          <span className="text-exito">Sí</span>
        ) : (
          <span className="text-aviso">
            {l.puedoContactar === "REVOCO" ? "Revocó" : "Ya tiene ficha"}
          </span>
        ),
      filtro: "opciones",
    },
    {
      /// EL SALTO A SU FICHA, cuando ya la tiene. Es lo que cierra el
      /// recorrido: de la base cargada a la persona en Gestión de
      /// leads, sin buscarla a mano.
      clave: "participanteId",
      titulo: "Ficha",
      ancho: "110px",
      valor: (l) => (l.participanteId ? "Sí" : ""),
      pinta: (l) =>
        l.participanteId ? (
          <Link
            href={`/admin/participantes/${l.participanteId}`}
            className="underline"
            /// Que pulsar el enlace no abra además el cajón de la
            /// fila: son dos destinos y el de abajo gana por ser el
            /// de la fila entera.
            onClick={(e) => e.stopPropagation()}
          >
            Ver ficha
          </Link>
        ) : (
          raya
        ),
      filtro: "opciones",
    },
  ];
}

/// Para que el tipo de `EstadoLead` no se quede sin usar si algún día
/// se quitan las píldoras: es el que gobierna las dos listas de
/// arriba, y perderlo de vista deja la columna sin red.
export type EstadoDeLead = EstadoLead;
