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

import { desvioConfigurado, etiquetaDeReales, resolverDestino } from './desvio';
import { escaparHtml } from './escapar';

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
  private get remitente(): string {
    const nombre = process.env.SMTP_NOMBRE ?? 'Convoca';
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
        from: this.remitente,
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
      return {
        estado: 'ENVIADO',
        id: r.messageId,
        para: destino.para,
        desviado: destino.reales !== null,
      };
    } catch (e) {
      const error = this.explicar(e);
      this.log.error(`No salió «${c.asunto}»: ${error}`);
      return { estado: 'FALLO', error };
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

    if (/535|EAUTH|not accepted|BadCredentials/i.test(bruto)) {
      return (
        'El servidor no aceptó usuario y contraseña. Con Google Workspace la ' +
        'contraseña normal de la cuenta NO sirve para SMTP: hay que crear una ' +
        '«contraseña de aplicación» en myaccount.google.com > Seguridad > ' +
        'Verificación en dos pasos > Contraseñas de aplicaciones, y poner esas ' +
        `16 letras en SMTP_CLAVE. (${bruto.slice(0, 120)})`
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
