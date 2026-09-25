"use client";

/**
 * LAS COLUMNAS DE «SEGUIMIENTO DEL AULA».
 *
 * «Prácticamente es como la tabla de Gestión de leads, donde es su
 * mismo esquema: filtros por columnas, agregar o quitar columnas,
 * toda la misma lógica; solo que acá no van botones como importar,
 * asignar masivo y demás» (cliente, 24 sep 2026).
 *
 * Por eso esto es SOLO una lista de columnas y no una tabla: la tabla
 * es `Tabla`, la misma de Gestión de leads, y con ella vienen de
 * balde el buscador, los filtros por columna, el selector de columnas
 * y que la selección se recuerde. Los botones no se quitan: es que no
 * se le pasan.
 */

import type { ReactNode } from "react";

import { colorEtapa } from "@/components/admin/etapa";
import type { Columna } from "@/components/admin/tabla";
import { fechaDeCalendario } from "@/lib/dia-de-calendario";
import {
  AYUDA_ACADEMICA,
  ETIQUETA_ACADEMICA,
  type EstadoAcademico,
  type FilaAcademica,
} from "@/lib/crm-api";

const COLOR: Record<EstadoAcademico, string> = {
  SIN_INGRESO: colorEtapa("PERDIDO"),
  SIN_EMPEZAR: colorEtapa("CONTACTADO"),
  ATRASADO: colorEtapa("EN_FORMACION"),
  AL_DIA: colorEtapa("CERTIFICADO"),
  COMPLETADO: colorEtapa("INSCRITO"),
  CERTIFICADO: colorEtapa("CERTIFICADO"),
};

/// «Sí» y «No», que es como el cliente escribió sus dos columnas de
/// bandera. Como texto y no como icono: así el filtro de la columna
/// ofrece las dos opciones solo, y lo que se ve es lo que se filtra.
const siNo = (v: boolean) => (v ? "Sí" : "No");

