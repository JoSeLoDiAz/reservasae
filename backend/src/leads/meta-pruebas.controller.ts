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
function urlPublica(peticion: Request): string {
  const host = peticion.headers.host ?? 'localhost:3100';
  /// `x-forwarded-proto` lo pone nginx. Sin él se mira si el
  /// host es local: en el servidor siempre hay TLS.
  const protocolo =
    (peticion.headers['x-forwarded-proto'] as string | undefined) ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1')
      ? 'http'
      : 'https');
  return `${protocolo}://${host}${CAMINO}`;
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
    const slug = process.env.META_CONVENIO_SLUG;
    const convenio = slug
      ? await this.prisma.convenio.findFirst({
          where: { slug },
          select: { id: true, slug: true, nombre: true, activo: true },
        })
      : null;

    const faltan: string[] = [];
    if (!process.env.META_APP_SECRET) {
      faltan.push(
        'META_APP_SECRET — lo da Meta en «Configuración de la app». ' +
          'Es con lo que se comprueba que un aviso viene de ellos.',
      );
    }
    if (!process.env.META_VERIFY_TOKEN) {
      faltan.push(
        'META_VERIFY_TOKEN — lo inventa usted. Es una contraseña ' +
          'cualquiera que se escribe igual aquí y en Meta, y es lo que ' +
          'deja que Meta encienda el webhook.',
      );
    }
    if (!slug) {
      faltan.push(
        'META_CONVENIO_SLUG — a qué gremio entran los leads de Meta. ' +
          'No se adivina: meter a alguien de un gremio en el otro es ' +
          'peor que dejar el lead esperando.',
      );
    } else if (!convenio) {
      faltan.push(
        `META_CONVENIO_SLUG dice «${slug}» y no hay ninguna convocatoria ` +
          'con ese nombre.',
      );
    } else if (!convenio.activo) {
      faltan.push(
        `La convocatoria «${convenio.nombre}» está cerrada. Los leads ` +
          'de Meta no entrarían a ninguna parte.',
      );
    }

    /// Cuántos leads de Meta hay ya, para no tener que ir a
    /// buscarlos a otra pantalla después de probar.
    ///
    /// Envuelto porque la tabla puede NO existir: la migración
    /// que la crea puede estar sin aplicar, y entonces esta
    /// pantalla —la que existe justo para decir qué falta— se
    /// caería entera sin decir qué falta.
    let total = 0;
    let pendientes = 0;
    let sinTabla = false;
    if (convenio) {
      try {
        [total, pendientes] = await Promise.all([
          this.prisma.leadEntrante.count({
            where: { origenSistema: 'meta', convenioId: convenio.id },
          }),
          this.prisma.leadEntrante.count({
            where: {
              origenSistema: 'meta',
              convenioId: convenio.id,
              estado: 'PENDIENTE',
            },
          }),
        ]);
      } catch (e) {
        /// P2021 es «esa tabla no existe». Cualquier otro
        /// fallo de base sí se deja subir: taparlos todos
        /// sería enseñar ceros cuando la base está caída.
        if ((e as { code?: string }).code !== 'P2021') throw e;
        sinTabla = true;
        faltan.push(
          'La tabla de leads no existe todavía. Falta aplicar la ' +
            'migración «20260828090000_mesa_de_entrada_de_leads». Hasta ' +
            'entonces los avisos de Meta llegan bien pero no se pueden ' +
            'guardar.',
        );
      }
    }

    return {
      listo: faltan.length === 0,
      faltan,
      /// Lo que hay que pegar en Meta, tal cual, para no
      /// tener que armarlo a mano.
      paraMeta: {
        urlDeDevolucion: urlPublica(peticion),
        /// El token NO se devuelve: se dice si está puesto.
        /// Es una credencial, y una credencial en una
        /// pantalla es una credencial en una captura.
        tokenPuesto: Boolean(process.env.META_VERIFY_TOKEN),
        campo: 'leadgen',
      },
      convenio: convenio
        ? {
            slug: convenio.slug,
            nombre: convenio.nombre,
            activo: convenio.activo,
          }
        : null,
      leads: { total, pendientes },
      /// Se dice aparte de `faltan` porque no es una variable
      /// de entorno que se pone: es una migración que se
      /// aplica, y el remedio no se parece en nada.
      sinTabla,
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
  async probarVerificacion() {
    const esperado = process.env.META_VERIFY_TOKEN;
    if (!esperado) {
      return {
        pasa: false,
        porque:
          'Falta META_VERIFY_TOKEN. Sin él Meta no puede encender el ' +
          'webhook, porque no hay contra qué comparar.',
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
  async probarAviso(@Query('cuantos') cuantos?: string) {
    if (process.env.ENTORNO !== 'prueba') {
      throw new BadRequestException(
        'Inventar leads solo se puede en el entorno de pruebas. En el ' +
          'servidor de verdad llenaría la base de gente que no existe.',
      );
    }

    const simulado = simularAviso(
      { cuantos: Number(cuantos ?? 1) || 1, ahora: Date.now() },
      process.env.META_APP_SECRET,
    );

    if (!simulado) {
      return {
        pasa: false,
        porque:
          'Falta META_APP_SECRET. Para probar sirve cualquier valor: lo ' +
          'que se comprueba es que la firma cuadre a los dos lados. El ' +
          'de verdad lo da Meta cuando se conecte.',
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
            'gremio entran (META_CONVENIO_SLUG).'
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
