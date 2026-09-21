"use client";

/** Abrir un negocio a mano, desde el embudo. */

/**
 * POR QUÉ EXISTE.
 *
 * El servidor sabía crear un negocio desde el primer día —`POST
 * /admin/oportunidades`, con su escalera y su bitácora— y ningún botón
 * del panel lo llamaba. Los negocios solo nacían de lo que entraba por
 * un formulario público, y el que llegaba por otro lado —la llamada
 * del rector, el correo que reenvía un aliado, la renovación de las
 * licencias del año pasado— se quedaba en una libreta o en la memoria
 * del asesor. Lo que no está en el embudo no suma al pronóstico, y lo
 * que no suma al pronóstico no se trabaja.
 *
 * Un CAJÓN y no una página, por lo mismo que la ficha: quien lo abre
 * está mirando el tablero, y al crear quiere ver el negocio nuevo en
 * su columna sin haber salido de ahí.
 *
 * Pide lo mínimo para que el negocio sirva, y nada de lo que se sabe
 * después. El cliente —la empresa o la persona— NO se pide aquí: la
 * escalera lo exige al calificar y no al crear, porque una solicitud
 * entra muchas veces sin más que un nombre. Pedirlo aquí haría que el
 * asesor dejara el negocio en la libreta hasta tenerlo, que es
 * justamente lo que este botón existe para evitar.
 *
 * LA VALIDACIÓN VA AQUÍ Y TAMBIÉN ALLÁ. La de esta pantalla es para
 * que el asesor sepa qué corregir sin esperar al servidor y en su
 * idioma —los mensajes del navegador salen en el del sistema
 * operativo, por eso el formulario lleva `noValidate`—. La cerradura
 * sigue estando en el servidor: cualquier cosa que él rechace se
 * enseña tal cual, porque dice QUÉ falta.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Cajon } from "@/components/admin/cajon";
import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  useAdmin,
} from "@/components/admin/marco-admin";
import { BotonSuave } from "@/components/admin/piezas";
import { useToast } from "@/components/admin/toast";
import { alcanza } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import { crmApi } from "@/lib/crm-api";
import {
  enPesos,
  oportunidadesApi,
  type TipoEmbudo,
} from "@/lib/oportunidades-api";
import { FAMILIAS, serviciosApi, type Servicio } from "@/lib/servicios-api";

/// Los dos embudos, con lo que distingue a uno del otro AL CREAR.
///
/// En el tablero la segunda línea dice el ciclo —semanas o días—,
/// que es lo que importa al mirarlo. Aquí importa otra cosa: a quién
/// se le vende. Un colegio es una organización aunque se llame
/// «Educación», y sin esta línea el asesor que vende licencias de
/// Education a un colegio duda si va en «Empresas».
const EMBUDOS: Array<{ valor: TipoEmbudo; rotulo: string; abajo: string }> = [
  { valor: "EMPRESA", rotulo: "Empresas", abajo: "Colegio, empresa o entidad" },
  { valor: "PERSONA", rotulo: "Personas", abajo: "Una persona natural" },
];

/// El tope de la columna, no uno inventado.
///
/// `valor` es `Decimal(14, 2)` en la base: doce cifras enteras. El
/// DTO no le pone techo, así que un cero de más no lo rechaza la
/// validación sino la base, con un error 500 que no dice nada. Aquí
/// se ataja antes y con la frase que sí sirve.
const VALOR_MAXIMO = 999_999_999_999;

/// `cantidad` es un `Int` de la base, que se desborda pasados los dos
/// mil millones y otra vez con un 500. Un millón de licencias ya es
/// más que todo el mercado colombiano de Workspace: lo que pase de
/// ahí es un dedo que se quedó pegado en el cero.
const CANTIDAD_MAXIMA = 1_000_000;

/// El mismo techo que `CrearOportunidadDto.titulo`.
const TITULO_MAXIMO = 160;

/// Cuánto hacia delante se admite la fecha de cierre.
///
/// El `<input type="date">` de Chrome deja escribir años de cinco
/// cifras, y «20266» es un error de teclado muy común. Un negocio que
/// se espera cerrar en más de cinco años no es un negocio del embudo.
const ANOS_HACIA_DELANTE = 5;

type Borrador = {
  titulo: string;
  embudo: TipoEmbudo;
  /// Solo se usa cuando la cuenta ve varias líneas de negocio y no
  /// ha elegido ninguna arriba. Con una sola, manda esa.
  convenioId: string;
  servicioId: string;
  /// Texto y no número: se admite «1.200» igual que «1200», y el
  /// número se saca al validar. Con `type="number"` el punto de los
  /// miles de Colombia no se deja escribir.
  cantidad: string;
  valor: string;
  /// `AAAA-MM-DD`, tal como lo da el calendario.
  cierre: string;
  asesorId: string;
};

type Clave = keyof Borrador;
type Errores = Partial<Record<Clave, string>>;

/// En el orden en que se ven. Al fallar, el foco va al primero de
/// esta lista que tenga error: quien usa teclado o lector de
/// pantalla no tiene que buscar dónde está lo que falta.
const ORDEN: Clave[] = [
  "titulo",
  "embudo",
  "convenioId",
  "servicioId",
  "cantidad",
  "valor",
  "cierre",
  "asesorId",
];

type Asesor = { id: string; nombre: string };

function vacio(embudo: TipoEmbudo): Borrador {
  return {
    titulo: "",
    embudo,
    convenioId: "",
    servicioId: "",
    cantidad: "",
    valor: "",
    cierre: "",
    asesorId: "",
  };
}

/// Si no se ha escrito nada. El embudo no cuenta: viene puesto.
function estaVacio(b: Borrador): boolean {
  return ORDEN.every((clave) => clave === "embudo" || b[clave] === "");
}

/// La fecha de HOY en el calendario de quien mira, como `AAAA-MM-DD`.
///
/// A mano y no con `toISOString()`: esa da la fecha de Londres, y de
/// siete de la noche en adelante en Colombia ya es mañana. El asesor
/// que crea un negocio a las ocho vería rechazada la fecha de hoy.
function fechaLocal(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/**
 * Un entero escrito como lo escribe una persona.
 *
 * «1200000», «1.200.000» y «$ 1.200.000» son lo mismo. Vacío es
 * `null`: no se dijo. Lo que no se entiende devuelve `undefined` y
 * NO se adivina: «1,5» puede ser uno y medio o mil quinientos según
 * quién lo escriba, y un valor adivinado es un pronóstico falso.
 */
