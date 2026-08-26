import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuditoriaService } from '../comun/auditoria.service';
import { InstitucionesController } from './instituciones.controller';
import { InstitucionesService } from './instituciones.service';
import { ProveedorWebNavegador } from './web/proveedor-navegador';
import {
  comoSeConsulta,
  PROVEEDOR_WEB,
  ProveedorWebApagado,
  ProveedorWebClaude,
} from './web/proveedor-web';
import { WebService } from './web/web.service';
import { WebWorker } from './web/web.worker';

/// Por defecto el navegador, que no necesita nada. Ver
/// `comoSeConsulta()`.
const QUIEN_CONTESTA = {
  NAVEGADOR: ProveedorWebNavegador,
  API: ProveedorWebClaude,
  APAGADO: ProveedorWebApagado,
};

const proveedorWeb = {
  provide: PROVEEDOR_WEB,
  useClass: QUIEN_CONTESTA[comoSeConsulta()],
};

@Module({
  // AdminGuard necesita JwtService
  imports: [
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [InstitucionesController],
  providers: [
    InstitucionesService,
    AuditoriaService,
    proveedorWeb,
    WebService,
    WebWorker,
  ],
  exports: [InstitucionesService, WebService],
})
export class InstitucionesModule {}
