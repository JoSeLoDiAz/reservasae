"use client";

/** El lead, abierto de lado, sin perder la lista. */

/**
 * Por qué un cajón y no una página.
 *
 * Un asesor revisando su embudo abre ocho negocios seguidos. Con una
 * página, cada uno cuesta salir de la lista, esperar y volver — y al
 * volver se ha perdido el sitio, el filtro y el scroll. Con el cajón,
 * la lista sigue detrás: se mira, se cierra y se sigue por donde
 * iba. Ese es el gesto que hace que el CRM se use.
 *
 * La página completa también existe, en `/admin/oportunidades/[id]`,
 * porque una dirección que se pueda pegar en un WhatsApp hace falta:
 * «mira este negocio» tiene que poder mandarse.
 *
 * Es la pantalla donde un asesor pasa el día, así que la densidad y
 * la jerarquía importan más que en ninguna:
 *
 * - **Lo más grande del cajón es la plata**, a 34 px, y nada más
 *   puede serlo. Antes lo más grande era el título del negocio y el
 *   valor iba a 18, igual que la probabilidad y que la fecha: cuatro
 *   datos del mismo peso y ninguno mandaba.
 * - **El único color caliente es el reloj.** Ni una etapa en ámbar,
 *   ni un aviso de validación en rojo, ni una tarjeta teñida de
 *   rosa. Ver ámbar aquí significa que alguien lleva esperando, y no
 *   significa ninguna otra cosa.
 * - **Los bloques no llevan ni borde ni fondo**: se separan por 24
 *   px de aire y por su rótulo en versalita. Eran cinco rayas
 *   horizontales que partían el cajón en cinco pantallas pegadas.
 * - **Sin sombra.** El cajón flota por su borde de 1 px, que es lo
 *   único que separa en este panel.
 *
 * Cómo se escribe cada dato está en `datos-del-negocio.tsx`, que es
 * el mismo contrato que usa la lista de detrás. De
 * `docs/estilo-del-panel.md`: el color va en la LETRA —ni una
 * píldora, ni un rectángulo de color—, el radio es un token y no una
 * clase, y ni un párrafo que explique lo que ya se ve.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Boton, Campo, CLASE_CONTROL } from "@/components/admin/marco-admin";
import { FAMILIAS, serviciosApi, type Servicio } from "@/lib/servicios-api";
import { Cargando } from "@/components/admin/piezas";
import { IconoCerrar } from "@/components/admin/iconos";
import { ProximoPaso } from "@/components/admin/proximo-paso";
import {
  Cliente,
  Codigo,
  Dinero,
  Etapa,
  Fecha,
  Porcentaje,
  Puerta,
  Reloj,
  Rotulo,
  Vacio,
  esperaVencida,
  Persona,
  relojEnTexto,
} from "@/components/admin/datos-del-negocio";
import { ErrorApi } from "@/lib/api";
import {
  enPesos,
  oportunidadesApi,
  type EtapaOportunidad,
  type FichaDeOportunidad,
  type MotivoCierre,
} from "@/lib/oportunidades-api";

/// Los mismos rótulos que usa el backend, en
/// `oportunidades/escalera.ts`. Son dos paquetes y el panel no
/// puede importar de allá, así que la copia es inevitable: lo que
/// no puede es discrepar. Si cambia una, cambia la otra —en
/// `EtapaParticipante` se dejaron discrepar y acabó mandando
/// campañas a la gente equivocada—.
///
/// Las palabras son las de la dirección (notas del 15 sep 2026):
/// «solicitud de negocio», «cotización», «cerrado ganado /
/// perdido». El ENUM no cambia, solo lo que se lee.
export const ROTULO_ETAPA: Record<EtapaOportunidad, string> = {
  CAPTADO: "Solicitud de negocio",
  CONTACTADO: "Contactado",
  CALIFICADO: "Calificado",
  PROPUESTA_ENVIADA: "Cotización enviada",
  EN_NEGOCIACION: "En negociación",
  GANADO: "Cerrado ganado",
  PERDIDO: "Cerrado perdido",
};

const ETAPAS_POR_EMBUDO: Record<string, EtapaOportunidad[]> = {
  EMPRESA: [
    "CAPTADO",
    "CONTACTADO",
    "CALIFICADO",
    "PROPUESTA_ENVIADA",
    "EN_NEGOCIACION",
    "GANADO",
    "PERDIDO",
  ],
  PERSONA: ["CAPTADO", "CONTACTADO", "CALIFICADO", "GANADO", "PERDIDO"],
};

const MOTIVOS_GANAR: Array<{ valor: MotivoCierre; rotulo: string }> = [
  { valor: "PRECIO_ACEPTADO", rotulo: "Aceptó el precio" },
  { valor: "UNICA_OPCION", rotulo: "Era la única opción" },
  { valor: "RECOMENDACION", rotulo: "Vino recomendado" },
];

const MOTIVOS_PERDER: Array<{ valor: MotivoCierre; rotulo: string }> = [
  { valor: "PRECIO_ALTO", rotulo: "Le pareció caro" },
  { valor: "SIN_PRESUPUESTO", rotulo: "No tenía presupuesto" },
  { valor: "SE_FUE_CON_OTRO", rotulo: "Se fue con otro" },
  { valor: "FUERA_DE_TIEMPO", rotulo: "Fuera de tiempo" },
  { valor: "NO_ERA_QUIEN_DECIDE", rotulo: "No era quien decide" },
  { valor: "NUNCA_RESPONDIO", rotulo: "Nunca respondió" },
  { valor: "NO_LE_INTERESA", rotulo: "No le interesa" },
  { valor: "DATOS_ERRADOS", rotulo: "Datos errados" },
  { valor: "OTRO", rotulo: "Otro" },
];

/**
 * Un fallo del servidor, sin caja y sin rojo.
 *
 * Era una tarjeta teñida de rosa con borde y radio. El rojo de este
 * panel significa UNA cosa —que alguien lleva esperando respuesta— y
 * un error de validación no es eso: repartirlo entre dos
 * significados es lo que hace que deje de verse.
 *
 * Queda el peso 600, que es el peso del resultado de algo, y el
 * mensaje tal cual lo manda el servidor: dice QUÉ falta —«falta el
 * valor», «diga por qué se cierra»—, que es lo que sirve.
 */