function leerEntero(texto: string): number | null | undefined {
  const limpio = texto.replace(/[\s$]/g, "");
  if (limpio === "") return null;
  if (/^\d+$/.test(limpio)) return Number(limpio);
  if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) return Number(limpio.replace(/\./g, ""));
  return undefined;
}

type Listo = {
  embudo: TipoEmbudo;
  titulo: string;
  convenioId: string;
  valor: number | null;
  cierre: string | null;
  asesorId: string | null;
  servicioId: string | null;
  cantidad: number | null;
};

/**
 * Revisar el borrador entero, de una vez.
 *
 * Pura y aparte del componente: no mira el estado ni la hora, se le
 * pasa todo. Así las reglas se leen juntas y en un solo sitio, que
 * es donde hay que venir a cambiarlas.
 *
 * Devuelve TODOS los errores y no el primero: corregir un campo,
 * pulsar, descubrir el siguiente y volver a pulsar es la forma más
 * rápida de que alguien abandone un formulario.
 */
function revisar(
  b: Borrador,
  contexto: {
    convenioId: string | null;
    hoy: string;
    servicios: Servicio[] | null;
    asesores: Asesor[] | null;
  },
): { errores: Errores; listo: Listo | null } {
  const errores: Errores = {};

  /// Los espacios de más no son letras: «   ab» pasaría el mínimo
  /// del servidor —que cuenta antes de recortar— y quedaría
  /// guardado un título de dos letras.
  const titulo = b.titulo.trim().replace(/\s+/g, " ");
  if (titulo.length < 3) {
    errores.titulo = "Escriba qué se le está vendiendo: al menos tres letras.";
  } else if (titulo.length > TITULO_MAXIMO) {
    errores.titulo = `El título pasa de ${TITULO_MAXIMO} letras. Lo largo va en una nota de la ficha.`;
  }

  if (!contexto.convenioId) {
    errores.convenioId = "Elija la línea de negocio.";
  }

  /// El portafolio pudo cambiar con el cajón abierto, o el borrador
  /// venir de antes de que alguien ocultara el servicio.
  if (
    b.servicioId &&
    contexto.servicios &&
    !contexto.servicios.some((s) => s.id === b.servicioId)
  ) {
    errores.servicioId = "Ese servicio ya no se oferta. Elija otro del portafolio.";
  }

  const cantidad = leerEntero(b.cantidad);
  if (cantidad === undefined || cantidad === 0) {
    errores.cantidad = "La cantidad va en números enteros, desde 1.";
  } else if (cantidad !== null && cantidad > CANTIDAD_MAXIMA) {
    errores.cantidad = "Pasa de un millón: revise que no le sobren ceros.";
  } else if (cantidad !== null && !b.servicioId && !errores.servicioId) {
    /// El error va en el SERVICIO, que es lo que hay que tocar. Una
    /// cantidad sin servicio es un número suelto: 250 ¿qué? En el
    /// informe de «qué se vende más» no cuenta en ninguna fila.
    errores.servicioId = "Elija el servicio: sin él no se sabe qué cuenta la cantidad.";
  }

  const valor = leerEntero(b.valor);
  if (valor === undefined) {
    errores.valor = "Escriba el valor en pesos enteros, sin centavos: 1200000 o 1.200.000.";
  } else if (valor !== null && valor > VALOR_MAXIMO) {
    errores.valor = "Ese valor pasa de 999.999.999.999 pesos: revise que no le sobren ceros.";
  }

  if (b.cierre) {
    /// Ida y vuelta por `Date`: un 31 de febrero escrito a mano
    /// pasaría el patrón y el servidor lo movería al 3 de marzo.
    const leida = new Date(`${b.cierre}T12:00:00`);
    const tope = `${Number(contexto.hoy.slice(0, 4)) + ANOS_HACIA_DELANTE}${contexto.hoy.slice(4)}`;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(b.cierre) ||
      Number.isNaN(leida.getTime()) ||
      fechaLocal(leida) !== b.cierre
    ) {
      errores.cierre = "Esa fecha no se entiende. Elíjala en el calendario.";
    } else if (b.cierre < contexto.hoy) {
      /// No es capricho: el tablero marca como «muerto viviente»
      /// todo negocio abierto cuya fecha de cierre ya pasó. Uno que
      /// nace con la fecha vencida nace marcado.
      errores.cierre = "Esa fecha ya pasó. Un negocio nuevo con la fecha vencida nace marcado como muerto viviente.";
    } else if (b.cierre > tope) {
      errores.cierre = "Esa fecha está a más de cinco años: revise el año.";
    }
  }

  /// Quien estaba en la lista puede no estar ya: se cambió de
  /// línea de negocio, o lo desactivaron con el cajón abierto.
  if (
    b.asesorId &&
    contexto.asesores &&
    !contexto.asesores.some((a) => a.id === b.asesorId)
  ) {
    errores.asesorId = "Esa persona no lleva negocios en esta línea. Elija otra o déjelo sin asignar.";
  }

  if (Object.keys(errores).length > 0 || !contexto.convenioId) {
    return { errores, listo: null };
  }

  return {
    errores,
    listo: {
      embudo: b.embudo,
      titulo,
      convenioId: contexto.convenioId,
      valor: valor ?? null,
      cierre: b.cierre || null,
      asesorId: b.asesorId || null,
      servicioId: b.servicioId || null,
      cantidad: cantidad ?? null,
    },
  };
}