function instante(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Pildora({ estado }: { estado: EstadoAcademico }): ReactNode {
  return (
    <span
      style={{ ["--etapa"]: COLOR[estado] } as React.CSSProperties}
      className="pildora-etapa"
      title={AYUDA_ACADEMICA[estado]}
    >
      {ETIQUETA_ACADEMICA[estado]}
    </span>
  );
}

/**
 * LAS SEIS DEL LMS. Ni una más.
 *
 * «Son solo 6 actividades que traerá el LMS, y es lo que importa; las
 * 12 no aplican para este módulo» (cliente, 24 sep 2026). Lo dijo dos
 * veces, y las dos primeras veces yo saqué las columnas de los datos
 * --que hoy traen doce, porque la siembra pone las mismas doce
 * genéricas en todos los cursos-- convencido de que era «más
 * correcto». No lo era: la tabla es para sus seis, y lo que se ve
 * mandaba sobre mi razonamiento.
 *
 * MIENTRAS EL LMS NO ESTÉ CONECTADO, ESTAS SEIS SALEN EN RAYA, y eso
 * es lo honesto: no hay dato que poner. No se rellenan con lo que
 * haya por parecerse; una «Encuesta de caracterización» no es UT1.
 *
 * Se casan por TÍTULO y no por orden: el orden con el que el LMS las
 * devuelva no tiene por qué ser 1..6, y casar por posición es lo que
 * hace que un día UT3 enseñe lo de UT4 sin que nada falle.
 *
 * LAS CINCO UT SON LAS QUE CUENTAN PARA CERTIFICAR --«mínimo se debe
 * llevar al participante a la cuarta actividad»-- y EVAL FINAL va con
 * ellas pero no decide el mínimo. Eso lo dice `esUT`.
 */
const DEL_LMS = [
  { clave: "UT1", esUT: true },
  { clave: "UT2", esUT: true },
  { clave: "UT3", esUT: true },
  { clave: "UT4", esUT: true },
  { clave: "UT5", esUT: true },
  { clave: "EVAL FINAL", esUT: false },
] as const;

/// Sin tildes, sin espacios de más y en mayúscula: el LMS puede
/// devolver «Eval Final», «UT 1» o «ut1», y las tres son la misma.
const comoSeLlama = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

function columnasDeActividades(): Columna<FilaAcademica>[] {
  return DEL_LMS.map(({ clave }) => {
    const buscada = comoSeLlama(clave);
    const suya = (f: FilaAcademica) =>
      (f.actividades ?? []).find((a) => comoSeLlama(a.titulo) === buscada);

    return {
      clave: `act:${clave}`,
      titulo: clave,
      ancho: "116px",
      filtro: "opciones" as const,
      opciones: ["Completada", "-"],
      valor: (f: FilaAcademica) => {
        const a = suya(f);
        return a ? (a.completada ? "Completada" : "-") : "-";
      },
      pinta: (f: FilaAcademica) => {
        const a = suya(f);
        return a?.completada ? (
          <span className="text-exito">Completada</span>
        ) : (
          <span className="text-texto-suave">-</span>
        );
      },
    };
  });
}

export function columnasDelAula(): Columna<FilaAcademica>[] {
  return [
    {
      clave: "accion",
      titulo: "Acción de formación",
      ancho: "230px",
      valor: (f) => f.accion,
      filtro: "opciones",
      /// EL NOMBRE ENTERO EN EL `title` Y UN TOPE DE ANCHO EN LA
      /// CELDA. Son noventa letras, y sin el tope esta columna se
      /// llevaba 700 px de la tabla y empujaba las de actividad fuera
      /// de la pantalla. El `ancho` de arriba no basta: esta tabla
      /// deja arrastrar los anchos, así que aquello es una pista
      /// inicial y no un límite.
      ///
      /// `truncate` necesita una anchura de la que colgar; en un `td`
      /// que crece con su contenido no recorta nada, y por eso va con
      /// `max-w` y no solo con la clase.
      pinta: (f) => (
        <span
          className="block max-w-[22rem] truncate"
          title={f.accion ?? undefined}
        >
          {f.accion ?? "—"}
        </span>
      ),
    },
    {
      clave: "grupo",
      titulo: "Grupo",
      ancho: "92px",
      valor: (f) => (f.grupo === null ? "" : `Grupo ${f.grupo}`),
      filtro: "opciones",
    },
    {
      clave: "correo",
      titulo: "Correo",
      ancho: "215px",
      valor: (f) => f.correo,
      filtro: "texto",
    },
    {
      clave: "documento",
      titulo: "Número de documento",
      ancho: "150px",
      fija: true,
      valor: (f) => f.documento,
      filtro: "texto",
      pinta: (f) => <span className="font-mono text-xs">{f.documento}</span>,
    },
    {
      clave: "nombre",
      titulo: "Nombre completo",
      ancho: "205px",
      fija: true,
      valor: (f) => f.nombre,
      filtro: "texto",
      pinta: (f) => <span className="font-medium">{f.nombre}</span>,
    },
    {
      /// LAS DOS BANDERAS, y por qué son dos y no una.
      ///
      /// «Sin ingreso» es que nunca entró al aula; «sin actividades»
      /// es que entró y no hizo nada. Se arreglan de maneras
      /// distintas --a uno se le reenvía la clave y al otro se le
      /// empuja-- y por eso el cliente las pidió separadas.
      clave: "sinIngreso",
      titulo: "Sin ingreso",
      ancho: "104px",
      valor: (f) => siNo(f.ultimoAcceso === null),
      filtro: "opciones",
      opciones: ["Sí", "No"],
    },
    {
      clave: "sinActividades",
      titulo: "Sin actividades",
      ancho: "118px",
      valor: (f) => siNo(f.hechas === 0),
      filtro: "opciones",
      opciones: ["Sí", "No"],
    },
    ...columnasDeActividades(),
    {
      clave: "hechas",
      titulo: "Total actividades",
      ancho: "128px",
      numerica: true,
      valor: (f) => f.hechas,
    },
    {
      clave: "porcentaje",
      titulo: "% avance",
      ancho: "98px",
      numerica: true,
      valor: (f) => f.porcentaje,
      pinta: (f) => <span className="tabular-nums">{f.porcentaje} %</span>,
    },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "150px",
      valor: (f) => ETIQUETA_ACADEMICA[f.estado],
      filtro: "opciones",
      pinta: (f) => <Pildora estado={f.estado} />,
    },
    {
      clave: "ultimoAcceso",
      titulo: "Último ingreso",
      ancho: "150px",
      valor: (f) => f.ultimoAcceso,
      pinta: (f) =>
        f.ultimoAcceso ? (
          <span className="whitespace-nowrap font-mono text-xs">
            {instante(f.ultimoAcceso)}
          </span>
        ) : (
          <span className="text-texto-suave">-</span>
        ),
    },
    {
      /// PUESTA, NO ESCONDIDA (cliente, 24 sep 2026). Estuvo
      /// `aparte` ---existía y no salía hasta pedirla--- con el
      /// argumento de que el asesor es de quien trabaja el aula y no
      /// de la persona. Él la pidió de las cinco primeras: sin ella,
      /// una fila atrasada no dice a quién reclamarle.
      clave: "asesor",
      titulo: "Asesor",
      ancho: "160px",
      valor: (f) => f.asesor?.nombre ?? null,
      filtro: "opciones",
      pinta: (f) =>
        f.asesor ? (
          <span>{f.asesor.nombre}</span>
        ) : (
          <span className="text-texto-suave">Sin asignar</span>
        ),
    },
    {
      /// EL DE SU COBERTURA, no el de su cédula: es de dónde es el
      /// grupo en el que quedó. Mismo criterio que «Grupos de AF»,
      /// para que las dos pantallas sumen lo mismo.
      clave: "departamento",
      titulo: "Departamento",
      ancho: "150px",
      valor: (f) => f.departamento,
      filtro: "opciones",
      pinta: (f) =>
        f.departamento ?? <span className="text-texto-suave">—</span>,
    },
    {
      clave: "notas",
      titulo: "Cantidad notas",
      ancho: "122px",
      numerica: true,
      valor: (f) => f.notas,
      /// El cero en gris: una fila sin gestionar se ve de un vistazo
      /// sin tener que leer el número.
      pinta: (f) => (
        <span className={f.notas === 0 ? "tabular-nums text-texto-suave" : "tabular-nums"}>
          {f.notas}
        </span>
      ),
    },
    {
      /// «ÚLTIMA ACTIVIDAD» ES LA DEL ASESOR, no la del aula.
      ///
      /// Son dos columnas y no una: «Último ingreso» es cuándo entró
      /// la persona al aula ---lo manda el LMS--- y esto es cuándo se
      /// le escribió la última nota. Una fila puede llevar un mes sin
      /// ingreso y una nota de ayer, y eso es precisamente lo que hay
      /// que ver.
      clave: "ultimaNota",
      titulo: "Última actividad",
      ancho: "150px",
      valor: (f) => f.ultimaNota,
      pinta: (f) =>
        f.ultimaNota ? (
          <span className="whitespace-nowrap font-mono text-xs">
            {instante(f.ultimaNota)}
          </span>
        ) : (
          <span className="text-texto-suave">Sin notas</span>
        ),
    },
    {
      /// DOS COLUMNAS Y NO UNA (cliente, 24 sep 2026: «¿como días sin
      /// gestión, no?»). No miden lo mismo: la antigüedad cuenta desde
      /// que ENTRÓ ---cuánto lleva ahí--- y esta desde la ÚLTIMA NOTA
      /// ---a quién hay que llamar hoy---. Alguien de hace cuatro
      /// meses gestionado ayer no necesita nada; alguien de la semana
      /// pasada al que nadie ha tocado, sí.
      ///
      /// Va primero porque es la accionable, y en rojo pasados los
      /// siete días: el número solo no distingue un 6 de un 60 sin
      /// leerlo.
      clave: "sinGestion",
      titulo: "Días sin gestión",
      ancho: "138px",
      numerica: true,
      valor: (f) => f.diasSinGestion,
      pinta: (f) => (
        <span
          className={
            f.diasSinGestion >= 7
              ? "tabular-nums font-semibold text-peligro"
              : "tabular-nums"
          }
          title={
            f.notas === 0
              ? "Nunca se le ha escrito una nota: se cuenta desde que entró"
              : undefined
          }
        >
          {f.diasSinGestion}
          {f.notas === 0 ? " *" : ""}
        </span>
      ),
    },
    {
      /// LOS DÍAS LOS DA EL SERVIDOR, y aquí solo se pintan: con la
      /// hora del navegador, un portátil con la fecha corrida
      /// enseñaría una antigüedad distinta a la de al lado.
      ///
      /// «Antigüedad lead» a secas y sin «(días)»: el rótulo partía en
      /// dos renglones y levantaba toda la fila de encabezados. La
      /// unidad la dice la celda.
      clave: "antiguedad",
      titulo: "Antigüedad lead",
      ancho: "138px",
      numerica: true,
      valor: (f) => f.diasDeAntiguedad,
      pinta: (f) => (
        <span className="tabular-nums">
          {f.diasDeAntiguedad} {f.diasDeAntiguedad === 1 ? "día" : "días"}
        </span>
      ),
    },
    {
      clave: "curso",
      titulo: "Fechas del curso",
      ancho: "180px",
      aparte: true,
      valor: (f) => f.fechaInicio,
      pinta: (f) => (
        <span className="whitespace-nowrap text-xs">
          {f.fechaInicio
            ? fechaDeCalendario(f.fechaInicio, { day: "2-digit", month: "short" })
            : "—"}
          {f.fechaFin
            ? ` → ${fechaDeCalendario(f.fechaFin, { day: "2-digit", month: "short", year: "2-digit" })}`
            : ""}
        </span>
      ),
    },
  ];
}
