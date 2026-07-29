import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import type { Estado } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // nginx enruta /api/ -> backend/ quitando el prefijo, asi que esto
  // se alcanza publicamente como /api/estado
  @Get('estado')
  getEstado(): Estado {
    return this.appService.getEstado();
  }
}
