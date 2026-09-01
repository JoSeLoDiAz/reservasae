/** La puerta por la que entran los leads. */

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
/// `import type` y no un import normal, en los dos casos.
///
/// Con `emitDecoratorMetadata` TypeScript escribe el tipo de
/// cada parámetro decorado en el JavaScript compilado. Si el
/// tipo entra como import de valor, queda un `require` de algo
/// que en tiempo de ejecución no existe y Nest revienta al
/// arrancar. Con `import type` desaparece al compilar, que es
/// lo correcto: `Request` y `RawBodyRequest` son formas, no
/// cosas.
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';

import { etiquetaDelHost } from '../admin/gremio-del-host';
import { EntraLeadDto, EntraLoteDto } from './dto';
import { LeadsService } from './leads.service';
import { LlaveDeLeadsGuard } from './llave-de-leads.guard';
import {
  avisosDeLead,
  CABECERA_FIRMA,
  firmaDeMeta,
  respuestaDeVerificacion,
} from './meta';
import { configDeMeta } from './meta-por-gremio';

/**
 * Cuelga de `/webhooks` y NO del panel: no lleva sesión, la
 * llave viaja en una cabecera. Por eso vive en su propio módulo
 * y no dentro del CRM — para que se vea desde fuera que esta
 * ruta escribe sin `AdminGuard`.
 *
 * Hay DOS puertas, y se autentican distinto a propósito:
 *
 *   POST /webhooks/leads        el orquestador, con nuestra llave
 *   POST /webhooks/leads/meta   Meta, con SU firma
 *
 * Juntarlas sería tener una ruta que acepta dos
 * autenticaciones, y una de las dos siempre sobra: quien tenga
 * la más débil entra por ahí.
 */
@Controller('webhooks/leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  /**
   * Entra un lead.
   *
   * 200 y no 201: se contesta lo mismo cuando el lead es nuevo y
   * cuando ya estaba, y `repetido` lo dice. Un 201 en el segundo
   * caso sería mentir sobre lo que pasó.
   */
  @Post()
  @UseGuards(LlaveDeLeadsGuard)
  @HttpCode(200)
  async entra(
    @Body() dto: EntraLeadDto,
    @Headers('x-origen-sistema') origen: string | undefined,
    @Headers('host') host: string | undefined,
  ) {
    /// La llave la comprueba `LlaveDeLeadsGuard`, no una línea
    /// de aquí dentro: un guard corre ANTES del
    /// ValidationPipe, y una comprobación en el método, no.
    ///
    /// Quien lo manda, para la idempotencia. Por defecto el
    /// orquestador, que era el único hasta que llegó Meta.
    const sistema =
      (origen ?? 'orquestador').trim().slice(0, 80) || 'orquestador';

    /// El gremio que AFIRMA la direccion.
    ///
    /// `host` a secas y no `x-forwarded-host`: esa la pone quien
    /// quiera, y nginx ya reescribe `Host` con el real. Es la
    /// misma fuente que lee el backend para el panel, y tenerlas
    /// distintas fue justo el fallo que se arreglo el 27 ago.
    const delHost = etiquetaDelHost(host);

    return this.leads.entra(dto, sistema, delHost);
  }

  /**
   * Varios leads de una vez. Para cargar un historico.
   *
   * Mismo camino que el de uno: misma llave, mismo gremio por
   * subdominio, misma idempotencia. Lo unico que cambia es que
   * se contesta fila por fila.
   */
  @Post('lote')
  @UseGuards(LlaveDeLeadsGuard)
  @HttpCode(200)
  async entraLote(
    @Body() dto: EntraLoteDto,
    @Headers('x-origen-sistema') origen: string | undefined,
    @Headers('host') host: string | undefined,
  ) {
    const sistema =
      (origen ?? 'orquestador').trim().slice(0, 80) || 'orquestador';
    return this.leads.entraLote(dto.leads, sistema, etiquetaDelHost(host));
  }

  /**
   * La verificación de Meta. Es lo que ENCIENDE el webhook.
   *
   * Antes de mandar nada, Meta llama con un GET y espera su
   * `hub.challenge` devuelto TAL CUAL, en texto plano. Si se le
   * contesta un JSON, o entre comillas, no valida y no
   * enciende — y no dice por qué: simplemente no llegan leads.
   *
   * `@Res()` sin passthrough porque hay que escribir texto
   * plano: Nest serializaría a JSON lo que se devolviera.
   */
  @Get('meta')
  verificacionDeMeta(
    @Query('hub.mode') modo: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') reto: string | undefined,
    @Headers('host') host: string | undefined,
    @Res() res: Response,
  ) {
    /// El gremio lo dice el SUBDOMINIO, igual que en la puerta
    /// del orquestador. Hay una app de Meta por gremio, y cada
    /// app tiene su propia URL de devolucion: por eso la
    /// direccion basta para saber de quien es esta llamada.
    const slug = etiquetaDelHost(host);
    const config = slug ? configDeMeta(slug) : null;

    const respuesta = respuestaDeVerificacion(
      modo,
      token,
      reto,
      config?.verifyToken ?? undefined,
    );

    if (respuesta === null) {
      /// 403 y nada más: decir «token incorrecto» le confirma a
      /// quien prueba que la ruta existe y qué espera.
      res.status(403).send('');
      return;
    }

    res.type('text/plain').send(respuesta);
  }

  /**
   * Meta, hablando su idioma.
   *
   * Se lee el cuerpo del `Request` y no con `@Body()`: el
   * ValidationPipe global rechaza con 400 cualquier campo que un
   * DTO no declare, y el payload de Meta trae los suyos. Ese era
   * el motivo por el que «Meta no podía llamar esta ruta».
   *
   * Y la firma se comprueba sobre `rawBody` —el cuerpo byte a
   * byte— porque sobre el JSON parseado y vuelto a serializar
   * nunca cuadra.
   */
  @Post('meta')
  @HttpCode(200)
  async deMeta(
    @Req() req: RawBodyRequest<Request>,
    @Headers('host') host: string | undefined,
  ) {
    /// CADA GREMIO CON SU SECRETO.
    ///
    /// Aqui se leia `process.env.META_APP_SECRET`, una sola
    /// variable. Con una app de Meta por gremio eso rechaza los
    /// leads de uno de los dos por «firma invalida» — y ese
    /// sintoma no se lee como un error de configuracion, se lee
    /// como «Meta no nos manda nada», que es de los mas caros
    /// de diagnosticar porque no hay nada roto que mirar.
    const slug = etiquetaDelHost(host);
    const config = slug ? configDeMeta(slug) : null;

    if (
      !firmaDeMeta(
        req.rawBody,
        req.headers[CABECERA_FIRMA] as string | undefined,
        config?.appSecret ?? undefined,
      )
    ) {
      throw new UnauthorizedException('Firma inválida.');
    }

    /// Se contesta 200 pase lo que pase con el contenido.
    ///
    /// Meta reintenta cuando no recibe 200, y si insiste sin
    /// éxito APAGA el webhook. Un aviso que no entendemos no
    /// puede costar que dejen de llegar los que sí. Lo que no
    /// se pudo usar queda en el log y en la tabla.
    /// El gremio va EXPLICITO al servicio: lo dice la
    /// direccion por la que entro, no una variable de entorno.
    return this.leads.deMeta(avisosDeLead(req.body), slug);
  }
}
