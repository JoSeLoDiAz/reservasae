/**
 * QUE SUENE Y SE VEA CUANDO LLEGA UN AVISO.
 *
 * «Que quien usa el CRM autorice las notificaciones, y que suene o
 * muestre una alerta con base a las notificaciones que definió José»
 * (cliente, 28 sep 2026).
 *
 * La campana ya contaba; lo que no hacía era avisar. Quien tiene el
 * CRM en una pestaña de fondo ---que es como se usa--- no se entera
 * de un globo rojo que no ha mirado.
 *
 * TRES DECISIONES QUE CONVIENE SABER:
 *
 * 1. EL PERMISO NO SE PIDE SOLO. Se pide cuando la persona pulsa,
 *    nunca al cargar la página. Un navegador moderno bloquea el aviso
 *    automático, y aunque no lo hiciera, una ventana del sistema sin
 *    que nadie la haya pedido se rechaza por reflejo ---y rechazado
 *    no se puede volver a preguntar desde la página---.
 *
 * 2. EL SONIDO SE SINTETIZA, no se descarga. Un fichero de audio es
 *    un recurso más que puede faltar, que hay que versionar y que
 *    alguien tiene que decidir cómo suena. Dos tonos cortos con el
 *    oscilador del navegador no pesan nada y no se pueden perder.
 *
 * 3. TODO ESTO PUEDE NO EXISTIR. `Notification` no está en algunos
 *    navegadores ni fuera de HTTPS, y `AudioContext` puede estar
 *    bloqueado. Cada llamada de aquí se cae sola sin romper nada: la
 *    campana tiene que seguir contando aunque no haya ni sonido ni
 *    permiso.
 */

/// Dónde se recuerda si esta persona quiere sonido. Es una comodidad
/// por navegador, no un dato del sistema: no viaja al servidor.
const LLAVE_SONIDO = "convoca:avisos:sonido";

export type EstadoDelPermiso = "sin-soporte" | "default" | "granted" | "denied";

/** En qué punto está el permiso del navegador. */
export function estadoDelPermiso(): EstadoDelPermiso {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "sin-soporte";
  }
  return Notification.permission as EstadoDelPermiso;
}

/**
 * Pide el permiso. Solo se puede llamar desde un clic.
 *
 * Devuelve el estado que quedó, que puede ser el mismo: si ya estaba
 * denegado, el navegador ni pregunta ---y hace bien: la única forma
 * de reabrirlo es desde la barra de direcciones---.
 */
export async function pedirPermiso(): Promise<EstadoDelPermiso> {
  if (estadoDelPermiso() === "sin-soporte") return "sin-soporte";
  try {
    return (await Notification.requestPermission()) as EstadoDelPermiso;
  } catch {
    /// Algunos navegadores todavía lo exponen con callback y tiran
    /// al llamarlo como promesa. No es un fallo que haya que contar.
    return estadoDelPermiso();
  }
}

/** Si esta persona quiere que suene. Por omisión, sí. */
export function sonidoEncendido(): boolean {
  try {
    return localStorage.getItem(LLAVE_SONIDO) !== "no";
  } catch {
    /// En ventana privada o con las cookies bloqueadas, leer tira.
    /// Que suene es el comportamiento normal, así que se asume.
    return true;
  }
}

export function guardarSonido(encendido: boolean): void {
  try {
    localStorage.setItem(LLAVE_SONIDO, encendido ? "si" : "no");
  } catch {
    /// Si no se puede guardar, se pierde al recargar y ya está. No
    /// vale la pena romper nada por una preferencia de comodidad.
  }
}

/**
 * Dos tonos cortos, sintetizados.
 *
 * Suena a aviso y no a alarma: son 0,18 segundos en total y el
 * volumen va a la quinta parte. Esto lo oye alguien ocho horas al
 * día, y un sonido que molesta se acaba apagando ---y con él se
 * apaga el aviso---.
 */
export function sonar(): void {
  if (!sonidoEncendido()) return;
  try {
    type ConAudio = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctx =
      window.AudioContext ?? (window as ConAudio).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();

    /// Dos notas, la segunda más alta: sube, que es lo que hace un
    /// aviso de «ha llegado algo» y no uno de «algo va mal».
    [
      { hz: 880, en: 0 },
      { hz: 1174, en: 0.09 },
    ].forEach(({ hz, en }) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.frequency.value = hz;
      osc.type = "sine";
      vol.gain.setValueAtTime(0.0001, ctx.currentTime + en);
      vol.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + en + 0.01);
      vol.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + en + 0.08,
      );
      osc.connect(vol).connect(ctx.destination);
      osc.start(ctx.currentTime + en);
      osc.stop(ctx.currentTime + en + 0.09);
    });

    /// Se cierra el contexto: dejarlos abiertos acumula uno por
    /// aviso y el navegador acaba negándolos.
    setTimeout(() => void ctx.close().catch(() => {}), 400);
  } catch {
    /// Sin audio no pasa nada: el globo de la campana sigue ahí.
  }
}

/**
 * La ventanita del sistema.
 *
 * `tag` la hace REEMPLAZABLE: si llegan tres avisos seguidos no se
 * apilan tres ventanas, se actualiza la misma. Quien vuelve de comer
 * con doce avisos no quiere doce ventanas, quiere saber que hay doce.
 */
export function mostrarAviso(cuantos: number): void {
  if (estadoDelPermiso() !== "granted") return;
  try {
    const n = new Notification("Convoca CRM", {
      body:
        cuantos === 1
          ? "Tiene un aviso nuevo en sus fichas."
          : `Tiene ${cuantos} avisos nuevos en sus fichas.`,
      tag: "convoca-avisos",
      icon: "/favicon.ico",
    });
    /// Al pulsarla, al frente. Sin esto la ventana no lleva a
    /// ninguna parte y la segunda vez ya nadie la pulsa.
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /// Hay navegadores que exigen crearla desde un service worker.
    /// Sin ella queda el sonido y el globo.
  }
}
