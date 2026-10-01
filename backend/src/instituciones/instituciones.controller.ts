/** El maestro de organizaciones, desde el panel. */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import type { Admin } from '../../generated/prisma';
import { AdminActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere } from '../admin/admin.guard';
import {
  AplicarPropuestaDto,
  EditarInstitucionDto,
  PropuestasEnLoteDto,
} from './dto';
import { InstitucionesService } from './instituciones.service';
import { webConectado } from './web/proveedor-web';
import { WebService } from './web/web.service';

/// Va bajo el área de reserva: quien atiende organizaciones
/// es quien las va a corregir. Verificar exige ESCRIBIR --
/// firmar que una ficha está bien no es una consulta.
@Controller('admin/instituciones')
@UseGuards(AdminGuard)
@Requiere('reserva', 'VER')
export class InstitucionesController {
  constructor(
    private readonly instituciones: InstitucionesService,
    private readonly web: WebService,
  ) {}

  @Get()
  listar(
    @Query('buscar') buscar?: string,
    @Query('incompletas') incompletas?: string,
    @Query('sinVerificar') sinVerificar?: string,
    @Query('sugeridos') sugeridos?: string,
    @Query('ocultas') ocultas?: string,
    @Query('pagina') pagina?: string,
  ) {
    return this.instituciones.listar({
      buscar,
      soloIncompletas: incompletas === '1',
      soloSinVerificar: sinVerificar === '1',
      soloSugeridos: sugeridos === '1',
      soloOcultas: ocultas === '1',
      pagina: pagina ? Number(pagina) : 1,
    });
  }

  @Get('resumen')
  resumen() {
    return this.instituciones.resumen();
  }

  /** Lo que un robot propuso y nadie ha resuelto. */
  @Get('pendientes')
  pendientes() {
    return this.instituciones.pendientes();
  }

  @Get(':id')
  ver(@Param('id') id: string) {
    return this.instituciones.ver(id);
  }

  @Patch(':id')
  @Requiere('reserva', 'ESCRIBIR')
  editar(
    @Param('id') id: string,
    @Body() dto: EditarInstitucionDto,
    @AdminActual() admin: Admin,
  ) {
    return this.instituciones.editar(id, dto, {
      id: admin.id,
      nombre: admin.nombre,
    });
  }

  @Post(':id/verificar')
  @Requiere('reserva', 'ESCRIBIR')
  verificar(@Param('id') id: string, @AdminActual() admin: Admin) {
    return this.instituciones.verificar(id, admin.id);
  }

  @Post(':id/desverificar')
  @Requiere('reserva', 'ESCRIBIR')
  desverificar(@Param('id') id: string) {
    return this.instituciones.desverificar(id);
  }

  /**
   * Quitar del listado una organización que no tiene a nadie.
   *
   * ESCRIBIR, lo mismo que exige editarla: quitar del listado es menos
   * que cambiarle la razón social, y no tendría sentido que quien puede
   * reescribir una ficha entera no pueda apartarla.
   *
   * No borra: oculta. Y comprueba en el servidor que no le cuelgue
   * nadie —lo que mande la pantalla no decide—.
   */
  @Post(':id/ocultar')
  @Requiere('reserva', 'ESCRIBIR')
  ocultar(@Param('id') id: string, @AdminActual() admin: Admin) {
    return this.instituciones.ocultar(id, {
      id: admin.id,
      nombre: admin.nombre,
    });
  }

  /** Devolverla al listado: quitar tiene que poder desandarse. */
  @Post(':id/mostrar')
  @Requiere('reserva', 'ESCRIBIR')
  mostrar(@Param('id') id: string, @AdminActual() admin: Admin) {
    return this.instituciones.mostrar(id, {
      id: admin.id,
      nombre: admin.nombre,
    });
  }

  /**
   * Que el buscador web vaya a mirar este NIT.
   *
   * Pide ESCRIBIR aunque no escriba nada en la ficha: la
   * consulta cuesta plata y termina en una propuesta que
   * alguien va a tener que resolver.
   */
  @Post(':id/validar-web')
  @Requiere('reserva', 'ESCRIBIR')
  async validarWeb(@Param('id') id: string) {
    /// Apagado no se encola: una fila esperando en una cola
    /// que nadie va a vaciar se ve igual que una consulta en
    /// curso, y el asesor se queda esperando una respuesta
    /// que no va a llegar nunca.
    if (!webConectado()) {
      throw new BadRequestException(
        'El buscador web está apagado en el servidor.',
      );
    }

    // quien está mirando la ficha va delante de lo que se
    // encoló en segundo plano
    await this.web.encolar(id, 100);
    return this.web.estado(id);
  }

  /** En qué va la consulta, para poder mostrarlo en la ficha. */
  @Get(':id/estado-web')
  estadoWeb(@Param('id') id: string) {
    return this.web.estado(id);
  }

  /**
   * Descartar varias propuestas de un tirón.
   *
   * Va ANTES de `propuestas/:id/aplicar` en el fichero por
   * costumbre de rutas, no por necesidad: los segmentos fijos
   * («descartar», «aceptar») no colisionan con `:id` porque van
   * en otra posición de la ruta.
   */
  @Post('propuestas/descartar')
  @Requiere('reserva', 'ESCRIBIR')
  descartarVarias(
    @Body() dto: PropuestasEnLoteDto,
    @AdminActual() admin: Admin,
  ) {
    return this.instituciones.descartarVarias(dto.ids, admin.id);
  }

  /// Aceptar en lote acepta TODOS los campos de esas propuestas:
  /// no hay forma de elegir. Quien avisa de eso es la pantalla,
  /// antes de confirmar.
  @Post('propuestas/aceptar')
  @Requiere('reserva', 'ESCRIBIR')
  aceptarVarias(@Body() dto: PropuestasEnLoteDto, @AdminActual() admin: Admin) {
    return this.instituciones.aceptarVarias(dto.ids, admin.id);
  }

  @Post('propuestas/:id/aplicar')
  @Requiere('reserva', 'ESCRIBIR')
  aplicar(
    @Param('id') id: string,
    @Body() dto: AplicarPropuestaDto,
    @AdminActual() admin: Admin,
  ) {
    return this.instituciones.aplicarPropuesta(id, dto, admin.id);
  }

  /**
   * DESHACER UN DESCARTE: el dato vuelve a poder proponerse.
   *
   * CON EL MISMO PERMISO QUE RESOLVER UNA PROPUESTA ---`reserva`
   * ESCRIBIR---, y no es casualidad: es exactamente la misma
   * decisión al revés. Quien puede decir «este teléfono no sirve»
   * es quien tiene que poder decir «me equivoqué». Pedir más
   * dejaría al asesor que se equivocó esperando a otra persona para
   * arreglar lo suyo; pedir menos dejaría volver a proponer datos a
   * quien no puede ni aceptarlos.
   *
   * `@Post` y no `@Delete` por la costumbre de las otras puertas de
   * este controlador ---`ocultar`, `mostrar`, `verificar`---: lo que
   * se nombra es la DECISIÓN, no la fila que la implementa. Desde la
   * pantalla esto no borra nada, permite.
   *
   * Listar no lleva puerta propia: los descartes van dentro de la
   * ficha (`GET :id`), que ya exige `reserva` VER en la clase.
   */
  @Post('descartes/:id/permitir')
  @Requiere('reserva', 'ESCRIBIR')
  permitirDeNuevo(@Param('id') id: string, @AdminActual() admin: Admin) {
    return this.instituciones.permitirDeNuevo(id, admin);
  }
}
