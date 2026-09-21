import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';

import { RolAdmin } from '../../generated/prisma';
import { AmbitoActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere, Roles, type Ambito } from '../admin/admin.guard';
import { CuentasService } from './cuentas.service';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

/** Lo que el asesor completa de una empresa al llamarla. */
export class ActualizarCuentaDto {
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(200)
  direccion?: string | null;

  @IsOptional() @Transform(recortar) @IsString() @MaxLength(40)
  telefono?: string | null;

  @IsOptional() @Transform(recortar) @IsString() @MaxLength(120)
  sectorEconomico?: string | null;

  @IsOptional() @Transform(recortar) @IsString() @MaxLength(160)
  contactoNombre?: string | null;

  @IsOptional() @Transform(recortar) @IsString() @MaxLength(120)
  contactoCargo?: string | null;

  @IsOptional()
  @Transform(recortar)
  @ValidateIf((_o: unknown, v: unknown) => v !== null)
  @IsEmail({}, { message: 'Escriba un correo válido, por ejemplo nombre@empresa.com.' })
  contactoCorreo?: string | null;

  @IsOptional()
  @ValidateIf((_o: unknown, v: unknown) => v !== null)
  @IsInt({ message: 'El número de colaboradores va en número entero.' })
  @Min(1, { message: 'El número de colaboradores va desde 1.' })
  numeroColaboradores?: number | null;
}

/**
 * Las cuentas (empresas).
 *
 * VERLAS es de quien trabaja negocios; COMPLETAR sus datos de contacto,
 * de quien tiene escritura en esa misma área, como editar un negocio.
 */
@UseGuards(AdminGuard)
@Controller('admin/cuentas')
@Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
@Requiere('inscripciones')
export class CuentasController {
  constructor(private readonly cuentas: CuentasService) {}

  @Get()
  listar(@AmbitoActual() ambito: Ambito, @Query('buscar') buscar?: string) {
    return this.cuentas.listar(ambito, buscar);
  }

  @Get(':id')
  ficha(@Param('id') id: string, @AmbitoActual() ambito: Ambito) {
    return this.cuentas.ficha(id, ambito);
  }

  @Patch(':id')
  @Requiere('inscripciones', 'ESCRIBIR')
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarCuentaDto,
    @AmbitoActual() ambito: Ambito,
  ) {
    return this.cuentas.actualizar(id, ambito, dto);
  }
}