/**
 * El error de un campo, pegado a él.
 *
 * Sin caja y sin rojo, igual que `Falla` en la ficha y `Aviso` en el
 * marco: el rojo de este panel significa una sola cosa —que alguien
 * lleva esperando respuesta— y una validación no es eso. Lo que lo
 * distingue es el peso 600 y que sale justo debajo de donde se está
 * escribiendo.
 */
function Fallo({ id, texto }: { id: string; texto?: string }) {
  if (!texto) return null;
  return (
    <span id={id} className="estado mt-1.5 block text-titulo">
      {texto}
    </span>
  );
}

/**
 * El botón «Nuevo negocio» y su cajón.
 *
 * El borrador vive AQUÍ y no dentro del cajón. Cerrar con Escape, con
 * la equis o pinchando fuera no borra lo escrito: son gestos que se
 * hacen sin querer, y perder un formulario a medias por rozar el
 * fondo es de lo que más enfada. «Cancelar» sí lo descarta, porque
 * es lo que dice.
 */
export function NuevoNegocio({
  embudo = "EMPRESA",
  alCrear,
}: {
  /// El que se está mirando. El negocio nace en ese, que es lo que se
  /// espera, y dentro del cajón se puede cambiar.
  embudo?: TipoEmbudo;
  /// Se llama con el negocio ya creado. El segundo dato es el embudo
  /// en el que quedó: si no es el de la pestaña, quien monta esto
  /// sabrá que tiene que cambiar de pestaña para enseñarlo.
  alCrear: (id: string, embudo: TipoEmbudo) => void;
}) {
  const { admin, gremio, gremios } = useAdmin();
  const toast = useToast();

  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState<Borrador>(() => vacio(embudo));
  const [errores, setErrores] = useState<Errores>({});
  /// Lo que rechazó el servidor. Va al pie, junto al botón: el
  /// formulario se desplaza y un aviso arriba del todo quedaría
  /// fuera de la vista justo después de pulsar.
  const [falla, setFalla] = useState<string | null>(null);
  const [yendo, setYendo] = useState(false);
  /// Se fija al abrir y no se calcula al pintar: `new Date()` durante
  /// el render es impuro —React lo señala— y daría un «hoy» distinto
  /// en cada repintado.
  const [hoy, setHoy] = useState("");
  const [portafolio, setPortafolio] = useState<{ lista: Servicio[]; fallo: boolean } | null>(null);
  /// De qué línea es la lista de asesores. Cambia con ella: quien
  /// lleva negocios en una no tiene por qué llevarlos en la otra.
  const [asesores, setAsesores] = useState<{ de: string; lista: Asesor[] | null } | null>(null);

  /// Doble clic, o Enter dos veces seguidas. El `disabled` del botón
  /// llega un repintado tarde y en ese hueco caben dos peticiones,
  /// o sea dos negocios iguales en la columna.
  const enVuelo = useRef(false);

  /// Cada control se encuentra por su id, no por una ref: para
  /// llevarle el foco basta el id, y un mapa de refs rellenado desde
  /// el render es justo lo que el compilador de React prohíbe.
  const base = useId();
  const idFormulario = `${base}-formulario`;
  const idBoton = `${base}-boton`;
  const idCampo = (clave: Clave) => `${base}-campo-${clave}`;
  const idError = (clave: Clave) => `${base}-error-${clave}`;

  /// La línea de negocio: la elegida arriba o la única que tenga la
  /// cuenta. Es la misma regla que Campañas. Solo cuando no hay
  /// ninguna de las dos se pregunta dentro del cajón.
  const lineaFija =
    gremio ?? (gremios.length === 1 ? gremios[0].convenioId : null);
  const convenioId = lineaFija ?? (borrador.convenioId || null);
  const sinLineas = !lineaFija && gremios.length === 0;

  /// Estable a propósito. `Cajon` vuelve a correr su efecto —y a
  /// robarle el foco al campo en el que se está escribiendo— cada
  /// vez que cambia la función que recibe.
  const cerrar = useCallback(() => {
    /// Mientras se está creando no se cierra. Si la petición falla
    /// con el cajón ya cerrado, el motivo se pinta en un pie que
    /// nadie ve, y quien lo cerró cree que el negocio quedó hecho.
    /// Es un segundo de espera, no más.
    if (enVuelo.current) return;
    setAbierto(false);
    /// El foco vuelve al botón que abrió el cajón. Sin esto se queda
    /// en el `body` y quien va con teclado empieza la página de
    /// cero. Sin desplazar: el botón ya está a la vista.
    document.getElementById(idBoton)?.focus({ preventScroll: true });
  }, [idBoton]);

  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    serviciosApi
      .visibles()
      .then((lista) => {
        if (vivo) setPortafolio({ lista, fallo: false });
      })
      .catch(() => {
        if (vivo) setPortafolio({ lista: [], fallo: true });
      });
    return () => {
      vivo = false;
    };
  }, [abierto]);

  /// Los asesores salen de la misma regla que usa el servidor para
  /// decidir quién lleva fichas en una línea —`quien-lleva-fichas`—,
  /// vía las opciones de la ficha. Ofrecer a alguien fuera de esa
  /// regla sería dejar el negocio con un dueño que no lo puede ver.
  useEffect(() => {
    if (!abierto || !convenioId) return;
    let vivo = true;
    crmApi
      .opciones(convenioId)
      .then((o) => {
        if (vivo) {
          setAsesores({
            de: convenioId,
            lista: o.asesores.map((a) => ({ id: a.id, nombre: a.nombre })),
          });
        }
      })
      .catch(() => {
        if (vivo) setAsesores({ de: convenioId, lista: null });
      });
    return () => {
      vivo = false;
    };
  }, [abierto, convenioId]);

  /// Al abrir, el foco va al título: es lo único obligatorio y lo
  /// primero que se escribe. Este efecto corre DESPUÉS del de
  /// `Cajon` —los hijos primero—, que es el que se lo lleva a la caja.
  useEffect(() => {
    if (abierto) document.getElementById(`${base}-campo-titulo`)?.focus();
  }, [abierto, base]);

  const puedeCrear =
    admin.rol === "SUPERADMIN" ||
    (admin.rol === "GESTOR" && alcanza(admin.permisos?.inscripciones, "ESCRIBIR"));

  /// Sin permiso de escritura no se ofrece. No es la cerradura —esa
  /// está en el servidor, `@Requiere('inscripciones', 'ESCRIBIR')`—:
  /// es no enseñar un botón que va a terminar en un 403.
  if (!puedeCrear) return null;

  function abrir() {
    setHoy(fechaLocal(new Date()));
    setFalla(null);
    /// Un borrador sin tocar sigue a la pestaña: si se abrió desde
    /// «Personas», nace en personas. Uno a medias se respeta tal
    /// cual, con el embudo que se le eligió.
    setBorrador((b) => (estaVacio(b) ? { ...b, embudo } : b));
    setAbierto(true);
  }

  function descartar() {
    setBorrador(vacio(embudo));
    setErrores({});
    setFalla(null);
    cerrar();
  }

  function cambiar<K extends Clave>(clave: K, valor: Borrador[K]) {
    setBorrador((b) => ({
      ...b,
      [clave]: valor,
      /// Otra línea, otros asesores: el elegido puede no llevar
      /// negocios en la nueva.
      ...(clave === "convenioId" ? { asesorId: "" } : {}),
    }));
    /// El error de ese campo se va al tocarlo. Seguir diciendo «esa
    /// fecha ya pasó» mientras se está corrigiendo parece que el
    /// sistema no se enteró.
    setErrores((e) => {
      if (!e[clave]) return e;
      const resto = { ...e };
      delete resto[clave];
      return resto;
    });
  }

  const asesoresDeLaLinea =
    asesores && asesores.de === convenioId ? asesores.lista : null;
  const cargandoAsesores = !!convenioId && (!asesores || asesores.de !== convenioId);

  async function crear(evento: React.FormEvent) {
    evento.preventDefault();
    if (enVuelo.current) return;

    const { errores: encontrados, listo } = revisar(borrador, {
      convenioId,
      /// Otra vez aquí y no el de al abrir: el cajón puede llevar
      /// abierto desde antes de medianoche.
      hoy: fechaLocal(new Date()),
      servicios: portafolio && !portafolio.fallo ? portafolio.lista : null,
      asesores: asesoresDeLaLinea,
    });
    setErrores(encontrados);
    setFalla(null);

    if (!listo) {
      const primero = ORDEN.find((clave) => encontrados[clave]);
      /// El embudo nunca falla —siempre hay uno elegido— y no tiene
      /// id propio: son dos botones. Todos los demás sí.
      if (primero) document.getElementById(idCampo(primero))?.focus();
      return;
    }

    enVuelo.current = true;
    setYendo(true);

    let creado: { id: string; codigo: string };
    try {
      /// Solo lo que se dijo. Un `valor: 0` o un `asesorId: ""`
      /// mandados «por si acaso» no son lo mismo que no decirlo: el
      /// primero afirma que el negocio vale cero y el segundo el
      /// servidor lo tomaría como un id.
      creado = await oportunidadesApi.crear({
        embudo: listo.embudo,
        titulo: listo.titulo,
        convenioId: listo.convenioId,
        ...(listo.valor !== null ? { valor: listo.valor } : {}),
        ...(listo.cierre ? { cierreEsperado: listo.cierre } : {}),
        ...(listo.asesorId ? { asesorId: listo.asesorId } : {}),
      });
    } catch (e) {
      /// El servidor dice QUÉ falta; se enseña tal cual.
      setFalla(
        e instanceof ErrorApi
          ? e.message
          : "No pudimos crear el negocio. Revise la conexión y vuelva a intentarlo.",
      );
      enVuelo.current = false;
      setYendo(false);
      return;
    }

    /**
     * El servicio y la cantidad, en un segundo paso.
     *
     * No es lo ideal y hay que decirlo: `CrearOportunidadDto` no los
     * acepta —y con `forbidNonWhitelisted` mandarlos tumbaría la
     * creación entera—, así que van por la edición de la ficha, que
     * sí los conoce y comprueba el servicio contra el portafolio.
     *
     * Si este paso falla, el negocio YA EXISTE. Por eso no se deja el
     * cajón abierto con un error: volver a pulsar «Crear» haría un
     * segundo negocio igual. Se cierra, se avisa de qué quedó sin
     * guardar y la ficha —donde se completa— es lo que se abre.
     */
    let pendiente: string | null = null;
    if (listo.servicioId || listo.cantidad !== null) {
      try {
        await oportunidadesApi.actualizar(creado.id, {
          ...(listo.servicioId ? { servicioId: listo.servicioId } : {}),
          ...(listo.cantidad !== null ? { cantidad: listo.cantidad } : {}),
        });
      } catch (e) {
        const que =
          listo.servicioId && listo.cantidad !== null
            ? "el servicio y la cantidad"
            : listo.servicioId
              ? "el servicio"
              : "la cantidad";
        const porque =
          e instanceof ErrorApi ? e.message.replace(/\.?$/, ".") : "No hubo respuesta del servidor.";
        pendiente = `El negocio ${creado.codigo} quedó creado, pero no se le guardó ${que}: ${porque} Complételo en su ficha.`;
      }
    }

    if (pendiente) toast.error(pendiente);
    else toast.exito(`Negocio ${creado.codigo} creado en «Solicitud de negocio».`);

    setBorrador(vacio(embudo));
    setErrores({});
    enVuelo.current = false;
    setYendo(false);
    setAbierto(false);
    alCrear(creado.id, listo.embudo);
  }

  /// Lo que se liga a cada control: su id —para llevarle el foco— y
  /// el error, para que el lector de pantalla lo lea con el campo y
  /// no como un texto suelto más abajo.
  const accesible = (clave: Clave) => ({
    id: idCampo(clave),
    "aria-invalid": errores[clave] ? true : undefined,
    "aria-describedby": errores[clave] ? idError(clave) : undefined,
  });

  const servicios = portafolio?.lista ?? [];
  const unidad = servicios.find((s) => s.id === borrador.servicioId)?.unidad ?? null;
  const valorLeido = leerEntero(borrador.valor);

  return (
    <>
      <Boton id={idBoton} type="button" onClick={abrir}>
        Nuevo negocio
      </Boton>

      {abierto && (
        <Cajon
          titulo="Nuevo negocio"
          subtitulo="Nace en «Solicitud de negocio»."
          alCerrar={cerrar}
          pie={
            <div className="flex flex-col gap-3">
              {falla && <Aviso tipo="error">{falla}</Aviso>}
              <div className="flex flex-wrap items-center gap-3">
                {/* Fuera del `<form>` y ligado por `form`: el pie
                    no se desplaza con el formulario, y así el botón
                    está a la vista aunque el cajón no quepa. */}
                <Boton
                  type="submit"
                  form={idFormulario}
                  disabled={yendo || sinLineas}
                >
                  {yendo ? "Creando…" : "Crear negocio"}
                </Boton>
                <BotonSuave type="button" onClick={descartar} disabled={yendo}>
                  Cancelar
                </BotonSuave>
              </div>
            </div>
          }
        >
          <form
            id={idFormulario}
            onSubmit={crear}
            noValidate
            className="grid grid-cols-1 gap-4 sm:grid-cols-6"
          >
            {sinLineas && (
              <div className="sm:col-span-6">
                <Aviso tipo="error">
                  Su cuenta no tiene ninguna línea de negocio asignada. Pídale
                  a quien administra el panel que le asigne una en Usuarios.
                </Aviso>
              </div>
            )}

            <div className="sm:col-span-6">
              <Campo etiqueta="Título">
                <input
                  value={borrador.titulo}
                  onChange={(e) => cambiar("titulo", e.target.value)}
                  maxLength={TITULO_MAXIMO}
                  autoComplete="off"
                  placeholder="Ej.: 250 licencias de Workspace for Education"
                  className={CLASE_CONTROL}
                  {...accesible("titulo")}
                />
                <Fallo id={idError("titulo")} texto={errores.titulo} />
              </Campo>
            </div>

            {/* Un grupo y no un `Campo`: son dos botones y `Campo` es
                una `<label>`, que solo puede nombrar a UN control. */}
            <fieldset className="sm:col-span-6">
              <legend className="rotulo-bloque mb-1.5 block">Embudo</legend>
              <div className="flex flex-wrap gap-2">
                {EMBUDOS.map((e) => {
                  const elegido = borrador.embudo === e.valor;
                  return (
                    <button
                      key={e.valor}
                      type="button"
                      onClick={() => cambiar("embudo", e.valor)}
                      aria-pressed={elegido}
                      className={
                        "rounded-xs border px-3 py-2 text-left transition-colors " +
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-campo-foco " +
                        (elegido
                          ? "border-marca bg-marca text-marca-texto"
                          : "border-borde text-texto hover:bg-superficie-alterna")
                      }
                    >
                      <span className="block text-[0.8125rem] leading-[1.4]">
                        {e.rotulo}
                      </span>
                      <span
                        className={
                          "block text-[0.65625rem] leading-[1.3] tracking-[0.02em] " +
                          (elegido ? "" : "text-texto-suave")
                        }
                      >
                        {e.abajo}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Solo cuando hay que elegirla. Con una línea elegida
                arriba —o una sola en la cuenta— preguntarla es gastar
                un campo en algo que ya está decidido. */}
            {!lineaFija && gremios.length > 1 && (
              <div className="sm:col-span-6">
                <Campo etiqueta="Línea de negocio">
                  <select
                    value={borrador.convenioId}
                    onChange={(e) => cambiar("convenioId", e.target.value)}
                    className={CLASE_CONTROL}
                    {...accesible("convenioId")}
                  >
                    <option value="">Elija una…</option>
                    {gremios.map((g) => (
                      <option key={g.convenioId} value={g.convenioId}>
                        {g.sigla}
                      </option>
                    ))}
                  </select>
                  <Fallo id={idError("convenioId")} texto={errores.convenioId} />
                </Campo>
              </div>
            )}

            <div className="sm:col-span-4">
              <Campo
                etiqueta="Servicio del portafolio"
                ayuda={
                  portafolio?.fallo && !errores.servicioId
                    ? "No pudimos traer el portafolio. Puede elegirlo después, en la ficha."
                    : undefined
                }
              >
                <select
                  value={borrador.servicioId}
                  onChange={(e) => cambiar("servicioId", e.target.value)}
                  className={CLASE_CONTROL}
                  {...accesible("servicioId")}
                >
                  <option value="">
                    {portafolio ? "Todavía no se sabe" : "Trayendo el portafolio…"}
                  </option>
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
                <Fallo id={idError("servicioId")} texto={errores.servicioId} />
              </Campo>
            </div>

            <div className="sm:col-span-2">
              <Campo etiqueta={unidad ? `Cantidad (${unidad})` : "Cantidad"}>
                <input
                  value={borrador.cantidad}
                  onChange={(e) => cambiar("cantidad", e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  className={`${CLASE_CONTROL} tabular-nums`}
                  {...accesible("cantidad")}
                />
                <Fallo id={idError("cantidad")} texto={errores.cantidad} />
              </Campo>
            </div>

            <div className="sm:col-span-3">
              <Campo
                etiqueta="Valor cotizado (COP)"
                /// La cifra ya formateada debajo, mientras se escribe.
                /// Con nueve cifras seguidas nadie distingue a ojo 12
                /// millones de 120: aquí se ve el punto de los miles
                /// antes de guardar.
                ayuda={
                  !errores.valor && typeof valorLeido === "number" && valorLeido > 0
                    ? enPesos(valorLeido)
                    : undefined
                }
              >
                <input
                  value={borrador.valor}
                  onChange={(e) => cambiar("valor", e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  className={`${CLASE_CONTROL} tabular-nums`}
                  {...accesible("valor")}
                />
                <Fallo id={idError("valor")} texto={errores.valor} />
              </Campo>
            </div>

            <div className="sm:col-span-3">
              <Campo etiqueta="Cierre esperado">
                <input
                  type="date"
                  value={borrador.cierre}
                  min={hoy || undefined}
                  onChange={(e) => cambiar("cierre", e.target.value)}
                  className={`${CLASE_CONTROL} tabular-nums`}
                  {...accesible("cierre")}
                />
                <Fallo id={idError("cierre")} texto={errores.cierre} />
              </Campo>
            </div>

            <div className="sm:col-span-6">
              <Campo
                etiqueta="Asesor"
                ayuda={
                  convenioId && asesores?.de === convenioId && asesores.lista === null
                    ? "No pudimos traer los asesores. Puede asignarlo después, en la ficha."
                    : undefined
                }
              >
                <select
                  value={borrador.asesorId}
                  onChange={(e) => cambiar("asesorId", e.target.value)}
                  disabled={!convenioId}
                  className={CLASE_CONTROL}
                  {...accesible("asesorId")}
                >
                  <option value="">
                    {!convenioId
                      ? "Elija primero la línea de negocio"
                      : cargandoAsesores
                        ? "Trayendo los asesores…"
                        : "Sin asignar todavía"}
                  </option>
                  {(asesoresDeLaLinea ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {/* Quien crea el negocio suele ser quien lo
                          va a llevar: se le reconoce en la lista sin
                          tener que buscar su propio nombre. */}
                      {a.id === admin.id ? `${a.nombre} (usted)` : a.nombre}
                    </option>
                  ))}
                </select>
                <Fallo id={idError("asesorId")} texto={errores.asesorId} />
              </Campo>
            </div>
          </form>
        </Cajon>
      )}
    </>
  );
}
