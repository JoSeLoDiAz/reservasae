import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { RolAdmin } from '../../../generated/prisma';
import { AmbitoActual } from '../../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../../admin/admin.guard';
import { enviarLibro } from '../../tableros/exportar';
import { SepService, type Formato } from './sep.service';

/** Los reportes al SEP. Llevan cédulas: no los ve CONSULTA. */
@Controller('admin/sep')
@UseGuards(AdminGuard)
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('reportes')
export class SepController {
  constructor(private readonly sep: SepService) {}

  /** Cuántos entran y cuántos no, antes de generar nada. */
  @Get('alistamiento')
  alistamiento(@Query('convenioId') convenioId: string, @AmbitoActual() ambito: Ambito) {
    return this.sep.alistamiento(convenioId, ambito.convenios);
  }

  /// El F7 tiene su propio alistamiento y su propia cifra.
  ///
  /// El metodo existia y no tenia ruta, asi que la pantalla
  /// pintaba el numero de PERSONAS al lado del boton del F7,
  /// que va por organizacion: dos cosas distintas bajo la
  /// misma cifra.
  @Get('alistamiento-f7')
  alistamientoF7(@Query('convenioId') convenioId: string, @AmbitoActual() ambito: Ambito) {
    return this.sep.alistamientoF7(convenioId, ambito.convenios);
  }

  // el gestor ve cuantos entran; el archivo con las
  // cedulas lo saca su lider
  @Get('exportar')
  @Requiere('reportes', 'ESCRIBIR')
  async exportar(
    @Query('convenioId') convenioId: string,
    @Query('formato') formato: Formato,
    @Query('ano') ano: string | undefined,
    @AmbitoActual() ambito: Ambito,
    @Res() res: Response,
  ) {
    /// El error se contesta en HTML, no en JSON.
    ///
    /// Esta descarga va por NAVEGACION -- es lo que hace que el
    /// navegador gestione el archivo y que la cookie de sesion
    /// viaje sola --, asi que un 400 con cuerpo JSON no es un
    /// aviso: es la pantalla del panel sustituida por
    /// `{"message":...,"statusCode":400}`. Se cambio un archivo
    /// vacio por algo que parece que el sistema se rompio.
    ///
    /// El candado del servidor se queda, porque basta con pegar
    /// la URL; lo que cambia es como se cuenta.
    try {
      if (formato === 'f7') {
        const { libro } = await this.sep.exportarF7(convenioId, ambito.convenios);
        enviarLibro(res, libro, 'f7-empresas');
        return;
      }

      const cual: Formato = formato === 'cargue-sep' ? 'cargue-sep' : 'uso-directo';
      const { libro } = await this.sep.exportar(
        convenioId,
        cual,
        Number(ano) || new Date().getFullYear(),
        ambito.convenios,
      );
      enviarLibro(res, libro, cual === 'cargue-sep' ? 'reporte-sep' : 'reporte-control');
    } catch (error) {
      if (error instanceof BadRequestException) {
        paginaDeError(res, mensajeDe(error));
        return;
      }
      throw error;
    }
  }
}

/** El texto que trae una excepción de Nest. */
function mensajeDe(error: BadRequestException): string {
  const cuerpo = error.getResponse();
  if (typeof cuerpo === 'string') return cuerpo;
  const m = (cuerpo as { message?: string | string[] }).message;
  return Array.isArray(m) ? m.join('. ') : (m ?? error.message);
}

/**
 * Una página mínima, para que el usuario sepa qué pasó.
 *
 * Sin estilos ni tokens a propósito: es una hoja suelta a la que
 * se llega por navegación, fuera del panel, y meterle la paleta
 * exigiría pedirla al servidor para pintar un error. Lo único
 * que tiene que hacer es decir qué falta y dejar volver.
 */
function paginaDeError(res: Response, mensaje: string) {
  const escapar = (t: string) =>
    t.replace(/[&<>"]/g, (c) =>
      c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
    );

  res.status(400).type('html').send(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>No se pudo generar el archivo</title></head>` +
      `<body style="font-family:system-ui,sans-serif;max-width:34rem;margin:4rem auto;padding:0 1.5rem;line-height:1.6">` +
      `<h1 style="font-size:1.25rem">No se pudo generar el archivo</h1>` +
      `<p>${escapar(mensaje)}</p>` +
      `<p><a href="/admin/sep">Volver a los reportes</a></p>` +
      `</body></html>`,
  );
}
