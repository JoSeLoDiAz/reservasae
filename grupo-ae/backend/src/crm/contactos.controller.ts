import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { RolAdmin, type Admin } from '../../generated/prisma';
import { AdminActual, AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../admin/admin.guard';
import { IpReal } from '../comun/ip-real';
import { CrearContactoDto } from './contactos.dto';
import { ContactosService } from './contactos.service';

/**
 * «Nuevo contacto»: apuntar a mano a alguien que no llegó por un
 * formulario —lo conoció en una feria, llamó a preguntar, lo refirió
 * un cliente—.
 *
 * Ruta propia y no una más de `admin/participantes`, porque no crea
 * una ficha de formación: crea la persona y su negocio. Ver
 * `contacto-nuevo.ts`.
 *
 * Cuelga de `inscripciones` como el embudo y las listas de leads: es
 * la misma gente la que capta y la que vende. Y con ESCRIBIR en las
 * dos rutas, también en la de opciones: esa solo existe para pintar
 * el formulario de crear, y ofrecer líneas en las que después no se
 * puede guardar es enseñar un formulario que siempre falla.
 */
@Controller('admin/contactos')
@UseGuards(AdminGuard)
// aquí entran cédulas, celulares y correos de terceros:
// una cuenta de solo consulta no tiene nada que hacer
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('inscripciones', 'ESCRIBIR')
export class ContactosController {
  constructor(private readonly contactos: ContactosService) {}

  /** Las líneas de negocio y los tipos de documento del formulario. */
  @Get('opciones')
  opciones(@AmbitoActual() ambito: Ambito) {
    return this.contactos.opciones(ambito);
  }

  @Post()
  crear(
    @Body() dto: CrearContactoDto,
    @AdminActual() admin: Admin,
    @AmbitoActual() ambito: Ambito,
    @IpReal() ip: string,
  ) {
    return this.contactos.crear(dto, admin, ambito, ip);
  }
}
