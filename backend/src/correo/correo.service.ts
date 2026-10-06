/** Enviar correo por SMTP. */

/// Google Workspace: el dominio grupo-ae.com.co apunta sus MX
/// a smtp.google.com, así que se sale por smtp.gmail.com en
/// el 587 con STARTTLS.
///
/// OJO CON LA CLAVE. Google dejó de aceptar la contraseña
/// normal de la cuenta para esto. Lo que va aquí es una
/// «contraseña de aplicación» de 16 letras, que se saca en
/// myaccount.google.com > Seguridad > Verificación en dos
/// pasos > Contraseñas de aplicaciones. Con la contraseña
/// normal el servidor contesta «Username and Password not
/// accepted» -- y eso no es que esté mal escrita.

import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type SMTPPool from 'nodemailer/lib/smtp-pool';

import { PrismaService } from '../prisma/prisma.service';
import { desvioConfigurado, etiquetaDeReales, resolverDestino } from './desvio';
import { escaparHtml } from './escapar';
import { limpiarNombre, nombreGeneral } from './quien-firma';

/// Sin decir de qué tipo es lo que devuelve, `sendMail` da
/// `any` y el id del mensaje se pierde en una comprobación
/// que no comprueba nada.
///
/// Y es el del POOL, no el suelto: con `pool: true` nodemailer
/// devuelve otra cosa, y el tipo del transporte suelto no le
/// sirve.
type TransporteSmtp = Transporter<SMTPPool.SentMessageInfo, SMTPPool.Options>;

export type Comunicacion = {
  para: string | string[];
  asunto: string;
  /// Texto plano. Si va HTML, se manda también en `html`.
  texto: string;
  html?: string;
  /// A quién le contesta quien lo reciba, si no es el remitente.
  responderA?: string;
  /// Con qué nombre firma. Sin esto, el nombre general.
  deParte?: string;
};

export type Envio =
  /// Con `para` de verdad: si va desviado, el que pidió
  /// quien llama no es el que lo recibió.
  | { estado: 'ENVIADO'; id: string; para: string[]; desviado: boolean }
  | { estado: 'APAGADO' }
  | { estado: 'FALLO'; error: string };

/// Está configurado o no lo está. Sin las tres, no se manda
/// nada y se dice; no se finge que salió.
export function correoConectado(): boolean {
  return Boolean(
    process.env.SMTP_USUARIO &&
    process.env.SMTP_CLAVE &&
    process.env.SMTP_SERVIDOR,
  );
}

