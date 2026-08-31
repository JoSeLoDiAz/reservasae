/** El banco de pruebas del webhook de Meta. */

/// Para qué sirve, en una línea: para saber si el webhook
/// funciona ANTES de tener Meta conectado.
///
/// Conectar Meta necesita una app aprobada, una página con
/// permisos y un dominio público. Nada de eso depende de
/// nosotros y todo puede tardar semanas. Lo que sí depende de
/// nosotros —la firma, el cuerpo crudo, que el ValidationPipe
/// no rechace el payload, que se guarden los avisos— se puede
/// probar entero desde aquí, y es donde están los errores que
/// podemos cometer.
///
/// La prueba se manda por HTTP a NUESTRA PROPIA ruta, no
/// llamando al servicio. Es más lento y es a propósito: lo
/// que se dudaba era si la ruta se dejaba llamar. Saltársela
/// para probarla sería probar otra cosa.

import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AdminGuard, Requiere } from '../admin/admin.guard';
import { PrismaService } from '../prisma/prisma.service';

import {
  configDeMeta,
  loQueFalta,
  nombreDeVariable,
} from './meta-por-gremio';
import { esDePrueba, PREFIJO_DE_PRUEBA, simularAviso } from './simulador-meta';

/// El camino público del webhook, con el `/api` que pone
/// nginx delante. Se escribe una vez aquí para que la URL que
/// se le enseña al usuario y la que se prueba sean la misma:
/// enseñar una y probar otra es como se llega a «en pruebas
/// funcionaba».
const CAMINO = '/api/webhooks/leads/meta';

/// A dónde se manda la prueba: a este mismo proceso.
///
/// No a la URL pública. Un `.env` con la URL mal puesta haría
/// que la prueba saliera a internet y volviera a otro
/// servidor —al de producción, en el peor caso—. 127.0.0.1 y
/// el puerto propio no se pueden equivocar.
function aMiMismo(): string {
  return `http://127.0.0.1:${process.env.PORT ?? 4000}/webhooks/leads/meta`;
}

/// De dónde sale la URL que hay que pegarle a Meta.
///
/// Del Host de ESTA petición: es la dirección por la que el
/// navegador llegó al panel, o sea la que de verdad funciona
/// desde fuera. Una constante en el `.env` se queda vieja el
/// día que cambie el dominio y nadie se entera.
/// El dominio, sin la etiqueta del gremio ni la del entorno.
///
/// `pre-adecopria.reservasae.com` -> `reservasae.com`.
const SOLO_EL_DOMINIO = /^(?:pre-)?[a-z0-9-]+\.(?=[a-z0-9-]+\.[a-z]{2,})/;

/**
 * La URL de devolución de ESTE gremio.
 *
 * Antes hacía `base.replace('://', '://' + slug + '.')`, que le
 * pega la etiqueta del gremio a lo que haya. Mirada desde
 * `pre-adecopria.reservasae.com` —donde se mira, porque es el
 * panel del gremio— salía
 * `adecopria.pre-adecopria.reservasae.com`, que no existe.
 *
 * Y es la URL que alguien copia y pega en la consola de Meta.
 * Una direccion equivocada ahi no falla ruidosamente: Meta
 * simplemente no entrega, y eso se lee como «el webhook no
 * funciona».
 *
 * Se rehace desde el dominio, conservando el prefijo del
 * ENTORNO: en pruebas las direcciones llevan `pre-`.
 */
function urlDeDevolucion(peticion: Request, slug: string): string {
  const host = (peticion.headers.host ?? 'localhost:3100').toLowerCase();

  const local = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  if (local) return `http://${host}${CAMINO}`;

  /// Siempre `https` de cara afuera. `x-forwarded-proto` dice
  /// `http` porque el TLS termina en Cloudflare y a nginx le
  /// llega en claro: fiarse de él pinta una URL con http que
  /// Meta rechaza.
  const dominio = host.replace(SOLO_EL_DOMINIO, '');
  const prefijo = process.env.ENTORNO === 'prueba' ? 'pre-' : '';
  return `https://${prefijo}${slug}.${dominio}${CAMINO}`;
}