function Falla({ children }: { children: React.ReactNode }) {
  return <p className="estado mb-3">{children}</p>;
}

/**
 * Lo facturado, bajo lo cotizado.
 *
 * Son dos cifras distintas a propósito: se gana al cerrar y se
 * factura después, y la diferencia entre las dos es plata que todavía
 * no ha entrado. Por eso va aquí, pegada a la de portada, y no en
 * otro bloque: lo que se quiere ver de un vistazo es la distancia.
 *
 * «Sin facturar» va con palabras y en gris, y no con la raya de
 * `Vacio`. La raya dice «aquí no hay nada que ver», y esta ausencia sí
 * dice algo: que falta la factura. Tampoco en verde cuando lo hay: el
 * verde de `Dinero` es lo que ya se cobró, y facturar no es cobrar.
 *
 * Mira `typeof` y no `=== null` porque el campo es nuevo: si el
 * servidor todavía no lo manda, llega `undefined`, y eso también es
 * «sin facturar» y no un «$ undefined».
 */
function Facturado({ valor }: { valor: number | null | undefined }) {
  if (typeof valor !== "number") {
    return <span className="secundario mt-1.5 block">Sin facturar</span>;
  }
  return (
    <span className="mt-1.5 flex items-baseline justify-end gap-2">
      <span className="rotulo-bloque">Facturado</span>
      {/* `Dinero` pinta la raya para el cero, que es lo correcto en
          una lista de cotizaciones. Aquí un cero no es ausencia —la
          ausencia es null—, así que se escribe tal cual. */}
      {valor > 0 ? (
        <Dinero valor={valor} />
      ) : (
        <span className="tabular-nums whitespace-nowrap">{enPesos(0)}</span>
      )}
    </span>
  );
}

/// El techo de una cifra en pesos. La columna es `Decimal(14, 2)` en
/// la base: doce cifras enteras. Pasarse no lo ataja el validador
/// del servidor sino Postgres, y lo que le llega a la pantalla es un
/// 500 sin explicación. Un cero de más al teclear es justo como se
/// llega ahí, así que se dice aquí, antes de mandar nada.
const TOPE_PESOS = 999_999_999_999;

type CambiosDelNegocio = Parameters<typeof oportunidadesApi.actualizar>[1];

/// Cómo se nombra cada dato cuando hay que decir qué se guardó.
///
/// Un `Record` sobre las claves del contrato y no una lista suelta:
/// si mañana `actualizar` acepta un campo más, esto deja de compilar
/// hasta que alguien le ponga nombre, en vez de decirle al asesor
/// «se guardó undefined».
const NOMBRE_DEL_CAMBIO: Record<keyof CambiosDelNegocio, string> = {
  titulo: "el título",
  valor: "el valor cotizado",
  valorFacturado: "el valor facturado",
  cierreEsperado: "la fecha de cierre",
  campana: "la campaña",
  servicioId: "el servicio",
  cantidad: "la cantidad",
};

/// «el título, la cantidad y el valor cotizado».
function enLista(cosas: string[]): string {
  if (cosas.length <= 1) return cosas[0] ?? "";
  return `${cosas.slice(0, -1).join(", ")} y ${cosas[cosas.length - 1]}`;
}

/**
 * Cómo va cada lista de un desplegable.
 *
 * Tres estados y no un «ya cargó». Mientras la lista viene en camino,
 * y sobre todo cuando no llegó, lo que el negocio YA tiene no se
 * puede juzgar contra ella: si el servicio no aparece en una lista
 * vacía no es porque se dejara de ofertar, y si el asesor no aparece
 * no es porque perdiera el rol. Poner esas coletillas sin haberlo
 * comprobado era afirmar algo falso.
 */
type EstadoDeLista = "trayendo" | "lista" | "fallo";

/**
 * Bajo el desplegable cuya lista no llegó.
 *
 * Antes el fallo se tragaba con un `catch` vacío y el desplegable
 * salía con «Sin servicio» y nada más, que se lee como «el portafolio
 * está vacío» o «no hay asesores». Quien lo ve así se va a buscar el
 * problema al sitio equivocado. Va en el peso del estado, como
 * `Falla`, porque es el resultado de algo que se intentó.
 */
function ListaQueNoLlego() {
  return (
    <span className="estado mt-1.5 block">
      No pudimos traer la lista; recargue la página.
    </span>
  );
}

