/** La lista de la mesa de entrada. */

/**
 * Fichero aparte del de la conversión a propósito, por lo mismo
 * que aquel: dos controladores comparten el prefijo sin tocarse,
 * y así cada merge del día no es un conflicto.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { RolAdmin, type Admin } from '../../generated/prisma';
import { AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../admin/admin.guard';

import { AdminActual } from '../admin/admin-actual.decorator';
import { conveniosQueReparten } from '../admin/permisos';
import { conveniosQueLlevanFichas } from '../crm/quien-lleva-fichas';
import { IpReal } from '../comun/ip-real';

import {
  ArreglarLeadDto,
  AsignarLeadsDto,
  ConvertirLoteDto,
  DescartarLoteDto,
} from './dto';
import { Comparativo } from './comparativo.service';
import { LoteDeLeads } from './lote.service';
import { CrearNotaDto } from '../crm/dto';
import { GestionDelLead } from './gestion-del-lead.service';
import { MesaDeEntrada } from './mesa-de-entrada.service';
import { CargueDeLeads } from './cargue/cargue-de-leads.service';
import { CargarLeadsDto } from './cargue/dto';
import { MAXIMO_ARCHIVO_CARGA } from './cargue/lector-del-cargue';

/// El tipo que Excel le pone a un .xlsx. Repetido aquí y no
/// importado del módulo de plantillas a propósito: es una cabecera
/// HTTP de ESTA ruta, y traerla de otro módulo ataría este
/// controlador a un cargue con el que no comparte ninguna regla.
const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('admin/leads')
@UseGuards(AdminGuard)
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
export class MesaDeEntradaController {
  constructor(
    private readonly mesa: MesaDeEntrada,
    private readonly lote: LoteDeLeads,
    private readonly comparar: Comparativo,
    private readonly gestion: GestionDelLead,
    private readonly cargue: CargueDeLeads,
  ) {}

  /**
   * La plantilla del cargue de la BBDD de leads.
   *
   * `ESCRIBIR` aunque solo baje un archivo en blanco, y es el mismo
   * criterio que el formato de empresas: bajar la plantilla es el
   * primer paso de un cargue, y quien no puede cargar no tiene nada
   * que hacer con ella. Dársela a quien solo consulta sería
   * invitarle a llenar dos mil filas para que el segundo paso le
   * conteste que no.
   */
  /// UN SOLO SEGMENTO, y no 'cargue/plantilla'.
  ///
  /// Es la trampa que ya se comió `convertir-lote`: con dos
  /// segmentos, esta ruta cae en el molde de `@Post(':id/notas')` y
  /// de `@Post(':id/convertir')` --el del otro controlador-- con
  /// `:id` valiendo 'cargue'. Hoy no colisionaría porque el segundo
  /// segmento es otro, pero eso depende de que nadie añada
  /// `@Get(':id/algo')`, y depender de eso lo arregla hoy y lo
  /// rompe en silencio el día que alguien lo haga.
  @Get('cargue-plantilla')
  @Requiere('inscripciones', 'ESCRIBIR')
  /// `@Res()` SIN `passthrough`, igual que el formato de empresas:
  /// con `passthrough` Nest intenta serializar lo que devuelve el
  /// método, y `res.send()` devuelve el propio Response, que lleva
  /// un socket dentro. Serializarlo revienta con «circular
  /// structure» y sale un 500 con el archivo a medio mandar.
  async carguePlantilla(@Res() respuesta: Response) {
    const libro = await this.cargue.plantilla();
    const hoy = new Date().toISOString().slice(0, 10);

    respuesta.setHeader('Content-Type', XLSX);
    respuesta.setHeader(
      'Content-Disposition',
      `attachment; filename="bbdd-leads-${hoy}.xlsx"`,
    );
    respuesta.setHeader('Cache-Control', 'no-store');
    respuesta.send(libro);
  }

  /**
   * Qué pasaría si se cargara ese archivo. NO ESCRIBE NADA.
   *
   * `ESCRIBIR` y no `VER`, aunque no escriba: enseña, lead a lead,
   * el correo y el celular de la gente que ya está en la mesa para
   * poder decir qué choca. Eso es la misma información que la mesa
   * de entrada, que sí pide `VER`... pero aquí se puede sacar en
   * bloque subiendo un archivo con diez mil correos y leyendo cuál
   * «ya estaba»: es un oráculo sobre la base entera. Quien puede
   * cargar ya podría verla; quien solo consulta, no.
   *
   * 200 siempre, también cuando el archivo está mal: el informe
   * dice qué pasa con cada fila, y un 400 con un mensaje suelto
   * obligaría a adivinar cuál de las tres mil es la mala.
   */
  @Post('cargue-vista-previa')
  @Requiere('inscripciones', 'ESCRIBIR')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAXIMO_ARCHIVO_CARGA } }),
  )
  cargueVistaPrevia(
    @Body() dto: CargarLeadsDto,
    @AmbitoActual() ambito: Ambito,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    const subido = this.exigirArchivo(archivo);
    return this.cargue.revisar(
      subido.datos,
      subido.nombre,
      dto.convenio,
      ambito.convenios,
      dto.origen,
    );
  }

  /**
   * Aplica el cargue: crea los nuevos y tapa los huecos.
   *
   * `ESCRIBIR`: mete gente en la mesa de entrada. Y no hay un nivel
   * más alto porque no crea fichas --los leads quedan PENDIENTE y
   * la ficha la hace la conversión, con su propia exigencia--.
   *
   * 200 y no 201: puede que no se cree ninguno. Un 201 diría que
   * sí, y el cuerpo diría que no. Mismo criterio que
   * `convertir-lote`.
   */
  @Post('cargue-aplicar')
  @Requiere('inscripciones', 'ESCRIBIR')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAXIMO_ARCHIVO_CARGA } }),
  )
  cargueAplicar(
    @Body() dto: CargarLeadsDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    const subido = this.exigirArchivo(archivo);
    return this.cargue.aplicar(
      subido.datos,
      subido.nombre,
      dto.convenio,
      ambito.convenios,
      { id: admin.id, nombre: admin.nombre },
      dto.origen,
    );
  }

  /// Lo único que se rechaza de plano: que no haya archivo.
  ///
  /// La extensión y el peso los comprueba el lector y vuelven como
  /// un reparo del informe, no como un 400: la pantalla ya está
  /// enseñando el resultado del cargue y meter ahí dos formas
  /// distintas de fallar la obliga a pintar dos cosas. Pero «no
  /// llegó ningún archivo» no es un reparo de un archivo: es que no
  /// hay nada que leer.
  private exigirArchivo(archivo?: Express.Multer.File): {
    datos: Buffer;
    nombre: string;
  } {
    if (!archivo) {
      throw new BadRequestException(
        'No llegó ningún archivo. Mándelo en el campo «archivo» de un ' +
          'formulario multipart.',
      );
    }
    return {
      /// Copia: multer puede devolver un SharedArrayBuffer, y
      /// exceljs no lo acepta.
      datos: Buffer.from(archivo.buffer),
      nombre: archivo.originalname,
    };
  }

  /**
   * Lo que llegó por los webhooks.
   *
   * `VER` y no `ESCRIBIR`: mirar el buzón es parte de atender
   * inscripciones, y convertir —que sí escribe— tiene su propia
   * ruta con su propio nivel.
   */
  @Get()
  @Requiere('inscripciones')
  listar(
    @AmbitoActual() ambito: Ambito,
    @Query('estado') estado?: string,
    @Query('convenioId') convenioId?: string,
    /// Por donde entro: 'cargue-masivo' para la pantalla de la BBDD.
    @Query('origenSistema') origenSistema?: string,
    @Query('buscar') buscar?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    return this.mesa.listar(
      {
        estado,
        convenioId,
        origenSistema,
        buscar,
        pagina: pagina ? Number(pagina) : undefined,
        limite: limite ? Number(limite) : undefined,
      },
      ambito.convenios,
    );
  }

  /**
   * Convierte varios de una vez.
   *
   * `ESCRIBIR` y no `VER`: crea fichas. Es la misma exigencia que
   * la conversion de uno, y tiene que serlo -- si el lote pidiera
   * menos, seria la puerta de servicio por la que se entra a hacer
   * cien veces lo que de una en una no se puede.
   *
   * 200 y no 201: puede que no se cree ninguna. Un 201 diria que
   * si, y el cuerpo diria que no.
   */
  /// Un solo segmento, y NO 'lote/convertir'.
  ///
  /// Aquella la capturaba `@Post(':id/convertir')` del otro
  /// controlador con `:id = 'lote'`: dos segmentos, mismo molde.
  /// El lote llegaba a la conversion de UNO y contestaba que le
  /// faltaba el canal. Depender del orden en que se registran los
  /// controladores lo arreglaria hoy y lo romperia en silencio el
  /// dia que alguien los reordene.
  @Post('convertir-lote')
  @Requiere('inscripciones', 'ESCRIBIR')
  @HttpCode(200)
  convertirLote(
    @Body() dto: ConvertirLoteDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.lote.convertir(
      dto.ids,
      dto.asesorId,
      admin,
      ambito.convenios,
      /// En que convenios reparte: decide si elige asesor o si
      /// se queda las fichas el mismo.
      conveniosQueReparten(ambito.roles),
      ip,
    );
  }

  /**
   * Deja una nota de gestión sobre un lead: la llamada.
   *
   * Va en UN SOLO SEGMENTO por la trampa que ya se comió
   * `convertir-lote`: con `@Post(':id/notas')` después de otra
   * ruta de dos segmentos, Nest podría capturarla con `:id` valiendo
   * otra cosa. Aquí no colisiona porque `:id` no tiene más
   * segmentos, pero el lote SÍ lo necesita.
   */
  @Post(':id/notas')
  @Requiere('inscripciones', 'ESCRIBIR')
  agregarNota(
    @Param('id') id: string,
    @Body() dto: CrearNotaDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.gestion.agregarNota(id, dto, admin, ambito.convenios, ip);
  }

  /**
   * Reparte leads entre asesores.
   *
   * Un solo segmento, por lo mismo que `convertir-lote`.
   */
  @Post('asignar-lote')
  @Requiere('inscripciones', 'ESCRIBIR')
  asignarLote(
    @Body() dto: AsignarLeadsDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.gestion.asignar(
      dto.ids,
      dto.asesorId ?? null,
      admin,
      ambito.convenios,
      ip,
      conveniosQueReparten(ambito.roles),
      conveniosQueLlevanFichas(ambito.roles),
    );
  }

  /**
   * Arregla un lead que llegó mal.
   *
   * `ESCRIBIR`: cambia los datos con los que después se va a
   * crear una ficha. Verlo es una cosa y componerlo es otra.
   */
  @Patch(':id')
  @Requiere('inscripciones', 'ESCRIBIR')
  arreglar(
    @Param('id') id: string,
    @Body() dto: ArreglarLeadDto,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.mesa.arreglar(id, dto, ambito.convenios);
  }

  /**
   * Los mismos datos, dichos por la ficha, los leads y el RUI.
   *
   * `VER` y no `ESCRIBIR`: mirar el comparativo no cambia nada.
   * Aplicar un valor va por el `PATCH` de la ficha, que ya tiene
   * su propio nivel -- y asi el coordinador de consulta puede
   * revisarlo todo sin poder tocar nada.
   */
  @Get('comparativo/:participanteId')
  @Requiere('inscripciones')
  comparativo(
    @Param('participanteId') id: string,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.comparar.de(id, ambito.convenios);
  }

  /**
   * Descarta varios, con su motivo.
   *
   * `ESCRIBIR`: saca gente de la mesa. Verla es una cosa y
   * decidir que no se le llama es otra.
   */
  @Post('descartar-lote')
  @Requiere('inscripciones', 'ESCRIBIR')
  @HttpCode(200)
  descartarLote(
    @Body() dto: DescartarLoteDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.lote.descartar(dto.ids, dto.motivo, admin, ambito.convenios);
  }
}
