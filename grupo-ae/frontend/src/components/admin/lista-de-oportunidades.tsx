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

import { useCallback, useEffect, useState } from "react";

import { Aviso } from "@/components/admin/marco-admin";
import { Cargando, Pildora, type Tono } from "@/components/admin/piezas";
import { Columna, Tabla } from "@/components/admin/tabla";
import { ErrorApi } from "@/lib/api";
import {
  enPesos,
  haceCuanto,
  oportunidadesApi,
  type EtapaOportunidad,
  type OportunidadEnTablero,
  type TipoEmbudo,
} from "@/lib/oportunidades-api";

type Fila = OportunidadEnTablero & { etapaRotulo: string };

const TONO_DE_ETAPA: Record<EtapaOportunidad, Tono> = {
  CAPTADO: "neutro",
  CONTACTADO: "neutro",
  CALIFICADO: "marca",
  PROPUESTA_ENVIADA: "marca",
  EN_NEGOCIACION: "aviso",
  GANADO: "exito",
  PERDIDO: "error",
};

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
      ancho: "8rem",
    },
    { clave: "titulo", titulo: "Qué se vende", valor: (f) => f.titulo },
    {
      clave: "deQuien",
      titulo: embudo === "EMPRESA" ? "Empresa" : "Persona",
      valor: (f) => f.deQuien ?? "",
    },
    {
      clave: "etapa",
      titulo: "Etapa",
      valor: (f) => f.etapaRotulo,
      filtro: "opciones",
      pinta: (f) => <Pildora tono={TONO_DE_ETAPA[f.etapa]}>{f.etapaRotulo}</Pildora>,
      ancho: "10rem",
    },
    {
      clave: "valor",
      titulo: "Valor",
      valor: (f) => f.valor,
      numerica: true,
      pinta: (f) => (
        <span className="tabular-nums">{f.valor > 0 ? enPesos(f.valor) : "—"}</span>
      ),
      ancho: "9rem",
    },
    {
      clave: "asesor",
      titulo: "Dueño",
      valor: (f) => f.asesor?.nombre ?? "",
      filtro: "opciones",
      /// «Sin dueño» y no una casilla vacía: una oportunidad sin
      /// asesor no es un dato que falte, es un problema que hay que
      /// ver desde la lista.
      pinta: (f) =>
        f.asesor ? (
          <span>{f.asesor.nombre}</span>
        ) : (
          <span className="text-error">Sin dueño</span>
        ),
    },
    {
      clave: "campana",
      titulo: "Campaña",
      valor: (f) => f.campana ?? "",
      filtro: "opciones",
    },
    {
      clave: "respuesta",
      titulo: "1.ª respuesta",
      valor: (f) => f.minutosPrimeraRespuesta ?? -1,
      numerica: true,
      pinta: (f) =>
        f.minutosPrimeraRespuesta === null ? (
          <Pildora tono="error">Sin contestar</Pildora>
        ) : (
          <span className="tabular-nums">
            {haceCuanto(f.minutosPrimeraRespuesta).replace("hace ", "")}
          </span>
        ),
      ancho: "9rem",
    },
    {
      clave: "cierre",
      titulo: "Cierre esperado",
      valor: (f) => f.cierreEsperado ?? "",
      pinta: (f) =>
        f.cierreEsperado ? (
          <span className="tabular-nums">
            {new Date(f.cierreEsperado).toLocaleDateString("es-CO", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        ) : (
          <span className="opacity-40">—</span>
        ),
      ancho: "8rem",
    },
    {
      clave: "quieta",
      titulo: "Sin tocar",
      aparte: true,
      valor: (f) =>
        Math.floor((Date.now() - new Date(f.ultimoToqueEn).getTime()) / 86_400_000),
      numerica: true,
    },
  ];

  return (
    /// Mismo relleno que el resto del panel: sin él el contenido
    /// arranca pegado al borde de la ventana.
    <div className="flex min-h-0 grow flex-col gap-4 px-4 pt-4 pb-6">
      <header>
        <h1 className="text-xl font-semibold">{titulo}</h1>
        <p className="text-sm opacity-70">{descripcion}</p>
      </header>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {filas === null ? (
        <Cargando que="Trayendo los leads…" />
      ) : (
        <Tabla
          id={`leads-${embudo.toLowerCase()}`}
          columnas={columnas}
          filas={filas}
          clave={(f) => f.id}
          resumen={
            <p className="text-sm">
              <strong>{resumen.abiertas}</strong> abiertos ·{" "}
              <strong className="tabular-nums">{enPesos(resumen.total)}</strong> sobre
              la mesa ·{" "}
              <strong className="tabular-nums">{enPesos(resumen.ponderado)}</strong>{" "}
              esperado
            </p>
          }
          vacio={
            <p>
              Todavía no hay leads en este embudo. Entran solos por los
              formularios publicados y por los anuncios conectados.
            </p>
          }
        />
      )}
    </div>
  );
}