@Controller('admin/pruebas/meta')
@UseGuards(AdminGuard)
export class MetaPruebasController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Qué falta para que Meta pueda conectarse.
   *
   * Es lo primero que se mira y contesta la pregunta de
   * verdad: no «¿está bien configurado?» sino «¿qué me falta
   * y dónde lo pongo?».
   */
  @Get()
  @Requiere('configuracion')
  async estado(@Req() peticion: Request) {
    /// UNA FILA POR GREMIO.
    ///
    /// Antes esto miraba tres variables sueltas y hablaba de
    /// «el» webhook, en singular. Con una app de Meta por
    /// gremio hay DOS webhooks, cada uno con su URL, su
    /// secreto y su token — y el estado de uno no dice nada
    /// del otro.
    ///
    /// Enseñarlos juntos es lo que hace que se vea de un
    /// vistazo el fallo caro: que a uno de los dos le falte el
    /// secreto. Ese no se nota mirando Meta —los leads salen—
    /// sino aquí.
    const convenios = await this.prisma.convenio.findMany({
      where: { activo: true },
      select: { id: true, slug: true, nombre: true },
      orderBy: { slug: 'asc' },
    });

    const gremios = await Promise.all(
      convenios.map(async (c) => {
        const config = configDeMeta(c.slug);
        const faltan = loQueFalta(config);

        /// Cuántos leads de Meta lleva. Envuelto porque la
        /// tabla puede NO existir: la migración que la crea
        /// puede estar sin aplicar, y entonces esta pantalla
        /// —la que existe para decir qué falta— se caería
        /// entera sin decir qué falta.
        let total = 0;
        let pendientes = 0;
        let sinTabla = false;
        try {
          [total, pendientes] = await Promise.all([
            this.prisma.leadEntrante.count({
              where: { origenSistema: 'meta', convenioId: c.id },
            }),
            this.prisma.leadEntrante.count({
              where: {
                origenSistema: 'meta',
                convenioId: c.id,
                estado: 'PENDIENTE',
              },
            }),
          ]);
        } catch (e) {
          /// P2021 es «esa tabla no existe». Cualquier otro
          /// fallo de base sí sube: taparlos todos sería
          /// enseñar ceros con la base caída.
          if ((e as { code?: string }).code !== 'P2021') throw e;
          sinTabla = true;
        }

        return {
          slug: c.slug,
          nombre: c.nombre,
          listo: faltan.length === 0,
          faltan,
          /// La URL de ESTE gremio. Cada app de Meta apunta a
          /// su subdominio, y es la dirección la que dice de
          /// quién es el lead que entra.
          urlDeDevolucion: urlDeDevolucion(peticion, c.slug),
          /// El token NO viaja: solo si está puesto. Es una
          /// credencial, y una credencial en pantalla es una
          /// credencial en una captura.
          tokenPuesto: Boolean(config.verifyToken),
          secretoPuesto: Boolean(config.appSecret),
          leads: { total, pendientes },
          sinTabla,
        };
      }),
    );

    return {
      listo: gremios.every((g) => g.listo),
      gremios,
      campo: 'leadgen',
      /// Solo en pruebas se pueden inventar leads. En el
      /// servidor de verdad, inventarlos ensuciaría la base
      /// con gente que no existe.
      puedeSimular: process.env.ENTORNO === 'prueba',
    };
  }

  /**
   * El apretón de manos, probado contra nosotros mismos.
   *
   * Es lo que Meta hace ANTES de mandar nada, y es donde se
   * atasca casi todo el mundo: si esto no contesta el
   * `hub.challenge` tal cual, Meta no enciende el webhook y
   * no dice por qué — simplemente no llegan leads.
   *
   * Se puede correr también en el servidor de verdad: no
   * escribe nada, solo pregunta.
   */
  @Post('verificacion')
  @Requiere('configuracion')
  @HttpCode(200)
  async probarVerificacion(@Query('gremio') gremio?: string) {
    /// El gremio va EXPLICITO: cada app de Meta tiene su token
    /// y probar «el» webhook en singular ya no significa nada.
    if (!gremio) {
      return { pasa: false, porque: 'Falta decir de qué gremio.' };
    }

    const esperado = configDeMeta(gremio).verifyToken;
    if (!esperado) {
      return {
        pasa: false,
        porque:
          `Falta ${nombreDeVariable('META_VERIFY_TOKEN', gremio)}. Sin él Meta ` +
          'no puede encender el webhook de este gremio, porque no hay contra ' +
          'qué comparar.',
      };
    }

    /// Un reto cualquiera, distinto cada vez: si la ruta
    /// devolviera una constante, un reto fijo no lo notaría.
    const reto = `reto-${Date.now()}`;
    const url =
      `${aMiMismo()}?hub.mode=subscribe` +
      `&hub.verify_token=${encodeURIComponent(esperado)}` +
      `&hub.challenge=${encodeURIComponent(reto)}`;

    let respuesta: globalThis.Response;
    try {
      respuesta = await fetch(url);
    } catch (e) {
      return {
        pasa: false,
        porque: `No se pudo llamar a la propia ruta: ${(e as Error).message}`,
      };
    }

    const cuerpo = await respuesta.text();

    if (!respuesta.ok) {
      return {
        pasa: false,
        estado: respuesta.status,
        porque:
          `La ruta contestó ${respuesta.status}. Meta necesita un 200 ` +
          'con el reto dentro.',
      };
    }

    /// La comparación es EXACTA. Meta no acepta el reto entre
    /// comillas, ni con un salto de línea detrás, ni envuelto
    /// en un JSON: por eso se compara tal cual y no con un
    /// «contiene».
    if (cuerpo !== reto) {
      return {
        pasa: false,
        estado: respuesta.status,
        devolvio: cuerpo.slice(0, 200),
        porque:
          'Contestó 200 pero no devolvió el reto tal cual. Meta lo ' +
          'compara letra por letra: unas comillas de más y no enciende.',
      };
    }

    return {
      pasa: true,
      porque:
        'Contestó el reto tal cual. Meta encendería el webhook con esta ' +
        'URL y este token.',
    };
  }

  /**
   * Manda un aviso inventado, firmado, por la puerta de Meta.
   *
   * Solo en pruebas: en el servidor de verdad esto llenaría
   * Gestión de leads de gente que no existe.
   */
  @Post('aviso')
  @Requiere('configuracion', 'ESCRIBIR')
  @HttpCode(200)
  async probarAviso(
    @Query('cuantos') cuantos?: string,
    @Query('gremio') gremio?: string,
  ) {
    if (process.env.ENTORNO !== 'prueba') {
      throw new BadRequestException(
        'Inventar leads solo se puede en el entorno de pruebas. En el ' +
          'servidor de verdad llenaría la base de gente que no existe.',
      );
    }

    if (!gremio) {
      return { pasa: false, porque: 'Falta decir de qué gremio.' };
    }

    /// Se firma con el secreto DE ESE GREMIO, que es justo lo
    /// que hay que probar: si aquí se usara uno solo, la prueba
    /// pasaría y en producción los leads del otro gremio se
    /// rechazarían todos por firma inválida.
    const simulado = simularAviso(
      { cuantos: Number(cuantos ?? 1) || 1, ahora: Date.now() },
      configDeMeta(gremio).appSecret ?? undefined,
    );

    if (!simulado) {
      return {
        pasa: false,
        porque:
          `Falta ${nombreDeVariable('META_APP_SECRET', gremio)}. Para probar ` +
          'sirve cualquier valor: lo que se comprueba es que la firma cuadre ' +
          'a los dos lados. El de verdad lo da Meta cuando se conecte.',
      };
    }

    let respuesta: globalThis.Response;
    try {
      /// Se manda la MISMA cadena que se firmó. Volver a
      /// serializar el objeto cambiaría un espacio y la firma
      /// dejaría de cuadrar — y el fallo parecería de Meta
      /// cuando sería nuestro.
      respuesta = await fetch(aMiMismo(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': simulado.firma,
        },
        body: simulado.cuerpo,
      });
    } catch (e) {
      return {
        pasa: false,
        porque: `No se pudo llamar a la propia ruta: ${(e as Error).message}`,
      };
    }

    const cuerpo = (await respuesta.json().catch(() => null)) as {
      guardados?: number;
      recibidos?: number;
      sinConvenio?: boolean;
    } | null;

    if (!respuesta.ok) {
      return {
        pasa: false,
        estado: respuesta.status,
        porque:
          respuesta.status === 401
            ? 'La ruta rechazó la firma. Es lo que haría con un aviso que ' +
              'no viene de Meta, así que la defensa funciona; lo que falla ' +
              'es que el secreto no es el mismo a los dos lados.'
            : `La ruta contestó ${respuesta.status}.`,
      };
    }

    /// Se leen de la tabla, no del cuerpo de la respuesta: que
    /// la ruta diga «guardé 3» y que haya 3 filas son dos
    /// cosas distintas, y la que importa es la segunda.
    let filas: Array<{
      externoId: string;
      estado: string;
      origen: string;
      motivo: string | null;
      recibidoEn: Date;
    }>;
    try {
      filas = await this.prisma.leadEntrante.findMany({
        where: { origenSistema: 'meta', externoId: { in: simulado.leadgenIds } },
        select: {
          externoId: true,
          estado: true,
          origen: true,
          motivo: true,
          recibidoEn: true,
        },
        orderBy: { recibidoEn: 'desc' },
      });
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2021') throw e;
      /// La tabla no existe. Se dice ASÍ y no «0 guardados»:
      /// el aviso llegó bien —firma, cuerpo, ruta, todo— y lo
      /// único que falta es una migración. Confundir las dos
      /// cosas manda a buscar el fallo donde no está.
      return {
        pasa: false,
        mandados: simulado.leadgenIds.length,
        guardados: 0,
        porque:
          'El aviso llegó entero: la firma cuadró y la ruta lo aceptó. Lo ' +
          'que falta es la tabla donde guardarlo — la migración ' +
          '«20260828090000_mesa_de_entrada_de_leads» está sin aplicar.',
      };
    }

    const todos = filas.length === simulado.leadgenIds.length;

    return {
      pasa: todos,
      mandados: simulado.leadgenIds.length,
      guardados: filas.length,
      sinConvenio: cuerpo?.sinConvenio ?? false,
      porque: todos
        ? 'Entraron todos y quedaron en la tabla. La firma cuadró, el ' +
          'cuerpo crudo llegó entero y el ValidationPipe no se metió: es ' +
          'exactamente lo que hará Meta.'
        : cuerpo?.sinConvenio
          ? 'La ruta los recibió pero no los guardó: falta decir a qué ' +
            'gremio entran: Meta tiene que llamar al subdominio del gremio.'
          : `Se mandaron ${simulado.leadgenIds.length} y quedaron ` +
            `${filas.length} en la tabla.`,
      filas: filas.map((f) => ({ ...f, deprueba: esDePrueba(f.externoId) })),
    };
  }

  /**
   * Borra los leads que inventó el simulador.
   *
   * Solo los suyos, reconocidos por el prefijo. Un borrado que
   * se lleve por delante un lead de verdad sería peor que
   * dejar la basura.
   */
  @Post('limpiar')
  @Requiere('configuracion', 'ESCRIBIR')
  @HttpCode(200)
  async limpiar() {
    if (process.env.ENTORNO !== 'prueba') {
      throw new BadRequestException('Solo en el entorno de pruebas.');
    }

    try {
      /// Los que YA se convirtieron en ficha no se tocan: la
      /// ficha se quedaría apuntando a un lead que no existe.
      /// Es un caso raro y es justo el que hay que no romper.
      const { count } = await this.prisma.leadEntrante.deleteMany({
        where: {
          origenSistema: 'meta',
          externoId: { startsWith: `${PREFIJO_DE_PRUEBA}-` },
          participanteId: null,
        },
      });
      return { borrados: count };
    } catch (e) {
      /// Sin tabla no hay nada que borrar, y decirlo así es
      /// más cierto que reventar con una traza de Prisma.
      if ((e as { code?: string }).code !== 'P2021') throw e;
      return { borrados: 0 };
    }
  }
}
