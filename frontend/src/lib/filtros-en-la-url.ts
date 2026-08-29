/** Los filtros de una lista, viviendo en la dirección. */

/// Por qué en la URL y no en el estado del componente.
///
/// Porque una vista filtrada es algo que se MANDA. «Mira los
/// treinta que están sin asesor» se resuelve pegando un enlace
/// en el chat, no explicando por teléfono qué hay que pulsar.
/// Guardarlos en `useState` los hace incompartibles, y en
/// `localStorage` los hace peor: se quedan puestos de un día
/// para otro y uno jura que la base se vació.
///
/// Y de paso salen gratis tres cosas que en `useState` habría
/// que escribir: recargar la página no pierde el filtro,
/// «atrás» funciona, y se puede guardar en favoritos.

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { ETIQUETA_ETAPA, type Etapa, type Filtros } from "./crm-api";

/// Las etapas que existen, sacadas del sitio donde ya están.
///
/// No se escribe la lista otra vez: `ETIQUETA_ETAPA` es un
/// `Record<Etapa, string>`, así que el compilador obliga a que
/// las tenga todas. Una segunda lista a mano se queda vieja el
/// día que se añada una etapa, y el síntoma sería un filtro
/// que se ignora en silencio.
const ETAPAS = Object.keys(ETIQUETA_ETAPA);

/// Lo que se deja viajar en la dirección.
///
/// `pagina` y `limite` NO están: son del momento, y meterlos
/// haría que un enlace compartido llevara a la página 7 de una
/// lista que al otro le sale distinta. `tramo` tampoco: lo fija
/// la pantalla, no la persona. Y `convenioId` menos: ese sale
/// del gremio de la sesión, y aceptarlo por la URL sería dejar
/// que se pida el gremio ajeno escribiéndolo a mano.
const TEXTO = ["asesorId", "accionFormacionId", "grupoId", "buscar"] as const;

type LlaveTexto = (typeof TEXTO)[number];

/// El nombre corto de cada filtro en la dirección.
///
/// `?etapa=INSCRITO&asesor=abc` se lee; `?accionFormacionId=`
/// no. Un enlace que alguien puede leer por encima y entender
/// a dónde lleva vale más que uno que calca los nombres
/// internos.
const CORTO: Record<LlaveTexto, string> = {
  asesorId: "asesor",
  accionFormacionId: "curso",
  grupoId: "grupo",
  buscar: "q",
};

const ESTADOS = ["COMPLETO", "PARCIAL"] as const;

/// Todo lo que entra por la dirección se comprueba contra lo
/// que de verdad existe.
///
/// La URL la escribe cualquiera: basta con editarla. No es que
/// se pueda colar un ataque —el backend valida y la sesión
/// manda— pero sí que la pantalla pida una etapa inventada y
/// se quede cargando sin decir por qué. Lo que no reconocemos
/// se ignora, y la vista sale sin ese filtro en vez de rota.
function etapaValida(v: string | null): Etapa | undefined {
  if (!v) return undefined;
  return ETAPAS.includes(v) ? (v as Etapa) : undefined;
}

function estadoValido(v: string | null): "COMPLETO" | "PARCIAL" | undefined {
  if (!v) return undefined;
  return (ESTADOS as readonly string[]).includes(v)
    ? (v as "COMPLETO" | "PARCIAL")
    : undefined;
}

function numeroValido(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export type Cambio = Partial<
  Pick<
    Filtros,
    | "etapa"
    | "asesorId"
    | "accionFormacionId"
    | "grupoId"
    | "estado"
    | "departamentoSepId"
    | "buscar"
  >
>;

export type FiltrosEnLaUrl = {
  /// Listos para mandar a la API, con los fijos de la pantalla
  /// ya mezclados.
  filtros: Filtros;
  /// Solo los que puso la persona. Es lo que se pinta como
  /// «quitar este filtro», y por eso va aparte: los fijos no
  /// se pueden quitar y no deben salir ahí.
  puestos: Cambio;
  /// Cuántos hay puestos. Cero significa «vista limpia».
  cuantos: number;
  /// Pone, cambia o quita filtros. `undefined` o cadena vacía
  /// quita el que sea.
  cambiar: (cambio: Cambio) => void;
  /// Los quita todos de golpe.
  limpiar: () => void;
};

/**
 * Los filtros de esta pantalla, leídos y escritos en la URL.
 *
 * `fijos` son los que la pantalla impone y la persona no
 * elige — el `tramo`, por ejemplo. Van al resultado pero no a
 * la dirección: no son suyos, y enseñarlos como quitables
 * mentiría.
 */
export function useFiltrosEnLaUrl(fijos: Filtros = {}): FiltrosEnLaUrl {
  const parametros = useSearchParams();
  const router = useRouter();
  const ruta = usePathname();

  const puestos = useMemo<Cambio>(() => {
    const p: Cambio = {};

    const etapa = etapaValida(parametros.get("etapa"));
    if (etapa) p.etapa = etapa;

    const estado = estadoValido(parametros.get("estado"));
    if (estado) p.estado = estado;

    const depto = numeroValido(parametros.get("departamento"));
    if (depto) p.departamentoSepId = depto;

    for (const llave of TEXTO) {
      const valor = parametros.get(CORTO[llave])?.trim();
      if (valor) p[llave] = valor;
    }

    return p;
  }, [parametros]);

  /// Los fijos van DESPUÉS, y es a propósito: si alguien
  /// escribe `?tramo=AULA` a mano, no se sale del tramo que
  /// esta pantalla es.
  const filtros = useMemo<Filtros>(
    () => ({ ...puestos, ...fijos }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puestos, JSON.stringify(fijos)],
  );

  const cambiar = useCallback(
    (cambio: Cambio) => {
      const siguientes = new URLSearchParams(parametros.toString());

      const poner = (nombre: string, valor: string | number | undefined) => {
        const texto = valor === undefined ? "" : String(valor).trim();
        if (texto) siguientes.set(nombre, texto);
        else siguientes.delete(nombre);
      };

      if ("etapa" in cambio) poner("etapa", cambio.etapa);
      if ("estado" in cambio) poner("estado", cambio.estado);
      if ("departamentoSepId" in cambio)
        poner("departamento", cambio.departamentoSepId);
      for (const llave of TEXTO) {
        if (llave in cambio) poner(CORTO[llave], cambio[llave]);
      }

      const cadena = siguientes.toString();

      /// `replace` y no `push`.
      ///
      /// Con `push`, pulsar cinco filtros deja cinco entradas
      /// en el historial y «atrás» las deshace de una en una en
      /// vez de sacarle de la pantalla. Quien pulsa un filtro
      /// no está navegando, está mirando lo mismo de otra
      /// forma.
      ///
      /// `scroll: false` porque Next sube arriba al navegar, y
      /// aquí no se ha navegado: quitar un filtro no puede
      /// mover la tabla que se está leyendo.
      router.replace(cadena ? `${ruta}?${cadena}` : ruta, { scroll: false });
    },
    [parametros, router, ruta],
  );

  const limpiar = useCallback(() => {
    router.replace(ruta, { scroll: false });
  }, [router, ruta]);

  return {
    filtros,
    puestos,
    cuantos: Object.keys(puestos).length,
    cambiar,
    limpiar,
  };
}