export function CajonOportunidad({
  id,
  alCerrar,
  alCambiar,
}: {
  id: string | null;
  alCerrar: () => void;
  /// Para que la lista de detrás se entere y se refresque. Sin
  /// esto, se cierra el cajón tras mover una etapa y la fila sigue
  /// diciendo la anterior.
  alCambiar?: () => void;
}) {
  const [ficha, setFicha] = useState<FichaDeOportunidad | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    setCargando(true);
    setError(null);
    try {
      setFicha(await oportunidadesApi.ficha(id));
    } catch (e) {
      setError(
        e instanceof ErrorApi ? e.message : "No pudimos abrir el negocio.",
      );
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    setFicha(null);
    void cargar();
  }, [cargar]);

  /// Escape cierra. Es el gesto que espera cualquiera que abra algo
  /// encima de otra cosa, y no tenerlo obliga a buscar la equis.
  useEffect(() => {
    if (!id) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [id, alCerrar]);

  if (!id) return null;

  const quien =
    ficha?.empresa?.razonSocial ??
    (ficha?.persona
      ? `${ficha.persona.primerNombre} ${ficha.persona.primerApellido}`
      : null);

  return (
    <>
      {/* La lista de detrás se ve, atenuada: el cajón es una capa
          encima de donde uno estaba, no otro sitio. */}
      <div
        className="no-imprimir fixed inset-0 z-40 bg-black/25"
        onClick={alCerrar}
        aria-hidden="true"
      />
      {/* Borde de 1 px y NINGUNA sombra. El cajón es uno de los tres
          objetos del panel que llevan borde completo —el campo, el
          modal y la ficha del tablero son los otros—, y eso ya dice
          que flota. La sombra era lo único que levitaba en todo el
          producto. */}
      <aside
        className="no-imprimir fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-borde bg-superficie"
        role="dialog"
        aria-label="Negocio"
      >
        <header className="relative flex items-end gap-4 border-b border-borde px-4 pt-3 pr-12 pb-3">
          <div className="min-w-0 grow">
            {ficha ? (
              <>
                <div className="flex items-baseline gap-3">
                  <Codigo codigo={ficha.codigo} />
                  {/* El reloj solo si hay algo que mirar. Cuando
                      nadie espera, ese hueco se queda vacío y eso ya
                      es información. */}
                  {esperaVencida(
                    ficha.minutosPrimeraRespuesta,
                    ficha.embudo,
                  ) && (
                    <Reloj
                      minutos={ficha.minutosPrimeraRespuesta}
                      embudo={ficha.embudo}
                    />
                  )}
                </div>
                <h2
                  className="titulo-pantalla mt-1 line-clamp-2"
                  title={ficha.titulo}
                >
                  {ficha.titulo}
                </h2>
                <p className="secundario mt-1">
                  {quien ? <Cliente nombre={quien} /> : <Vacio />}
                </p>
                <div className="mt-2">
                  <Etapa etapa={ficha.etapa} rotulo={ROTULO_ETAPA[ficha.etapa]} />
                </div>
              </>
            ) : (
              <h2 className="titulo-pantalla">
                Negocio
              </h2>
            )}
          </div>

          {/* Lo más grande del cajón, siempre. Es lo COTIZADO, y el
              rótulo lo dice: desde que el negocio guarda también lo
              facturado, «Valor» a secas ya no aclara cuál de las dos
              platas es, y la que se lleva a una reunión no es la
              misma. La columna se sigue llamando `valor` en la base;
              solo cambia lo que se lee. Lo facturado va debajo, a
              tamaño de dato: la portada es una sola cifra. */}
          {ficha && (
            <div className="shrink-0 text-right">
              <Rotulo>Valor cotizado</Rotulo>
              <span className="mt-1 block">
                <Dinero valor={ficha.valor} portada />
              </span>
              <Facturado valor={ficha.valorFacturado} />
            </div>
          )}

          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="absolute top-3 right-3 rounded-lg p-1.5 text-texto-suave transition hover:bg-superficie-alterna hover:text-texto"
          >
            <IconoCerrar tamano={18} />
          </button>
        </header>

        <div className="min-h-0 grow overflow-y-auto px-4 py-4">
          {error && <Falla>{error}</Falla>}
          {cargando && !ficha && <Cargando que="Abriendo el negocio…" />}
          {ficha && (
            <div className="flex flex-col gap-6">
              <Cifras ficha={ficha} />
              <DatosDelNegocio
                ficha={ficha}
                alHecho={() => {
                  void cargar();
                  alCambiar?.();
                }}
              />
              <MoverEtapa
                ficha={ficha}
                alHecho={() => {
                  void cargar();
                  alCambiar?.();
                }}
              />
              <Contacto ficha={ficha} />
              {/* Lo que sigue, con fecha: es lo que alimenta la agenda
                  y lo que enciende el bananeo al marcarse hecho. */}
              <ProximoPaso
                oportunidadId={ficha.id}
                alCambiar={() => {
                  void cargar();
                  alCambiar?.();
                }}
              />
              <Anotar
                ficha={ficha}
                alHecho={() => {
                  void cargar();
                  alCambiar?.();
                }}
              />
              <Historial ficha={ficha} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

/// Lo que acompaña a la plata: cuándo cierra, con qué confianza y
/// quién responde. Sin marcos: son tres datos, no tres objetos.
function Cifras({ ficha }: { ficha: FichaDeOportunidad }) {
  return (
    <section className="grid grid-cols-3 gap-x-6">
      <Dato rotulo="Probabilidad">
        {/* Gris significa «esto es un supuesto»: la que sale de la
            forma del embudo va apagada, la que alguien puso mirando
            el negocio va en el color del texto. Así se sabe qué
            número se puede llevar a una reunión. */}
        <Porcentaje
          valor={ficha.probabilidad}
          supuesto={!ficha.probabilidadPropia}
        />
        {/* Iba en ámbar, y el ámbar de este panel dice una sola
            cosa: que alguien lleva esperando. Que una cifra la
            pusiera una persona no es una alarma, es una nota al
            pie — y el gris de la propia cifra ya lo cuenta. */}
        {ficha.probabilidadPropia && (
          <span className="micro mt-0.5 block">ajustada manualmente</span>
        )}
      </Dato>
      <Dato rotulo="Cierre esperado">
        <Fecha iso={ficha.cierreEsperado} />
      </Dato>
      <Dato rotulo="Asesor">
        <Persona nombre={ficha.asesor?.nombre} />
      </Dato>
    </section>
  );
}

function Dato({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Rotulo>{rotulo}</Rotulo>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/**
 * Datos del negocio: qué se vende, cuánto, por cuánto y quién lo lleva.
 *
 * NO EXISTÍA, y no era un detalle. El servidor ya sabía corregir el
 * título, el valor y la fecha de cierre, y pasarle el negocio a otro
 * asesor, pero ninguna pantalla lo llamaba: el cajón solo enseñaba. Y
 * la escalera, al mover de etapa, pide «asígnele un asesor» — un
 * mensaje que dejaba al usuario sin salida (17 sep 2026).
 *
 * Aquí se elige también el SERVICIO DEL PORTAFOLIO, que es lo que
 * deja contestar «qué se vende más». El título se queda como el caso
 * concreto; el servicio dice la familia.
 *
 * Se guarda TODO con un solo botón y solo lo que cambió: el servidor
 * no escribe nada en la bitácora si no hay cambio, pero mandar el
 * asesor sin tocarlo dejaría un «traspaso» de alguien a sí mismo.
 *
 * Aquí se escribe también el VALOR FACTURADO, junto al cotizado. Son
 * dos cifras y no una: se cotiza para ganar y se factura después, y
 * el resumen del mes compara las dos. Vacío es «sin facturar» y viaja
 * como null. El cero SÍ vale y es otra cosa —una licencia regalada
 * para cerrar se facturó en cero—; así lo decide `dto.ts` en el
 * servidor, y por eso la ayuda del campo dice que vacío es «no hay
 * factura»: un 0 puesto queriendo decir «todavía no» contaría el
 * negocio entre las facturadas del mes. Solo se factura lo ganado
 * (`puedeFacturarse`, en `edicion.ts`); eso lo decide el servidor, y
 * aquí solo se avisa en la ayuda para no mandar a probar.
 *
 * Y el botón es uno, pero las llamadas son DOS —los datos y el
 * traspaso son rutas distintas del servidor—, así que puede salir
 * bien la primera y mal la segunda. Entonces se dice qué quedó
 * guardado y qué no, y se recarga igual: lo primero ya está en la
 * base, y un formulario que lo sigue enseñando como pendiente invita
 * a guardarlo dos veces.
 */
function DatosDelNegocio({
  ficha,
  alHecho,
}: {
  ficha: FichaDeOportunidad;
  alHecho: () => void;
}) {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [estadoServicios, setEstadoServicios] = useState<EstadoDeLista>("trayendo");
  const [asesores, setAsesores] = useState<Array<{ id: string; nombre: string }>>([]);
  const [estadoAsesores, setEstadoAsesores] = useState<EstadoDeLista>("trayendo");

  const inicial = {
    servicioId: ficha.servicio?.id ?? "",
    cantidad: ficha.cantidad === null ? "" : String(ficha.cantidad),
    titulo: ficha.titulo,
    valor: String(ficha.valor),
    /// `typeof` y no `=== null`: si el servidor aún no manda el
    /// campo, llega `undefined`, y `String(undefined)` metería la
    /// palabra «undefined» en el campo.
    valorFacturado:
      typeof ficha.valorFacturado === "number" ? String(ficha.valorFacturado) : "",
    cierre: ficha.cierreEsperado ? ficha.cierreEsperado.slice(0, 10) : "",
    asesorId: ficha.asesor?.id ?? "",
  };
  const [datos, setDatos] = useState(inicial);
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);
  /// Cuando se guardaron los datos pero no el traspaso. Va aparte de
  /// `error` porque sobrevive a la recarga: al recargar, el efecto
  /// de abajo limpia `error` —con razón: el formulario vuelve a lo
  /// guardado y un error de validación ya no señala nada—, y este
  /// aviso es justo sobre lo que acaba de recargarse. Se limpia al
  /// volver a guardar; al abrir otro negocio el cajón monta el
  /// formulario de nuevo y se va solo.
  const [parcial, setParcial] = useState<string | null>(null);

  /// Al abrir otro negocio o recargar éste, el formulario vuelve a lo
  /// guardado: no se arrastra lo que se escribió en el anterior.
  useEffect(() => {
    setDatos(inicial);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ficha.id, ficha.titulo, ficha.valor, ficha.valorFacturado, ficha.cierreEsperado, ficha.servicio?.id, ficha.cantidad, ficha.asesor?.id]);

  useEffect(() => {
    let vivo = true;
    void serviciosApi
      .visibles()
      .then((s) => {
        if (!vivo) return;
        setServicios(s);
        setEstadoServicios("lista");
      })
      .catch(() => {
        if (vivo) setEstadoServicios("fallo");
      });
    void oportunidadesApi
      .asesores(ficha.id)
      .then((a) => {
        if (!vivo) return;
        setAsesores(a);
        setEstadoAsesores("lista");
      })
      .catch(() => {
        if (vivo) setEstadoAsesores("fallo");
      });
    return () => {
      vivo = false;
    };
  }, [ficha.id]);

  const cambiar = (clave: keyof typeof datos, valor: string) => {
    setHecho(false);
    setDatos((d) => ({ ...d, [clave]: valor }));
  };

  const servicioElegido = servicios.find((s) => s.id === datos.servicioId);
  /// Si el servicio que ya lleva se ocultó del portafolio, sigue
  /// saliendo en su desplegable: ocultar no le cambia lo que se vendió.
  /// Y sale también cuando la lista no llegó o no ha llegado, para
  /// que el desplegable no enseñe «Sin servicio» sobre un negocio que
  /// sí lo tiene; lo que cambia es la coletilla, que solo se pone
  /// cuando la lista llegó y de verdad no está.
  const servicioFueraDeLista =
    ficha.servicio && !servicios.some((s) => s.id === ficha.servicio?.id)
      ? ficha.servicio
      : null;
  const unidad = servicioElegido?.unidad ?? servicioFueraDeLista?.unidad ?? null;

  const hayCambios = JSON.stringify(datos) !== JSON.stringify(inicial);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setParcial(null);

    const cantidad = datos.cantidad.trim() === "" ? null : Number(datos.cantidad);
    if (cantidad !== null && (!Number.isInteger(cantidad) || cantidad < 1)) {
      setError("La cantidad va en números enteros, desde 1.");
      return;
    }

    /// Las dos platas se revisan solo si se tocaron: una cifra que ya
    /// venía de la base con algo que hoy no se aceptaría —unos
    /// centavos de una importación, por ejemplo— no puede impedir que
    /// se corrija el título.
    ///
    /// Y vacío NO es cero. `Number("")` da 0, y así era como borrar el
    /// campo para reescribirlo, y darle a guardar a medio camino,
    /// dejaba el negocio cotizado en $ 0 sin que nadie lo pidiera. El
    /// cero se puede poner, pero escrito.
    const cambiaValor = datos.valor !== inicial.valor;
    const textoValor = datos.valor.trim();
    const valor = Number(textoValor);
    if (cambiaValor) {
      if (textoValor === "") {
        setError(
          "Falta el valor cotizado. Escríbalo en pesos; si todavía no hay cifra, ponga 0.",
        );
        return;
      }
      if (!Number.isInteger(valor) || valor < 0) {
        setError("El valor cotizado va en pesos, sin decimales.");
        return;
      }
      if (valor > TOPE_PESOS) {
        setError("El valor cotizado pasa del billón de pesos: revise que no le sobre un cero.");
        return;
      }
    }

    /// En lo facturado, en cambio, vacío es una respuesta: «sin
    /// facturar», que viaja como null.
    const textoFacturado = datos.valorFacturado.trim();
    const valorFacturado = textoFacturado === "" ? null : Number(textoFacturado);
    if (datos.valorFacturado !== inicial.valorFacturado && valorFacturado !== null) {
      if (!Number.isInteger(valorFacturado) || valorFacturado < 0) {
        setError("El valor facturado va en pesos, sin decimales.");
        return;
      }
      if (valorFacturado > TOPE_PESOS) {
        setError("El valor facturado pasa del billón de pesos: revise que no le sobre un cero.");
        return;
      }
    }

    const cambios: CambiosDelNegocio = {};
    if (datos.servicioId !== inicial.servicioId) cambios.servicioId = datos.servicioId || null;
    if (datos.cantidad !== inicial.cantidad) cambios.cantidad = cantidad;
    if (datos.titulo !== inicial.titulo) cambios.titulo = datos.titulo;
    if (cambiaValor) cambios.valor = valor;
    if (datos.valorFacturado !== inicial.valorFacturado) cambios.valorFacturado = valorFacturado;
    if (datos.cierre !== inicial.cierre) cambios.cierreEsperado = datos.cierre || null;

    const claves = Object.keys(cambios) as Array<keyof CambiosDelNegocio>;
    const cambiaAsesor = datos.asesorId !== inicial.asesorId;

    setYendo(true);
    try {
      if (claves.length > 0) {
        try {
          await oportunidadesApi.actualizar(ficha.id, cambios);
        } catch (e) {
          /// El servidor dice QUÉ falta; se enseña tal cual. Aquí no
          /// se guardó nada —ni el traspaso, que ni se intenta—, y el
          /// formulario se queda como estaba para corregir y volver.
          setError(e instanceof ErrorApi ? e.message : "No pudimos guardar los cambios.");
          return;
        }
      }
      if (cambiaAsesor) {
        try {
          await oportunidadesApi.asignarAsesor(ficha.id, datos.asesorId || null);
        } catch (e) {
          if (claves.length === 0) {
            setError(e instanceof ErrorApi ? e.message : "No pudimos cambiar el asesor.");
            return;
          }
          const nombres = claves.map((c) => NOMBRE_DEL_CAMBIO[c]);
          const porque =
            e instanceof ErrorApi
              ? e.message
              : "no pudimos hablar con el servidor. Elíjalo otra vez y guarde.";
          setParcial(
            `Se ${nombres.length === 1 ? "guardó" : "guardaron"} ${enLista(nombres)}. ` +
              `El asesor no cambió: ${porque}`,
          );
          /// Se recarga igual: lo primero ya está en la base.
          alHecho();
          return;
        }
      }
      setHecho(true);
      alHecho();
    } finally {
      setYendo(false);
    }
  }

  return (
    <form onSubmit={guardar}>
      <Rotulo>Datos del negocio</Rotulo>
      {(error || parcial) && (
        <div className="mt-2">
          {error && <Falla>{error}</Falla>}
          {parcial && <Falla>{parcial}</Falla>}
        </div>
      )}
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-6">
        <div className="sm:col-span-4">
          <Campo etiqueta="Servicio del portafolio">
            <select
              value={datos.servicioId}
              onChange={(e) => cambiar("servicioId", e.target.value)}
              className={CLASE_CONTROL}
            >
              <option value="">Sin servicio</option>
              {servicioFueraDeLista && (
                <option value={servicioFueraDeLista.id}>
                  {estadoServicios === "lista"
                    ? `${servicioFueraDeLista.nombre} (ya no se oferta)`
                    : servicioFueraDeLista.nombre}
                </option>
              )}
              {FAMILIAS.map((f) => (
                <optgroup key={f.valor} label={f.rotulo}>
                  {servicios
                    .filter((s) => s.familia === f.valor)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            {estadoServicios === "fallo" && <ListaQueNoLlego />}
          </Campo>
        </div>
        <div className="sm:col-span-2">
          <Campo etiqueta={unidad ? `Cantidad (${unidad})` : "Cantidad"}>
            <input
              type="number"
              step={1}
              inputMode="numeric"
              value={datos.cantidad}
              onChange={(e) => cambiar("cantidad", e.target.value)}
              className={CLASE_CONTROL}
            />
          </Campo>
        </div>
        <div className="sm:col-span-6">
          <Campo etiqueta="Título">
            <input
              value={datos.titulo}
              onChange={(e) => cambiar("titulo", e.target.value)}
              maxLength={160}
              className={CLASE_CONTROL}
            />
          </Campo>
        </div>
        {/* Eran tres campos de a tercio —valor, cierre, asesor— y
            con lo facturado son cuatro, que no se reparten parejo en
            seis columnas. Van en dos parejas: las dos platas juntas,
            que es lo que se compara, y cierre y asesor debajo. */}
        <div className="sm:col-span-3">
          <Campo etiqueta="Valor cotizado (COP)">
            <input
              type="number"
              step={1}
              inputMode="numeric"
              value={datos.valor}
              onChange={(e) => cambiar("valor", e.target.value)}
              className={CLASE_CONTROL}
            />
          </Campo>
        </div>
        <div className="sm:col-span-3">
          {/* La ayuda cambia con la etapa y el campo no se apaga:
              quitar lo facturado se puede siempre —es corregir un
              error—, y una ganada que se reabre lo conserva. Quien
              decide si se puede anotar es el servidor; esto solo
              evita la vuelta de probar y leer el rechazo. */}
          <Campo
            etiqueta="Valor facturado (COP)"
            ayuda={
              ficha.etapa === "GANADO"
                ? "Vacío mientras no haya factura."
                : `Se anota cuando esté en «${ROTULO_ETAPA.GANADO}».`
            }
          >
            <input
              type="number"
              step={1}
              inputMode="numeric"
              value={datos.valorFacturado}
              onChange={(e) => cambiar("valorFacturado", e.target.value)}
              className={CLASE_CONTROL}
            />
          </Campo>
        </div>
        <div className="sm:col-span-3">
          <Campo etiqueta="Cierre esperado">
            <input
              type="date"
              value={datos.cierre}
              onChange={(e) => cambiar("cierre", e.target.value)}
              className={CLASE_CONTROL}
            />
          </Campo>
        </div>
        <div className="sm:col-span-3">
          <Campo etiqueta="Asesor">
            <select
              value={datos.asesorId}
              onChange={(e) => cambiar("asesorId", e.target.value)}
              className={CLASE_CONTROL}
            >
              <option value="">Sin asesor</option>
              {/* La coletilla solo cuando la lista llegó y de verdad
                  no está en ella: con la lista caída, cualquier
                  asesor «perdería el rol», y no es verdad. */}
              {ficha.asesor && !asesores.some((a) => a.id === ficha.asesor?.id) && (
                <option value={ficha.asesor.id}>
                  {estadoAsesores === "lista"
                    ? `${ficha.asesor.nombre} (sin rol comercial en esta línea)`
                    : ficha.asesor.nombre}
                </option>
              )}
              {asesores.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
            {estadoAsesores === "fallo" && <ListaQueNoLlego />}
          </Campo>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Boton type="submit" disabled={yendo || !hayCambios}>
          {yendo ? "Guardando…" : "Guardar cambios"}
        </Boton>
        {hecho && !hayCambios && <span className="secundario">Cambios guardados.</span>}
      </div>
    </form>
  );
}

/**
 * Mover de etapa, que es la acción principal de esta pantalla.
 *
 * El motivo aparece SOLO al elegir ganado o perdido, y no antes: un
 * desplegable de motivos permanente sobre un negocio vivo invita a
 * llenarlo, y un motivo de cierre en algo que no se ha cerrado
 * ensucia el informe del que se supone que aprendemos.
 *
 * Cada botón lleva el punto de color de su etapa, así que la rampa
 * —de gris a azul profundo, y el verde solo en Ganado— se lee aquí
 * igual que en la lista. El elegido se rellena de `--marca`, que es
 * el único sitio del panel donde el azul de marca significa «esto
 * es lo que está seleccionado ahora mismo».
 */
function MoverEtapa({
  ficha,
  alHecho,
}: {
  ficha: FichaDeOportunidad;
  alHecho: () => void;
}) {
  const [a, setA] = useState<EtapaOportunidad | "">("");
  const [motivo, setMotivo] = useState<MotivoCierre | "">("");
  const [nota, setNota] = useState("");
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cierra = a === "GANADO" || a === "PERDIDO";
  const motivos = a === "GANADO" ? MOTIVOS_GANAR : MOTIVOS_PERDER;
  const etapas = (ETAPAS_POR_EMBUDO[ficha.embudo] ?? []).filter(
    (e) => e !== ficha.etapa,
  );

  async function mover(evento: React.FormEvent) {
    evento.preventDefault();
    if (!a) return;
    setYendo(true);
    setError(null);
    try {
      await oportunidadesApi.cambiarEtapa(ficha.id, {
        a,
        motivo: cierra && motivo ? motivo : undefined,
        nota: nota.trim() || undefined,
      });
      setA("");
      setMotivo("");
      setNota("");
      alHecho();
    } catch (e) {
      /// El mensaje del servidor dice QUÉ FALTA —«falta el valor»,
      /// «diga por qué se cierra»—, así que se enseña tal cual. Un
      /// «no se pudo» genérico obligaría a adivinar.
      setError(
        e instanceof ErrorApi ? e.message : "No pudimos moverla de etapa.",
      );
    } finally {
      setYendo(false);
    }
  }

  return (
    <section>
      <Rotulo>Mover de etapa</Rotulo>
      {error && (
        <div className="mt-2">
          <Falla>{error}</Falla>
        </div>
      )}
      <form onSubmit={mover} className="mt-2 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {etapas.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setA(a === e ? "" : e)}
              aria-pressed={a === e}
              className={`rounded-lg border px-3 py-1.5 transition ${
                a === e
                  ? "border-marca bg-marca font-semibold text-marca-texto"
                  : "border-borde hover:bg-superficie-alterna"
              }`}
            >
              {a === e ? (
                ROTULO_ETAPA[e]
              ) : (
                <Etapa etapa={e} rotulo={ROTULO_ETAPA[e]} />
              )}
            </button>
          ))}
        </div>

        {cierra && (
          <label className="block">
            <Rotulo>Por qué se cierra</Rotulo>
            <select
              value={motivo}
              onChange={(ev) => setMotivo(ev.target.value as MotivoCierre)}
              className={`ancho-nombre mt-1 ${CLASE_CONTROL}`}
            >
              <option value="">Elija el motivo…</option>
              {motivos.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.rotulo}
                </option>
              ))}
            </select>
          </label>
        )}

        {a && (
          <>
            <textarea
              value={nota}
              onChange={(ev) => setNota(ev.target.value)}
              rows={2}
              placeholder="Qué pasó (opcional, salvo al reabrir)"
              className={CLASE_CONTROL}
            />
            <div>
              <Boton type="submit" disabled={yendo}>
                {yendo ? "Moviendo…" : `Pasar a ${ROTULO_ETAPA[a]}`}
              </Boton>
            </div>
          </>
        )}
      </form>
    </section>
  );
}

/// Cómo contactarlo. Con enlaces que marcan y escriben: el asesor
/// está en el CRM para llamar, no para copiar un número a mano.
function Contacto({ ficha }: { ficha: FichaDeOportunidad }) {
  const p = ficha.persona;
  const e = ficha.empresa;
  if (!p && !e) return null;

  const celular = p?.celular ?? null;
  const soloDigitos = celular?.replace(/\D/g, "") ?? "";

  return (
    <section>
      <Rotulo>Contacto</Rotulo>
      {/* Los rótulos de la izquierda en versalita y el dato en el
          cuerpo: antes eran los dos del mismo tamaño y del mismo
          gris, y una lista así no tiene jerarquía, tiene renglones. */}
      <dl className="mt-2 grid gap-1.5">
        {e && (
          <Renglon rotulo="Empresa">
            {/* A su ficha: los demás negocios de la empresa y a quién
                más se puede llamar allí. */}
            <Link href={`/admin/cuentas/${e.id}`} className="text-marca underline">
              {e.razonSocial}
            </Link>
          </Renglon>
        )}
        {e && (
          <Renglon rotulo="NIT">
            <span className="tabular-nums">{e.nit}</span>
          </Renglon>
        )}
        {p?.correo && (
          <Renglon rotulo="Correo">
            <a href={`mailto:${p.correo}`} className="text-marca underline">
              {p.correo}
            </a>
          </Renglon>
        )}
        {celular && (
          <Renglon rotulo="Celular">
            <span className="flex flex-wrap gap-3">
              <a
                href={`tel:+57${soloDigitos}`}
                className="tabular-nums text-marca underline"
              >
                {celular}
              </a>
              {/* Colombia vende por WhatsApp: el 94 % de la gente lo
                  usa como canal principal. Un enlace directo ahorra
                  el copiar-pegar que nadie hace. */}
              <a
                href={`https://wa.me/57${soloDigitos}`}
                target="_blank"
                rel="noreferrer"
                className="text-marca underline"
              >
                WhatsApp
              </a>
            </span>
          </Renglon>
        )}
        {/* Por dónde entró. Un formulario publicado es una campaña, y
            que la puerta se vea aquí y en la lista igual es lo que
            hace que «de dónde vienen» no parezca un informe aparte. */}
        <Renglon rotulo="Vino por">
          <Puerta campana={ficha.campana} />
        </Renglon>
      </dl>
    </section>
  );
}

function Renglon({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 pt-[3px]">
        <Rotulo>{rotulo}</Rotulo>
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/// Una nota suelta, sin agendar nada. Es «hablé con ella en el
/// ascensor y el presupuesto sale en marzo»: no es un compromiso,
/// pero es justo lo que hay que releer antes de volver a llamar.
function Anotar({
  ficha,
  alHecho,
}: {
  ficha: FichaDeOportunidad;
  alHecho: () => void;
}) {
  const [nota, setNota] = useState("");
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /// Si no se guarda, se DICE. Antes el `try` no tenía `catch`: el
  /// botón volvía a «Guardar nota», el texto seguía en la caja y
  /// nada más, y eso se lee igual que «ya quedó» —hasta que alguien
  /// busca la nota en el historial antes de llamar y no está—. El
  /// texto no se borra al fallar, para no hacerlo escribir dos veces.
  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (nota.trim().length < 2) return;
    setYendo(true);
    setError(null);
    try {
      await oportunidadesApi.anotar(ficha.id, nota.trim());
      setNota("");
      alHecho();
    } catch (e) {
      /// Un 4xx trae el porqué en español, y sirve; un 5xx o una
      /// red caída traen, como mucho, «Internal server error», que
      /// no le dice nada a un asesor.
      setError(
        e instanceof ErrorApi && e.estado < 500
          ? `No pudimos guardar la nota. ${e.message}`
          : "No pudimos guardar la nota. Lo que escribió sigue aquí; inténtelo otra vez.",
      );
    } finally {
      setYendo(false);
    }
  }

  return (
    <form onSubmit={guardar}>
      <Rotulo>Nota</Rotulo>
      {error && (
        <div className="mt-2">
          <Falla>{error}</Falla>
        </div>
      )}
      {/* El mismo tope que `NotaDto` en el servidor. Sin él, pasarse
          se enteraba al guardar, y en el inglés del validador. */}
      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Qué se habló"
        className={`mt-2 ${CLASE_CONTROL}`}
      />
      <div className="mt-2">
        <Boton type="submit" disabled={yendo || nota.trim().length < 2}>
          {yendo ? "Guardando…" : "Guardar nota"}
        </Boton>
      </div>
    </form>
  );
}

/**
 * Todo lo que le pasó, en orden.
 *
 * Es la mitad del valor de la ficha: la etapa dice DÓNDE está el
 * negocio y esto dice POR QUÉ. Cuando se cae, es lo único que
 * permite reconstruir dónde se enfrió.
 */
function Historial({ ficha }: { ficha: FichaDeOportunidad }) {
  if (ficha.movimientos.length === 0) return null;

  return (
    <section>
      <Rotulo>Historial</Rotulo>
      <ol className="mt-2 flex flex-col gap-3">
        {ficha.movimientos.map((m) => {
          const movio = m.de !== null && m.de !== m.a;
          return (
            <li key={m.id} className="flex gap-3">
              <span className="micro w-24 shrink-0 pt-[2px]">
                <Fecha iso={m.creadoEn} />
              </span>
              <span className="min-w-0">
                {movio ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-texto-suave">
                      {m.de ? ROTULO_ETAPA[m.de] : "—"}
                    </span>
                    <span className="text-texto-suave">→</span>
                    <Etapa etapa={m.a} rotulo={ROTULO_ETAPA[m.a]} />
                  </span>
                ) : (
                  <span className="text-texto-suave">Nota</span>
                )}
                {m.nota && <span className="block">{m.nota}</span>}
                <span className="micro block">
                  {m.actorNombre}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/// Cuánto lleva sin que nadie la toque, para la lista. Vive aquí
/// porque el cajón y la lista lo dicen igual: una sola unidad, la
/// mayor, tal como manda el contrato del reloj.
export function quietaDesde(ultimoToqueEn: string, ahora: number): string {
  return relojEnTexto(
    Math.round((ahora - new Date(ultimoToqueEn).getTime()) / 60_000),
  );
}