@Injectable()
export class CorreoService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Correo');
  private transporte: TransporteSmtp | null = null;

  /// Para dejar constancia en la ficha de que a esa dirección no se
  /// pudo. `PrismaModule` es @Global: no hay que importarlo.
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Decir al arrancar si hay correo o no.
   *
   * Igual que los workers del RUI y del buscador. Sin esto,
   * la única forma de saber si un servidor recién desplegado
   * puede mandar correo era entrar al panel — y un aviso que
   * no sale no se nota hasta que alguien pregunta por qué
   * nunca le llegó.
   *
   * Solo dice si está configurado, no si la clave sirve: eso
   * exige hablar con el servidor, y no vale la pena demorar
   * el arranque por ello. Para eso está la pantalla.
   */
  onModuleInit(): void {
    if (!correoConectado()) {
      this.log.warn(
        'Apagado: faltan SMTP_SERVIDOR, SMTP_USUARIO o SMTP_CLAVE. ' +
          'No va a salir ningún aviso.',
      );
      return;
    }
    this.log.log(
      `Configurado: ${process.env.SMTP_USUARIO} por ${process.env.SMTP_SERVIDOR}. ` +
        'En Configuración > Correo se comprueba que la clave sirva.',
    );

    const desvio = desvioConfigurado();
    if (desvio.length > 0) {
      this.log.warn(
        `DESVIADO: todo el correo va a ${desvio.join(', ')} y no a su ` +
          'destinatario. Se quita borrando CORREO_REDIRIGIR_A.',
      );
    } else if (process.env.ENTORNO === 'prueba') {
      this.log.warn(
        'Entorno de pruebas sin CORREO_REDIRIGIR_A: no va a salir ningún ' +
          'correo, para no escribirle a una persona real desde aquí.',
      );
    }
  }

  private abrir(): TransporteSmtp {
    if (this.transporte) return this.transporte;

    const puerto = Number(process.env.SMTP_PUERTO ?? 587);
    const nuevo: TransporteSmtp = createTransport({
      host: process.env.SMTP_SERVIDOR,
      port: puerto,
      /// 465 va cifrado desde el saludo; 587 empieza en claro
      /// y sube a TLS con STARTTLS. Es lo que espera Google.
      secure: puerto === 465,
      requireTLS: puerto !== 465,
      auth: {
        user: process.env.SMTP_USUARIO,
        pass: process.env.SMTP_CLAVE,
      },
      /// Una conexión reusada para varios correos: abrir una
      /// por mensaje es lo que hace que un proveedor lo tome
      /// por un ataque.
      pool: true,
      maxConnections: 2,
      maxMessages: 50,
    });

    this.transporte = nuevo;
    return nuevo;
  }

  onModuleDestroy() {
    // cerrar el pool no espera a nada
    this.transporte?.close();
  }

  /// De quién sale. Con nombre, porque un correo que llega de
  /// una dirección suelta parece robado.
  private remitente(deParte?: string): string {
    const nombre = limpiarNombre(deParte ?? '') || nombreGeneral();
    const buzon = process.env.SMTP_DESDE ?? process.env.SMTP_USUARIO ?? '';
    return `"${nombre}" <${buzon}>`;
  }

  /**
   * Comprueba que la cuenta entra, sin mandarle nada a nadie.
   *
   * Es el `verify` de SMTP: saluda, se autentica y cuelga.
   * Sirve para saber si la clave sirve antes de que un aviso
   * de cupos se pierda en silencio.
   */
  async probar(): Promise<Envio> {
    if (!correoConectado()) return { estado: 'APAGADO' };
    try {
      await this.abrir().verify();
      return { estado: 'ENVIADO', id: 'verificado', para: [], desviado: false };
    } catch (e) {
      return { estado: 'FALLO', error: this.explicar(e) };
    }
  }

  async enviar(c: Comunicacion): Promise<Envio> {
    if (!correoConectado()) {
      this.log.warn(
        `No se envió «${c.asunto}»: el correo no está configurado ` +
          '(faltan SMTP_SERVIDOR, SMTP_USUARIO o SMTP_CLAVE).',
      );
      return { estado: 'APAGADO' };
    }

    const para = Array.isArray(c.para) ? c.para : [c.para];
    const buenos = para
      .map((p) => p.trim())
      .filter((p) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p));

    if (buenos.length === 0) {
      // no es un fallo del servidor: no había a quién mandarle
      return { estado: 'FALLO', error: 'Ninguna dirección de correo válida.' };
    }

    const destino = resolverDestino(buenos);
    if ('rechazo' in destino) {
      this.log.warn(`No salió «${c.asunto}»: ${destino.rechazo}`);
      return { estado: 'FALLO', error: destino.rechazo };
    }

    const m = destino.reales ? this.marcar(c, destino.reales) : c;

    try {
      const r = await this.abrir().sendMail({
        from: this.remitente(c.deParte),
        to: destino.para.join(', '),
        replyTo: c.responderA,
        subject: m.asunto,
        text: m.texto,
        html: m.html,
      });

      const a = destino.reales
        ? `${destino.para.join(', ')} (iba a ${etiquetaDeReales(destino.reales)})`
        : String(destino.para.length);
      this.log.log(`Enviado «${c.asunto}» a ${a}: ${r.messageId}`);

      /**
       * UN ENVÍO BUENO PUEDE TRAER DIRECCIONES RECHAZADAS.
       *
       * `sendMail` no lanza si el servidor aceptó el mensaje para
       * ALGUNO de los destinatarios: las que rechazó vienen en
       * `rejected` y hasta hoy se tiraban. Mandar a tres y que una
       * rebote es el caso corriente de una lista, y era justo el que
       * no dejaba rastro.
       */
      /**
       * CON DESVÍO PUESTO NO SE APUNTA NADA, y esto lo cazó una
       * prueba antes de salir.
       *
       * En pruebas y en preproducción todo el correo se desvía a un
       * buzón del equipo. Lo que el servidor aceptó o rechazó es ESA
       * dirección, así que apuntarlo marcaría el correo del operador
       * como malo ---y, peor, dejaría la dirección de la persona sin
       * marcar diciendo que está bien---.
       */
      if (destino.reales === null) {
        const rechazadas = (r.rejected ?? []).map(comoTexto).filter(Boolean);
        await this.apuntarLoQueNoSalio(
          rechazadas,
          'el servidor de correo rechazó la dirección',
        );
        /// Y lo que sí salió se limpia: una marca que no se quita se
        /// convierte en una lista de direcciones malas que hace años
        /// que son buenas.
        await this.olvidarElFallo(
          (r.accepted ?? []).map(comoTexto).filter(Boolean),
        );
      }

      return {
        estado: 'ENVIADO',
        id: r.messageId,
        para: destino.para,
        desviado: destino.reales !== null,
      };
    } catch (e) {
      const error = this.explicar(e);
      this.log.error(`No salió «${c.asunto}»: ${error}`);
      /**
       * Falló el envío entero: las de este correo quedan marcadas. Si
       * el fallo era del servidor y no de la dirección, el siguiente
       * envío que salga lo limpia solo.
       *
       * TAMPOCO CON DESVÍO PUESTO. El mensaje iba al buzón del
       * equipo, así que un fallo aquí no dice nada de la dirección de
       * la persona: marcarla pondría a media base con el correo malo
       * cada vez que el SMTP de pruebas tosa.
       */
      if (destino.reales === null) {
        await this.apuntarLoQueNoSalio(destino.para, error);
      }
      return { estado: 'FALLO', error };
    }
  }

  /**
   * DEJA CONSTANCIA EN LA FICHA DE QUE A ESA DIRECCIÓN NO SE PUDO.
   *
   * «No hay un criterio para ver si el correo está bien o no»
   * (cliente, 5 oct 2026). No lo había: el rechazo quedaba en el
   * registro del servidor, que es donde no mira quien trabaja la
   * ficha.
   *
   * POR DIRECCIÓN Y NO POR PERSONA, que es lo que la hace barata y
   * correcta: es la dirección la que está mal, y si dos fichas
   * comparten correo las dos tienen el mismo problema. Una sola
   * consulta por envío, sin que quien manda el correo tenga que saber
   * de quién es.
   *
   * NO ROMPE EL ENVÍO. Si esto falla, el correo ya salió o ya falló,
   * y lo que está en juego es una marca de ayuda: tumbar por ella la
   * respuesta de un formulario público sería cambiar un aviso por una
   * caída.
   *
   * Y NO ES EL REBOTE. El de verdad llega minutos después de que el
   * servidor aceptó el mensaje y solo lo sabe el proveedor ---hace
   * falta el webhook de SendGrid---. Esto es lo que se sabe EN EL
   * ENVÍO.
   */
  private async apuntarLoQueNoSalio(
    direcciones: string[],
    motivo: string,
  ): Promise<void> {
    const limpias = normalizar(direcciones);
    if (limpias.length === 0) return;
    try {
      await this.prisma.persona.updateMany({
        where: { correo: { in: limpias } },
        data: { correoFallaEn: new Date(), correoFalloMotivo: motivo },
      });
    } catch (e) {
      this.log.warn(
        `No se pudo apuntar el fallo de correo: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  /// Y se quita en cuanto vuelve a salir uno.
  private async olvidarElFallo(direcciones: string[]): Promise<void> {
    const limpias = normalizar(direcciones);
    if (limpias.length === 0) return;
    try {
      await this.prisma.persona.updateMany({
        /// Solo las que estaban marcadas: sin esto, cada correo que
        /// sale reescribe la fila de todo el que lo recibe.
        where: { correo: { in: limpias }, correoFallaEn: { not: null } },
        data: { correoFallaEn: null, correoFalloMotivo: null },
      });
    } catch (e) {
      this.log.warn(
        `No se pudo limpiar la marca de correo: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  /// Se ve a quién iba de verdad.
  private marcar(c: Comunicacion, reales: string[]): Comunicacion {
    const iba = reales.join(', ');
    /// Escapada para el HTML: la validacion de direcciones
    /// solo prohibe la arroba y los espacios, asi que `<` y
    /// `>` pasan y `a<img/src=x>@b.co` llegaba entero aqui.
    const ibaHtml = escaparHtml(iba);
    const aviso =
      'background:#fde68a;border:1px solid #b45309;color:#3f2d00;' +
      'padding:10px 12px;margin-bottom:16px;font:13px system-ui';

    return {
      ...c,
      asunto: `[PRUEBAS → ${etiquetaDeReales(reales)}] ${c.asunto}`,
      texto:
        '--- ENTORNO DE PRUEBAS ---\n' +
        `Este correo NO llegó a su destinatario. Iba para: ${iba}\n` +
        `---\n\n${c.texto}`,
      html: c.html
        ? `<div style="${aviso}"><strong>Entorno de pruebas.</strong> Este ` +
          `correo no llegó a su destinatario. Iba para: ${ibaHtml}</div>${c.html}`
        : undefined,
    };
  }

  /**
   * Traduce el error de SMTP a algo accionable.
   *
   * «EAUTH 535» no le dice nada a nadie. Lo que hay que saber
   * es que Google quiere una contraseña de aplicación, y
   * dónde se saca.
   */
  private explicar(e: unknown): string {
    const bruto = e instanceof Error ? e.message : String(e);

    /**
     * EL CONSEJO, SEGÚN QUIÉN SEA EL SERVIDOR.
     *
     * Esto decía siempre lo de Google: «cree una contraseña de
     * aplicación en myaccount.google.com». Buen consejo con Gmail y
     * **una pérdida de media hora con cualquier otro**, porque manda a
     * buscar una pantalla que en SendGrid no existe. Y el mensaje sale
     * en el panel, donde lo lee quien está intentando arreglarlo.
     *
     * El transporte nunca estuvo atado a Gmail ---es SMTP genérico de
     * nodemailer--- así que cambiar de proveedor no toca código: toca
     * las variables. Lo único que estaba atado era este texto.
     */
    if (/535|EAUTH|not accepted|BadCredentials/i.test(bruto)) {
      const servidor = (process.env.SMTP_SERVIDOR ?? '').toLowerCase();

      if (servidor.includes('sendgrid')) {
        return (
          'SendGrid no aceptó usuario y contraseña. El usuario es la palabra ' +
          '«apikey», literalmente, igual para todos; y la contraseña es la ' +
          'API key entera, la que empieza por «SG.» y solo se enseña una vez ' +
          `al crearla. (${bruto.slice(0, 120)})`
        );
      }

      if (servidor.includes('google') || servidor.includes('gmail')) {
        return (
          'El servidor no aceptó usuario y contraseña. Con Google Workspace la ' +
          'contraseña normal de la cuenta NO sirve para SMTP: hay que crear una ' +
          '«contraseña de aplicación» en myaccount.google.com > Seguridad > ' +
          'Verificación en dos pasos > Contraseñas de aplicaciones, y poner esas ' +
          `16 letras en SMTP_CLAVE. (${bruto.slice(0, 120)})`
        );
      }

      return (
        'El servidor de correo no aceptó usuario y contraseña. Revise ' +
        `SMTP_USUARIO y SMTP_CLAVE. (${bruto.slice(0, 120)})`
      );
    }

    /**
     * Y EL REMITENTE SIN VERIFICAR, que es el tropiezo propio de
     * SendGrid y no se parece a un fallo de clave: la conexión entra,
     * la autenticación pasa, y el correo se rechaza igual.
     *
     * Pasa porque SendGrid no deja mandar «desde» una dirección que no
     * se haya verificado antes, ni aunque el buzón sea suyo. Sin esto,
     * el panel enseñaría un 403 pelado.
     */
    if (
      /does not match a verified Sender Identity|Sender Identity/i.test(bruto)
    ) {
      const desde = process.env.SMTP_DESDE ?? process.env.SMTP_USUARIO ?? '';
      return (
        `SendGrid no deja mandar desde «${desde}» porque esa dirección no está ` +
        'verificada. Se verifica en SendGrid > Settings > Sender Authentication, ' +
        'por dirección (Single Sender) o por dominio entero. La cuenta y la clave ' +
        `están bien: lo que falta es el permiso del remitente. (${bruto.slice(0, 120)})`
      );
    }

    if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND|ESOCKET/i.test(bruto)) {
      return (
        'No se pudo llegar al servidor de correo. Puede ser que la red de la ' +
        `oficina tenga cerrado el puerto de salida. (${bruto.slice(0, 120)})`
      );
    }

    return bruto.slice(0, 300);
  }
}

/**
 * Una dirección tal como la devuelve nodemailer.
 *
 * `accepted` y `rejected` traen cadenas, pero con algunas opciones
 * traen objetos `{address, name}`. Leerlo sin mirar guardaría
 * «[object Object]» como correo, y entonces la marca no casaría con
 * nadie y nadie se enteraría de que no casa.
 */
function comoTexto(x: unknown): string {
  if (typeof x === 'string') return x;
  if (x && typeof x === 'object' && 'address' in x) {
    const a = (x as { address?: unknown }).address;
    return typeof a === 'string' ? a : '';
  }
  return '';
}

/// En minúsculas y sin repetidos, como se guardan en `personas`:
/// comparando el texto crudo, «Ana@Ejemplo.test» no casaría con la
/// fila y la marca se perdería en silencio.
function normalizar(direcciones: string[]): string[] {
  return [
    ...new Set(
      direcciones.map((d) => d.trim().toLowerCase()).filter((d) => d.includes('@')),
    ),
  ];
}
